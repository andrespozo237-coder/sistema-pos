<?php
// Enrutador global para Vercel
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = ltrim($uri, '/');

if ($path === '' || $path === '/') {
    $path = 'index.php';
}

// El proyecto raíz está un nivel arriba de la carpeta /api
$projectRoot = dirname(__DIR__);
$target = $projectRoot . '/' . $path;

if (file_exists($target) && is_file($target)) {
    chdir(dirname($target));
    require basename($target);
} else {
    http_response_code(404);
    $debug = [
        'path_buscado' => $path,
        'target_absoluto' => $target,
        'cwd_actual' => getcwd(),
        'existe_projectRoot' => file_exists($projectRoot),
        'contenido_raiz' => file_exists($projectRoot) ? scandir($projectRoot) : [],
        'contenido_backend' => file_exists($projectRoot . '/backend') ? scandir($projectRoot . '/backend') : []
    ];
    echo "<h2>404 Not Found en Vercel</h2>";
    echo "<p>El archivo no se encontró en la ruta: <b>" . htmlspecialchars($path) . "</b></p>";
    echo "<h3>Información de Depuración (Cópiala y envíamela):</h3>";
    echo "<pre>" . print_r($debug, true) . "</pre>";
}
