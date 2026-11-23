from fastapi import APIRouter, Depends, status
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
<<<<<<< HEAD
from app.layers.models.resena import ResenaCreate, ResenaResponder
=======
from app.layers.models.resena import ResenaServicioCreate, ResenaResponder
>>>>>>> origin/parteMiguel
from app.layers.business.resena_service import ResenaService

router = APIRouter(prefix="/resenas", tags=["Módulo - Reseñas"])


<<<<<<< HEAD
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_resena(
    data: ResenaCreate,
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
    return ResenaService.crear_resena(db, data, usuario)
=======
@router.get("/servicio/{id_servicio}")
def listar_resenas_servicio(id_servicio: int, db: Session = Depends(get_session)):
    return ResenaService.listar_por_servicio(db, id_servicio)


@router.get("/servicio/{id_servicio}/mia")
def obtener_mi_resena(id_servicio: int, db: Session = Depends(get_session), usuario: User = Depends(get_current_user)):
    return ResenaService.obtener_mi_resena(db, id_servicio, usuario)


@router.post("/", status_code=status.HTTP_201_CREATED)
def guardar_resena(data: ResenaServicioCreate, db: Session = Depends(get_session), usuario: User = Depends(get_current_user)):
    return ResenaService.guardar_resena(db, data, usuario)
>>>>>>> origin/parteMiguel


@router.get("/mis-servicios", dependencies=[Depends(require_role(3))])
def listar_resenas_proveedor(
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
    return ResenaService.listar_para_proveedor(db, usuario)


<<<<<<< HEAD
@router.get("/servicio/{id_servicio}")
def listar_resenas_servicio(id_servicio: int, db: Session = Depends(get_session)):
    return ResenaService.listar_por_servicio(db, id_servicio)


=======
>>>>>>> origin/parteMiguel
@router.patch("/{id_resena}/responder", dependencies=[Depends(require_role(3))])
def responder_resena(
    id_resena: int,
    data: ResenaResponder,
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
<<<<<<< HEAD
    return ResenaService.responder_resena(db, id_resena, data, usuario)
=======
    return ResenaService.responder_resena(db, id_resena, data, usuario)
>>>>>>> origin/parteMiguel
