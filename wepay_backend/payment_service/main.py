from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import uuid
from database import engine, get_db
import models, schemas
from pydantic import BaseModel
import httpx
import json

# Crear tablas en wepay_pagos
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Procesamiento de Pagos")

# =====================================================================
# 1. MANAGER DE WEBSOCKETS (El director de orquesta)
# =====================================================================
class ConnectionManager:
    def __init__(self):
        # Diccionario para guardar: {"id_mesa": [websocket_juan, websocket_ana]}
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, sesion_id: str):
        await websocket.accept()
        if sesion_id not in self.active_connections:
            self.active_connections[sesion_id] = []
        self.active_connections[sesion_id].append(websocket)

    def disconnect(self, websocket: WebSocket, sesion_id: str):
        if sesion_id in self.active_connections:
            self.active_connections[sesion_id].remove(websocket)
            # Limpiamos la memoria si la mesa se queda vacía
            if not self.active_connections[sesion_id]:
                del self.active_connections[sesion_id]

    async def broadcast(self, message: str, sesion_id: str):
        # Le envía el mensaje a todos los celulares conectados a esta sesión
        if sesion_id in self.active_connections:
            for connection in self.active_connections[sesion_id]:
                await connection.send_text(message)

manager = ConnectionManager()

# =====================================================================
# 2. ENDPOINT DEL WEBSOCKET (A donde se conecta React)
# =====================================================================
@app.websocket("/ws/{sesion_id}")
async def websocket_endpoint(websocket: WebSocket, sesion_id: str):
    await manager.connect(websocket, sesion_id)
    try:
        while True:
            # Mantenemos la conexión viva esperando mensajes del frontend
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, sesion_id)


# =====================================================================
# 3. ENDPOINTS REST
# =====================================================================
@app.post("/calcular-division", response_model=dict)
def calcular_division(datos: schemas.DivisionCuenta):
    total_cuenta = 1200.00 
    comensales = 3        
    
    if datos.tipo == "equitativa":
        cuota = total_cuenta / comensales
        return {
            "sesion_id": datos.sesion_id,
            "total_total": total_cuenta,
            "metodo": "equitativa",
            "monto_por_persona": round(cuota, 2)
        }
    return {"error": "Método no soportado aún"}


@app.post("/procesar")
async def procesar_pago(
    pago: schemas.PagoCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """
    Registra el pago, avisa a Sesiones y dispara el WebSocket a la mesa.
    """
    # 1. Guardar en tu base de datos de Pagos
    nuevo_pago = models.Pago(
        sesion_id=pago.sesion_id,
        usuario_id=pago.usuario_id, 
        monto=pago.monto,
        metodo_pago=pago.metodo_pago,
        completado=True 
    )
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    
    # 2. Lógica de negocio: Avisar a Sesiones 
    estado_mesa = {}
    async with httpx.AsyncClient() as client:
        try:
            respuesta = await client.post(
                f"http://localhost:8080/sesiones/sesion/{pago.sesion_id}/marcar-pagado",
                json={
                    "usuario_id": str(pago.usuario_id) if pago.usuario_id else None,
                    "nombre_usuario": pago.nombre_usuario,
                    "abono_propio": pago.abono_propio,
                    "aportaciones_vecinos": pago.aportaciones_vecinos 
                }
            )
            # Validamos que no explote si el otro servicio no devuelve JSON
            if respuesta.status_code == 200:
                estado_mesa = respuesta.json()
            else:
                estado_mesa = {"error": f"Sesiones devolvió error {respuesta.status_code}"}
                
        except Exception as e:
            estado_mesa = {"error": "No se pudo notificar a Sesiones", "detalle": str(e)}
    
    # 3. ¡LA MAGIA DEL TIEMPO REAL!
    mensaje_ws = json.dumps({
        "accion": "recargar_mesa",
        "mensaje": f"¡{pago.nombre_usuario or 'Un usuario'} ha realizado un pago!"
    })
    background_tasks.add_task(manager.broadcast, mensaje_ws, str(pago.sesion_id))

    # 👇 EL FIX ESTÁ AQUÍ: Forzamos la conversión a str y float 👇
    return {
        "pago": {
            "id": str(nuevo_pago.id),         # Evita el error de "UUID not serializable"
            "monto": float(nuevo_pago.monto), # Evita el error de "Decimal not serializable" # type: ignore
            "completado": bool(nuevo_pago.completado)
        },
        "estado_sesion": estado_mesa
    }

    

@app.post("/sesion/{sesion_id}/proponer-tablas")
async def proponer_tablas_endpoint(sesion_id: uuid.UUID, propuesta: schemas.PropuestaTablas):
    
    # 👇 NUEVO: 1. Pegar el Post-it en Redis (Sesiones)
    async with httpx.AsyncClient() as client:
        await client.post(f"http://127.0.0.1:8002/sesion/{sesion_id}/guardar-propuesta", json=propuesta.dict())

    # 2. Armamos el paquete y damos el grito por el WebSocket
    mensaje_ws = {
        "accion": "nueva_propuesta_tablas",
        "datos": {
            "creador_id": propuesta.creador_id,
            "creador_nombre": propuesta.creador_nombre,
            "participantes": propuesta.participantes,
            "monto_por_persona": propuesta.monto_por_persona
        }
    }

    try:
        await manager.broadcast(json.dumps(mensaje_ws), str(sesion_id))
        return {"mensaje": "Propuesta lanzada y guardada exitosamente"}
    except Exception as e:
        print(f"Error en broadcast: {e}")
        return {"error": "No se pudo notificar a la mesa en vivo"}



@app.post("/sesion/{sesion_id}/aceptar-tablas")
async def aceptar_tablas_ws(sesion_id: uuid.UUID, datos: schemas.AceptarTablas):
    # 1. Le pasamos el acuerdo al microservicio de Sesiones para que lo guarde
    async with httpx.AsyncClient() as client:
        await client.post(f"http://127.0.0.1:8002/sesion/{sesion_id}/registrar-transferencia", json=datos.dict())
        
    # 2. Le gritamos a la mesa que los números cambiaron para que recarguen
    await manager.broadcast(json.dumps({"accion": "recargar_mesa", "mensaje": "Alguien aceptó las tablas"}), str(sesion_id))
    return {"mensaje": "Tablas aceptadas y mesa notificada"}


@app.post("/sesion/{sesion_id}/declinar-tablas")
async def declinar_tablas_ws(sesion_id: uuid.UUID, datos: dict):
    
    # 1. Le decimos a Sesiones que rompa el Post-it en Redis
    async with httpx.AsyncClient() as client:
        await client.post(f"http://127.0.0.1:8002/sesion/{sesion_id}/cancelar-propuesta")

    # 2. Armamos el chisme
    mensaje_ws = {
        "accion": "propuesta_declinada",
        "datos": {
            "declinador_nombre": datos.get("declinador_nombre", "Un comensal"),
            "declinador_id": datos.get("declinador_id"),
            "creador_id": datos.get("creador_id")
        }
    }

    # 3. Lo gritamos a todos en la mesa
    try:
        await manager.broadcast(json.dumps(mensaje_ws), str(sesion_id))
        return {"mensaje": "Propuesta declinada notificada"}
    except Exception as e:
        print(f"Error en broadcast: {e}")
        return {"error": "Error al notificar"}