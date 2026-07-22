<?php

declare(strict_types=1);
require_once __DIR__ . '/backend/session_handler.php';
session_start();

if (!isset($_SESSION['usuario_activo'])) {
    header('Location: index.php');
    exit();
}

$usuario = $_SESSION['usuario_activo'];
$usuario['nombre'] = $usuario['nombre'] ?? $usuario['usuario'] ?? 'N/A';
$usuario['rol'] = $usuario['rol'] ?? 'N/A';
?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Historial de Facturas — Sistema POS</title>
    <meta name="description" content="Historial de ventas con filtros avanzados, detalles de factura y reimpresión PDF">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="frontend/css/dashboard.css">
    <link rel="stylesheet" href="frontend/css/historial.css">
</head>

<body>
    <div class="d-flex">
        <?php include 'backend/includes/sidebar.php'; ?>

        <div id="content" class="w-100" style="margin-left: 280px;">
            <!-- Barra superior -->
            <nav class="navbar navbar-light bg-white shadow-sm p-3">
                <div class="container-fluid d-flex justify-content-between">
                    <span class="navbar-brand mb-0 h4 text-secondary">📄 Historial de Facturas</span>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fw-bold" style="color: var(--verde-oscuro);">
                            👤 <?php echo strtoupper($usuario['nombre']) . ' | Rol: ' . ucfirst($usuario['rol']) ?>
                        </span>
                        <a href="backend/logout.php" class="btn btn-sm btn-outline-danger fw-bold ms-3">Cerrar
                            Sesión</a>
                    </div>
                </div>
            </nav>

            <!-- Contenido principal -->
            <div class="container-fluid px-4 mt-3">

                <!-- Tarjetas de resumen -->
                <div class="resumen-cards">
                    <div class="resumen-card card-total">
                        <div class="resumen-icon">💰</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Total Vendido</span>
                            <span class="resumen-valor loading" id="card-total-valor">$0.00</span>
                        </div>
                    </div>
                    <div class="resumen-card card-cantidad">
                        <div class="resumen-icon">📋</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Cantidad de Facturas</span>
                            <span class="resumen-valor loading" id="card-cantidad-valor">0</span>
                        </div>
                    </div>
                    <div class="resumen-card card-promedio">
                        <div class="resumen-icon">📊</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Ticket Promedio</span>
                            <span class="resumen-valor loading" id="card-promedio-valor">$0.00</span>
                        </div>
                    </div>
                </div>

                <!-- Filtros -->
                <div class="filtros-container">
                    <div class="filtros-titulo">🔎 Búsqueda Avanzada</div>
                    <div class="filtros-grid">
                        <div class="filtro-group">
                            <label for="filtro-fecha-inicio">📅 Fecha Inicio</label>
                            <input type="date" id="filtro-fecha-inicio">
                        </div>
                        <div class="filtro-group">
                            <label for="filtro-fecha-fin">📅 Fecha Fin</label>
                            <input type="date" id="filtro-fecha-fin">
                        </div>
                        <div class="filtro-group">
                            <label for="filtro-cliente">🔍 Cliente (nombre o cédula)</label>
                            <input type="text" id="filtro-cliente" placeholder="Ej: Juan Pérez o 1712345678">
                        </div>
                        <div class="filtro-group">
                            <label for="filtro-factura">🔍 N° Factura</label>
                            <input type="text" id="filtro-factura" placeholder="Ej: 15">
                        </div>
                        <button class="btn-buscar" onclick="buscarHistorial()">🔍 Buscar</button>
                        <button class="btn-limpiar" onclick="limpiarFiltros()">🗑 Limpiar</button>
                    </div>
                </div>

                <!-- Tabla -->
                <div class="tabla-container">
                    <div class="tabla-header">
                        <h5 class="tabla-titulo">📋 Registro de Ventas</h5>
                        <span class="tabla-count" id="tabla-count">0 registro(s)</span>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="tabla-historial">
                            <thead>
                                <tr>
                                    <th>N° Factura</th>
                                    <th>Fecha y Hora</th>
                                    <th>Cliente</th>
                                    <th>Cajero</th>
                                    <th>Total</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="historial-tbody">
                                <tr>
                                    <td colspan="7">
                                        <div class="text-center p-4">
                                            <div class="spinner-border text-success"></div><br>
                                            Cargando facturas...
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Paginación -->
                <div id="paginacion-container"></div>

            </div>
        </div>
    </div>

    <!-- Modal: Detalles -->
    <div class="modal" id="modalDetalles" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content" style="border:none; border-radius:14px; overflow:hidden;">
                <div class="modal-detalle-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="modal-title mb-0 fw-bold">📄 Detalle de Factura</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                </div>
                <div class="modal-body p-4" id="detalle-body-content">
                    <!-- Contenido dinámico -->
                </div>
                <div class="modal-footer border-0">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal: Confirmar anulación -->
    <div class="modal" id="modalAnular" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="border:none; border-radius:14px;">
                <div class="modal-anulacion-body">
                    <span class="anulacion-icon">⚠️</span>
                    <p class="anulacion-msg fs-5 fw-bold">¿Anular la Factura <span id="anulacion-factura-id"></span>?</p>
                    <p class="anulacion-warning">
                        ⚠ Esta acción cambiará el estado a "Anulada" y restaurará el stock de todos los productos de esta factura al inventario.
                    </p>
                </div>
                <div class="modal-footer border-0 justify-content-center pb-4">
                    <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn-confirmar-anular" id="btn-ejecutar-anulacion" onclick="anularFactura()">
                        Sí, Anular Factura
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="frontend/js/historial.js"></script>
</body>

</html>