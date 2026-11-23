const API_BASE = "http://127.0.0.1:8000/pagos";
const token = localStorage.getItem("token");
let metodoSeleccionado = 1; // 1: Tarjeta, 2: PSE, 3: Billetera (ids de la tabla metodo_pago)
let totalPlan = 0;
let idPlanActual = null;

// Sesión obligatoria: los endpoints de pago ahora exigen JWT
if (!token) { window.location.href = "../login.html"; }

// 1. Obtener ID del plan desde la URL (pago.html?id_plan=5)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("id_plan")) {
    idPlanActual = parseInt(urlParams.get("id_plan"));
}

document.addEventListener("DOMContentLoaded", () => {
    inyectarModalesSiFaltan();
    if (!idPlanActual) {
        alert("No se indicó qué plan pagar. Elige uno desde 'Mis Planes'.");
        window.location.href = "ver_planes.html";
        return;
    }
    cargarDetallesPlan();
});

function authHeaders() {
    return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// Cambiar método de pago
function cambiarMetodo(idMetodo, elemento) {
    metodoSeleccionado = idMetodo;
    document.querySelectorAll(".method-tab").forEach(tab => tab.classList.remove("active"));
    elemento.classList.add("active");

    const formTarjeta = document.getElementById("formTarjeta");
    const formPSE = document.getElementById("formPSE");
    const formNequi = document.getElementById("formNequi");

    if (formTarjeta) formTarjeta.style.display = (idMetodo === 1) ? "block" : "none";
    if (formPSE) formPSE.style.display = (idMetodo === 2) ? "block" : "none";
    if (formNequi) formNequi.style.display = (idMetodo === 3) ? "block" : "none";
}

// Cargar plan de viaje desde el backend (total calculado por el servidor)
async function cargarDetallesPlan() {
    const cargando = document.getElementById("resumenCargando");
    const contenido = document.getElementById("resumenContenido");
    try {
        const res = await fetch(`${API_BASE}/plan/${idPlanActual}`, { headers: authHeaders() });
        if (res.status === 401) { localStorage.clear(); window.location.href = "../login.html"; return; }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "No se pudo cargar el plan.");

        totalPlan = data.total;
        document.getElementById("planTitulo").textContent = data.nombre_plan;
        document.getElementById("planFechas").textContent = `Del ${data.fecha_inicio} al ${data.fecha_fin}`;
        document.getElementById("planTotalCOP").textContent = `$${Number(totalPlan).toLocaleString("es-CO")} COP`;

        document.getElementById("listaServicios").innerHTML = data.servicios.map(s => `
            <div class="summary-item">
                <span>${escaparTexto(s.nombre)} <small>(x${s.cantidad})</small></span>
                <span>$${Number(s.precio).toLocaleString("es-CO")}</span>
            </div>`).join("");

        const btn = document.getElementById("btnPagar");
        if (data.ya_pagado) {
            btn.disabled = true;
            btn.textContent = "Este plan ya fue pagado";
        } else if (data.servicios.length === 0 || totalPlan <= 0) {
            btn.disabled = true;
            btn.textContent = "Agrega servicios al plan para poder pagar";
        }
    } catch (e) {
        alert(e.message);
        window.location.href = "ver_planes.html";
        return;
    }
    if (cargando) cargando.style.display = "none";
    if (contenido) contenido.style.display = "block";
}

function escaparTexto(t) {
    const d = document.createElement("div");
    d.textContent = t || "";
    return d.innerHTML;
}

