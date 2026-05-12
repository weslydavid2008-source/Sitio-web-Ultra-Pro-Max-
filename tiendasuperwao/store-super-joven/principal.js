const STORE_PRODUCTS_API_URL = "../api/tienda_productos.php";
const STORE_CATEGORIES_API_URL = "../api/categorias.php";
const AUTH_API_URL = "../api/auth.php";
const REGISTER_OPTIONS_API_URL = "../api/registro_opciones.php";
const CART_API_URL = "../api/carrito.php";
const PASSWORD_RESET_API_URL = "../api/password_reset.php";
const EMAIL_VERIFICATION_API_URL = "../api/email_verification.php?v=otp_unico_final";

let currentUser = null;

let registerOptions = {
  generos: [],
  barrios: []
};

let products = [];
let visibleProducts = [];
let storeCategories = [];
let selectedCategoryId = null;
let resetPasswordState = { correo: "", codigo: "" };
let registerStep = 1;
let registerState = { correo: "", codigo: "" };
let featuredCarouselProducts = [];
let heroCarouselIndex = 0;
let heroCarouselTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();

  await loadRegisterOptions();
  await checkSession();
  await actualizarContadorCarrito();
  await loadStoreCategoriesFromDatabase();
  await loadProductsFromDatabase();

  setupHeroCarouselEvents();
});

function setupEvents() {
  setupSearchEvents();
  setupAuthEvents();
  setupPasswordResetEvents();
  setupCategoryEvents();
  setupProductSectionEvents();
  setupProductDetailEvents();
}

/* =========================
   BUSCADOR
   ========================= */

function setupSearchEvents() {
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);

    searchInput.addEventListener("focus", () => {
      renderSearchSuggestions(searchInput.value.trim());
    });

    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
        hideSearchSuggestions();
        scrollToSection("categoryBrowserSection");
      }

      if (event.key === "Escape") {
        hideSearchSuggestions();
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      handleSearch();
      hideSearchSuggestions();
      scrollToSection("categoryBrowserSection");
    });
  }

  document.addEventListener("click", event => {
    const searchBox = document.querySelector(".store-search");

    if (searchBox && !searchBox.contains(event.target)) {
      hideSearchSuggestions();
    }
  });
}

