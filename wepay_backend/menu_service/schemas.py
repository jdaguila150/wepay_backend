from pydantic import BaseModel
from typing import Optional, List
import uuid

# ==========================================
# 1. SCHEMAS PARA RESTAURANTES
# ==========================================

class RestauranteBase(BaseModel):
    nombre: str
    direccion: str
    telefono: str

# Lo que pedimos cuando el usuario CREA un restaurante
class RestauranteCreate(RestauranteBase):
    pass

# Lo que pedimos cuando el usuario ACTUALIZA un restaurante (todo es opcional)
class RestauranteUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

# Lo que DEVOLVEMOS al frontend (incluye el ID generado por la BD)
class RestauranteResponse(RestauranteBase):
    id: uuid.UUID

    class Config:
        from_attributes = True # Permite leer objetos de SQLAlchemy


# ==========================================
# 2. SCHEMAS PARA CATEGORÍAS
# ==========================================

class CategoriaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class CategoriaCreate(CategoriaBase):
    restaurante_id: uuid.UUID

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None

class CategoriaResponse(CategoriaBase):
    id: uuid.UUID
    restaurante_id: uuid.UUID

    class Config:
        from_attributes = True


# ==========================================
# 3. SCHEMAS PARA ÍTEMS (PLATILLOS)
# ==========================================

class ItemBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    disponible: bool = True

class ItemCreate(ItemBase):
    categoria_id: uuid.UUID

class ItemUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    disponible: Optional[bool] = None

class ItemResponse(ItemBase):
    id: uuid.UUID
    categoria_id: uuid.UUID

    class Config:
        from_attributes = True


# ==========================================
# 4. SCHEMAS COMPUESTOS (Para vistas complejas)
# ==========================================

# Si algún día quieres devolver la categoría con todos sus platillos adentro
class CategoriaConItems(CategoriaResponse):
    items: List[ItemResponse] = []

# Si quieres devolver el restaurante con todo su menú estructurado de golpe
class MenuCompletoResponse(RestauranteResponse):
    categorias: List[CategoriaConItems] = []