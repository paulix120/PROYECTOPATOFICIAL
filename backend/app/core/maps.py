from functools import lru_cache
import logging
import threading
import time
from typing import Optional, Tuple
from geopy.geocoders import Nominatim
from typing import Tuple, Optional
import time
import re
import unicodedata

geolocator = Nominatim(user_agent="pat_turismo_app")


def obtener_coordenadas_exactas(
    nombre: str,
    direccion: Optional[str],
    ciudad: str
) -> Tuple[Optional[float], Optional[float]]:
    """
    Busca las coordenadas de la forma más precisa posible usando caché en memoria.
    """
    nom_norm = (nombre or "").strip().lower()
    dir_norm = (direccion or "").strip().lower()
    ciu_norm = (ciudad or "").strip().lower()

    if not nom_norm and not dir_norm:
        return None, None

    coords = _buscar_en_cache(nom_norm, dir_norm, ciu_norm)

    # No memorizar fallos temporales de red/servicio si devolvió (None, None)
    if coords == (None, None):
        _buscar_en_cache.cache_clear()

        return None, None

import re
import unicodedata

def _norm(t: str) -> str:
    sin = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode()
    return sin.lower().strip()

def _variantes(texto: str):
    t = " ".join((texto or "").split())
    variantes = [t]
    # "Carrera 7 # 28-66" -> "Carrera 7 28-66" (Nominatim se confunde con el #)
    sin_signo = re.sub(r"\s*(#|n[o°º]\.?|nro\.?)\s*(?=\d)", " ", t, flags=re.I)
    sin_signo = " ".join(sin_signo.split())
    if sin_signo.lower() != t.lower():
        variantes.append(sin_signo)
    return variantes

def _a_lugar(loc) -> dict:
    address = loc.raw.get("address", {})
    ciudades = [address.get(k) for k in
                ("city", "town", "village", "municipality", "county", "state_district", "state")
                if address.get(k)]
    barrio = address.get("neighbourhood") or address.get("suburb") or address.get("quarter")
    return {
        "latitud": round(loc.latitude, 8),
        "longitud": round(loc.longitude, 8),
        "nombre_mapa": loc.address,
        "ciudad": ciudades[0] if ciudades else None,
        "ciudades": ciudades,
        "barrio": barrio,
    }

def buscar_lugar(texto: str) -> Optional[dict]:
    """Devuelve el mejor resultado + 'alternativas' (hasta 4 más)."""
    resultados, vistos = [], set()
    for consulta in _variantes(texto):
        try:
            encontrados = geolocator.geocode(
                consulta, addressdetails=True, country_codes="co",
                language="es", timeout=10, exactly_one=False, limit=5
            )
        except Exception as e:
            print(f"Error buscando lugar: {e}")
            encontrados = None
        for loc in encontrados or []:
            clave = (round(loc.latitude, 4), round(loc.longitude, 4))
            if clave not in vistos:
                vistos.add(clave)
                resultados.append(loc)
        if resultados:
            break
        time.sleep(1)

    if not resultados:
        return None

    # Si el texto trae ciudad ("..., Bogotá"), esos resultados van primero
    partes = [p.strip() for p in texto.split(",") if p.strip()]
    if len(partes) > 1:
        pista = _norm(partes[-1])
        resultados.sort(key=lambda l: 0 if pista in _norm(l.address) else 1)

    lugares = [_a_lugar(l) for l in resultados]
    principal = lugares[0]
    principal["alternativas"] = lugares[1:]
    return principal
