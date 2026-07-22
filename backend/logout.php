<?php

declare(strict_types=1);

require_once __DIR__ . '/session_handler.php';
session_start();

$_SESSION = [];

header('Location: ../index.php');
exit();

?>