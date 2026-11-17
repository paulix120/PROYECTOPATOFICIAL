from datetime import datetime
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.layers.data.resena_repository import ResenaRepository
from app.layers.data.detalle_resena_repository import DetalleResenaRepository
from app.layers.models.auth import User
from app.layers.models.proveedor import Proveedor
from app.layers.models.resena import Resena, ResenaCreate, ResenaResponder
from app.layers.models.servicio import Servicio


class ResenaService:

    @staticmethod
    def _validar_calificacion(clf: float):
        if clf < 1.0 or clf > 5.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La calificación general debe estar entre 1.0 y 5.0."
            )

    @classmethod
    def crear_resena(cls, db: Session, data: ResenaCreate, usuario_actual: User):
        cls._validar_calificacion(data.clf_general)

        usuario = db.get(User, data.id_usu or usuario_actual.id_usu)
        if not usuario:
            raise HTTPException(status_code=404, detail="El usuario no existe.")

        servicio = db.get(Servicio, data.id_servicio)
        if not servicio or not servicio.activo:
            raise HTTPException(status_code=404, detail="El servicio no existe.")

        nueva = Resena(
            id_usu=usuario.id_usu,
            id_servicio=data.id_servicio,
            clf_general=round(float(data.clf_general), 1),
            comentario=data.comentario.strip() if data.comentario else None,
        )
        return ResenaRepository.crear(db, nueva)

    @staticmethod
    def listar_por_servicio(db: Session, id_servicio: int):
        filas = ResenaRepository.obtener_por_servicio(db, id_servicio)
        resultado = []
        for resena, autor in filas:
            detalles = DetalleResenaRepository.obtener_por_resena(db, resena.id_resena)
            r_dict = resena.model_dump()
            r_dict["cliente_nombre"] = f"{autor.nombre} {autor.apellido}".strip()
            r_dict["detalles"] = [d.model_dump() for d in detalles]
            resultado.append(r_dict)
        return resultado

    @staticmethod
    def listar_para_proveedor(db: Session, usuario: User):
        proveedor = db.exec(select(Proveedor).where(Proveedor.id_usu == usuario.id_usu)).first()
        if not proveedor:
            raise HTTPException(status_code=403, detail="No eres un proveedor registrado.")

        filas = ResenaRepository.obtener_por_proveedor(db, proveedor.id_prov)
        resultado = []
        for resena, servicio, autor in filas:
            detalles = DetalleResenaRepository.obtener_por_resena(db, resena.id_resena)
            resultado.append({
                "id_resena": resena.id_resena,
                "id_usu": resena.id_usu,
                "id_servicio": resena.id_servicio,
                "servicio_nombre": servicio.nombre,
                "cliente_nombre": f"{autor.nombre} {autor.apellido}".strip(),
                "clf_general": float(resena.clf_general),
                "comentario": resena.comentario,
                "fecha_resena": resena.fecha_resena.isoformat() if resena.fecha_resena else None,
                "estado": resena.estado,
                "respuesta_proveedor": resena.respuesta_proveedor,
                "fecha_respuesta": resena.fecha_respuesta.isoformat() if resena.fecha_respuesta else None,
                "criterios": [d.model_dump() for d in detalles],
            })
        return resultado

    @staticmethod
    def responder_resena(db: Session, id_resena: int, data: ResenaResponder, usuario: User):
        respuesta = (data.respuesta_proveedor or "").strip()
        if not respuesta:
            raise HTTPException(status_code=400, detail="La respuesta no puede estar vacía.")

        proveedor = db.exec(select(Proveedor).where(Proveedor.id_usu == usuario.id_usu)).first()
        if not proveedor:
            raise HTTPException(status_code=403, detail="No eres un proveedor registrado.")

        resena = ResenaRepository.obtener_por_id(db, id_resena)
        if not resena:
            raise HTTPException(status_code=404, detail="Reseña no encontrada.")

        servicio = db.get(Servicio, resena.id_servicio)
        if not servicio or servicio.id_prov != proveedor.id_prov:
            raise HTTPException(status_code=403, detail="No puedes responder reseñas de otros proveedores.")

        resena.respuesta_proveedor = respuesta
        resena.fecha_respuesta = datetime.utcnow()
        ResenaRepository.actualizar(db, resena)
        return {"mensaje": "Respuesta publicada exitosamente.", "respuesta_proveedor": resena.respuesta_proveedor}