const API_URL = "http://127.0.0.1:8000";
let token = localStorage.getItem("token");
let ubicacionesList = []; 
let todosLosServicios = [];
let planActual = null; 
let tipoServicioActual = "";
let mapaCrearPlanInstance = null; 
let controlRuta = null; 
let serviciosFiltradosMemoria = [];
let servicioSeleccionadoModal = null;
let mapaPreview = null;
let marcadoresPreview = [];
let origenResuelto = null;
let destinoResuelto = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!token) { window.location.href = "../login.html"; return; }
    await cargarUbicaciones();
    await cargarCatalogoCompleto();

    // 💡 SOLUCIÓN: Leer la URL si venimos de "Ver planes -> Agregar más servicios"
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('planId');
    if (planId) {
        await cargarPlanExistente(planId);
    }

    const hoy = fechaHoyLocal();
    const inputInicio = document.getElementById("fechaInicio");
    const inputFin = document.getElementById("fechaFin");
    inputInicio.min = hoy;
    inputFin.min = hoy;
    inputInicio.addEventListener("change", () => {
        inputFin.min = inputInicio.value || hoy;
    });

    document.getElementById("crearPlanForm").addEventListener("submit", crearPlanBase);
    document.getElementById("formAgregarItem").addEventListener("submit", procesarFormularioItem);
});

async function cargarUbicaciones() {
    const res = await fetch(`${API_URL}/ubicaciones/`);
    ubicacionesList = res.ok ? await res.json() : [];
}

function fechaHoyLocal() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
}

async function cargarCatalogoCompleto() {
    const res = await fetch(`${API_URL}/servicios/`);
    if (res.ok) todosLosServicios = await res.json();
}

