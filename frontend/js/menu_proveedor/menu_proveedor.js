const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");
const userRole = Number(localStorage.getItem("userRole"));

const CATEGORIAS_MAP = {
  1: "Hospedaje",
  2: "Gastronomía",
  3: "Recreación",
  4: "Transporte",
  5: "Guía Turístico"
};

const IMG_FALLBACK = {
  1: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600",
  2: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600",
  3: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600",
  4: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600",
  5: "https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600"
};

// Estado cargado desde FastAPI
let perfilProveedor = null;
let servicios = [];
let reservas = [];
let pagosData = { resumen: {}, pagos: [] };
let resenas = [];
let documentos = [];
let notificaciones = [];

// Catálogos para formularios
let catTurismo = [];
let catGamas = [];
let catUbicaciones = [];

// ======================================================
// HELPER CENTRALIZADO DE FETCH CON JWT
// ======================================================
async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "../login.html";
      throw new Error("Sesión expirada.");
    }
    throw new Error(err.detail || "No tienes permisos para realizar esta acción.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Error al comunicarse con el servidor.");
  }
  return data;
}

function mostrarToast(mensaje) {
  const toast = document.createElement("div");
  toast.className = "toast-banner";
  toast.textContent = mensaje;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ======================================================
// INICIALIZACIÓN
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!token || userRole !== 3) {
    alert("Acceso exclusivo para proveedores autenticados.");
    window.location.href = "../login.html";
    return;
  }

  configurarEventosUI();
  await cargarDashboardCompleto();
});

function configurarEventosUI() {
  document.querySelectorAll(".nav-item[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => navegarA(btn.dataset.section));
  });

  document.getElementById("btnToggleMenu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("btnNotificaciones").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("notifDropdown").classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    document.getElementById("notifDropdown").classList.add("hidden");
  });

  document.getElementById("formServicio").addEventListener("submit", guardarServicioAPI);
  document.getElementById("formRespuestaResena").addEventListener("submit", enviarRespuestaResenaAPI);
  document.getElementById("formSubirDocumento").addEventListener("submit", subirDocumentoAPI);
}

async function cargarDashboardCompleto() {
  try {
    const [
      perfilRes,
      serviciosRes,
      reservasRes,
      pagosRes,
      resenasRes,
      docsRes,
      turismoRes,
      gamasRes,
      ubiRes
    ] = await Promise.all([
      apiFetch("/proveedores/mi-perfil"),
      apiFetch("/servicios/mis-servicios"),
      apiFetch("/proveedor/reservas/"),
      apiFetch("/proveedor/pagos/"),
      apiFetch("/resenas/mis-servicios"),
      apiFetch("/documentos/mis-documentos"),
      apiFetch("/tipos-turismo/"),
      apiFetch("/gamas/"),
      apiFetch("/ubicaciones/")
    ]);

    perfilProveedor = perfilRes;
    servicios = serviciosRes;
    reservas = reservasRes;
    pagosData = pagosRes;
    resenas = resenasRes;
    documentos = docsRes;
    catTurismo = turismoRes;
    catGamas = gamasRes;
    catUbicaciones = ubiRes;

    poblarSelectsFormulario();
    construirNotificaciones();
    renderizarTodo();
  } catch (error) {
    console.error("Error cargando dashboard:", error);
    mostrarToast(error.message);
  }
}

function renderizarTodo() {
  cargarCabeceraYPerfil();
  renderizarResumenKPIs();
  renderizarFinanzas();
  renderizarReservas();
  renderizarServicios();
  renderizarResenas();
  renderizarNotificaciones();
}

function formatoCOP(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-CO") + " COP";
}

function cerrarSesion() {
  localStorage.clear();
  window.location.href = "../login.html";
}

function navegarA(seccion) {
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.section === seccion);
  });
  document.querySelectorAll(".view-section").forEach((v) => {
    v.classList.toggle("active", v.id === `sec-${seccion}`);
  });
  document.getElementById("sidebar").classList.remove("open");

  const titulos = {
    resumen: ["Resumen General", "Monitorea tus ingresos, reservas activas y oferta turística."],
    finanzas: ["Finanzas y Liquidaciones", "Transparencia de pagos y comisiones retenidas."],
    reservas: ["Agenda y Reservas", "Fechas contratadas y gestión de clientes."],
    servicios: ["Mis Servicios", "Control en tiempo real de tarifas, disponibilidad y galería."],
    resenas: ["Reseñas y Reputación", "Comentarios de viajeros y respuestas oficiales."],
    perfil: ["Perfil y Documentos", "Cuenta bancaria y validación documental."]
  };
  document.getElementById("pageTitle").textContent = titulos[seccion][0];
  document.getElementById("pageSubtitle").textContent = titulos[seccion][1];
}

