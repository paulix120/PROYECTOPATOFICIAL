from typing import Optional
from sqlmodel import Field, SQLModel


class MetodoPago(SQLModel, table=True):
    __tablename__ = "metodo_pago"

    id_met_pago: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=80)
    descripcion: Optional[str] = None
