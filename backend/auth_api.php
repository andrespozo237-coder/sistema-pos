<?php
// Middleware para asegurar que la API solo sea consumida por usuarios autenticados

if (session_status() === PHP_SESSION_NONE) {
    require_once __DIR__ . '/session_handler.php';
    session_start();
}

if (!isset($_SESSION['usuario_activo'])) {
    http_response_code(401); // Unauthorized
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'estado' => 'error',
        'mensaje' => 'No autorizado. Debe iniciar sesión.'
    ]);
    exit;
}

// IMPORTANTE: Liberar el bloqueo del archivo de sesión inmediatamente
// para permitir solicitudes concurrentes (AJAX) sin cuellos de botella.
session_write_close();
?>