// ======================================================
// PERFIL Y NOTIFICACIONES DINÁMICAS
// ======================================================
function cargarCabeceraYPerfil() {
  if (!perfilProveedor) return;
  const nombre = `${perfilProveedor.nombre} ${perfilProveedor.apellido}`.trim();
  document.getElementById("sidebarRazonSocial").textContent = perfilProveedor.razon_social;
  document.getElementById("estadoProveedorSidebar").textContent = `Cuenta ${perfilProveedor.estado}`;
  document.getElementById("nitSidebar").textContent = `NIT: ${perfilProveedor.nit}`;
  document.getElementById("headerNombreUsuario").textContent = nombre;
  document.getElementById("avatarIniciales").textContent = nombre.substring(0, 2).toUpperCase();

  const tiposTexto = (perfilProveedor.tipos_servicio_autorizados || []).map((t) => t.nombre).join(", ") || "Ninguno";

  document.getElementById("perfilDatosEmpresa").innerHTML = `
    <div class="profile-row"><span>Razón Social</span><strong>${perfilProveedor.razon_social}</strong></div>
    <div class="profile-row"><span>NIT</span><strong>${perfilProveedor.nit}</strong></div>
    <div class="profile-row"><span>Contacto</span><strong>${perfilProveedor.telefono_contacto} | ${perfilProveedor.email}</strong></div>
    <div class="profile-row"><span>Banco Destino</span><strong>${perfilProveedor.banco}</strong></div>
    <div class="profile-row"><span>Cuenta Bancaria</span><strong>${perfilProveedor.cuenta_bancaria}</strong></div>
    <div class="profile-row"><span>Categorías Autorizadas</span><strong>${tiposTexto}</strong></div>
  `;

  document.getElementById("listaDocumentos").innerHTML =
    documentos.length === 0
      ? "<p style='font-size:13px; color:#64748b;'>Aún no has cargado documentos legales.</p>"
      : documentos
          .map(
            (d) => `
      <div class="mini-item">
        <div>
          <strong>${d.tipo_doc}</strong>
          <small>${d.nom_archivo}</small>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <a href="${API_URL}${d.ruta_archivo}" target="_blank" class="btn-link">Ver</a>
          <span class="badge ${d.estado === "APROBADO" ? "badge-green" : d.estado === "RECHAZADO" ? "badge-red" : "badge-amber"}">${d.estado}</span>
        </div>
      </div>`
          )
          .join("");
}

function construirNotificaciones() {
  notificaciones = [];
  const resPendientes = reservas.filter((r) => r.estado === "RESERVADO");
  if (resPendientes.length > 0) {
    notificaciones.push({ texto: `Tienes ${resPendientes.length} reserva(s) activas por atender.` });
  }
  const transferidos = (pagosData.pagos || []).filter((p) => p.estado_transferencia === "TRANSFERIDO");
  if (transferidos.length > 0) {
    notificaciones.push({ texto: `${transferidos.length} liquidación(es) ya fueron transferidas a tu cuenta.` });
  }
  const sinResp = resenas.filter((r) => !r.respuesta_proveedor);
  if (sinResp.length > 0) {
    notificaciones.push({ texto: `${sinResp.length} reseña(s) de clientes esperan tu respuesta.` });
  }
}

function renderizarNotificaciones() {
  document.getElementById("notifCount").textContent = notificaciones.length;
  document.getElementById("notifList").innerHTML =
    notificaciones.length === 0
      ? "<div class='notif-item'>Sin notificaciones pendientes.</div>"
      : notificaciones.map((n) => `<div class="notif-item">${n.texto}</div>`).join("");
}

