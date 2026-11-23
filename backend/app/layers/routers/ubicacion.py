from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
from app.layers.business.ubicacion_service import UbicacionService
from app.layers.models.ubicacion import UbicacionCreate, UbicacionUpdate, UbicacionResponse, UbicacionLibreCreate

router = APIRouter(prefix="/ubicaciones", tags=["Ubicaciones Geográficas"])

@router.post("/", response_model=UbicacionResponse, status_code=201, dependencies=[Depends(require_role(2, 3))])
def crear_ubicacion(data: UbicacionCreate, db: Session = Depends(get_session)):
    return UbicacionService.crear_ubicacion(db, data)

@router.get("/", response_model=List[UbicacionResponse])
def listar_ubicaciones(db: Session = Depends(get_session)):
    return UbicacionService.listar_ubicaciones(db)

@router.put("/{id_ubi}", response_model=UbicacionResponse, dependencies=[Depends(require_role(2, 3))])
def actualizar_ubicacion(id_ubi: int, data: UbicacionUpdate, db: Session = Depends(get_session)):
    return UbicacionService.actualizar_ubicacion(db, id_ubi, data)

@router.delete("/{id_ubi}", dependencies=[Depends(require_role(2))])
def eliminar_ubicacion(id_ubi: int, db: Session = Depends(get_session)):
    return UbicacionService.eliminar_ubicacion(db, id_ubi)

@router.get("/buscar")
def buscar_lugar(texto: str, db: Session = Depends(get_session), usuario: User = Depends(get_current_user)):
    return UbicacionService.buscar_lugar(db, texto)

@router.post("/desde-mapa", response_model=UbicacionResponse, status_code=201)
def crear_ubicacion_libre(data: UbicacionLibreCreate, db: Session = Depends(get_session), usuario: User = Depends(get_current_user)):
    return UbicacionService.crear_ubicacion_libre(db, data)