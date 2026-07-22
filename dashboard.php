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
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="frontend/css/dashboard.css">
</head>

<body>
    <div class="d-flex">
        <?php include 'backend/includes/sidebar.php'; ?>
        <div id="content" class="w-100" style="margin-left: 280px;">
            <nav class="navbar navbar-light bg-white shadow-sm mb-4 p-3">
                <div class="container-fluid d-flex justify-content-between">
                    <span class="navbar-brand mb-0 h4 text-secondary">📊 Dashboard General</span>
                    <div class="d-flex align-items-center">
                        <span class="me-2 fw-bold" style="color: var(--verde-oscuro);">
                            👤 <?php echo strtoupper($usuario['nombre']) . ' | Rol: ' . ucfirst($usuario['rol']) ?>
                        </span>
                        <a href="backend/logout.php" class="btn btn-sm btn-outline-danger fw-bold ms-3">Cerrar Sesión</a>
                    </div>
                </div>
            </nav>
            <div class="container-fluid px-4">
                <div class="row">
                    <div class="col-12">
                        <div class="card shadow-sm border-0 border-top border-4"
                            style="border-color: var(--verde-medio);">
                            <div class="card-body py-5 text-center bg-white rounded">
                                <h2 class="color:var(--verde-oscuro)">Bienvenido,
                                    <?php echo strtoupper($usuario['nombre']) ?>!
                                </h2>
                                <p class="text-muted fs-5 mt-3">Seleccione una opción del menú lateral para operar el
                                    sistema</p>

                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</body>

</html>