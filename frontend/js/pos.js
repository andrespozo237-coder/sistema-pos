// Lógica del Punto de Venta (POS)

(function () {
    'use strict';

    // Estado global
    const state = {
        cart: [],
        // Cada item: {id, codigo_barras, nombre_producto, precio_actual, cantidad, stock_disponible}
        selectedClient: null,
        // {id, cedula, nombre_completo, correo}
        tipoId: 'cedula',
        // 'cedula' | 'ruc' | 'consumidor_final'
        isProcessing: false,
        cameraActive: false,
        html5QrCode: null,
        lastScannedCode: '',
        scanCooldown: false
    };

    // Constantes
    const IVA_RATE = 0.15;
    const SEARCH_DEBOUNCE_MS = 300;
    const BARCODE_MAX_INTERVAL_MS = 50;

    // Temporizadores
    let searchTimeout = null;
    let clientSearchTimeout = null;
    let barcodeBuffer = '';
    let lastKeyTime = 0;
    let barcodeTimeout = null;

    // Utilidades
    function esCumpleanos(fecha) {
        if (!fecha) return false;
        var today = new Date();
        var parts = fecha.split('-');
        if (parts.length === 3) {
            var mm = parseInt(parts[1], 10);
            var dd = parseInt(parts[2], 10);
            return (today.getMonth() + 1 === mm && today.getDate() === dd);
        }
        return false;
    }

    // Referencias DOM
    const DOM = {};

    // Inicialización
    document.addEventListener('DOMContentLoaded', iniciar);

    function iniciar() {
        guardarDOM();
        asignarEventos();
        actualizarInterfaz();

        // Autofocus en el buscador
        if (DOM.searchInput) {
            DOM.searchInput.focus();
        }
    }

    function guardarDOM() {
        DOM.searchInput = document.getElementById('pos-search');
        DOM.searchResults = document.getElementById('pos-search-results');
        DOM.cartBody = document.getElementById('cart-body');
        DOM.cartEmpty = document.getElementById('cart-empty');
        DOM.tipoIdBtns = document.querySelectorAll('.tipo-id-btn');
        DOM.clientSearchInput = document.getElementById('client-search');
        DOM.clientResults = document.getElementById('client-results');
        DOM.clientSelected = document.getElementById('client-selected');
        DOM.clientSearchSection = document.getElementById('client-search-section');
        DOM.validationMsg = document.getElementById('validation-msg');
        DOM.newClientForm = document.getElementById('new-client-form');
        DOM.subtotalEl = document.getElementById('pos-subtotal');
        DOM.ivaEl = document.getElementById('pos-iva');
        DOM.totalEl = document.getElementById('pos-total');
        DOM.pagoInput = document.getElementById('pos-pago');
        DOM.cambioDisplay = document.getElementById('cambio-display');
        DOM.cambioAmount = document.getElementById('cambio-amount');
        DOM.btnProcesar = document.getElementById('btn-procesar');
        // Camera scanner
        DOM.btnCameraScan = document.getElementById('btn-camera-scan');
        DOM.cameraModal = document.getElementById('camera-modal');
        DOM.btnCameraClose = document.getElementById('btn-camera-close');
        DOM.cameraReader = document.getElementById('camera-reader');
        DOM.cameraStatus = document.getElementById('camera-status');
        DOM.cameraLastScan = document.getElementById('camera-last-scan');
    }

    function asignarEventos() {
        // ---- Búsqueda de productos ----
        DOM.searchInput.addEventListener('input', buscarInput);
        DOM.searchInput.addEventListener('keydown', buscarTecla);

        // ---- Cerrar dropdowns al hacer clic fuera ----
        document.addEventListener('click', function (e) {
            if (!DOM.searchInput.contains(e.target) && !DOM.searchResults.contains(e.target)) {
                DOM.searchResults.classList.remove('active');
            }
            if (DOM.clientSearchInput && !DOM.clientSearchInput.contains(e.target) && !DOM.clientResults.contains(e.target)) {
                DOM.clientResults.classList.remove('active');
            }
        });

        // ---- Mantener foco en buscador principal ----
        document.addEventListener('click', function (e) {
            const isInteractive = e.target.closest(
                'button, input, select, textarea, a, .pos-search-result-item, .client-result-item'
            );
            if (!isInteractive) {
                DOM.searchInput.focus();
            }
        });

        // ---- Tipo de identificación ----
        DOM.tipoIdBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                cambiarTipoId(btn.dataset.tipo);
            });
        });

        // ---- Búsqueda de clientes ----
        DOM.clientSearchInput.addEventListener('input', buscarClienteInput);
        DOM.clientSearchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') e.preventDefault();
        });

        // ---- Monto de pago ----
        DOM.pagoInput.addEventListener('input', calcularCambio);

        // ---- Procesar venta ----
        DOM.btnProcesar.addEventListener('click', procesarVenta);

        // ---- Cámara escáner ----
        if (DOM.btnCameraScan) {
            DOM.btnCameraScan.addEventListener('click', abrirCamara);
        }
        if (DOM.btnCameraClose) {
            DOM.btnCameraClose.addEventListener('click', cerrarCamara);
        }
        // Cerrar modal con Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && state.cameraActive) {
                cerrarCamara();
            }
        });
        // Cerrar modal al hacer clic fuera del contenido
        if (DOM.cameraModal) {
            DOM.cameraModal.addEventListener('click', function (e) {
                if (e.target === DOM.cameraModal) {
                    cerrarCamara();
                }
            });
        }
    }

    // Búsqueda de productos

    function buscarInput(e) {
        var query = e.target.value.trim();
        clearTimeout(searchTimeout);

        if (query.length < 1) {
            DOM.searchResults.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(function () {
            buscarProductos(query);
        }, SEARCH_DEBOUNCE_MS);
    }

    function buscarTecla(e) {
        var now = Date.now();

        if (e.key === 'Enter') {
            e.preventDefault();
            var query = DOM.searchInput.value.trim();
            if (query) {
                clearTimeout(searchTimeout);
                buscarYAgregar(query);
            }
            return;
        }

        // Detección de código de barras (entrada rápida)
        if (e.key.length === 1) {
            var interval = now - lastKeyTime;
            lastKeyTime = now;

            if (interval < BARCODE_MAX_INTERVAL_MS && barcodeBuffer.length > 0) {
                barcodeBuffer += e.key;
            } else {
                barcodeBuffer = e.key;
            }

            clearTimeout(barcodeTimeout);
            barcodeTimeout = setTimeout(function () {
                barcodeBuffer = '';
            }, 200);
        }
    }

    function buscarProductos(query) {
        fetch('backend/api_producto.php?q=' + encodeURIComponent(query))
            .then(function (r) { return r.json(); })
            .then(function (products) {
                mostrarResultadosProductos(products);
            })
            .catch(function (err) {
                console.error('Error buscando productos:', err);
            });
    }

    function buscarYAgregar(code) {
        fetch('backend/api_producto.php?q=' + encodeURIComponent(code))
            .then(function (r) { return r.json(); })
            .then(function (products) {
                if (products.length === 1) {
                    agregarAlCarrito(products[0]);
                    DOM.searchInput.value = '';
                    DOM.searchResults.classList.remove('active');
                } else if (products.length > 1) {
                    // Intentar coincidencia exacta por código de barras
                    var exact = products.find(function (p) {
                        return p.codigo_barras === code;
                    });
                    if (exact) {
                        agregarAlCarrito(exact);
                        DOM.searchInput.value = '';
                        DOM.searchResults.classList.remove('active');
                    } else {
                        mostrarResultadosProductos(products);
                    }
                } else {
                    mostrarMensaje('Producto no encontrado', 'warning');
                }
            })
            .catch(function () {
                mostrarMensaje('Error al buscar producto', 'error');
            });
    }

    function mostrarResultadosProductos(products) {
        if (products.length === 0) {
            DOM.searchResults.innerHTML =
                '<div style="padding:20px;text-align:center;color:#94a3b8;">No se encontraron productos</div>';
            DOM.searchResults.classList.add('active');
            return;
        }

        var html = '';
        products.forEach(function (p) {
            var stock = parseInt(p.stock_disponible);
            var stockClass = stock <= 0 ? 'color:#dc2626' : (stock <= 5 ? 'color:#f59e0b' : 'color:#94a3b8');

            html += '<div class="pos-search-result-item" data-product-id="' + p.id + '">';
            html += '  <div>';
            html += '    <div class="result-product-name">' + escaparHtml(p.nombre_producto) + '</div>';
            html += '    <div class="result-product-code">' + escaparHtml(p.codigo_barras) + '</div>';
            html += '  </div>';
            html += '  <div style="text-align:right;">';
            html += '    <div class="result-product-price">$' + parseFloat(p.precio_actual).toFixed(2) + '</div>';
            html += '    <div class="result-product-stock" style="' + stockClass + '">Stock: ' + stock + '</div>';
            html += '  </div>';
            html += '</div>';
        });

        DOM.searchResults.innerHTML = html;
        DOM.searchResults.classList.add('active');

        // Bind click events
        var items = DOM.searchResults.querySelectorAll('.pos-search-result-item');
        items.forEach(function (item, idx) {
            item.addEventListener('click', function () {
                agregarAlCarrito(products[idx]);
                DOM.searchInput.value = '';
                DOM.searchResults.classList.remove('active');
                DOM.searchInput.focus();
            });
        });
    }

    // Carrito de compras

    function agregarAlCarrito(product) {
        var existingIndex = -1;
        for (var i = 0; i < state.cart.length; i++) {
            if (state.cart[i].id == product.id) {
                existingIndex = i;
                break;
            }
        }

        var stock = parseInt(product.stock_disponible);

        if (existingIndex >= 0) {
            var currentItem = state.cart[existingIndex];
            if (currentItem.cantidad < stock) {
                currentItem.cantidad++;
                mostrarMensaje(product.nombre_producto + ' — cantidad: ' + currentItem.cantidad, 'info');
            } else {
                mostrarMensaje('Stock máximo alcanzado para ' + product.nombre_producto, 'warning');
                return;
            }
        } else {
            if (stock <= 0) {
                mostrarMensaje(product.nombre_producto + ' — sin stock disponible', 'error');
                return;
            }
            state.cart.push({
                id: parseInt(product.id),
                codigo_barras: product.codigo_barras,
                nombre_producto: product.nombre_producto,
                precio_actual: parseFloat(product.precio_actual),
                cantidad: 1,
                stock_disponible: stock
            });
            mostrarMensaje(product.nombre_producto + ' agregado al carrito', 'success');
        }

        actualizarInterfaz();
        DOM.searchInput.focus();
    }

    function quitarDelCarrito(index) {
        var item = state.cart[index];
        state.cart.splice(index, 1);
        mostrarMensaje(item.nombre_producto + ' eliminado del carrito', 'info');
        actualizarInterfaz();
    }

    function actualizarCantidad(index, delta) {
        var item = state.cart[index];
        var newQty = item.cantidad + delta;

        if (newQty <= 0) {
            quitarDelCarrito(index);
            return;
        }

        if (newQty > item.stock_disponible) {
            mostrarMensaje('Stock máximo disponible: ' + item.stock_disponible, 'warning');
            return;
        }

        item.cantidad = newQty;
        actualizarInterfaz();
    }

    // Gestión de clientes

    function cambiarTipoId(tipo) {
        state.tipoId = tipo;
        state.selectedClient = null;

        DOM.tipoIdBtns.forEach(function (btn) {
            if (btn.dataset.tipo === tipo) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (tipo === 'consumidor_final') {
            selectConsumidorFinal();
        } else {
            DOM.clientSelected.style.display = 'none';
            DOM.clientSearchSection.style.display = 'block';
            DOM.clientSearchInput.value = '';
            DOM.validationMsg.textContent = '';
            DOM.validationMsg.className = 'validation-msg';
            DOM.clientSearchInput.classList.remove('is-valid', 'is-invalid');
            DOM.newClientForm.style.display = 'none';
            DOM.clientResults.classList.remove('active');

            if (tipo === 'cedula') {
                DOM.clientSearchInput.placeholder = 'Ingrese cédula (10 dígitos)';
                DOM.clientSearchInput.maxLength = 10;
            } else {
                DOM.clientSearchInput.placeholder = 'Ingrese RUC (13 dígitos)';
                DOM.clientSearchInput.maxLength = 13;
            }

            DOM.clientSearchInput.focus();
        }

        actualizarBotonProcesar();
    }

    function selectConsumidorFinal() {
        fetch('backend/api_cliente.php?action=consumidor_final')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.estado === 'success') {
                    state.selectedClient = data.cliente;
                    mostrarClienteSeleccionado();
                    mostrarMensaje('Consumidor Final seleccionado', 'success');
                } else {
                    mostrarMensaje('Error al seleccionar Consumidor Final', 'error');
                }
            })
            .catch(function () {
                mostrarMensaje('Error de conexión al servidor', 'error');
            });
    }

    function buscarClienteInput(e) {
        var value = e.target.value.replace(/\D/g, ''); // Solo números
        e.target.value = value;

        // Validación en tiempo real
        if (value.length > 0) {
            var validation;
            if (state.tipoId === 'cedula') {
                validation = validarCedula(value);
            } else {
                validation = validarRuc(value);
            }

            DOM.validationMsg.textContent = validation.mensaje;
            DOM.validationMsg.className = 'validation-msg ' + (validation.valido ? 'valid' : 'invalid');

            DOM.clientSearchInput.classList.remove('is-valid', 'is-invalid');
            if (validation.valido) {
                DOM.clientSearchInput.classList.add('is-valid');
            } else {
                var expectedLen = state.tipoId === 'cedula' ? 10 : 13;
                if (value.length >= expectedLen) {
                    DOM.clientSearchInput.classList.add('is-invalid');
                }
            }
        } else {
            DOM.validationMsg.textContent = '';
            DOM.validationMsg.className = 'validation-msg';
            DOM.clientSearchInput.classList.remove('is-valid', 'is-invalid');
        }

        // Buscar cliente en la BD
        clearTimeout(clientSearchTimeout);
        DOM.newClientForm.style.display = 'none';

        if (value.length >= 3) {
            clientSearchTimeout = setTimeout(function () {
                buscarClientes(value);
            }, SEARCH_DEBOUNCE_MS);
        } else {
            DOM.clientResults.classList.remove('active');
        }
    }

    function buscarClientes(query) {
        fetch('backend/api_cliente.php?q=' + encodeURIComponent(query))
            .then(function (r) { return r.json(); })
            .then(function (clients) {
                if (clients.length > 0) {
                    mostrarResultadosClientes(clients);
                    DOM.newClientForm.style.display = 'none';
                } else {
                    DOM.clientResults.classList.remove('active');

                    // Si la cédula/RUC es válida y no existe, ofrecer registrar
                    var isValid = state.tipoId === 'cedula'
                        ? validarCedula(query).valido
                        : validarRuc(query).valido;

                    if (isValid) {
                        mostrarFormularioCliente(query);
                    }
                }
            })
            .catch(function (err) {
                console.error('Error buscando clientes:', err);
            });
    }

    function mostrarResultadosClientes(clients) {
        var html = '';
        clients.forEach(function (c) {
            html += '<div class="client-result-item" data-client-id="' + c.id + '">';
            html += '  <div class="fw-bold" style="color:var(--verde-oscuro);font-size:0.92rem;">' + escaparHtml(c.nombre_completo) + '</div>';
            html += '  <div class="text-muted" style="font-size:0.82rem;">Cédula/RUC: ' + escaparHtml(c.cedula) + '</div>';
            html += '</div>';
        });

        DOM.clientResults.innerHTML = html;
        DOM.clientResults.classList.add('active');

        // Bind click events
        var items = DOM.clientResults.querySelectorAll('.client-result-item');
        items.forEach(function (item, idx) {
            item.addEventListener('click', function () {
                seleccionarCliente(clients[idx]);
            });
        });
    }

    function seleccionarCliente(client) {
        state.selectedClient = client;
        DOM.clientResults.classList.remove('active');
        DOM.newClientForm.style.display = 'none';
        mostrarClienteSeleccionado();
        mostrarMensaje('Cliente: ' + client.nombre_completo, 'success');
    }

    function mostrarClienteSeleccionado() {
        DOM.clientSelected.style.display = 'flex';
        DOM.clientSearchSection.style.display = 'none';
        DOM.clientSelected.querySelector('.selected-client-name').textContent = state.selectedClient.nombre_completo;
        DOM.clientSelected.querySelector('.selected-client-cedula').textContent = 'ID: ' + state.selectedClient.cedula;
        
        var banner = document.getElementById('birthday-banner');
        if (banner) {
            if (esCumpleanos(state.selectedClient.fecha_nacimiento)) {
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        }
        
        actualizarBotonProcesar();
        actualizarTotales(); // Recalcular totales por posible descuento
    }

    function limpiarCliente() {
        state.selectedClient = null;
        DOM.clientSelected.style.display = 'none';
        DOM.clientSearchSection.style.display = 'block';
        cambiarTipoId('cedula');
        actualizarTotales(); // Quitar posible descuento
    }

    function mostrarFormularioCliente(cedula) {
        DOM.newClientForm.style.display = 'block';
        document.getElementById('new-client-cedula').value = cedula;
        document.getElementById('new-client-nombre').value = '';
        document.getElementById('new-client-correo').value = '';
        
        var todayStr = new Date().toISOString().split('T')[0];
        var inputFecha = document.getElementById('new-client-fecha-nacimiento');
        if (inputFecha) {
            inputFecha.value = '';
            inputFecha.max = todayStr;
        }
        
        var inputNotas = document.getElementById('new-client-notas');
        if (inputNotas) {
            inputNotas.value = '';
        }
        
        document.getElementById('new-client-nombre').focus();
    }

    function guardarCliente() {
        var cedula = document.getElementById('new-client-cedula').value.trim();
        var nombre = document.getElementById('new-client-nombre').value.trim();
        var correo = document.getElementById('new-client-correo').value.trim();
        var fecha_nac = document.getElementById('new-client-fecha-nacimiento').value;
        var notas = document.getElementById('new-client-notas').value.trim();

        if (!nombre) {
            mostrarMensaje('Ingrese el nombre completo del cliente', 'warning');
            document.getElementById('new-client-nombre').focus();
            return;
        }

        if (nombre.length < 3) {
            mostrarMensaje('El nombre debe tener al menos 3 caracteres', 'warning');
            return;
        }

        // Validar correo si se proporcionó
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            mostrarMensaje('Formato de correo electrónico inválido', 'warning');
            document.getElementById('new-client-correo').focus();
            return;
        }

        // Validar fecha futura
        if (fecha_nac) {
            var todayStr = new Date().toISOString().split('T')[0];
            if (fecha_nac > todayStr) {
                mostrarMensaje('La fecha de nacimiento no puede ser posterior a hoy', 'warning');
                document.getElementById('new-client-fecha-nacimiento').focus();
                return;
            }
        }

        fetch('backend/api_cliente.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cedula: cedula,
                nombre_completo: nombre,
                correo: correo || null,
                fecha_nacimiento: fecha_nac || null,
                notas: notas || null
            })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.estado === 'success') {
                    seleccionarCliente(data.cliente);
                    mostrarMensaje(data.mensaje || 'Cliente registrado', 'success');
                } else {
                    mostrarMensaje(data.mensaje || 'Error al registrar cliente', 'error');
                }
            })
            .catch(function () {
                mostrarMensaje('Error de conexión al servidor', 'error');
            });
    }

    // Validaciones (Cédula/RUC)

    function validarCedula(cedula) {
        if (!/^\d+$/.test(cedula)) {
            return { valido: false, mensaje: '⚠ Solo se permiten dígitos numéricos' };
        }

        if (cedula.length < 10) {
            return { valido: false, mensaje: 'Ingresando... faltan ' + (10 - cedula.length) + ' dígitos' };
        }

        if (cedula.length > 10) {
            return { valido: false, mensaje: '✗ La cédula debe tener exactamente 10 dígitos' };
        }

        // Código de provincia (primeros 2 dígitos): 01-24, o 30
        var provincia = parseInt(cedula.substring(0, 2), 10);
        if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
            return { valido: false, mensaje: '✗ Código de provincia inválido (01-24 o 30)' };
        }

        // Tercer dígito < 6 para personas naturales
        var tercerDigito = parseInt(cedula[2], 10);
        if (tercerDigito > 5) {
            return { valido: false, mensaje: '✗ Tercer dígito inválido para cédula (debe ser 0-5)' };
        }

        // Algoritmo de Módulo 10
        var coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        var suma = 0;
        for (var i = 0; i < 9; i++) {
            var valor = parseInt(cedula[i], 10) * coeficientes[i];
            if (valor > 9) valor -= 9;
            suma += valor;
        }

        var digitoVerificador = (10 - (suma % 10)) % 10;
        if (digitoVerificador !== parseInt(cedula[9], 10)) {
            return { valido: false, mensaje: '✗ Dígito verificador incorrecto — cédula inválida' };
        }

        return { valido: true, mensaje: '✓ Cédula ecuatoriana válida' };
    }

    function validarRuc(ruc) {
        if (!/^\d+$/.test(ruc)) {
            return { valido: false, mensaje: '⚠ Solo se permiten dígitos numéricos' };
        }

        if (ruc.length < 13) {
            return { valido: false, mensaje: 'Ingresando... faltan ' + (13 - ruc.length) + ' dígitos' };
        }

        if (ruc.length > 13) {
            return { valido: false, mensaje: '✗ El RUC debe tener exactamente 13 dígitos' };
        }

        // Código de provincia
        var provincia = parseInt(ruc.substring(0, 2), 10);
        if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
            return { valido: false, mensaje: '✗ Código de provincia inválido' };
        }

        var tercerDigito = parseInt(ruc[2], 10);

        // ---- Persona Natural (3er dígito 0-5) ----
        if (tercerDigito < 6) {
            if (ruc.substring(10) !== '001') {
                return { valido: false, mensaje: '✗ RUC de persona natural debe terminar en 001' };
            }

            var resultCedula = validarCedula(ruc.substring(0, 10));
            if (!resultCedula.valido) {
                return { valido: false, mensaje: '✗ Los 10 primeros dígitos no forman una cédula válida' };
            }

            return { valido: true, mensaje: '✓ RUC de persona natural válido' };
        }

        // ---- Entidad Pública (3er dígito = 6) ----
        if (tercerDigito === 6) {
            if (ruc.substring(9) !== '0001') {
                return { valido: false, mensaje: '✗ RUC de entidad pública debe terminar en 0001' };
            }

            var coefs6 = [3, 2, 7, 6, 5, 4, 3, 2];
            var sum6 = 0;
            for (var i = 0; i < 8; i++) {
                sum6 += parseInt(ruc[i], 10) * coefs6[i];
            }
            var residuo6 = sum6 % 11;
            var verif6 = residuo6 === 0 ? 0 : 11 - residuo6;

            if (verif6 !== parseInt(ruc[8], 10)) {
                return { valido: false, mensaje: '✗ Dígito verificador incorrecto (entidad pública)' };
            }

            return { valido: true, mensaje: '✓ RUC de entidad pública válido' };
        }

        // ---- Sociedad Privada (3er dígito = 9) ----
        if (tercerDigito === 9) {
            if (ruc.substring(10) !== '001') {
                return { valido: false, mensaje: '✗ RUC de sociedad privada debe terminar en 001' };
            }

            var coefs9 = [4, 3, 2, 7, 6, 5, 4, 3, 2];
            var sum9 = 0;
            for (var j = 0; j < 9; j++) {
                sum9 += parseInt(ruc[j], 10) * coefs9[j];
            }
            var residuo9 = sum9 % 11;
            var verif9 = residuo9 === 0 ? 0 : 11 - residuo9;

            if (verif9 !== parseInt(ruc[9], 10)) {
                return { valido: false, mensaje: '✗ Dígito verificador incorrecto (sociedad privada)' };
            }

            return { valido: true, mensaje: '✓ RUC de sociedad privada válido' };
        }

        // Tercer dígito no válido
        return { valido: false, mensaje: '✗ Tercer dígito del RUC no válido (0-5, 6 o 9)' };
    }

    // Cálculos

    function calcularTotales() {
        var subtotal = 0;
        for (var i = 0; i < state.cart.length; i++) {
            subtotal += state.cart[i].precio_actual * state.cart[i].cantidad;
        }
        
        var descuento = 0;
        if (state.selectedClient && esCumpleanos(state.selectedClient.fecha_nacimiento)) {
            descuento = subtotal * 0.05;
        }
        
        var subtotalConDescuento = subtotal - descuento;
        var iva = subtotalConDescuento * IVA_RATE;
        var total = subtotalConDescuento + iva;
        
        return { subtotal: subtotal, descuento: descuento, iva: iva, total: total };
    }

    function calcularCambio() {
        var totals = calcularTotales();
        var pago = parseFloat(DOM.pagoInput.value) || 0;
        var cambio = pago - totals.total;

        DOM.cambioDisplay.classList.remove('positive', 'negative', 'neutral');

        if (pago === 0 || DOM.pagoInput.value === '') {
            DOM.cambioDisplay.classList.add('neutral');
            DOM.cambioAmount.textContent = '$0.00';
        } else if (cambio >= 0) {
            DOM.cambioDisplay.classList.add('positive');
            DOM.cambioAmount.textContent = '$' + cambio.toFixed(2);
        } else {
            DOM.cambioDisplay.classList.add('negative');
            DOM.cambioAmount.textContent = '-$' + Math.abs(cambio).toFixed(2);
        }

        actualizarBotonProcesar();
    }

    // Actualización de UI

    function actualizarInterfaz() {
        mostrarCarrito();
        actualizarTotales();
        calcularCambio();
        actualizarBotonProcesar();
    }

    function mostrarCarrito() {
        if (state.cart.length === 0) {
            DOM.cartBody.innerHTML = '';
            DOM.cartEmpty.style.display = 'block';
            return;
        }

        DOM.cartEmpty.style.display = 'none';

        var html = '';
        state.cart.forEach(function (item, index) {
            var subtotal = (item.precio_actual * item.cantidad).toFixed(2);
            html += '<tr>';
            html += '  <td><span class="badge bg-light text-dark border" style="font-family:monospace;">' + escaparHtml(item.codigo_barras) + '</span></td>';
            html += '  <td class="fw-semibold">' + escaparHtml(item.nombre_producto) + '</td>';
            html += '  <td>$' + item.precio_actual.toFixed(2) + '</td>';
            html += '  <td>';
            html += '    <div class="qty-controls">';
            html += '      <button class="qty-btn" data-action="dec" data-index="' + index + '" title="Restar">−</button>';
            html += '      <span class="qty-value">' + item.cantidad + '</span>';
            html += '      <button class="qty-btn" data-action="inc" data-index="' + index + '" title="Sumar">+</button>';
            html += '    </div>';
            html += '  </td>';
            html += '  <td class="subtotal-cell">$' + subtotal + '</td>';
            html += '  <td><button class="btn-remove" data-action="remove" data-index="' + index + '" title="Eliminar">🗑</button></td>';
            html += '</tr>';
        });

        DOM.cartBody.innerHTML = html;

        // Bind cart action buttons via event delegation
        DOM.cartBody.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = this.dataset.action;
                var idx = parseInt(this.dataset.index, 10);
                if (action === 'inc') actualizarCantidad(idx, 1);
                else if (action === 'dec') actualizarCantidad(idx, -1);
                else if (action === 'remove') quitarDelCarrito(idx);
            });
        });
    }

    function actualizarTotales() {
        var totals = calcularTotales();
        DOM.subtotalEl.textContent = '$' + totals.subtotal.toFixed(2);
        
        var rowDescuento = document.getElementById('row-descuento');
        var posDescuento = document.getElementById('pos-descuento');
        if (rowDescuento && posDescuento) {
            if (totals.descuento > 0) {
                rowDescuento.style.display = 'flex';
                posDescuento.textContent = '-$' + totals.descuento.toFixed(2);
            } else {
                rowDescuento.style.display = 'none';
            }
        }
        
        DOM.ivaEl.textContent = '$' + totals.iva.toFixed(2);
        DOM.totalEl.textContent = '$' + totals.total.toFixed(2);
    }

    function actualizarBotonProcesar() {
        var totals = calcularTotales();
        var pago = parseFloat(DOM.pagoInput.value) || 0;

        var canProcess =
            state.cart.length > 0 &&
            state.selectedClient !== null &&
            pago >= totals.total &&
            totals.total > 0 &&
            !state.isProcessing;

        DOM.btnProcesar.disabled = !canProcess;
    }

    // =====================================================
    //  PROCESAR VENTA
    // =====================================================

    function procesarVenta() {
        if (state.isProcessing) return;

        // Validaciones finales
        if (state.cart.length === 0) {
            mostrarMensaje('El carrito está vacío', 'warning');
            return;
        }

        if (!state.selectedClient) {
            mostrarMensaje('Debe seleccionar un cliente', 'warning');
            return;
        }

        var totals = calcularTotales();
        var pago = parseFloat(DOM.pagoInput.value) || 0;

        if (pago < totals.total) {
            mostrarMensaje('El monto pagado ($' + pago.toFixed(2) + ') es insuficiente. Total: $' + totals.total.toFixed(2), 'error');
            DOM.pagoInput.focus();
            return;
        }

        // Cambiar estado
        state.isProcessing = true;
        DOM.btnProcesar.disabled = true;
        DOM.btnProcesar.innerHTML = '<span class="pos-loading"></span> Procesando venta...';

        var payload = {
            cliente_id: state.selectedClient.id,
            total_factura: Math.round(totals.total * 100) / 100,
            descuento: Math.round(totals.descuento * 100) / 100,
            productos: state.cart.map(function (item) {
                return {
                    producto_id: item.id,
                    cantidad: item.cantidad,
                    precio_congelado: item.precio_actual
                };
            })
        };

        fetch('backend/api_venta.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.estado === 'success') {
                    mostrarMensaje('¡Venta #' + data.venta.id + ' procesada exitosamente!', 'success');

                    // Generar PDF del recibo
                    generarPDF(data, {
                        subtotal: totals.subtotal,
                        descuento: totals.descuento,
                        iva: totals.iva,
                        total: totals.total,
                        pago: pago,
                        cambio: pago - totals.total
                    });

                    // Reiniciar el POS
                    reiniciarPOS();
                } else {
                    mostrarMensaje(data.mensaje || 'Error al procesar la venta', 'error');
                }
            })
            .catch(function () {
                mostrarMensaje('Error de conexión al servidor', 'error');
            })
            .finally(function () {
                state.isProcessing = false;
                DOM.btnProcesar.innerHTML = '🧾 PROCESAR VENTA';
                actualizarBotonProcesar();
            });
    }

    function reiniciarPOS() {
        state.cart = [];
        state.selectedClient = null;
        state.tipoId = 'cedula';

        DOM.pagoInput.value = '';
        DOM.clientSelected.style.display = 'none';
        DOM.clientSearchSection.style.display = 'block';
        DOM.clientSearchInput.value = '';
        DOM.clientSearchInput.classList.remove('is-valid', 'is-invalid');
        DOM.validationMsg.textContent = '';
        DOM.validationMsg.className = 'validation-msg';
        DOM.newClientForm.style.display = 'none';
        DOM.clientSearchInput.placeholder = 'Ingrese cédula (10 dígitos)';
        DOM.clientSearchInput.maxLength = 10;

        DOM.tipoIdBtns.forEach(function (btn) {
            if (btn.dataset.tipo === 'cedula') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        actualizarInterfaz();
        DOM.searchInput.focus();
    }

    // Generador de PDF

    function generarPDF(ventaData, totals) {
        if (typeof window.jspdf === 'undefined') {
            mostrarMensaje('Error: Librería PDF no disponible (Refresca con Ctrl+F5)', 'error');
            return;
        }

        try {
            var jsPDF = window.jspdf.jsPDF;

            // Calcular altura dinámica según productos (2 líneas por producto: código + nombre)
            var numProds = ventaData.detalles.length;
            var alturaProductos = numProds * 10; // ~10mm por producto (código + nombre)
            var alturaTotal = 180 + alturaProductos;

            var doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, alturaTotal]
            });

            var W = 80;
            var cx = W / 2;
            var ml = 4;   // margen izquierdo
            var mr = W - 4; // margen derecho
            var y = 6;

            // Encabezado del comprobante
            doc.setDrawColor(0);
            doc.setLineWidth(0.6);
            doc.rect(ml, y, W - ml * 2, 28);

            y += 7;
            doc.setFont('courier', 'bold');
            doc.setFontSize(14);
            doc.text('TECHMARKET', cx, y, { align: 'center' });
            y += 5;

            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.text('PUNTO DE VENTA ELECTRONICO', cx, y, { align: 'center' });
            y += 4;
            doc.text('RUC: 1792456789001', cx, y, { align: 'center' });
            y += 4;
            doc.text('Quito - Ecuador', cx, y, { align: 'center' });
            y += 4;
            doc.text('Tel: (02) 2500-100', cx, y, { align: 'center' });

            y += 7;

            // Título
            doc.setFont('courier', 'bold');
            doc.setFontSize(10);
            doc.text('COMPROBANTE DE VENTA POS', cx, y, { align: 'center' });
            y += 4;

            // Línea de guiones
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.text('------------------------------------------------', cx, y, { align: 'center' });
            y += 6;

            // Datos de la transacción
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);

            var numFactura = String(ventaData.venta.id).padStart(7, '0');
            doc.text('No. Comprobante:  ' + numFactura, ml, y);
            y += 4;

            var fechaStr = ventaData.venta.fecha_emision || '';
            var fecha = new Date(fechaStr.replace(' ', 'T'));
            var fechaFmt = isNaN(fecha.getTime())
                ? fechaStr
                : fecha.toLocaleDateString('es-EC') + '  ' + fecha.toLocaleTimeString('es-EC');
            doc.text('Fecha:  ' + fechaFmt, ml, y);
            y += 4;

            var cajeroNombre = (ventaData.cajero || 'ADMINISTRADOR').toUpperCase();
            doc.text('Atendido por:  ' + cajeroNombre, ml, y);
            y += 4;

            // Cliente
            var cedulaCli = ventaData.venta.cedula || 'N/A';
            var nombreCli = (ventaData.venta.nombre_completo || 'CONSUMIDOR FINAL').toUpperCase();
            if (nombreCli.length > 30) nombreCli = nombreCli.substring(0, 28) + '..';

            doc.text('Cliente:  ' + nombreCli, ml, y);
            y += 4;
            doc.text('CI/RUC:   ' + cedulaCli, ml, y);
            y += 4;

            // Doble línea separadora
            doc.setLineWidth(0.5);
            doc.line(ml, y, mr, y);
            y += 1;
            doc.setLineWidth(0.2);
            doc.line(ml, y, mr, y);
            y += 5;

            // Cabecera de tabla
            doc.setFont('courier', 'bold');
            doc.setFontSize(8);
            doc.text('PRODUCTO', ml, y);
            doc.text('CANT', ml + 38, y);
            doc.text('P.UNIT', ml + 48, y);
            doc.text('TOTAL', mr, y, { align: 'right' });
            y += 2;

            doc.setLineWidth(0.3);
            doc.line(ml, y, mr, y);
            y += 5;

            // Lista de productos
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);

            ventaData.detalles.forEach(function (det) {
                var cant = parseInt(det.cantidad, 10);
                var precio = parseFloat(det.precio_congelado);
                var subLinea = (precio * cant).toFixed(2);
                var nombre = (det.nombre_producto || '').toUpperCase();
                var codigo = det.codigo_barras || '';

                // Línea 1: nombre del producto (truncado si es necesario)
                if (nombre.length > 35) nombre = nombre.substring(0, 33) + '..';
                doc.setFont('courier', 'bold');
                doc.setFontSize(7);
                doc.text(nombre, ml, y);
                y += 4;

                // Línea 2: código, cantidad, precio unitario, subtotal
                doc.setFont('courier', 'normal');
                doc.text(codigo, ml + 2, y);
                doc.text(cant.toString(), ml + 42, y, { align: 'center' });
                doc.text(precio.toFixed(2), ml + 54, y, { align: 'center' });
                doc.text('$' + subLinea, mr, y, { align: 'right' });
                y += 6;
            });

            // Línea final de productos
            y -= 2;
            doc.setLineWidth(0.3);
            doc.line(ml, y, mr, y);
            y += 6;

            // Totales
            var labelX = ml + 30;

            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.text('Subtotal:', labelX, y, { align: 'right' });
            doc.text('$ ' + totals.subtotal.toFixed(2), mr, y, { align: 'right' });
            y += 5;

            if (totals.descuento && totals.descuento > 0) {
                doc.text('Desc. Cumple:', labelX, y, { align: 'right' });
                doc.text('-$ ' + totals.descuento.toFixed(2), mr, y, { align: 'right' });
                y += 5;
            }

            doc.text('I.V.A. 15%:', labelX, y, { align: 'right' });
            doc.text('$ ' + totals.iva.toFixed(2), mr, y, { align: 'right' });
            y += 5;

            doc.setLineWidth(0.4);
            doc.line(labelX + 2, y, mr, y);
            y += 5;

            doc.setFont('courier', 'bold');
            doc.setFontSize(10);
            doc.text('Total a pagar:', labelX + 5, y, { align: 'right' });
            doc.text('$ ' + totals.total.toFixed(2), mr, y, { align: 'right' });
            y += 6;

            // Efectivo y cambio
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.text('Efectivo:', labelX, y, { align: 'right' });
            doc.text('$ ' + totals.pago.toFixed(2), mr, y, { align: 'right' });
            y += 5;
            doc.text('Cambio:', labelX, y, { align: 'right' });
            doc.text('$ ' + totals.cambio.toFixed(2), mr, y, { align: 'right' });
            y += 4;

            // Línea final
            doc.setLineWidth(0.2);
            doc.line(ml, y, mr, y);
            y += 7;

            // Pie de página
            doc.setFont('courier', 'italic');
            doc.setFontSize(8);
            doc.text('*** Gracias por su compra ***', cx, y, { align: 'center' });
            y += 5;
            doc.setFont('courier', 'normal');
            doc.setFontSize(7);
            doc.text('Conserve este comprobante como', cx, y, { align: 'center' });
            y += 4;
            doc.text('respaldo de su transaccion.', cx, y, { align: 'center' });
            y += 5;
            doc.setFontSize(6);
            doc.text('TechMarket POS v1.0 | Generado: ' + new Date().toLocaleString('es-EC'), cx, y, { align: 'center' });

            // Guardar PDF
            var filename = 'comprobante_' + numFactura + '.pdf';
            doc.save(filename);

        } catch (err) {
            console.error('Error generando PDF:', err);
            mostrarMensaje('Error al generar el comprobante PDF: ' + err.message, 'error');
        }
    }

    // Utilidades

    function mostrarMensaje(message, type) {
        type = type || 'info';

        var container = document.querySelector('.pos-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'pos-toast-container';
            document.body.appendChild(container);
        }

        var icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        var toast = document.createElement('div');
        toast.className = 'pos-toast ' + type;
        toast.innerHTML = '<span>' + (icons[type] || '') + '</span><span>' + escaparHtml(message) + '</span>';

        container.appendChild(toast);

        setTimeout(function () {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3600);
    }

    function escaparHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // Escáner de cámara

    function abrirCamara() {
        if (state.cameraActive) return;

        // Verificar que la librería esté disponible
        if (typeof Html5Qrcode === 'undefined') {
            mostrarMensaje('Error: Librería de escáner no disponible. Recarga la página.', 'error');
            return;
        }

        state.cameraActive = true;
        state.lastScannedCode = '';
        state.scanCooldown = false;

        DOM.cameraModal.style.display = 'flex';
        DOM.cameraLastScan.innerHTML = '<span style="color:#94a3b8;">Esperando escaneo...</span>';
        estadoCamara('scanning', 'Apunte el código de barras hacia la cámara');

        // Crear instancia del escáner
        state.html5QrCode = new Html5Qrcode('camera-reader');

        var config = {
            fps: 15,
            qrbox: { width: 350, height: 120 },
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ]
        };

        state.html5QrCode.start(
            { facingMode: 'environment' },
            config,
            escanearCodigo,
            function () { /* ignorar errores de lectura continua */ }
        ).catch(function (err) {
            console.error('Error al iniciar cámara:', err);
            // Intentar con la cámara frontal como fallback
            state.html5QrCode.start(
                { facingMode: 'user' },
                config,
                escanearCodigo,
                function () { }
            ).catch(function (err2) {
                console.error('Error con cámara frontal:', err2);
                estadoCamara('error', 'No se pudo acceder a la cámara. Verifique los permisos.');
                mostrarMensaje('Error: No se pudo acceder a la cámara', 'error');
            });
        });
    }

    function cerrarCamara() {
        if (!state.cameraActive) return;

        state.cameraActive = false;

        if (state.html5QrCode) {
            state.html5QrCode.stop().then(function () {
                state.html5QrCode.clear();
                state.html5QrCode = null;
            }).catch(function () {
                state.html5QrCode = null;
            });
        }

        DOM.cameraModal.style.display = 'none';
        DOM.searchInput.focus();
    }

    function escanearCodigo(decodedText, decodedResult) {
        // Prevenir escaneos duplicados con cooldown
        if (state.scanCooldown) return;
        if (decodedText === state.lastScannedCode) return;

        state.lastScannedCode = decodedText;
        state.scanCooldown = true;

        // Cooldown de 2 segundos para evitar duplicados
        setTimeout(function () {
            state.scanCooldown = false;
        }, 2000);

        // Feedback visual
        estadoCamara('scanned', '¡Código detectado! Buscando producto...');
        DOM.cameraLastScan.innerHTML = 'Último código: <span class="scan-code">' + escaparHtml(decodedText) + '</span>';

        // Buscar el producto en la BD
        fetch('backend/api_producto.php?q=' + encodeURIComponent(decodedText))
            .then(function (r) { return r.json(); })
            .then(function (products) {
                if (products.length === 0) {
                    estadoCamara('error', 'Producto no encontrado: ' + decodedText);
                    mostrarMensaje('Producto no encontrado: ' + decodedText, 'warning');
                    // Reset para permitir re-escanear
                    setTimeout(function () {
                        state.lastScannedCode = '';
                        if (state.cameraActive) {
                            estadoCamara('scanning', 'Apunte el código de barras hacia la cámara');
                        }
                    }, 2000);
                    return;
                }

                // Buscar coincidencia exacta por código de barras
                var exactMatch = products.find(function (p) {
                    return p.codigo_barras === decodedText;
                });

                var product = exactMatch || products[0];
                agregarAlCarrito(product);

                estadoCamara('scanned', '✓ ' + product.nombre_producto + ' agregado al carrito');

                // Permitir escanear otro código diferente
                setTimeout(function () {
                    state.lastScannedCode = '';
                    if (state.cameraActive) {
                        estadoCamara('scanning', 'Listo para escanear siguiente producto');
                    }
                }, 1500);
            })
            .catch(function () {
                estadoCamara('error', 'Error de conexión al buscar producto');
                mostrarMensaje('Error de conexión al servidor', 'error');
            });
    }

    function estadoCamara(type, message) {
        if (!DOM.cameraStatus) return;

        DOM.cameraStatus.className = 'camera-status';
        if (type === 'scanned') DOM.cameraStatus.classList.add('scanned');
        if (type === 'error') DOM.cameraStatus.classList.add('error-status');

        DOM.cameraStatus.innerHTML = '<span class="camera-status-dot"></span> ' + escaparHtml(message);
    }

    // Exportar API global

    window.POS = {
        agregarAlCarrito: agregarAlCarrito,
        quitarDelCarrito: quitarDelCarrito,
        actualizarCantidad: actualizarCantidad,
        seleccionarCliente: seleccionarCliente,
        limpiarCliente: limpiarCliente,
        guardarCliente: guardarCliente,
        abrirCamara: abrirCamara,
        cerrarCamara: cerrarCamara
    };

})();
