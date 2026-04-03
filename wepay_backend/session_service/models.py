import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer
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
    usuario_id = Column(UUID(as_uuid=True), nullable=False)
    item_menu_id = Column(UUID(as_uuid=True), nullable=False)
    cantidad = Column(Integer, default=1)
    pagado = Column(Boolean, default=False)


class MesaFisica(Base):
    __tablename__ = "mesas_fisicas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id = Column(UUID(as_uuid=True), nullable=False) # Para saber a qué restaurante pertenece
    nombre = Column(String, nullable=False) # Ej. "1", "5", "Terraza"