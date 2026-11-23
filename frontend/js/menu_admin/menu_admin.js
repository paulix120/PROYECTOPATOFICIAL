const API_URL = "http://127.0.0.1:8000";

const NOMBRES_ROL = {
    1: "Viajero",
    2: "Administrador",
    3: "Proveedor",
    4: "Guía"
};

const TITULOS_SECCION = {
    resumen: "Resumen general",
    usuarios: "Usuarios y roles",
    proveedores: "Solicitudes y proveedores",
    normativa: "Políticas y condiciones",
    rutas: "Ubicaciones y trayectos"
};

let cachePoliticas = [];
let cacheUbicaciones = [];
let cacheUsuarios = [];
let modalAction = null;

// ==========================================
// INICIO Y GUARDIA DE SESIÓN (ROL 2)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const userRole = Number(localStorage.getItem("userRole"));

    if (!token || userRole !== 2) {
        localStorage.clear();
        window.location.href = "../login.html";
        return;
    }

    const nombre = localStorage.getItem("userName") || "Administrador";
    const email = localStorage.getItem("userEmail") || "";

    document.getElementById("adminNombre").textContent = nombre;
    document.getElementById("adminEmail").textContent = email;
    document.getElementById("adminAvatar").textContent = nombre.substring(0, 2).toUpperCase();

    recargarTodo();
});

function cerrarSesion() {
    localStorage.clear();
    window.location.href = "../login.html";
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function cambiarSeccion(id) {
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === id);
    });
    document.querySelectorAll(".section-view").forEach(sec => {
        sec.classList.toggle("active", sec.id === `sec-${id}`);
    });
    document.getElementById("topbarTitulo").textContent = TITULOS_SECCION[id] || "Panel";
    document.getElementById("sidebar").classList.remove("open");
}

function escapeHtml(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function mostrarToast(mensaje, tipo = "ok") {
    const el = document.getElementById("toastBanner");
    el.textContent = mensaje;
    el.className = `toast-banner show ${tipo}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.className = "toast-banner";
    }, 4500);
}

async function apiFetch(ruta, opciones = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        ...(opciones.headers || {}),
        Authorization: `Bearer ${token}`
    };

    if (opciones.body && !(opciones.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_URL}${ruta}`, { ...opciones, headers });
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "../login.html";
        throw new Error("Sesión expirada o permisos actualizados.");
    }

    if (!res.ok) {
        const detalle = data && data.detail
            ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
            : `Error HTTP ${res.status}`;
        throw new Error(detalle);
    }

    return data;
}

function claseEstado(estado) {
    const e = String(estado || "").toUpperCase();
    if (["ACTIVO", "ACTIVA", "APROBADO", "APROBADA"].includes(e)) return "state-ok";
    if (["PENDIENTE", "EN_REVISION"].includes(e)) return "state-warn";
    return "state-err";
}

// ==========================================
// CARGA GLOBAL
// ==========================================
async function recargarTodo() {
    await Promise.allSettled([
        cargarUsuarios(),
        cargarAuditoriaRoles(),
        cargarSolicitudes(),
        cargarDocumentos(),
        cargarProveedores(),
        cargarPoliticas(),
        cargarCondiciones(),
        cargarUbicaciones(),
        cargarTrayectos()
    ]);
}