// ======================================================
// 1. RESUMEN Y KPIs
// ======================================================
function renderizarResumenKPIs() {
  const res = pagosData.resumen || {};
  const activas = reservas.filter((r) => r.estado === "RESERVADO").length;
  const finalizadas = reservas.filter((r) => r.estado === "FINALIZADO").length;
  const promedio = resenas.length
    ? (resenas.reduce((acc, r) => acc + Number(r.clf_general), 0) / resenas.length).toFixed(1)
    : "0.0";
  const disponibles = servicios.filter((s) => s.disponibilidad).length;

  document.getElementById("kpiIngresos").textContent = formatoCOP(res.ingresos_totales);
  document.getElementById("kpiPendiente").textContent = `Por liquidar: ${formatoCOP(res.total_pendiente)}`;
  document.getElementById("kpiReservasActivas").textContent = activas;
  document.getElementById("kpiReservasFinalizadas").textContent = `${finalizadas} finalizadas`;
  document.getElementById("kpiCalificacion").textContent = `${promedio} / 5.0`;
  document.getElementById("kpiTotalResenas").textContent = `Basado en ${resenas.length} reseña(s)`;
  document.getElementById("kpiTotalServicios").textContent = servicios.length;
  document.getElementById("kpiServiciosDisponibles").textContent = `${disponibles} disponibles ahora`;

  document.getElementById("badgeReservasPendientes").textContent = activas;
  document.getElementById("badgeResenasSinResponder").textContent = resenas.filter((r) => !r.respuesta_proveedor).length;

  const prox = reservas.filter((r) => r.estado === "RESERVADO").slice(0, 3);
  document.getElementById("resumenProximasReservas").innerHTML =
    prox.length === 0
      ? "<p style='font-size:13px;color:#64748b;'>No hay reservas activas.</p>"
      : prox
          .map(
            (r) => `
      <div class="mini-item">
        <div>
          <strong>${r.servicio_nombre}</strong>
          <small>${r.cliente_nombre} • ${r.fecha_servicio} (${r.cantidad} ud.)</small>
        </div>
        <span class="badge badge-blue">${r.estado}</span>
      </div>`
          )
          .join("");

  const ultPagos = (pagosData.pagos || []).slice(0, 3);
  document.getElementById("resumenUltimosPagos").innerHTML =
    ultPagos.length === 0
      ? "<p style='font-size:13px;color:#64748b;'>Aún no hay liquidaciones registradas.</p>"
      : ultPagos
          .map(
            (p) => `
      <div class="mini-item">
        <div>
          <strong>${p.codigo_plan} - ${p.nombre_plan}</strong>
          <small>Ref: ${p.referencia_transaccion}</small>
        </div>
        <div style="text-align:right">
          <strong>${formatoCOP(p.monto_neto_proveedor)}</strong>
          <span class="badge ${p.estado_transferencia === "TRANSFERIDO" ? "badge-green" : "badge-amber"}">${p.estado_transferencia}</span>
        </div>
      </div>`
          )
          .join("");
}

// ======================================================
// 2. FINANZAS (pago_proveedor)
// ======================================================
function renderizarFinanzas() {
  const res = pagosData.resumen || {};
  document.getElementById("finTransferido").textContent = formatoCOP(res.total_transferido);
  document.getElementById("finPendiente").textContent = formatoCOP(res.total_pendiente);
  document.getElementById("finComisiones").textContent = formatoCOP(res.total_comisiones);

  const filtro = document.getElementById("filtroEstadoPago").value;
  const lista = (pagosData.pagos || []).filter((p) => filtro === "TODOS" || p.estado_transferencia === filtro);

  document.getElementById("tablaPagosBody").innerHTML =
    lista.length === 0
      ? `<tr><td colspan="7" style="text-align:center;color:#64748b;">No hay liquidaciones en este estado.</td></tr>`
      : lista
          .map(
            (p) => `
      <tr>
        <td><strong>#${p.id_pago_prov}</strong><br><small>${p.referencia_transaccion}</small></td>
        <td><strong>${p.codigo_plan}</strong><br><small>${p.nombre_plan}</small></td>
        <td>${formatoCOP(p.monto_subtotal)}</td>
        <td class="text-red">-${formatoCOP(p.comision_plataforma)}</td>
        <td><strong>${formatoCOP(p.monto_neto_proveedor)}</strong></td>
        <td><span class="badge ${p.estado_transferencia === "TRANSFERIDO" ? "badge-green" : p.estado_transferencia === "PENDIENTE" ? "badge-amber" : "badge-red"}">${p.estado_transferencia}</span></td>
        <td><button class="btn-outline btn-sm" onclick="verDetallePago(${p.id_pago_prov})">Ver detalle</button></td>
      </tr>`
          )
          .join("");
}

function verDetallePago(idPagoProv) {
  const p = (pagosData.pagos || []).find((x) => x.id_pago_prov === idPagoProv);
  if (!p) return;
  document.getElementById("modalPagoContenido").innerHTML = `
    <div class="profile-data-list">
      <div class="profile-row"><span>Referencia</span><strong>${p.referencia_transaccion}</strong></div>
      <div class="profile-row"><span>Plan</span><strong>${p.codigo_plan} (${p.nombre_plan})</strong></div>
      <div class="profile-row"><span>Subtotal</span><strong>${formatoCOP(p.monto_subtotal)}</strong></div>
      <div class="profile-row"><span>Comisión PAT</span><strong class="text-red">-${formatoCOP(p.comision_plataforma)}</strong></div>
      <div class="profile-row"><span>Neto a recibir</span><strong class="text-green">${formatoCOP(p.monto_neto_proveedor)}</strong></div>
      <div class="profile-row"><span>Estado</span><strong>${p.estado_transferencia}</strong></div>
      <div class="profile-row"><span>Cuenta destino</span><strong>${perfilProveedor?.banco || ""} - ${perfilProveedor?.cuenta_bancaria || ""}</strong></div>
    </div>`;
  document.getElementById("modalPago").classList.remove("hidden");
}

