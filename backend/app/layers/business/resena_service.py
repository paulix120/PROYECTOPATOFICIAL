from datetime import datetime
from fastapi import HTTPException, status
from sqlmodel import Session, select
from app.layers.data.resena_repository import ResenaRepository
from app.layers.data.detalle_resena_repository import DetalleResenaRepository
from app.layers.models.auth import User
from app.layers.models.proveedor import Proveedor
from app.layers.models.resena import Resena, ResenaServicioCreate, ResenaResponder
from app.layers.models.servicio import Servicio


class ResenaService:

    @staticmethod
    def _validar_servicio(db: Session, id_servicio: int):
        servicio = db.get(Servicio, id_servicio)
        if not servicio or not servicio.activo:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El servicio no existe.")
        return servicio

    # ---------------- TURISTA ----------------

    @staticmethod
    def listar_por_servicio(db: Session, id_servicio: int):
        ResenaService._validar_servicio(db, id_servicio)
        filas = ResenaRepository.obtener_por_servicio(db, id_servicio)

        resenas = []
        suma = 0
        for resena, nombre, apellido in filas:
            suma += resena.clf_general
            resenas.append({
                "id_resena": resena.id_resena,
                "usuario": f"{nombre} {apellido[:1]}.",
                "clf_general": resena.clf_general,
                "comentario": resena.comentario,
                "fecha_resena": resena.fecha_resena,
                "respuesta_proveedor": resena.respuesta_proveedor,
                "fecha_respuesta": resena.fecha_respuesta
            })

        total = len(resenas)
        promedio = round(suma / total, 1) if total else 0

        return {"promedio": promedio, "total": total, "resenas": resenas}

    @staticmethod
    def obtener_mi_resena(db: Session, id_servicio: int, usuario: User):
        return ResenaRepository.obtener_por_usuario_servicio(db, usuario.id_usu, id_servicio)

    @staticmethod
    def guardar_resena(db: Session, data: ResenaServicioCreate, usuario: User):
        ResenaService._validar_servicio(db, data.id_servicio)

        if data.clf_general < 1 or data.clf_general > 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La calificación debe estar entre 1 y 5 estrellas.")

        comentario = (data.comentario or "").strip()
        if len(comentario) > 1000:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El comentario no puede superar los 1000 caracteres.")

        existente = ResenaRepository.obtener_por_usuario_servicio(db, usuario.id_usu, data.id_servicio)

        # Si ya reseñó este servicio, se actualiza (la BD solo permite una por usuario)
        if existente:
            existente.clf_general = float(data.clf_general)
            existente.comentario = comentario or None
            existente.estado = "ACTIVA"
            existente.fecha_resena = datetime.utcnow()
            ResenaRepository.guardar(db, existente)
            return {"mensaje": "Tu reseña fue actualizada."}

        nueva = Resena(
            id_usu=usuario.id_usu,
            id_servicio=data.id_servicio,
            clf_general=float(data.clf_general),
            comentario=comentario or None
        )
        ResenaRepository.guardar(db, nueva)
        return {"mensaje": "¡Gracias por tu reseña!"}

    # ---------------- PROVEEDOR ----------------

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
