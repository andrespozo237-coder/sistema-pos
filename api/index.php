<?php
// Enrutador global para Vercel
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = ltrim($uri, '/');

if ($path === '' || $path === '/') {
    $path = 'index.php';
}

// El proyecto raíz está un nivel arriba de la carpeta /api
$projectRoot = __DIR__ . '/..';
$target = $projectRoot . '/' . $path;

if (file_exists($target) && is_file($target)) {
    chdir(dirname($target));
    require basename($target);
} else {
    http_response_code(404);
    echo "404 Not Found en Vercel: El archivo no se encontró en la ruta " . htmlspecialchars($path);
}
