const AUTH_API_URL = "../api/auth.php";
const REGISTER_OPTIONS_API_URL = "../api/registro_opciones.php";
const MIS_LISTAS_API_URL = "../api/mis_listas.php";
const CART_API_URL = "../api/carrito.php";
const STORE_PRODUCTS_API_URL = "../api/tienda_productos.php";

const linkSesion = document.getElementById("linkSesion");
const contadorCarrito = document.getElementById("contadorCarrito");
const historialCompras = document.getElementById("historialCompras");
const misListasVacio = document.getElementById("misListasVacio");
const btnActualizarListas = document.getElementById("btnActualizarListas");
const modalSesion = document.getElementById("modalSesion");
const cerrarModalSesion = document.getElementById("cerrarModalSesion");
const formLoginCarrito = document.getElementById("formLoginCarrito");
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

const totalCompras = document.getElementById("totalCompras");
const totalProductos = document.getElementById("totalProductos");
const totalGastado = document.getElementById("totalGastado");

const tabListasPersonales = document.getElementById("tabListasPersonales");
const tabHistorialCompras = document.getElementById("tabHistorialCompras");
const listasPersonalizadasSection = document.getElementById("listasPersonalizadasSection");
const historialSection = document.getElementById("historialSection");
const btnMostrarCrearLista = document.getElementById("btnMostrarCrearLista");
const formCrearLista = document.getElementById("formCrearLista");
const nuevaListaNombre = document.getElementById("nuevaListaNombre");
const listaBuilderTitulo = document.getElementById("listaBuilderTitulo");
const listaProductoSelect = document.getElementById("listaProductoSelect");
const listaProductoCantidad = document.getElementById("listaProductoCantidad");
const btnAgregarProductoTemporal = document.getElementById("btnAgregarProductoTemporal");
const listaBuilderProductos = document.getElementById("listaBuilderProductos");
const btnCancelarLista = document.getElementById("btnCancelarLista");
const btnGuardarLista = document.getElementById("btnGuardarLista");
const listasPersonalizadas = document.getElementById("listasPersonalizadas");
const listasPersonalizadasVacio = document.getElementById("listasPersonalizadasVacio");

let usuarioRegistrado = false;
let datosUsuario = null;

let registerOptions = {
    generos: [],
    barrios: []
};
let compras = [];
let productosTienda = [];
let listasUsuario = [];
let busquedaListasActual = "";
let listaEditor = {
    id: null,
    productos: []
};

const formatoCOP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

document.addEventListener("DOMContentLoaded", async () => {
    configurarBuscadorMisListas();
    await cargarOpcionesPerfil();
    await verificarSesion();
    actualizarHeaderSesion();
    await actualizarContadorCarrito();
    await cargarProductosTienda();
    poblarSelectProductosLista();
    cargarListasUsuario();
    renderizarListasUsuario();
    await cargarMisListas();
    mostrarApartadoListas();
});

if (btnActualizarListas) {
    btnActualizarListas.addEventListener("click", async () => {
        await cargarMisListas();
    });
}


if (tabListasPersonales) {
    tabListasPersonales.addEventListener("click", mostrarApartadoListas);
}

if (tabHistorialCompras) {
    tabHistorialCompras.addEventListener("click", mostrarApartadoHistorial);
}

if (btnMostrarCrearLista) {
    btnMostrarCrearLista.addEventListener("click", iniciarCreacionLista);
}

if (formCrearLista) {
    formCrearLista.addEventListener("submit", guardarListaDesdeFormulario);
}

if (btnAgregarProductoTemporal) {
    btnAgregarProductoTemporal.addEventListener("click", agregarProductoTemporalALista);
}

if (btnCancelarLista) {
    btnCancelarLista.addEventListener("click", cerrarFormularioLista);
}

if (listaBuilderProductos) {
    listaBuilderProductos.addEventListener("click", manejarClickProductosTemporales);
}

