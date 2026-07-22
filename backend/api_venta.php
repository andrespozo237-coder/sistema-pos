<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once('conexion.php');
require_once('auth_api.php');

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// Validaciones
if (json_last_error() !== JSON_ERROR_NONE || !$input) {
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Datos JSON inválidos']);
    exit;
}

if (empty($input['cliente_id'])) {
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Debe seleccionar un cliente']);
    exit;
}

if (empty($input['productos']) || !is_array($input['productos'])) {
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'El carrito está vacío']);
    exit;
}

if (empty($input['total_factura']) || !is_numeric($input['total_factura']) || floatval($input['total_factura']) <= 0) {
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'El total de la factura debe ser un número mayor a cero']);
    exit;
}

$clienteId    = (int) $input['cliente_id'];
$productos    = $input['productos'];
$totalFactura = round((float) $input['total_factura'], 2);
$descuento    = isset($input['descuento']) ? round((float) $input['descuento'], 2) : 0.00;

try {
    // Iniciar transacción
    $pdo->beginTransaction();

    // Verificar que el cliente exista
    $stmt = $pdo->prepare("SELECT id FROM clientes WHERE id = ?");
    $stmt->execute([$clienteId]);
    if (!$stmt->fetch()) {
        throw new Exception('El cliente seleccionado no existe en el sistema');
    }

    // Verificar stock de todos los productos antes de proceder
    foreach ($productos as $index => $prod) {
        if (empty($prod['producto_id']) || empty($prod['cantidad']) || empty($prod['precio_congelado']) ||
            !is_numeric($prod['cantidad']) || !is_numeric($prod['precio_congelado'])) {
            throw new Exception("Datos incompletos o inválidos en el producto #" . ($index + 1));
        }

        $cantidad = (int) $prod['cantidad'];
        if ($cantidad <= 0) {
            throw new Exception("La cantidad debe ser mayor a 0 para el producto #" . ($index + 1));
        }

        $stmt = $pdo->prepare("SELECT id, nombre_producto, stock_disponible FROM productos WHERE id = ?");
        $stmt->execute([$prod['producto_id']]);
        $dbProd = $stmt->fetch();

        if (!$dbProd) {
            throw new Exception("El producto ID {$prod['producto_id']} no existe");
        }

        if ((int) $dbProd['stock_disponible'] < $cantidad) {
            throw new Exception(
                "Stock insuficiente para '{$dbProd['nombre_producto']}'. " .
                "Disponible: {$dbProd['stock_disponible']}, Solicitado: {$cantidad}"
            );
        }
    }

    // Crear venta
    $stmt = $pdo->prepare("INSERT INTO ventas (cliente_id, descuento, total_factura) VALUES (?, ?, ?)");
    $stmt->execute([$clienteId, $descuento, $totalFactura]);
    $ventaId = (int) $pdo->lastInsertId();

    // Guardar detalles y stock
    $stmtDetalle = $pdo->prepare(
        "INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_congelado) VALUES (?, ?, ?, ?)"
    );
    $stmtStock = $pdo->prepare(
        "UPDATE productos SET stock_disponible = stock_disponible - ? WHERE id = ? AND stock_disponible >= ?"
    );

    foreach ($productos as $prod) {
        $productoId     = (int) $prod['producto_id'];
        $cantidad       = (int) $prod['cantidad'];
        $precioCongelado = round((float) $prod['precio_congelado'], 2);

        // Insertar línea de detalle
        $stmtDetalle->execute([$ventaId, $productoId, $cantidad, $precioCongelado]);

        // Reducir stock
        $stmtStock->execute([$cantidad, $productoId, $cantidad]);

        if ($stmtStock->rowCount() === 0) {
            throw new Exception("Error al actualizar stock del producto ID {$productoId} — posible conflicto de concurrencia");
        }
    }

    // Confirmar transacción
    $pdo->commit();

    // Obtener datos para recibo
    $stmt = $pdo->prepare(
        "SELECT v.*, c.cedula, c.nombre_completo, c.correo
         FROM ventas v
         JOIN clientes c ON v.cliente_id = c.id
         WHERE v.id = ?"
    );
    $stmt->execute([$ventaId]);
    $venta = $stmt->fetch();

    $stmt = $pdo->prepare(
        "SELECT dv.*, p.codigo_barras, p.nombre_producto
         FROM detalles_venta dv
         JOIN productos p ON dv.producto_id = p.id
         WHERE dv.venta_id = ?"
    );
    $stmt->execute([$ventaId]);
    $detalles = $stmt->fetchAll();

    // Cajero
    $cajero = 'ADMINISTRADOR';

    echo json_encode([
        'estado'   => 'success',
        'mensaje'  => 'Venta procesada exitosamente',
        'venta'    => $venta,
        'detalles' => $detalles,
        'cajero'   => $cajero
    ]);

} catch (Exception $e) {
    // Revertir la transacción si hubo algún error
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => $e->getMessage()]);
}

?>