// Mostrar errores en campos
function mostrarError(mensaje, inputId = null) {
    let box = document.getElementById("mensajeError");
    if (!box) {
        box = document.createElement("div");
        box.id = "mensajeError";
        box.style.cssText = "background-color: #fee2e2; border: 1.5px solid #ef4444; color: #b91c1c; padding: 12px 16px; border-radius: 8px; margin: 15px 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 10px;";
        const btnPagar = document.querySelector(".btn-pagar") || document.querySelector("button[onclick*='iniciarPago']");
        if (btnPagar && btnPagar.parentNode) {
            btnPagar.parentNode.insertBefore(box, btnPagar);
        }
    }
    box.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="font-size: 1.2rem; color: #ef4444;"></i> <span>${mensaje}</span>`;
    box.style.display = "flex";

    if (inputId) {
        const campo = document.getElementById(inputId);
        if (campo) {
            campo.style.borderColor = "#ef4444";
            campo.focus();
            campo.addEventListener("input", () => {
                campo.style.borderColor = "";
                box.style.display = "none";
            }, { once: true });
        }
    }
}

// Validación básica de campos
function validarFormulario() {
    const box = document.getElementById("mensajeError");
    if (box) box.style.display = "none";

    if (metodoSeleccionado === 1) {
        const titular = (document.getElementById("tarjetaTitular")?.value || "").trim();
        const numero = (document.getElementById("tarjetaNumero")?.value || "").replace(/\s+/g, "");
        const venc = (document.getElementById("tarjetaVenc")?.value || "").trim();
        const cvc = (document.getElementById("tarjetaCvc")?.value || "").trim();

        if (titular.length < 3) {
            mostrarError("Por favor ingresa el nombre completo del titular.", "tarjetaTitular");
            return false;
        }
        if (numero.length < 14) {
            mostrarError("Número de tarjeta inválido (mínimo 15-16 dígitos).", "tarjetaNumero");
            return false;
        }
        if (!venc.includes("/")) {
            mostrarError("Fecha de vencimiento inválida. Usa el formato MM/AA.", "tarjetaVenc");
            return false;
        }
        if (cvc.length < 3) {
            mostrarError("Código CVC inválido (3 o 4 números).", "tarjetaCvc");
            return false;
        }
        return { titular, metodo_nombre: "Tarjeta de Crédito / Débito" };

    } else if (metodoSeleccionado === 2) {
        const banco = document.getElementById("pseBanco")?.value || "";
        const doc = (document.getElementById("pseDoc")?.value || "").trim();

        if (!banco) {
            mostrarError("Por favor selecciona tu banco.", "pseBanco");
            return false;
        }
        if (doc.length < 6) {
            mostrarError("Número de documento inválido (mínimo 6 dígitos).", "pseDoc");
            return false;
        }
        return { titular: `Cédula: ${doc} (${banco})`, metodo_nombre: "PSE" };

    } else if (metodoSeleccionado === 3) {
        const billetera = document.getElementById("billeteraTipo")?.value || "Nequi";
        const cel = (document.getElementById("nequiCel")?.value || "").trim();

        if (cel.length !== 10 || !cel.startsWith("3")) {
            mostrarError("Número de celular inválido (10 dígitos empezando en 3).", "nequiCel");
            return false;
        }
        return { titular: `Cel: ${cel}`, metodo_nombre: billetera };
    }
    return false;
}

// MOTOR ANALÍTICO DE RIESGO
function analizarRiesgoTransaccion() {
    const ahora = new Date();
    const anioActual = ahora.getFullYear() % 100; // 26 para 2026
    const mesActual = ahora.getMonth() + 1;

    if (metodoSeleccionado === 1) {
        const titular = (document.getElementById("tarjetaTitular")?.value || "").toLowerCase();
        const numero = (document.getElementById("tarjetaNumero")?.value || "").replace(/\s+/g, "");
        const venc = (document.getElementById("tarjetaVenc")?.value || "").trim();
        const cvc = (document.getElementById("tarjetaCvc")?.value || "").trim();

        // 1. Tarjeta Vencida (Ej: 05/23 o 01/26)
        if (venc.includes("/")) {
            const partes = venc.split("/");
            const mes = parseInt(partes[0]);
            const anio = parseInt(partes[1]);
            if (anio < anioActual || (anio === anioActual && mes < mesActual)) {
                return {
                    aprobado: false,
                    codigo: "ERR_CARD_EXPIRED",
                    motivo: "Tarjeta Vencida / Expirada",
                    detalle: `La fecha de vencimiento (${venc}) es anterior a la fecha actual.`
                };
            }
        }

        // 2. Fondos Insuficientes (Si termina en 0000 o 9999)
        if (numero.endsWith("0000") || numero.endsWith("9999")) {
            return {
                aprobado: false,
                codigo: "ERR_INSUFFICIENT_FUNDS",
                motivo: "Fondos Insuficientes",
                detalle: "La cuenta asociada a esta tarjeta no cuenta con fondos suficientes para cubrir el total."
            };
        }

        // 3. Tarjeta Bloqueada / CVC de prueba
        if (cvc === "000" || numero.startsWith("111111")) {
            return {
                aprobado: false,
                codigo: "ERR_CARD_BLOCKED",
                motivo: "Tarjeta Bloqueada",
                detalle: "La entidad emisora ha restringido el uso de esta tarjeta por sospecha de fraude."
            };
        }

        // 4. Nombre Sospechoso
        if (titular.includes("test") || titular.includes("prueba") || titular.includes("fake") || titular.includes("asdf")) {
            return {
                aprobado: false,
                codigo: "ERR_FRAUD_DETECTED",
                motivo: "Alerta de Seguridad Antifraude",
                detalle: "El titular de la tarjeta fue rechazado por el sistema de validación de identidad."
            };
        }

    } else if (metodoSeleccionado === 2) { // PSE
        const doc = (document.getElementById("pseDoc")?.value || "").trim();
        if (doc === "00000000" || doc === "11111111") {
            return {
                aprobado: false,
                codigo: "ERR_PSE_REJECTED",
                motivo: "Rechazado por ACH Colombia",
                detalle: "El documento ingresado no coincide con el titular de la cuenta bancaria seleccionada."
            };
        }

    } else if (metodoSeleccionado === 3) { // Nequi
        const cel = (document.getElementById("nequiCel")?.value || "").trim();
        if (cel.endsWith("0000")) {
            return {
                aprobado: false,
                codigo: "ERR_WALLET_BALANCE",
                motivo: "Saldo Insuficiente en Billetera",
                detalle: "No hay saldo disponible en la cuenta Nequi/Daviplata indicada."
            };
        }
    }

    return { aprobado: true };
}

// PROCESAR PAGO: validación local + análisis de riesgo simulado + registro REAL en el backend
async function iniciarPago() {
    const datosValidados = validarFormulario();
    if (!datosValidados) return;

    const overlay = document.getElementById("overlayProcesando");
    const msgEstado = document.getElementById("mensajeEstado");
    if (overlay) overlay.style.display = "flex";
    if (msgEstado) msgEstado.textContent = "Conectando con la red bancaria...";
    setTimeout(() => {
        if (msgEstado) msgEstado.textContent = "Analizando riesgo y validando fondos...";
    }, 1200);

    await new Promise(r => setTimeout(r, 2800));

    // La pasarela simulada rechaza ciertos casos de prueba (tarjeta vencida, fondos, etc.)
    const analisis = analizarRiesgoTransaccion();
    if (!analisis.aprobado) {
        if (overlay) overlay.style.display = "none";
        mostrarRechazo(analisis.motivo, analisis.codigo, analisis.detalle);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/procesar`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                id_plan_viaje: idPlanActual,
                id_met_pago: metodoSeleccionado,
                titular: datosValidados.titular
            })
        });
        const data = await res.json().catch(() => ({}));
        if (overlay) overlay.style.display = "none";

        if (res.status === 401) { localStorage.clear(); window.location.href = "../login.html"; return; }
        if (!res.ok) { mostrarError(data.detail || "No se pudo procesar el pago."); return; }

        mostrarExito(data.referencia_transaccion, data.valor_total, new Date().toLocaleString("es-CO"));
        const btn = document.getElementById("btnPagar");
        if (btn) { btn.disabled = true; btn.textContent = "Pago realizado"; }
    } catch (e) {
        if (overlay) overlay.style.display = "none";
        mostrarError("No se pudo conectar con el servidor. Verifica que FastAPI esté ejecutándose.");
    }
}

