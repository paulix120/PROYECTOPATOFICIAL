import unicodedata
from sqlmodel import Session, select
from fastapi import HTTPException, status
from decimal import Decimal
from app.layers.data.ubicacion_repository import UbicacionRepository
from app.layers.models.ubicacion import Ubicacion, UbicacionCreate, UbicacionUpdate, UbicacionLibreCreate
from app.layers.models.ciudad import Ciudad
from app.core.maps import obtener_coordenadas_exactas, buscar_lugar as geocodificar_lugar
import re

class UbicacionService:
    @staticmethod
    def crear_ubicacion(db: Session, data: UbicacionCreate):
        ciudad = db.get(Ciudad, data.id_cdad)
        if not ciudad:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La ciudad no existe.")

        lat = data.latitud
        lon = data.longitud
        if lat is None or lon is None:
            lat_map, lon_map = obtener_coordenadas_exactas(
                nombre=data.barrio or data.direccion, 
                direccion=data.direccion, 
                ciudad=ciudad.nombre
            )
            if lat_map is None or lon_map is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo calcular las coordenadas. Ingréselas manualmente.")
            lat, lon = Decimal(str(lat_map)), Decimal(str(lon_map))

        nueva_ubicacion = Ubicacion(
            direccion=data.direccion, barrio=data.barrio, codigo_postal=data.codigo_postal,
            latitud=lat, longitud=lon, descripcion=data.descripcion, id_cdad=data.id_cdad, activo=True
        )
        return UbicacionRepository.crear_o_actualizar(db, nueva_ubicacion)

    @staticmethod
    def listar_ubicaciones(db: Session):
        return UbicacionRepository.obtener_todas(db)

    @staticmethod
    def actualizar_ubicacion(db: Session, id_ubi: int, data: UbicacionUpdate):
        ubicacion = UbicacionRepository.obtener_por_id(db, id_ubi)
        if not ubicacion:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")
        
        datos = data.model_dump(exclude_unset=True)
        for key, value in datos.items():
            setattr(ubicacion, key, value)
            
        return UbicacionRepository.crear_o_actualizar(db, ubicacion)

    @staticmethod
    def eliminar_ubicacion(db: Session, id_ubi: int):
        ubicacion = UbicacionRepository.obtener_por_id(db, id_ubi)
        if not ubicacion:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")
        
        ubicacion.activo = False 
        UbicacionRepository.crear_o_actualizar(db, ubicacion)
        return {"mensaje": "Ubicación inactivada con éxito."}

    @staticmethod
    def _normalizar(texto: str) -> str:
        sin_tildes = unicodedata.normalize("NFD", texto or "").encode("ascii", "ignore").decode()
        return sin_tildes.lower().strip()

   
    @staticmethod
    def _limpiar_ciudad(texto: str) -> str:
        n = UbicacionService._normalizar(texto)
        n = re.sub(r"\b(d\.?\s?c\.?|distrito capital|distrito especial|departamento de)\b", " ", n)
        n = re.sub(r"[^a-z0-9 ]", " ", n)
        return " ".join(n.split())

    @staticmethod
    def _id_ciudad(ciudades_db, candidatas):
        for cand in candidatas or []:
            objetivo = UbicacionService._limpiar_ciudad(cand)
            for c in ciudades_db:
                if UbicacionService._limpiar_ciudad(c.nombre) == objetivo:
                    return c.id_cdad
        return None

    @staticmethod
    def buscar_lugar(db: Session, texto: str):
        texto = (texto or "").strip()
        if len(texto) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Escribe una dirección o lugar más específico.")

        lugar = geocodificar_lugar(texto)
        if not lugar:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No se encontró '{texto}' en el mapa. Intenta agregar la ciudad o el barrio.")

        ciudades_db = db.exec(select(Ciudad)).all()

        def armar(l):
            return {
                "direccion": texto,
                "barrio": l["barrio"],
                "latitud": l["latitud"],
                "longitud": l["longitud"],
                "descripcion": l["nombre_mapa"],
                "id_cdad": UbicacionService._id_ciudad(ciudades_db, l.get("ciudades")),  # puede ser None, no importa
                "ciudad": l["ciudad"],
            }

        resp = armar(lugar)
        resp["alternativas"] = [armar(a) for a in lugar.get("alternativas", [])]
        return resp

    @staticmethod
    def crear_ubicacion_libre(db: Session, data: UbicacionLibreCreate):
        if not (-90 <= data.latitud <= 90 and -180 <= data.longitud <= 180):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coordenadas inválidas.")

        # Si ya existe una ubicación con esas mismas coordenadas, se reutiliza
        existente = db.exec(
            select(Ubicacion).where(
                Ubicacion.latitud == data.latitud,
                Ubicacion.longitud == data.longitud,
                Ubicacion.activo == True
            )
        ).first()
        if existente:
            return existente

        nueva = Ubicacion(
            direccion=data.direccion.strip(),
            barrio=data.barrio,
            latitud=data.latitud,
            longitud=data.longitud,
            descripcion=data.descripcion,
            id_cdad=data.id_cdad,
            activo=True
        )
        return UbicacionRepository.crear_o_actualizar(db, nueva)