function renderSearchSuggestions(searchValue) {
  const panel = document.getElementById("searchResultsPanel");

  if (!panel) return;

  const search = normalizeText(searchValue);

  if (!search) {
    hideSearchSuggestions();
    return;
  }

  const results = products
    .filter(product => productMatchesText(product, search))
    .slice(0, 8);

  if (results.length === 0) {
    panel.innerHTML = `
      <div class="search-result-empty">
        No se encontraron productos.
      </div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  panel.innerHTML = results.map(product => `
    <button
      type="button"
      class="search-result-item"
      onclick="selectSearchProduct(${Number(product.id_producto)})"
    >
      <img
        src="${escapeHTML(product.imagen_url || "img/default.jpg" )}"
        alt="${escapeHTML(product.nombre || "Producto") }"
      >

      <span class="search-result-info">
        <strong>${escapeHTML(product.nombre || "Producto")}</strong>
        <small>${escapeHTML(product.categoria || "Sin categoría")}</small>
      </span>

      <span class="search-result-price">
        ${formatMoney(product.precio_venta)}
      </span>
    </button>
  `).join("");

  panel.classList.remove("hidden");
}

function hideSearchSuggestions() {
  const panel = document.getElementById("searchResultsPanel");

  if (panel) {
    panel.classList.add("hidden");
  }
}

function selectSearchProduct(idProducto) {
  const product = products.find(item => Number(item.id_producto) === Number(idProducto));

  if (!product) return;

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.value = product.nombre || "";
  }

  visibleProducts = [product];
  selectedCategoryId = null;
  renderCategoryChips(null);
  setCategoryBrowserTitle("Resultado de búsqueda");
  renderProducts(visibleProducts, "categoryProductsGrid");
  hideSearchSuggestions();
  scrollToSection("categoryBrowserSection");
}

function handleSearch() {
  const searchInput = document.getElementById("searchInput");
  const rawSearch = searchInput ? searchInput.value.trim() : "";
  const search = normalizeText(rawSearch);

  if (!search) {
    visibleProducts = [...products];
    selectedCategoryId = "__all__";
    renderCategoryChips(selectedCategoryId);
    setCategoryBrowserTitle("Todos los productos");
    renderProducts(visibleProducts, "categoryProductsGrid", "No hay productos disponibles.");
    hideSearchSuggestions();
    return;
  }

  visibleProducts = products.filter(product => productMatchesText(product, search));
  selectedCategoryId = null;
  renderCategoryChips(null);
  setCategoryBrowserTitle("Resultado de búsqueda");
  renderProducts(visibleProducts, "categoryProductsGrid", "No se encontraron productos.");
  renderSearchSuggestions(rawSearch);
}

function productMatchesText(product, search) {
  const name = normalizeText(product.nombre);
  const category = normalizeText(product.categoria);
  const description = normalizeText(product.descripcion);

  return (
    name.includes(search) ||
    category.includes(search) ||
    description.includes(search)
  );
}


function aplicarBusquedaPendienteDesdeOtraPagina() {
  const pendingSearch = localStorage.getItem("pendingStoreSearch");

  if (!pendingSearch) return;

  localStorage.removeItem("pendingStoreSearch");

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.value = pendingSearch;
  }

  handleSearch();
  hideSearchSuggestions();

  setTimeout(() => {
    scrollToSection("categoryBrowserSection");
  }, 120);
}


/* =========================
   CATEGORÍAS
   ========================= */

function setupCategoryEvents() {
  const categoriesGrid = document.getElementById("categoriesGrid");
  const categoryChips = document.getElementById("categoryChips");
  const backToTopFromCategories = document.getElementById("backToTopFromCategories");
  const backToTopFloating = document.getElementById("backToTopFloating");

  if (categoriesGrid) {
    categoriesGrid.addEventListener("click", event => {
      const card = event.target.closest(".category-card");

      if (!card) return;

      openCategoryBrowser({
        id_categoria: card.dataset.categoryId,
        nombre: card.dataset.categoryName
      });
    });
  }

  if (categoryChips) {
    categoryChips.addEventListener("click", event => {
      const chip = event.target.closest(".category-chip");

      if (!chip) return;

      openCategoryBrowser({
        id_categoria: chip.dataset.categoryId,
        nombre: chip.dataset.categoryName
      }, false);
    });
  }

  if (backToTopFromCategories) {
    backToTopFromCategories.addEventListener("click", scrollToTop);
  }

  if (backToTopFloating) {
    backToTopFloating.addEventListener("click", scrollToTop);

    window.addEventListener("scroll", () => {
      backToTopFloating.classList.toggle("hidden", window.scrollY < 550);
    });
  }
}

async function loadStoreCategoriesFromDatabase() {
  try {
    const response = await fetch(STORE_CATEGORIES_API_URL, {
      credentials: "include",
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error("No se pudieron cargar las categorías.");
    }

    storeCategories = data.map(category => ({
      id_categoria: String(category.id_categoria || ""),
      nombre: category.nombre || "Sin categoría",
      descripcion: category.descripcion || "Productos disponibles en esta categoría."
    }));
  } catch (error) {
    console.error("Error cargando categorías:", error);
    storeCategories = [];
  }
}

function buildCategoriesFromProducts() {
  const byName = new Map();

  products.forEach(product => {
    const name = product.categoria || "Sin categoría";
    const key = normalizeText(name);

    if (!byName.has(key)) {
      byName.set(key, {
        id_categoria: String(product.id_categoria || key),
        nombre: name,
        descripcion: "Productos disponibles en esta categoría."
      });
    }
  });

  storeCategories = Array.from(byName.values()).sort((a, b) => {
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

function renderStoreCategories() {
  const grid = document.getElementById("categoriesGrid");

  if (!grid) return;

  if (storeCategories.length === 0) {
    grid.innerHTML = `
      <div class="empty-products">
        No hay categorías disponibles.
      </div>
    `;
    return;
  }

  grid.innerHTML = storeCategories.map(category => {
    const categoryProducts = getProductsByCategory(category);
    const count = categoryProducts.length;
    const randomImage = getRandomCategoryImage(categoryProducts);

    return `
      <article
        class="category-card dynamic-category-card"
        data-category-id="${escapeHTML(category.id_categoria)}"
        data-category-name="${escapeHTML(category.nombre)}"
      >
        <div class="category-icon category-image-icon">
          <img 
            src="${escapeHTML(randomImage)}" 
            alt="${escapeHTML(category.nombre)}"
            loading="lazy"
          >
        </div>

        <h3>${escapeHTML(category.nombre)}</h3>
        <p>${count} producto${count === 1 ? "" : "s"}</p>
        <button type="button" class="green-small-btn">Ver productos</button>
      </article>
    `;
  }).join("");
}
function getRandomCategoryImage(categoryProducts) {
  const productsWithImage = categoryProducts.filter(product => {
    return product.imagen_url && String(product.imagen_url).trim() !== "";
  });

  if (productsWithImage.length === 0) {
    return "img/default.jpg";
  }

  const randomIndex = Math.floor(Math.random() * productsWithImage.length);
  return productsWithImage[randomIndex].imagen_url;
}

function setCategoryBrowserTitle(title) {
  const titleElement = document.getElementById("categoryBrowserTitle");

  if (titleElement) {
    titleElement.textContent = title;
  }
}

function openCategoryBrowser(categoryData, shouldScroll = true) {
  const section = document.getElementById("categoryBrowserSection");
  const title = document.getElementById("categoryBrowserTitle");

  if (section) {
    section.classList.remove("hidden");
  }

  if (String(categoryData?.id_categoria || "") === "__all__") {
    selectedCategoryId = "__all__";

    if (title) {
      title.textContent = "Todos los productos";
    }

    renderCategoryChips(selectedCategoryId);
    renderProducts(products, "categoryProductsGrid", "No hay productos disponibles.");

    if (shouldScroll) {
      scrollToSection("categoryBrowserSection");
    }

    return;
  }

  const category = resolveCategory(categoryData);

  if (!category) return;

  selectedCategoryId = String(category.id_categoria || "");

  if (title) {
    title.textContent = category.nombre;
  }

  renderCategoryChips(selectedCategoryId);
  renderProducts(getProductsByCategory(category), "categoryProductsGrid");

  if (shouldScroll) {
    scrollToSection("categoryBrowserSection");
  }
}

function resolveCategory(categoryData) {
  if (!categoryData) return null;

  const id = String(categoryData.id_categoria || "");
  const name = String(categoryData.nombre || "");
  const normalizedName = normalizeText(name);

  return storeCategories.find(category => String(category.id_categoria) === id) ||
    storeCategories.find(category => normalizeText(category.nombre) === normalizedName) ||
    null;
}

function renderCategoryChips(activeCategoryId = "__all__") {
  const chipRow = document.getElementById("categoryChips");

  if (!chipRow) return;

  const allChip = `
    <button
      type="button"
      class="category-chip ${String(activeCategoryId) === "__all__" ? "active" : ""}"
      data-category-id="__all__"
      data-category-name="Todos"
    >
      🛒 Todos
    </button>
  `;

  const categoryChips = storeCategories.map(category => {
    const isActive = String(category.id_categoria) === String(activeCategoryId);

    return `
      <button
        type="button"
        class="category-chip ${isActive ? "active" : ""}"
        data-category-id="${escapeHTML(category.id_categoria)}"
        data-category-name="${escapeHTML(category.nombre)}"
      >
        ${getCategoryIcon(category.nombre)} ${escapeHTML(category.nombre)}
      </button>
    `;
  }).join("");

  chipRow.innerHTML = allChip + categoryChips;
}

function getProductsByCategory(category) {
  const id = String(category.id_categoria || "");
  const name = normalizeText(category.nombre || "");

  return products.filter(product => {
    const productCategoryId = String(product.id_categoria || "");
    const productCategoryName = normalizeText(product.categoria || "");

    return productCategoryId === id || productCategoryName === name;
  });
}

function getCategoryIcon(categoryName) {
  const category = normalizeText(categoryName);

  if (category.includes("carne") || category.includes("huevo")) return "🥩";
  if (category.includes("lacteo") || category.includes("queso")) return "🥛";
  if (category.includes("fruta")) return "🍎";
  if (category.includes("verdura")) return "🥦";
  if (category.includes("aseo") || category.includes("limpieza")) return "🧴";
  if (category.includes("bebida")) return "🥤";
  if (category.includes("comida") || category.includes("despensa")) return "🛒";
  if (category.includes("licor")) return "🍾";

  return "▣";
}

// Mantiene compatibilidad si algún botón antiguo todavía llama esta función.
function filterByCategory(categoryKey) {
  const normalizedKey = normalizeText(categoryKey);

  if (normalizedKey === "todos" || normalizedKey === "todo") {
    openCategoryBrowser({ id_categoria: "__all__", nombre: "Todos" });
    return;
  }

  const category = storeCategories.find(item => normalizeText(item.nombre).includes(normalizedKey));

  if (category) {
    openCategoryBrowser(category);
  }
}

/* =========================
   PRODUCTOS
   ========================= */

function setupProductSectionEvents() {
  const showOffersProductsBtn = document.getElementById("showOffersProducts");
  const goOffersBtn = document.getElementById("goOffersBtn");

  if (showOffersProductsBtn) {
    showOffersProductsBtn.addEventListener("click", () => {
      renderOffersProducts();
      scrollToSection("offersProductsSection");
    });
  }

  if (goOffersBtn) {
    goOffersBtn.addEventListener("click", () => {
      renderOffersProducts();
      scrollToSection("offersProductsSection");
    });
  }
}

async function loadProductsFromDatabase() {
  try {
    const response = await fetch(STORE_PRODUCTS_API_URL, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error("No se pudieron cargar los productos.");
    }

    products = data;
    visibleProducts = [...products];

    if (storeCategories.length === 0) {
      buildCategoriesFromProducts();
    }

    renderStoreCategories();
    selectedCategoryId = "__all__";
    renderCategoryChips(selectedCategoryId);
    renderProducts(products, "categoryProductsGrid", "No hay productos disponibles.");
    renderFeaturedProducts();
    renderHeroCarousel();
    renderOffersProducts();
    aplicarBusquedaPendienteDesdeOtraPagina();
  } catch (error) {
    console.error("Error cargando productos:", error);
    showProductsMessage("categoriesGrid", "No se pudieron cargar las categorías.");
    showProductsMessage("featuredProductsGrid", "No se pudieron cargar los productos destacados.");
    showProductsMessage("offersProductsGrid", "No se pudieron cargar las ofertas.");
    showProductsMessage("categoryProductsGrid", "No se pudieron cargar los productos.");
  }
}

function renderFeaturedProducts() {
  const featuredProducts = products.filter(product => Number(product.destacado) === 1);
  renderProducts(featuredProducts, "featuredProductsGrid", "No hay productos destacados disponibles.");
}

function renderOffersProducts() {
  const offerProducts = products.filter(product => Number(product.en_oferta) === 1);
  renderProducts(offerProducts, "offersProductsGrid", "No hay ofertas activas disponibles.");
}

function renderProducts(productList, gridId = "productsGrid", emptyMessage = "No se encontraron productos.") {
  const grid = document.getElementById(gridId);

  if (!grid) return;

  if (!productList.length) {
    showProductsMessage(gridId, emptyMessage);
    return;
  }

  grid.innerHTML = productList.map(product => createProductCard(product)).join("");
}

function createProductCard(product) {
  const id = Number(product.id_producto);
  const nombre = escapeHTML(product.nombre || "Producto sin nombre");
  const categoria = escapeHTML(product.categoria || "Sin categoría");
  const precio = formatMoney(product.precio_venta);
  const imagen = escapeHTML(product.imagen_url || "img/default.jpg");
  const badge = getProductBadge(product);
  const priceBlock = getProductPriceBlock(product, precio);

  return `
    <article class="product-card">
      ${badge}

      <div class="product-card-main">
        <div class="product-image-box">
          <img
            src="${imagen}"
            alt="${nombre}"
            loading="lazy"
          >
        </div>

        <h3>${nombre}</h3>
        <p class="product-category">${categoria}</p>
        ${priceBlock}
      </div>

      <div class="product-actions">
        <button class="orange-btn" onclick="addToCart(${id})">
          Añadir
        </button>

        <button class="orange-btn" onclick="openProductDetail(${id})">
          Detalles
        </button>

      </div>
    </article>
  `;
}

function getProductPriceBlock(product, currentPrice) {
  const isOffer = Number(product.en_oferta) === 1;
  const originalPrice = Number(product.precio_original || 0);
  const finalPrice = Number(product.precio_venta || 0);

  if (isOffer && originalPrice > finalPrice) {
    return `
      <div class="product-price-wrap">
        <span class="product-old-price">${formatMoney(originalPrice)}</span>
        <p class="product-price">${currentPrice}</p>
      </div>
    `;
  }

  return `<p class="product-price">${currentPrice}</p>`;
}

function getProductBadge(product) {
  if (Number(product.en_oferta) === 1) {
    const discount = Number(product.descuento_porcentaje || 0);
    const label = discount > 0 ? `-${discount}%` : "OFERTA";
    return `<span class="product-badge">${label}</span>`;
  }

  if (Number(product.destacado) === 1) {
    return `<span class="product-badge fresh">DESTACADO</span>`;
  }

  return "";
}

function showProductsMessage(gridId, message) {
  const grid = document.getElementById(gridId);

  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-products">
      ${message}
    </div>
  `;
}

async function addToCart(id) {
  if (!currentUser) {
    alert("Debes iniciar sesión para agregar productos al carrito.");
    openLoginModal();
    return;
  }

  const product = products.find(item => Number(item.id_producto) === Number(id));

  if (!product) {
    alert("No se encontró el producto.");
    return;
  }

  try {
    const response = await fetch(CART_API_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accion: "agregar",
        id_producto: Number(id),
        cantidad: 1
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo agregar el producto al carrito.");
    }

    actualizarContadorDesdeRespuesta(data);
    alert("Producto agregado al carrito.");

  } catch (error) {
    alert(error.message);
  }
}

async function actualizarContadorCarrito() {
  const cartCountElement = document.getElementById("cartCount");

  if (!cartCountElement) return;

  if (!currentUser) {
    cartCountElement.textContent = "0";
    return;
  }

  try {
    const response = await fetch(`${CART_API_URL}?accion=contador`, {
      credentials: "include",
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || data.ok === false || data.logueado === false) {
      cartCountElement.textContent = "0";
      return;
    }

    actualizarContadorDesdeRespuesta(data);

  } catch (error) {
    console.error("Error cargando contador del carrito:", error);
    cartCountElement.textContent = "0";
  }
}

function actualizarContadorDesdeRespuesta(data) {
  const cartCountElement = document.getElementById("cartCount");

  if (!cartCountElement) return;

  if (typeof data.total_cantidad !== "undefined") {
    cartCountElement.textContent = Number(data.total_cantidad || 0);
    return;
  }

  const carrito = Array.isArray(data.carrito) ? data.carrito : [];
  const cantidadTotal = carrito.reduce((total, producto) => {
    return total + Number(producto.cantidad || 1);
  }, 0);

  cartCountElement.textContent = cantidadTotal;
}

function setupProductDetailEvents() {
  const closeProductDetailBtn = document.getElementById("closeProductDetail");

  if (closeProductDetailBtn) {
    closeProductDetailBtn.addEventListener("click", closeProductDetail);
  }

  const productDetailModal = document.getElementById("productDetailModal");

  if (productDetailModal) {
    productDetailModal.addEventListener("click", event => {
      if (event.target.id === "productDetailModal") {
        closeProductDetail();
      }
    });
  }
}

function openProductDetail(id) {
  const product = products.find(item => Number(item.id_producto) === Number(id));

  if (!product) return;

  const container = document.getElementById("productDetailContent");

  if (!container) return;

  container.innerHTML = `
    <img
      src="${escapeHTML(product.imagen_url || "img/default.jpg") }"
      alt="${escapeHTML(product.nombre || "Producto") }"
    >

    <h2>${escapeHTML(product.nombre || "Producto sin nombre")}</h2>

    <p>${escapeHTML(product.descripcion || "Producto disponible en nuestra tienda.")}</p>

    <p>
      <strong>${formatMoney(product.precio_venta)}</strong>
    </p>

    <p>
      Categoría: ${escapeHTML(product.categoria || "Sin categoría")}
    </p>

    <p>
      Stock disponible: ${Number(product.inventario || 0)}
    </p>

    <div class="modal-actions">
      <button class="secondary-btn" onclick="closeProductDetail()">
        Cerrar
      </button>

      <button class="green-btn" onclick="addToCart(${Number(product.id_producto)})">
        Añadir al carrito
      </button>
    </div>
  `;

  const modal = document.getElementById("productDetailModal");

  if (modal) {
    modal.classList.add("show");
  }
}

function closeProductDetail() {
  const modal = document.getElementById("productDetailModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

/* =========================
   AUTENTICACIÓN
   ========================= */

function setupAuthEvents() {
  const openLoginModalBtn = document.getElementById("openLoginModal");

  if (openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", event => {
      event.stopPropagation();
      openLoginModal();
    });
  }

  const closeLoginModalBtn = document.getElementById("closeLoginModal");
  const cancelLoginBtn = document.getElementById("cancelLogin");

  if (closeLoginModalBtn) {
    closeLoginModalBtn.addEventListener("click", closeLoginModal);
  }

  if (cancelLoginBtn) {
    cancelLoginBtn.addEventListener("click", closeLoginModal);
  }

  const loginModal = document.getElementById("loginModal");

  if (loginModal) {
    loginModal.addEventListener("click", event => {
      if (event.target.id === "loginModal") {
        closeLoginModal();
      }
    });
  }

  const showRegisterFormBtn = document.getElementById("showRegisterForm");
  const backToLoginBtn = document.getElementById("backToLogin");

  if (showRegisterFormBtn) {
    showRegisterFormBtn.addEventListener("click", showRegisterForm);
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", showLoginForm);
  }

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      await loginUser();
    });
  }

  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async event => {
      event.preventDefault();
      await handleRegisterStep();
    });
  }

  document.getElementById("backToRegisterStep1")?.addEventListener("click", () => setRegisterStep(1));
  document.getElementById("backToRegisterStep2")?.addEventListener("click", () => setRegisterStep(2));
  document.getElementById("backToRegisterStep3")?.addEventListener("click", () => setRegisterStep(3));

  document.getElementById("continueRegisterStep1")?.addEventListener("click", async () => {
    await handleRegisterStep(1);
  });

  document.getElementById("continueRegisterStep2")?.addEventListener("click", async () => {
    await handleRegisterStep(2);
  });

  document.getElementById("continueRegisterStep3")?.addEventListener("click", async () => {
    await handleRegisterStep(3);
  });

  document.getElementById("continueRegisterStep4")?.addEventListener("click", async () => {
    await handleRegisterStep(4);
  });

  const accountMenu = document.getElementById("accountMenu");
  const viewProfileBtn = document.getElementById("viewProfileBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (viewProfileBtn) {
    viewProfileBtn.addEventListener("click", () => {
      openProfileModal(false);
    });
  }

  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
      openProfileModal(true);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
  }

  document.addEventListener("click", event => {
    const accountBox = document.querySelector(".account-box");

    if (accountMenu && accountBox && !accountBox.contains(event.target)) {
      accountMenu.classList.add("hidden");
    }
  });

  const closeProfileModalBtn = document.getElementById("closeProfileModal");
  const cancelProfileModalBtn = document.getElementById("cancelProfileModal");
  const profileForm = document.getElementById("profileForm");
  const profileModal = document.getElementById("profileModal");

  if (closeProfileModalBtn) {
    closeProfileModalBtn.addEventListener("click", closeProfileModal);
  }

  if (cancelProfileModalBtn) {
    cancelProfileModalBtn.addEventListener("click", closeProfileModal);
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveProfileChanges();
    });
  }

  if (profileModal) {
    profileModal.addEventListener("click", event => {
      if (event.target.id === "profileModal") {
        closeProfileModal();
      }
    });
  }
}

