from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Apuntamos a la DB lógica de usuarios
SQLALCHEMY_DATABASE_URL = "postgresql://admin_wepay:superpassword123@127.0.0.1:5432/wepay_usuarios"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()