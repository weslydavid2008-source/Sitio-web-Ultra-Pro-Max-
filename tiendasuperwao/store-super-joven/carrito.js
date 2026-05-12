const STORE_PRODUCTS_API_URL = "../api/tienda_productos.php";
const AUTH_API_URL = "../api/auth.php";
const CART_API_URL = "../api/carrito.php";
const REGISTER_OPTIONS_API_URL = "../api/registro_opciones.php";
const CHECKOUT_SHIPPING_API_URL = "../api/checkout.php?accion=calcular_envio";
const ENVIO_FIJO = 0;
const RUTA_PAGO = "checkout.html";

const listaCarrito = document.getElementById("listaCarrito");
const carritoVacio = document.getElementById("carritoVacio");
const contadorCarrito = document.getElementById("contadorCarrito");

const subtotalTexto = document.getElementById("subtotalTexto");
const envioTexto = document.getElementById("envioTexto");
const totalTexto = document.getElementById("totalTexto");

const subtotalFinal = document.getElementById("subtotalFinal");
const envioFinal = document.getElementById("envioFinal");
const totalFinal = document.getElementById("totalFinal");

const btnContinuarCompra = document.getElementById("btnContinuarCompra");
const panelEnvio = document.getElementById("panelEnvio");
const cerrarPanelEnvio = document.getElementById("cerrarPanelEnvio");
const formEnvio = document.getElementById("formEnvio");

const modalSesion = document.getElementById("modalSesion");
const cerrarModalSesion = document.getElementById("cerrarModalSesion");
const formLoginCarrito = document.getElementById("formLoginCarrito");
const linkSesion = document.getElementById("linkSesion");
const mensajeSesion = document.getElementById("mensajeSesion");

const accountMenu = document.getElementById("accountMenu");
const viewProfileBtn = document.getElementById("viewProfileBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const adminPanelLink = document.getElementById("adminPanelLink");
const logoutBtn = document.getElementById("logoutBtn");

const profileModal = document.getElementById("profileModal");
const closeProfileModalBtn = document.getElementById("closeProfileModal");
const cancelProfileModalBtn = document.getElementById("cancelProfileModal");
const profileForm = document.getElementById("profileForm");

let usuarioRegistrado = false;
let datosUsuario = null;
let productosBusqueda = [];

let registerOptions = {
    generos: [],
    barrios: []
};

let carrito = [];
let subtotal = 0;
let envio = 0;
let total = 0;
let envioCalculado = null;

const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", iniciarCarrito);

async function iniciarCarrito() {
    localStorage.removeItem("carrito");

    configurarBuscadorCarrito();

    await cargarOpcionesPerfil();
    configurarSelectBarrioEnvio();
    await verificarSesion();

    if (usuarioRegistrado) {
        await cargarCarritoDesdeBD();
    } else {
        carrito = [];
    }

    renderizarCarrito();
    calcularTotales();
    actualizarHeaderSesion();
}


/* =========================
   BUSCADOR DEL CARRITO
   ========================= */

async function cargarProductosParaBuscador() {
    try {
        const respuesta = await fetch(STORE_PRODUCTS_API_URL, {
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !Array.isArray(datos)) {
            throw new Error("No se pudieron cargar los productos para el buscador.");
        }

        productosBusqueda = datos;
    } catch (error) {
        console.error("Error cargando productos para buscador:", error);
        productosBusqueda = [];
    }
}

function configurarBuscadorCarrito() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderizarSugerenciasBusqueda(searchInput.value.trim());
        });

        searchInput.addEventListener("focus", () => {
            renderizarSugerenciasBusqueda(searchInput.value.trim());
        });

        searchInput.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                buscarEnPaginaPrincipal();
            }

            if (evento.key === "Escape") {
                ocultarSugerenciasBusqueda();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", buscarEnPaginaPrincipal);
    }

    document.addEventListener("click", evento => {
        const searchBox = document.querySelector(".buscador");

        if (searchBox && !searchBox.contains(evento.target)) {
            ocultarSugerenciasBusqueda();
        }
    });
}