async function loadRegisterOptions() {
  try {
    const response = await fetch(REGISTER_OPTIONS_API_URL, {
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudieron cargar opciones.");
    }

    registerOptions.generos = data.generos || [];
    registerOptions.barrios = data.barrios || [];

    fillRegisterOptions();
    fillProfileOptions();
  } catch (error) {
    console.error("Error cargando opciones de registro:", error);
  }
}

function fillRegisterOptions() {
  fillSelect("registerGender", registerOptions.generos, "id_genero", "genero", "Sin género");
  fillSelect("registerNeighborhood", registerOptions.barrios, "id_barrio", "nombre", "Sin barrio");
}

function fillProfileOptions() {
  fillSelect("profileGender", registerOptions.generos, "id_genero", "genero", "Sin género");
  fillSelect("profileNeighborhood", registerOptions.barrios, "id_barrio", "nombre", "Sin barrio");
}

function fillSelect(selectId, items, valueKey, textKey, defaultText) {
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

async function checkSession() {
  try {
    const response = await fetch(`${AUTH_API_URL}?accion=me`, {
      credentials: "include"
    });

    const data = await response.json();

    currentUser = data.ok && data.logueado ? data.usuario : null;
    updateHeaderAuthState();
  } catch (error) {
    console.error("Error revisando sesión:", error);
    currentUser = null;
    localStorage.removeItem("carrito");
    updateHeaderAuthState();
    await actualizarContadorCarrito();
  }
}

function openLoginModal() {
  if (currentUser) {
    toggleAccountMenu();
    return;
  }

  showLoginForm();

  const modal = document.getElementById("loginModal");

  if (modal) {
    modal.classList.add("show");
  }
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");

  if (modal) {
    modal.classList.remove("show");
  }

  resetAllAuthForms();
}

function resetAllAuthForms() {
  const formIds = [
    "loginForm",
    "registerForm",
    "resetRequestForm",
    "resetCodeForm",
    "resetPasswordForm"
  ];

  formIds.forEach(id => {
    const form = document.getElementById(id);

    if (form) {
      form.reset();
    }
  });

  resetPasswordState = { correo: "", codigo: "" };
  registerState = { correo: "", codigo: "" };
  registerStep = 1;
  clearRegisterMessages();
  clearResetMessages();
  showLoginForm();
}

function showRegisterForm() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  hidePasswordResetForms();
  clearResetMessages();

  if (loginForm) loginForm.classList.add("hidden");
  if (registerForm) registerForm.classList.remove("hidden");

  setRegisterStep(1);
}

function showLoginForm() {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  hidePasswordResetForms();
  clearResetMessages();

  if (registerForm) registerForm.classList.add("hidden");
  if (loginForm) loginForm.classList.remove("hidden");
}

function updateHeaderAuthState() {
  const loginButton = document.getElementById("openLoginModal");
  const adminPanelLink = document.getElementById("adminPanelLink");
  const accountMenu = document.getElementById("accountMenu");
  const accountBox = document.querySelector(".account-box");

  if (!loginButton) return;

  if (!currentUser) {
    loginButton.textContent = "👤 Iniciar Sesión";
    loginButton.title = "Iniciar sesión";
    loginButton.setAttribute("aria-label", "Iniciar sesión");

    if (accountBox) {
      accountBox.classList.remove("is-logged");
    }

    if (adminPanelLink) {
      adminPanelLink.classList.add("hidden");
    }

    if (accountMenu) {
      accountMenu.classList.add("hidden");
    }

    return;
  }

  if (accountBox) {
    accountBox.classList.add("is-logged");
  }

  const nombreUsuario = (
    currentUser.nombre_completo ||
    `${currentUser.nombre || ""} ${currentUser.apellido || ""}` ||
    currentUser.correo ||
    "Mi cuenta"
  ).trim();

  loginButton.textContent = `👤 ${nombreUsuario || "Mi cuenta"}`;
  loginButton.title = nombreUsuario || "Mi cuenta";
  loginButton.setAttribute("aria-label", nombreUsuario || "Mi cuenta");

  if (adminPanelLink) {
    if (currentUser.rol === "Administrador") {
      adminPanelLink.classList.remove("hidden");
    } else {
      adminPanelLink.classList.add("hidden");
    }
  }
}

function toggleAccountMenu() {
  const accountMenu = document.getElementById("accountMenu");

  if (accountMenu) {
    accountMenu.classList.toggle("hidden");
  }
}

async function loginUser() {
  const correo = document.getElementById("loginEmail").value.trim();
  const clave = document.getElementById("loginPassword").value;

  try {
    const response = await fetch(AUTH_API_URL, {
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

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo iniciar sesión.");
    }

    currentUser = data.usuario;
    updateHeaderAuthState();
    await actualizarContadorCarrito();
    closeLoginModal();
  } catch (error) {
    alert(error.message);
  }
}


function setRegisterStep(step) {
  registerStep = Number(step || 1);

  document.querySelectorAll("[data-register-step]").forEach(section => {
    section.classList.toggle("hidden", Number(section.dataset.registerStep) !== registerStep);
  });

  document.querySelectorAll("[data-register-dot]").forEach(dot => {
    const dotStep = Number(dot.dataset.registerDot);
    dot.classList.toggle("active", dotStep === registerStep);
    dot.classList.toggle("done", dotStep < registerStep);
  });
}

async function handleRegisterStep(forcedStep = null) {
  const stepToHandle = Number(forcedStep || registerStep);

  if (stepToHandle === 1) {
    const nombre = document.getElementById("registerName")?.value.trim() || "";
    const apellido = document.getElementById("registerLastName")?.value.trim() || "";

    if (!nombre || !apellido) {
      alert("Completa nombre y apellido.");
      return;
    }

    setRegisterStep(2);
    return;
  }

  if (stepToHandle === 2) {
    await solicitarOtpRegistro();
    return;
  }

  if (stepToHandle === 3) {
    await verificarOtpRegistro();
    return;
  }

  if (stepToHandle === 4) {
    await registerUser();
  }
}

function clearRegisterMessages() {
  ["registerEmailMessage", "registerOtpMessage", "registerPasswordMessage"].forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = "";
    element.className = "register-otp-message";
  });
}


