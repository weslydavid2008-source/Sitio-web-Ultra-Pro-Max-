const CHECKOUT_API_URL = "../api/checkout.php";
const AUTH_API_URL = "../api/auth.php";
const CART_API_URL = "../api/carrito.php";
const REGISTER_OPTIONS_API_URL = "../api/registro_opciones.php";
const CHECKOUT_SHIPPING_API_URL = "../api/checkout.php?accion=calcular_envio";

const checkoutContent = document.getElementById("checkoutContent");
const checkoutBenefits = document.getElementById("checkoutBenefits");
const loginRequired = document.getElementById("loginRequired");
const emptyCartMessage = document.getElementById("emptyCartMessage");

const checkoutProducts = document.getElementById("checkoutProducts");
const subtotalText = document.getElementById("subtotalText");
const shippingText = document.getElementById("shippingText");
const totalText = document.getElementById("totalText");

const successModal = document.getElementById("successModal");
const successMessage = document.getElementById("successMessage");
const payNowBtn = document.getElementById("payNowBtn");
const contadorCarrito = document.getElementById("contadorCarrito");
const linkSesion = document.getElementById("linkSesion");

const accountMenu = document.getElementById("accountMenu");
const viewProfileBtn = document.getElementById("viewProfileBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const adminPanelLink = document.getElementById("adminPanelLink");
const logoutBtn = document.getElementById("logoutBtn");

const modalSesion = document.getElementById("modalSesion");
const cerrarModalSesion = document.getElementById("cerrarModalSesion");
const formLoginCarrito = document.getElementById("formLoginCarrito");
const mensajeSesion = document.getElementById("mensajeSesion");

const profileModal = document.getElementById("profileModal");
const closeProfileModalBtn = document.getElementById("closeProfileModal");
const cancelProfileModalBtn = document.getElementById("cancelProfileModal");
const profileForm = document.getElementById("profileForm");

let registerOptions = {
    generos: [],
    barrios: []
};

let currentUser = null;
let carrito = [];
let datosEnvio = {};
let resumenPedido = {};
let subtotal = 0;
let envio = 0;
let total = 0;
let metodoPagoSeleccionado = "tarjeta";

const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", iniciarCheckout);

async function iniciarCheckout() {
    localStorage.removeItem("carrito");

    datosEnvio = obtenerDatosEnvio();
    resumenPedido = obtenerResumenPedido();

    configurarEventosPago();
    configurarFormatoTarjeta();
    configurarEventosHeader();

    await cargarOpcionesPerfil();
    await verificarSesion();
    await cargarCarritoDesdeBD();

    actualizarContadorCarrito();
    actualizarHeaderSesion();
    await evaluarVistaCheckout();
}

async function evaluarVistaCheckout() {
    if (!currentUser) {
        mostrarSolo(loginRequired);
        return;
    }

    if (carrito.length === 0 || !datosEnvio.direccion_entrega) {
        mostrarSolo(emptyCartMessage);
        return;
    }

    calcularTotales();
    await recalcularEnvioPorBarrio();
    calcularTotales();
    renderizarProductos();
    mostrarSolo(checkoutContent);
    checkoutBenefits.classList.remove("oculto");
}

async function verificarSesion() {
    try {
        const respuesta = await fetch(`${AUTH_API_URL}?accion=me`, {
            credentials: "include",
            cache: "no-store"
        });

        const texto = await respuesta.text();

        let datos;

        try {
            datos = JSON.parse(texto);
        } catch (error) {
            console.error("Respuesta cruda de auth.php:", texto);
            currentUser = null;
            return;
        }

        currentUser = datos.ok && datos.logueado
            ? datos.usuario
            : null;

    } catch (error) {
        console.error("Error verificando sesión:", error);
        currentUser = null;
    }
}

function actualizarHeaderSesion() {
    if (!linkSesion) return;

    if (!currentUser) {
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
        if (currentUser.rol === "Administrador") {
            adminPanelLink.classList.remove("oculto");
        } else {
            adminPanelLink.classList.add("oculto");
        }
    }
}

function obtenerNombreUsuario() {
    const nombre = (
        currentUser?.nombre_completo ||
        `${currentUser?.nombre || ""} ${currentUser?.apellido || ""}` ||
        currentUser?.correo ||
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
    if (!currentUser) {
        carrito = [];
        return;
    }

    try {
        const respuesta = await fetch(`${CART_API_URL}?accion=obtener`, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false || datos.logueado === false) {
            carrito = [];
            return;
        }

        carrito = normalizarCarrito(datos.carrito || []);

    } catch (error) {
        console.error("Error cargando carrito:", error);
        carrito = [];
    }
}

function normalizarCarrito(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.map(producto => ({
        id_producto: Number(producto.id_producto || producto.id || 0),
        nombre: producto.nombre || producto.name || "Producto",
        descripcion: producto.descripcion || producto.description || "",
        precio: Number(producto.precio || producto.precio_venta || producto.price || 0),
        cantidad: Number(producto.cantidad || producto.quantity || 1),
        imagen: producto.imagen || producto.imagen_url || producto.image || "img/default.jpg"
    })).filter(producto => producto.id_producto > 0 && producto.cantidad > 0);
}

function obtenerDatosEnvio() {
    const datos = localStorage.getItem("datosEnvio");

    if (!datos) {
        return {};
    }

    try {
        return JSON.parse(datos) || {};
    } catch (error) {
        return {};
    }
}

function obtenerResumenPedido() {
    const datos = localStorage.getItem("resumenPedido");

    if (!datos) {
        return {};
    }

    try {
        return JSON.parse(datos) || {};
    } catch (error) {
        return {};
    }
}

function actualizarContadorCarrito() {
    const cantidadTotal = carrito.reduce((totalActual, producto) => {
        return totalActual + Number(producto.cantidad || 1);
    }, 0);

    if (contadorCarrito) {
        contadorCarrito.textContent = cantidadTotal;
    }
}


async function recalcularEnvioPorBarrio() {
    subtotal = carrito.reduce((acumulado, producto) => {
        return acumulado + Number(producto.precio || 0) * Number(producto.cantidad || 1);
    }, 0);

    if (!datosEnvio.id_barrio) {
        return;
    }

    try {
        const respuesta = await fetch(`${CHECKOUT_SHIPPING_API_URL}&id_barrio=${encodeURIComponent(datosEnvio.id_barrio)}&subtotal=${encodeURIComponent(subtotal)}`, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo calcular el domicilio.");
        }

        if (datos.envio) {
            datosEnvio.costo_domicilio = Number(datos.envio.costo_domicilio || 0);
            datosEnvio.distancia_km = Number(datos.envio.distancia_km || 0);
            datosEnvio.mensaje_envio = datos.envio.mensaje || "";

            resumenPedido.envio = datosEnvio.costo_domicilio;

            localStorage.setItem("datosEnvio", JSON.stringify(datosEnvio));
            localStorage.setItem("resumenPedido", JSON.stringify(resumenPedido));
        }

    } catch (error) {
        console.error("Error calculando domicilio:", error);

        if (datosEnvio.costo_domicilio === undefined && resumenPedido.envio !== undefined) {
            datosEnvio.costo_domicilio = Number(resumenPedido.envio || 0);
        }
    }
}


function calcularTotales() {
    subtotal = carrito.reduce((acumulado, producto) => {
        return acumulado + Number(producto.precio || 0) * Number(producto.cantidad || 1);
    }, 0);

    const envioGuardado = datosEnvio.costo_domicilio;
    const envioResumen = resumenPedido.envio;

    envio = Number(
        envioGuardado !== undefined && envioGuardado !== null && envioGuardado !== ""
            ? envioGuardado
            : (envioResumen !== undefined && envioResumen !== null && envioResumen !== "" ? envioResumen : 0)
    );

    total = subtotal + envio;

    subtotalText.textContent = formatoCOP.format(subtotal);
    shippingText.textContent = formatoCOP.format(envio);
    totalText.textContent = formatoCOP.format(total);
}

function renderizarProductos() {
    checkoutProducts.innerHTML = "";

    carrito.forEach(producto => {
        const item = document.createElement("article");
        item.className = "checkout-product";

        item.innerHTML = `
            <img src="${escapeHTML(producto.imagen)}" alt="${escapeHTML(producto.nombre)}">

            <div>
                <h3>${escapeHTML(producto.nombre)}</h3>
                <p>${producto.cantidad} × ${formatoCOP.format(producto.precio)}</p>
            </div>

            <strong>${formatoCOP.format(producto.precio * producto.cantidad)}</strong>
        `;

        checkoutProducts.appendChild(item);
    });
}

function configurarEventosHeader() {
    if (linkSesion) {
        linkSesion.addEventListener("click", async evento => {
            evento.preventDefault();
            evento.stopPropagation();

            await verificarSesion();
            actualizarHeaderSesion();

            if (currentUser) {
                alternarMenuCuenta();
                return;
            }

            abrirModalSesion();
        });
    }

    const openCheckoutLogin = document.getElementById("openCheckoutLogin");

    if (openCheckoutLogin) {
        openCheckoutLogin.addEventListener("click", abrirModalSesion);
    }

    document.addEventListener("click", evento => {
        const accountBox = document.querySelector(".account-box");

        if (accountMenu && accountBox && !accountBox.contains(evento.target)) {
            cerrarMenuCuenta();
        }
    });

    viewProfileBtn?.addEventListener("click", () => abrirPerfil(false));
    editProfileBtn?.addEventListener("click", () => abrirPerfil(true));
    logoutBtn?.addEventListener("click", cerrarSesionUsuario);

    cerrarModalSesion?.addEventListener("click", cerrarModalLogin);
    formLoginCarrito?.addEventListener("submit", iniciarSesionDesdeCheckout);

    modalSesion?.addEventListener("click", evento => {
        if (evento.target === modalSesion) {
            cerrarModalLogin();
        }
    });

    closeProfileModalBtn?.addEventListener("click", cerrarPerfil);
    cancelProfileModalBtn?.addEventListener("click", cerrarPerfil);

    profileModal?.addEventListener("click", evento => {
        if (evento.target === profileModal) {
            cerrarPerfil();
        }
    });

    profileForm?.addEventListener("submit", guardarCambiosPerfil);
}

function abrirModalSesion() {
    if (!modalSesion || !mensajeSesion) {
        window.location.href = "index.html";
        return;
    }

    mensajeSesion.textContent = "Para continuar con la compra debes iniciar sesión o crear una cuenta.";

    if (window.AuthPasswordReset) {
        window.AuthPasswordReset.resetAll();
    }

    modalSesion.classList.remove("oculto");
}

function cerrarModalLogin() {
    modalSesion?.classList.add("oculto");
    formLoginCarrito?.reset();

    if (window.AuthPasswordReset) {
        window.AuthPasswordReset.resetAll();
    }
}

async function iniciarSesionDesdeCheckout(evento) {
    evento.preventDefault();

    const correo = document.getElementById("loginEmailCarrito")?.value.trim() || "";
    const clave = document.getElementById("loginPasswordCarrito")?.value || "";

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

        currentUser = datos.usuario;
        await cargarCarritoDesdeBD();
        actualizarContadorCarrito();
        cerrarModalLogin();
        actualizarHeaderSesion();
        await evaluarVistaCheckout();

        alert("Sesión iniciada correctamente.");

    } catch (error) {
        alert(error.message);
    }
}

function configurarEventosPago() {
    document.querySelectorAll(".payment-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const metodo = tab.dataset.method || "tarjeta";
            cambiarMetodoPago(metodo);
        });
    });

    if (payNowBtn) {
        payNowBtn.addEventListener("click", pagarAhora);
    }
}

