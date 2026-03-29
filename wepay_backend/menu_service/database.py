from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de conexión a nuestra base de datos lógica 'synctab_menu'
# Formato: postgresql://usuario:contraseña@host:puerto/nombre_bd
SQLALCHEMY_DATABASE_URL = "postgresql://admin_wepay:superpassword123@localhost:5432/wepay_menu"

# El 'engine' es el motor que maneja la comunicación real con PostgreSQL
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Creamos una fábrica de sesiones de base de datos. 
# Cada vez que un usuario haga una petición a nuestra API, abriremos una de estas sesiones.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 'Base' es la clase padre de la que heredarán todos nuestros modelos (tablas).
# Esto le dice a SQLAlchemy cómo mapear nuestras clases de Python a tablas de SQL.
Base = declarative_base()

# Dependencia para inyectar la sesión en nuestros endpoints de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()