async function solicitarOtpRegistro() {
  const correoInput = document.getElementById("registerEmail");
  const emailMessage = document.getElementById("registerEmailMessage");

  const correo = correoInput ? correoInput.value.trim() : "";

  if (!correo) {
    if (emailMessage) {
      emailMessage.textContent = "Ingresa tu correo.";
      emailMessage.className = "register-otp-message error";
    }
    return;
  }

  if (correo.includes(",") || correo.includes(";") || /\s/.test(correo)) {
    if (emailMessage) {
      emailMessage.textContent = "Ingresa solo un correo válido.";
      emailMessage.className = "register-otp-message error";
    }
    return;
  }

  try {
    if (emailMessage) {
      emailMessage.textContent = "Enviando código...";
      emailMessage.className = "register-otp-message";
    }

    const response = await fetch(EMAIL_VERIFICATION_API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "solicitar_otp_registro",
        correo
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo enviar el código.");
    }

    registerState.correo = correo;
    registerState.codigo = "";

    if (emailMessage) {
      let mensaje = data.mensaje || "Código enviado. Revisa tu correo.";

      if (data.codigo_prueba) {
        mensaje += ` Código de prueba: ${data.codigo_prueba}`;
      }

      emailMessage.textContent = mensaje;
      emailMessage.className = "register-otp-message success";
    }

    const otpInput = document.getElementById("registerOtpCode");
    if (otpInput) otpInput.value = "";

    setRegisterStep(3);

  } catch (error) {
    if (emailMessage) {
      emailMessage.textContent = error.message;
      emailMessage.className = "register-otp-message error";
    } else {
      alert(error.message);
    }
  }
}

