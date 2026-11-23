"""
Pruebas automáticas de PAT con Pytest.
El nombre de cada función lleva el código del caso de la matriz, por ejemplo
test_CP_02_03 corresponde al caso CP-02-03.

Las pruebas dicen lo que pide la matriz. Si una falla, es un defecto
(o el criterio de la matriz ya no aplica y hay que ajustarlo).
"""
import time
from datetime import datetime, timedelta

from app.layers.models.auth import User
from sqlmodel import select

CLAVE = "Clave123!"


# ======================================================================
# HU-01 a HU-04  Registro, login, sesión y recuperación
# ======================================================================

def test_CP_01_01_registro_con_datos_validos(client):
    # La matriz pide cuenta "pendiente" con correo de verificación.
    # Probable FALLIDO: el código crea la cuenta activa y no envía correo.
    r = client.post("/auth/register", json={
        "nombre": "Ana", "apellido": "Perez",
        "email": "prueba1@correo.com", "password": CLAVE})
    assert r.status_code == 201
    assert r.json()["activo"] is False


def test_CP_01_02_registro_con_correo_invalido(client):
    r = client.post("/auth/register", json={
        "nombre": "Ana", "apellido": "Perez",
        "email": "correo-sin-arroba", "password": CLAVE})
    assert r.status_code == 422


def test_CP_02_01_login_correcto(client, crear_usuario):
    crear_usuario("ana@correo.com")
    r = client.post("/auth/login-json", json={"email": "ana@correo.com", "password": CLAVE})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ana@correo.com"


def test_CP_02_02_login_con_campos_invalidos(client):
    r = client.post("/auth/login-json", json={"email": "sin-arroba", "password": ""})
    assert r.status_code == 422


def test_CP_02_03_login_con_contrasena_incorrecta(client, crear_usuario):
    crear_usuario("ana@correo.com")
    mala = client.post("/auth/login-json", json={"email": "ana@correo.com", "password": "Mala1234!"})
    inexistente = client.post("/auth/login-json", json={"email": "noexiste@correo.com", "password": "Mala1234!"})
    assert mala.status_code == 401
    assert inexistente.status_code == 401
    # El mensaje debe ser el mismo para no revelar si el correo existe
    assert mala.json()["detail"] == inexistente.json()["detail"]


def test_CP_03_02_ruta_protegida_sin_token(client):
    assert client.get("/auth/me").status_code == 401
    r = client.get("/auth/me", headers={"Authorization": "Bearer token-falso"})
    assert r.status_code == 401


def test_CP_04_01_recuperar_clave_mensaje_generico(client, crear_usuario):
    crear_usuario("ana@correo.com")
    existe = client.post("/auth/forgot-password", json={"email": "ana@correo.com"})
    no_existe = client.post("/auth/forgot-password", json={"email": "nadie@correo.com"})
    assert existe.status_code == 200 and no_existe.status_code == 200
    assert existe.json()["mensaje"] == no_existe.json()["mensaje"]


def test_CP_04_02_cambiar_clave_con_enlace_valido(client, crear_usuario):
    crear_usuario("ana@correo.com")
    token = client.post("/auth/forgot-password",
                        json={"email": "ana@correo.com"}).json()["token_desarrollo"]
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "Nueva456!"})
    assert r.status_code == 200
    ok = client.post("/auth/login-json", json={"email": "ana@correo.com", "password": "Nueva456!"})
    viejo = client.post("/auth/login-json", json={"email": "ana@correo.com", "password": CLAVE})
    assert ok.status_code == 200
    assert viejo.status_code == 401


def test_CP_04_03_enlace_vencido(client, crear_usuario, db):
    crear_usuario("ana@correo.com")
    token = client.post("/auth/forgot-password",
                        json={"email": "ana@correo.com"}).json()["token_desarrollo"]
    u = db.exec(select(User).where(User.email == "ana@correo.com")).first()
    u.token_expiracion = datetime.utcnow() - timedelta(hours=1)
    db.add(u)
    db.commit()
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "Nueva456!"})
    assert r.status_code == 400


def test_CP_06_02_cuenta_desactivada_no_entra(client, crear_usuario, db):
    # La matriz pide un mensaje que diga que la cuenta está desactivada.
    # Probable FALLIDO en el mensaje: el código responde el mensaje genérico.
    crear_usuario("ana@correo.com")
    u = db.exec(select(User).where(User.email == "ana@correo.com")).first()
    u.activo = False
    db.add(u)
    db.commit()
    r = client.post("/auth/login-json", json={"email": "ana@correo.com", "password": CLAVE})
    assert r.status_code in (401, 403)
    assert "desactiv" in r.json()["detail"].lower()


