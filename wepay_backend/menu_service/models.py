import uuid
from sqlalchemy import Column, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base

class Restaurante(Base):
    __tablename__ = "restaurantes"

    # Usamos UUID nativo de PostgreSQL para mayor seguridad y evitar colisiones
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String, index=True, nullable=False)
    direccion = Column(String)
    telefono = Column(String)
    # Guarda automáticamente la fecha y hora de creación
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    # Relación para que SQLAlchemy sepa cómo navegar hacia las categorías
    categorias = relationship("CategoriaMenu", back_populates="restaurante", cascade="all, delete-orphan")


class CategoriaMenu(Base):
    __tablename__ = "categorias_menu"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id = Column(UUID(as_uuid=True), ForeignKey("restaurantes.id"), nullable=False)
    nombre = Column(String, index=True, nullable=False)
    descripcion = Column(String, nullable=True)

    # Relaciones bidireccionales
    restaurante = relationship("Restaurante", back_populates="categorias")
    items = relationship("ItemMenu", back_populates="categoria", cascade="all, delete-orphan")


class ItemMenu(Base):
    __tablename__ = "items_menu"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id = Column(UUID(as_uuid=True), ForeignKey("categorias_menu.id"), nullable=False)
    nombre = Column(String, index=True, nullable=False)
    descripcion = Column(String)
    # Es vital usar Numeric (Decimal) para dinero, nunca Float por problemas de precisión
    precio = Column(Numeric(10, 2), nullable=False) 
    disponible = Column(Boolean, default=True)

    categoria = relationship("CategoriaMenu", back_populates="items")