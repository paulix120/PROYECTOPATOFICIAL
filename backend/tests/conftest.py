"""
Preparación de las pruebas de PAT.
Usa una base SQLite de prueba, así no se toca la base MySQL real.
Poner esta carpeta "tests" en la raíz del proyecto, al lado de "app".
"""
import os

# Estas variables deben ponerse ANTES de importar la app
os.environ["DATABASE_URL"] = "sqlite:///./test_pat.db"
os.environ["SECRET_KEY"] = "clave-solo-para-pruebas"
if os.path.exists("test_pat.db"):
    os.remove("test_pat.db")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session

from app.main import app
from app.db.session import engine
engine.echo = False
from app.core.security import get_password_hash
from app.layers.models.auth import User
from app.layers.models.ubicacion import Ubicacion
from app.layers.models.servicio import Servicio, ServicioHospedaje
from app.layers.models.servicio_gastronomia import ServicioGastronomia
from app.layers.models.proveedor import Proveedor, ProveedorTpServicio
from app.layers.models.documento import Documento

CLAVE = "Clave123!"


@pytest.fixture(autouse=True)
def base_limpia():
    """Cada prueba empieza con la base vacía."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    with Session(engine) as s:
        yield s


@pytest.fixture
def crear_usuario(client, db):
    """Crea un usuario con el rol pedido (1 turista, 2 admin, 3 proveedor)
    y devuelve su id y sus headers con el token."""
    def _crear(email="turista@correo.com", rol=1):
        u = User(nombre="Ana", apellido="Perez", email=email,
                 password_hash=get_password_hash(CLAVE), id_rol=rol, activo=True)
        db.add(u)
        db.commit()
        db.refresh(u)
        r = client.post("/auth/login-json", json={"email": email, "password": CLAVE})
        token = r.json()["access_token"]
        return {"id": u.id_usu, "headers": {"Authorization": f"Bearer {token}"}}
    return _crear


@pytest.fixture
def ubicacion(db):
    def _ubi(lat, lon, direccion="Centro"):
        u = Ubicacion(direccion=direccion, latitud=lat, longitud=lon)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u.id_ubi
    return _ubi


@pytest.fixture
def servicio(db):
    def _serv(nombre="Hotel Prueba", id_tp_serv=1, id_prov=None):
        s = Servicio(nombre=nombre, descripcion="Servicio de prueba", id_tp_serv=id_tp_serv,
                     id_tp_turi=1, id_gama=1, id_prov=id_prov, id_ubi=1)
        db.add(s)
        db.commit()
        db.refresh(s)
        return s.id_servicio
    return _serv


@pytest.fixture
def habitacion(db):
    def _hab(id_servicio, vlr_noche=100000):
        h = ServicioHospedaje(id_servicio=id_servicio, nom_unidad="Hab 101",
                              capacidad_personas=2, vlr_noche=vlr_noche)
        db.add(h)
        db.commit()
        db.refresh(h)
        return h.id_hosp
    return _hab


@pytest.fixture
def plato(db):
    def _plato(id_servicio, valor=30000):
        p = ServicioGastronomia(id_servicio=id_servicio, nom_platillo_menu="Bandeja",
                                vlr_estimado=valor)
        db.add(p)
        db.commit()
        db.refresh(p)
        return p.id_gast
    return _plato


@pytest.fixture
def hacer_proveedor(db):
    """Deja a un usuario listo para publicar hospedajes:
    proveedor activo, autorizado para hospedaje y con un documento subido."""
    def _prov(id_usu, id_sp=1):
        p = Proveedor(id_usu=id_usu, id_sp=id_sp, estado="ACTIVO")
        db.add(p)
        db.commit()
        db.refresh(p)
        db.add(ProveedorTpServicio(id_prov=p.id_prov, id_tp_serv=1))
        db.add(Documento(id_usu=id_usu, tipo_doc="RUT", nom_archivo="rut.pdf", ruta_archivo="/x/rut.pdf"))
        db.commit()
        return p.id_prov
    return _prov
