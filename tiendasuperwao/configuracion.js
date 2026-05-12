const settingsState = {
  neighborhoods: [],
  settings: {
    storeName: "",
    storePhone: "",
    storeEmail: "",
    storeAddress: "",
    storeNeighborhood: "",
    openingTime: "",
    closingTime: "",

    deliveryCost: "",
    freeDeliveryMinimum: "",

    freeDelivery: false,
    pickup: false,

    newOrders: false,
    lowStock: false,
    newClients: false,
    dailyReport: false,

    emailChannel: false,
    pushChannel: false,

    theme: "light",
    mainColor: "green",
    compactMode: false
  }
};

const SETTINGS_API_URL = "api/configuracion.php";
const NEIGHBORHOODS_API_URL = "api/barrios.php";
const SETTINGS_STORAGE_KEY = "admin_settings";
const ORDERS_STORAGE_KEY = "admin_orders";
const CLIENTS_STORAGE_KEY = "admin_clients";

document.addEventListener("DOMContentLoaded", async () => {
  await loadNeighborhoods();
  await loadSettings();
  setupSettingsEvents();
  fillSettingsForm();
  applyAppearance();
  renderSidebarBadges();
});

function setupSettingsEvents() {
  document.querySelectorAll(".config-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      changeTab(tab.dataset.tab);
    });
  });

  document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
    await saveSettingsFromForm();
  });

  setupSwitch("freeDeliverySwitch", "freeDelivery");
  setupSwitch("pickupSwitch", "pickup");
  setupSwitch("newOrdersSwitch", "newOrders");
  setupSwitch("lowStockSwitch", "lowStock");
  setupSwitch("newClientsSwitch", "newClients");
  setupSwitch("dailyReportSwitch", "dailyReport");

  setupSwitch("emailChannelSwitch", "emailChannel");
  setupSwitch("pushChannelSwitch", "pushChannel");

  setupSwitch("compactModeSwitch", "compactMode");

  document.getElementById("themeSelect").addEventListener("change", event => {
    settingsState.settings.theme = event.target.value;
    applyAppearance();
  });

  document.getElementById("mainColorSelect").addEventListener("change", event => {
    settingsState.settings.mainColor = event.target.value;
    applyAppearance();
  });

  document.querySelectorAll("[data-security]").forEach(button => {
    button.addEventListener("click", () => {
      openSecurityModal(button.dataset.security);
    });
  });

  document.getElementById("closeSettingsModal").addEventListener("click", closeSettingsModal);
  document.getElementById("acceptSettingsModal").addEventListener("click", closeSettingsModal);

  document.getElementById("settingsModal").addEventListener("click", event => {
    if (event.target.id === "settingsModal") {
      closeSettingsModal();
    }
  });
}


async function loadNeighborhoods() {
  try {
    const response = await fetch(NEIGHBORHOODS_API_URL, {
      credentials: "include",
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudieron cargar los barrios.");
    }

    settingsState.neighborhoods = Array.isArray(data) ? data : [];
    renderNeighborhoodOptions();

  } catch (error) {
    console.error("Error cargando barrios:", error);
    settingsState.neighborhoods = [];
    renderNeighborhoodOptions();
  }
}

function renderNeighborhoodOptions() {
  const select = document.getElementById("storeNeighborhood");

  if (!select) return;

  const currentValue = select.value || settingsState.settings.storeNeighborhood || "";

  select.innerHTML = `
    <option value="">Selecciona el barrio de la tienda</option>
  `;

  settingsState.neighborhoods.forEach(barrio => {
    const option = document.createElement("option");
    option.value = barrio.id_barrio;
    option.textContent = barrio.nombre;

    if (String(barrio.id_barrio) === String(currentValue)) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}


async function loadSettings() {
  try {
    const response = await fetch(SETTINGS_API_URL, {
      credentials: "include",
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || data.ok === false) {
      throw new Error(data.mensaje || "No se pudo cargar la configuración.");
    }

    if (data.configuracion) {
      settingsState.settings = {
        ...settingsState.settings,
        ...normalizarConfiguracionDesdeBD(data.configuracion)
      };

      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsState.settings));
      return;
    }
  } catch (error) {
    console.error("Error cargando configuración desde MySQL:", error);

    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (savedSettings) {
      settingsState.settings = {
        ...settingsState.settings,
        ...JSON.parse(savedSettings)
      };
    }
  }
}

async function saveSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsState.settings));

  const response = await fetch(SETTINGS_API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settingsState.settings)
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.mensaje || "No se pudo guardar la configuración.");
  }

  if (data.configuracion) {
    settingsState.settings = {
      ...settingsState.settings,
      ...normalizarConfiguracionDesdeBD(data.configuracion)
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsState.settings));
  }
}

