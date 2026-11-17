from fastapi import HTTPException, status
from sqlmodel import Session, SQLModel, select
from app.layers.data.reserva_proveedor_repository import ReservaProveedorRepository
from app.layers.models.auth import User
from app.layers.models.plan_viaje import PlanViaje
from app.layers.models.proveedor import Proveedor


class EstadoReservaUpdate(SQLModel):
    estado: str  # 'RESERVADO' | 'FINALIZADO' | 'CANCELADO'


class ReservaProveedorService:

    @staticmethod
    def listar_mis_reservas(db: Session, usuario: User):
        proveedor = db.exec(select(Proveedor).where(Proveedor.id_usu == usuario.id_usu)).first()
        if not proveedor:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes un perfil de proveedor registrado."
            )

        filas = ReservaProveedorRepository.listar_reservas_por_proveedor(db, proveedor.id_prov)
        resultado = []

        for det, servicio, plan, cliente in filas:
            resultado.append({
                "id_det_plan": det.id_det_plan,
                "id_plan_viaje": plan.id_plan_viaje,
                "codigo_plan": f"PLAN-{plan.id_plan_viaje:04d}",
                "nombre_plan": plan.nombre_plan,
                "estado": plan.estado,
                "id_servicio": servicio.id_servicio,
                "servicio_nombre": servicio.nombre,
                "tipo_item": det.tipo_item,
                "cantidad": det.cantidad,
                "fecha_servicio": det.fecha_servicio.isoformat(),
                "subtotal_calculado": float(det.subtotal_calculado),
                "tiempo_estimado_min": det.tiempo_estimado_min,
                "observaciones": det.observaciones,
                "cliente_nombre": f"{cliente.nombre} {cliente.apellido}".strip(),
                "cliente_email": cliente.email,
            })

        return resultado

    @staticmethod
    def actualizar_estado_reserva(db: Session, id_plan_viaje: int, data: EstadoReservaUpdate, usuario: User):
        estados_validos = {"RESERVADO", "FINALIZADO", "CANCELADO"}
        nuevo_estado = data.estado.strip().upper()
        if nuevo_estado not in estados_validos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El estado debe ser RESERVADO, FINALIZADO o CANCELADO."
            )

        proveedor = db.exec(select(Proveedor).where(Proveedor.id_usu == usuario.id_usu)).first()
        if not proveedor:
            raise HTTPException(status_code=403, detail="No eres un proveedor válido.")

        plan = db.get(PlanViaje, id_plan_viaje)
        if not plan:
            raise HTTPException(status_code=404, detail="Reserva / plan de viaje no encontrado.")

        if not ReservaProveedorRepository.proveedor_participa_en_plan(db, proveedor.id_prov, id_plan_viaje):
            raise HTTPException(status_code=403, detail="No tienes servicios asociados a esta reserva.")

        plan.estado = nuevo_estado
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return {"mensaje": f"Reserva actualizada a estado {nuevo_estado}.", "estado": plan.estado}