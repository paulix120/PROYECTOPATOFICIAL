from typing import Optional
from sqlmodel import Session, select
from app.layers.models.auth import User
from app.layers.models.resena import Resena
from app.layers.models.servicio import Servicio


class ResenaRepository:
    @staticmethod
    def obtener_por_id(db: Session, id_resena: int) -> Optional[Resena]:
        return db.get(Resena, id_resena)

    @staticmethod
    def crear(db: Session, resena: Resena) -> Resena:
        db.add(resena)
        db.commit()
        db.refresh(resena)
        return resena

    @staticmethod
    def actualizar(db: Session, resena: Resena) -> Resena:
        db.add(resena)
        db.commit()
        db.refresh(resena)
        return resena

    @staticmethod
    def obtener_por_servicio(db: Session, id_servicio: int):
        return db.exec(
            select(Resena, User)
            .join(User, Resena.id_usu == User.id_usu)
            .where(Resena.id_servicio == id_servicio, Resena.estado == "ACTIVA")
            .order_by(Resena.fecha_resena.desc())
        ).all()

    @staticmethod
    def obtener_por_proveedor(db: Session, id_prov: int):
        return db.exec(
            select(Resena, Servicio, User)
            .join(Servicio, Resena.id_servicio == Servicio.id_servicio)
            .join(User, Resena.id_usu == User.id_usu)
            .where(Servicio.id_prov == id_prov, Resena.estado == "ACTIVA")
            .order_by(Resena.fecha_resena.desc())
        ).all()