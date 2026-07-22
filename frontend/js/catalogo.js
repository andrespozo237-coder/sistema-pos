// Lógica del Catálogo de Productos (CRUD)

const API_URL = 'backend/api_producto.php';

const ITEMS_PER_PAGE = 12;
let allProductos = [];
let currentPage = 1;

const elTablaCount = document.getElementById('tabla-count');
const elPaginacion = document.getElementById('paginacion-container');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();

    // Búsqueda en vivo
    const inputBusqueda = document.getElementById('input-busqueda');
    let timeout;
    inputBusqueda.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => cargarProductos(inputBusqueda.value), 300);
    });
});

// Listar productos
async function cargarProductos(busqueda = '') {
    try {
        const resp = await fetch(`${API_URL}?q=${encodeURIComponent(busqueda)}`);
        const productos = await resp.json();
        allProductos = productos;
        currentPage = 1;
        renderPage();
    } catch (err) {
        console.error('Error cargando productos:', err);
        document.getElementById('cuerpo-tabla').innerHTML =
            '<tr><td colspan="5" class="text-center text-danger p-3">Error al cargar productos</td></tr>';
    }
}

function renderPage() {
    const totalPages = Math.max(1, Math.ceil(allProductos.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageProductos = allProductos.slice(start, end);

    if (elTablaCount) {
        elTablaCount.textContent = `${allProductos.length} registro(s) — Página ${currentPage} de ${totalPages}`;
    }

    renderTabla(pageProductos);
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


function renderTabla(productos) {
    const tbody = document.getElementById('cuerpo-tabla');

    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No se encontraron productos</td></tr>';
        return;
    }

    tbody.innerHTML = productos.map(p => `
        <tr>
            <td><code>${escapeHtml(p.codigo_barras)}</code></td>
            <td>${escapeHtml(p.nombre_producto)}</td>
            <td><strong>$${Number(p.precio_actual).toFixed(2)}</strong></td>
            <td>
                <span class="badge ${p.stock_disponible > 10 ? 'bg-success' : p.stock_disponible > 0 ? 'bg-warning text-dark' : 'bg-danger'}">
                    ${p.stock_disponible}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick='editarProducto(${JSON.stringify(p)})'>✏️ Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${p.id})">🗑 Eliminar</button>
            </td>
        </tr>
    `).join('');
}

// Modal: Nuevo producto
function abrirModal() {
    document.getElementById('modalTitulo').textContent = 'Nuevo Producto';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-codigo').value = '';
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-stock').value = '';
    new bootstrap.Modal(document.getElementById('modalProducto')).show();
}

// Modal: Editar producto
function editarProducto(prod) {
    document.getElementById('modalTitulo').textContent = 'Editar Producto';
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-codigo').value = prod.codigo_barras;
    document.getElementById('prod-nombre').value = prod.nombre_producto;
    document.getElementById('prod-precio').value = prod.precio_actual;
    document.getElementById('prod-stock').value = prod.stock_disponible;
    new bootstrap.Modal(document.getElementById('modalProducto')).show();
}

// Guardar producto
async function guardarProducto() {
    const id = document.getElementById('prod-id').value;
    const data = {
        id: id || undefined,
        codigo_barras:    document.getElementById('prod-codigo').value.trim(),
        nombre_producto:  document.getElementById('prod-nombre').value.trim(),
        precio_actual:    parseFloat(document.getElementById('prod-precio').value),
        stock_disponible: parseInt(document.getElementById('prod-stock').value)
    };

    if (!data.codigo_barras || !data.nombre_producto || isNaN(data.precio_actual) || isNaN(data.stock_disponible)) {
        alert('Todos los campos son obligatorios');
        return;
    }

    if (data.precio_actual < 0 || data.stock_disponible < 0) {
        alert('El precio y el stock no pueden ser negativos');
        return;
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
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            cargarProductos(document.getElementById('input-busqueda').value);
        } else {
            alert(result.mensaje || 'Error al guardar');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

// Eliminar producto
async function eliminarProducto(id) {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
        const resp = await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        const result = await resp.json();

        if (result.estado === 'success') {
            cargarProductos(document.getElementById('input-busqueda').value);
        } else {
            alert(result.mensaje || 'Error al eliminar');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión');
    }
}

// Utilidades
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