function normalizarConfiguracionDesdeBD(configuracion) {
  return {
    storeName: configuracion.storeName || "",
    storePhone: configuracion.storePhone || "",
    storeEmail: configuracion.storeEmail || "",
    storeAddress: configuracion.storeAddress || "",
    storeNeighborhood: configuracion.storeNeighborhood || "",
    openingTime: configuracion.openingTime || "",
    closingTime: configuracion.closingTime || "",

    deliveryCost: configuracion.deliveryCost || "",
    freeDeliveryMinimum: configuracion.freeDeliveryMinimum || "",

    freeDelivery: Boolean(Number(configuracion.freeDelivery || 0)),
    pickup: Boolean(Number(configuracion.pickup || 0)),

    newOrders: Boolean(Number(configuracion.newOrders || 0)),
    lowStock: Boolean(Number(configuracion.lowStock || 0)),
    newClients: Boolean(Number(configuracion.newClients || 0)),
    dailyReport: Boolean(Number(configuracion.dailyReport || 0)),

    emailChannel: Boolean(Number(configuracion.emailChannel || 0)),
    pushChannel: Boolean(Number(configuracion.pushChannel || 0)),

    theme: configuracion.theme || "light",
    mainColor: configuracion.mainColor || "green",
    compactMode: Boolean(Number(configuracion.compactMode || 0))
  };
}

function fillSettingsForm() {
  const settings = settingsState.settings;

  document.getElementById("storeName").value = settings.storeName;
  document.getElementById("storePhone").value = settings.storePhone;
  document.getElementById("storeEmail").value = settings.storeEmail;
  document.getElementById("storeAddress").value = settings.storeAddress;

  const storeNeighborhood = document.getElementById("storeNeighborhood");
  if (storeNeighborhood) {
    storeNeighborhood.value = settings.storeNeighborhood || "";
  }

  document.getElementById("openingTime").value = settings.openingTime;
  document.getElementById("closingTime").value = settings.closingTime;

  document.getElementById("deliveryCost").value = settings.deliveryCost;
  document.getElementById("freeDeliveryMinimum").value = settings.freeDeliveryMinimum;

  document.getElementById("themeSelect").value = settings.theme;
  document.getElementById("mainColorSelect").value = settings.mainColor;

  refreshSwitches();
  toggleFreeDeliveryMinimumRow();
}

async function saveSettingsFromForm() {
  const settings = settingsState.settings;

  settings.storeName = document.getElementById("storeName").value.trim();
  settings.storePhone = document.getElementById("storePhone").value.trim();
  settings.storeEmail = document.getElementById("storeEmail").value.trim();
  settings.storeAddress = document.getElementById("storeAddress").value.trim();
  settings.storeNeighborhood = document.getElementById("storeNeighborhood")?.value || "";
  settings.openingTime = document.getElementById("openingTime").value;
  settings.closingTime = document.getElementById("closingTime").value;

  settings.deliveryCost = document.getElementById("deliveryCost").value;
  settings.freeDeliveryMinimum = document.getElementById("freeDeliveryMinimum").value;

  settings.theme = document.getElementById("themeSelect").value;
  settings.mainColor = document.getElementById("mainColorSelect").value;

  try {
    await saveSettings();
    applyAppearance();
    showToast("Cambios guardados correctamente");
  } catch (error) {
    console.error("Error guardando configuración:", error);
    alert("No se pudo guardar la configuración en MySQL: " + error.message);
  }
}