# ======================================================================
# HU-14, HU-17, HU-19, HU-20, HU-22  Plan de viaje y costos
# ======================================================================

def _plan(client, headers, origen, destino, nombre="Viaje a Medellín"):
    r = client.post("/planes-viaje/", headers=headers, json={
        "nombre_plan": nombre, "fecha_inicio": "2026-12-01", "fecha_fin": "2026-12-05",
        "id_ubicacion_origen": origen, "id_ubicacion_destino": destino})
    return r


def test_CP_14_02_plan_sin_destino(client, crear_usuario):
    u = crear_usuario()
    r = client.post("/planes-viaje/", headers=u["headers"], json={
        "nombre_plan": "Viaje", "fecha_inicio": "2026-12-01", "fecha_fin": "2026-12-05",
        "id_ubicacion_origen": 1})
    assert r.status_code == 422


def test_CP_22_01_guardar_plan_de_viaje(client, crear_usuario, ubicacion):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    r = _plan(client, u["headers"], o, d)
    assert r.status_code == 200
    assert r.json()["id_plan_viaje"] is not None
    planes = client.get("/planes-viaje/mis-planes", headers=u["headers"]).json()
    assert len(planes) == 1
    assert planes[0]["nombre_plan"] == "Viaje a Medellín"


def test_CP_22_02_plan_sin_nombre(client, crear_usuario, ubicacion):
    # Probable FALLIDO: el código acepta un nombre vacío.
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    r = _plan(client, u["headers"], o, d, nombre="")
    assert r.status_code in (400, 422)


def test_CP_17_01_costo_transporte_propio(client, crear_usuario, ubicacion):
    # El código calcula distancia x 450. No muestra rango mínimo y máximo.
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    r = client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "TRANSPORTE_PROPIO", "cantidad": 1, "fecha_servicio": "2026-12-01"})
    assert r.status_code == 200
    assert float(r.json()["subtotal"]) > 0


def test_CP_17_02_recalcula_en_menos_de_2_segundos(client, crear_usuario, ubicacion):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    item = client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "TRANSPORTE_PROPIO", "cantidad": 1, "fecha_servicio": "2026-12-01"}).json()
    primero = float(item["subtotal"])
    t0 = time.perf_counter()
    r = client.put("/planes-viaje/items/1", headers=u["headers"], json={"cantidad": 2})
    demora = time.perf_counter() - t0
    assert r.status_code == 200
    assert float(r.json()["nuevo_subtotal"]) == primero * 2
    assert demora < 2


def test_CP_19_01_costo_hospedaje_por_noches(client, crear_usuario, ubicacion, servicio, habitacion):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    hotel = servicio()
    hab = habitacion(hotel, vlr_noche=100000)
    r = client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "HOSPEDAJE", "id_servicio": hotel, "id_item_especifico": hab,
        "cantidad": 3, "fecha_servicio": "2026-12-01"})
    assert r.status_code == 200
    assert float(r.json()["subtotal"]) == 300000


def test_CP_19_02_cambiar_noches_recalcula(client, crear_usuario, ubicacion, servicio, habitacion):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    hotel = servicio()
    hab = habitacion(hotel, vlr_noche=100000)
    client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "HOSPEDAJE", "id_servicio": hotel, "id_item_especifico": hab,
        "cantidad": 3, "fecha_servicio": "2026-12-01"})
    r = client.put("/planes-viaje/items/1", headers=u["headers"], json={"cantidad": 5})
    assert r.status_code == 200
    assert float(r.json()["nuevo_subtotal"]) == 500000
    assert float(r.json()["NUEVO_TOTAL"]) == 500000


def test_CP_20_01_total_es_la_suma_de_los_servicios(client, crear_usuario, ubicacion,
                                                    servicio, habitacion, plato):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    hotel = servicio()
    hab = habitacion(hotel, vlr_noche=100000)
    rest = servicio("Restaurante Prueba", id_tp_serv=2)
    pl = plato(rest, valor=30000)
    client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "HOSPEDAJE", "id_servicio": hotel, "id_item_especifico": hab,
        "cantidad": 2, "fecha_servicio": "2026-12-01"})
    client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "GASTRONOMIA", "id_servicio": rest, "id_item_especifico": pl,
        "cantidad": 4, "fecha_servicio": "2026-12-02"})
    planes = client.get("/planes-viaje/mis-planes", headers=u["headers"]).json()
    assert float(planes[0]["costo_total_estimado"]) == 200000 + 120000