function exportarPagosCSV() {
  const filas = ["ID,Referencia,Plan,Subtotal,Comision,Neto,Estado"];
  (pagosData.pagos || []).forEach((p) => {
    filas.push(`${p.id_pago_prov},"${p.referencia_transaccion}","${p.nombre_plan}",${p.monto_subtotal},${p.comision_plataforma},${p.monto_neto_proveedor},${p.estado_transferencia}`);
  });
  const blob = new Blob([filas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "liquidaciones_pat.csv";
  link.click();
}

// ======================================================
// 3. RESERVAS
// ======================================================
function renderizarReservas() {
  const fecha = document.getElementById("filtroFechaReserva").value;
  const estado = document.getElementById("filtroEstadoReserva").value;

  const lista = reservas.filter((r) => {
    const okEstado = estado === "TODOS" || r.estado === estado;
    const okFecha = !fecha || r.fecha_servicio === fecha;
    return okEstado && okFecha;
  });

  document.getElementById("listaReservas").innerHTML =
    lista.length === 0
      ? `<div class="panel-card">No hay reservas que coincidan con el filtro.</div>`
      : lista
          .map(
            (r) => `
      <article class="panel-card booking-card">
        <div class="booking-main">
          <div class="booking-top">
            <span class="badge ${r.estado === "RESERVADO" ? "badge-blue" : r.estado === "FINALIZADO" ? "badge-green" : "badge-red"}">${r.estado}</span>
            <span class="booking-code">${r.codigo_plan} • ${r.nombre_plan}</span>
          </div>
          <h3>${r.servicio_nombre}</h3>
          <p class="booking-meta">📅 ${r.fecha_servicio} &nbsp;|&nbsp; 📦 Cant: ${r.cantidad} &nbsp;|&nbsp; 💰 ${formatoCOP(r.subtotal_calculado)}</p>
          <p class="booking-client">👤 <strong>${r.cliente_nombre}</strong> (${r.cliente_email})</p>
          <p class="booking-note">📝 ${r.observaciones || "Sin observaciones"}</p>
        </div>
        <div class="booking-actions">
          ${r.estado === "RESERVADO" ? `
            <button class="btn-primary btn-sm" onclick="cambiarEstadoReservaAPI(${r.id_plan_viaje}, 'FINALIZADO')">✓ Finalizar</button>
            <button class="btn-danger-outline btn-sm" onclick="cambiarEstadoReservaAPI(${r.id_plan_viaje}, 'CANCELADO')">✕ Cancelar</button>
          ` : ""}
        </div>
      </article>`
          )
          .join("");
}

function limpiarFiltrosReserva() {
  document.getElementById("filtroFechaReserva").value = "";
  document.getElementById("filtroEstadoReserva").value = "TODOS";
  renderizarReservas();
}

async function cambiarEstadoReservaAPI(idPlanViaje, nuevoEstado) {
  try {
    await apiFetch(`/proveedor/reservas/${idPlanViaje}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado: nuevoEstado })
    });
    mostrarToast(`Reserva marcada como ${nuevoEstado}.`);
    reservas = await apiFetch("/proveedor/reservas/");
    construirNotificaciones();
    renderizarResumenKPIs();
    renderizarReservas();
    renderizarNotificaciones();
  } catch (error) {
    alert(error.message);
  }
}

// ======================================================
// 4. SERVICIOS Y SUB-ÍTEMS + IMÁGENES
// ======================================================
function obtenerResumenPrecio(s) {
  if (s.id_tp_serv === 1 && s.sub_items?.length) {
    return `${formatoCOP(s.sub_items[0].vlr_noche)} / noche (${s.sub_items.length} hab.)`;
  }
  if (s.id_tp_serv === 2 && s.sub_items?.length) {
    return `Desde ${formatoCOP(s.sub_items[0].vlr_estimado)} (${s.sub_items.length} platos)`;
  }
  if (s.id_tp_serv === 3 && s.detalle) return `${formatoCOP(s.detalle.vlr_persona)} / pers.`;
  if (s.id_tp_serv === 4 && s.detalle) return `${formatoCOP(s.detalle.tarifa_base)} tarifa base`;
  if (s.id_tp_serv === 5 && s.detalle) return `${formatoCOP(s.detalle.vlr_tour)} / tour`;
  return "Sin tarifa registrada";
}

function renderizarServicios() {
  const cat = document.getElementById("filtroCategoriaServicio").value;
  const lista = servicios.filter((s) => cat === "TODOS" || String(s.id_tp_serv) === cat);

  document.getElementById("gridServicios").innerHTML =
    lista.length === 0
      ? `<div class="panel-card">Aún no tienes servicios registrados en esta categoría.</div>`
      : lista
          .map((s) => {
            const img = s.imagen_principal ? (s.imagen_principal.startsWith("http") ? s.imagen_principal : API_URL + s.imagen_principal) : IMG_FALLBACK[s.id_tp_serv];
            return `
        <article class="service-card">
          <div class="service-img-box">
            <img src="${img}" alt="${s.nombre}" onerror="this.src='${IMG_FALLBACK[s.id_tp_serv]}'" />
            <span class="service-cat-badge">${s.tipo_servicio_nombre}</span>
          </div>
          <div class="service-body">
            <div class="service-title-row">
              <h3>${s.nombre}</h3>
              <label class="switch" title="Disponibilidad en tiempo real">
                <input type="checkbox" ${s.disponibilidad ? "checked" : ""} onchange="toggleDisponibilidadAPI(${s.id_servicio}, this.checked)" />
                <span class="slider"></span>
              </label>
            </div>
            <p class="service-loc">📍 ${s.ciudad_nombre} • ${s.gama_nombre}</p>
            <p class="service-price">${obtenerResumenPrecio(s)}</p>
            <div class="service-footer">
              <span class="badge ${s.disponibilidad ? "badge-green" : "badge-gray"}">${s.disponibilidad ? "Disponible" : "No disponible"}</span>
              <div style="display:flex; gap:6px;">
                <button class="btn-outline btn-sm" onclick="abrirModalServicio(${s.id_servicio})">✏️ Gestionar</button>
                <button class="btn-danger-outline btn-sm" onclick="eliminarServicioAPI(${s.id_servicio})">🗑️</button>
              </div>
            </div>
          </div>
        </article>`;
          })
          .join("");
}

async function toggleDisponibilidadAPI(idServicio, disponible) {
  try {
    await apiFetch(`/servicios/${idServicio}/disponibilidad`, {
      method: "PATCH",
      body: JSON.stringify({ disponibilidad: disponible })
    });
    servicios = await apiFetch("/servicios/mis-servicios");
    renderizarServicios();
    renderizarResumenKPIs();
    mostrarToast("Disponibilidad actualizada en MySQL.");
  } catch (error) {
    alert(error.message);
    renderizarServicios();
  }
}

function poblarSelectsFormulario() {
  const autorizadas = perfilProveedor?.tipos_servicio_autorizados || [];
  document.getElementById("srvCategoria").innerHTML = autorizadas.length
    ? autorizadas.map((t) => `<option value="${t.id_tp_serv}">${t.nombre}</option>`).join("")
    : Object.entries(CATEGORIAS_MAP).map(([id, n]) => `<option value="${id}">${n}</option>`).join("");

  document.getElementById("srvTurismo").innerHTML = catTurismo
    .map((t) => `<option value="${t.id_tp_turi}">${t.nombre}</option>`)
    .join("");
  document.getElementById("srvGama").innerHTML = catGamas
    .map((g) => `<option value="${g.id_gama}">${g.nombre}</option>`)
    .join("");
  document.getElementById("srvUbicacion").innerHTML = catUbicaciones
    .map((u) => `<option value="${u.id_ubi}">${u.direccion} (${u.barrio || ""})</option>`)
    .join("");
}

function actualizarCamposCategoria(detalle = null) {
  const cat = Number(document.getElementById("srvCategoria").value);
  const contUnico = document.getElementById("camposCategoriaUnica");
  const contSub = document.getElementById("bloqueSubitems");
  const idExistente = document.getElementById("srvId").value;

  if (cat === 1 || cat === 2) {
    contUnico.innerHTML = `<p style="font-size:12px;color:#64748b;">Guarda primero el servicio base y luego administra ${cat === 1 ? "sus habitaciones" : "sus platos del menú"} aquí abajo.</p>`;
    if (idExistente) {
      contSub.classList.remove("hidden");
      document.getElementById("tituloSubitems").textContent = cat === 1 ? "Habitaciones registradas" : "Platos del menú";
      document.getElementById("tituloAgregarSubitem").textContent = cat === 1 ? "+ Agregar habitación" : "+ Agregar plato";
    } else {
      contSub.classList.add("hidden");
    }
  } else {
    contSub.classList.add("hidden");
    if (cat === 3) {
      contUnico.innerHTML = `
        <div class="form-row">
          <div class="form-group"><label>Nombre actividad</label><input type="text" id="detNombre" value="${detalle?.nom_actividad || ""}" required /></div>
          <div class="form-group"><label>Valor por persona (COP)</label><input type="number" id="detPrecio" value="${detalle?.vlr_persona || 0}" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Duración</label><input type="text" id="detDuracion" value="${detalle?.duracion || "2 horas"}" /></div>
          <div class="form-group"><label>Capacidad</label><input type="number" id="detCapacidad" value="${detalle?.capacidad || 10}" /></div>
        </div>`;
    } else if (cat === 4) {
      contUnico.innerHTML = `
        <div class="form-row">
          <div class="form-group"><label>Tipo de vehículo</label><input type="text" id="detVehiculo" value="${detalle?.tipo_vehiculo || ""}" required /></div>
          <div class="form-group"><label>Tarifa base (COP)</label><input type="number" id="detTarifa" value="${detalle?.tarifa_base || 0}" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Capacidad pasajeros</label><input type="number" id="detCapacidad" value="${detalle?.capacidad_pasajeros || 4}" required /></div>
          <div class="form-group"><label>Valor por Km (COP)</label><input type="number" id="detVlrKm" value="${detalle?.vlr_km || 2000}" required /></div>
        </div>`;
    } else if (cat === 5) {
      contUnico.innerHTML = `
        <div class="form-row">
          <div class="form-group"><label>Nombre del tour</label><input type="text" id="detNombre" value="${detalle?.nombre_tour || ""}" required /></div>
          <div class="form-group"><label>Valor tour (COP)</label><input type="number" id="detPrecio" value="${detalle?.vlr_tour || 0}" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Duración (horas)</label><input type="number" id="detDuracion" value="${detalle?.duracion_horas || 4}" required /></div>
          <div class="form-group"><label>Capacidad grupo</label><input type="number" id="detCapacidad" value="${detalle?.capacidad_grupo || 8}" required /></div>
        </div>`;
    }
  }
}

function abrirModalServicio(idServicio = null) {
  document.getElementById("formServicio").reset();
  document.getElementById("srvId").value = idServicio || "";
  document.getElementById("galeriaModal").innerHTML = "";
  document.getElementById("listaSubitemsModal").innerHTML = "";

  const selectCat = document.getElementById("srvCategoria");
  if (idServicio) {
    const s = servicios.find((x) => x.id_servicio === idServicio);
    if (!s) return;
    document.getElementById("modalServicioTitulo").textContent = `Gestionar: ${s.nombre}`;
    selectCat.value = s.id_tp_serv;
    selectCat.disabled = true;
    document.getElementById("srvTurismo").value = s.id_tp_turi;
    document.getElementById("srvGama").value = s.id_gama;
    document.getElementById("srvUbicacion").value = s.id_ubi;
    document.getElementById("srvNombre").value = s.nombre;
    document.getElementById("srvDescripcion").value = s.descripcion;

    actualizarCamposCategoria(s.detalle);
    renderizarSubitemsModal(s);
    renderizarGaleriaModal(s);
  } else {
    document.getElementById("modalServicioTitulo").textContent = "Nuevo Servicio";
    selectCat.disabled = false;
    actualizarCamposCategoria();
  }

  document.getElementById("modalServicio").classList.remove("hidden");
}

function renderizarSubitemsModal(s) {
  const cont = document.getElementById("listaSubitemsModal");
  if (s.id_tp_serv === 1) {
    cont.innerHTML = (s.sub_items || [])
      .map(
        (h) => `
      <div class="subitem-row">
        <span><strong>${h.nom_unidad}</strong> (${h.capacidad_personas} pers.) - ${formatoCOP(h.vlr_noche)}</span>
        <button type="button" class="btn-danger-outline btn-sm" onclick="eliminarSubitemAPI(1, ${h.id_hosp})">✕</button>
      </div>`
      )
      .join("");
  } else if (s.id_tp_serv === 2) {
    cont.innerHTML = (s.sub_items || [])
      .map(
        (p) => `
      <div class="subitem-row">
        <span><strong>${p.nom_platillo_menu}</strong> (${p.porciones} porc.) - ${formatoCOP(p.vlr_estimado)}</span>
        <button type="button" class="btn-danger-outline btn-sm" onclick="eliminarSubitemAPI(2, ${p.id_gast})">✕</button>
      </div>`
      )
      .join("");
  }
}

function renderizarGaleriaModal(s) {
  document.getElementById("galeriaModal").innerHTML = (s.imagenes || [])
    .map(
      (img) => `
    <div class="gallery-thumb">
      <img src="${API_URL}${img.ruta_url}" alt="Imagen servicio" />
      <button type="button" onclick="eliminarImagenAPI(${img.id_img})">✕</button>
    </div>`
    )
    .join("");
}

async function guardarServicioAPI(e) {
  e.preventDefault();
  const idExistente = document.getElementById("srvId").value;
  const cat = Number(document.getElementById("srvCategoria").value);

  const basePayload = {
    nombre: document.getElementById("srvNombre").value.trim(),
    descripcion: document.getElementById("srvDescripcion").value.trim(),
    id_tp_turi: Number(document.getElementById("srvTurismo").value),
    id_gama: Number(document.getElementById("srvGama").value),
    id_ubi: Number(document.getElementById("srvUbicacion").value)
  };

  try {
    let idServicioFinal = idExistente ? Number(idExistente) : null;

    if (cat === 1) {
      const url = idExistente ? `/servicios/hospedajes/base/${idExistente}` : "/servicios/hospedajes/base";
      const res = await apiFetch(url, { method: idExistente ? "PUT" : "POST", body: JSON.stringify(basePayload) });
      if (!idServicioFinal) idServicioFinal = res.id_servicio;
    } else if (cat === 2) {
      const url = idExistente ? `/servicios/gastronomia/restaurantes/base/${idExistente}` : "/servicios/gastronomia/restaurantes/base";
      const res = await apiFetch(url, { method: idExistente ? "PUT" : "POST", body: JSON.stringify(basePayload) });
      if (!idServicioFinal) idServicioFinal = res.id_servicio;
    } else if (cat === 3) {
      const payload = {
        ...basePayload,
        nom_actividad: document.getElementById("detNombre").value.trim(),
        vlr_persona: Number(document.getElementById("detPrecio").value),
        duracion: document.getElementById("detDuracion").value,
        capacidad: Number(document.getElementById("detCapacidad").value),
        es_evento_local: false
      };
      const url = idExistente ? `/servicios/recreacion/${idExistente}` : "/servicios/recreacion/";
      const res = await apiFetch(url, { method: idExistente ? "PUT" : "POST", body: JSON.stringify(payload) });
      if (!idServicioFinal) idServicioFinal = res.id_servicio;
    } else if (cat === 4) {
      const payload = {
        ...basePayload,
        tipo_vehiculo: document.getElementById("detVehiculo").value.trim(),
        tarifa_base: Number(document.getElementById("detTarifa").value),
        capacidad_pasajeros: Number(document.getElementById("detCapacidad").value),
        vlr_km: Number(document.getElementById("detVlrKm").value)
      };
      const url = idExistente ? `/servicios/transporte/${idExistente}` : "/servicios/transporte/";
      const res = await apiFetch(url, { method: idExistente ? "PUT" : "POST", body: JSON.stringify(payload) });
      if (!idServicioFinal) idServicioFinal = res.id_servicio;
    } else if (cat === 5) {
      const payload = {
        ...basePayload,
        nombre_tour: document.getElementById("detNombre").value.trim(),
        vlr_tour: Number(document.getElementById("detPrecio").value),
        duracion_horas: Number(document.getElementById("detDuracion").value),
        capacidad_grupo: Number(document.getElementById("detCapacidad").value),
        dificultad: "MEDIA"
      };
      const url = idExistente ? `/servicios/guias/${idExistente}` : "/servicios/guias/";
      const res = await apiFetch(url, { method: idExistente ? "PUT" : "POST", body: JSON.stringify(payload) });
      if (!idServicioFinal) idServicioFinal = res.id_servicio;
    }

    // Subir imagen si el proveedor seleccionó archivo
    const fileInput = document.getElementById("srvImagenFile");
    if (fileInput.files.length > 0 && idServicioFinal) {
      const fd = new FormData();
      fd.append("es_principal", document.getElementById("srvImagenPrincipal").checked);
      fd.append("archivo", fileInput.files[0]);
      await apiFetch(`/servicio-imagenes/${idServicioFinal}`, { method: "POST", body: fd });
    }

    servicios = await apiFetch("/servicios/mis-servicios");
    renderizarServicios();
    renderizarResumenKPIs();
    cerrarModal("modalServicio");
    mostrarToast("Servicio guardado en MySQL.");
  } catch (error) {
    alert(error.message);
  }
}

async function agregarSubitemAPI() {
  const idServicio = Number(document.getElementById("srvId").value);
  const cat = Number(document.getElementById("srvCategoria").value);
  const nombre = document.getElementById("subNombre").value.trim();
  const precio = Number(document.getElementById("subPrecio").value);
  const capacidad = Number(document.getElementById("subCapacidad").value || 1);
  const horario = document.getElementById("subHorario").value.trim() || "Todo el día";

  if (!idServicio || !nombre || !precio) {
    alert("Completa nombre y precio del ítem.");
    return;
  }

  try {
    if (cat === 1) {
      await apiFetch(`/servicios/hospedajes/${idServicio}/espacios`, {
        method: "POST",
        body: JSON.stringify({
          nom_unidad: nombre,
          capacidad_personas: capacidad,
          vlr_noche: precio,
          horario_checkin: horario,
          horario_checkout: "12:00"
        })
      });
    } else if (cat === 2) {
      await apiFetch(`/servicios/gastronomia/restaurantes/${idServicio}/platos`, {
        method: "POST",
        body: JSON.stringify({
          nom_platillo_menu: nombre,
          porciones: capacidad,
          vlr_estimado: precio,
          horario_atencion: horario
        })
      });
    }

    servicios = await apiFetch("/servicios/mis-servicios");
    const actualizado = servicios.find((x) => x.id_servicio === idServicio);
    if (actualizado) renderizarSubitemsModal(actualizado);
    renderizarServicios();
    document.getElementById("subNombre").value = "";
    document.getElementById("subPrecio").value = "";
    mostrarToast("Ítem agregado.");
  } catch (error) {
    alert(error.message);
  }
}

async function eliminarSubitemAPI(cat, idItem) {
  const url = cat === 1 ? `/servicios/hospedajes/espacios/${idItem}` : `/servicios/gastronomia/platos/${idItem}`;
  try {
    await apiFetch(url, { method: "DELETE" });
    const idServicio = Number(document.getElementById("srvId").value);
    servicios = await apiFetch("/servicios/mis-servicios");
    const actualizado = servicios.find((x) => x.id_servicio === idServicio);
    if (actualizado) renderizarSubitemsModal(actualizado);
    renderizarServicios();
    mostrarToast("Ítem eliminado.");
  } catch (error) {
    alert(error.message);
  }
}

async function eliminarImagenAPI(idImg) {
  try {
    await apiFetch(`/servicio-imagenes/${idImg}`, { method: "DELETE" });
    const idServicio = Number(document.getElementById("srvId").value);
    servicios = await apiFetch("/servicios/mis-servicios");
    const actualizado = servicios.find((x) => x.id_servicio === idServicio);
    if (actualizado) renderizarGaleriaModal(actualizado);
    renderizarServicios();
    mostrarToast("Imagen eliminada.");
  } catch (error) {
    alert(error.message);
  }
}

async function eliminarServicioAPI(idServicio) {
  const s = servicios.find((x) => x.id_servicio === idServicio);
  if (!s || !confirm(`¿Desactivar "${s.nombre}"?`)) return;

  const rutas = {
    1: `/servicios/hospedajes/base/${idServicio}`,
    2: `/servicios/gastronomia/restaurantes/base/${idServicio}`,
    3: `/servicios/recreacion/${idServicio}`,
    4: `/servicios/transporte/${idServicio}`,
    5: `/servicios/guias/${idServicio}`
  };
  try {
    await apiFetch(rutas[s.id_tp_serv], { method: "DELETE" });
    servicios = await apiFetch("/servicios/mis-servicios");
    renderizarServicios();
    renderizarResumenKPIs();
    mostrarToast("Servicio eliminado.");
  } catch (error) {
    alert(error.message);
  }
}

// ======================================================
// 5. RESEÑAS
// ======================================================
function renderizarResenas() {
  document.getElementById("listaResenas").innerHTML =
    resenas.length === 0
      ? `<div class="panel-card">Aún no tienes reseñas registradas.</div>`
      : resenas
          .map(
            (r) => `
      <article class="panel-card review-card">
        <div class="review-header">
          <div>
            <strong>${r.cliente_nombre}</strong>
            <span class="review-service"> • ${r.servicio_nombre}</span>
          </div>
          <span class="rating-pill">★ ${Number(r.clf_general).toFixed(1)}</span>
        </div>
        <p class="review-comment">"${r.comentario || "Sin comentario."}"</p>
        ${
          r.respuesta_proveedor
            ? `<div class="review-reply"><strong>Tu respuesta:</strong> ${r.respuesta_proveedor}</div>`
            : `<div style="margin-top:12px;"><button class="btn-outline btn-sm" onclick="abrirModalResena(${r.id_resena})">💬 Responder</button></div>`
        }
      </article>`
          )
          .join("");
}

function abrirModalResena(idResena) {
  const r = resenas.find((x) => x.id_resena === idResena);
  if (!r) return;
  document.getElementById("resenaIdResponder").value = r.id_resena;
  document.getElementById("resenaTextoOriginal").textContent = `"${r.comentario || ""}" — ${r.cliente_nombre}`;
  document.getElementById("textoRespuesta").value = "";
  document.getElementById("modalResena").classList.remove("hidden");
}

async function enviarRespuestaResenaAPI(e) {
  e.preventDefault();
  const idResena = Number(document.getElementById("resenaIdResponder").value);
  const respuesta = document.getElementById("textoRespuesta").value.trim();

  try {
    await apiFetch(`/resenas/${idResena}/responder`, {
      method: "PATCH",
      body: JSON.stringify({ respuesta_proveedor: respuesta })
    });
    resenas = await apiFetch("/resenas/mis-servicios");
    construirNotificaciones();
    renderizarResenas();
    renderizarResumenKPIs();
    renderizarNotificaciones();
    cerrarModal("modalResena");
    mostrarToast("Respuesta publicada.");
  } catch (error) {
    alert(error.message);
  }
}

// ======================================================
// 6. SUBIR DOCUMENTOS LEGALES
// ======================================================
async function subirDocumentoAPI(e) {
  e.preventDefault();
  const archivoInput = document.getElementById("docArchivo");
  if (!archivoInput.files.length) return;

  const fd = new FormData();
  fd.append("tipo_doc", document.getElementById("docTipo").value);
  fd.append("archivo", archivoInput.files[0]);

  try {
    await apiFetch("/documentos/", { method: "POST", body: fd });
    documentos = await apiFetch("/documentos/mis-documentos");
    cargarCabeceraYPerfil();
    e.target.reset();
    mostrarToast("Documento subido exitosamente.");
  } catch (error) {
    alert(error.message);
  }
}

function cerrarModal(idModal) {
  document.getElementById(idModal).classList.add("hidden");
}