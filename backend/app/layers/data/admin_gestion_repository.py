from typing import Optional, List
from sqlmodel import Session, select
from app.layers.data.base_repository import BaseRepository
from app.layers.models.documento import Documento
from app.layers.models.proveedor import Proveedor


class AdminGestionRepository:

    @staticmethod
    def listar_documentos(
        db: Session,
        id_sp: Optional[int] = None,
        id_usu: Optional[int] = None,
        estado: Optional[str] = None,
    ) -> List[Documento]:
        stmt = select(Documento)
        if id_sp is not None:
            stmt = stmt.where(Documento.id_sp == id_sp)
        if id_usu is not None:
            stmt = stmt.where(Documento.id_usu == id_usu)
        if estado:
            stmt = stmt.where(Documento.estado == estado.strip().upper())
        return list(db.exec(stmt.order_by(Documento.id_doc.desc())).all())

    @staticmethod
    def obtener_documento_por_id(db: Session, id_doc: int) -> Optional[Documento]:
        return BaseRepository.obtener_por_id(db, Documento, id_doc)

    @staticmethod
    def actualizar_documento(db: Session, doc: Documento, commit: bool = True) -> Documento:
        return BaseRepository.actualizar(db, doc, commit=commit)

    @staticmethod
    def listar_proveedores(
        db: Session, estado: Optional[str] = None
    ) -> List[Proveedor]:
        stmt = select(Proveedor)
        if estado:
            stmt = stmt.where(Proveedor.estado == estado.strip().upper())
        return list(db.exec(stmt.order_by(Proveedor.id_prov.desc())).all())

    @staticmethod
    def obtener_proveedor_por_id(db: Session, id_prov: int) -> Optional[Proveedor]:
        return BaseRepository.obtener_por_id(db, Proveedor, id_prov)

    @staticmethod
    def actualizar_proveedor(db: Session, prov: Proveedor, commit: bool = True) -> Proveedor:
        return BaseRepository.actualizar(db, prov, commit=commit)