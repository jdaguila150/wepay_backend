from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# URL de conexión apuntando a la cuarta base de datos lógica: 'wepay_pagos'
# Usamos 127.0.0.1 para asegurar la compatibilidad en Windows con Docker
SQLALCHEMY_DATABASE_URL = "postgresql://admin_wetab:superpassword123@127.0.0.1:5432/wepay_pagos"

# 1. Crear el motor de conexión
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 2. Configurar la fábrica de sesiones
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Clase base para los modelos de SQLAlchemy
Base = declarative_base()

# 4. Función de dependencia para obtener la conexión en los endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()