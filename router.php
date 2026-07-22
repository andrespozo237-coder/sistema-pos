<?php
// Enrutador global para Vercel
// Esto nos permite usar una sola Serverless Function y evitar todos los límites de Vercel

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = ltrim($uri, '/');

if ($path === '' || $path === '/') {
    $path = 'index.php';
}

if (file_exists($path) && is_file($path)) {
    // Cambiar al directorio del archivo para que los includes relativos funcionen
    chdir(dirname($path));
    require basename($path);
} else {
    http_response_code(404);
    echo "404 Not Found";
}
