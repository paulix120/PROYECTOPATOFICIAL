from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
from app.layers.models.proveedor import Proveedor
from app.layers.business.proveedor_service import ProveedorService
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User

router = APIRouter(prefix="/proveedores", tags=["Flujo del Proveedor"])

class ProveedorEstadoUpdate(BaseModel):
    estado: str

@router.get("/", response_model=List[Proveedor])
def listar_proveedores(estado: Optional[str] = Query(default=None), db: Session = Depends(get_session)):
    return ProveedorService.obtener_todos(db, estado=estado)

@router.get("/mi-perfil", dependencies=[Depends(require_role(3))])
def obtener_mi_perfil(db: Session = Depends(get_session), usuario: User = Depends(get_current_user)):
    return ProveedorService.obtener_mi_perfil(db, usuario)

@router.get("/mi-perfil", dependencies=[Depends(require_role(3))])
def obtener_mi_perfil(
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
    return ProveedorService.obtener_mi_perfil(db, usuario)

@router.get("/{id_prov}", response_model=Proveedor)
def obtener_proveedor(id_prov: int, db: Session = Depends(get_session)):
    return ProveedorService.obtener_por_id(db, id_prov)

@router.put("/{id_prov}/estado", response_model=Proveedor, dependencies=[Depends(require_role(2))])
def cambiar_estado_proveedor(id_prov: int, data: ProveedorEstadoUpdate, db: Session = Depends(get_session)):
    return ProveedorService.cambiar_estado(db, id_prov, data.estado)