async function cargarPlanExistente(id_plan) {
    const res = await fetch(`${API_URL}/planes-viaje/mis-planes`, { headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) {
        const misPlanes = await res.json();
        planActual = misPlanes.find(p => p.id_plan_viaje == id_plan);
        if (planActual) {
            document.getElementById("seccionPlanBase").style.display = "none";
            document.getElementById("seccionItems").style.display = "block"; // Se corrigió el ID aquí
            document.getElementById("tituloPlanActivo").textContent = planActual.nombre_plan;
            document.getElementById("fechasPlanActivo").textContent = `Del ${planActual.fecha_inicio} al ${planActual.fecha_fin}`;
            renderizarResumen();
        }
    }
}

async function crearPlanBase(e) {
    e.preventDefault();

    const fInicio = document.getElementById("fechaInicio").value;
    const fFin = document.getElementById("fechaFin").value;
    if (fInicio < fechaHoyLocal()) {
        alert("La fecha de inicio no puede ser una fecha que ya pasó. Elige una fecha de hoy en adelante.");
        return;
    }
    if (fFin < fInicio) {
        alert("La fecha de fin no puede ser anterior a la fecha de inicio.");
        return;
    }

    const tOrigen = document.getElementById("origenTexto").value.trim();
    const tDestino = document.getElementById("destinoTexto").value.trim();

    // Si el usuario cambió el texto (o no buscó), se busca de nuevo
    if (!origenResuelto || origenResuelto.texto !== tOrigen || !destinoResuelto || destinoResuelto.texto !== tDestino) {
        const ok = await buscarEnMapa();
        if (!ok) return;
    }

    try {
        const idOrigen = await guardarUbicacion(origenResuelto.lugar);
        const idDestino = await guardarUbicacion(destinoResuelto.lugar);

        const payload = {
            nombre_plan: document.getElementById("nombrePlan").value,
            fecha_inicio: document.getElementById("fechaInicio").value,
            fecha_fin: document.getElementById("fechaFin").value,
            id_ubicacion_origen: idOrigen,
            id_ubicacion_destino: idDestino
        };

        const res = await fetch(`${API_URL}/planes-viaje/`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
            await cargarUbicaciones(); // para que el mapa encuentre las ubicaciones nuevas
            await cargarPlanExistente(data.id_plan_viaje);
        } else alert(data.detail);
    } catch (error) { console.error(error); alert(error.message || "Error de conexión"); }
}

async function geocodificar(texto) {
    const res = await fetch(`${API_URL}/ubicaciones/buscar?texto=${encodeURIComponent(texto)}`, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo buscar el lugar.");
    return data;
}

async function guardarUbicacion(lugar) {
    const res = await fetch(`${API_URL}/ubicaciones/desde-mapa`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
            direccion: lugar.direccion,
            barrio: lugar.barrio,
            latitud: lugar.latitud,
            longitud: lugar.longitud,
            descripcion: lugar.descripcion,
            id_cdad: lugar.id_cdad
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "No se pudo guardar la ubicación.");
    return data.id_ubi;
}

async function buscarEnMapa() {
    const tOrigen = document.getElementById("origenTexto").value.trim();
    const tDestino = document.getElementById("destinoTexto").value.trim();
    const info = document.getElementById("infoBusqueda");

    if (!tOrigen || !tDestino) {
        alert("Escribe el origen y el destino.");
        return false;
    }

    info.textContent = "⏳ Buscando ubicaciones...";
    try {
        const lugarOrigen = await geocodificar(tOrigen);
        const lugarDestino = await geocodificar(tDestino);

        origenResuelto = { texto: tOrigen, lugar: lugarOrigen };
        destinoResuelto = { texto: tDestino, lugar: lugarDestino };

        dibujarPreview(lugarOrigen, lugarDestino);
        actualizarInfoBusqueda();
        mostrarAlternativas();
        return true;
    } catch (error) {
        info.textContent = "";
        alert(error.message);
        return false;
    }
}

function dibujarPreview(origen, destino) {
    if (!mapaPreview) {
        mapaPreview = L.map("mapaPreview").setView([4.6534, -74.1162], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaPreview);
    }
    marcadoresPreview.forEach(m => mapaPreview.removeLayer(m));
    marcadoresPreview = [];

    const mOri = L.marker([origen.latitud, origen.longitud]).addTo(mapaPreview).bindPopup("Origen: " + origen.direccion);
    const mDes = L.marker([destino.latitud, destino.longitud]).addTo(mapaPreview).bindPopup("Destino: " + destino.direccion);
    marcadoresPreview.push(mOri, mDes);

    mapaPreview.fitBounds(
        L.latLngBounds([[origen.latitud, origen.longitud], [destino.latitud, destino.longitud]]),
        { padding: [30, 30] }
    );
}

function renderizarResumen() {
    const ul = document.getElementById("listaResumen"); ul.innerHTML = "";
    (planActual.items_agregados || []).forEach(it => {
        ul.innerHTML += `<li><strong>${it.fecha_servicio}</strong> | [${it.tipo_item}] ${it.observaciones || ''} <span style="color:#16a34a; font-weight:bold; float:right;">+$${Number(it.subtotal_calculado).toLocaleString()}</span></li>`;
    });
    document.getElementById("costoTotal").innerText = Number(planActual.costo_total_estimado).toLocaleString();
}

function cambiarDePlan() {
    planActual = null; 
    document.getElementById("seccionPlanBase").style.display = "block"; 
    document.getElementById("seccionItems").style.display = "none";
    window.history.replaceState(null, '', 'crear_plan.html'); // Limpia la URL
    document.getElementById("crearPlanForm").reset();
        if (mapaPreview) setTimeout(() => mapaPreview.invalidateSize(), 100);
}

const RADIO_CERCA_KM = 25;
let refTransporte = {}; // id_servicio -> {dDest, dOri}

function distKm(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined || isNaN(v))) return null;
    const R = 6371, toR = d => d * Math.PI / 180;
    const a = Math.sin(toR(lat2 - lat1) / 2) ** 2 +
              Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(toR(lon2 - lon1) / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const distUbis = (a, b) => (a && b) ? distKm(parseFloat(a.latitud), parseFloat(a.longitud), parseFloat(b.latitud), parseFloat(b.longitud)) : null;

// Devuelve {cerca, km}
function evaluarCercania(s) {
    const ubiDestino = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_destino);
    const ubiOrigen = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_origen);

    if (tipoServicioActual === "TRANSPORTE") {
        const r = refTransporte[s.id_servicio];
        if (!r || r.dDest === null) return { cerca: false, km: null };
        // Debe llegar cerca del destino y salir razonablemente cerca del origen (aeropuertos/terminales)
        const origenOk = r.dOri === null || r.dOri <= 80;
        return { cerca: r.dDest <= 30 && origenOk, km: r.dDest };
    }
    const km = distUbis(ubiDestino, s.ubicacion);
    return { cerca: km !== null && km <= RADIO_CERCA_KM, km };
}

