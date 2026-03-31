from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import engine, get_db
import models, schemas, auth_utils
from typing import cast

# Crear tablas en wepay_usuarios
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WePay - Auth & Identity")

@app.post("/registro", response_model=schemas.UsuarioOut)
def registrar_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    # 1. Verificar si el email ya existe
    existe = db.query(models.Usuario).filter(models.Usuario.email == usuario.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # 2. Hashear la contraseña
    hashed = auth_utils.obtener_hash_password(usuario.password)
    
    # 3. Guardar
    nuevo_usuario = models.Usuario(
        email=usuario.email,
        nombre_completo=usuario.nombre_completo,
        hashed_password=hashed
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Buscar al usuario
    usuario = db.query(models.Usuario).filter(models.Usuario.email == form_data.username).first()
    
    # 2. Verificar contraseña
    if not usuario or not auth_utils.verificar_password(form_data.password, cast(str, usuario.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Generar el Token JWT de WePay
    access_token = auth_utils.crear_token_acceso(data={"sub": usuario.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": usuario.id}