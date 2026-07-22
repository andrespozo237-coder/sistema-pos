<?php

declare(strict_types=1);
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
    <title>Punto de Venta — Sistema POS</title>
    <meta name="description" content="Sistema de punto de venta con carrito reactivo, facturación y recibos PDF">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="frontend/css/dashboard.css">
    <link rel="stylesheet" href="frontend/css/pos.css">
</head>

<body>
    <div class="d-flex">
        <?php include 'backend/includes/sidebar.php'; ?>

        <div id="content" class="w-100" style="margin-left: 280px;">
            <!-- Barra superior -->
            <nav class="navbar navbar-light bg-white shadow-sm p-3">
                <div class="container-fluid d-flex justify-content-between">
                    <span class="navbar-brand mb-0 h4 text-secondary">🛒 Punto de Venta</span>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fw-bold" style="color: var(--verde-oscuro);">
                            👤 <?php echo strtoupper($usuario['nombre']) . ' | Rol: ' . ucfirst($usuario['rol']) ?>
                        </span>
                        <a href="backend/logout.php" class="btn btn-sm btn-outline-danger fw-bold ms-3">Cerrar
                            Sesión</a>
                    </div>
                </div>
            </nav>

            <!-- Área principal -->
            <div class="pos-wrapper">

                <!-- Columna izquierda: Operación -->
                <div class="pos-left">

                    <!-- Buscador / Lector -->
                    <div class="pos-search-container">
                        <span class="pos-search-icon">🔍</span>
                        <input type="text"
                               id="pos-search"
                               class="pos-search-input"
                               placeholder="Buscar producto por nombre o escanear código de barras..."
                               autocomplete="off"
                               autofocus>
                        <button id="btn-camera-scan" class="btn-camera-scan" title="Escanear con cámara">
                            📷
                        </button>
                        <div id="pos-search-results" class="pos-search-results"></div>
                    </div>

                    <!-- Carrito -->
                    <div class="pos-cart-container">
                        <table class="pos-cart-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>P. Unitario</th>
                                    <th>Cantidad</th>
                                    <th>Subtotal</th>
                                    <th style="width:50px;"></th>
                                </tr>
                            </thead>
                            <tbody id="cart-body">
                                <!-- Filas JS -->
                            </tbody>
                        </table>
                        <!-- Estado vacío -->
                        <div id="cart-empty" class="pos-cart-empty">
                            <div style="font-size: 3.5rem; opacity: 0.4;">🛒</div>
                            <h5 class="mt-3">Carrito vacío</h5>
                            <p>Escanee un código de barras o busque un producto para comenzar la venta</p>
                        </div>
                    </div>
                </div>

                <!-- Columna derecha: Facturación -->
                <div class="pos-right">

                    <!-- Asignación de cliente -->
                    <div class="billing-card">
                        <div class="billing-card-header">👤 Asignación de Cliente</div>
                        <div class="billing-card-body">

                            <!-- Selector de identificación -->
                            <div class="tipo-id-selector">
                                <button class="tipo-id-btn active" data-tipo="cedula" id="btn-tipo-cedula">Cédula</button>
                                <button class="tipo-id-btn" data-tipo="ruc" id="btn-tipo-ruc">RUC</button>
                                <button class="tipo-id-btn" data-tipo="consumidor_final" id="btn-tipo-cf">C. Final</button>
                            </div>

                            <!-- Búsqueda de cliente -->
                            <div id="client-search-section">
                                <div class="client-search-wrapper">
                                    <input type="text"
                                           id="client-search"
                                           class="client-search-input"
                                           placeholder="Ingrese cédula (10 dígitos)"
                                           autocomplete="off"
                                           maxlength="10">
                                    <div id="client-results" class="client-results"></div>
                                </div>
                                <div id="validation-msg" class="validation-msg"></div>

                                <!-- Formulario nuevo cliente -->
                                <div id="new-client-form" class="new-client-form" style="display: none;">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span style="font-size: 1.1rem;">⚠️</span>
                                        <strong style="font-size: 0.82rem; color: #92400e;">
                                            Cliente no encontrado — Registrar nuevo:
                                        </strong>
                                    </div>
                                    <input type="hidden" id="new-client-cedula">
                                    <div class="mb-2">
                                        <label>Nombre completo *</label>
                                        <input type="text" id="new-client-nombre"
                                               placeholder="Ej: Juan Pérez López">
                                    </div>
                                    <div class="mb-2">
                                        <label>Correo electrónico (opcional)</label>
                                        <input type="email" id="new-client-correo"
                                               placeholder="correo@ejemplo.com">
                                    </div>
                                    <div class="mb-2">
                                        <label>Fecha de nacimiento</label>
                                        <input type="date" id="new-client-fecha-nacimiento">
                                    </div>
                                    <div class="mb-2">
                                        <label>Notas / Preferencias</label>
                                        <textarea id="new-client-notas" rows="1"></textarea>
                                    </div>
                                    <button class="btn btn-sm w-100 fw-bold"
                                            style="background: var(--verde-medio); color: white; border-radius: 8px; padding: 8px;"
                                            onclick="window.POS.guardarCliente()">
                                        ✓ Registrar y Seleccionar
                                    </button>
                                </div>
                            </div>

                            <!-- Cliente seleccionado -->
                            <div id="client-selected" class="selected-client-badge" style="display: none;">
                                <div style="flex-grow: 1;">
                                    <div class="selected-client-name"></div>
                                    <div class="selected-client-cedula"></div>
                                    <div id="birthday-banner" class="badge bg-success mt-1 p-2 w-100 text-start" style="display: none; font-size: 0.75rem;">
                                        🎂 ¡Cumpleaños! (Aplica 5% de descuento)
                                    </div>
                                </div>
                                <button class="btn-change-client"
                                        onclick="window.POS.limpiarCliente()"
                                        title="Cambiar cliente">✕</button>
                            </div>

                        </div>
                    </div>

                    <!-- Resumen de factura -->
                    <div class="billing-card">
                        <div class="billing-card-header">💰 Resumen de Factura</div>
                        <div class="billing-card-body totals-section">
                            <div class="total-row subtotal">
                                <span>Subtotal</span>
                                <span id="pos-subtotal" class="fw-bold">$0.00</span>
                            </div>
                            <div class="total-row descuento" id="row-descuento" style="display: none; color: #198754;">
                                <span>Desc. Cumpleaños (5%)</span>
                                <span id="pos-descuento">-$0.00</span>
                            </div>
                            <div class="total-row iva">
                                <span>IVA (15%)</span>
                                <span id="pos-iva">$0.00</span>
                            </div>
                            <div class="total-row total-final">
                                <span>TOTAL</span>
                                <span id="pos-total">$0.00</span>
                            </div>
                        </div>
                    </div>

                    <!-- Panel de pago -->
                    <div class="billing-card">
                        <div class="billing-card-header">💵 Panel de Pago</div>
                        <div class="billing-card-body">
                            <div class="payment-input-group">
                                <label for="pos-pago">Efectivo recibido ($)</label>
                                <input type="number"
                                       id="pos-pago"
                                       class="payment-input"
                                       placeholder="0.00"
                                       step="0.01"
                                       min="0">
                            </div>
                            <div id="cambio-display" class="change-display neutral">
                                <span>Cambio / Vuelto</span>
                                <span id="cambio-amount">$0.00</span>
                            </div>
                        </div>
                    </div>

                    <!-- Procesar venta -->
                    <button id="btn-procesar" class="btn-procesar-venta" disabled>
                        🧾 PROCESAR VENTA
                        <span class="pulse-ring"></span>
                    </button>

                </div>
                <!-- Fin derecha -->

            </div>
            <!-- Fin pos-wrapper -->

        </div>
        <!-- Fin content -->

    </div>

    <!-- Modal: Escáner -->
    <div id="camera-modal" class="camera-modal" style="display:none;">
        <div class="camera-modal-content">
            <div class="camera-modal-header">
                <h5>📷 Escáner de Código de Barras</h5>
                <button id="btn-camera-close" class="camera-close-btn" title="Cerrar">✕</button>
            </div>
            <div class="camera-modal-body">
                <div id="camera-reader" class="camera-reader"></div>
                <div id="camera-status" class="camera-status">
                    <span class="camera-status-dot"></span>
                    Apunte el código de barras hacia la cámara
                </div>
            </div>
            <div class="camera-modal-footer">
                <div id="camera-last-scan" class="camera-last-scan"></div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js?v=<?= time() ?>"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js?v=<?= time() ?>"></script>
    <script src="frontend/js/pos.js?v=<?= time() ?>"></script>
</body>

</html>