async function verificarOtpRegistro() {
  const otpInput = document.getElementById("registerOtpCode");
  const otpMessage = document.getElementById("registerOtpMessage");
  const codigo = otpInput ? otpInput.value.trim() : "";

  if (!registerState.correo) {
    setRegisterStep(2);
    return;
  }

  if (!codigo) {
    if (otpMessage) {
      otpMessage.textContent = "Ingresa el código OTP.";
      otpMessage.className = "register-otp-message error";
    }
    return;
  }

  try {
    if (otpMessage) {
      otpMessage.textContent = "Verificando código...";
      otpMessage.className = "register-otp-message";
    }

    const response = await fetch(EMAIL_VERIFICATION_API_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "verificar_otp_registro",
        correo: registerState.correo,
        codigo
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo verificar el código.");
    }

    registerState.codigo = codigo;

    if (otpMessage) {
      otpMessage.textContent = data.mensaje || "Correo verificado correctamente.";
      otpMessage.className = "register-otp-message success";
    }

    setRegisterStep(4);

  } catch (error) {
    if (otpMessage) {
      otpMessage.textContent = error.message;
      otpMessage.className = "register-otp-message error";
    } else {
      alert(error.message);
    }
  }
}

async function registerUser() {
  const nombre = document.getElementById("registerName").value.trim();
  const apellido = document.getElementById("registerLastName").value.trim();
  const documento = document.getElementById("registerDocument").value.trim();
  const correo = (registerState.correo || document.getElementById("registerEmail")?.value.trim() || "").trim();
  const telefono = document.getElementById("registerPhone").value.trim();
  const idGenero = document.getElementById("registerGender").value;
  const idBarrio = document.getElementById("registerNeighborhood").value;
  const direccion = document.getElementById("registerAddress").value.trim();
  const clave = document.getElementById("registerPassword").value;
  const confirmarClave = document.getElementById("registerPasswordConfirm").value;
  const codigoOtp = registerState.codigo || document.getElementById("registerOtpCode")?.value.trim() || "";

  const passwordMessage = document.getElementById("registerPasswordMessage");

  if (clave !== confirmarClave) {
    if (passwordMessage) {
      passwordMessage.textContent = "Las contraseñas no coinciden.";
      passwordMessage.className = "register-otp-message error";
    } else {
      alert("Las contraseñas no coinciden.");
    }
    return;
  }

  if (!codigoOtp) {
    setRegisterStep(3);
    alert("Primero confirma el código que llegó a tu correo.");
    return;
  }

  try {
    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accion: "register",
        nombre,
        apellido,
        documento,
        correo,
        telefono,
        id_genero: idGenero || null,
        id_barrio: idBarrio || null,
        direccion,
        clave,
        codigo_otp: codigoOtp
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo crear la cuenta.");
    }

    currentUser = data.usuario;
    registerState = { correo: "", codigo: "" };
    updateHeaderAuthState();
    closeLoginModal();

    alert("Cuenta creada correctamente.");

  } catch (error) {
    alert(error.message);
  }
}