async function cargarCategoria() {
    tipoServicioActual = document.getElementById("tipoServicio").value;
    const gTarjetas = document.getElementById("grupoTarjetas");
    const gCarro = document.getElementById("grupoCarroPropio");

    if (!tipoServicioActual) { gTarjetas.style.display = "none"; gCarro.style.display = "none"; return; }
    if (tipoServicioActual === "TRANSPORTE_PROPIO") {
        gTarjetas.style.display = "none"; gCarro.style.display = "block";
        actualizarMapaEnVivo();
        return;
    }
    gTarjetas.style.display = "block"; gCarro.style.display = "none";

    const mapTipo = { "HOSPEDAJE": 1, "GASTRONOMIA": 2, "DESTINO_TURISTICO": 3, "TRANSPORTE": 4, "GUIA": 5 };
    serviciosFiltradosMemoria = todosLosServicios.filter(s => s.id_tp_serv === mapTipo[tipoServicioActual]);

    if (tipoServicioActual === "TRANSPORTE") {
        refTransporte = {};
        try {
            const res = await fetch(`${API_URL}/servicios/transporte/`);
            const transportes = await res.json();
            const ubiDestino = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_destino);
            const ubiOrigen = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_origen);
            transportes.forEach(t => {
                const d = t.detalle;
                const uDes = ubicacionesList.find(u => u.id_ubi == d.id_destino);
                const uOri = ubicacionesList.find(u => u.id_ubi == d.id_origen);
                refTransporte[t.servicio_base.id_servicio] = {
                    dDest: distUbis(ubiDestino, uDes),
                    dOri: distUbis(ubiOrigen, uOri)
                };
            });
        } catch (e) { console.error("Error evaluando transportes", e); }
    }
    renderizarTarjetas(serviciosFiltradosMemoria);
}

function renderizarTarjetas(servicios) {
    const cCerca = document.getElementById("cardsCerca"); const cLejos = document.getElementById("cardsLejos");
    cCerca.innerHTML = ""; cLejos.innerHTML = "";

    const evaluados = servicios.map(s => ({ s, ...evaluarCercania(s) }))
        .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));

    evaluados.forEach(({ s, cerca, km }) => {
        const img = s.imagen_principal ? (s.imagen_principal.startsWith('http') ? s.imagen_principal : API_URL + s.imagen_principal) : 'https://via.placeholder.com/300x200?text=Servicio';
        const distTxt = km !== null ? ` · a ${km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km"}` : "";
        const html = `
            <div class="tarjeta-servicio" onclick="abrirModal(${s.id_servicio})">
                <img src="${img}">
                <h4 style="color:#0f172a; margin-bottom:4px; font-size:15px;">${s.nombre}</h4>
                <p style="color:#64748b; font-size:12px;">📍 ${s.ubicacion ? s.ubicacion.direccion : 'Ubicación no registrada'}${distTxt}</p>
            </div>`;
        (cerca ? cCerca : cLejos).innerHTML += html;
    });

    if (cCerca.innerHTML === "") cCerca.innerHTML = "<p style='color:#64748b; font-size: 13px;'>No hay servicios cerca de tu destino.</p>";
    if (cLejos.innerHTML === "") cLejos.innerHTML = "<p style='color:#64748b; font-size: 13px;'>No se encontraron más servicios.</p>";
}