// MOSTRAR PANTALLA ROJA DE RECHAZO (Autogenerada si hace falta)
function mostrarRechazo(motivo, codigo, detalle) {
    let overlay = document.getElementById("overlayRechazado");
    if (!overlay) {
        inyectarModalesSiFaltan();
        overlay = document.getElementById("overlayRechazado");
    }

    document.getElementById("motivoRechazo").textContent = motivo;
    document.getElementById("codigoRechazo").textContent = codigo;
    document.getElementById("detalleRechazo").textContent = detalle;
    overlay.style.display = "flex";
}

function cerrarModalRechazo() {
    const overlay = document.getElementById("overlayRechazado");
    if (overlay) overlay.style.display = "none";
}

// MOSTRAR PANTALLA VERDE DE ÉXITO
function mostrarExito(referencia, valor, fecha) {
    let overlay = document.getElementById("overlayExito");
    if (overlay) {
        const refEl = document.getElementById("reciboReferencia");
        const valEl = document.getElementById("reciboMonto");
        const fecEl = document.getElementById("reciboFecha");
        if (refEl) refEl.textContent = referencia;
        if (valEl) valEl.textContent = `$${Number(valor).toLocaleString("es-CO")} COP`;
        if (fecEl) fecEl.textContent = fecha;
        overlay.style.display = "flex";
    }
}