async function logoutUser() {
  try {
    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accion: "logout"
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo cerrar sesión.");
    }

    currentUser = null;
    localStorage.removeItem("carrito");
    updateHeaderAuthState();
    await actualizarContadorCarrito();
  } catch (error) {
    alert(error.message);
  }
}


/* =========================
   RECUPERAR CONTRASEÑA
   ========================= */

function setupPasswordResetEvents() {
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const backToLoginFromReset = document.getElementById("backToLoginFromReset");
  const backToResetEmail = document.getElementById("backToResetEmail");
  const backToResetCode = document.getElementById("backToResetCode");
  const resetRequestForm = document.getElementById("resetRequestForm");
  const resetCodeForm = document.getElementById("resetCodeForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", () => {
      showResetRequestForm();
    });
  }

  if (backToLoginFromReset) {
    backToLoginFromReset.addEventListener("click", showLoginForm);
  }

  if (backToResetEmail) {
    backToResetEmail.addEventListener("click", showResetRequestForm);
  }

  if (backToResetCode) {
    backToResetCode.addEventListener("click", () => {
      showResetCodeForm();
    });
  }

  if (resetRequestForm) {
    resetRequestForm.addEventListener("submit", async event => {
      event.preventDefault();
      await requestPasswordOtp();
    });
  }

  if (resetCodeForm) {
    resetCodeForm.addEventListener("submit", async event => {
      event.preventDefault();
      await verifyPasswordOtp();
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async event => {
      event.preventDefault();
      await changePasswordWithOtp();
    });
  }
}

