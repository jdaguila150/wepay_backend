from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from database import engine, get_db
import models, schemas

# Crear tablas en wepay_pagos
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Procesamiento de Pagos")

@app.post("/pagos/calcular-division", response_model=dict)
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

@app.post("/pagos/procesar", response_model=schemas.PagoResponse)
def procesar_pago(pago: schemas.PagoCreate, db: Session = Depends(get_db)):
    """
    Registra el pago de un usuario específico para una mesa.
    """
    nuevo_pago = models.Pago(
        sesion_id=pago.sesion_id,
        usuario_id=pago.usuario_id,
        monto=pago.monto,
        metodo_pago=pago.metodo_pago,
        completado=True # Aquí iría la integración con Stripe o PayPal
    )
    
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    
    # Lógica de negocio: Si la suma de pagos == total de la mesa, 
    # se debería enviar un evento para cerrar la sesión definitivamente.
    
    return nuevo_pago