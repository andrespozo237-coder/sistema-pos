<?php
// backend/session_handler.php

require_once __DIR__ . '/conexion.php';

class DatabaseSessionHandler implements SessionHandlerInterface {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        // Crear tabla de sesiones automáticamente la primera vez que se ejecute
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS sesiones (
                id VARCHAR(128) NOT NULL PRIMARY KEY,
                data TEXT NOT NULL,
                last_access TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");
    }

    public function open($savePath, $sessionName): bool {
        return true;
    }

    public function close(): bool {
        return true;
    }

    public function read($id): string|false {
        try {
            $stmt = $this->pdo->prepare("SELECT data FROM sesiones WHERE id = ?");
            $stmt->execute([$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ? $row['data'] : '';
        } catch (PDOException $e) {
            return '';
        }
    }

    public function write($id, $data): bool {
        try {
            $stmt = $this->pdo->prepare("REPLACE INTO sesiones (id, data) VALUES (?, ?)");
            return $stmt->execute([$id, $data]);
        } catch (PDOException $e) {
            return false;
        }
    }

    public function destroy($id): bool {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM sesiones WHERE id = ?");
            return $stmt->execute([$id]);
        } catch (PDOException $e) {
            return false;
        }
    }

    public function gc($maxlifetime): int|false {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM sesiones WHERE last_access < DATE_SUB(NOW(), INTERVAL ? SECOND)");
            $stmt->execute([$maxlifetime]);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            return false;
        }
    }
}

// Registrar el manejador
$handler = new DatabaseSessionHandler($pdo);
session_set_save_handler($handler, true);

// Configurar recolector de basura de sesiones en PHP
ini_set('session.gc_probability', 1);
ini_set('session.gc_divisor', 100);
?>
