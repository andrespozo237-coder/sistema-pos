<?php
// API Historial de Facturas
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'conexion.php';
require_once 'auth_api.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        // GET: Listar ventas o detalles
        case 'GET':
            $action = $_GET['action'] ?? 'listar';

            if ($action === 'detalles') {
                // Detalles de factura
                $ventaId = (int) ($_GET['venta_id'] ?? 0);
                if ($ventaId <= 0) {
                    http_response_code(400);
                    echo json_encode(['estado' => 'error', 'mensaje' => 'venta_id es requerido']);
                    exit;
                }

                // Datos de venta
                $stmt = $pdo->prepare(
                    "SELECT v.id, v.fecha_emision, v.total_factura, v.descuento, v.estado,
                            c.nombre_completo AS cliente, c.cedula, c.correo,
                            'ADMINISTRADOR' AS cajero
                     FROM ventas v
                     JOIN clientes c ON v.cliente_id = c.id
                     WHERE v.id = ?"
                );
                $stmt->execute([$ventaId]);
                $venta = $stmt->fetch();

                if (!$venta) {
                    http_response_code(404);
                    echo json_encode(['estado' => 'error', 'mensaje' => 'Factura no encontrada']);
                    exit;
                }

                // Productos de factura
                $stmt = $pdo->prepare(
                    "SELECT dv.cantidad, dv.precio_congelado,
                            (dv.cantidad * dv.precio_congelado) AS subtotal,
                            p.codigo_barras, p.nombre_producto
                     FROM detalles_venta dv
                     JOIN productos p ON dv.producto_id = p.id
                     WHERE dv.venta_id = ?
                     ORDER BY dv.id ASC"
                );
                $stmt->execute([$ventaId]);
                $detalles = $stmt->fetchAll();

                echo json_encode([
                    'estado'   => 'success',
                    'venta'    => $venta,
                    'detalles' => $detalles
                ]);

            } else {
                // Listar ventas
                $fechaInicio = $_GET['fecha_inicio'] ?? '';
                $fechaFin    = $_GET['fecha_fin'] ?? '';
                $clienteQ    = trim($_GET['cliente'] ?? '');
                $facturaId   = trim($_GET['factura_id'] ?? '');

                // Por defecto: último mes
                if (empty($fechaInicio)) {
                    $fechaInicio = date('Y-m-d', strtotime('-30 days'));
                }
                if (empty($fechaFin)) {
                    $fechaFin = date('Y-m-d');
                }

                // Construir consulta
                $sql = "SELECT v.id, v.fecha_emision, v.total_factura, v.descuento, v.estado,
                               c.nombre_completo AS cliente, c.cedula,
                               'ADMINISTRADOR' AS cajero
                        FROM ventas v
                        JOIN clientes c ON v.cliente_id = c.id
                        WHERE v.fecha_emision >= ? AND v.fecha_emision <= ?";
                $params = [$fechaInicio . ' 00:00:00', $fechaFin . ' 23:59:59'];

                if (!empty($clienteQ)) {
                    $sql .= " AND (c.nombre_completo LIKE ? OR c.cedula LIKE ?)";
                    $params[] = "%$clienteQ%";
                    $params[] = "%$clienteQ%";
                }

                if (!empty($facturaId)) {
                    $sql .= " AND v.id = ?";
                    $params[] = $facturaId;
                }

                $sql .= " ORDER BY v.fecha_emision DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $ventas = $stmt->fetchAll();

                // Resumen (solo pagadas)
                $totalVendido = 0;
                $cantidadPagadas = 0;
                $cantidadTotal = count($ventas);

                foreach ($ventas as $v) {
                    if ($v['estado'] === 'pagada') {
                        $totalVendido += (float) $v['total_factura'];
                        $cantidadPagadas++;
                    }
                }

                $ticketPromedio = $cantidadPagadas > 0
                    ? round($totalVendido / $cantidadPagadas, 2)
                    : 0;

                echo json_encode([
                    'estado'  => 'success',
                    'ventas'  => $ventas,
                    'resumen' => [
                        'total_vendido'      => round($totalVendido, 2),
                        'cantidad_facturas'  => $cantidadTotal,
                        'cantidad_pagadas'   => $cantidadPagadas,
                        'ticket_promedio'    => $ticketPromedio
                    ]
                ]);
            }
            break;

        // POST: Anular factura y restaurar stock
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Datos JSON inválidos']);
                exit;
            }

            if (!$input || ($input['action'] ?? '') !== 'anular') {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Acción no válida']);
                exit;
            }

            $ventaId = (int) ($input['venta_id'] ?? 0);
            if ($ventaId <= 0) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'venta_id es requerido']);
                exit;
            }

            $pdo->beginTransaction();

            // Verificar existencia
            $stmt = $pdo->prepare("SELECT id, estado FROM ventas WHERE id = ? FOR UPDATE");
            $stmt->execute([$ventaId]);
            $venta = $stmt->fetch();

            if (!$venta) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Factura no encontrada']);
                exit;
            }

            if ($venta['estado'] === 'anulada') {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Esta factura ya fue anulada previamente']);
                exit;
            }

            // Obtener detalles
            $stmt = $pdo->prepare("SELECT producto_id, cantidad FROM detalles_venta WHERE venta_id = ?");
            $stmt->execute([$ventaId]);
            $detalles = $stmt->fetchAll();

            // Restaurar stock
            $stmtStock = $pdo->prepare("UPDATE productos SET stock_disponible = stock_disponible + ? WHERE id = ?");
            foreach ($detalles as $det) {
                $stmtStock->execute([$det['cantidad'], $det['producto_id']]);
            }

            // Cambiar estado a anulada
            $stmt = $pdo->prepare("UPDATE ventas SET estado = 'anulada' WHERE id = ?");
            $stmt->execute([$ventaId]);

            $pdo->commit();

            echo json_encode([
                'estado'  => 'success',
                'mensaje' => "Factura #$ventaId anulada. Stock restaurado para " . count($detalles) . " producto(s)."
            ]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['estado' => 'error', 'mensaje' => 'Método no permitido']);
            break;
    }

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Error en la base de datos: ' . $e->getMessage()]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => $e->getMessage()]);
}
