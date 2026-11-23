from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
from app.layers.business.reserva_proveedor_service import (
    ReservaProveedorService,
    EstadoReservaUpdate,
)

router = APIRouter(prefix="/proveedor/reservas", tags=["Flujo del Proveedor - Reservas"])


@router.get("/", dependencies=[Depends(require_role(3))])
def listar_mis_reservas(
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
    return ReservaProveedorService.listar_mis_reservas(db, usuario)


@router.patch("/{id_plan_viaje}/estado", dependencies=[Depends(require_role(3))])
def actualizar_estado_reserva(
    id_plan_viaje: int,
    data: EstadoReservaUpdate,
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
<<<<<<< HEAD
    return ReservaProveedorService.actualizar_estado_reserva(db, id_plan_viaje, data, usuario)
=======
    return ReservaProveedorService.actualizar_estado_reserva(db, id_plan_viaje, data, usuario)
>>>>>>> origin/parteMiguel