async function abrirModal(id_servicio) {
    const s = todosLosServicios.find(x => x.id_servicio === id_servicio);
    servicioSeleccionadoModal = s;
    document.getElementById("modalSubTitulo").textContent = s.nombre;
    const sel = document.getElementById("modalSubSelect"); sel.innerHTML = "<option value=''>Cargando opciones...</option>";
    
    let ep = "";
    if (tipoServicioActual === "HOSPEDAJE") ep = "hospedajes";
    else if (tipoServicioActual === "GASTRONOMIA") ep = "gastronomia/restaurantes";
    else if (tipoServicioActual === "TRANSPORTE") ep = "transporte/";
    else if (tipoServicioActual === "DESTINO_TURISTICO") ep = "recreacion/";
    else if (tipoServicioActual === "GUIA") ep = "guias/";

    try {
        const res = await fetch(`${API_URL}/servicios/${ep}`); const data = await res.json();
        sel.innerHTML = "<option value=''>-- Selecciona Opción --</option>"; 
        let din = "";

        if (tipoServicioActual === "HOSPEDAJE") {
            const hs = data.find(x => x.id_servicio === id_servicio);
            if(hs) hs.habitaciones_disponibles.forEach(h => sel.innerHTML += `<option value="${h.id_hosp}">${h.nom_unidad} ($${h.vlr_noche})</option>`);
            din = `<label style="font-weight:bold; color:#334155;">Personas (Huéspedes):</label><br><input type="number" id="modPer" value="1" min="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:6px; margin-bottom:16px;"><br>
                   <label style="font-weight:bold; color:#334155;">Cantidad de Noches:</label><br><input type="number" id="modCant" value="1" min="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:6px; margin-bottom:16px;">`;
        } else if (tipoServicioActual === "GASTRONOMIA") {
            const rs = data.find(x => x.id_servicio === id_servicio);
            if(rs) rs.menu_disponible.forEach(m => sel.innerHTML += `<option value="${m.id_gast}">${m.nom_platillo_menu} ($${m.vlr_estimado})</option>`);
            din = `<label style="font-weight:bold; color:#334155;">Platos / Porciones:</label><br><input type="number" id="modCant" value="1" min="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:6px; margin-bottom:16px;">`;
        } else {
            const ts = data.find(x => x.servicio_base.id_servicio === id_servicio);
            if(ts) {
                const d = ts.detalle; const id = d.id_trans || d.id_rec || d.id_guia;
                const nom = d.tipo_vehiculo || d.nom_actividad || d.nombre_tour;
                const precio = d.tarifa_base || d.vlr_persona || d.vlr_tour;
                sel.innerHTML += `<option value="${id}">${nom} ($${precio})</option>`;
            }
            din = `<label style="font-weight:bold; color:#334155;">Cantidad (Personas/Pasajeros):</label><br><input type="number" id="modCant" value="1" min="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:6px; margin-bottom:16px;">`;
        }
        document.getElementById("modalInputsDinamicos").innerHTML = din;
        document.getElementById("modalFecha").value = planActual.fecha_inicio;
        document.getElementById("modalFecha").min = planActual.fecha_inicio;
        document.getElementById("modalFecha").max = planActual.fecha_fin;
        document.getElementById("modalSubservicios").style.display = "flex";
    } catch (e) { sel.innerHTML = "<option value=''>Error cargando opciones.</option>"; }
}

function cerrarModal() { document.getElementById("modalSubservicios").style.display = "none"; }

async function procesarFormularioItem(e) {
    e.preventDefault();
    const sel = document.getElementById("modalSubSelect");
    if (!sel.value) return;

    let cant = parseInt(document.getElementById("modCant").value); let obsAdic = "";
    if (tipoServicioActual === "HOSPEDAJE") obsAdic = `| Habitación para ${document.getElementById("modPer").value} personas por ${cant} noches.`;
    else obsAdic = `| Cant: ${cant}`;

    const payload = {
        id_servicio: servicioSeleccionadoModal.id_servicio, tipo_item: tipoServicioActual, 
        id_item_especifico: parseInt(sel.value), cantidad: cant,
        fecha_servicio: document.getElementById("modalFecha").value, 
        observaciones: `${servicioSeleccionadoModal.nombre} - ${sel.options[sel.selectedIndex].text.split('($')[0].trim()} ${obsAdic}`
    };
    enviarItem(payload);
}

