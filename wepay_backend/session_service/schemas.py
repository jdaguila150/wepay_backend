from pydantic import BaseModel
import uuid
from datetime import datetime
from typing import List, Optional, Dict

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
    # Lo hacemos opcional y con valor por defecto None
    usuario_id: Optional[uuid.UUID] = None 
    item_menu_id: uuid.UUID
    cantidad: int = 1
    # Recibimos el nombre del invitado
    nombre_usuario: Optional[str] = None 
    nombre_item: Optional[str] = None
    notas: Optional[str] = None
    estado: Optional[str] = "pendiente"

class OrdenItemResponse(BaseModel):
    id: uuid.UUID
    sesion_id: uuid.UUID
    usuario_id: Optional[uuid.UUID] = None
    item_menu_id: uuid.UUID
    cantidad: int
    pagado: bool
    nombre_usuario: Optional[str] = None
    nombre_item: Optional[str] = None
    notas: Optional[str] = None
    estado: str = "pendiente"
    creado_en: Optional[datetime] = None

    class Config:
        from_attributes = True

class OrdenPendienteResponse(BaseModel):
    id: uuid.UUID
    sesion_id: uuid.UUID
    mesa_id: str
    numero_mesa: str
    usuario_id: Optional[uuid.UUID] = None
    nombre_usuario: Optional[str] = None
    item_menu_id: uuid.UUID
    nombre_item: str
    cantidad: int
    notas: Optional[str] = None
    estado: str
    pagado: bool
    creado_en: Optional[datetime] = None

    class Config:
        from_attributes = True

class EstadoUpdate(BaseModel):
    estado: Optional[str] = None
    estado_nuevo: Optional[str] = None

class VerificarMesaFisica(BaseModel):
    restaurante_id: uuid.UUID  # Usa str si tus IDs de restaurante son UUIDs
    numero_mesa: str     # Ej. "1", "Terraza", etc.


class MesaFisicaCreate(BaseModel):
    nombre: str

class NotificacionPago(BaseModel):
    # 1. ¿Quién está pagando? (UUID si está registrado, None si es invitado)
    usuario_id: Optional[uuid.UUID] = None
    
    # 2. Nombre del que paga (Útil para invitados o para mostrar en el ticket)
    nombre_usuario: Optional[str] = None
    
    # 3. ¿Cuánto de este dinero es para abonar a su propia deuda?
    abono_propio: float = 0.0
    
    # 4. Diccionario con los abonos a otras personas de la mesa
    # Ejemplo: {"UUID-de-Ana": 150.50, "Paco": 50.0}
    aportaciones_vecinos: Optional[Dict[str, float]] = {}


class AceptarTablas(BaseModel):
    creador_id: str
    aceptador_id: str
    monto_transferido: float


class PropuestaTablas(BaseModel):
    creador_id: str
    creador_nombre: str
    participantes: List[str]
    monto_por_persona: float