function renderizarSugerenciasBusqueda(valorBusqueda) {
    const panel = document.getElementById("searchResultsPanel");

    if (!panel) return;

    const busqueda = normalizarTexto(valorBusqueda);

    if (!busqueda) {
        ocultarSugerenciasBusqueda();
        return;
    }

    const resultados = carrito
        .filter(producto => productoCoincideConBusqueda(producto, busqueda))
        .slice(0, 6);

    if (resultados.length === 0) {
        panel.innerHTML = `
            <div class="search-result-empty">
                No hay productos en tu carrito con ese nombre.
            </div>
        `;
        panel.classList.remove("oculto");
        return;
    }

    panel.innerHTML = resultados.map(producto => `
        <button
            type="button"
            class="search-result-item"
            data-product-id="${Number(producto.id_producto || 0)}"
            data-product-name="${escapeHTML(producto.nombre || "Producto")}"
        >
            <img
                src="${escapeHTML(producto.imagen || producto.imagen_url || "img/default.jpg")}"
                alt="${escapeHTML(producto.nombre || "Producto")}"
            >

            <span class="search-result-info">
                <strong>${escapeHTML(producto.nombre || "Producto")}</strong>
                <small>${escapeHTML(producto.descripcion || "Producto en el carrito")}</small>
            </span>

            <span class="search-result-price">
                ${formatoCOP.format(Number(producto.precio || producto.precio_venta || 0))}
            </span>
        </button>
    `).join("");

    panel.querySelectorAll(".search-result-item").forEach(item => {
        item.addEventListener("click", () => {
            seleccionarProductoDelCarritoBusqueda(item.dataset.productId, item.dataset.productName || "");
        });
    });

    panel.classList.remove("oculto");
}

function seleccionarProductoDelCarritoBusqueda(idProducto, nombreProducto) {
    const searchInput = document.getElementById("searchInput");

    if (searchInput) {
        searchInput.value = nombreProducto;
    }

    ocultarSugerenciasBusqueda();

    const item = document.querySelector(`.producto-carrito[data-product-id="${Number(idProducto)}"]`);

    if (!item) return;

    item.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    item.classList.add("search-highlight");

    setTimeout(() => {
        item.classList.remove("search-highlight");
    }, 1600);
}


function ocultarSugerenciasBusqueda() {
    const panel = document.getElementById("searchResultsPanel");

    if (panel) {
        panel.classList.add("oculto");
    }
}

function buscarEnPaginaPrincipal() {
    const searchInput = document.getElementById("searchInput");
    const valorBusqueda = searchInput ? searchInput.value.trim() : "";

    if (!valorBusqueda) {
        ocultarSugerenciasBusqueda();
        return;
    }

    renderizarSugerenciasBusqueda(valorBusqueda);

    const busqueda = normalizarTexto(valorBusqueda);
    const primerResultado = carrito.find(producto => productoCoincideConBusqueda(producto, busqueda));

    if (primerResultado) {
        seleccionarProductoDelCarritoBusqueda(primerResultado.id_producto, primerResultado.nombre || "");
    }
}

function enviarBusquedaAPaginaPrincipal(valorBusqueda) {
    renderizarSugerenciasBusqueda(valorBusqueda);
}

function productoCoincideConBusqueda(producto, busqueda) {
    const nombre = normalizarTexto(producto.nombre);
    const categoria = normalizarTexto(producto.categoria);
    const descripcion = normalizarTexto(producto.descripcion);

    return (
        nombre.includes(busqueda) ||
        categoria.includes(busqueda) ||
        descripcion.includes(busqueda)
    );
}

function normalizarTexto(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}


