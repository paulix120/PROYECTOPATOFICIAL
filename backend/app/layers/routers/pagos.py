"""
Router de pagos del turista (reemplaza al pagos.py de la compañera).

Qué hace distinto al original:
  - Exige sesión (JWT) y verifica que el plan sea del usuario que paga.
  - El total lo calcula el SERVIDOR con det_plan_viaje.subtotal_calculado
    (antes consultaba servicio.precio_base, columna que NO existe, y caía
    siempre en un total inventado de 350000).
  - Marca el plan como 'RESERVADO' (el ENUM de plan_viaje no tiene 'PAGADO',
    por eso el UPDATE original fallaba en silencio).
  - Inserta el pago en `pagos` y reparte el dinero por proveedor en
    `pago_proveedor` (de ahí lee el panel financiero del proveedor).
  - Todo en una sola transacción: si algo falla, no queda nada a medias.
"""
import uuid
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.security import get_current_user
from app.db.session import get_session
from app.layers.models.auth import User
from app.layers.models.metodo_pago import MetodoPago
from app.layers.models.pago_proveedor import Pago, PagoProveedor
from app.layers.models.plan_viaje import DetPlanViaje, PlanViaje
from app.layers.models.servicio import Servicio

router = APIRouter(prefix="/pagos", tags=["Pagos"])

# Porcentaje que se queda la plataforma de cada pago a proveedor
COMISION_PLATAFORMA = Decimal("0.10")
CENTAVOS = Decimal("0.01")


class ProcesarPagoRequest(BaseModel):
    id_plan_viaje: int
    id_met_pago: int
    titular: Optional[str] = None  # solo informativo; el front lo sigue enviando


def _plan_del_usuario(db: Session, id_plan: int, usuario: User) -> PlanViaje:
    plan = db.get(PlanViaje, id_plan)
    if not plan or plan.id_usu != usuario.id_usu:
        raise HTTPException(status_code=404, detail="El plan de viaje no existe.")
    return plan


def _detalles(db: Session, id_plan: int):
    return db.exec(
        select(DetPlanViaje).where(DetPlanViaje.id_plan_viaje == id_plan)
    ).all()


# ------------------------------------------------------------------
# 1. Métodos de pago
# ------------------------------------------------------------------
@router.get("/metodos")
def listar_metodos_pago(db: Session = Depends(get_session)):
    metodos = db.exec(select(MetodoPago).order_by(MetodoPago.id_met_pago)).all()
    return [
        {"id_met_pago": m.id_met_pago, "nombre": m.nombre, "descripcion": m.descripcion}
        for m in metodos
    ]


# ------------------------------------------------------------------
# 2. Resumen del plan que se va a pagar
# ------------------------------------------------------------------
@router.get("/plan/{id_plan}")
def obtener_resumen_plan(
    id_plan: int,
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user),
):
    plan = _plan_del_usuario(db, id_plan, usuario)
    detalles = _detalles(db, id_plan)

    servicios = []
    total = Decimal("0.00")
    for d in detalles:
        nombre = d.observaciones or d.tipo_item
        if d.id_servicio:
            serv = db.get(Servicio, d.id_servicio)
            if serv:
                nombre = serv.nombre
        subtotal = Decimal(d.subtotal_calculado or 0)
        total += subtotal
        servicios.append({
            "id_det_plan": d.id_det_plan,
            "nombre": nombre,
            "tipo": d.tipo_item,
            "cantidad": d.cantidad,
            "fecha_servicio": d.fecha_servicio.isoformat(),
            "precio": float(subtotal),
        })

    return {
        "id_plan_viaje": plan.id_plan_viaje,
        "nombre_plan": plan.nombre_plan,
        "fecha_inicio": plan.fecha_inicio.isoformat(),
        "fecha_fin": plan.fecha_fin.isoformat(),
        "estado": plan.estado,
        "ya_pagado": plan.estado != "DESEO",
        "total": float(total),
        "servicios": servicios,
    }


# ------------------------------------------------------------------
# 3. Procesar el pago (pasarela simulada)
# ------------------------------------------------------------------
@router.post("/procesar")
def procesar_pago(
    datos: ProcesarPagoRequest,
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user),
):
    plan = _plan_del_usuario(db, datos.id_plan_viaje, usuario)

    if plan.estado != "DESEO":
        raise HTTPException(status_code=400, detail="Este plan ya fue pagado o no está disponible para pago.")

    metodo = db.get(MetodoPago, datos.id_met_pago)
    if not metodo:
        raise HTTPException(status_code=400, detail="Método de pago no válido.")

    detalles = _detalles(db, plan.id_plan_viaje)
    if not detalles:
        raise HTTPException(status_code=400, detail="El plan no tiene servicios para pagar.")

    total = sum((Decimal(d.subtotal_calculado or 0) for d in detalles), Decimal("0.00"))
    if total <= 0:
        raise HTTPException(status_code=400, detail="El total del plan debe ser mayor a cero.")

    referencia = f"PAT-TX-{uuid.uuid4().hex[:8].upper()}"
    ahora = datetime.now()

    try:
        pago = Pago(
            id_plan_viaje=plan.id_plan_viaje,
            id_met_pago=metodo.id_met_pago,
            valor_total=total,
            estado="APROBADO",
            referencia_transaccion=referencia,
            fecha_pago=ahora,
        )
        db.add(pago)
        db.flush()  # obtiene id_pago sin cerrar la transacción

        # Reparto por proveedor (el transporte propio no tiene proveedor)
        por_proveedor = defaultdict(lambda: Decimal("0.00"))
        for d in detalles:
            if not d.id_servicio:
                continue
            serv = db.get(Servicio, d.id_servicio)
            if serv and serv.id_prov:
                por_proveedor[serv.id_prov] += Decimal(d.subtotal_calculado or 0)

        for id_prov, subtotal in por_proveedor.items():
            comision = (subtotal * COMISION_PLATAFORMA).quantize(CENTAVOS, rounding=ROUND_HALF_UP)
            db.add(PagoProveedor(
                id_pago=pago.id_pago,
                id_prov=id_prov,
                monto_subtotal=subtotal,
                comision_plataforma=comision,
                monto_neto_proveedor=subtotal - comision,
                estado_transferencia="PENDIENTE",
            ))

        plan.estado = "RESERVADO"
        db.add(plan)
        db.commit()
        db.refresh(pago)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="No se pudo registrar el pago. Intenta de nuevo.")

    return {
        "mensaje": "¡Pago procesado con éxito!",
        "id_pago": pago.id_pago,
        "referencia_transaccion": referencia,
        "id_plan_viaje": plan.id_plan_viaje,
        "valor_total": float(total),
        "estado": "APROBADO",
        "fecha_pago": ahora.strftime("%Y-%m-%d %H:%M:%S"),
    }
