from pydantic import BaseModel
import uuid
from datetime import datetime
from typing import List, Optional

# --- SCHEMAS PARA SESIÓN DE MESA ---
class SesionMesaCreate(BaseModel):
    restaurante_id: uuid.UUID
    numero_mesa: str

class SesionMesaResponse(BaseModel):
    id: uuid.UUID
    restaurante_id: uuid.UUID
    numero_mesa: str
    activa: bool
    creada_en: datetime

    class Config:
        from_attributes = True

# --- SCHEMAS PARA PEDIDOS (ITEMS ORDENADOS) ---
class OrdenItemCreate(BaseModel):
    usuario_id: uuid.UUID
    item_menu_id: uuid.UUID
    cantidad: int = 1

class OrdenItemResponse(BaseModel):
    id: uuid.UUID
    sesion_id: uuid.UUID
    usuario_id: uuid.UUID
    item_menu_id: uuid.UUID
    cantidad: int
    pagado: bool

    class Config:
        from_attributes = True