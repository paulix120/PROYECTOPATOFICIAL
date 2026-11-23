from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
from app.layers.models.documento import Documento
from app.layers.business.documento_service import DocumentoService

router = APIRouter(prefix="/documentos", tags=["Subida de Archivos"])


class DocumentoEstadoUpdate(BaseModel):
    estado: str


@router.post("/", response_model=Documento)
def subir_documento(
    tipo_doc: str = Form(..., description="Ej: RUT, RNT, Cedula"),
    id_sp: Optional[int] = Form(None, description="ID de la solicitud (Opcional)"),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_session),
    usuario_actual: User = Depends(get_current_user),
):
    return DocumentoService.subir_documento(db, usuario_actual, tipo_doc, archivo, id_sp)


@router.get("/mis-documentos", response_model=List[Documento])
def obtener_mis_documentos(
    db: Session = Depends(get_session),
    usuario_actual: User = Depends(get_current_user),
):
    return DocumentoService.obtener_mis_documentos(db, usuario_actual)


@router.get("/", response_model=List[Documento], dependencies=[Depends(require_role(2))])
def listar_documentos_admin(
    id_sp: Optional[int] = Query(default=None),
    id_usu: Optional[int] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    db: Session = Depends(get_session),
):
    return DocumentoService.listar_documentos_admin(
        db, id_sp=id_sp, id_usu=id_usu, estado=estado
    )


@router.put("/{id_doc}/estado", response_model=Documento, dependencies=[Depends(require_role(2))])
def revisar_documento(
    id_doc: int,
    data: DocumentoEstadoUpdate,
    db: Session = Depends(get_session),
):
    return DocumentoService.revisar_documento(db, id_doc, data.estado)