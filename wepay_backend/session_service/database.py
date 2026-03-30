from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# URL de conexión apuntando específicamente a 'wepay_sesiones'
# Usamos 127.0.0.1 para evitar problemas de resolución de DNS en Windows
SQLALCHEMY_DATABASE_URL = "postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_sesiones"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Sesión local para interactuar con la DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para inyectar la DB en los endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()