async function verificarSesion() {
    try {
        const respuesta = await fetch(`${AUTH_API_URL}?accion=me`, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        usuarioRegistrado = Boolean(datos.ok && datos.logueado);
        datosUsuario = usuarioRegistrado ? datos.usuario : null;

    } catch (error) {
        console.error("Error verificando sesión:", error);
        usuarioRegistrado = false;
        datosUsuario = null;
    }
}

function actualizarHeaderSesion() {
    if (!linkSesion) return;

    if (!usuarioRegistrado || !datosUsuario) {
        linkSesion.textContent = "👤 Iniciar Sesión";
        cerrarMenuCuenta();

        if (adminPanelLink) {
            adminPanelLink.classList.add("oculto");
        }

        return;
    }

    const nombre = obtenerNombreUsuario();
    linkSesion.textContent = `👤 ${nombre}`;

    if (adminPanelLink) {
        if (datosUsuario.rol === "Administrador") {
            adminPanelLink.classList.remove("oculto");
        } else {
            adminPanelLink.classList.add("oculto");
        }
    }
}

function obtenerNombreUsuario() {
    const nombre = (
        datosUsuario?.nombre_completo ||
        `${datosUsuario?.nombre || ""} ${datosUsuario?.apellido || ""}` ||
        datosUsuario?.correo ||
        "Mi cuenta"
    ).trim();

    return nombre || "Mi cuenta";
}

function alternarMenuCuenta() {
    if (!accountMenu) return;
    accountMenu.classList.toggle("oculto");
}

function cerrarMenuCuenta() {
    if (!accountMenu) return;
    accountMenu.classList.add("oculto");
}

async function cargarCarritoDesdeBD() {
    if (!usuarioRegistrado) {
        carrito = [];
        actualizarContador();
        return;
    }

    try {
        const respuesta = await fetch(`${CART_API_URL}?accion=obtener`, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo cargar el carrito.");
        }

        carrito = normalizarCarrito(datos.carrito || []);

    } catch (error) {
        console.error("Error cargando carrito:", error);
        carrito = [];
        alert(error.message);
    }
}

function normalizarCarrito(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.map(producto => {
        const precioProducto = Number(
            producto.precio ||
            producto.precio_venta ||
            producto.price ||
            0
        );

        return {
            id_producto: Number(producto.id_producto || producto.id || 0),
            nombre: producto.nombre || producto.name || "Producto",
            descripcion: producto.descripcion || producto.description || "Producto agregado al carrito.",
            precio: precioProducto,
            precio_venta: precioProducto,
            cantidad: Number(producto.cantidad || producto.quantity || 1),
            imagen: producto.imagen || producto.imagen_url || producto.image || obtenerImagenPorNombre(producto.nombre || "")
        };
    }).filter(producto => producto.id_producto > 0 && producto.cantidad > 0);
}

async function actualizarCantidadCarrito(idProducto, cantidad) {
    const respuesta = await fetch(CART_API_URL, {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            accion: "actualizar",
            id_producto: Number(idProducto),
            cantidad: Number(cantidad)
        })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || datos.ok === false) {
        throw new Error(datos.mensaje || "No se pudo actualizar el carrito.");
    }

    carrito = normalizarCarrito(datos.carrito || []);
}

async function eliminarProductoCarrito(idProducto) {
    const respuesta = await fetch(`${CART_API_URL}?accion=eliminar&id_producto=${encodeURIComponent(idProducto)}`, {
        method: "DELETE",
        credentials: "include"
    });

    const datos = await respuesta.json();

    if (!respuesta.ok || datos.ok === false) {
        throw new Error(datos.mensaje || "No se pudo eliminar el producto.");
    }

    carrito = normalizarCarrito(datos.carrito || []);
}

function renderizarCarrito() {
    if (!listaCarrito || !carritoVacio || !contadorCarrito) return;

    listaCarrito.innerHTML = "";

    if (carrito.length === 0) {
        carritoVacio.classList.remove("oculto");
        contadorCarrito.textContent = "0";
        return;
    }

    carritoVacio.classList.add("oculto");

    carrito.forEach((producto, index) => {
        const item = document.createElement("article");
        item.className = "producto-carrito";
        item.dataset.productId = Number(producto.id_producto || 0);

        item.innerHTML = `
            <img src="${escapeHTML(producto.imagen)}" alt="${escapeHTML(producto.nombre)}" class="producto-img">

            <div class="producto-info">
                <h3>${escapeHTML(producto.nombre)}</h3>
                <p>${escapeHTML(producto.descripcion)}</p>

                <div class="cantidad-control">
                    <button type="button" class="btn-cantidad" data-accion="restar">-</button>
                    <span class="numero-cantidad">${Number(producto.cantidad || 1)}</span>
                    <button type="button" class="btn-cantidad" data-accion="sumar">+</button>
                </div>
            </div>

            <div class="producto-acciones">
                <div class="precio-producto">${formatoCOP.format(producto.precio)}</div>
                <button type="button" class="btn-eliminar">Eliminar</button>
            </div>
        `;

        const btnRestar = item.querySelector('[data-accion="restar"]');
        const btnSumar = item.querySelector('[data-accion="sumar"]');
        const btnEliminar = item.querySelector(".btn-eliminar");

        btnRestar.addEventListener("click", () => cambiarCantidad(producto.id_producto, -1));
        btnSumar.addEventListener("click", () => cambiarCantidad(producto.id_producto, 1));
        btnEliminar.addEventListener("click", () => eliminarProducto(producto.id_producto));

        listaCarrito.appendChild(item);
    });

    actualizarContador();
}

