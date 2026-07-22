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
    <title>Dashboard General</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="frontend/css/dashboard.css">
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
    </style>
</head>

<body>
    <div class="d-flex">
        <?php include 'backend/includes/sidebar.php'; ?>
        <div id="content" class="w-100" style="margin-left: 280px;">
            <nav class="navbar navbar-light bg-white shadow-sm mb-4 p-3">
                <div class="container-fluid d-flex justify-content-between">
                    <span class="navbar-brand mb-0 h4 text-secondary">📦 Catálogo de Productos</span>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fw-bold" style="color: var(--verde-oscuro);">
                            👤 <?php echo strtoupper($usuario['nombre']) . ' | Rol: ' . ucfirst($usuario['rol']) ?>
                        </span>
                        <a href="backend/logout.php" class="btn btn-sm btn-outline-danger fw-bold ms-3">Cerrar Sesión</a>
                    </div>
                </div>
            </nav>
            <div class="container-fluid px-4">
                <div class="d-flex justify-content-between mb-4">
                    <input type="text" id="input-busqueda" class="form-control w-25"
                        placeholder="🔍 Buscar por nombre o código">
                    <button class="btn btn-verde" onclick="abrirModal()">Nuevo Producto +</button>
                </div>
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div id="tabla-count" class="text-muted fw-bold mb-3"></div>
                        <table class="table table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>Código</th>
                                    <th>Nombre</th>
                                    <th>Precio</th>
                                    <th>Stock</th>
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
    <div class="modal" id="modalProducto" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalTitulo">Gestionar Producto</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="hidden" id="prod-id">
                    <div class="mb-3">
                        <label>Código de Barras</label>
                        <input type="text" id="prod-codigo" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Nombre</label>
                        <input type="text" id="prod-nombre" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label>Precio</label>
                        <input type="number" id="prod-precio" class="form-control" step="0.01" min="0">
                    </div>
                    <div class="mb-3">
                        <label>Stock</label>
                        <input type="number" id="prod-stock" class="form-control" min="0">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button class="btn btn-verde" onclick="guardarProducto()">Guardar Cambios</button>
                </div>
            </div>
        </div>
    </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="frontend/js/catalogo.js"></script>
</body>

</html>