function actualizarMapaEnVivo() {
    if (!planActual.id_ubicacion_origen || !planActual.id_ubicacion_destino) {
        document.getElementById("infoRutaCalculada").innerHTML = "⚠️ Tu plan de viaje no tiene Origen y Destino configurados. Ve a 'Mis Viajes Guardados', pulsa en '📍 Origen/Destino' en este plan para guardarlos y vuelve a intentar.";
        return;
    }

    const ori = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_origen); 
    const des = ubicacionesList.find(u => u.id_ubi == planActual.id_ubicacion_destino);
    if(!ori || !des) return;

    const mapContainer = document.getElementById("mapaCrearPlan");
    if (mapaCrearPlanInstance) { mapaCrearPlanInstance.remove(); } 
    const parent = mapContainer.parentNode; parent.removeChild(mapContainer);
    
    const newMapDiv = document.createElement("div");
    newMapDiv.id = "mapaCrearPlan"; newMapDiv.style.height = "300px"; newMapDiv.style.width = "100%"; newMapDiv.style.marginTop = "10px"; newMapDiv.style.border = "1px solid #ccc"; newMapDiv.style.borderRadius = "8px"; newMapDiv.style.zIndex = "1";
    parent.insertBefore(newMapDiv, document.getElementById("infoRutaCalculada"));

    mapaCrearPlanInstance = L.map("mapaCrearPlan").setView([4.6534, -74.1162], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapaCrearPlanInstance);

    document.getElementById("infoRutaCalculada").innerHTML = "⏳ Calculando ruta por carretera...";

    if(L.Routing) {
        L.Routing.control({
            waypoints: [ L.latLng(ori.latitud, ori.longitud), L.latLng(des.latitud, des.longitud) ],
            routeWhileDragging: false, addWaypoints: false, show: false,
            createMarker: function(i, wp) { return L.marker(wp.latLng).bindPopup(i===0 ? "Tu Origen: "+ori.direccion : "Tu Destino: "+des.direccion); },
            lineOptions: { styles: [{ color: '#2563eb', opacity: 0.9, weight: 5 }] }
        }).on('routesfound', function(e) {
            const dKm = Math.round(e.routes[0].summary.totalDistance / 1000); const tM = Math.round(e.routes[0].summary.totalTime / 60);
            document.getElementById("infoRutaCalculada").innerHTML = `🚗 Distancia Vía: <strong>${dKm} km</strong> | ⏱️ <strong>${Math.floor(tM/60)}h ${tM%60}min</strong> | ⛽ Gasolina Estimada: $${(dKm*450).toLocaleString()} COP`;
        }).addTo(mapaCrearPlanInstance);
    }
}

async function agregarCarroPropio() {
    if (!planActual.id_ubicacion_origen || !planActual.id_ubicacion_destino) {
        alert("No puedes agregar carro propio sin tener un origen y destino en el plan.");
        return;
    }
    const payload = { tipo_item: "TRANSPORTE_PROPIO", cantidad: 1, fecha_servicio: planActual.fecha_inicio, observaciones: "Viajar en Carro Propio" };
    enviarItem(payload);
}

async function enviarItem(payload) {
    try {
        const res = await fetch(`${API_URL}/planes-viaje/${planActual.id_plan_viaje}/items`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) { 
            cerrarModal(); 
            await cargarPlanExistente(planActual.id_plan_viaje);
            alert("¡Agregado al carrito de tu plan!"); 
        } else alert("⚠️ " + data.detail);
    } catch (error) { console.error(error); alert("Error de conexión"); }
}

function finalizarPlan() { window.location.href = "ver_planes.html"; }
function cerrarSesion() { localStorage.clear(); window.location.href = "../login.html"; }

function actualizarInfoBusqueda() {
    document.getElementById("infoBusqueda").innerHTML =
        `📍 <b>Origen:</b> ${origenResuelto.lugar.descripcion}<br>🏁 <b>Destino:</b> ${destinoResuelto.lugar.descripcion}`;
}

function mostrarAlternativas() {
    let html = "";
    [["origen", origenResuelto], ["destino", destinoResuelto]].forEach(([tipo, r]) => {
        const alts = (r && r.lugar.alternativas) || [];
        if (!alts.length) return;
        html += `<div style="margin-top:8px"><b>¿No es ese ${tipo}? Otras coincidencias:</b>` +
            alts.map((a, i) => `<div><a href="#" onclick="elegirAlternativa('${tipo}',${i});return false;">${a.descripcion}</a></div>`).join("") + `</div>`;
    });
    document.getElementById("alternativasBusqueda").innerHTML = html;
}

function elegirAlternativa(tipo, i) {
    const r = tipo === "origen" ? origenResuelto : destinoResuelto;
    const alts = r.lugar.alternativas;
    const nueva = alts[i];
    const resto = [r.lugar, ...alts.filter((_, j) => j !== i)].map(x => ({ ...x, alternativas: [] }));
    nueva.alternativas = resto;
    r.lugar = nueva;
    dibujarPreview(origenResuelto.lugar, destinoResuelto.lugar);
    actualizarInfoBusqueda();
    mostrarAlternativas();
}