async function cambiarCantidad(idProducto, cambio) {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    const producto = carrito.find(item => Number(item.id_producto) === Number(idProducto));

    if (!producto) return;

    const nuevaCantidad = Math.max(1, Number(producto.cantidad || 1) + cambio);

    try {
        await actualizarCantidadCarrito(idProducto, nuevaCantidad);
        renderizarCarrito();
        calcularTotales();
    } catch (error) {
        alert(error.message);
    }
}

async function eliminarProducto(idProducto) {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    try {
        await eliminarProductoCarrito(idProducto);
        renderizarCarrito();
        calcularTotales();
    } catch (error) {
        alert(error.message);
    }
}

function actualizarContador() {
    const cantidadTotal = carrito.reduce((totalActual, producto) => {
        return totalActual + Number(producto.cantidad || 1);
    }, 0);

    contadorCarrito.textContent = cantidadTotal;
}

function calcularTotales() {
    subtotal = carrito.reduce((acumulado, producto) => {
        return acumulado + Number(producto.precio || 0) * Number(producto.cantidad || 1);
    }, 0);

    envio = carrito.length > 0
        ? Number(envioCalculado?.costo_domicilio ?? ENVIO_FIJO)
        : 0;

    total = subtotal + envio;

    if (subtotalTexto) subtotalTexto.textContent = formatoCOP.format(subtotal);
    if (envioTexto) envioTexto.textContent = formatoCOP.format(envio);
    if (totalTexto) totalTexto.textContent = formatoCOP.format(total);

    if (subtotalFinal) subtotalFinal.textContent = formatoCOP.format(subtotal);
    if (envioFinal) envioFinal.textContent = formatoCOP.format(envio);
    if (totalFinal) totalFinal.textContent = formatoCOP.format(total);

    actualizarTextoDistanciaEnvio();
}

function abrirModalSesion() {
    if (!modalSesion || !mensajeSesion) return;

    mensajeSesion.textContent = "Para continuar con la compra debes iniciar sesión o crear una cuenta.";

    if (window.AuthPasswordReset) {
        window.AuthPasswordReset.resetAll();
    }

    modalSesion.classList.remove("oculto");
}

function cerrarModalLogin() {
    if (modalSesion) modalSesion.classList.add("oculto");
    if (formLoginCarrito) formLoginCarrito.reset();

    if (window.AuthPasswordReset) {
        window.AuthPasswordReset.resetAll();
    }
}


function configurarSelectBarrioEnvio() {
    const barrioSelect = document.getElementById("barrioEnvio");

    if (!barrioSelect) return;

    barrioSelect.innerHTML = `<option value="">Selecciona tu barrio</option>`;

    registerOptions.barrios.forEach(barrio => {
        const option = document.createElement("option");
        option.value = barrio.id_barrio;
        option.textContent = barrio.nombre;
        barrioSelect.appendChild(option);
    });

    barrioSelect.addEventListener("change", async () => {
        await calcularEnvioPorBarrio();
        calcularTotales();
    });
}

async function calcularEnvioPorBarrio() {
    const barrioSelect = document.getElementById("barrioEnvio");
    const idBarrio = barrioSelect?.value || datosUsuario?.id_barrio || "";

    if (!idBarrio || carrito.length === 0) {
        envioCalculado = null;
        return;
    }

    try {
        const url = `${CHECKOUT_SHIPPING_API_URL}&id_barrio=${encodeURIComponent(idBarrio)}&subtotal=${encodeURIComponent(subtotal)}`;

        const respuesta = await fetch(url, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo calcular el envío.");
        }

        envioCalculado = datos.envio || null;

    } catch (error) {
        console.error("Error calculando envío:", error);
        envioCalculado = {
            distancia_km: 0,
            costo_domicilio: ENVIO_FIJO,
            mensaje: "No se pudo calcular la distancia. Se usa el envío mínimo."
        };
    }
}