if (listasPersonalizadas) {
    listasPersonalizadas.addEventListener("click", manejarClickListasUsuario);
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

if (formLoginCarrito) {
    formLoginCarrito.addEventListener("submit", iniciarSesionDesdeListas);
}

if (modalSesion) {
    modalSesion.addEventListener("click", evento => {
        if (evento.target === modalSesion) {
            cerrarModalLogin();
        }
    });
}



/* =========================
   BUSCADOR DE MIS LISTAS
   ========================= */

function configurarBuscadorMisListas() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const valor = searchInput.value.trim();
            renderizarSugerenciasBusquedaListas(valor);

            if (!valor) {
                busquedaListasActual = "";
                renderizarListasUsuario();
            }
        });

        searchInput.addEventListener("focus", () => {
            renderizarSugerenciasBusquedaListas(searchInput.value.trim());
        });

        searchInput.addEventListener("keydown", evento => {
            if (evento.key === "Enter") {
                evento.preventDefault();
                aplicarBusquedaListas(searchInput.value.trim());
            }

            if (evento.key === "Escape") {
                ocultarSugerenciasBusquedaListas();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            const valor = searchInput ? searchInput.value.trim() : "";
            aplicarBusquedaListas(valor);
        });
    }

    document.addEventListener("click", evento => {
        const searchBox = document.querySelector(".buscador");

        if (searchBox && !searchBox.contains(evento.target)) {
            ocultarSugerenciasBusquedaListas();
        }
    });
}

function renderizarSugerenciasBusquedaListas(valorBusqueda) {
    const panel = document.getElementById("searchResultsPanel");

    if (!panel) return;

    const busqueda = normalizarTextoLista(valorBusqueda);

    if (!busqueda) {
        ocultarSugerenciasBusquedaListas();
        return;
    }

    const resultados = obtenerProductosCoincidentesEnListas(busqueda).slice(0, 8);

    if (resultados.length === 0) {
        panel.innerHTML = `
            <div class="search-result-empty">
                No hay listas con ese producto.
            </div>
        `;
        panel.classList.remove("oculto");
        return;
    }

    panel.innerHTML = resultados.map(resultado => `
        <button
            type="button"
            class="search-result-item"
            data-search-value="${escapeHTML(resultado.producto.nombre || "")}"
            data-lista-id="${Number(resultado.lista.id || 0)}"
        >
            <img
                src="${escapeHTML(resultado.producto.imagen_url || "img/default.jpg")}"
                alt="${escapeHTML(resultado.producto.nombre || "Producto")}"
            >

            <span class="search-result-info">
                <strong>${escapeHTML(resultado.producto.nombre || "Producto")}</strong>
                <small>En lista: ${escapeHTML(resultado.lista.nombre || "Lista")}</small>
            </span>

            <span class="search-result-price">
                ${formatoCOP.format(Number(resultado.producto.precio_venta || 0) * Number(resultado.producto.cantidad || 1))}
            </span>
        </button>
    `).join("");

    panel.querySelectorAll(".search-result-item").forEach(item => {
        item.addEventListener("click", () => {
            const valor = item.dataset.searchValue || "";
            aplicarBusquedaListas(valor, Number(item.dataset.listaId || 0));
        });
    });

    panel.classList.remove("oculto");
}

function obtenerProductosCoincidentesEnListas(busqueda) {
    const resultados = [];

    listasUsuario.forEach(lista => {
        const productosLista = Array.isArray(lista.productos) ? lista.productos : [];

        productosLista.forEach(producto => {
            if (productoCoincideConBusquedaLista(producto, busqueda)) {
                resultados.push({ lista, producto });
            }
        });
    });

    return resultados;
}

function productoCoincideConBusquedaLista(producto, busqueda) {
    const nombre = normalizarTextoLista(producto.nombre);
    const categoria = normalizarTextoLista(producto.categoria);

    return nombre.includes(busqueda) || categoria.includes(busqueda);
}

function listaTieneProductoBuscado(lista, busqueda) {
    if (!busqueda) return true;

    const productosLista = Array.isArray(lista.productos) ? lista.productos : [];

    return productosLista.some(producto => productoCoincideConBusquedaLista(producto, busqueda));
}

