from pydantic import BaseModel
import uuid
from typing import List, Optional, Dict

# 1. LA PUERTA DE ENTRADA (Lo que recibimos de React)
class PagoCreate(BaseModel):
    sesion_id: uuid.UUID
    usuario_id: Optional[uuid.UUID] = None
    nombre_usuario: Optional[str] = None
    monto: float
    metodo_pago: str = "tarjeta"
    abono_propio: float = 0.0 
    aportaciones_vecinos: Optional[Dict[str, float]] = {}

class DivisionCuenta(BaseModel):
    sesion_id: uuid.UUID
    tipo: str  # "equitativa" o "individual"

# 2. LA PUERTA DE SALIDA (Lo que le devolvemos a React)
class PagoResponse(BaseModel):
    id: uuid.UUID
    sesion_id: uuid.UUID
    usuario_id: Optional[uuid.UUID] = None  # ¡También debe ser opcional aquí!
    monto: float
    completado: bool

    class Config:
        from_attributes = True