function actualizarTextoDistanciaEnvio() {
    const info = document.getElementById("envioDistanciaInfo");

    if (!info) return;

    if (!envioCalculado || carrito.length === 0) {
        info.textContent = "";
        return;
    }

    const distancia = Number(envioCalculado.distancia_km || 0);
    const mensaje = envioCalculado.mensaje || "";

    if (mensaje) {
        info.textContent = `${mensaje} Distancia aproximada: ${distancia.toFixed(2)} km.`;
        return;
    }

    info.textContent = `Distancia aproximada: ${distancia.toFixed(2)} km.`;
}


async function abrirPanelEnvio() {
    llenarDatosEnvio();
    await calcularEnvioPorBarrio();
    calcularTotales();
    panelEnvio.classList.remove("oculto");
}

function cerrarPanel() {
    panelEnvio.classList.add("oculto");
}

function llenarDatosEnvio() {
    if (!datosUsuario) return;

    const nombreCompleto = (
        datosUsuario.nombre_completo ||
        `${datosUsuario.nombre || ""} ${datosUsuario.apellido || ""}`
    ).trim();

    const nombreInput = document.getElementById("nombre");
    const correoInput = document.getElementById("correo");
    const telefonoInput = document.getElementById("telefono");
    const direccionInput = document.getElementById("direccion");
    const barrioSelect = document.getElementById("barrioEnvio");

    if (nombreInput) nombreInput.value = nombreCompleto;
    if (correoInput) correoInput.value = datosUsuario.correo || "";
    if (telefonoInput) telefonoInput.value = datosUsuario.telefono || "";
    if (direccionInput) direccionInput.value = datosUsuario.direccion || "";

    if (barrioSelect && datosUsuario.id_barrio) {
        barrioSelect.value = datosUsuario.id_barrio;
    }
}

async function iniciarSesionDesdeCarrito(evento) {
    evento.preventDefault();

    const correo = document.getElementById("loginEmailCarrito").value.trim();
    const clave = document.getElementById("loginPasswordCarrito").value;

    if (!correo || !clave) {
        alert("Ingresa el correo y la contraseña.");
        return;
    }

    try {
        const respuesta = await fetch(AUTH_API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accion: "login",
                correo,
                clave
            })
        });

        const texto = await respuesta.text();

        let datos;

        try {
            datos = JSON.parse(texto);
        } catch (error) {
            console.error("Respuesta cruda de auth.php:", texto);
            throw new Error("auth.php no devolvió JSON válido.");
        }

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo iniciar sesión.");
        }

        usuarioRegistrado = true;
        datosUsuario = datos.usuario;

        await cargarCarritoDesdeBD();
        renderizarCarrito();
        calcularTotales();
        actualizarHeaderSesion();
        cerrarModalLogin();

        alert("Sesión iniciada correctamente.");

        if (carrito.length > 0) {
            await abrirPanelEnvio();
        }

    } catch (error) {
        alert(error.message);
    }
}

