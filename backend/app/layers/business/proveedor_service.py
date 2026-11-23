from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.layers.data.proveedor_repository import ProveedorRepository
from app.layers.data.admin_gestion_repository import AdminGestionRepository
from app.layers.models.auth import User
from app.layers.models.proveedor import ProveedorTpServicio
from app.layers.models.solicitud_proveedor import SolicitudProveedor
from app.layers.models.tp_servicio import TpServicio

ESTADOS_PROVEEDOR_VALIDOS = {"ACTIVO", "INACTIVO", "SUSPENDIDO"}

class ProveedorService:
    @staticmethod
    def obtener_todos(db: Session, estado: Optional[str] = None):
        if estado:
            return AdminGestionRepository.listar_proveedores(db, estado=estado)
        return ProveedorRepository.obtener_todos(db)

    @staticmethod
    def obtener_por_id(db: Session, id_prov: int):
        proveedor = ProveedorRepository.obtener_por_id(db, id_prov)
        if not proveedor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")
        return proveedor

    @staticmethod
    def cambiar_estado(db: Session, id_prov: int, nuevo_estado: str):
        estado_norm = nuevo_estado.strip().upper()
        if estado_norm not in ESTADOS_PROVEEDOR_VALIDOS:
            raise HTTPException(status_code=400, detail="Estado inválido. Usa: ACTIVO, INACTIVO o SUSPENDIDO.")
        prov = AdminGestionRepository.obtener_proveedor_por_id(db, id_prov)
        if not prov:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado.")
        prov.estado = estado_norm
        return AdminGestionRepository.actualizar_proveedor(db, prov)

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
            "tipos_servicio_autorizados": [{"id_tp_serv": p.id_tp_serv, "nombre": p.nombre} for p in permisos],
        }