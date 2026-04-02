from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, List
import uuid

from database import engine, get_db
import models, schemas, redis_client
from pydantic import BaseModel

# Crear tablas en la base de datos 'wepay_sesiones'
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Gestión de Sesiones y Pedidos")


# --- MANEJADOR DE WEBSOCKETS ---
class ConnectionManager:
    def __init__(self):
        # Guardaremos las conexiones así: {"id_de_la_mesa": [celular1, celular2, ...]}
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, sesion_id: str):
        await websocket.accept()
        if sesion_id not in self.active_connections:
            self.active_connections[sesion_id] = []
        self.active_connections[sesion_id].append(websocket)

    def disconnect(self, websocket: WebSocket, sesion_id: str):
        if sesion_id in self.active_connections:
            self.active_connections[sesion_id].remove(websocket)
            if not self.active_connections[sesion_id]:
                del self.active_connections[sesion_id]

    async def broadcast(self, message: str, sesion_id: str):
        # Si hay celulares conectados a esta mesa, les mandamos el mensaje a todos
        if sesion_id in self.active_connections:
            for connection in self.active_connections[sesion_id]:
                await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/sesion/{sesion_id}")
async def websocket_mesa(websocket: WebSocket, sesion_id: str):
    await manager.connect(websocket, sesion_id)
    try:
        while True:
            # Nos quedamos escuchando infinitamente (manteniendo el túnel abierto)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, sesion_id)


# --- ENDPOINTS ---

@app.post("/sesion/abrir", response_model=schemas.SesionMesaResponse)
def abrir_mesa(sesion: schemas.SesionMesaCreate, db: Session = Depends(get_db)):
    # 1. Crear la sesión en PostgreSQL (Registro histórico)
    nueva_sesion = models.SesionMesa(
        restaurante_id=sesion.restaurante_id,
        numero_mesa=sesion.numero_mesa
    )
    db.add(nueva_sesion)
    db.commit()
    db.refresh(nueva_sesion)
    
    # 2. Inicializar el estado vivo en Redis para velocidad
    estado_inicial = {
        "restaurante_id": str(sesion.restaurante_id),
        "numero_mesa": sesion.numero_mesa,
        "items": []
    }
    redis_client.actualizar_estado_mesa(str(nueva_sesion.id), estado_inicial)
    
    return nueva_sesion

@app.post("/sesion/{sesion_id}/pedir", response_model=schemas.OrdenItemResponse)
def agregar_item_a_cuenta(
    sesion_id: uuid.UUID, 
    pedido: schemas.OrdenItemCreate,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # 1. Verificar si la sesión existe y está activa
    sesion = db.query(models.SesionMesa).filter(models.SesionMesa.id == sesion_id, models.SesionMesa.activa == True).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="La mesa no existe o ya fue cerrada")

    # 2. Guardar el pedido en PostgreSQL
    nueva_orden = models.OrdenItem(
        sesion_id=sesion_id,
        usuario_id=pedido.usuario_id,
        item_menu_id=pedido.item_menu_id,
        cantidad=pedido.cantidad
    )
    db.add(nueva_orden)
    db.commit()
    db.refresh(nueva_orden)

    # 3. Actualizar el estado en Redis (Cache para tiempo real)
    # Aquí podríamos disparar una notificación por WebSocket en el futuro
    estado_actual = redis_client.obtener_estado_mesa(str(sesion_id))
    if estado_actual:
        estado_actual["items"].append({
            "usuario_id": str(pedido.usuario_id),
            "item_id": str(pedido.item_menu_id),
            "cantidad": pedido.cantidad
        })
        redis_client.actualizar_estado_mesa(str(sesion_id), estado_actual)

    # 4. ¡LA MAGIA MULTIJUGADOR! 
    # Le gritamos a todos los celulares de la mesa que recarguen sus platillos
    background_tasks.add_task(manager.broadcast, "actualizar_mesa", str(sesion_id))

    return nueva_orden

@app.get("/sesion/{sesion_id}/estado")
def ver_estado_mesa(sesion_id: uuid.UUID):
    # Consultar Redis primero (es mucho más rápido que ir a Postgres)
    estado = redis_client.obtener_estado_mesa(str(sesion_id))
    if not estado:
        raise HTTPException(status_code=404, detail="Sesión no encontrada en caché")
    return estado


@app.get("/sesion/{sesion_id}", response_model=schemas.SesionMesaResponse)
def obtener_sesion_base(sesion_id: uuid.UUID, db: Session = Depends(get_db)):
    # Buscamos la sesión en PostgreSQL para devolver a qué restaurante pertenece
    sesion = db.query(models.SesionMesa).filter(models.SesionMesa.id == sesion_id).first()
    
    if not sesion:
        raise HTTPException(status_code=404, detail="La mesa solicitada no existe")
        
    return sesion


class NotificacionPago(BaseModel):
    usuario_id: uuid.UUID

@app.post("/sesion/{sesion_id}/marcar-pagado")
def webhook_marcar_pagado(sesion_id: uuid.UUID, datos: NotificacionPago, db: Session = Depends(get_db)):
    """
    Este endpoint es llamado internamente por el Microservicio de Pagos.
    """
    sesion = db.query(models.SesionMesa).filter(models.SesionMesa.id == sesion_id).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    # 1. Marcar los platillos de este usuario como pagados
    items_del_usuario = db.query(models.OrdenItem).filter(
        models.OrdenItem.sesion_id == sesion_id,
        models.OrdenItem.usuario_id == datos.usuario_id,
        models.OrdenItem.pagado == False
    ).all()

    for item in items_del_usuario:
        setattr(item, "pagado", True)
    db.commit()

    # 2. ¿Falta alguien por pagar en toda la mesa?
    items_pendientes = db.query(models.OrdenItem).filter(
        models.OrdenItem.sesion_id == sesion_id,
        models.OrdenItem.pagado == False
    ).count()

    # 3. Si todos pagaron, cerramos la mesa
    if items_pendientes == 0:
        setattr(sesion, "activa", False)
        db.commit()
        return {"mensaje": "Todos han pagado. Mesa cerrada.", "mesa_cerrada": True}

    return {"mensaje": f"Pago registrado. Faltan {items_pendientes} platillos por pagar.", "mesa_cerrada": False}


@app.get("/restaurantes/{restaurante_id}/mesas-activas")
def obtener_mesas_activas(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    """Devuelve todas las mesas que actualmente están marcadas como activas."""
    mesas = db.query(models.SesionMesa).filter(
        models.SesionMesa.restaurante_id == restaurante_id,
        models.SesionMesa.activa == True
    ).all()
    
    return mesas

@app.patch("/sesion/{sesion_id}/forzar-cierre")
def forzar_cierre_mesa(sesion_id: uuid.UUID, db: Session = Depends(get_db)):
    """Cierra la mesa a la fuerza, sin importar si hay pagos pendientes."""
    sesion = db.query(models.SesionMesa).filter(models.SesionMesa.id == sesion_id).first()
    
    if not sesion:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
        
    setattr(sesion, "activa", False)
    db.commit()
    
    # Opcional: Limpiar Redis para liberar memoria
    # redis_client.eliminar_estado_mesa(str(sesion_id))
    
    return {"mensaje": f"La mesa {sesion.numero_mesa} ha sido cerrada forzosamente."}