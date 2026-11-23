from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlmodel import Session
from app.core.security import get_password_hash, validate_password
from app.layers.data.user_repository import UserRepository
from app.layers.models.auth import User
from app.layers.models.auditoria_rol import (
    AuditoriaRol,
    AdminUsuarioCreate,
    AdminUsuarioUpdate,
    AdminCambioEstado,
    AdminCambioRol,
)


class AdminUsuarioService:

    @staticmethod
    def _validar_rol_existe(db: Session, id_rol: int):
        existe = db.execute(
            text("SELECT 1 FROM rol WHERE id_rol = :id_rol"),
            {"id_rol": id_rol},
        ).first()
        if not existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El rol especificado no existe en el sistema.",
            )

    @staticmethod
    def listar_usuarios(
        db: Session,
        buscar: Optional[str] = None,
        id_rol: Optional[int] = None,
        activo: Optional[bool] = None,
    ):
        return UserRepository.listar_admin(db, buscar=buscar, id_rol=id_rol, activo=activo)

    @staticmethod
    def crear_usuario(db: Session, data: AdminUsuarioCreate) -> User:
        email = str(data.email).strip().lower()
        if UserRepository.obtener_por_email(db, email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ya se encuentra registrado.",
            )

        AdminUsuarioService._validar_rol_existe(db, data.id_rol)
        validate_password(data.password)

        nuevo = User(
            nombre=data.nombre.strip(),
            apellido=data.apellido.strip(),
            email=email,
            password_hash=get_password_hash(data.password),
            id_rol=data.id_rol,
            activo=data.activo,
        )
        return UserRepository.crear(db, nuevo)

    @staticmethod
    def actualizar_usuario(db: Session, id_usu: int, data: AdminUsuarioUpdate) -> User:
        usuario = UserRepository.obtener_por_id(db, id_usu)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        datos = data.model_dump(exclude_unset=True)
        if "email" in datos:
            nuevo_email = str(datos["email"]).strip().lower()
            existente = UserRepository.obtener_por_email(db, nuevo_email)
            if existente and existente.id_usu != id_usu:
                raise HTTPException(400, "Ese correo ya está en uso por otro usuario.")
            usuario.email = nuevo_email

        if "nombre" in datos:
            usuario.nombre = datos["nombre"].strip()
        if "apellido" in datos:
            usuario.apellido = datos["apellido"].strip()

        return UserRepository.actualizar(db, usuario)

    @staticmethod
    def cambiar_estado(
        db: Session, id_usu: int, data: AdminCambioEstado, admin_actual: User
    ) -> User:
        usuario = UserRepository.obtener_por_id(db, id_usu)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        if id_usu == admin_actual.id_usu and not data.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes desactivar tu propia cuenta de administrador.",
            )

        usuario.activo = data.activo
        return UserRepository.actualizar(db, usuario)

    @staticmethod
    def cambiar_rol(
        db: Session, id_usu: int, data: AdminCambioRol, admin_actual: User
    ) -> User:
        usuario = UserRepository.obtener_por_id(db, id_usu)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")

        if id_usu == admin_actual.id_usu and data.id_rol != admin_actual.id_rol:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes revocar tu propio rol de administrador para evitar bloqueos del sistema.",
            )

        AdminUsuarioService._validar_rol_existe(db, data.id_rol)

        if usuario.id_rol == data.id_rol:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario ya tiene asignado ese rol.",
            )

        rol_anterior = usuario.id_rol
        usuario.id_rol = data.id_rol

        auditoria = AuditoriaRol(
            id_admin=admin_actual.id_usu,
            id_usu_afectado=usuario.id_usu,
            rol_anterior=rol_anterior,
            rol_nuevo=data.id_rol,
            motivo=data.motivo,
        )

        UserRepository.actualizar(db, usuario, commit=False)
        UserRepository.registrar_auditoria_rol(db, auditoria, commit=False)

        try:
            db.commit()
            db.refresh(usuario)
        except Exception:
            db.rollback()
            raise HTTPException(500, "Error al actualizar el rol y registrar auditoría.")

        return usuario

    @staticmethod
    def listar_auditoria(db: Session, id_usu: Optional[int] = None):
        return UserRepository.listar_auditoria_roles(db, id_usu=id_usu)