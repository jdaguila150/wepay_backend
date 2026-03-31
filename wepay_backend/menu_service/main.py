from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import uuid
import schemas

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

# --- ENDPOINTS (Las puertas de nuestra API) ---

@app.post("/restaurantes/", response_model=schemas.RestauranteResponse)
def crear_restaurante(restaurante: schemas.RestauranteCreate, db: Session = Depends(get_db)):
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

@app.get("/restaurantes/", response_model=List[schemas.RestauranteResponse])
def obtener_restaurantes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Consultamos la base de datos con un límite para no saturar si hay miles
    restaurantes = db.query(models.Restaurante).offset(skip).limit(limit).all()
    return restaurantes


@app.patch("/categorias/{categoria_id}", response_model=schemas.CategoriaResponse)
def actualizar_categoria(categoria_id: uuid.UUID, categoria_data: schemas.CategoriaUpdate, db: Session = Depends(get_db)):
    db_categoria = db.query(models.CategoriaMenu).filter(models.CategoriaMenu.id == categoria_id).first()
    if not db_categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    datos_actualizar = categoria_data.dict(exclude_unset=True)
    for key, value in datos_actualizar.items():
        setattr(db_categoria, key, value)
    
    db.commit()
    db.refresh(db_categoria)
    return db_categoria

@app.delete("/categorias/{categoria_id}")
def borrar_categoria(categoria_id: uuid.UUID, db: Session = Depends(get_db)):
    db_categoria = db.query(models.CategoriaMenu).filter(models.CategoriaMenu.id == categoria_id).first()
    if not db_categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    db.delete(db_categoria)
    db.commit()
    return {"message": "Categoría eliminada correctamente"}

# --- ENDPOINTS DE CATEGORÍAS ---
@app.post("/categorias/", response_model=schemas.CategoriaResponse)
def crear_categoria(categoria: schemas.CategoriaCreate, db: Session = Depends(get_db)):
    nueva_cat = models.CategoriaMenu(**categoria.dict())
    db.add(nueva_cat)
    db.commit()
    db.refresh(nueva_cat)
    return nueva_cat

@app.get("/restaurantes/{restaurante_id}/menu", response_model=List[schemas.CategoriaResponse])
def obtener_categorias_por_restaurante(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(models.CategoriaMenu).filter(models.CategoriaMenu.restaurante_id == restaurante_id).all()

# --- ENDPOINTS DE ÍTEMS ---
@app.post("/items/", response_model=schemas.ItemResponse)
def crear_item(item: schemas.ItemCreate, db: Session = Depends(get_db)):
    nuevo_item = models.ItemMenu(**item.dict())
    db.add(nuevo_item)
    db.commit()
    db.refresh(nuevo_item)
    return nuevo_item


@app.get("/restaurantes/{restaurante_id}/full-menu", response_model=schemas.MenuCompletoResponse)
def obtener_todo_el_menu(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    restaurante = db.query(models.Restaurante).filter(models.Restaurante.id == restaurante_id).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return restaurante


# --- ACTUALIZAR Y BORRAR RESTAURANTE ---

@app.patch("/restaurantes/{restaurante_id}", response_model=schemas.RestauranteResponse)
def actualizar_restaurante(restaurante_id: uuid.UUID, restaurante_data: schemas.RestauranteUpdate, db: Session = Depends(get_db)):
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

@app.patch("/items/{item_id}", response_model=schemas.ItemResponse)
def actualizar_item(item_id: uuid.UUID, item_data: schemas.ItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(models.ItemMenu).filter(models.ItemMenu.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Platillo no encontrado")
    
    datos = item_data.dict(exclude_unset=True)
    for key, value in datos.items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item


@app.get("/restaurantes/{restaurante_id}/items", response_model=List[schemas.ItemResponse])
def obtener_items_por_restaurante(restaurante_id: uuid.UUID, db: Session = Depends(get_db)):
    # Hacemos un JOIN con CategoriaMenu para poder filtrar los platillos por el ID del restaurante
    items = db.query(models.ItemMenu).join(models.CategoriaMenu).filter(models.CategoriaMenu.restaurante_id == restaurante_id).all()
    return items

@app.delete("/items/{item_id}")
def borrar_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    db_item = db.query(models.ItemMenu).filter(models.ItemMenu.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Platillo no encontrado")
    
    db.delete(db_item)
    db.commit()
    return {"message": "Platillo eliminado correctamente"}