function changeTab(tabName) {
  document.querySelectorAll(".config-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".config-content").forEach(content => {
    content.classList.remove("active");
  });

  document.getElementById(`tab-${tabName}`).classList.add("active");
}

function setupSwitch(elementId, settingKey) {
  const button = document.getElementById(elementId);

  if (!button) return;

  button.addEventListener("click", () => {
    settingsState.settings[settingKey] = !settingsState.settings[settingKey];
    button.classList.toggle("active", settingsState.settings[settingKey]);

    if (settingKey === "compactMode") {
      applyAppearance();
    }

    if (settingKey === "freeDelivery") {
      toggleFreeDeliveryMinimumRow();
    }
  });
}

function refreshSwitches() {
  const switches = {
    freeDeliverySwitch: "freeDelivery",
    pickupSwitch: "pickup",

    newOrdersSwitch: "newOrders",
    lowStockSwitch: "lowStock",
    newClientsSwitch: "newClients",
    dailyReportSwitch: "dailyReport",

    emailChannelSwitch: "emailChannel",
    pushChannelSwitch: "pushChannel",

    compactModeSwitch: "compactMode"
  };

  Object.entries(switches).forEach(([elementId, settingKey]) => {
    const button = document.getElementById(elementId);

    if (button) {
      button.classList.toggle("active", Boolean(settingsState.settings[settingKey]));
    }
  });
}


function toggleFreeDeliveryMinimumRow() {
  const row = document.getElementById("freeDeliveryMinimumRow");
  const input = document.getElementById("freeDeliveryMinimum");

  if (!row) return;

  const isActive = Boolean(settingsState.settings.freeDelivery);

  row.classList.toggle("oculto", !isActive);

  if (input) {
    input.disabled = !isActive;
  }
}


function applyAppearance() {
  document.body.classList.remove(
    "dark-theme",
    "compact-mode",
    "color-green",
    "color-blue",
    "color-purple",
    "color-red"
  );

  if (settingsState.settings.theme === "dark") {
    document.body.classList.add("dark-theme");
  }

  if (settingsState.settings.compactMode) {
    document.body.classList.add("compact-mode");
  }

  document.body.classList.add(`color-${settingsState.settings.mainColor}`);
}

function openSecurityModal(type) {
  const title = document.getElementById("settingsModalTitle");
  const text = document.getElementById("settingsModalText");

  const messages = {
    twoFactor: {
      title: "Autenticación de dos factores",
      text: "Aquí podrás conectar un método de verificación cuando integres el backend."
    },
    password: {
      title: "Cambiar contraseña",
      text: "Esta opción quedará lista para conectarse con el sistema de usuarios."
    },
    sessions: {
      title: "Sesiones activas",
      text: "Aquí se mostrarán los dispositivos conectados cuando tengas autenticación real."
    }
  };

  title.textContent = messages[type].title;
  text.textContent = messages[type].text;

  document.getElementById("settingsModal").classList.add("show");
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("show");
}

function showToast(message) {
  const oldToast = document.querySelector(".save-toast");

  if (oldToast) {
    oldToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = "save-toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

function renderSidebarBadges() {
  const savedOrders = localStorage.getItem(ORDERS_STORAGE_KEY);
  const savedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);

  const orders = savedOrders ? JSON.parse(savedOrders) : [];
  const clients = savedClients ? JSON.parse(savedClients) : [];

  document.getElementById("sidebarOrders").textContent = orders.length;
  document.getElementById("sidebarClients").textContent = clients.length;
}