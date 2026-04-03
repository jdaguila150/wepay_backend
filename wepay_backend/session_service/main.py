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



@app.post("/sesion/verificar-fisica")
async def verificar_o_crear_mesa_fisica(datos: schemas.VerificarMesaFisica, db: Session = Depends(get_db)):
    # 1. BUSCAR: ¿Ya hay alguien comiendo en esta mesa física?
    # Asegúrate de buscar solo sesiones que estén activas/abiertas
    sesion_activa = db.query(models.SesionMesa).filter(
        models.SesionMesa.restaurante_id == datos.restaurante_id,
        models.SesionMesa.numero_mesa == datos.numero_mesa,
        models.SesionMesa.activa == True 
    ).first()

    # 2. CASO A: La mesa ya tiene gente. Devolvemos el mismo UUID.
    if sesion_activa:
        return {
            "id": sesion_activa.id,
            "mensaje": "Se unió a la cuenta existente de la mesa",
            "es_nueva": False
        }

    # 3. CASO B: La mesa está vacía. Creamos una sesión nueva.
    # (Esta es la misma lógica exacta que ya tienes en tu endpoint de "/abrir")
    nueva_sesion = models.SesionMesa(
        restaurante_id=datos.restaurante_id,
        numero_mesa=datos.numero_mesa,
        activa=True
    )
    db.add(nueva_sesion)
    db.commit()
    db.refresh(nueva_sesion)

    # 👇 4. INYECTAR EN REDIS (Pre-calentar la caché) 👇
    estado_inicial = {
        "sesion_id": str(nueva_sesion.id),
        "restaurante_id": str(nueva_sesion.restaurante_id),
        "numero_mesa": nueva_sesion.numero_mesa,
        "items": [], 
        "estado": "abierta"
    }
    # Guardamos la estructura inicial usando tu función de redis_client
    redis_client.actualizar_estado_mesa(str(nueva_sesion.id), estado_inicial)

    return {
        "id": nueva_sesion.id,
        "mensaje": "Mesa abierta exitosamente",
        "es_nueva": True
    }



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

    # # 4. ¡LA MAGIA MULTIJUGADOR! 
    # # Le gritamos a todos los celulares de la mesa que recarguen sus platillos
    # background_tasks.add_task(manager.broadcast, "actualizar_mesa", str(sesion_id))

    return nueva_orden

@app.get("/sesion/{sesion_id}/estado")
def ver_estado_mesa(sesion_id: uuid.UUID, db: Session = Depends(get_db)):
    
    # 1. Intentamos consultar Redis primero (La ruta rápida)
    estado = redis_client.obtener_estado_mesa(str(sesion_id))
    
    # Si está en Redis, lo devolvemos inmediatamente y terminamos
    if estado:
        return estado

    # 2. CACHE MISS: No está en Redis. Vamos a buscar a la base de datos de verdad.
    sesion_db = db.query(models.SesionMesa).filter(models.SesionMesa.id == sesion_id).first()
    
    # Si de verdad no está en la BD, entonces sí es un 404 legítimo
    if not sesion_db:
        raise HTTPException(status_code=404, detail="La sesión no existe ni en caché ni en la Base de Datos")

    # 3. Lo encontramos en la BD. Vamos a reconstruir el estado para Redis.
    # Nota: Si ya guardas los pedidos en una tabla de Postgres, deberías hacer un query 
    # de esos pedidos aquí para meterlos en la lista "items". Si solo usas Redis para los pedidos 
    # temporales, la lista arranca vacía.
    estado_recuperado = {
        "sesion_id": str(sesion_db.id),
        "restaurante_id": str(sesion_db.restaurante_id),
        "numero_mesa": sesion_db.numero_mesa,
        "items": [], 
        "estado": "abierta" if sesion_db.activa is True else "cerrada"
    }

    # 4. Volvemos a guardar este estado en Redis para que la próxima 
    # vez que alguien pregunte, vuelva a ser rapidísimo.
    redis_client.actualizar_estado_mesa(str(sesion_id), estado_recuperado)

    # 5. Devolvemos el estado recuperado al Frontend
    return estado_recuperado


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




# 1. ENDPOINT PARA AGREGAR UNA MESA (Lo usará la pantalla /administrador)
@app.post("/restaurantes/{restaurante_id}/mesas")
async def agregar_mesa_fisica(restaurante_id: str, mesa_data: schemas.MesaFisicaCreate, db: Session = Depends(get_db)):
    
    # Verificamos que no exista ya una mesa con ese mismo nombre en este restaurante
    mesa_existente = db.query(models.MesaFisica).filter(
        models.MesaFisica.restaurante_id == restaurante_id,
        models.MesaFisica.nombre == mesa_data.nombre
    ).first()

    if mesa_existente:
        raise HTTPException(status_code=400, detail="Esta mesa ya existe en el restaurante")

    nueva_mesa = models.MesaFisica(
        restaurante_id=restaurante_id,
        nombre=mesa_data.nombre
    )
    db.add(nueva_mesa)
    db.commit()
    db.refresh(nueva_mesa)
    
    return {
        "mensaje": "Mesa agregada correctamente", 
        "id": nueva_mesa.id, 
        "nombre": nueva_mesa.nombre
    }

# 2. ENDPOINT PARA OBTENER LAS MESAS (Lo usará el Menu.jsx para los QRs)
@app.get("/restaurantes/{restaurante_id}/mesas")
async def obtener_mesas_fisicas(restaurante_id: str, db: Session = Depends(get_db)):
    mesas = db.query(models.MesaFisica).filter(
        models.MesaFisica.restaurante_id == restaurante_id
    ).all()
    
    return mesas