<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once('conexion.php');
require_once('auth_api.php');

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            $search = $_GET['q'] ?? '';
            $action = $_GET['action'] ?? 'search';

            if ($action === 'stats') {
                $sql  = "SELECT c.*, 
                                COALESCE(SUM(v.total_factura), 0) as total_gastado,
                                MAX(v.fecha_emision) as ultima_visita
                         FROM clientes c
                         LEFT JOIN ventas v ON c.id = v.cliente_id AND v.estado = 'pagada'
                         GROUP BY c.id";
                $stmt = $pdo->query($sql);
                $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                $totalClientes = count($clientes);
                $nuevosMes = 0;
                $vipFrecuentes = 0;
                $enRiesgo = 0;
                $clienteEstrella = null;
                $maxGastado = 0;
                
                $currentMonth = date('Y-m');
                
                foreach ($clientes as $c) {
                    if (strpos($c['fecha_registro'], $currentMonth) === 0) {
                        $nuevosMes++;
                    }
                    if ($c['total_gastado'] > $maxGastado) {
                        $maxGastado = $c['total_gastado'];
                        $clienteEstrella = $c;
                    }
                    if ($c['total_gastado'] > 500) {
                        $vipFrecuentes++;
                    } elseif ($c['ultima_visita'] && strtotime($c['ultima_visita']) > strtotime('-30 days')) {
                        $vipFrecuentes++;
                    } elseif ($c['ultima_visita'] && strtotime($c['ultima_visita']) < strtotime('-90 days')) {
                        $enRiesgo++;
                    }
                }
                
                $stmt = $pdo->query("SELECT AVG(total_factura) as ticket_promedio FROM ventas WHERE estado = 'pagada'");
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $ticketPromedio = $row['ticket_promedio'] ?? 0;
                
                echo json_encode([
                    'total_clientes' => $totalClientes,
                    'nuevos_mes' => $nuevosMes,
                    'cliente_estrella' => $clienteEstrella ? $clienteEstrella['nombre_completo'] . ' ($' . number_format((float)$maxGastado, 2) . ')' : 'N/A',
                    'vip_frecuentes' => $vipFrecuentes,
                    'en_riesgo' => $enRiesgo,
                    'ticket_promedio' => '$' . number_format((float)$ticketPromedio, 2)
                ]);
            } elseif ($action === 'consumidor_final') {
                // Obtener o crear el registro de Consumidor Final
                $stmt = $pdo->prepare("SELECT * FROM clientes WHERE cedula = '9999999999'");
                $stmt->execute();
                $cf = $stmt->fetch();

                if (!$cf) {
                    $stmt = $pdo->prepare(
                        "INSERT INTO clientes (cedula, nombre_completo, correo) VALUES ('9999999999', 'CONSUMIDOR FINAL', 'consumidor.final@pos.local')"
                    );
                    $stmt->execute();
                    $id = (int) $pdo->lastInsertId();
                    $cf = [
                        'id'              => $id,
                        'cedula'          => '9999999999',
                        'nombre_completo' => 'CONSUMIDOR FINAL',
                        'correo'          => 'consumidor.final@pos.local'
                    ];
                }

                echo json_encode(['estado' => 'success', 'cliente' => $cf]);
            } elseif ($action === 'perfil') {
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    echo json_encode(['estado' => 'error', 'mensaje' => 'ID requerido']);
                    exit;
                }
                $stmt = $pdo->prepare("SELECT c.*, 
                                COALESCE(SUM(v.total_factura), 0) as total_gastado,
                                MAX(v.fecha_emision) as ultima_visita,
                                COUNT(v.id) as total_compras
                         FROM clientes c
                         LEFT JOIN ventas v ON c.id = v.cliente_id AND v.estado = 'pagada'
                         WHERE c.id = ?
                         GROUP BY c.id");
                $stmt->execute([$id]);
                $cliente = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$cliente) {
                    echo json_encode(['estado' => 'error', 'mensaje' => 'Cliente no encontrado']);
                    exit;
                }
                
                $cliente['etiqueta'] = 'Ocasional';
                if ($cliente['total_gastado'] > 500) {
                    $cliente['etiqueta'] = 'VIP';
                } elseif ($cliente['ultima_visita'] && strtotime($cliente['ultima_visita']) > strtotime('-30 days')) {
                    $cliente['etiqueta'] = 'Frecuente';
                } elseif ($cliente['ultima_visita'] && strtotime($cliente['ultima_visita']) < strtotime('-90 days')) {
                    $cliente['etiqueta'] = 'En Riesgo';
                }

                $stmt = $pdo->prepare("SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha_emision DESC LIMIT 10");
                $stmt->execute([$id]);
                $ventas = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode(['estado' => 'success', 'cliente' => $cliente, 'ventas' => $ventas]);
            } else {
                // Búsqueda por cédula o nombre
                $sql  = "SELECT c.*, 
                                COALESCE(SUM(v.total_factura), 0) as total_gastado,
                                MAX(v.fecha_emision) as ultima_visita
                         FROM clientes c
                         LEFT JOIN ventas v ON c.id = v.cliente_id AND v.estado = 'pagada'
                         WHERE c.cedula LIKE ? OR c.nombre_completo LIKE ?
                         GROUP BY c.id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute(["%$search%", "%$search%"]);
                $clientes = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($clientes as &$c) {
                    $c['etiqueta'] = 'Ocasional';
                    if ($c['total_gastado'] > 500) {
                        $c['etiqueta'] = 'VIP';
                    } elseif ($c['ultima_visita'] && strtotime($c['ultima_visita']) > strtotime('-30 days')) {
                        $c['etiqueta'] = 'Frecuente';
                    } elseif ($c['ultima_visita'] && strtotime($c['ultima_visita']) < strtotime('-90 days')) {
                        $c['etiqueta'] = 'En Riesgo';
                    }
                }
                echo json_encode($clientes);
            }
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Datos JSON inválidos']);
                exit;
            }

            // Validar campos obligatorios
            if (empty($input['cedula']) || empty($input['nombre_completo'])) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Cédula y nombre son obligatorios']);
                exit;
            }

            // Validar Cédula / RUC
            $valid = validarIdentificacion($input['cedula']);
            if (!$valid['valido']) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => $valid['mensaje']]);
                exit;
            }

            // Validar formato de correo si existe
            if (!empty($input['correo']) && !filter_var($input['correo'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Formato de correo electrónico inválido.']);
                exit;
            }

            // Verificar si el cliente ya existe
            $stmt = $pdo->prepare("SELECT * FROM clientes WHERE cedula = ?");
            $stmt->execute([$input['cedula']]);
            $existing = $stmt->fetch();

            if ($existing) {
                echo json_encode([
                    'estado'  => 'success',
                    'cliente' => $existing,
                    'mensaje' => 'Cliente ya registrado en el sistema'
                ]);
            } else {
                $sql  = "INSERT INTO clientes (cedula, nombre_completo, correo, fecha_nacimiento, notas) VALUES (?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                
                $cedulaS = trim($input['cedula']);
                $nombreS = htmlspecialchars(trim($input['nombre_completo']), ENT_QUOTES, 'UTF-8');
                $correoS = !empty($input['correo']) ? trim($input['correo']) : null;
                $fechaNacimiento = !empty($input['fecha_nacimiento']) ? trim($input['fecha_nacimiento']) : null;
                $notas = !empty($input['notas']) ? htmlspecialchars(trim($input['notas']), ENT_QUOTES, 'UTF-8') : null;
                
                $stmt->execute([$cedulaS, $nombreS, $correoS, $fechaNacimiento, $notas]);

                $newClient = [
                    'id'              => (int) $pdo->lastInsertId(),
                    'cedula'          => $cedulaS,
                    'nombre_completo' => $nombreS,
                    'correo'          => $correoS,
                    'fecha_nacimiento'=> $fechaNacimiento,
                    'notas'           => $notas
                ];

                echo json_encode([
                    'estado'  => 'success',
                    'cliente' => $newClient,
                    'mensaje' => 'Cliente registrado exitosamente'
                ]);
            }
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Datos JSON inválidos']);
                exit;
            }
            if (empty($input['id']) || empty($input['cedula']) || empty($input['nombre_completo'])) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'ID, Cédula y nombre son obligatorios']);
                exit;
            }

            // Validar Cédula / RUC
            $valid = validarIdentificacion($input['cedula']);
            if (!$valid['valido']) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => $valid['mensaje']]);
                exit;
            }

            // Validar formato de correo si existe
            if (!empty($input['correo']) && !filter_var($input['correo'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'Formato de correo electrónico inválido.']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE clientes SET cedula = ?, nombre_completo = ?, correo = ?, fecha_nacimiento = ?, notas = ? WHERE id = ?");
            
            $cedulaS = trim($input['cedula']);
            $nombreS = htmlspecialchars(trim($input['nombre_completo']), ENT_QUOTES, 'UTF-8');
            $correoS = !empty($input['correo']) ? trim($input['correo']) : null;
            $fechaNacimiento = !empty($input['fecha_nacimiento']) ? trim($input['fecha_nacimiento']) : null;
            $notas = !empty($input['notas']) ? htmlspecialchars(trim($input['notas']), ENT_QUOTES, 'UTF-8') : null;
            
            $stmt->execute([
                $cedulaS,
                $nombreS,
                $correoS,
                $fechaNacimiento,
                $notas,
                $input['id']
            ]);
            echo json_encode(['estado' => 'success', 'mensaje' => 'Cliente actualizado exitosamente']);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['estado' => 'error', 'mensaje' => 'ID es obligatorio para eliminar']);
                exit;
            }
            $stmt = $pdo->prepare("DELETE FROM clientes WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['estado' => 'success', 'mensaje' => 'Cliente eliminado exitosamente']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['estado' => 'error', 'mensaje' => 'Método no permitido']);
            break;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Error en la base de datos: ' . $e->getMessage()]);
}

