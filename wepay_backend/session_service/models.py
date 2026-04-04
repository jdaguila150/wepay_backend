import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class SesionMesa(Base):
    __tablename__ = "sesiones_mesa"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id = Column(UUID(as_uuid=True), nullable=False)
    numero_mesa = Column(String, nullable=False)
    activa = Column(Boolean, default=True)
    creada_en = Column(DateTime(timezone=True), server_default=func.now())

class OrdenItem(Base):
    __tablename__ = "ordenes_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sesion_id = Column(UUID(as_uuid=True), ForeignKey("sesiones_mesa.id"))
    
    # 1. Ahora es nullable=True para que acepte invitados (sin cuenta)
    usuario_id = Column(UUID(as_uuid=True), nullable=True) 
    
    item_menu_id = Column(UUID(as_uuid=True), nullable=False)
    cantidad = Column(Integer, default=1)
    pagado = Column(Boolean, default=False)
    
    # 2. Nueva columna para guardar "Paco", "Ana", etc.
    nombre_usuario = Column(String, nullable=True)


class MesaFisica(Base):
    __tablename__ = "mesas_fisicas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id = Column(UUID(as_uuid=True), nullable=False) # Para saber a qué restaurante pertenece
    nombre = Column(String, nullable=False) # Ej. "1", "5", "Terraza"

class AbonoSesion(Base):
    __tablename__ = "abonos_sesion"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sesion_id = Column(UUID(as_uuid=True), ForeignKey("sesiones_mesa.id"))

    # Usamos un "identificador" genérico para no complicarnos. 
    # Aquí guardaremos el UUID del usuario o el nombre "Ana"
    identificador = Column(String, nullable=False) 
    monto = Column(Float, nullable=False, default=0.0)