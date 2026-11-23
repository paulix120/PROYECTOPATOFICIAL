import os
import shutil
from typing import Optional
from fastapi import UploadFile, HTTPException
from sqlmodel import Session
from app.layers.models.documento import Documento
from app.layers.data.documento_repository import DocumentoRepository
from app.layers.data.admin_gestion_repository import AdminGestionRepository
from app.layers.models.auth import User

UPLOAD_DIR = "app/static/documentos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ESTADOS_DOCUMENTO_VALIDOS = {"PENDIENTE", "APROBADO", "RECHAZADO"}


class DocumentoService:
    @staticmethod
    def subir_documento(
        db: Session, usuario_actual: User, tipo_doc: str, archivo: UploadFile, id_sp: int = None
    ):
        if not archivo.filename.lower().endswith((".pdf", ".jpg", ".png", ".jpeg")):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF o Imágenes.")

        nombre_unico = f"user_{usuario_actual.id_usu}_{archivo.filename}"
        ruta_fisica = os.path.join(UPLOAD_DIR, nombre_unico)

        with open(ruta_fisica, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        ruta_url = f"/static/documentos/{nombre_unico}"

        nuevo_doc = Documento(
            id_usu=usuario_actual.id_usu,
            id_sp=id_sp,
            tipo_doc=tipo_doc,
            nom_archivo=archivo.filename,
            ruta_archivo=ruta_url,
            estado="PENDIENTE",
        )
        return DocumentoRepository.crear(db, nuevo_doc)

    @staticmethod
    def obtener_mis_documentos(db: Session, usuario_actual: User):
        return DocumentoRepository.obtener_por_usuario(db, usuario_actual.id_usu)

    @staticmethod
    def listar_documentos_admin(
        db: Session,
        id_sp: Optional[int] = None,
        id_usu: Optional[int] = None,
        estado: Optional[str] = None,
    ):
        return AdminGestionRepository.listar_documentos(
            db, id_sp=id_sp, id_usu=id_usu, estado=estado
        )

    @staticmethod
    def revisar_documento(db: Session, id_doc: int, nuevo_estado: str) -> Documento:
        estado_norm = nuevo_estado.strip().upper()
        if estado_norm not in ESTADOS_DOCUMENTO_VALIDOS:
            raise HTTPException(
                status_code=400,
                detail="Estado inválido. Usa: PENDIENTE, APROBADO o RECHAZADO.",
            )

        doc = AdminGestionRepository.obtener_documento_por_id(db, id_doc)
        if not doc:
            raise HTTPException(status_code=404, detail="Documento no encontrado.")

        doc.estado = estado_norm
        return AdminGestionRepository.actualizar_documento(db, doc)