// INYECTOR DINÁMICO DE MODALES (Evita cualquier error de etiquetas faltantes)
function inyectarModalesSiFaltan() {
    if (!document.getElementById("overlayRechazado")) {
        const div = document.createElement("div");
        div.id = "overlayRechazado";
        div.className = "overlay-procesando";
        div.style.cssText = "display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px); z-index: 9999; justify-content: center; align-items: center; padding: 20px;";
        div.innerHTML = `
            <div style="background: white; border-radius: 16px; max-width: 480px; width: 100%; padding: 32px; text-align: center; border-top: 6px solid #ef4444; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
                <div style="font-size: 3.5rem; color: #ef4444; margin-bottom: 12px;">
                    <i class="fa-solid fa-circle-xmark"></i>
                </div>
                <h2 style="color: #b91c1c; font-size: 1.6rem; margin-bottom: 8px;">¡Pago No Aprobado!</h2>
                <p id="motivoRechazo" style="color: #4b5563; font-size: 1rem; margin-bottom: 20px; font-weight: 500;"></p>
                <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 10px; padding: 14px 18px; text-align: left; margin-bottom: 22px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: #64748b; font-size: 0.85rem;">Estado:</span>
                        <strong style="color: #b91c1c; font-size: 0.85rem;"><i class="fa-solid fa-ban"></i> RECHAZADO</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: #64748b; font-size: 0.85rem;">Código de Error:</span>
                        <strong id="codigoRechazo" style="color: #1e293b; font-size: 0.85rem;"></strong>
                    </div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #fecdd3;">
                        <span style="color: #64748b; font-size: 0.8rem; display: block; margin-bottom: 2px;">Detalle bancario:</span>
                        <span id="detalleRechazo" style="color: #334155; font-size: 0.88rem; font-weight: 500;"></span>
                    </div>
                </div>
                <button onclick="cerrarModalRechazo()" style="width: 100%; padding: 14px; background: #334155; color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                    <i class="fa-solid fa-arrow-rotate-left"></i> Intentar nuevamente
                </button>
            </div>
        `;
        document.body.appendChild(div);
    }
}