// ==========================================
// 1. USUARIOS, ROLES Y AUDITORÍA (HU-27A)
// ==========================================
async function cargarUsuarios() {
    const cont = document.getElementById("tablaUsuarios");
    try {
        const params = new URLSearchParams();
        const buscar = document.getElementById("filtroUsuarioBuscar").value.trim();
        const idRol = document.getElementById("filtroUsuarioRol").value;
        const activo = document.getElementById("filtroUsuarioEstado").value;
        if (buscar) params.append("buscar", buscar);
        if (idRol) params.append("id_rol", idRol);
        if (activo) params.append("activo", activo);

        const qs = params.toString() ? `?${params.toString()}` : "";
        const usuarios = await apiFetch(`/admin/usuarios/${qs}`);
        cacheUsuarios = usuarios;

        document.getElementById("kpiUsuarios").textContent = usuarios.length;
        const activos = usuarios.filter(u => u.activo).length;
        document.getElementById("kpiUsuariosActivos").textContent = `${activos} activos · ${usuarios.length - activos} inactivos`;

        if (!usuarios.length) {
            cont.innerHTML = `<div class="empty-box">No se encontraron usuarios con esos filtros.</div>`;
            return;
        }

        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuarios.map(u => `
                        <tr>
                            <td class="mono">#${u.id_usu}</td>
                            <td>${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}</td>
                            <td>${escapeHtml(u.email)}</td>
                            <td>${u.id_rol} · ${escapeHtml(NOMBRES_ROL[u.id_rol] || "Otro")}</td>
                            <td><span class="${u.activo ? "state-ok" : "state-err"}">${u.activo ? "Activo" : "Inactivo"}</span></td>
                            <td>
                                <div class="actions-cell">
                                    <button class="btn btn-outline btn-sm" onclick="abrirModalEditarUsuario(${u.id_usu})">Editar</button>
                                    <button class="btn btn-outline btn-sm" onclick="abrirModalCambiarRol(${u.id_usu}, ${u.id_rol})">Rol</button>
                                    <button class="btn btn-danger-outline btn-sm" onclick="toggleEstadoUsuario(${u.id_usu}, ${!u.activo})">
                                        ${u.activo ? "Desactivar" : "Activar"}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

async function cargarAuditoriaRoles() {
    const cont = document.getElementById("tablaAuditoriaRoles");
    const resumen = document.getElementById("resumenAuditoria");
    try {
        const logs = await apiFetch("/admin/usuarios/auditoria-roles");
        if (!logs.length) {
            const vacio = `<div class="empty-box">Aún no hay cambios de rol registrados.</div>`;
            cont.innerHTML = vacio;
            resumen.innerHTML = vacio;
            return;
        }

        const renderRows = (lista) => `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Admin</th>
                        <th>Usuario</th>
                        <th>Cambio</th>
                        <th>Motivo</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(l => `
                        <tr>
                            <td class="mono">#${l.id_auditoria}</td>
                            <td class="mono">#${l.id_admin}</td>
                            <td class="mono">#${l.id_usu_afectado}</td>
                            <td>${NOMBRES_ROL[l.rol_anterior] || l.rol_anterior} → ${NOMBRES_ROL[l.rol_nuevo] || l.rol_nuevo}</td>
                            <td>${escapeHtml(l.motivo || "Sin motivo")}</td>
                            <td class="mono">${escapeHtml((l.fecha_cambio || "").replace("T", " ").slice(0, 16))}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        cont.innerHTML = renderRows(logs);
        resumen.innerHTML = renderRows(logs.slice(0, 5));
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

async function toggleEstadoUsuario(idUsu, nuevoActivo) {
    try {
        await apiFetch(`/admin/usuarios/${idUsu}/estado`, {
            method: "PUT",
            body: JSON.stringify({ activo: nuevoActivo })
        });
        mostrarToast(`Usuario #${idUsu} ${nuevoActivo ? "activado" : "desactivado"} correctamente.`);
        cargarUsuarios();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

function abrirModalCrearUsuario() {
    abrirModal(
        "Crear nuevo usuario",
        `
            <div class="field-row">
                <div class="field-group">
                    <label>Nombre</label>
                    <input class="input" name="nombre" required minlength="2">
                </div>
                <div class="field-group">
                    <label>Apellido</label>
                    <input class="input" name="apellido" required minlength="2">
                </div>
            </div>
            <div class="field-group">
                <label>Correo electrónico</label>
                <input class="input" type="email" name="email" required>
            </div>
            <div class="field-group">
                <label>Contraseña (mín. 8 caracteres, mayúscula, número y símbolo)</label>
                <input class="input" type="password" name="password" required>
            </div>
            <div class="field-group">
                <label>Rol inicial</label>
                <select class="select" name="id_rol">
                    <option value="1">1 · Viajero</option>
                    <option value="2">2 · Administrador</option>
                    <option value="3">3 · Proveedor</option>
                    <option value="4">4 · Guía</option>
                </select>
            </div>
        `,
        async (fd) => {
            await apiFetch("/admin/usuarios/", {
                method: "POST",
                body: JSON.stringify({
                    nombre: fd.get("nombre"),
                    apellido: fd.get("apellido"),
                    email: fd.get("email"),
                    password: fd.get("password"),
                    id_rol: Number(fd.get("id_rol")),
                    activo: true
                })
            });
            mostrarToast("Usuario creado correctamente.");
            cargarUsuarios();
        }
    );
}

function abrirModalEditarUsuario(idUsu) {
    const u = cacheUsuarios.find(item => item.id_usu === idUsu);
    if (!u) return;
    abrirModal(
        `Editar usuario #${idUsu}`,
        `
            <div class="field-row">
                <div class="field-group">
                    <label>Nombre</label>
                    <input class="input" name="nombre" value="${escapeHtml(u.nombre)}" required minlength="2">
                </div>
                <div class="field-group">
                    <label>Apellido</label>
                    <input class="input" name="apellido" value="${escapeHtml(u.apellido)}" required minlength="2">
                </div>
            </div>
            <div class="field-group">
                <label>Correo electrónico</label>
                <input class="input" type="email" name="email" value="${escapeHtml(u.email)}" required>
            </div>
        `,
        async (fd) => {
            await apiFetch(`/admin/usuarios/${idUsu}`, {
                method: "PUT",
                body: JSON.stringify({
                    nombre: fd.get("nombre"),
                    apellido: fd.get("apellido"),
                    email: fd.get("email")
                })
            });
            mostrarToast(`Usuario #${idUsu} actualizado.`);
            cargarUsuarios();
        }
    );
}

function abrirModalCambiarRol(idUsu, rolActual) {
    abrirModal(
        `Cambiar rol de usuario #${idUsu}`,
        `
            <div class="field-group">
                <label>Nuevo rol</label>
                <select class="select" name="id_rol">
                    <option value="1" ${rolActual === 1 ? "selected" : ""}>1 · Viajero</option>
                    <option value="2" ${rolActual === 2 ? "selected" : ""}>2 · Administrador</option>
                    <option value="3" ${rolActual === 3 ? "selected" : ""}>3 · Proveedor</option>
                    <option value="4" ${rolActual === 4 ? "selected" : ""}>4 · Guía</option>
                </select>
            </div>
            <div class="field-group">
                <label>Motivo del cambio (auditoría)</label>
                <input class="input" name="motivo" placeholder="Ej: Aprobación administrativa">
            </div>
        `,
        async (fd) => {
            await apiFetch(`/admin/usuarios/${idUsu}/rol`, {
                method: "PUT",
                body: JSON.stringify({
                    id_rol: Number(fd.get("id_rol")),
                    motivo: fd.get("motivo") || null
                })
            });
            mostrarToast(`Rol del usuario #${idUsu} actualizado.`);
            cargarUsuarios();
            cargarAuditoriaRoles();
        }
    );
}

// ==========================================
// 2. SOLICITUDES, DOCUMENTOS Y PROVEEDORES
// ==========================================
async function cargarSolicitudes() {
    const cont = document.getElementById("tablaSolicitudes");
    const resumen = document.getElementById("resumenSolicitudes");
    try {
        const lista = await apiFetch("/solicitudes-proveedor/");
        const enRevision = lista.filter(s => String(s.estado).toUpperCase() === "EN_REVISION").length;
        document.getElementById("kpiSolicitudes").textContent = enRevision;

        if (!lista.length) {
            const vacio = `<div class="empty-box">No hay solicitudes de proveedor registradas.</div>`;
            cont.innerHTML = vacio;
            resumen.innerHTML = vacio;
            return;
        }

        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Razón social</th>
                        <th>NIT</th>
                        <th>Banco / Cuenta</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(s => `
                        <tr>
                            <td class="mono">#${s.id_sp}</td>
                            <td>${escapeHtml(s.razon_social)}<br><span class="muted">Usuario #${s.id_usu} · ${escapeHtml(s.telefono_contacto)}</span></td>
                            <td class="mono">${escapeHtml(s.nit)}</td>
                            <td class="mono">${escapeHtml(s.banco)} · ${escapeHtml(s.cuenta_bancaria)}</td>
                            <td><span class="${claseEstado(s.estado)}">${escapeHtml(s.estado)}</span></td>
                            <td>
                                <button class="btn btn-outline btn-sm" onclick="abrirModalRevisarSolicitud(${s.id_sp}, '${escapeHtml(s.estado)}')">
                                    Revisar
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        resumen.innerHTML = `
            <table>
                <thead>
                    <tr><th>ID</th><th>Razón social</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    ${lista.slice(0, 5).map(s => `
                        <tr>
                            <td class="mono">#${s.id_sp}</td>
                            <td>${escapeHtml(s.razon_social)}</td>
                            <td><span class="${claseEstado(s.estado)}">${escapeHtml(s.estado)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

function abrirModalRevisarSolicitud(idSp, estadoActual) {
    abrirModal(
        `Revisar solicitud #${idSp}`,
        `
            <div class="field-group">
                <label>Decisión</label>
                <select class="select" name="estado">
                    <option value="APROBADA" ${estadoActual === "APROBADA" ? "selected" : ""}>APROBADA</option>
                    <option value="RECHAZADA" ${estadoActual === "RECHAZADA" ? "selected" : ""}>RECHAZADA</option>
                </select>
            </div>
            <div class="field-group">
                <label>Observaciones</label>
                <textarea class="textarea" name="observaciones" rows="3" placeholder="Motivo o comentarios para el solicitante..."></textarea>
            </div>
        `,
        async (fd) => {
            await apiFetch(`/solicitudes-proveedor/${idSp}/revision`, {
                method: "PUT",
                body: JSON.stringify({
                    estado: fd.get("estado"),
                    observaciones: fd.get("observaciones") || null
                })
            });
            mostrarToast(`Solicitud #${idSp} actualizada.`);
            cargarSolicitudes();
            cargarProveedores();
            cargarUsuarios();
        }
    );
}

async function cargarDocumentos() {
    const cont = document.getElementById("tablaDocumentos");
    try {
        const estado = document.getElementById("filtroDocEstado").value;
        const qs = estado ? `?estado=${encodeURIComponent(estado)}` : "";
        const docs = await apiFetch(`/documentos/${qs}`);

        if (!estado) {
            const pendientes = docs.filter(d => String(d.estado).toUpperCase() === "PENDIENTE").length;
            document.getElementById("kpiDocumentos").textContent = pendientes;
        }

        if (!docs.length) {
            cont.innerHTML = `<div class="empty-box">No hay documentos para mostrar.</div>`;
            return;
        }

        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario / Solicitud</th>
                        <th>Tipo</th>
                        <th>Archivo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(d => `
                        <tr>
                            <td class="mono">#${d.id_doc}</td>
                            <td class="mono">Usu #${d.id_usu}${d.id_sp ? ` · Sol #${d.id_sp}` : ""}</td>
                            <td>${escapeHtml(d.tipo_doc)}</td>
                            <td>
                                <a class="btn btn-text" href="${API_URL}${escapeHtml(d.ruta_archivo)}" target="_blank" rel="noopener">
                                    ${escapeHtml(d.nom_archivo)}
                                </a>
                            </td>
                            <td><span class="${claseEstado(d.estado)}">${escapeHtml(d.estado)}</span></td>
                            <td>
                                <div class="actions-cell">
                                    <button class="btn btn-outline btn-sm" onclick="cambiarEstadoDocumento(${d.id_doc}, 'APROBADO')">Aprobar</button>
                                    <button class="btn btn-danger-outline btn-sm" onclick="cambiarEstadoDocumento(${d.id_doc}, 'RECHAZADO')">Rechazar</button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

async function cambiarEstadoDocumento(idDoc, estado) {
    try {
        await apiFetch(`/documentos/${idDoc}/estado`, {
            method: "PUT",
            body: JSON.stringify({ estado })
        });
        mostrarToast(`Documento #${idDoc} marcado como ${estado}.`);
        cargarDocumentos();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

async function cargarProveedores() {
    const cont = document.getElementById("tablaProveedores");
    try {
        const estado = document.getElementById("filtroProvEstado").value;
        const qs = estado ? `?estado=${encodeURIComponent(estado)}` : "";
        const lista = await apiFetch(`/proveedores/${qs}`);

        if (!estado) {
            const activos = lista.filter(p => String(p.estado).toUpperCase() === "ACTIVO").length;
            document.getElementById("kpiProveedores").textContent = activos;
        }

        if (!lista.length) {
            cont.innerHTML = `<div class="empty-box">No hay proveedores registrados.</div>`;
            return;
        }

        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID Proveedor</th>
                        <th>Usuario</th>
                        <th>Solicitud</th>
                        <th>Estado</th>
                        <th>Cambiar estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(p => `
                        <tr>
                            <td class="mono">#${p.id_prov}</td>
                            <td class="mono">#${p.id_usu}</td>
                            <td class="mono">#${p.id_sp}</td>
                            <td><span class="${claseEstado(p.estado)}">${escapeHtml(p.estado)}</span></td>
                            <td>
                                <div class="actions-cell">
                                    <button class="btn btn-outline btn-sm" onclick="cambiarEstadoProveedor(${p.id_prov}, 'ACTIVO')">Activar</button>
                                    <button class="btn btn-outline btn-sm" onclick="cambiarEstadoProveedor(${p.id_prov}, 'SUSPENDIDO')">Suspender</button>
                                    <button class="btn btn-danger-outline btn-sm" onclick="cambiarEstadoProveedor(${p.id_prov}, 'INACTIVO')">Inactivar</button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

async function cambiarEstadoProveedor(idProv, estado) {
    try {
        await apiFetch(`/proveedores/${idProv}/estado`, {
            method: "PUT",
            body: JSON.stringify({ estado })
        });
        mostrarToast(`Proveedor #${idProv} actualizado a ${estado}.`);
        cargarProveedores();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

// ==========================================
// 3. POLÍTICAS Y CONDICIONES
// ==========================================
async function cargarPoliticas() {
    const cont = document.getElementById("tablaPoliticas");
    try {
        const lista = await apiFetch("/politicas/");
        cachePoliticas = lista;
        if (!lista.length) {
            cont.innerHTML = `<div class="empty-box">No hay políticas creadas todavía.</div>`;
            return;
        }
        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(p => `
                        <tr>
                            <td class="mono">#${p.id_poli}</td>
                            <td>${escapeHtml(p.nombre)}</td>
                            <td>${escapeHtml(p.descripcion)}</td>
                            <td><span class="${claseEstado(p.estado)}">${escapeHtml(p.estado)}</span></td>
                            <td>
                                <div class="actions-cell">
                                    <button class="btn btn-outline btn-sm" onclick="abrirModalPolitica(${p.id_poli})">Editar</button>
                                    <button class="btn btn-danger-outline btn-sm" onclick="eliminarPolitica(${p.id_poli})">Eliminar</button>
                                </div>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

function abrirModalPolitica(idPoli = null) {
    const p = idPoli ? cachePoliticas.find(item => item.id_poli === idPoli) : null;
    abrirModal(
        p ? `Editar política #${idPoli}` : "Crear política",
        `
            <div class="field-group">
                <label>Nombre</label>
                <input class="input" name="nombre" value="${escapeHtml(p ? p.nombre : "")}" required maxlength="150">
            </div>
            <div class="field-group">
                <label>Descripción</label>
                <textarea class="textarea" name="descripcion" rows="3" required>${escapeHtml(p ? p.descripcion : "")}</textarea>
            </div>
            ${p ? `
            <div class="field-group">
                <label>Estado</label>
                <select class="select" name="estado">
                    <option value="ACTIVA" ${p.estado === "ACTIVA" ? "selected" : ""}>ACTIVA</option>
                    <option value="INACTIVA" ${p.estado === "INACTIVA" ? "selected" : ""}>INACTIVA</option>
                </select>
            </div>` : ""}
        `,
        async (fd) => {
            if (p) {
                await apiFetch(`/politicas/${idPoli}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        nombre: fd.get("nombre"),
                        descripcion: fd.get("descripcion"),
                        estado: fd.get("estado")
                    })
                });
                mostrarToast(`Política #${idPoli} actualizada.`);
            } else {
                await apiFetch("/politicas/", {
                    method: "POST",
                    body: JSON.stringify({
                        nombre: fd.get("nombre"),
                        descripcion: fd.get("descripcion")
                    })
                });
                mostrarToast("Política creada.");
            }
            cargarPoliticas();
        }
    );
}

async function eliminarPolitica(idPoli) {
    try {
        await apiFetch(`/politicas/${idPoli}`, { method: "DELETE" });
        mostrarToast(`Política #${idPoli} eliminada.`);
        cargarPoliticas();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

async function cargarCondiciones() {
    const cont = document.getElementById("tablaCondiciones");
    try {
        const lista = await apiFetch("/condiciones/");
        if (!lista.length) {
            cont.innerHTML = `<div class="empty-box">No hay condiciones creadas todavía.</div>`;
            return;
        }
        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Tipo</th>
                        <th>Política</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(c => `
                        <tr>
                            <td class="mono">#${c.id_condi}</td>
                            <td>${escapeHtml(c.nombre)}<br><span class="muted">${escapeHtml(c.descripcion)}</span></td>
                            <td>${escapeHtml(c.tipo)}</td>
                            <td class="mono">#${c.id_poli}</td>
                            <td><span class="${claseEstado(c.estado)}">${escapeHtml(c.estado)}</span></td>
                            <td>
                                <button class="btn btn-danger-outline btn-sm" onclick="eliminarCondicion(${c.id_condi})">Eliminar</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

function abrirModalCondicion() {
    const opcionesPoli = cachePoliticas.length
        ? cachePoliticas.map(p => `<option value="${p.id_poli}">#${p.id_poli} · ${escapeHtml(p.nombre)}</option>`).join("")
        : `<option value="1">Política #1</option>`;

    abrirModal(
        "Crear condición",
        `
            <div class="field-group">
                <label>Nombre</label>
                <input class="input" name="nombre" required maxlength="150">
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Tipo</label>
                    <select class="select" name="tipo">
                        <option value="CANCELACION">CANCELACION</option>
                        <option value="RESERVA">RESERVA</option>
                        <option value="PAGO">PAGO</option>
                        <option value="USO">USO</option>
                        <option value="OTRO">OTRO</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>Política asociada</label>
                    <select class="select" name="id_poli">${opcionesPoli}</select>
                </div>
            </div>
            <div class="field-group">
                <label>Descripción</label>
                <textarea class="textarea" name="descripcion" rows="3" required></textarea>
            </div>
        `,
        async (fd) => {
            await apiFetch("/condiciones/", {
                method: "POST",
                body: JSON.stringify({
                    nombre: fd.get("nombre"),
                    descripcion: fd.get("descripcion"),
                    tipo: fd.get("tipo"),
                    id_poli: Number(fd.get("id_poli"))
                })
            });
            mostrarToast("Condición creada.");
            cargarCondiciones();
        }
    );
}

async function eliminarCondicion(idCondi) {
    try {
        await apiFetch(`/condiciones/${idCondi}`, { method: "DELETE" });
        mostrarToast(`Condición #${idCondi} eliminada.`);
        cargarCondiciones();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

// ==========================================
// 4. UBICACIONES Y TRAYECTOS
// ==========================================
async function cargarUbicaciones() {
    const cont = document.getElementById("tablaUbicaciones");
    try {
        const lista = await apiFetch("/ubicaciones/");
        cacheUbicaciones = lista;
        if (!lista.length) {
            cont.innerHTML = `<div class="empty-box">No hay ubicaciones registradas.</div>`;
            return;
        }
        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Dirección</th>
                        <th>Barrio</th>
                        <th>Ciudad</th>
                        <th>Coordenadas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(u => `
                        <tr>
                            <td class="mono">#${u.id_ubi}</td>
                            <td>${escapeHtml(u.direccion)}</td>
                            <td>${escapeHtml(u.barrio || "--")}</td>
                            <td class="mono">${u.id_cdad ? "#" + u.id_cdad : "--"}</td>
                            <td class="mono">${escapeHtml(u.latitud)}, ${escapeHtml(u.longitud)}</td>
                            <td>
                                <button class="btn btn-danger-outline btn-sm" onclick="eliminarUbicacion(${u.id_ubi})">Eliminar</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

function abrirModalUbicacion() {
    abrirModal(
        "Nueva ubicación geográfica",
        `
            <div class="field-group">
                <label>Dirección o lugar</label>
                <input class="input" name="direccion" required placeholder="Ej: Carrera 7 # 32-16, Bogotá">
            </div>
            <p class="muted">La ciudad y las coordenadas se buscan automáticamente en el mapa. Incluye la ciudad para mayor precisión.</p>
        `,
        async (fd) => {
            const id = await resolverUbicacionTexto(fd.get("direccion"));
            mostrarToast(`Ubicación registrada (#${id}).`);
            cargarUbicaciones();
        }
    );
}

async function eliminarUbicacion(idUbi) {
    try {
        await apiFetch(`/ubicaciones/${idUbi}`, { method: "DELETE" });
        mostrarToast(`Ubicación #${idUbi} eliminada.`);
        cargarUbicaciones();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

async function cargarTrayectos() {
    const cont = document.getElementById("tablaTrayectos");
    try {
        const lista = await apiFetch("/trayectos/");
        document.getElementById("kpiRutasTotal").textContent = `${lista.length} trayectos registrados`;

        if (!lista.length) {
            cont.innerHTML = `<div class="empty-box">No hay trayectos calculados todavía.</div>`;
            return;
        }
        cont.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th class="num-col">Distancia (km)</th>
                        <th class="num-col">Tiempo (min)</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(t => `
                        <tr>
                            <td class="mono">#${t.id_tray}</td>
                            <td class="mono">Ubicación #${t.id_origen}</td>
                            <td class="mono">Ubicación #${t.id_destino}</td>
                            <td class="num-col tabular-nums">${escapeHtml(t.distancia_km)} km</td>
                            <td class="num-col tabular-nums">${escapeHtml(t.tiempo_estimado_min)} min</td>
                            <td>
                                <button class="btn btn-danger-outline btn-sm" onclick="eliminarTrayecto(${t.id_tray})">Eliminar</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (err) {
        cont.innerHTML = `<div class="empty-box">${escapeHtml(err.message)}</div>`;
    }
}

function abrirModalTrayecto() {
    abrirModal(
        "Calcular nuevo trayecto",
        `
            <div class="field-group">
                <label>Origen</label>
                <input class="input" name="origen" required placeholder="Ej: Terminal de Bogotá">
            </div>
            <div class="field-group">
                <label>Destino</label>
                <input class="input" name="destino" required placeholder="Ej: Parque Tayrona, Santa Marta">
            </div>
        `,
        async (fd) => {
            const idOrigen = await resolverUbicacionTexto(fd.get("origen"));
            const idDestino = await resolverUbicacionTexto(fd.get("destino"));
            await apiFetch("/trayectos/", {
                method: "POST",
                body: JSON.stringify({ id_origen: idOrigen, id_destino: idDestino })
            });
            mostrarToast("Trayecto calculado y guardado.");
            cargarTrayectos();
            cargarUbicaciones();
        }
    );
}

async function eliminarTrayecto(idTray) {
    try {
        await apiFetch(`/trayectos/${idTray}`, { method: "DELETE" });
        mostrarToast(`Trayecto #${idTray} eliminado.`);
        cargarTrayectos();
    } catch (err) {
        mostrarToast(err.message, "err");
    }
}

// ==========================================
// MODAL GENÉRICO
// ==========================================
function abrirModal(titulo, bodyHtml, onSubmit) {
    document.getElementById("modalTitulo").textContent = titulo;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    modalAction = onSubmit;
    document.getElementById("modalOverlay").classList.add("open");
}

function cerrarModal() {
    document.getElementById("modalOverlay").classList.remove("open");
    modalAction = null;
}

async function enviarFormularioModal(e) {
    e.preventDefault();
    if (!modalAction) return;
    const btn = document.getElementById("modalSubmitBtn");
    btn.disabled = true;
    try {
        const fd = new FormData(e.target);
        await modalAction(fd);
        cerrarModal();
    } catch (err) {
        mostrarToast(err.message, "err");
    } finally {
        btn.disabled = false;
    }
}

async function resolverUbicacionTexto(texto) {
    texto = (texto || "").trim();
    const lugar = await apiFetch(`/ubicaciones/buscar?texto=${encodeURIComponent(texto)}`);
    const ubi = await apiFetch("/ubicaciones/desde-mapa", {
        method: "POST",
        body: JSON.stringify({
            direccion: lugar.direccion,
            barrio: lugar.barrio,
            latitud: lugar.latitud,
            longitud: lugar.longitud,
            descripcion: lugar.descripcion,
            id_cdad: lugar.id_cdad
        })
    });
    return ubi.id_ubi;
}