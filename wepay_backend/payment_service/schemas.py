from pydantic import BaseModel
import uuid
from typing import List, Optional

class PagoCreate(BaseModel):
    sesion_id: uuid.UUID
    usuario_id: uuid.UUID
    monto: float
    metodo_pago: str = "tarjeta"

class DivisionCuenta(BaseModel):
    sesion_id: uuid.UUID
    tipo: str  # "equitativa" o "individual"

class PagoResponse(BaseModel):
    id: uuid.UUID
    sesion_id: uuid.UUID
    usuario_id: uuid.UUID
    monto: float
    completado: bool

    class Config:
        from_attributes = True