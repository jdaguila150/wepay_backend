import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    nombre_completo = Column(String, nullable=False)
    # Aquí guardaremos el hash, NUNCA la contraseña real
    hashed_password = Column(String, nullable=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())