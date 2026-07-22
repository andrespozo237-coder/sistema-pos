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
    <title>Gestión de Clientes</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="frontend/css/dashboard.css">
    <link rel="stylesheet" href="frontend/css/historial.css">
    <style>
        .btn-verde {
            background-color: var(--verde-oscuro);
            color: white;
        }

        .btn-verde:hover {
            background-color: var(--verde-medio);
            color: white;
        }
    </style>
</head>

<body>
    <div class="d-flex">
        <?php include 'backend/includes/sidebar.php'; ?>
        <div id="content" class="w-100" style="margin-left: 280px;">
            <nav class="navbar navbar-light bg-white shadow-sm mb-4 p-3">
                <div class="container-fluid d-flex justify-content-between">
                    <span class="navbar-brand mb-0 h4 text-secondary">👥 Gestión de Clientes</span>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fw-bold" style="color: var(--verde-oscuro);">
                            👤 <?php echo strtoupper($usuario['nombre']) . ' | Rol: ' . ucfirst($usuario['rol']) ?>
                        </span>
                        <a href="backend/logout.php" class="btn btn-sm btn-outline-danger fw-bold ms-3">Cerrar Sesión</a>
                    </div>
                </div>
            </nav>
            <div class="container-fluid px-4 mt-3">
                <!-- Dashboard Cards (Estilo Historial) -->
                <style>
                    /* Colores personalizados para los iconos de clientes */
                    .card-clientes .resumen-icon { background: rgba(13, 110, 253, 0.1); } /* primary */
                    .card-estrella { border-left-color: #198754; }
                    .card-estrella .resumen-icon { background: rgba(25, 135, 84, 0.1); } /* success */
                    .card-nuevos { border-left-color: #0dcaf0; }
                    .card-nuevos .resumen-icon { background: rgba(13, 202, 240, 0.1); } /* info */
                    .card-vip { border-left-color: #ffc107; }
                    .card-vip .resumen-icon { background: rgba(255, 193, 7, 0.1); } /* warning */
                    .card-prom { border-left-color: #6c757d; }
                    .card-prom .resumen-icon { background: rgba(108, 117, 125, 0.1); } /* secondary */
                    .card-riesgo { border-left-color: #dc3545; }
                    .card-riesgo .resumen-icon { background: rgba(220, 53, 69, 0.1); } /* danger */
                </style>
                <div class="resumen-cards" id="clientes-dashboard">
                    <div class="resumen-card card-clientes">
                        <div class="resumen-icon">👥</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Total Clientes</span>
                            <span class="resumen-valor loading" id="dash-total-clientes">...</span>
                        </div>
                    </div>
                    <div class="resumen-card card-estrella">
                        <div class="resumen-icon">⭐</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Cliente Estrella</span>
                            <span class="resumen-valor loading" id="dash-cliente-estrella" style="font-size: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">...</span>
                        </div>
                    </div>
                    <div class="resumen-card card-nuevos">
                        <div class="resumen-icon">📈</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Nuevos (Mes)</span>
                            <span class="resumen-valor loading" id="dash-nuevos-mes">...</span>
                        </div>
                    </div>
                    <div class="resumen-card card-vip">
                        <div class="resumen-icon">💎</div>
                        <div class="resumen-info">
                            <span class="resumen-label">VIPs / Frecuentes</span>
                            <span class="resumen-valor loading" id="dash-vip-frecuentes">...</span>
                        </div>
                    </div>
                    <div class="resumen-card card-prom">
                        <div class="resumen-icon">🧾</div>
                        <div class="resumen-info">
                            <span class="resumen-label">Ticket Promedio</span>
                            <span class="resumen-valor loading" id="dash-ticket-promedio">...</span>
                        </div>
                    </div>
                    <div class="resumen-card card-riesgo">
                        <div class="resumen-icon">⚠️</div>
                        <div class="resumen-info">
                            <span class="resumen-label">En Riesgo</span>
                            <span class="resumen-valor loading" id="dash-en-riesgo">...</span>
                        </div>
                    </div>
                </div>

                <div class="d-flex justify-content-between mb-4 mt-2">
                    <input type="text" id="input-busqueda" class="form-control w-25"
                        placeholder="🔍 Buscar por nombre o cédula">
                    <button class="btn btn-verde" onclick="abrirModal()">Nuevo Cliente +</button>
                </div>
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div id="tabla-count" class="text-muted fw-bold mb-3"></div>
                        <table class="table table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Cédula/RUC</th>
                                    <th>Nombre Completo</th>
                                    <th>Correo Electrónico</th>
                                    <th>Etiqueta</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="cuerpo-tabla"></tbody>
                        </table>
                        <div id="paginacion-container" class="mt-3"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="modal" id="modalCliente" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalTitulo">Gestionar Cliente</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="cli-id">
                    <div class="mb-3">
                        <label>Cédula o RUC</label>
                        <input type="text" id="cli-cedula" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Nombre Completo</label>
                        <input type="text" id="cli-nombre" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Correo Electrónico</label>
                        <input type="email" id="cli-correo" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Fecha de Nacimiento</label>
                        <input type="date" id="cli-fecha-nacimiento" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Notas / Preferencias</label>
                        <textarea id="cli-notas" class="form-control" rows="2"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn btn-verde" onclick="guardarCliente()">Guardar Cambios</button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Modal Perfil Cliente -->
    <div class="modal" id="modalPerfil" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Perfil del Cliente: <span id="perfil-nombre" class="fw-bold"></span></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <p><strong>Cédula:</strong> <span id="perfil-cedula"></span></p>
                            <p><strong>Correo:</strong> <span id="perfil-correo"></span></p>
                            <p><strong>Cumpleaños:</strong> <span id="perfil-cumpleanos"></span></p>
                        </div>
                        <div class="col-md-6 text-end">
                            <h4 id="perfil-etiqueta" class="badge bg-secondary fs-5"></h4>
                            <p class="mt-2"><strong>Total Gastado:</strong> $<span id="perfil-total-gastado">0.00</span></p>
                            <p><strong>Última Visita:</strong> <span id="perfil-ultima-visita"></span></p>
                        </div>
                    </div>
                    <div class="mb-3">
                        <strong>Notas:</strong>
                        <p id="perfil-notas" class="text-muted fst-italic border rounded p-2 bg-light"></p>
                    </div>
                    
                    <h6 class="fw-bold mt-4">Últimas Compras</h6>
                    <table class="table table-sm table-bordered mt-2">
                        <thead class="table-light">
                            <tr>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody id="perfil-compras-tabla">
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="frontend/js/clientes.js"></script>
</body>

</html>