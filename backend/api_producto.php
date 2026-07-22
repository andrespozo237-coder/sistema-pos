<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Header: Content-type');

require_once('conexion.php');
require_once('auth_api.php');

$method = $_SERVER['REQUEST_METHOD'];

$input = null;
if (in_array($method, ['POST', 'PUT'])) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['estado' => 'error', 'mensaje' => 'Datos JSON inválidos']);
        exit;
    }
}

try {
    switch ($method) {
        case 'GET':
            $search = $_GET['q'] ?? '';
            $sql = "SELECT * FROM productos WHERE nombre_producto LIKE ? OR codigo_barras LIKE ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(["%$search%", "%$search%"]);
            echo json_encode($stmt->fetchAll());
            break;
        case 'POST':
            if (empty($input['codigo_barras']) || empty($input['nombre_producto'])) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Código de barras y nombre son obligatorios']);
                exit;
            }
            if (!isset($input['precio_actual']) || !isset($input['stock_disponible']) || 
                !is_numeric($input['precio_actual']) || !is_numeric($input['stock_disponible']) || 
                $input['precio_actual'] < 0 || $input['stock_disponible'] < 0) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'El precio y stock deben ser números válidos y no negativos']);
                exit;
            }

            $codigoS = htmlspecialchars(trim($input['codigo_barras']), ENT_QUOTES, 'UTF-8');
            $nombreS = htmlspecialchars(trim($input['nombre_producto']), ENT_QUOTES, 'UTF-8');

            $sql = "INSERT INTO productos (codigo_barras, nombre_producto, precio_actual, stock_disponible) VALUES (?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $codigoS,
                $nombreS,
                (float)$input['precio_actual'],
                (int)$input['stock_disponible']
            ]);
            echo json_encode(['estado' => 'success', 'mensaje' => 'Producto Creado correctamente']);
            break;
        case 'PUT':
            if (empty($input['id']) || empty($input['codigo_barras']) || empty($input['nombre_producto'])) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'ID, Código de barras y nombre son obligatorios']);
                exit;
            }
            if (!isset($input['precio_actual']) || !isset($input['stock_disponible']) || 
                !is_numeric($input['precio_actual']) || !is_numeric($input['stock_disponible']) || 
                $input['precio_actual'] < 0 || $input['stock_disponible'] < 0) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'El precio y stock deben ser números válidos y no negativos']);
                exit;
            }

            $codigoS = htmlspecialchars(trim($input['codigo_barras']), ENT_QUOTES, 'UTF-8');
            $nombreS = htmlspecialchars(trim($input['nombre_producto']), ENT_QUOTES, 'UTF-8');

            $sql = "UPDATE productos SET codigo_barras = ?, nombre_producto = ?, precio_actual = ?, stock_disponible = ? WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $codigoS,
                $nombreS,
                (float)$input['precio_actual'],
                (int)$input['stock_disponible'],
                $input['id']
            ]);
            echo json_encode(['estado' => 'success', 'mensaje' => 'Producto Actualizado']);
            break;
        case 'DELETE':
            $id = $_GET['id'] ?? 0;
            $sql = $pdo->prepare("DELETE FROM productos WHERE id = ?");
            $sql->execute([$id]);
            echo json_encode(['estado' => 'success', 'mensaje' => 'Producto Eliminado']);
            break;
        default:
            http_response_code(404);
            echo json_encode(['estado' => 'error', 'mensaje' => 'Error en la Base de Datos']);
            break;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Error en la Base de Datos: ' . $e->getMessage()]);
}

?>