function cambiarMetodoPago(metodo) {
    metodoPagoSeleccionado = metodo;

    document.querySelectorAll(".payment-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.method === metodo);
    });

    const panels = {
        tarjeta: document.getElementById("panelTarjeta"),
        nequi: document.getElementById("panelNequi"),
        transferencia: document.getElementById("panelTransferencia"),
        contra_entrega: document.getElementById("panelContraEntrega")
    };

    Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle("oculto", key !== metodo);
    });
}

function configurarFormatoTarjeta() {
    const cardNumber = document.getElementById("cardNumber");
    const cardDate = document.getElementById("cardDate");
    const cardCvv = document.getElementById("cardCvv");

    if (cardNumber) {
        cardNumber.addEventListener("input", () => {
            let value = cardNumber.value.replace(/\D/g, "").slice(0, 16);
            value = value.replace(/(.{4})/g, "$1 ").trim();
            cardNumber.value = value;
        });
    }

    if (cardDate) {
        cardDate.addEventListener("input", () => {
            let value = cardDate.value.replace(/\D/g, "").slice(0, 4);

            if (value.length >= 3) {
                value = value.slice(0, 2) + "/" + value.slice(2);
            }

            cardDate.value = value;
        });
    }

    if (cardCvv) {
        cardCvv.addEventListener("input", () => {
            cardCvv.value = cardCvv.value.replace(/\D/g, "").slice(0, 4);
        });
    }
}

