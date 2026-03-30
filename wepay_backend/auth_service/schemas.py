from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid

# Lo que pedimos para registrarse
class UsuarioCreate(BaseModel):
    email: EmailStr
    nombre_completo: str
    # Limitamos a 72 para que Bcrypt no explote
    password: str = Field(..., min_length=8, max_length=72)
# Lo que devolvemos al consultar un perfil (sin la contraseña)
class UsuarioOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    nombre_completo: str

    class Config:
        from_attributes = True

# Lo que devolvemos cuando el login es exitoso
class Token(BaseModel):
    access_token: str
    token_type: str