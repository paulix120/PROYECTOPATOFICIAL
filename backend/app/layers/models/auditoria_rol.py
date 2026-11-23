from datetime import datetime, timezone
from typing import Optional
from pydantic import EmailStr
from sqlmodel import SQLModel, Field


class AuditoriaRol(SQLModel, table=True):
    __tablename__ = "auditoria_rol"

    id_auditoria: Optional[int] = Field(default=None, primary_key=True)
    id_admin: int = Field(foreign_key="usuario.id_usu")
    id_usu_afectado: int = Field(foreign_key="usuario.id_usu")
    rol_anterior: int
    rol_nuevo: int
    motivo: Optional[str] = Field(default=None, max_length=255)
    fecha_cambio: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


class AdminUsuarioResponse(SQLModel):
    id_usu: int
    nombre: str
    apellido: str
    email: str
    id_rol: int
    activo: bool


class AdminUsuarioCreate(SQLModel):
    nombre: str = Field(min_length=2, max_length=100)
    apellido: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str
    id_rol: int = 1
    activo: bool = True


class AdminUsuarioUpdate(SQLModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=100)
    apellido: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None


class AdminCambioEstado(SQLModel):
    activo: bool


class AdminCambioRol(SQLModel):
    id_rol: int
    motivo: Optional[str] = Field(default=None, max_length=255)