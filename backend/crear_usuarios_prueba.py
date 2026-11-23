"""
Crea 3 usuarios de prueba (turista, proveedor, administrador) en la base MySQL.

Uso (desde la carpeta backend, con el entorno virtual activado):
    python crear_usuarios_prueba.py

Es seguro correrlo varias veces: si el correo ya existe, no lo duplica.
"""
from sqlalchemy import text
from sqlmodel import Session, select

from app.db.session import engine
from app.core.security import get_password_hash
from app.layers.models.auth import User

USUARIOS = [
    # (nombre, apellido, correo, contraseña, id_rol)
    ("Tomas", "Turista", "turista.test@pat.com", "Turista2026*", 1),
    ("Admin", "Prueba", "admin.test@pat.com", "Admin2026*", 2),
    ("Paola", "Proveedora", "proveedor.test@pat.com", "Proveedor2026*", 3),
]


def crear_usuario(db: Session, nombre, apellido, email, clave, id_rol):
    u = db.exec(select(User).where(User.email == email)).first()
    if u:
        print(f"  ya existe: {email}")
        return u
    u = User(nombre=nombre, apellido=apellido, email=email,
             password_hash=get_password_hash(clave), id_rol=id_rol, activo=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    print(f"  creado: {email} (rol {id_rol})")
    return u


def preparar_proveedor(db: Session, usuario: User):
    """Solicitud APROBADA + proveedor ACTIVO + los 5 tipos de servicio + 1 documento."""
    ya = db.execute(text("SELECT id_prov FROM proveedor WHERE id_usu = :u"), params={"u": usuario.id_usu}).first()
    if ya:
        print("  el proveedor ya estaba preparado")
        return

    db.execute(text(
        "INSERT INTO solicitud_proveedor (id_usu, nit, razon_social, telefono_contacto, cuenta_bancaria, banco, estado) "
        "VALUES (:u, '900765432-1', 'Turismo Tequendama Prueba S.A.S.', '3001234567', '123456789012', 'Bancolombia', 'APROBADA')"
    ), params={"u": usuario.id_usu})
    id_sp = db.execute(text("SELECT id_sp FROM solicitud_proveedor WHERE id_usu = :u"), params={"u": usuario.id_usu}).first()[0]

    db.execute(text("INSERT INTO proveedor (id_usu, id_sp, estado) VALUES (:u, :sp, 'ACTIVO')"),
            params={"u": usuario.id_usu, "sp": id_sp})
    id_prov = db.execute(text("SELECT id_prov FROM proveedor WHERE id_usu = :u"), params={"u": usuario.id_usu}).first()[0]

    for tipo in (1, 2, 3, 4, 5):
        db.execute(text("INSERT INTO solicitud_tp_servicio (id_sp, id_tp_serv) VALUES (:sp, :t)"), params={"sp": id_sp, "t": tipo})
        db.execute(text("INSERT INTO proveedor_tp_servicio (id_prov, id_tp_serv) VALUES (:p, :t)"), params={"p": id_prov, "t": tipo})

    # Sin al menos un documento el sistema no deja publicar servicios
    db.execute(text(
        "INSERT INTO documentos (id_usu, id_sp, tipo_doc, nom_archivo, ruta_archivo, estado) "
        "VALUES (:u, :sp, 'RUT', 'rut_prueba.pdf', '/static/documentos/rut_prueba.pdf', 'APROBADO')"
    ), params={"u": usuario.id_usu, "sp": id_sp})
    db.commit()
    print("  proveedor listo para publicar servicios")


def asegurar_metodos_pago(db: Session):
    total = db.execute(text("SELECT COUNT(*) FROM metodo_pago")).first()[0]
    if total == 0:
        db.execute(text("INSERT INTO metodo_pago (nombre, descripcion) VALUES ('Tarjeta de crédito', 'Pago simulado'), ('PSE', 'Pago simulado')"))
        db.commit()
        print("  métodos de pago creados")


if __name__ == "__main__":
    with Session(engine) as db:
        print("Usuarios:")
        creados = {}
        for datos in USUARIOS:
            creados[datos[4]] = crear_usuario(db, *datos)
        print("Proveedor:")
        preparar_proveedor(db, creados[3])
        print("Pagos:")
        asegurar_metodos_pago(db)
    print("Listo.")
