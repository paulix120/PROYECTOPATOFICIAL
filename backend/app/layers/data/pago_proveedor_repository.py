from sqlmodel import Session, select
from app.layers.models.pago_proveedor import Pago, PagoProveedor
from app.layers.models.plan_viaje import PlanViaje


class PagoProveedorRepository:

    @staticmethod
    def listar_por_proveedor(db: Session, id_prov: int):
        statement = (
            select(PagoProveedor, Pago, PlanViaje)
            .join(Pago, PagoProveedor.id_pago == Pago.id_pago)
            .join(PlanViaje, Pago.id_plan_viaje == PlanViaje.id_plan_viaje)
            .where(PagoProveedor.id_prov == id_prov)
            .order_by(PagoProveedor.id_pago_prov.desc())
        )
        return db.exec(statement).all()