function validarPago() {
    if (metodoPagoSeleccionado === "tarjeta") {
        const cardName = document.getElementById("cardName").value.trim();
        const cardNumber = document.getElementById("cardNumber").value.replace(/\D/g, "");
        const cardDate = document.getElementById("cardDate").value.trim();
        const cardCvv = document.getElementById("cardCvv").value.trim();

        if (!cardName || cardNumber.length < 13 || cardDate.length < 5 || cardCvv.length < 3) {
            alert("Completa correctamente los datos de la tarjeta.");
            return false;
        }
    }

    if (metodoPagoSeleccionado === "nequi") {
        const phone = document.getElementById("nequiPhone").value.trim();

        if (!phone || phone.length < 7) {
            alert("Ingresa el número de celular para Nequi o Daviplata.");
            return false;
        }
    }

    return true;
}

async function pagarAhora() {
    if (!currentUser) {
        alert("Debes iniciar sesión para finalizar la compra.");
        return;
    }

    if (carrito.length === 0) {
        alert("Tu carrito está vacío.");
        return;
    }

    if (!datosEnvio.nombre || !datosEnvio.correo || !datosEnvio.telefono || !datosEnvio.direccion_entrega) {
        alert("Faltan datos de envío. Vuelve al carrito y confirma tus datos.");
        window.location.href = "carrito.html";
        return;
    }

    if (!validarPago()) {
        return;
    }

    const carritoParaEnviar = carrito.map(producto => ({
        id_producto: Number(producto.id_producto),
        cantidad: Number(producto.cantidad || 1)
    }));

    const productoInvalido = carritoParaEnviar.some(producto => {
        return !producto.id_producto || producto.id_producto <= 0 || producto.cantidad <= 0;
    });

    if (productoInvalido) {
        alert("Hay productos inválidos en el carrito. Vuelve a agregarlos desde la tienda.");
        return;
    }

    payNowBtn.disabled = true;
    payNowBtn.textContent = "Procesando pago...";

    try {
        const respuesta = await fetch(CHECKOUT_API_URL, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                carrito: carritoParaEnviar,
                envio: {
                    nombre: datosEnvio.nombre,
                    correo: datosEnvio.correo,
                    telefono: datosEnvio.telefono,
                    direccion_entrega: datosEnvio.direccion_entrega,
                    referencia: datosEnvio.referencia || "",
                    id_barrio: datosEnvio.id_barrio || null,
                    costo_domicilio: envio
                },
                metodo_pago: metodoPagoSeleccionado,
                referencia_pago: document.getElementById("transferReference")?.value.trim() || "",
                telefono_billetera: document.getElementById("nequiPhone")?.value.trim() || ""
            })
        });

        const texto = await respuesta.text();

        let resultado;

        try {
            resultado = JSON.parse(texto);
        } catch (error) {
            console.error("Respuesta cruda de checkout.php:", texto);
            throw new Error("checkout.php no devolvió JSON válido. Revisa errores PHP.");
        }

        if (!respuesta.ok || resultado.ok === false) {
            throw new Error(resultado.mensaje || "No se pudo crear el pedido.");
        }

        localStorage.removeItem("carrito");
        localStorage.removeItem("datosEnvio");
        localStorage.removeItem("resumenPedido");

        carrito = [];
        actualizarContadorCarrito();

        successMessage.textContent = `Pedido #${String(resultado.id_venta).padStart(4, "0")} registrado por ${formatoCOP.format(resultado.total)}. También quedó guardado en Mis Listas.`;
        successModal.classList.remove("oculto");

    } catch (error) {
        console.error("Error creando pedido:", error);
        alert("No se pudo finalizar la compra: " + error.message);

    } finally {
        payNowBtn.disabled = false;
        payNowBtn.textContent = "Pagar ahora";
    }
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
    if (!currentUser) {
        abrirModalSesion();
        return;
    }

    cerrarMenuCuenta();

    const nombreCompleto = (
        currentUser.nombre_completo ||
        `${currentUser.nombre || ""} ${currentUser.apellido || ""}`
    ).trim();

    const campos = {
        profileName: currentUser.nombre || nombreCompleto || "",
        profileLastName: currentUser.apellido || "",
        profileDocument: currentUser.documento || "",
        profileEmail: currentUser.correo || "",
        profilePhone: currentUser.telefono || "",
        profileGender: currentUser.id_genero || "",
        profileNeighborhood: currentUser.id_barrio || "",
        profileRole: currentUser.rol || "",
        profileAddress: currentUser.direccion || ""
    };

    Object.entries(campos).forEach(([id, value]) => {
        const campo = document.getElementById(id);

        if (campo) {
            campo.value = value;
        }
    });

    cambiarModoPerfil(modoEdicion);
    profileModal?.classList.remove("oculto");
}

