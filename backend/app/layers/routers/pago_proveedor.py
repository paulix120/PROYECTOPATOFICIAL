from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db.session import get_session
from app.core.security import get_current_user, require_role
from app.layers.models.auth import User
from app.layers.business.pago_proveedor_service import PagoProveedorService

router = APIRouter(prefix="/proveedor/pagos", tags=["Flujo del Proveedor - Finanzas"])


@router.get("/", dependencies=[Depends(require_role(3))])
def listar_mis_pagos(
    db: Session = Depends(get_session),
    usuario: User = Depends(get_current_user)
):
<<<<<<< HEAD
    return PagoProveedorService.obtener_mis_pagos(db, usuario)
=======
    return PagoProveedorService.obtener_mis_pagos(db, usuario)
>>>>>>> origin/parteMiguel
