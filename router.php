<?php
// Enrutador global para Vercel
// Truco maestro: Vercel lee el código para saber qué subir.
// Este bloque if (false) NUNCA se ejecuta, pero fuerza a Vercel a subir TODO.
if (false) {
    require 'index.php';
    require 'dashboard.php';
    require 'pos.php';
    require 'historial.php';
    require 'clientes.php';
    require 'catalogo.php';
    require 'backend/api_cliente.php';
    require 'backend/api_historial.php';
    require 'backend/api_producto.php';
    require 'backend/api_venta.php';
    require 'backend/conexion.php';
    require 'backend/logout.php';
    require 'backend/procesar_login.php';
    require 'backend/auth_api.php';
    require 'backend/includes/sidebar.php';
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = ltrim($uri, '/');

if ($path === '' || $path === '/') {
    $path = 'index.php';
}

$target = __DIR__ . '/' . $path;

if (file_exists($target) && is_file($target) && basename($target) !== 'router.php') {
    chdir(dirname($target));
    require basename($target);
} else {
    http_response_code(404);
    echo "404 Not Found en Vercel: El archivo no se encontró en la ruta " . htmlspecialchars($path);
}