function cerrarPerfil() {
    profileModal?.classList.add("oculto");
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
            nombre: document.getElementById("profileName")?.value.trim() || "",
            apellido: document.getElementById("profileLastName")?.value.trim() || "",
            documento: document.getElementById("profileDocument")?.value.trim() || "",
            correo: document.getElementById("profileEmail")?.value.trim() || "",
            telefono: document.getElementById("profilePhone")?.value.trim() || "",
            id_genero: document.getElementById("profileGender")?.value || null,
            id_barrio: document.getElementById("profileNeighborhood")?.value || null,
            direccion: document.getElementById("profileAddress")?.value.trim() || ""
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

        currentUser = datos.usuario;
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

        currentUser = null;
        carrito = [];
        localStorage.removeItem("carrito");
        cerrarMenuCuenta();
        cerrarPerfil();
        actualizarContadorCarrito();
        actualizarHeaderSesion();
        await evaluarVistaCheckout();

        alert("Sesión cerrada correctamente.");

    } catch (error) {
        alert(error.message);
    }
}

function mostrarSolo(section) {
    loginRequired.classList.add("oculto");
    emptyCartMessage.classList.add("oculto");
    checkoutContent.classList.add("oculto");
    checkoutBenefits.classList.add("oculto");

    section.classList.remove("oculto");
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}