// Funciones de validación
function validarIdentificacion($id) {
    if (!preg_match('/^\d+$/', $id)) {
        return ['valido' => false, 'mensaje' => 'Solo se permiten dígitos numéricos'];
    }
    
    if (strlen($id) === 10) {
        return validarCedulaEcuador($id);
    } elseif (strlen($id) === 13) {
        return validarRucEcuador($id);
    }
    
    return ['valido' => false, 'mensaje' => 'La identificación debe tener 10 o 13 dígitos'];
}

function validarCedulaEcuador($cedula) {
    $provincia = (int) substr($cedula, 0, 2);
    if ($provincia < 1 || ($provincia > 24 && $provincia !== 30)) {
        return ['valido' => false, 'mensaje' => 'Código de provincia inválido'];
    }

    $tercerDigito = (int) $cedula[2];
    if ($tercerDigito > 5) {
        return ['valido' => false, 'mensaje' => 'Tercer dígito inválido para cédula (debe ser 0-5)'];
    }

    $coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    $suma = 0;
    for ($i = 0; $i < 9; $i++) {
        $valor = (int) $cedula[$i] * $coeficientes[$i];
        if ($valor > 9) $valor -= 9;
        $suma += $valor;
    }

    $digitoVerificador = (10 - ($suma % 10)) % 10;
    if ($digitoVerificador !== (int) $cedula[9]) {
        return ['valido' => false, 'mensaje' => 'Dígito verificador incorrecto — cédula inválida'];
    }

    return ['valido' => true, 'mensaje' => 'Cédula ecuatoriana válida'];
}