def test_CP_20_03_quitar_servicio_recalcula_total(client, crear_usuario, ubicacion,
                                                  servicio, habitacion):
    u = crear_usuario()
    o, d = ubicacion(4.7110, -74.0721), ubicacion(6.2442, -75.5812)
    plan = _plan(client, u["headers"], o, d).json()["id_plan_viaje"]
    hotel = servicio()
    hab = habitacion(hotel, vlr_noche=100000)
    client.post(f"/planes-viaje/{plan}/items", headers=u["headers"], json={
        "tipo_item": "HOSPEDAJE", "id_servicio": hotel, "id_item_especifico": hab,
        "cantidad": 2, "fecha_servicio": "2026-12-01"})
    r = client.delete("/planes-viaje/items/1", headers=u["headers"])
    assert r.status_code == 200
    assert float(r.json()["NUEVO_TOTAL"]) == 0


# ======================================================================
# HU-21, HU-23, HU-24  Calificaciones y reseñas
# ======================================================================

def test_CP_21_01_calificar_con_estrellas(client, crear_usuario, servicio):
    u = crear_usuario()
    s = servicio()
    r = client.post("/resenas/", headers=u["headers"],
                    json={"id_servicio": s, "clf_general": 5, "comentario": ""})
    assert r.status_code == 201
    assert "reseña" in r.json()["mensaje"].lower()


def test_CP_21_02_calificar_dos_veces_actualiza(client, crear_usuario, servicio):
    u = crear_usuario()
    s = servicio()
    client.post("/resenas/", headers=u["headers"], json={"id_servicio": s, "clf_general": 5})
    client.post("/resenas/", headers=u["headers"], json={"id_servicio": s, "clf_general": 3})
    lista = client.get(f"/resenas/servicio/{s}").json()
    assert lista["total"] == 1
    assert lista["promedio"] == 3


def test_CP_21_03_calificar_sin_sesion(client, servicio):
    s = servicio()
    r = client.post("/resenas/", json={"id_servicio": s, "clf_general": 4})
    assert r.status_code == 401


def test_CP_23_01_publicar_resena(client, crear_usuario, servicio):
    u = crear_usuario()
    s = servicio()
    texto = "Excelente lugar, la atención fue muy buena y volveré pronto."
    client.post("/resenas/", headers=u["headers"],
                json={"id_servicio": s, "clf_general": 5, "comentario": texto})
    lista = client.get(f"/resenas/servicio/{s}").json()
    assert lista["resenas"][0]["comentario"] == texto
    assert lista["resenas"][0]["fecha_resena"] is not None


def test_CP_23_02_resena_demasiado_corta(client, crear_usuario, servicio):
    # Probable FALLIDO: el código solo valida el máximo de 1000 caracteres.
    u = crear_usuario()
    s = servicio()
    r = client.post("/resenas/", headers=u["headers"],
                    json={"id_servicio": s, "clf_general": 5, "comentario": "Bueno"})
    assert r.status_code == 400


def test_CP_24_01_promedio_de_calificaciones(client, crear_usuario, servicio):
    a = crear_usuario("a@correo.com")
    b = crear_usuario("b@correo.com")
    s = servicio()
    client.post("/resenas/", headers=a["headers"], json={"id_servicio": s, "clf_general": 5})
    client.post("/resenas/", headers=b["headers"], json={"id_servicio": s, "clf_general": 4})
    lista = client.get(f"/resenas/servicio/{s}").json()
    assert lista["total"] == 2
    assert lista["promedio"] == 4.5


def test_CP_24_02_destino_sin_calificaciones(client, servicio):
    s = servicio()
    lista = client.get(f"/resenas/servicio/{s}").json()
    assert lista["total"] == 0
    assert lista["promedio"] == 0


# ======================================================================
# HU-32  Gestionar hospedajes
# ======================================================================

def _datos_hotel():
    return {"nombre": "Hotel Central", "descripcion": "Hotel de prueba",
            "id_tp_turi": 1, "id_gama": 1, "id_ubi": 1}


def test_CP_32_01_crear_hospedaje(client, crear_usuario, hacer_proveedor):
    p = crear_usuario("prov@correo.com", rol=3)
    hacer_proveedor(p["id"])
    r = client.post("/servicios/hospedajes/base", headers=p["headers"], json=_datos_hotel())
    assert r.status_code == 200
    hotel = r.json()["id_servicio"]
    hab = client.post(f"/servicios/hospedajes/{hotel}/espacios", headers=p["headers"], json={
        "nom_unidad": "Hab 101", "capacidad_personas": 2, "vlr_noche": 150000,
        "horario_checkin": "15:00", "horario_checkout": "12:00"})
    assert hab.status_code == 200
    lista = client.get("/servicios/hospedajes").json()
    assert lista[0]["nombre"] == "Hotel Central"


