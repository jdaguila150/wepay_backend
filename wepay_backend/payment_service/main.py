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
    background_tasks: BackgroundTasks, # <- ¡Inyectamos las tareas en segundo plano!
    db: Session = Depends(get_db)
):
    """
    Registra el pago, avisa a Sesiones y dispara el WebSocket a la mesa.
    """
    # 1. Guardar en tu base de datos de Pagos
    nuevo_pago = models.Pago(
        sesion_id=pago.sesion_id,
        usuario_id=pago.usuario_id, # Puede ser null si es invitado
        monto=pago.monto,
        metodo_pago=pago.metodo_pago,
        completado=True 
    )
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    
    # 2. Lógica de negocio: Avisar a Sesiones (¡Ahora con las aportaciones!)
    estado_mesa = {}
    async with httpx.AsyncClient() as client:
        try:
            respuesta = await client.post(
                f"http://localhost:8080/sesiones/sesion/{pago.sesion_id}/marcar-pagado",
                json={
                    # Mandamos el usuario_id si existe, si no mandamos null
                    "usuario_id": str(pago.usuario_id) if pago.usuario_id else None,
                    "nombre_usuario": pago.nombre_usuario,
                    "abono_propio": pago.abono_propio,
                    # Le pasamos a Sesiones el chisme de a quién apoyamos para que lo descuente
                    "aportaciones_vecinos": pago.aportaciones_vecinos 
                }
            )
            estado_mesa = respuesta.json()
        except Exception as e:
            estado_mesa = {"error": "Pago cobrado, pero no se pudo notificar a Sesiones", "detalle": str(e)}
    
    # 3. ¡LA MAGIA DEL TIEMPO REAL!
    # Le gritamos a la mesa que alguien pagó, sin hacer esperar la respuesta del HTTP
    mensaje_ws = json.dumps({
        "accion": "recargar_mesa",
        "mensaje": f"¡{pago.nombre_usuario or 'Un usuario'} ha realizado un pago!"
    })
    background_tasks.add_task(manager.broadcast, mensaje_ws, str(pago.sesion_id))

    return {
        "pago": {
            "id": nuevo_pago.id,
            "monto": nuevo_pago.monto,
            "completado": nuevo_pago.completado
        },
        "estado_sesion": estado_mesa
    }