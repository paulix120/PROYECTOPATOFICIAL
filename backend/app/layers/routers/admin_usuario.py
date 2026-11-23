from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.core.security import get_current_user, require_role
from app.db.session import get_session
from app.layers.business.admin_usuario_service import AdminUsuarioService
from app.layers.models.auditoria_rol import (
    AuditoriaRol,
    AdminUsuarioResponse,
    AdminUsuarioCreate,
    AdminUsuarioUpdate,
    AdminCambioEstado,
    AdminCambioRol,
)
from app.layers.models.auth import User

router = APIRouter(
    prefix="/admin/usuarios",
    tags=["Administrador - Usuarios y Roles"],
    dependencies=[Depends(require_role(2))],
)


@router.get("/", response_model=List[AdminUsuarioResponse])
def listar_usuarios(
    buscar: Optional[str] = Query(default=None),
    id_rol: Optional[int] = Query(default=None),
    activo: Optional[bool] = Query(default=None),
    db: Session = Depends(get_session),
):
    return AdminUsuarioService.listar_usuarios(db, buscar=buscar, id_rol=id_rol, activo=activo)


@router.get("/auditoria-roles", response_model=List[AuditoriaRol])
def listar_auditoria_roles(
    id_usu: Optional[int] = Query(default=None),
    db: Session = Depends(get_session),
):
    return AdminUsuarioService.listar_auditoria(db, id_usu=id_usu)


@router.post("/", response_model=AdminUsuarioResponse, status_code=201)
def crear_usuario(
    data: AdminUsuarioCreate,
    db: Session = Depends(get_session),
):
    return AdminUsuarioService.crear_usuario(db, data)


@router.put("/{id_usu}", response_model=AdminUsuarioResponse)
def actualizar_usuario(
    id_usu: int,
    data: AdminUsuarioUpdate,
    db: Session = Depends(get_session),
):
    return AdminUsuarioService.actualizar_usuario(db, id_usu, data)


@router.put("/{id_usu}/estado", response_model=AdminUsuarioResponse)
def cambiar_estado_usuario(
    id_usu: int,
    data: AdminCambioEstado,
    db: Session = Depends(get_session),
    admin_actual: User = Depends(get_current_user),
):
    return AdminUsuarioService.cambiar_estado(db, id_usu, data, admin_actual)


@router.put("/{id_usu}/rol", response_model=AdminUsuarioResponse)
def cambiar_rol_usuario(
    id_usu: int,
    data: AdminCambioRol,
    db: Session = Depends(get_session),
    admin_actual: User = Depends(get_current_user),
):
    return AdminUsuarioService.cambiar_rol(db, id_usu, data, admin_actual)