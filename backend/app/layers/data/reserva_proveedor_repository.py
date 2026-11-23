from sqlmodel import Session, select
from app.layers.models.auth import User
from app.layers.models.plan_viaje import DetPlanViaje, PlanViaje
from app.layers.models.servicio import Servicio


class ReservaProveedorRepository:

    @staticmethod
    def listar_reservas_por_proveedor(db: Session, id_prov: int):
        statement = (
            select(DetPlanViaje, Servicio, PlanViaje, User)
            .join(Servicio, DetPlanViaje.id_servicio == Servicio.id_servicio)
            .join(PlanViaje, DetPlanViaje.id_plan_viaje == PlanViaje.id_plan_viaje)
            .join(User, PlanViaje.id_usu == User.id_usu)
            .where(Servicio.id_prov == id_prov)
            .where(PlanViaje.estado.in_(["RESERVADO", "FINALIZADO", "CANCELADO"]))
            .order_by(DetPlanViaje.fecha_servicio.desc())
        )
        return db.exec(statement).all()

    @staticmethod
    def proveedor_participa_en_plan(db: Session, id_prov: int, id_plan_viaje: int) -> bool:
        match = db.exec(
            select(DetPlanViaje)
            .join(Servicio, DetPlanViaje.id_servicio == Servicio.id_servicio)
            .where(DetPlanViaje.id_plan_viaje == id_plan_viaje)
            .where(Servicio.id_prov == id_prov)
        ).first()
<<<<<<< HEAD
        return match is not None
=======
        return match is not None
>>>>>>> origin/parteMiguel
