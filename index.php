<?php

session_start();
if (isset($_SESSION['usuario_activo'])) {
    header('Location: dashboard.php');
    exit;
}

?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso al Sistema</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #f6f6f6;
            font-family: 'Segoe UI', 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        .login-card {
            background: #fff;
            border-radius: 5px;
            box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.08);
            border: 1px solid #e0e0e0;
            width: 100%;
            max-width: 420px;
            padding: 35px 40px;
        }
        .login-title {
            color: #0d6efd;
            font-weight: 500;
            font-size: 1.6rem;
            margin-bottom: 0.4rem;
        }
        .login-subtitle {
            color: #555;
            font-size: 0.9rem;
            margin-bottom: 1.5rem;
        }
        .form-label {
            font-size: 0.9rem;
            color: #333;
            margin-bottom: 0.3rem;
        }
        .form-control {
            border-radius: 4px;
            border: 1px solid #ddd;
            padding: 0.5rem 0.75rem;
            font-size: 0.95rem;
        }
        .form-control:focus {
            box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
            border-color: #86b7fe;
        }
        .btn-login {
            background-color: #0d6efd;
            border: none;
            border-radius: 4px;
            padding: 0.6rem;
            font-weight: 600;
            font-size: 0.95rem;
            transition: background-color 0.2s;
        }
        .btn-login:hover {
            background-color: #0b5ed7;
        }
    </style>
</head>

<body class="d-flex align-items-center justify-content-center vh-100">
    <div class="login-card">

        <h3 class="login-title">Sistema POS</h3>
        <p class="login-subtitle">Ingrese sus credenciales</p>

        <?php if(isset($_GET['error'])): ?>
            <div class="alert alert-danger p-2" role="alert" style="font-size: 0.85rem;">
               Usuario o contraseña incorrectos.
            </div>
        <?php endif; ?>

        <form method="POST" action="backend/procesar_login.php">
            <div class="mb-3">
                <label for="usuario" class="form-label">Usuario</label>
                <input type="text" class="form-control" id="usuario" name="usuario" required>
            </div>
            <div class="mb-4">
                <label for="password" class="form-label">Contraseña</label>
                <input type="password" class="form-control" id="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary w-100 btn-login">Ingresar</button>
        </form>

    </div>

</body>

</html>