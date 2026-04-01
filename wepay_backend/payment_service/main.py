from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from database import engine, get_db
import models, schemas
from pydantic import BaseModel
import httpx

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Procesamiento de Pagos")

# Crear tablas en wepay_pagos
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Procesamiento de Pagos")

@app.post("/calcular-division", response_model=dict)
def calcular_division(datos: schemas.DivisionCuenta):
    """
    Simula la consulta al servicio de sesiones y calcula cuánto debe cada uno.
    """
    # En el futuro, aquí usaremos HTTPX para preguntar al microservicio 3:
    # "Dame el total de la mesa X"
    total_cuenta = 1200.00 # Dato simulado
    comensales = 3         # Dato simulado
    
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
async def procesar_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db)):
    """
    Registra el pago de un usuario específico para una mesa y avisa a Sesiones.
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
    
    # 2. Lógica de negocio: Avisar a Sesiones que este usuario ya pagó
    # Hacemos una petición asíncrona a tu API Gateway (puerto 8080)
    estado_mesa = {}
    async with httpx.AsyncClient() as client:
        try:
            respuesta = await client.post(
                f"http://localhost:8080/sesiones/sesion/{pago.sesion_id}/marcar-pagado",
                json={"usuario_id": str(pago.usuario_id)}
            )
            estado_mesa = respuesta.json()
        except Exception as e:
            estado_mesa = {"error": "Pago cobrado, pero no se pudo notificar a Sesiones", "detalle": str(e)}
    
    # Retornamos los datos del pago junto con la respuesta que nos dio Sesiones
    return {
        "pago": {
            "id": nuevo_pago.id,
            "monto": nuevo_pago.monto,
            "completado": nuevo_pago.completado
        },
        "estado_sesion": estado_mesa
    }