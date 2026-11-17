from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.layers.data.proveedor_repository import ProveedorRepository
from app.layers.models.auth import User
from app.layers.models.proveedor import ProveedorTpServicio
from app.layers.models.solicitud_proveedor import SolicitudProveedor
from app.layers.models.tp_servicio import TpServicio

class ProveedorService:
    @staticmethod
    def obtener_todos(db: Session):
        return ProveedorRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db: Session, id_prov: int):
        proveedor = ProveedorRepository.obtener_por_id(db, id_prov)
        if not proveedor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")
        return proveedor

    @staticmethod
    def obtener_mi_perfil(db: Session, usuario: User):
        proveedor = ProveedorRepository.obtener_por_usuario(db, usuario.id_usu)
        if not proveedor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de proveedor no encontrado.")

        solicitud = db.get(SolicitudProveedor, proveedor.id_sp)
        permisos = db.exec(
            select(TpServicio)
            .join(ProveedorTpServicio, ProveedorTpServicio.id_tp_serv == TpServicio.id_tp_serv)
            .where(ProveedorTpServicio.id_prov == proveedor.id_prov)
        ).all()

        return {
            "id_prov": proveedor.id_prov,
            "id_usu": usuario.id_usu,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "email": usuario.email,
            "estado": proveedor.estado,
            "fecha_registro": proveedor.fecha_registro.isoformat() if proveedor.fecha_registro else None,
            "nit": solicitud.nit if solicitud else "",
            "razon_social": solicitud.razon_social if solicitud else f"{usuario.nombre} {usuario.apellido}",
            "telefono_contacto": solicitud.telefono_contacto if solicitud else "",
            "banco": solicitud.banco if solicitud else "",
            "cuenta_bancaria": solicitud.cuenta_bancaria if solicitud else "",
            "tipos_servicio_autorizados": [
                {"id_tp_serv": p.id_tp_serv, "nombre": p.nombre} for p in permisos
            ],
        }