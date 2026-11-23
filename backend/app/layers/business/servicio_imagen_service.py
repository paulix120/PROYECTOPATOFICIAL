import os
import shutil
import uuid
from fastapi import UploadFile, HTTPException
from sqlmodel import Session
from app.layers.data.servicio_imagen_repository import ServicioImagenRepository
from app.layers.data.servicio_repository import ServicioRepository
from app.layers.models.servicio_imagen import ServicioImagen
from app.layers.models.auth import User
from app.layers.business.servicio_service import ServicioService

UPLOAD_DIR = "app/static/servicios"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_IMAGENES_POR_SERVICIO = 10
MAX_TAMANO_BYTES = 5 * 1024 * 1024  # 5 MB
EXTENSIONES_PERMITIDAS = {"jpg", "jpeg", "png", "webp"}


class ServicioImagenService:
    @staticmethod
    def _validar_permiso_servicio(db: Session, servicio, usuario_actual: User):
        if usuario_actual.id_rol == 2:
            return
        prov = ServicioService.validar_permisos_proveedor(db, usuario_actual.id_usu, servicio.id_tp_serv)
        if servicio.id_prov != prov.id_prov:
            raise HTTPException(status_code=403, detail="Este servicio no te pertenece.")

    @staticmethod
    def subir_imagen(db: Session, id_servicio: int, archivo: UploadFile, es_principal: bool, usuario_actual: User):
        servicio = ServicioRepository.obtener_servicio_por_id(db, id_servicio)
        if not servicio:
            raise HTTPException(status_code=404, detail="Este servicio no existe.")

        ServicioImagenService._validar_permiso_servicio(db, servicio, usuario_actual)

        imagenes_actuales = ServicioImagenRepository.obtener_por_servicio(db, id_servicio)
        if len(imagenes_actuales) >= MAX_IMAGENES_POR_SERVICIO:
            raise HTTPException(
                status_code=400,
                detail="Has alcanzado el límite máximo de 10 fotos por destino.",
            )

        if not archivo.filename or "." not in archivo.filename:
            raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")

        ext = archivo.filename.rsplit(".", 1)[-1].lower()
        if ext not in EXTENSIONES_PERMITIDAS:
            raise HTTPException(
                status_code=400,
                detail="Formato no válido. Solo se admiten imágenes JPG, PNG o WEBP de hasta 5MB.",
            )

        # Validar peso máximo (< 5 MB)
        archivo.file.seek(0, os.SEEK_END)
        tamano = archivo.file.tell()
        archivo.file.seek(0)
        if tamano > MAX_TAMANO_BYTES:
            raise HTTPException(
                status_code=400,
                detail="Formato no válido. Solo se admiten imágenes JPG, PNG o WEBP de hasta 5MB.",
            )

        nombre_seguro = f"srv_{id_servicio}_{uuid.uuid4().hex[:8]}.{ext}"
        ruta_fisica = os.path.join(UPLOAD_DIR, nombre_seguro)
        with open(ruta_fisica, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        # Si es la primera imagen del servicio, marcarla como principal automáticamente
        if not imagenes_actuales:
            es_principal = True

        nueva_img = ServicioImagen(
            id_servicio=id_servicio,
            ruta_url=f"/static/servicios/{nombre_seguro}",
            tipo_arch=ext,
            es_principal=es_principal,
        )
        return ServicioImagenRepository.crear(db, nueva_img)

    @staticmethod
    def eliminar_imagen(db: Session, id_img: int, usuario_actual: User):
        imagen = ServicioImagenRepository.obtener_por_id(db, id_img)
        if not imagen:
            raise HTTPException(status_code=404, detail="Imagen no encontrada.")

        servicio = ServicioRepository.obtener_servicio_por_id(db, imagen.id_servicio)
        if not servicio:
            raise HTTPException(status_code=404, detail="Servicio asociado no encontrado.")

        ServicioImagenService._validar_permiso_servicio(db, servicio, usuario_actual)

        imagenes_servicio = ServicioImagenRepository.obtener_por_servicio(db, imagen.id_servicio)
        if len(imagenes_servicio) <= 1:
            raise HTTPException(
                status_code=400,
                detail="El destino debe conservar al menos una imagen de portada.",
            )

        ServicioImagenRepository.eliminar(db, imagen)

        # Borrar archivo físico si existe en disco
        ruta_fisica = os.path.join("app", imagen.ruta_url.lstrip("/"))
        if os.path.exists(ruta_fisica):
            os.remove(ruta_fisica)

        return {"mensaje": "Imagen eliminada exitosamente."}