async function continuarAPago() {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    await cargarCarritoDesdeBD();
    await calcularEnvioPorBarrio();
    calcularTotales();

    if (carrito.length === 0) {
        alert("Tu carrito está vacío. Agrega productos antes de continuar.");
        renderizarCarrito();
        return;
    }

    const datosEnvio = {
        nombre: document.getElementById("nombre").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        direccion_entrega: document.getElementById("direccion").value.trim(),
        referencia: document.getElementById("referencia").value.trim(),
        id_barrio: document.getElementById("barrioEnvio")?.value || datosUsuario?.id_barrio || null,
        costo_domicilio: envio,
        distancia_km: Number(envioCalculado?.distancia_km || 0),
        mensaje_envio: envioCalculado?.mensaje || ""
    };

    if (
        !datosEnvio.nombre ||
        !datosEnvio.correo ||
        !datosEnvio.telefono ||
        !datosEnvio.direccion_entrega ||
        !datosEnvio.id_barrio
    ) {
        alert("Completa todos los datos obligatorios del envío, incluyendo el barrio.");
        return;
    }

    const referenciaPago = generarReferenciaPago();

    localStorage.setItem("datosEnvio", JSON.stringify(datosEnvio));

    localStorage.setItem("resumenPedido", JSON.stringify({
        referencia_pago: referenciaPago,
        carrito,
        subtotal,
        envio,
        total,
        total_en_centavos: total * 100,
        moneda: "COP",
        estado_pago: "pendiente"
    }));

    window.location.href = RUTA_PAGO;
}
function generarReferenciaPago() {
    const fecha = new Date();

    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");
    const hh = String(fecha.getHours()).padStart(2, "0");
    const min = String(fecha.getMinutes()).padStart(2, "0");
    const ss = String(fecha.getSeconds()).padStart(2, "0");

    const random = Math.floor(Math.random() * 9000) + 1000;

    return `SSJ-${yyyy}${mm}${dd}-${hh}${min}${ss}-${random}`;
}

if (btnContinuarCompra) {
    btnContinuarCompra.addEventListener("click", async () => {
        await verificarSesion();
        actualizarHeaderSesion();

        if (usuarioRegistrado) {
            await cargarCarritoDesdeBD();
        }

        if (carrito.length === 0) {
            alert("Tu carrito está vacío. Agrega productos antes de continuar.");
            renderizarCarrito();
            calcularTotales();
            return;
        }

        if (!usuarioRegistrado) {
            abrirModalSesion();
            return;
        }

        await abrirPanelEnvio();
    });
}

if (linkSesion) {
    linkSesion.addEventListener("click", async evento => {
        evento.preventDefault();
        evento.stopPropagation();

        await verificarSesion();
        actualizarHeaderSesion();

        if (usuarioRegistrado) {
            alternarMenuCuenta();
            return;
        }

        abrirModalSesion();
    });
}

document.addEventListener("click", evento => {
    const accountBox = document.querySelector(".account-box");

    if (accountMenu && accountBox && !accountBox.contains(evento.target)) {
        cerrarMenuCuenta();
    }
});

if (viewProfileBtn) {
    viewProfileBtn.addEventListener("click", () => {
        abrirPerfil(false);
    });
}

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        abrirPerfil(true);
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", cerrarSesionUsuario);
}

if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener("click", cerrarPerfil);
}

if (cancelProfileModalBtn) {
    cancelProfileModalBtn.addEventListener("click", cerrarPerfil);
}

if (profileModal) {
    profileModal.addEventListener("click", evento => {
        if (evento.target === profileModal) {
            cerrarPerfil();
        }
    });
}

if (profileForm) {
    profileForm.addEventListener("submit", guardarCambiosPerfil);
}

if (cerrarModalSesion) {
    cerrarModalSesion.addEventListener("click", cerrarModalLogin);
}

if (cerrarPanelEnvio) {
    cerrarPanelEnvio.addEventListener("click", cerrarPanel);
}

if (formLoginCarrito) {
    formLoginCarrito.addEventListener("submit", iniciarSesionDesdeCarrito);
}

if (modalSesion) {
    modalSesion.addEventListener("click", evento => {
        if (evento.target === modalSesion) {
            cerrarModalLogin();
        }
    });
}

if (panelEnvio) {
    panelEnvio.addEventListener("click", evento => {
        if (evento.target === panelEnvio) {
            cerrarPanel();
        }
    });
}

if (formEnvio) {
    formEnvio.addEventListener("submit", async evento => {
        evento.preventDefault();
        await continuarAPago();
    });
}

async function cargarOpcionesPerfil() {
    try {
        const respuesta = await fetch(REGISTER_OPTIONS_API_URL, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudieron cargar las opciones del perfil.");
        }

        registerOptions.generos = datos.generos || [];
        registerOptions.barrios = datos.barrios || [];

        llenarSelectPerfil("profileGender", registerOptions.generos, "id_genero", "genero", "Sin género");
        llenarSelectPerfil("profileNeighborhood", registerOptions.barrios, "id_barrio", "nombre", "Sin barrio");
        configurarSelectBarrioEnvio();

    } catch (error) {
        console.error("Error cargando opciones del perfil:", error);
    }
}