function obtenerListasFiltradasPorBusqueda() {
    const busqueda = normalizarTextoLista(busquedaListasActual);

    if (!busqueda) {
        return listasUsuario;
    }

    return listasUsuario.filter(lista => listaTieneProductoBuscado(lista, busqueda));
}

function aplicarBusquedaListas(valorBusqueda, listaId = null) {
    const searchInput = document.getElementById("searchInput");
    const valor = String(valorBusqueda || "").trim();

    busquedaListasActual = valor;

    if (searchInput) {
        searchInput.value = valor;
    }

    ocultarSugerenciasBusquedaListas();
    mostrarApartadoListas();
    renderizarListasUsuario();

    const listaObjetivoId = listaId || obtenerListasFiltradasPorBusqueda()[0]?.id;

    if (listaObjetivoId) {
        setTimeout(() => {
            const card = document.querySelector(`.lista-personal-card[data-lista-id="${Number(listaObjetivoId)}"]`);

            if (!card) return;

            card.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            card.classList.add("search-highlight");

            setTimeout(() => {
                card.classList.remove("search-highlight");
            }, 1600);
        }, 80);
    }
}

function ocultarSugerenciasBusquedaListas() {
    const panel = document.getElementById("searchResultsPanel");

    if (panel) {
        panel.classList.add("oculto");
    }
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

function abrirModalSesion() {
    if (!modalSesion || !mensajeSesion) {
        window.location.href = "index.html";
        return;
    }

    mensajeSesion.textContent = "Para ver tus listas debes iniciar sesión o crear una cuenta.";

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

async function iniciarSesionDesdeListas(evento) {
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

        usuarioRegistrado = true;
        datosUsuario = datos.usuario;

        actualizarHeaderSesion();
        cerrarModalLogin();
        await actualizarContadorCarrito();
        await cargarProductosTienda();
        cargarListasUsuario();
        renderizarListasUsuario();
        await cargarMisListas();

        alert("Sesión iniciada correctamente.");

    } catch (error) {
        alert(error.message);
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
        compras = [];
        listasUsuario = [];

        renderizarListasUsuario();
        cerrarMenuCuenta();
        cerrarPerfil();
        actualizarHeaderSesion();
        renderizarResumen();
        await cargarMisListas();

        alert("Sesión cerrada correctamente.");

    } catch (error) {
        alert(error.message);
    }
}

async function actualizarContadorCarrito() {
    if (!contadorCarrito) return;

    if (!usuarioRegistrado) {
        contadorCarrito.textContent = "0";
        return;
    }

    try {
        const respuesta = await fetch(`${CART_API_URL}?accion=contador`, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
            contadorCarrito.textContent = "0";
            return;
        }

        contadorCarrito.textContent = Number(datos.total_cantidad || 0);

    } catch (error) {
        console.error("Error actualizando contador del carrito:", error);
        contadorCarrito.textContent = "0";
    }
}


function mostrarApartadoListas() {
    if (tabListasPersonales) tabListasPersonales.classList.add("activo");
    if (tabHistorialCompras) tabHistorialCompras.classList.remove("activo");
    if (listasPersonalizadasSection) listasPersonalizadasSection.classList.remove("oculto");
    if (historialSection) historialSection.classList.add("oculto");
}

function mostrarApartadoHistorial() {
    if (tabListasPersonales) tabListasPersonales.classList.remove("activo");
    if (tabHistorialCompras) tabHistorialCompras.classList.add("activo");
    if (listasPersonalizadasSection) listasPersonalizadasSection.classList.add("oculto");
    if (historialSection) historialSection.classList.remove("oculto");
}

async function cargarProductosTienda() {
    try {
        const respuesta = await fetch(STORE_PRODUCTS_API_URL, {
            credentials: "include",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !Array.isArray(datos)) {
            throw new Error("No se pudieron cargar los productos de la tienda.");
        }

        productosTienda = datos.map(producto => ({
            id_producto: Number(producto.id_producto || 0),
            nombre: producto.nombre || "Producto",
            categoria: producto.categoria || "Sin categoría",
            precio_venta: Number(producto.precio_venta || producto.precio || 0),
            imagen_url: producto.imagen_url || producto.imagen || "img/default.jpg"
        })).filter(producto => producto.id_producto > 0);

    } catch (error) {
        console.error("Error cargando productos para listas:", error);
        productosTienda = [];
    }
}

function obtenerClaveListasUsuario() {
    if (!usuarioRegistrado || !datosUsuario) return null;

    const userKey = datosUsuario.id_usuario || datosUsuario.id || datosUsuario.correo || "invitado";
    return `ssj_listas_personales_${userKey}`;
}

function cargarListasUsuario() {
    const key = obtenerClaveListasUsuario();

    if (!key) {
        listasUsuario = [];
        return;
    }

    try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        listasUsuario = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error leyendo listas personales:", error);
        listasUsuario = [];
    }
}

function guardarListasUsuario() {
    const key = obtenerClaveListasUsuario();
    if (!key) return;

    localStorage.setItem(key, JSON.stringify(listasUsuario));
}

function iniciarCreacionLista() {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    listaEditor = {
        id: null,
        productos: []
    };

    if (formCrearLista) formCrearLista.classList.remove("oculto");
    if (btnMostrarCrearLista) btnMostrarCrearLista.classList.add("oculto");
    if (nuevaListaNombre) nuevaListaNombre.value = "";
    if (listaBuilderTitulo) listaBuilderTitulo.textContent = "Crear nueva lista";
    if (btnGuardarLista) btnGuardarLista.textContent = "Guardar lista";

    poblarSelectProductosLista();
    renderizarProductosTemporales();

    if (nuevaListaNombre) nuevaListaNombre.focus();
}

function iniciarEdicionLista(listaId) {
    const lista = listasUsuario.find(item => Number(item.id) === Number(listaId));

    if (!lista) return;

    listaEditor = {
        id: Number(lista.id),
        productos: Array.isArray(lista.productos)
            ? lista.productos.map(producto => ({ ...producto }))
            : []
    };

    if (formCrearLista) formCrearLista.classList.remove("oculto");
    if (btnMostrarCrearLista) btnMostrarCrearLista.classList.add("oculto");
    if (nuevaListaNombre) nuevaListaNombre.value = lista.nombre || "";
    if (listaBuilderTitulo) listaBuilderTitulo.textContent = "Editar lista";
    if (btnGuardarLista) btnGuardarLista.textContent = "Guardar cambios";

    poblarSelectProductosLista();
    renderizarProductosTemporales();
    formCrearLista?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cerrarFormularioLista() {
    listaEditor = {
        id: null,
        productos: []
    };

    if (formCrearLista) {
        formCrearLista.reset();
        formCrearLista.classList.add("oculto");
    }

    if (btnMostrarCrearLista) btnMostrarCrearLista.classList.remove("oculto");
    if (listaBuilderTitulo) listaBuilderTitulo.textContent = "Crear nueva lista";
    if (btnGuardarLista) btnGuardarLista.textContent = "Guardar lista";
    renderizarProductosTemporales();
}

function poblarSelectProductosLista() {
    if (!listaProductoSelect) return;

    listaProductoSelect.innerHTML = `
        <option value="">Seleccionar producto...</option>
        ${productosTienda.map(producto => `
            <option value="${Number(producto.id_producto)}">
                ${escapeHTML(producto.nombre)} - ${formatoCOP.format(Number(producto.precio_venta || 0))}
            </option>
        `).join("")}
    `;

    if (listaProductoCantidad) {
        listaProductoCantidad.value = 1;
    }
}

function agregarProductoTemporalALista() {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    const idProducto = Number(listaProductoSelect ? listaProductoSelect.value : 0);
    const cantidad = Math.max(1, Number(listaProductoCantidad ? listaProductoCantidad.value : 1));

    if (!idProducto) {
        alert("Selecciona un producto para agregar a la lista.");
        return;
    }

    const producto = productosTienda.find(item => Number(item.id_producto) === idProducto);

    if (!producto) {
        alert("No se encontró el producto seleccionado.");
        return;
    }

    const existente = listaEditor.productos.find(item => Number(item.id_producto) === idProducto);

    if (existente) {
        existente.cantidad = Number(existente.cantidad || 1) + cantidad;
    } else {
        listaEditor.productos.push({
            id_producto: producto.id_producto,
            nombre: producto.nombre,
            categoria: producto.categoria,
            precio_venta: producto.precio_venta,
            imagen_url: producto.imagen_url,
            cantidad
        });
    }

    if (listaProductoSelect) listaProductoSelect.value = "";
    if (listaProductoCantidad) listaProductoCantidad.value = 1;

    renderizarProductosTemporales();
}

function renderizarProductosTemporales() {
    if (!listaBuilderProductos) return;

    if (!listaEditor.productos.length) {
        listaBuilderProductos.innerHTML = `
            <div class="lista-producto-vacio">Todavía no seleccionaste productos.</div>
        `;
        return;
    }

    listaBuilderProductos.innerHTML = listaEditor.productos.map(producto => `
        <div class="lista-producto-item">
            <img src="${escapeHTML(producto.imagen_url || "img/default.jpg")}" alt="${escapeHTML(producto.nombre || "Producto")}">
            <div>
                <h4>${escapeHTML(producto.nombre || "Producto")}</h4>
                <p>${escapeHTML(producto.categoria || "Sin categoría")} · Cantidad: ${Number(producto.cantidad || 1)}</p>
            </div>
            <strong>${formatoCOP.format(Number(producto.precio_venta || 0) * Number(producto.cantidad || 1))}</strong>
            <button type="button" class="btn-quitar-producto" data-action="quitar-temporal" data-producto-id="${Number(producto.id_producto)}">
                ×
            </button>
        </div>
    `).join("");
}

function manejarClickProductosTemporales(evento) {
    const boton = evento.target.closest("[data-action='quitar-temporal']");

    if (!boton) return;

    const idProducto = Number(boton.dataset.productoId || 0);
    listaEditor.productos = listaEditor.productos.filter(producto => Number(producto.id_producto) !== idProducto);
    renderizarProductosTemporales();
}

function guardarListaDesdeFormulario(evento) {
    evento.preventDefault();

    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    const nombre = normalizarNombreLista(nuevaListaNombre ? nuevaListaNombre.value : "");

    if (!nombre) {
        alert("Escribe un nombre para la lista.");
        return;
    }

    if (listaEditor.productos.length === 0) {
        alert("Selecciona al menos un producto antes de guardar la lista.");
        return;
    }

    const nombreNormalizado = normalizarTextoLista(nombre);
    const existe = listasUsuario.some(lista => {
        return normalizarTextoLista(lista.nombre) === nombreNormalizado &&
            Number(lista.id) !== Number(listaEditor.id || 0);
    });

    if (existe) {
        alert("Ya tienes una lista con ese nombre.");
        return;
    }

    if (listaEditor.id) {
        const lista = listasUsuario.find(item => Number(item.id) === Number(listaEditor.id));

        if (!lista) return;

        lista.nombre = nombre;
        lista.productos = listaEditor.productos.map(producto => ({ ...producto }));
        lista.fecha_actualizacion = new Date().toISOString();
        alert("Lista actualizada correctamente.");
    } else {
        listasUsuario.push({
            id: Date.now(),
            nombre,
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString(),
            productos: listaEditor.productos.map(producto => ({ ...producto }))
        });
        alert("Lista guardada correctamente. Ahora puedes editarla o comprarla.");
    }

    guardarListasUsuario();
    cerrarFormularioLista();
    renderizarListasUsuario();
}

function renderizarListasUsuario() {
    if (!listasPersonalizadas || !listasPersonalizadasVacio) return;

    listasPersonalizadas.innerHTML = "";

    if (!usuarioRegistrado) {
        listasPersonalizadasVacio.classList.remove("oculto");
        listasPersonalizadasVacio.innerHTML = `
            <div class="vacio-icono">👤</div>
            <h2>Inicia sesión para crear listas</h2>
            <p>Cuando inicies sesión podrás crear listas de productos para comprar más rápido.</p>
            <button type="button" class="btn btn-verde" onclick="abrirModalSesion()">Iniciar sesión</button>
        `;
        cerrarFormularioLista();
        return;
    }

    if (listasUsuario.length === 0) {
        listasPersonalizadasVacio.classList.remove("oculto");
        listasPersonalizadasVacio.innerHTML = `
            <div class="vacio-icono">📋</div>
            <h2>Aún no tienes listas creadas</h2>
            <p>Presiona “Crear lista”, escribe un nombre, selecciona productos y guárdala.</p>
        `;
        return;
    }

    const listasParaMostrar = obtenerListasFiltradasPorBusqueda();

    if (listasParaMostrar.length === 0) {
        listasPersonalizadasVacio.classList.remove("oculto");
        listasPersonalizadasVacio.innerHTML = `
            <div class="vacio-icono">⌕</div>
            <h2>No hay listas con ese producto</h2>
            <p>Prueba buscando otro producto que tengas guardado en tus listas.</p>
        `;
        return;
    }

    listasPersonalizadasVacio.classList.add("oculto");

    listasParaMostrar.forEach(lista => {
        const productosLista = Array.isArray(lista.productos) ? lista.productos : [];
        const totalLista = productosLista.reduce((total, producto) => {
            return total + Number(producto.precio_venta || 0) * Number(producto.cantidad || 1);
        }, 0);

        const card = document.createElement("article");
        card.className = "lista-personal-card";
        card.dataset.listaId = String(lista.id);

        card.innerHTML = `
            <div class="lista-personal-header">
                <div>
                    <h3>${escapeHTML(lista.nombre)}</h3>
                    <p>${productosLista.length} producto${productosLista.length === 1 ? "" : "s"} · ${formatoCOP.format(totalLista)}</p>
                </div>

                <div class="lista-personal-actions">
                    <button type="button" class="btn btn-blanco" data-action="editar-lista" data-lista-id="${Number(lista.id)}">
                        Editar
                    </button>

                    ${productosLista.length > 0 ? `
                        <button type="button" class="btn btn-verde" data-action="comprar-lista" data-lista-id="${Number(lista.id)}">
                            Comprar lista
                        </button>
                    ` : `
                        <button type="button" class="btn btn-blanco btn-lista-guardada" disabled>
                            Sin productos
                        </button>
                    `}

                    <button type="button" class="btn btn-blanco btn-danger-soft" data-action="eliminar-lista" data-lista-id="${Number(lista.id)}">
                        Eliminar
                    </button>
                </div>
            </div>

            <div class="productos-lista-personal">
                ${productosLista.length === 0 ? `
                    <div class="lista-producto-vacio">Edita esta lista para agregar productos.</div>
                ` : productosLista.map(producto => `
                    <div class="lista-producto-item">
                        <img src="${escapeHTML(producto.imagen_url || "img/default.jpg")}" alt="${escapeHTML(producto.nombre || "Producto")}">
                        <div>
                            <h4>${escapeHTML(producto.nombre || "Producto")}</h4>
                            <p>${escapeHTML(producto.categoria || "Sin categoría")} · Cantidad: ${Number(producto.cantidad || 1)}</p>
                        </div>
                        <strong>${formatoCOP.format(Number(producto.precio_venta || 0) * Number(producto.cantidad || 1))}</strong>
                    </div>
                `).join("")}
            </div>
        `;

        listasPersonalizadas.appendChild(card);
    });
}

function manejarClickListasUsuario(evento) {
    const boton = evento.target.closest("[data-action]");
    if (!boton) return;

    const action = boton.dataset.action;
    const listaId = Number(boton.dataset.listaId || 0);

    if (action === "editar-lista") {
        iniciarEdicionLista(listaId);
    }

    if (action === "eliminar-lista") {
        eliminarListaUsuario(listaId);
    }

    if (action === "comprar-lista") {
        comprarListaUsuario(listaId);
    }
}

function eliminarListaUsuario(listaId) {
    const lista = listasUsuario.find(item => Number(item.id) === Number(listaId));

    if (!lista) return;

    if (!confirm(`¿Eliminar la lista "${lista.nombre}"?`)) return;

    listasUsuario = listasUsuario.filter(item => Number(item.id) !== Number(listaId));
    guardarListasUsuario();
    renderizarListasUsuario();

    if (Number(listaEditor.id) === Number(listaId)) {
        cerrarFormularioLista();
    }
}

async function comprarListaUsuario(listaId) {
    if (!usuarioRegistrado) {
        abrirModalSesion();
        return;
    }

    const lista = listasUsuario.find(item => Number(item.id) === Number(listaId));

    if (!lista || lista.productos.length === 0) {
        alert("Esta lista no tiene productos para comprar.");
        return;
    }

    try {
        for (const producto of lista.productos) {
            await agregarProductoAlCarrito({
                id_producto: producto.id_producto,
                cantidad: producto.cantidad
            });
        }

        await actualizarContadorCarrito();

        const irCarrito = confirm("Lista agregada al carrito. ¿Quieres ir al carrito ahora?");

        if (irCarrito) {
            window.location.href = "carrito.html";
        }

    } catch (error) {
        alert("No se pudo agregar la lista al carrito: " + error.message);
    }
}

function normalizarNombreLista(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizarTextoLista(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

async function cargarMisListas() {
    if (!historialCompras || !misListasVacio) return;

    if (!usuarioRegistrado) {
        compras = [];
        renderizarResumen();
        historialCompras.innerHTML = "";
        misListasVacio.classList.remove("oculto");

        misListasVacio.innerHTML = `
            <div class="vacio-icono">👤</div>
            <h2>Inicia sesión para ver tus compras</h2>
            <p>Cuando inicies sesión podrás consultar tu historial de compras.</p>
            <button type="button" class="btn btn-verde" onclick="abrirModalSesion()">Iniciar sesión</button>
        `;
        return;
    }

    try {
        historialCompras.innerHTML = `
            <div class="listas-vacio">
                <div class="vacio-icono">⌛</div>
                <h2>Cargando compras...</h2>
                <p>Estamos consultando tu historial.</p>
            </div>
        `;

        misListasVacio.classList.add("oculto");

        const respuesta = await fetch(MIS_LISTAS_API_URL, {
            credentials: "include",
            cache: "no-store"
        });

        const texto = await respuesta.text();

        let datos;

        try {
            datos = JSON.parse(texto);
        } catch (error) {
            console.error("Respuesta cruda de mis_listas.php:", texto);
            throw new Error("mis_listas.php no devolvió JSON válido.");
        }

        if (!respuesta.ok || datos.ok === false) {
            throw new Error(datos.mensaje || "No se pudo cargar Mis Listas.");
        }

        compras = Array.isArray(datos.compras) ? datos.compras : [];

        renderizarResumen();
        renderizarCompras();

    } catch (error) {
        console.error("Error cargando Mis Listas:", error);

        historialCompras.innerHTML = "";
        misListasVacio.classList.remove("oculto");

        misListasVacio.innerHTML = `
            <div class="vacio-icono">!</div>
            <h2>No se pudieron cargar tus compras</h2>
            <p>${escapeHTML(error.message)}</p>
            <button type="button" class="btn btn-verde" onclick="cargarMisListas()">Intentar de nuevo</button>
        `;
    }
}

function renderizarResumen() {
    const cantidadCompras = compras.length;

    const cantidadProductos = compras.reduce((total, compra) => {
        const productos = Array.isArray(compra.productos) ? compra.productos : [];

        return total + productos.reduce((sum, producto) => {
            return sum + Number(producto.cantidad || 0);
        }, 0);
    }, 0);

    const gastado = compras.reduce((total, compra) => {
        return total + Number(compra.pago_total || 0);
    }, 0);

    if (totalCompras) totalCompras.textContent = cantidadCompras;
    if (totalProductos) totalProductos.textContent = cantidadProductos;
    if (totalGastado) totalGastado.textContent = formatoCOP.format(gastado);
}

function renderizarCompras() {
    historialCompras.innerHTML = "";

    if (compras.length === 0) {
        misListasVacio.classList.remove("oculto");
        misListasVacio.innerHTML = `
            <div class="vacio-icono">♥</div>
            <h2>Aún no tienes compras registradas</h2>
            <p>Cuando finalices una compra, aparecerá aquí automáticamente.</p>
            <a href="index.html" class="btn btn-verde">Ir a comprar</a>
        `;
        return;
    }

    misListasVacio.classList.add("oculto");

    compras.forEach(compra => {
        const card = document.createElement("article");
        card.className = "compra-card";

        const productos = Array.isArray(compra.productos) ? compra.productos : [];

        card.innerHTML = `
            <div class="compra-header">
                <div>
                    <h3>Pedido #${String(compra.id_venta).padStart(4, "0")}</h3>
                    <p>${formatFecha(compra.fecha_venta)}</p>
                </div>

                <div class="compra-total">
                    <strong>${formatoCOP.format(Number(compra.pago_total || 0))}</strong>
                    <span class="estado-pill estado-${escapeHTML(compra.estado || "pendiente")}">
                        ${escapeHTML(getEstadoLabel(compra.estado))}
                    </span>
                </div>
            </div>

            <div class="compra-body">
                <div class="compra-info">
                    <div>
                        <strong>Dirección:</strong>
                        <span>${escapeHTML(compra.direccion_entrega || "Sin dirección")}</span>
                    </div>

                    <div>
                        <strong>Productos:</strong>
                        <span>${productos.length} referencia(s)</span>
                    </div>
                </div>

                <div class="productos-comprados">
                    ${productos.map(producto => `
                        <div class="producto-comprado">
                            <img 
                                src="${escapeHTML(producto.imagen || "img/default.jpg")}" 
                                alt="${escapeHTML(producto.nombre || "Producto")}"
                            >

                            <div>
                                <h4>${escapeHTML(producto.nombre || "Producto")}</h4>
                                <p>Cantidad: ${Number(producto.cantidad || 0)}</p>
                            </div>

                            <div class="producto-precio">
                                ${formatoCOP.format(Number(producto.subtotal || 0))}
                            </div>
                        </div>
                    `).join("")}
                </div>

                <div class="compra-actions">
                    <button type="button" class="btn btn-verde" onclick="comprarDeNuevo(${Number(compra.id_venta)})">
                        Comprar de nuevo
                    </button>
                </div>
            </div>
        `;

        historialCompras.appendChild(card);
    });
}

async function comprarDeNuevo(idVenta) {
    if (!usuarioRegistrado) {
        alert("Debes iniciar sesión para agregar productos al carrito.");
        return;
    }

    const compra = compras.find(item => Number(item.id_venta) === Number(idVenta));

    if (!compra) return;

    const productos = Array.isArray(compra.productos) ? compra.productos : [];

    if (productos.length === 0) {
        alert("Este pedido no tiene productos para agregar.");
        return;
    }

    try {
        for (const producto of productos) {
            await agregarProductoAlCarrito(producto);
        }

        await actualizarContadorCarrito();

        const irCarrito = confirm("Productos agregados al carrito. ¿Quieres ir al carrito ahora?");

        if (irCarrito) {
            window.location.href = "carrito.html";
        }

    } catch (error) {
        alert("No se pudo agregar el pedido al carrito: " + error.message);
    }
}

async function agregarProductoAlCarrito(producto) {
    const idProducto = Number(producto.id_producto || 0);
    const cantidad = Number(producto.cantidad || 1);

    if (!idProducto || cantidad <= 0) {
        return;
    }

    const respuesta = await fetch(CART_API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            accion: "agregar",
            id_producto: idProducto,
            cantidad: cantidad
        })
    });

    const texto = await respuesta.text();
    let datos;

    try {
        datos = JSON.parse(texto);
    } catch (error) {
        console.error("Respuesta cruda de carrito.php:", texto);
        throw new Error("carrito.php no devolvió JSON válido.");
    }

    if (!respuesta.ok || datos.ok === false) {
        throw new Error(datos.mensaje || "No se pudo agregar el producto al carrito.");
    }
}

function getEstadoLabel(estado) {
    const labels = {
        pendiente: "Pendiente",
        en_camino: "En camino",
        entregado: "Entregado",
        cancelado: "Cancelado"
    };

    return labels[estado] || "Pendiente";
}

function formatFecha(value) {
    if (!value) return "Fecha no disponible";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}