from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.layers.data.pago_proveedor_repository import PagoProveedorRepository
from app.layers.models.auth import User
from app.layers.models.proveedor import Proveedor


class PagoProveedorService:

    @staticmethod
    def obtener_mis_pagos(db: Session, usuario: User):
        proveedor = db.exec(select(Proveedor).where(Proveedor.id_usu == usuario.id_usu)).first()
        if not proveedor:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes un perfil de proveedor registrado."
            )

        filas = PagoProveedorRepository.listar_por_proveedor(db, proveedor.id_prov)

        pagos_lista = []
        total_transferido = 0.0
        total_pendiente = 0.0
        total_retenido = 0.0
        total_comisiones = 0.0

        for pago_prov, pago, plan in filas:
            subtotal = float(pago_prov.monto_subtotal)
            comision = float(pago_prov.comision_plataforma)
            neto = float(pago_prov.monto_neto_proveedor)

            total_comisiones += comision
            if pago_prov.estado_transferencia == "TRANSFERIDO":
                total_transferido += neto
            elif pago_prov.estado_transferencia == "PENDIENTE":
                total_pendiente += neto
            else:
                total_retenido += neto

            pagos_lista.append({
                "id_pago_prov": pago_prov.id_pago_prov,
                "id_pago": pago_prov.id_pago,
                "referencia_transaccion": pago.referencia_transaccion,
                "id_plan_viaje": plan.id_plan_viaje,
                "codigo_plan": f"PLAN-{plan.id_plan_viaje:04d}",
                "nombre_plan": plan.nombre_plan,
                "monto_subtotal": subtotal,
                "comision_plataforma": comision,
                "monto_neto_proveedor": neto,
                "estado_transferencia": pago_prov.estado_transferencia,
                "fecha_pago": pago.fecha_pago.isoformat() if pago.fecha_pago else None,
                "fecha_transferencia": pago_prov.fecha_transferencia.isoformat() if pago_prov.fecha_transferencia else None,
            })

        return {
            "resumen": {
                "total_transferido": total_transferido,
                "total_pendiente": total_pendiente,
                "total_retenido": total_retenido,
                "total_comisiones": total_comisiones,
                "ingresos_totales": total_transferido + total_pendiente,
            },
            "pagos": pagos_lista,
        }