function hidePasswordResetForms() {
  ["resetRequestForm", "resetCodeForm", "resetPasswordForm"].forEach(id => {
    const form = document.getElementById(id);

    if (form) {
      form.classList.add("hidden");
    }
  });
}

function showResetRequestForm() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const resetRequestForm = document.getElementById("resetRequestForm");

  clearResetMessages();

  if (loginForm) loginForm.classList.add("hidden");
  if (registerForm) registerForm.classList.add("hidden");
  hidePasswordResetForms();

  const loginEmail = document.getElementById("loginEmail");
  const resetEmail = document.getElementById("resetEmail");

  if (resetEmail && loginEmail && loginEmail.value.trim()) {
    resetEmail.value = loginEmail.value.trim();
  }

  if (resetRequestForm) resetRequestForm.classList.remove("hidden");
}

function showResetCodeForm() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const resetCodeForm = document.getElementById("resetCodeForm");

  clearResetMessages();

  if (loginForm) loginForm.classList.add("hidden");
  if (registerForm) registerForm.classList.add("hidden");
  hidePasswordResetForms();

  if (resetCodeForm) resetCodeForm.classList.remove("hidden");
}

function showResetPasswordForm() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");

  clearResetMessages();

  if (loginForm) loginForm.classList.add("hidden");
  if (registerForm) registerForm.classList.add("hidden");
  hidePasswordResetForms();

  if (resetPasswordForm) resetPasswordForm.classList.remove("hidden");
}

async function requestPasswordOtp() {
  const resetEmail = document.getElementById("resetEmail");
  const correo = resetEmail ? resetEmail.value.trim() : "";

  if (!correo) {
    showResetMessage("resetRequestMessage", "Ingresa tu correo.", "error");
    return;
  }

  try {
    const data = await sendPasswordResetRequest({
      accion: "solicitar_otp",
      correo
    });

    resetPasswordState.correo = data.correo || correo;
    resetPasswordState.codigo = "";

    let mensaje = data.mensaje || "Código enviado correctamente.";

    if (data.codigo_prueba) {
      mensaje += ` Código de prueba: ${data.codigo_prueba}`;
    }

    showResetCodeForm();
    showResetMessage("resetCodeMessage", mensaje, "success");

  } catch (error) {
    showResetMessage("resetRequestMessage", error.message, "error");
  }
}

async function verifyPasswordOtp() {
  const resetCode = document.getElementById("resetCode");
  const codigo = resetCode ? resetCode.value.trim() : "";

  if (!resetPasswordState.correo) {
    showResetRequestForm();
    showResetMessage("resetRequestMessage", "Primero ingresa tu correo.", "error");
    return;
  }

  if (!codigo) {
    showResetMessage("resetCodeMessage", "Ingresa el código OTP.", "error");
    return;
  }

  try {
    await sendPasswordResetRequest({
      accion: "verificar_otp",
      correo: resetPasswordState.correo,
      codigo
    });

    resetPasswordState.codigo = codigo;
    showResetPasswordForm();
    showResetMessage("resetPasswordMessage", "Código verificado. Ahora crea tu nueva contraseña.", "success");

  } catch (error) {
    showResetMessage("resetCodeMessage", error.message, "error");
  }
}

async function changePasswordWithOtp() {
  const newPassword = document.getElementById("resetNewPassword")?.value || "";
  const confirmPassword = document.getElementById("resetConfirmPassword")?.value || "";

  if (!resetPasswordState.correo || !resetPasswordState.codigo) {
    showResetRequestForm();
    showResetMessage("resetRequestMessage", "Solicita y valida un código primero.", "error");
    return;
  }

  if (!newPassword || !confirmPassword) {
    showResetMessage("resetPasswordMessage", "Completa las contraseñas.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showResetMessage("resetPasswordMessage", "Las contraseñas no coinciden.", "error");
    return;
  }

  try {
    const data = await sendPasswordResetRequest({
      accion: "cambiar_password",
      correo: resetPasswordState.correo,
      codigo: resetPasswordState.codigo,
      nueva_clave: newPassword,
      confirmar_clave: confirmPassword
    });

    const loginEmail = document.getElementById("loginEmail");

    if (loginEmail) {
      loginEmail.value = resetPasswordState.correo;
    }

    resetPasswordState = { correo: "", codigo: "" };
    document.getElementById("resetPasswordForm")?.reset();
    showLoginForm();

    alert(data.mensaje || "Contraseña actualizada correctamente.");

  } catch (error) {
    showResetMessage("resetPasswordMessage", error.message, "error");
  }
}

async function sendPasswordResetRequest(payload) {
  const response = await fetch(PASSWORD_RESET_API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    console.error("Respuesta cruda de password_reset.php:", text);
    throw new Error("password_reset.php no devolvió JSON válido.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.mensaje || "No se pudo procesar la solicitud.");
  }

  return data;
}

function showResetMessage(id, message, type = "success") {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = message;
  element.classList.remove("hidden", "success", "error");
  element.classList.add(type === "error" ? "error" : "success");
}

function clearResetMessages() {
  ["resetRequestMessage", "resetCodeMessage", "resetPasswordMessage"].forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = "";
    element.classList.add("hidden");
    element.classList.remove("success", "error");
  });
}

/* =========================
   PERFIL
   ========================= */

function openProfileModal(editMode = false) {
  if (!currentUser) return;

  const accountMenu = document.getElementById("accountMenu");

  if (accountMenu) {
    accountMenu.classList.add("hidden");
  }

  document.getElementById("profileName").value = currentUser.nombre || "";
  document.getElementById("profileLastName").value = currentUser.apellido || "";
  document.getElementById("profileDocument").value = currentUser.documento || "";
  document.getElementById("profileEmail").value = currentUser.correo || "";
  document.getElementById("profilePhone").value = currentUser.telefono || "";
  document.getElementById("profileGender").value = currentUser.id_genero || "";
  document.getElementById("profileNeighborhood").value = currentUser.id_barrio || "";
  document.getElementById("profileAddress").value = currentUser.direccion || "";
  document.getElementById("profileRole").value = currentUser.rol || "";

  setProfileEditMode(editMode);

  const modal = document.getElementById("profileModal");

  if (modal) {
    modal.classList.add("show");
  }
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

function setProfileEditMode(editMode) {
  const fields = [
    "profileName",
    "profileLastName",
    "profileDocument",
    "profileEmail",
    "profilePhone",
    "profileGender",
    "profileNeighborhood",
    "profileAddress"
  ];

  fields.forEach(id => {
    const field = document.getElementById(id);

    if (field) {
      field.disabled = !editMode;
    }
  });

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profileModalTitle = document.getElementById("profileModalTitle");

  if (saveProfileBtn) {
    saveProfileBtn.style.display = editMode ? "inline-block" : "none";
  }

  if (profileModalTitle) {
    profileModalTitle.textContent = editMode ? "Editar Perfil" : "Mi Perfil";
  }
}

async function saveProfileChanges() {
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

    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo actualizar el perfil.");
    }

    currentUser = data.usuario;
    updateHeaderAuthState();
    closeProfileModal();

    alert("Perfil actualizado correctamente.");
  } catch (error) {
    alert(error.message);
  }
}


