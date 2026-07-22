// Lógica del Historial de Facturas

const API_URL = 'backend/api_historial.php';
const ITEMS_PER_PAGE = 5;

// Referencias DOM
const elFechaInicio  = document.getElementById('filtro-fecha-inicio');
const elFechaFin     = document.getElementById('filtro-fecha-fin');
const elCliente      = document.getElementById('filtro-cliente');
const elFacturaId    = document.getElementById('filtro-factura');
const elTbody        = document.getElementById('historial-tbody');
const elTablaCount   = document.getElementById('tabla-count');
const elCardTotal    = document.getElementById('card-total-valor');
const elCardCantidad = document.getElementById('card-cantidad-valor');
const elCardPromedio = document.getElementById('card-promedio-valor');
const elPaginacion   = document.getElementById('paginacion-container');

// Estado global
let allVentas = [];
let currentPage = 1;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);

    elFechaInicio.value = formatDateInput(hace30);
    elFechaFin.value    = formatDateInput(hoy);

    // Set initial min/max restrictions
    elFechaFin.min = elFechaInicio.value;
    elFechaInicio.max = elFechaFin.value;

    // Enforce restrictions on change
    elFechaInicio.addEventListener('change', () => {
        elFechaFin.min = elFechaInicio.value;
        if (elFechaFin.value < elFechaInicio.value) {
            elFechaFin.value = elFechaInicio.value;
        }
    });

    elFechaFin.addEventListener('change', () => {
        elFechaInicio.max = elFechaFin.value;
        if (elFechaInicio.value > elFechaFin.value) {
            elFechaInicio.value = elFechaFin.value;
        }
    });

    cargarHistorial();
});

// Cargar historial
async function cargarHistorial() {
    const params = new URLSearchParams({
        action:       'listar',
        fecha_inicio: elFechaInicio.value,
        fecha_fin:    elFechaFin.value,
        cliente:      elCliente.value.trim(),
        factura_id:   elFacturaId.value.trim()
    });

    // Show loading state on cards
    elCardTotal.classList.add('loading');
    elCardCantidad.classList.add('loading');
    elCardPromedio.classList.add('loading');

    try {
        const resp = await fetch(`${API_URL}?${params}`);
        const data = await resp.json();

        if (data.estado !== 'success') {
            showToast(data.mensaje || 'Error al cargar historial', 'error');
            return;
        }

        renderResumen(data.resumen);

        // Store all ventas and reset to page 1
        allVentas = data.ventas;
        currentPage = 1;
        renderPage();

    } catch (err) {
        console.error('Error:', err);
        showToast('Error de conexión con el servidor', 'error');
    }
}

// Mostrar tarjetas de resumen
function renderResumen(resumen) {
    elCardTotal.textContent    = '$' + Number(resumen.total_vendido).toLocaleString('en-US', { minimumFractionDigits: 2 });
    elCardCantidad.textContent = resumen.cantidad_facturas;
    elCardPromedio.textContent = '$' + Number(resumen.ticket_promedio).toLocaleString('en-US', { minimumFractionDigits: 2 });

    // Remove loading
    elCardTotal.classList.remove('loading');
    elCardCantidad.classList.remove('loading');
    elCardPromedio.classList.remove('loading');
}

// Paginación
function renderPage() {
    const totalPages = Math.max(1, Math.ceil(allVentas.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageVentas = allVentas.slice(start, end);

    elTablaCount.textContent = `${allVentas.length} registro(s) — Página ${currentPage} de ${totalPages}`;

    renderTabla(pageVentas);
    renderPaginacion(totalPages);
}

function renderPaginacion(totalPages) {
    if (totalPages <= 1) {
        elPaginacion.innerHTML = '';
        return;
    }

    let html = '<div class="paginacion">';

    // Prev button
    html += `<button class="pag-btn pag-prev" onclick="cambiarPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        ‹ Anterior
    </button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="pag-btn pag-num" onclick="cambiarPagina(1)">1</button>`;
        if (startPage > 2) html += `<span class="pag-dots">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'pag-active' : '';
        html += `<button class="pag-btn pag-num ${active}" onclick="cambiarPagina(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pag-dots">...</span>`;
        html += `<button class="pag-btn pag-num" onclick="cambiarPagina(${totalPages})">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="pag-btn pag-next" onclick="cambiarPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Siguiente ›
    </button>`;

    html += '</div>';
    elPaginacion.innerHTML = html;
}

function cambiarPagina(page) {
    const totalPages = Math.max(1, Math.ceil(allVentas.length / ITEMS_PER_PAGE));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderPage();
    // Scroll to table top
    document.querySelector('.tabla-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Mostrar tabla principal
function renderTabla(ventas) {
    if (ventas.length === 0 && allVentas.length === 0) {
        elTbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <span class="empty-state-icon">📭</span>
                        <div class="empty-state-text">No se encontraron facturas</div>
                        <div class="empty-state-sub">Prueba ajustando los filtros de búsqueda</div>
                    </div>
                </td>
            </tr>`;
        return;
    }

    elTbody.innerHTML = ventas.map(v => {
        const fecha = new Date(v.fecha_emision);
        const fechaStr = fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr  = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

        const badgeClass = v.estado === 'pagada' ? 'badge-pagada' : 'badge-anulada';
        const badgeText  = v.estado === 'pagada' ? 'Pagada' : 'Anulada';

        const disableAnular = v.estado === 'anulada' ? 'disabled' : '';

        return `
            <tr>
                <td><strong>#${v.id}</strong></td>
                <td>${fechaStr} <small style="color:#6c757d">${horaStr}</small></td>
                <td>${escapeHtml(v.cliente)}<br><small style="color:#6c757d">CI: ${escapeHtml(v.cedula)}</small></td>
                <td>${escapeHtml(v.cajero).toUpperCase()}</td>
                <td>
                    <strong>$${Number(v.total_factura).toFixed(2)}</strong>
                    ${Number(v.descuento) > 0 ? `<br><small style="color: #198754;">(Desc. Cumple: -$${Number(v.descuento).toFixed(2)})</small>` : ''}
                </td>
                <td><span class="badge-estado ${badgeClass}">${badgeText}</span></td>
                <td>
                    <div class="acciones-grupo">
                        <button class="btn-accion btn-ver" onclick="verDetalles(${v.id})" title="Ver detalles">
                            👁 Ver
                        </button>
                        <button class="btn-accion btn-reimprimir" onclick="reimprimirFactura(${v.id})" title="Re-imprimir PDF">
                            🖨 PDF
                        </button>
                        <button class="btn-accion btn-anular" onclick="confirmarAnulacion(${v.id})" ${disableAnular} title="Anular factura">
                            ❌ Anular
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

// Ver detalles (Modal)
async function verDetalles(ventaId) {
    const modal = new bootstrap.Modal(document.getElementById('modalDetalles'));

    document.getElementById('detalle-body-content').innerHTML = `
        <div class="text-center p-4"><div class="spinner-border text-success"></div><br>Cargando...</div>`;
    modal.show();

    try {
        const resp = await fetch(`${API_URL}?action=detalles&venta_id=${ventaId}`);
        const data = await resp.json();

        if (data.estado !== 'success') {
            document.getElementById('detalle-body-content').innerHTML =
                `<div class="alert alert-danger">${data.mensaje}</div>`;
            return;
        }

        const v = data.venta;
        const detalles = data.detalles;

        const fecha = new Date(v.fecha_emision);
        const fechaStr = fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const badgeClass = v.estado === 'pagada' ? 'badge-pagada' : 'badge-anulada';

        let html = `
            <div class="detalle-info-grid">
                <div class="detalle-info-item">
                    <span class="detalle-info-label">N° Factura</span>
                    <span class="detalle-info-valor">#${v.id}</span>
                </div>
                <div class="detalle-info-item">
                    <span class="detalle-info-label">Fecha</span>
                    <span class="detalle-info-valor">${fechaStr}</span>
                </div>
                <div class="detalle-info-item">
                    <span class="detalle-info-label">Cliente</span>
                    <span class="detalle-info-valor">${escapeHtml(v.cliente)} (${escapeHtml(v.cedula)})</span>
                </div>
                <div class="detalle-info-item">
                    <span class="detalle-info-label">Cajero</span>
                    <span class="detalle-info-valor">${escapeHtml(v.cajero).toUpperCase()}</span>
                </div>
            </div>

            <table class="tabla-detalles">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th style="text-align:center">Cant.</th>
                        <th style="text-align:right">P. Unit.</th>
                        <th style="text-align:right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${detalles.map(d => `
                        <tr>
                            <td><code>${escapeHtml(d.codigo_barras)}</code></td>
                            <td>${escapeHtml(d.nombre_producto)}</td>
                            <td style="text-align:center">${d.cantidad}</td>
                            <td style="text-align:right">$${Number(d.precio_congelado).toFixed(2)}</td>
                            <td style="text-align:right"><strong>$${Number(d.subtotal).toFixed(2)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${Number(v.descuento) > 0 ? `
            <div class="detalle-total-row" style="color: #198754; font-size: 0.9em; border-top: none; padding-top: 0; padding-bottom: 0;">
                <span>Desc. Cumpleaños:</span>
                <span>-$${Number(v.descuento).toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="detalle-total-row">
                <span>TOTAL:</span>
                <span>$${Number(v.total_factura).toFixed(2)}</span>
            </div>

            <div class="text-center mt-2">
                <span class="badge-estado ${badgeClass}" style="font-size:0.85rem; padding: 0.4rem 1.2rem;">
                    Estado: ${v.estado === 'pagada' ? 'PAGADA' : 'ANULADA'}
                </span>
            </div>`;

        document.getElementById('detalle-body-content').innerHTML = html;

    } catch (err) {
        console.error(err);
        document.getElementById('detalle-body-content').innerHTML =
            `<div class="alert alert-danger">Error de conexión</div>`;
    }
}

// Anular factura
let ventaIdPendienteAnular = null;

function confirmarAnulacion(ventaId) {
    ventaIdPendienteAnular = ventaId;
    document.getElementById('anulacion-factura-id').textContent = `#${ventaId}`;
    const modal = new bootstrap.Modal(document.getElementById('modalAnular'));
    modal.show();
}

async function anularFactura() {
    if (!ventaIdPendienteAnular) return;

    const btn = document.getElementById('btn-ejecutar-anulacion');
    btn.disabled = true;
    btn.textContent = 'Anulando...';

    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'anular', venta_id: ventaIdPendienteAnular })
        });
        const data = await resp.json();

        if (data.estado === 'success') {
            showToast(data.mensaje, 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalAnular')).hide();
            cargarHistorial(); // Reload table
        } else {
            showToast(data.mensaje || 'Error al anular', 'error');
        }

    } catch (err) {
        console.error(err);
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sí, Anular Factura';
        ventaIdPendienteAnular = null;
    }
}

// Reimprimir factura (PDF)
async function reimprimirFactura(ventaId) {
    try {
        const resp = await fetch(`${API_URL}?action=detalles&venta_id=${ventaId}`);
        const data = await resp.json();

        if (data.estado !== 'success') {
            showToast(data.mensaje || 'No se pudo cargar la factura', 'error');
            return;
        }

        const v = data.venta;
        const detalles = data.detalles;

        // ── Load jsPDF dynamically ──
        if (typeof window.jspdf === 'undefined') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }

        const { jsPDF } = window.jspdf;

        // Calcular altura dinámica según productos
        const numProds = detalles.length;
        const alturaProductos = numProds * 10;
        const anuladaOffset = v.estado === 'anulada' ? 6 : 0;
        const alturaTotal = 180 + alturaProductos + anuladaOffset;

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, Math.max(alturaTotal, 100)]
        });

        const W = 80;
        const cx = W / 2;
        const ml = 4;
        const mr = W - 4;
        let y = 6;

        // Encabezado
        doc.setDrawColor(0);
        doc.setLineWidth(0.6);
        doc.rect(ml, y, W - ml * 2, 28);

        y += 7;
        doc.setFont('courier', 'bold');
        doc.setFontSize(14);
        doc.text('TECHMARKET', cx, y, { align: 'center' });
        y += 5;

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text('PUNTO DE VENTA ELECTRONICO', cx, y, { align: 'center' });
        y += 4;
        doc.text('RUC: 1792456789001', cx, y, { align: 'center' });
        y += 4;
        doc.text('Quito - Ecuador', cx, y, { align: 'center' });
        y += 4;
        doc.text('Tel: (02) 2500-100', cx, y, { align: 'center' });

        y += 7;

        // Título
        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        doc.text('COMPROBANTE DE VENTA POS', cx, y, { align: 'center' });
        y += 4;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.text('------------------------------------------------', cx, y, { align: 'center' });
        y += 6;

        // Datos de la factura
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);

        const numFactura = String(v.id).padStart(7, '0');
        doc.text('No. Comprobante:  ' + numFactura, ml, y);
        y += 4;

        const fechaStr = v.fecha_emision || '';
        const fecha = new Date(fechaStr.replace(' ', 'T'));
        const fechaFmt = isNaN(fecha.getTime())
            ? fechaStr
            : fecha.toLocaleDateString('es-EC') + '  ' + fecha.toLocaleTimeString('es-EC');
        doc.text('Fecha:  ' + fechaFmt, ml, y);
        y += 4;

        const cajeroNombre = (v.cajero || 'ADMINISTRADOR').toUpperCase();
        doc.text('Atendido por:  ' + cajeroNombre, ml, y);
        y += 4;

        const cedulaCli = v.cedula || 'N/A';
        let nombreCli = (v.cliente || 'CONSUMIDOR FINAL').toUpperCase();
        if (nombreCli.length > 30) nombreCli = nombreCli.substring(0, 28) + '..';

        doc.text('Cliente:  ' + nombreCli, ml, y);
        y += 4;
        doc.text('CI/RUC:   ' + cedulaCli, ml, y);
        y += 4;

        if (v.estado === 'anulada') {
            doc.setTextColor(220, 53, 69);
            doc.setFont('courier', 'bold');
            doc.text('*** FACTURA ANULADA ***', cx, y, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            doc.setFont('courier', 'normal');
            y += 5;
        }

        doc.setLineWidth(0.5);
        doc.line(ml, y, mr, y);
        y += 1;
        doc.setLineWidth(0.2);
        doc.line(ml, y, mr, y);
        y += 5;

        // Productos
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.text('PRODUCTO', ml, y);
        doc.text('CANT', ml + 38, y);
        doc.text('P.UNIT', ml + 48, y);
        doc.text('TOTAL', mr, y, { align: 'right' });
        y += 2;

        doc.setLineWidth(0.3);
        doc.line(ml, y, mr, y);
        y += 5;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7);

        detalles.forEach(det => {
            const cant = parseInt(det.cantidad, 10);
            const precio = parseFloat(det.precio_congelado);
            const subLinea = (precio * cant).toFixed(2);
            let nombre = (det.nombre_producto || '').toUpperCase();
            const codigo = det.codigo_barras || '';

            if (nombre.length > 35) nombre = nombre.substring(0, 33) + '..';
            doc.setFont('courier', 'bold');
            doc.setFontSize(7);
            doc.text(nombre, ml, y);
            y += 4;

            doc.setFont('courier', 'normal');
            doc.text(codigo, ml + 2, y);
            doc.text(cant.toString(), ml + 42, y, { align: 'center' });
            doc.text(precio.toFixed(2), ml + 54, y, { align: 'center' });
            doc.text('$' + subLinea, mr, y, { align: 'right' });
            y += 6;
        });

        y -= 2;
        doc.setLineWidth(0.3);
        doc.line(ml, y, mr, y);
        y += 6;

        // Totales
        const labelX = ml + 30;
        const totalFactura = parseFloat(v.total_factura);
        const descuento = parseFloat(v.descuento || 0);
        
        const subtotalConDescuento = totalFactura / 1.15;
        const subtotal = subtotalConDescuento + descuento;
        const iva = totalFactura - subtotalConDescuento;

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text('Subtotal:', labelX, y, { align: 'right' });
        doc.text('$ ' + subtotal.toFixed(2), mr, y, { align: 'right' });
        y += 5;

        if (descuento > 0) {
            doc.text('Desc. Cumple:', labelX, y, { align: 'right' });
            doc.text('-$ ' + descuento.toFixed(2), mr, y, { align: 'right' });
            y += 5;
        }

        doc.text('I.V.A. 15%:', labelX, y, { align: 'right' });
        doc.text('$ ' + iva.toFixed(2), mr, y, { align: 'right' });
        y += 3;

        doc.setLineWidth(0.4);
        doc.line(labelX + 2, y, mr, y);
        y += 5;

        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        doc.text('Total a pagar:', labelX + 5, y, { align: 'right' });
        doc.text('$ ' + totalFactura.toFixed(2), mr, y, { align: 'right' });
        y += 10;

        // Pie de página
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.text('*** Gracias por su compra ***', cx, y, { align: 'center' });
        y += 4;
        doc.text('Conserve este comprobante como', cx, y, { align: 'center' });
        y += 3;
        doc.text('respaldo de su transaccion.', cx, y, { align: 'center' });
        y += 5;
        doc.setFontSize(6);
        doc.text('REIMPRESION | TechMarket POS v1.0', cx, y, { align: 'center' });

        doc.save('Factura_' + v.id + '.pdf');
        showToast('PDF de Factura #' + v.id + ' generado', 'success');

    } catch (err) {
        console.error('Error generando PDF:', err);
        showToast('Error al generar PDF: ' + err.message, 'error');
    }
}

// Acciones de filtros
function buscarHistorial() {
    cargarHistorial();
}

function limpiarFiltros() {
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);

    elFechaInicio.value = formatDateInput(hace30);
    elFechaFin.value    = formatDateInput(hoy);
    
    // Reset min/max restrictions
    elFechaFin.min = elFechaInicio.value;
    elFechaInicio.max = elFechaFin.value;
    
    elCliente.value     = '';
    elFacturaId.value   = '';

    cargarHistorial();
}

// Utilidades
function formatDateInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg, type = 'success') {
    // Remove existing
    document.querySelectorAll('.toast-historial').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-historial ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// Allow Enter key on filter inputs to trigger search
document.addEventListener('DOMContentLoaded', () => {
    [elCliente, elFacturaId].forEach(el => {
        if (el) {
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') cargarHistorial();
            });
        }
    });
});