function validarRucEcuador($ruc) {
    $provincia = (int) substr($ruc, 0, 2);
    if ($provincia < 1 || ($provincia > 24 && $provincia !== 30)) {
        return ['valido' => false, 'mensaje' => 'Código de provincia inválido'];
    }

    $tercerDigito = (int) $ruc[2];

    // Persona Natural (3er dígito 0-5)
    if ($tercerDigito < 6) {
        if (substr($ruc, 10, 3) !== '001') {
            return ['valido' => false, 'mensaje' => 'RUC de persona natural debe terminar en 001'];
        }
        $resultCedula = validarCedulaEcuador(substr($ruc, 0, 10));
        if (!$resultCedula['valido']) {
            return ['valido' => false, 'mensaje' => 'Los 10 primeros dígitos no forman una cédula válida'];
        }
        return ['valido' => true, 'mensaje' => 'RUC de persona natural válido'];
    }

    // Entidad Pública (3er dígito = 6)
    if ($tercerDigito === 6) {
        if (substr($ruc, 8, 4) !== '0001') {
            return ['valido' => false, 'mensaje' => 'RUC de entidad pública debe terminar en 0001'];
        }
        $coefs6 = [3, 2, 7, 6, 5, 4, 3, 2];
        $sum6 = 0;
        for ($i = 0; $i < 8; $i++) {
            $sum6 += (int) $ruc[$i] * $coefs6[$i];
        }
        $residuo6 = $sum6 % 11;
        $verif6 = $residuo6 === 0 ? 0 : 11 - $residuo6;
        if ($verif6 !== (int) $ruc[8]) {
            return ['valido' => false, 'mensaje' => 'Dígito verificador incorrecto (entidad pública)'];
        }
        return ['valido' => true, 'mensaje' => 'RUC de entidad pública válido'];
    }

    // Sociedad Privada (3er dígito = 9)
    if ($tercerDigito === 9) {
        if (substr($ruc, 10, 3) !== '001') {
            return ['valido' => false, 'mensaje' => 'RUC de sociedad privada debe terminar en 001'];
        }
        $coefs9 = [4, 3, 2, 7, 6, 5, 4, 3, 2];
        $sum9 = 0;
        for ($j = 0; $j < 9; $j++) {
            $sum9 += (int) $ruc[$j] * $coefs9[$j];
        }
        $residuo9 = $sum9 % 11;
        $verif9 = $residuo9 === 0 ? 0 : 11 - $residuo9;
        if ($verif9 !== (int) $ruc[9]) {
            return ['valido' => false, 'mensaje' => 'Dígito verificador incorrecto (sociedad privada)'];
        }
        return ['valido' => true, 'mensaje' => 'RUC de sociedad privada válido'];
    }

    return ['valido' => false, 'mensaje' => 'Tercer dígito del RUC no válido (0-5, 6 o 9)'];
}
?>