/* =========================
   HERO CARRUSEL DESTACADOS
========================= */

function setupHeroCarouselEvents() {
  const prevBtn = document.getElementById("heroPrevBtn");
  const nextBtn = document.getElementById("heroNextBtn");
  const addBtn = document.getElementById("heroAddCartBtn");
  const detailBtn = document.getElementById("heroDetailBtn");
  const heroCarousel = document.getElementById("heroCarousel");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      moveHeroCarousel(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      moveHeroCarousel(1);
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const product = featuredCarouselProducts[heroCarouselIndex];

      if (product) {
        addToCart(Number(product.id_producto));
      }
    });
  }

  if (detailBtn) {
    detailBtn.addEventListener("click", () => {
      const product = featuredCarouselProducts[heroCarouselIndex];

      if (product) {
        openProductDetail(Number(product.id_producto));
      }
    });
  }

  if (heroCarousel) {
    heroCarousel.addEventListener("mouseenter", stopHeroCarouselTimer);
    heroCarousel.addEventListener("mouseleave", startHeroCarouselTimer);
  }
}

function renderHeroCarousel() {
  featuredCarouselProducts = products.filter(product => {
    return Number(product.destacado) === 1;
  });

  if (featuredCarouselProducts.length === 0) {
    featuredCarouselProducts = products.slice(0, 5);
  }

  heroCarouselIndex = 0;
  renderHeroSlide();
  renderHeroDots();
  startHeroCarouselTimer();
}

function renderHeroSlide() {
  const product = featuredCarouselProducts[heroCarouselIndex];

  const bg = document.getElementById("heroSlideBg");
  const title = document.getElementById("heroProductTitle");
  const description = document.getElementById("heroProductDescription");
  const price = document.getElementById("heroProductPrice");
  const category = document.getElementById("heroProductCategory");
  const addBtn = document.getElementById("heroAddCartBtn");
  const detailBtn = document.getElementById("heroDetailBtn");

  if (!product) {
    if (title) title.textContent = "Ofertas Imperdibles";
    if (description) description.textContent = "¡Precios bajos cerca de ti!";
    if (price) price.textContent = "";
    if (category) category.textContent = "";
    if (addBtn) addBtn.classList.add("hidden");
    if (detailBtn) detailBtn.classList.add("hidden");
    return;
  }

  const image = product.imagen_url || "img/default.jpg";

  if (bg) {
    bg.style.opacity = "0.65";

    setTimeout(() => {
      bg.style.backgroundImage = `url("${image}")`;
      bg.style.opacity = "1";
    }, 120);
  }

  if (title) {
    title.textContent = product.nombre || "Producto destacado";
  }

  if (description) {
    description.textContent = product.descripcion || "Producto destacado disponible en Store Super Joven.";
  }

  if (price) {
    price.textContent = formatMoney(product.precio_venta);
  }

  if (category) {
    category.textContent = product.categoria || "Sin categoría";
  }

  if (addBtn) addBtn.classList.remove("hidden");
  if (detailBtn) detailBtn.classList.remove("hidden");

  updateHeroDots();
}

function renderHeroDots() {
  const dotsContainer = document.getElementById("heroDots");

  if (!dotsContainer) return;

  if (featuredCarouselProducts.length <= 1) {
    dotsContainer.innerHTML = "";
    return;
  }

  dotsContainer.innerHTML = featuredCarouselProducts.map((product, index) => {
    return `
      <button
        type="button"
        class="hero-dot ${index === heroCarouselIndex ? "active" : ""}"
        aria-label="Ver producto destacado ${index + 1}"
        onclick="goToHeroSlide(${index})"
      ></button>
    `;
  }).join("");
}

function updateHeroDots() {
  document.querySelectorAll(".hero-dot").forEach((dot, index) => {
    dot.classList.toggle("active", index === heroCarouselIndex);
  });
}

function moveHeroCarousel(direction) {
  if (featuredCarouselProducts.length === 0) return;

  heroCarouselIndex += direction;

  if (heroCarouselIndex < 0) {
    heroCarouselIndex = featuredCarouselProducts.length - 1;
  }

  if (heroCarouselIndex >= featuredCarouselProducts.length) {
    heroCarouselIndex = 0;
  }

  renderHeroSlide();
  restartHeroCarouselTimer();
}

function goToHeroSlide(index) {
  if (index < 0 || index >= featuredCarouselProducts.length) return;

  heroCarouselIndex = index;
  renderHeroSlide();
  restartHeroCarouselTimer();
}

function startHeroCarouselTimer() {
  stopHeroCarouselTimer();

  if (featuredCarouselProducts.length <= 1) return;

  heroCarouselTimer = setInterval(() => {
    moveHeroCarousel(1);
  }, 5000);
}

function stopHeroCarouselTimer() {
  if (heroCarouselTimer) {
    clearInterval(heroCarouselTimer);
    heroCarouselTimer = null;
  }
}

function restartHeroCarouselTimer() {
  stopHeroCarouselTimer();
  startHeroCarouselTimer();
}

/* =========================
   UTILIDADES
   ========================= */

function clearSearchInput() {
  const input = document.getElementById("searchInput");

  if (input) {
    input.value = "";
  }
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);

  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function formatMoney(value) {
  return "$" + Number(value || 0).toLocaleString("es-CO");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
