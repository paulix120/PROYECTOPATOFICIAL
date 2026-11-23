from typing import Optional, List
from sqlmodel import Session, select, or_, col
from app.layers.data.base_repository import BaseRepository
from app.layers.models.auth import User
from app.layers.models.auditoria_rol import AuditoriaRol


class UserRepository:

    # ==========================================
    # CONSULTAS
    # ==========================================

    @staticmethod
    def obtener_por_id(db: Session, usuario_id: int) -> Optional[User]:
        return BaseRepository.obtener_por_id(db, User, usuario_id)

    @staticmethod
    def obtener_por_email(db: Session, email: str) -> Optional[User]:
        return db.exec(select(User).where(User.email == email)).first()

    @staticmethod
    def obtener_por_token(db: Session, token: str) -> Optional[User]:
        return db.exec(select(User).where(User.token_recuperacion == token)).first()

    @staticmethod
    def obtener_usuario_activo(db: Session, usuario_id: int) -> Optional[User]:
        return db.exec(
            select(User).where(User.id_usu == usuario_id, User.activo == True)
        ).first()

    @staticmethod
    def listar_admin(
        db: Session,
        buscar: Optional[str] = None,
        id_rol: Optional[int] = None,
        activo: Optional[bool] = None,
    ) -> List[User]:
        stmt = select(User)
        if buscar:
            patron = f"%{buscar.strip()}%"
            stmt = stmt.where(
                or_(
                    col(User.nombre).ilike(patron),
                    col(User.apellido).ilike(patron),
                    col(User.email).ilike(patron),
                )
            )
        if id_rol is not None:
            stmt = stmt.where(User.id_rol == id_rol)
        if activo is not None:
            stmt = stmt.where(User.activo == activo)
        return list(db.exec(stmt.order_by(User.id_usu.desc())).all())

    @staticmethod
    def listar_auditoria_roles(
        db: Session, id_usu: Optional[int] = None
    ) -> List[AuditoriaRol]:
        stmt = select(AuditoriaRol)
        if id_usu is not None:
            stmt = stmt.where(AuditoriaRol.id_usu_afectado == id_usu)
        return list(db.exec(stmt.order_by(AuditoriaRol.id_auditoria.desc())).all())

    # ==========================================
    # OPERACIONES
    # ==========================================

    @staticmethod
    def crear(db: Session, usuario: User, commit: bool = True):
        return BaseRepository.guardar(db, usuario, commit=commit)

    @staticmethod
    def actualizar(db: Session, usuario: User, commit: bool = True):
        return BaseRepository.actualizar(db, usuario, commit=commit)

    @staticmethod
    def registrar_auditoria_rol(
        db: Session, auditoria: AuditoriaRol, commit: bool = True
    ):
        return BaseRepository.guardar(db, auditoria, commit=commit)