def test_CP_32_02_actualizar_hospedaje(client, crear_usuario, hacer_proveedor):
    p = crear_usuario("prov@correo.com", rol=3)
    hacer_proveedor(p["id"])
    hotel = client.post("/servicios/hospedajes/base", headers=p["headers"],
                        json=_datos_hotel()).json()["id_servicio"]
    r = client.put(f"/servicios/hospedajes/base/{hotel}", headers=p["headers"],
                   json={"nombre": "Hotel Central Plus"})
    assert r.status_code == 200
    assert client.get("/servicios/hospedajes").json()[0]["nombre"] == "Hotel Central Plus"


def test_CP_32_03_eliminar_hospedaje(client, crear_usuario, hacer_proveedor):
    p = crear_usuario("prov@correo.com", rol=3)
    hacer_proveedor(p["id"])
    hotel = client.post("/servicios/hospedajes/base", headers=p["headers"],
                        json=_datos_hotel()).json()["id_servicio"]
    r = client.delete(f"/servicios/hospedajes/base/{hotel}", headers=p["headers"])
    assert r.status_code == 200
    assert client.get("/servicios/hospedajes").json() == []


def test_CP_36_02_registrar_servicio_con_datos_faltantes(client, crear_usuario, hacer_proveedor):
    p = crear_usuario("prov@correo.com", rol=3)
    hacer_proveedor(p["id"])
    r = client.post("/servicios/hospedajes/base", headers=p["headers"], json={})
    assert r.status_code == 422


# ======================================================================
# HU-35  Solicitud de cambio de rol a proveedor
# ======================================================================

def _solicitud(nit="900123456"):
    return {"nit": nit, "razon_social": "Hoteles SAS", "telefono_contacto": "3001234567",
            "cuenta_bancaria": "123456789", "banco": "Bancolombia", "tipos_servicio_ids": [1]}


def test_CP_35_01_aprobar_solicitud_cambia_el_rol(client, crear_usuario):
    turista = crear_usuario("turista@correo.com", rol=1)
    admin = crear_usuario("admin@correo.com", rol=2)
    sol = client.post("/solicitudes-proveedor/", headers=turista["headers"], json=_solicitud())
    assert sol.status_code == 200
    assert sol.json()["estado"] == "EN_REVISION"
    r = client.put(f"/solicitudes-proveedor/{sol.json()['id_sp']}/revision",
                   headers=admin["headers"], json={"estado": "APROBADA"})
    assert r.status_code == 200
    me = client.get("/auth/me", headers=turista["headers"]).json()
    assert me["id_rol"] == 3


def test_CP_35_02_proveedor_aprobado_accede_a_funciones_de_proveedor(client, crear_usuario):
    turista = crear_usuario("turista@correo.com", rol=1)
    admin = crear_usuario("admin@correo.com", rol=2)
    # Antes de ser aprobado, el rol bloquea la ruta
    antes = client.get("/servicios/gastronomia/mis-restaurantes", headers=turista["headers"])
    assert antes.status_code == 403
    sol = client.post("/solicitudes-proveedor/", headers=turista["headers"], json=_solicitud()).json()
    client.put(f"/solicitudes-proveedor/{sol['id_sp']}/revision",
               headers=admin["headers"], json={"estado": "APROBADA"})
    despues = client.get("/servicios/gastronomia/mis-restaurantes", headers=turista["headers"])
    # Ya no lo frena el control de rol. Si aún no tiene permisos o documentos,
    # el mensaje es otro distinto a "No tienes permisos."
    assert despues.json().get("detail") != "No tienes permisos."


def test_CP_35_03_solicitud_rechazada_mantiene_el_rol(client, crear_usuario):
    turista = crear_usuario("turista@correo.com", rol=1)
    admin = crear_usuario("admin@correo.com", rol=2)
    sol = client.post("/solicitudes-proveedor/", headers=turista["headers"], json=_solicitud()).json()
    client.put(f"/solicitudes-proveedor/{sol['id_sp']}/revision",
               headers=admin["headers"], json={"estado": "RECHAZADA", "observaciones": "Faltan documentos"})
    me = client.get("/auth/me", headers=turista["headers"]).json()
    assert me["id_rol"] == 1


# ======================================================================
# Seguridad por rol (RNF-07)
# ======================================================================

def test_RNF_07_turista_no_puede_crear_hospedaje(client, crear_usuario):
    t = crear_usuario("turista@correo.com", rol=1)
    r = client.post("/servicios/hospedajes/base", headers=t["headers"], json=_datos_hotel())
    assert r.status_code == 403


def test_RNF_07_turista_no_puede_revisar_solicitudes(client, crear_usuario):
    t = crear_usuario("turista@correo.com", rol=1)
    r = client.put("/solicitudes-proveedor/1/revision", headers=t["headers"],
                   json={"estado": "APROBADA"})
    assert r.status_code == 403
