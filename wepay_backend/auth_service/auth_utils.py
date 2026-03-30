from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt

# Configuración de seguridad
SECRET_KEY = "UNA_LLAVE_MUY_SECRETA_Y_LARGA" # En producción esto va en una variable de entorno
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def obtener_hash_password(password: str):
    # Forzamos que sea un string, lo truncamos a 72 y luego hasheamos
    # Esto evita el ValueError en Windows
    pwd_para_hashear = password[:72]
    return pwd_context.hash(pwd_para_hashear)

def verificar_password(plain_password: str, hashed_password: str):
    # Hacemos lo mismo al verificar para que coincida
    pwd_para_verificar = plain_password[:72]
    return pwd_context.verify(pwd_para_verificar, hashed_password)

def crear_token_acceso(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt