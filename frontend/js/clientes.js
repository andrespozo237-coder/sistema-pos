// Lógica de Gestión de Clientes (CRUD)

const API_URL = 'backend/api_cliente.php';

const ITEMS_PER_PAGE = 12;
let allClientes = [];
let currentPage = 1;

const elTablaCount = document.getElementById('tabla-count');
const elPaginacion = document.getElementById('paginacion-container');

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    await cargarClientes();
    await cargarStats();

    // Búsqueda en vivo
    const inputBusqueda = document.getElementById('input-busqueda');
    let timeout;
    inputBusqueda.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => cargarClientes(inputBusqueda.value), 300);
    });
});

// Listar clientes
async function cargarClientes(busqueda = '') {
    try {
        const resp = await fetch(`${API_URL}?q=${encodeURIComponent(busqueda)}`);
        const clientes = await resp.json();
        allClientes = clientes;
        currentPage = 1;
        renderPage();
    } catch (err) {
        console.error('Error cargando clientes:', err);
        document.getElementById('cuerpo-tabla').innerHTML =
            '<tr><td colspan="4" class="text-center text-danger p-3">Error al cargar clientes</td></tr>';
    }
}

function renderPage() {
    const totalPages = Math.max(1, Math.ceil(allClientes.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageClientes = allClientes.slice(start, end);

    if (elTablaCount) {
        elTablaCount.textContent = `${allClientes.length} registro(s) — Página ${currentPage} de ${totalPages}`;
    }

    renderTabla(pageClientes);
    renderPaginacion(totalPages);
}

function renderPaginacion(totalPages) {
    if (!elPaginacion) return;
    if (totalPages <= 1) {
        elPaginacion.innerHTML = '';
        return;
    }

    let html = '<div class="d-flex justify-content-end align-items-center">';

    html += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="cambiarPagina(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹ Anterior</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="cambiarPagina(1)">1</button>`;
        if (startPage > 2) html += `<span class="me-1">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'btn-secondary' : 'btn-outline-secondary';
        html += `<button class="btn btn-sm ${active} me-1" onclick="cambiarPagina(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="me-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-secondary me-1" onclick="cambiarPagina(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="btn btn-sm btn-outline-secondary" onclick="cambiarPagina(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente ›</button>`;
    html += '</div>';
    
    elPaginacion.innerHTML = html;
}

function cambiarPagina(page) {
    currentPage = page;
    renderPage();
}


function renderTabla(clientes) {
    const tbody = document.getElementById('cuerpo-tabla');

    if (clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No se encontraron clientes</td></tr>';
        return;
    }

    tbody.innerHTML = clientes.map(c => {
        let badgeClass = 'bg-secondary';
        if (c.etiqueta === 'VIP') badgeClass = 'bg-warning text-dark';
        if (c.etiqueta === 'Frecuente') badgeClass = 'bg-success';
        if (c.etiqueta === 'En Riesgo') badgeClass = 'bg-danger';

        return `
        <tr>
            <td><code>${escapeHtml(c.cedula)}</code></td>
            <td>${escapeHtml(c.nombre_completo)}</td>
            <td>${escapeHtml(c.correo || 'N/A')}</td>
            <td><span class="badge ${badgeClass}">${c.etiqueta}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-info me-1" onclick="verPerfilCliente(${c.id})">👁 Perfil</button>
                <button class="btn btn-sm btn-outline-primary me-1" onclick='editarCliente(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✏️ Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarCliente(${c.id})">🗑 Eliminar</button>
            </td>
        </tr>
    `}).join('');
}

// Modal: Nuevo cliente
function abrirModal() {
    document.getElementById('modalTitulo').textContent = 'Nuevo Cliente';
    document.getElementById('cli-id').value = '';
    document.getElementById('cli-cedula').value = '';
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-correo').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('cli-fecha-nacimiento');
    fechaInput.value = '';
    fechaInput.max = today;
    
    document.getElementById('cli-notas').value = '';
    new bootstrap.Modal(document.getElementById('modalCliente')).show();
}

// Modal: Editar cliente
function editarCliente(cli) {
    document.getElementById('modalTitulo').textContent = 'Editar Cliente';
    document.getElementById('cli-id').value = cli.id;
    document.getElementById('cli-cedula').value = cli.cedula;
    document.getElementById('cli-nombre').value = cli.nombre_completo;
    document.getElementById('cli-correo').value = cli.correo || '';
    
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('cli-fecha-nacimiento');
    fechaInput.value = cli.fecha_nacimiento || '';
    fechaInput.max = today;
    
    document.getElementById('cli-notas').value = cli.notas || '';
    new bootstrap.Modal(document.getElementById('modalCliente')).show();
}

// Guardar cliente
async function guardarCliente() {
    const id = document.getElementById('cli-id').value;
    const data = {
        id: id || undefined,
        cedula: document.getElementById('cli-cedula').value.trim(),
        nombre_completo: document.getElementById('cli-nombre').value.trim(),
        correo: document.getElementById('cli-correo').value.trim(),
        fecha_nacimiento: document.getElementById('cli-fecha-nacimiento').value,
        notas: document.getElementById('cli-notas').value.trim()
    };

    if (!data.cedula || !data.nombre_completo) {
        alert('Cédula y Nombre son obligatorios');
        return;
    }

    if (data.cedula.length === 10) {
        const valCed = validarCedula(data.cedula);
        if (!valCed.valido) {
            alert(valCed.mensaje.replace(/^[⚠✗✓]\s*/, ''));
            return;
        }
    } else if (data.cedula.length === 13) {
        const valRuc = validarRuc(data.cedula);
        if (!valRuc.valido) {
            alert(valRuc.mensaje.replace(/^[⚠✗✓]\s*/, ''));
            return;
        }
    } else {
        alert('La Cédula/RUC debe tener exactamente 10 o 13 dígitos numéricos');
        return;
    }

    if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
        alert('El formato del correo electrónico es inválido');
        return;
    }

    if (data.fecha_nacimiento) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (data.fecha_nacimiento > todayStr) {
            alert('La fecha de nacimiento no puede ser posterior al día de hoy.');
            return;
        }
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const resp = await fetch(API_URL, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();

        if (result.estado === 'success') {
            bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
            cargarClientes(document.getElementById('input-busqueda').value);
            cargarStats();
        } else {
            alert(result.mensaje || 'Error al guardar');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

// Eliminar cliente
async function eliminarCliente(id) {
    if (!confirm('¿Está seguro de eliminar este cliente?')) return;

    try {
        const resp = await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        const result = await resp.json();

        if (result.estado === 'success') {
            cargarClientes(document.getElementById('input-busqueda').value);
            cargarStats();
        } else {
            alert(result.mensaje || 'Error al eliminar');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

// Ver perfil
async function verPerfilCliente(id) {
    try {
        const resp = await fetch(`${API_URL}?action=perfil&id=${id}`);
        const result = await resp.json();
        
        if (result.estado === 'success') {
            const cli = result.cliente;
            const ventas = result.ventas;
            
            document.getElementById('perfil-nombre').textContent = cli.nombre_completo;
            document.getElementById('perfil-cedula').textContent = cli.cedula;
            document.getElementById('perfil-correo').textContent = cli.correo || 'No especificado';
            document.getElementById('perfil-cumpleanos').textContent = cli.fecha_nacimiento || 'No especificada';
            
            let badgeClass = 'bg-secondary';
            if (cli.etiqueta === 'VIP') badgeClass = 'bg-warning text-dark';
            if (cli.etiqueta === 'Frecuente') badgeClass = 'bg-success';
            if (cli.etiqueta === 'En Riesgo') badgeClass = 'bg-danger';
            
            const elEtiqueta = document.getElementById('perfil-etiqueta');
            elEtiqueta.textContent = cli.etiqueta;
            elEtiqueta.className = `badge fs-5 ${badgeClass}`;
            
            document.getElementById('perfil-total-gastado').textContent = parseFloat(cli.total_gastado).toFixed(2);
            document.getElementById('perfil-ultima-visita').textContent = cli.ultima_visita ? new Date(cli.ultima_visita).toLocaleDateString() : 'Nunca';
            
            document.getElementById('perfil-notas').textContent = cli.notas || 'Sin notas';
            
            const tbody = document.getElementById('perfil-compras-tabla');
            if (ventas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay compras registradas</td></tr>';
            } else {
                tbody.innerHTML = ventas.map(v => `
                    <tr>
                        <td>${new Date(v.fecha_emision).toLocaleString()}</td>
                        <td><span class="badge bg-${v.estado === 'pagada' ? 'success' : 'warning'}">${v.estado}</span></td>
                        <td>$${parseFloat(v.total_factura).toFixed(2)}</td>
                    </tr>
                `).join('');
            }
            
            new bootstrap.Modal(document.getElementById('modalPerfil')).show();
        } else {
            alert(result.mensaje || 'Error al obtener perfil');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

// Cargar estadísticas del Dashboard
async function cargarStats() {
    try {
        const resp = await fetch(`${API_URL}?action=stats`);
        const stats = await resp.json();
        
        document.getElementById('dash-total-clientes').textContent = stats.total_clientes;
        document.getElementById('dash-cliente-estrella').textContent = stats.cliente_estrella;
        document.getElementById('dash-nuevos-mes').textContent = stats.nuevos_mes;
        document.getElementById('dash-vip-frecuentes').textContent = stats.vip_frecuentes;
        document.getElementById('dash-ticket-promedio').textContent = stats.ticket_promedio;
        document.getElementById('dash-en-riesgo').textContent = stats.en_riesgo;
        
        document.querySelectorAll('.resumen-valor').forEach(el => el.classList.remove('loading'));
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
    }
}

// Utilidades
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validaciones (Cédula/RUC)
function validarCedula(cedula) {
    if (!/^\d+$/.test(cedula)) return { valido: false, mensaje: 'Solo se permiten dígitos numéricos' };
    if (cedula.length !== 10) return { valido: false, mensaje: 'La cédula debe tener exactamente 10 dígitos' };

    const provincia = parseInt(cedula.substring(0, 2), 10);
    if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
        return { valido: false, mensaje: 'Código de provincia inválido' };
    }

    const tercerDigito = parseInt(cedula[2], 10);
    if (tercerDigito > 5) {
        return { valido: false, mensaje: 'Tercer dígito inválido para cédula (debe ser 0-5)' };
    }

    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let valor = parseInt(cedula[i], 10) * coeficientes[i];
        if (valor > 9) valor -= 9;
        suma += valor;
    }

    const digitoVerificador = (10 - (suma % 10)) % 10;
    if (digitoVerificador !== parseInt(cedula[9], 10)) {
        return { valido: false, mensaje: 'Dígito verificador incorrecto — cédula inválida' };
    }

    return { valido: true, mensaje: 'Cédula ecuatoriana válida' };
}

function validarRuc(ruc) {
    if (!/^\d+$/.test(ruc)) return { valido: false, mensaje: 'Solo se permiten dígitos numéricos' };
    if (ruc.length !== 13) return { valido: false, mensaje: 'El RUC debe tener exactamente 13 dígitos' };

    const provincia = parseInt(ruc.substring(0, 2), 10);
    if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
        return { valido: false, mensaje: 'Código de provincia inválido' };
    }

    const tercerDigito = parseInt(ruc[2], 10);

    // Persona Natural (3er dígito 0-5)
    if (tercerDigito < 6) {
        if (ruc.substring(10) !== '001') return { valido: false, mensaje: 'RUC de persona natural debe terminar en 001' };
        const resultCedula = validarCedula(ruc.substring(0, 10));
        if (!resultCedula.valido) return { valido: false, mensaje: 'Los 10 primeros dígitos no forman una cédula válida' };
        return { valido: true, mensaje: 'RUC de persona natural válido' };
    }

    // Entidad Pública (3er dígito = 6)
    if (tercerDigito === 6) {
        if (ruc.substring(9) !== '0001') return { valido: false, mensaje: 'RUC de entidad pública debe terminar en 0001' };
        const coefs6 = [3, 2, 7, 6, 5, 4, 3, 2];
        let sum6 = 0;
        for (let i = 0; i < 8; i++) {
            sum6 += parseInt(ruc[i], 10) * coefs6[i];
        }
        const residuo6 = sum6 % 11;
        const verif6 = residuo6 === 0 ? 0 : 11 - residuo6;
        if (verif6 !== parseInt(ruc[8], 10)) return { valido: false, mensaje: 'Dígito verificador incorrecto (entidad pública)' };
        return { valido: true, mensaje: 'RUC de entidad pública válido' };
    }

    // Sociedad Privada (3er dígito = 9)
    if (tercerDigito === 9) {
        if (ruc.substring(10) !== '001') return { valido: false, mensaje: 'RUC de sociedad privada debe terminar en 001' };
        const coefs9 = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        let sum9 = 0;
        for (let j = 0; j < 9; j++) {
            sum9 += parseInt(ruc[j], 10) * coefs9[j];
        }
        const residuo9 = sum9 % 11;
        const verif9 = residuo9 === 0 ? 0 : 11 - residuo9;
        if (verif9 !== parseInt(ruc[9], 10)) return { valido: false, mensaje: 'Dígito verificador incorrecto (sociedad privada)' };
        return { valido: true, mensaje: 'RUC de sociedad privada válido' };
    }

    return { valido: false, mensaje: 'Tercer dígito del RUC no válido (0-5, 6 o 9)' };
}