function llenarSelectPerfil(selectId, items, valueKey, textKey, defaultText) {
    const select = document.getElementById(selectId);

    if (!select) return;

    select.innerHTML = `<option value="">${defaultText}</option>`;

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item[valueKey];
        option.textContent = item[textKey];
        select.appendChild(option);
    });
}

function abrirPerfil(modoEdicion = false) {
    if (!usuarioRegistrado || !datosUsuario) {
        abrirModalSesion();
        return;
    }

    cerrarMenuCuenta();

    const nombreCompleto = (
        datosUsuario.nombre_completo ||
        `${datosUsuario.nombre || ""} ${datosUsuario.apellido || ""}`
    ).trim();

    const campos = {
        profileName: datosUsuario.nombre || nombreCompleto || "",
        profileLastName: datosUsuario.apellido || "",
        profileDocument: datosUsuario.documento || "",
        profileEmail: datosUsuario.correo || "",
        profilePhone: datosUsuario.telefono || "",
        profileGender: datosUsuario.id_genero || "",
        profileNeighborhood: datosUsuario.id_barrio || "",
        profileRole: datosUsuario.rol || "",
        profileAddress: datosUsuario.direccion || ""
    };

    Object.entries(campos).forEach(([id, value]) => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.value = value;
        }
    });

    cambiarModoPerfil(modoEdicion);

    if (profileModal) {
        profileModal.classList.remove("oculto");
    }
}

function cerrarPerfil() {
    if (profileModal) {
        profileModal.classList.add("oculto");
    }
}

function cambiarModoPerfil(modoEdicion) {
    const camposEditables = [
        "profileName",
        "profileLastName",
        "profileDocument",
        "profileEmail",
        "profilePhone",
        "profileGender",
        "profileNeighborhood",
        "profileAddress"
    ];

    camposEditables.forEach(id => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.disabled = !modoEdicion;
        }
    });

    const titulo = document.getElementById("profileModalTitle");
    const botonGuardar = document.getElementById("saveProfileBtn");

    if (titulo) {
        titulo.textContent = modoEdicion ? "Editar Perfil" : "Mi Perfil";
    }

    if (botonGuardar) {
        botonGuardar.style.display = modoEdicion ? "inline-flex" : "none";
    }
}

async function guardarCambiosPerfil(evento) {
    evento.preventDefault();

    try {
        const payload = {
            accion: "update_profile",
            nombre: document.getElementById("profileName").value.trim(),
            apellido: document.getElementById("profileLastName").value.trim(),
            documento: document.getElementById("profileDocument").value.trim(),
            correo: document.getElementById("profileEmail").value.trim(),
            telefono: document.getElementById("profilePhone").value.trim(),
            id_genero: document.getElementById("profileGender").value || null,
            id_barrio: document.getElementById("profileNeighborhood").value || null,
            direccion: document.getElementById("profileAddress").value.trim()
        };

        const respuesta = await fetch(AUTH_API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo actualizar el perfil.");
        }

        datosUsuario = datos.usuario;
        usuarioRegistrado = true;

        actualizarHeaderSesion();
        cerrarPerfil();

        alert("Perfil actualizado correctamente.");

    } catch (error) {
        alert(error.message);
    }
}

async function cerrarSesionUsuario() {
    try {
        const respuesta = await fetch(AUTH_API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accion: "logout"
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo cerrar sesión.");
        }

        usuarioRegistrado = false;
        datosUsuario = null;
        carrito = [];
        localStorage.removeItem("carrito");

        cerrarMenuCuenta();
        cerrarPerfil();
        actualizarHeaderSesion();
        renderizarCarrito();
        calcularTotales();

        alert("Sesión cerrada correctamente.");

    } catch (error) {
        alert(error.message);
    }
}

function obtenerImagenPorNombre(nombre) {
    const nombreMinuscula = String(nombre || "").toLowerCase();

    if (nombreMinuscula.includes("carne")) {
        return "img/carne-de-res.jpg";
    }

    if (nombreMinuscula.includes("avena")) {
        return "img/default.jpg";
    }

    return "img/default.jpg";
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}