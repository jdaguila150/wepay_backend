from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import uuid

# Importamos lo que creamos en los otros archivos
from database import engine, get_db
import models

# 1. Crear las tablas en la base de datos automáticamente
models.Base.metadata.create_all(bind=engine)

# 2. Inicializar la aplicación FastAPI
app = FastAPI(
    title="WePay - API de Menú y Restaurantes",
    description="Microservicio para gestionar el catálogo de productos",
    version="1.0.0"
)

# --- ESQUEMAS PYDANTIC (Validación de datos de entrada/salida) ---

# Esquema para cuando el usuario QUIERE CREAR un restaurante
class RestauranteCreate(BaseModel):
    nombre: str
    direccion: str
    telefono: str

# Esquema para cuando nosotros le RESPONDEMOS al usuario
class RestauranteResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    direccion: str
    telefono: str

    # Esto le dice a Pydantic que lea los datos de un modelo SQLAlchemy
    class Config:
        orm_mode = True 
        # Nota: Si usas Pydantic v2 (lo más probable), cambia 'orm_mode = True' por 'from_attributes = True'

# --- ENDPOINTS (Las puertas de nuestra API) ---

@app.post("/restaurantes/", response_model=RestauranteResponse)
def crear_restaurante(restaurante: RestauranteCreate, db: Session = Depends(get_db)):
    # Creamos la instancia del modelo SQLAlchemy
    nuevo_restaurante = models.Restaurante(
        nombre=restaurante.nombre,
        direccion=restaurante.direccion,
        telefono=restaurante.telefono
    )
    # Lo agregamos a la sesión y guardamos en la base de datos
    db.add(nuevo_restaurante)
    db.commit()
    db.refresh(nuevo_restaurante) # Refrescamos para obtener el ID generado y la fecha
    
    return nuevo_restaurante

@app.get("/restaurantes/", response_model=List[RestauranteResponse])
def obtener_restaurantes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Consultamos la base de datos con un límite para no saturar si hay miles
    restaurantes = db.query(models.Restaurante).offset(skip).limit(limit).all()
    return restaurantes

# --- ESQUEMAS PARA CATEGORÍAS ---
class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    restaurante_id: uuid.UUID

class CategoriaResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    descripcion: str | None = None
    restaurante_id: uuid.UUID

    class Config:
        from_attributes = True

# --- ESQUEMAS PARA ÍTEMS (PLATILLOS) ---
class ItemCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    precio: float
    categoria_id: uuid.UUID

class ItemResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    precio: float
    disponible: bool
    categoria_id: uuid.UUID

    class Config:
        from_attributes = True

# --- ENDPOINTS DE CATEGORÍAS ---
@app.post("/categorias/", response_model=CategoriaResponse)
def crear_categoria(categoria: CategoriaCreate, db: Session = Depends(get_db)):
    nueva_cat = models.CategoriaMenu(**categoria.dict())
    db.add(nueva_cat)
    db.commit()
    db.refresh(nueva_cat)
    return nueva_cat

@app.get("/restaurantes/{restaurante_id}/menu", response_model=List[CategoriaResponse])
def obtener_categorias_por_restaurante(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(models.CategoriaMenu).filter(models.CategoriaMenu.restaurante_id == restaurante_id).all()

# --- ENDPOINTS DE ÍTEMS ---
@app.post("/items/", response_model=ItemResponse)
def crear_item(item: ItemCreate, db: Session = Depends(get_db)):
    nuevo_item = models.ItemMenu(**item.dict())
    db.add(nuevo_item)
    db.commit()
    db.refresh(nuevo_item)
    return nuevo_item

class MenuCompletoResponse(RestauranteResponse):
    categorias: List[CategoriaResponse] = []

    class Config:
        from_attributes = True


@app.get("/restaurantes/{restaurante_id}/full-menu", response_model=MenuCompletoResponse)
def obtener_todo_el_menu(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    restaurante = db.query(models.Restaurante).filter(models.Restaurante.id == restaurante_id).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return restaurante


# Esquema para actualizar un restaurante (todos los campos son opcionales)
class RestauranteUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None

# Esquema para actualizar un ítem (ej: corregir el precio)
class ItemUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    disponible: Optional[bool] = None


# --- ACTUALIZAR Y BORRAR RESTAURANTE ---

@app.patch("/restaurantes/{restaurante_id}", response_model=RestauranteResponse)
def actualizar_restaurante(restaurante_id: uuid.UUID, restaurante_data: RestauranteUpdate, db: Session = Depends(get_db)):
    db_restaurante = db.query(models.Restaurante).filter(models.Restaurante.id == restaurante_id).first()
    if not db_restaurante:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    
    # Solo actualizamos los campos que el usuario envió
    datos_actualizar = restaurante_data.dict(exclude_unset=True)
    for key, value in datos_actualizar.items():
        setattr(db_restaurante, key, value)
    
    db.commit()
    db.refresh(db_restaurante)
    return db_restaurante

@app.delete("/restaurantes/{restaurante_id}")
def borrar_restaurante(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    db_restaurante = db.query(models.Restaurante).filter(models.Restaurante.id == restaurante_id).first()
    if not db_restaurante:
        raise HTTPException(status_code=404, detail="No se encontró para borrar")
    
    db.delete(db_restaurante)
    db.commit()
    return {"message": "Restaurante y todo su menú eliminados correctamente"}

# --- ACTUALIZAR PRECIO O DISPONIBILIDAD DE ÍTEM ---

@app.patch("/items/{item_id}", response_model=ItemResponse)
def actualizar_item(item_id: uuid.UUID, item_data: ItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(models.ItemMenu).filter(models.ItemMenu.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Platillo no encontrado")
    
    datos = item_data.dict(exclude_unset=True)
    for key, value in datos.items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item