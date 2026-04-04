import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base

class Pago(Base):
    __tablename__ = "pagos_finales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sesion_id = Column(UUID(as_uuid=True), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), nullable=True)
    monto = Column(Float, nullable=False)
    metodo_pago = Column(String, default="tarjeta") # tarjeta, efectivo, transferencia
    completado = Column(Boolean, default=False)
    fecha_pago = Column(DateTime(timezone=True), server_default=func.now())

