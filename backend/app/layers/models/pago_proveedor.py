from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlmodel import Field, SQLModel


class Pago(SQLModel, table=True):
    __tablename__ = "pagos"

    id_pago: Optional[int] = Field(default=None, primary_key=True)
    id_plan_viaje: int = Field(foreign_key="plan_viaje.id_plan_viaje")
    id_met_pago: int = Field(foreign_key="metodo_pago.id_met_pago")
    valor_total: Decimal = Field(max_digits=10, decimal_places=2)
    estado: str = Field(default="PENDIENTE")
    referencia_transaccion: str = Field(unique=True)
    fecha_pago: Optional[datetime] = None


class PagoProveedor(SQLModel, table=True):
    __tablename__ = "pago_proveedor"

    id_pago_prov: Optional[int] = Field(default=None, primary_key=True)
    id_pago: int = Field(foreign_key="pagos.id_pago")
    id_prov: int = Field(foreign_key="proveedor.id_prov")
    monto_subtotal: Decimal = Field(max_digits=10, decimal_places=2)
    comision_plataforma: Decimal = Field(default=Decimal("0.00"), max_digits=10, decimal_places=2)
    monto_neto_proveedor: Decimal = Field(max_digits=10, decimal_places=2)
    estado_transferencia: str = Field(default="PENDIENTE")
    fecha_transferencia: Optional[datetime] = None