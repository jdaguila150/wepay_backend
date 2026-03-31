from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from database import engine, get_db
import models, schemas, redis_client

# Crear tablas en la base de datos 'wepay_sesiones'
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Gestión de Sesiones y Pedidos")

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