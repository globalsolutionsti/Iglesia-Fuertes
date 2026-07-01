import { APP_CONFIG } from "./config.js";
import { ApiError, apiGet, apiPost } from "./api.js";
import {
  clearStoredUser,
  getStoredApiUrl,
  getStoredUser,
  setStoredApiUrl,
  setStoredUser
} from "./storage.js";

const root = document.getElementById("app-root");
const toastRoot = document.getElementById("toast-root");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingMessage = document.getElementById("loading-message");

const VIEW_META = {
  dashboard: {
    module: "dashboard",
    title: "Dashboard Ejecutivo",
    subtitle: "Indicadores pastorales, consulta de grupos y crecimiento reciente."
  },
  assistants: {
    module: "congregants",
    title: "Congregantes",
    subtitle: "Padron general, altas, importacion y credenciales QR."
  },
  "congregants-new": {
    module: "congregants",
    title: "Nuevos Congregantes",
    subtitle: "Consulta altas recientes por periodo y revisa datos pastorales clave."
  },
  catalogs: {
    module: "connection",
    title: "Catalogos",
    subtitle: "Administra grupos de conexion y ministerios base del sistema."
  },
  seasons: {
    module: "connection",
    title: "Temporadas",
    subtitle: "Crea temporadas, sesiones y controla el calendario operativo."
  },
  participants: {
    module: "connection",
    title: "Asignacion de Participantes",
    subtitle: "Asigna personas a grupos de forma individual o masiva."
  },
  attendance: {
    module: "connection",
    title: "Asistencias",
    subtitle: "Opera la captura manual, escaneo QR asistido y modo kiosko."
  },
  qr: {
    module: "connection",
    title: "Asistencias",
    subtitle: "Opera la captura manual, escaneo QR asistido y modo kiosko."
  },
  "admin-settings": {
    module: "admin",
    title: "Configuracion",
    subtitle: "Actualiza URL de API, prueba conexion y revisa estado general."
  },
  "admin-users": {
    module: "admin",
    title: "Usuarios y Accesos",
    subtitle: "Crea usuarios, define perfiles y controla las fichas visibles."
  }
};

const MODULE_META = {
  dashboard: {
    title: "Dashboard Ejecutivo",
    description: "Pastor, lideres e indicadores clave",
    defaultView: "dashboard"
  },
  congregants: {
    title: "Congregantes",
    description: "Padron, altas y credenciales",
    defaultView: "assistants"
  },
  connection: {
    title: "Grupos de Conexion",
    description: "Catalogos, temporadas, asignacion y asistencias",
    defaultView: "catalogs"
  },
  admin: {
    title: "Administracion",
    description: "Configuracion, usuarios y permisos",
    defaultView: "admin-settings"
  }
};

const MODULE_TABS = {
  dashboard: [
    { view: "dashboard", label: "Resumen", description: "Pastor y lideres" }
  ],
  congregants: [
    { view: "assistants", label: "Congregantes", description: "Padron y credenciales" },
    { view: "congregants-new", label: "Nuevos", description: "Altas por periodo" }
  ],
  connection: [
    { view: "catalogs", label: "Catalogos", description: "Grupos y ministerios" },
    { view: "seasons", label: "Temporadas", description: "Sesiones y estados" },
    { view: "participants", label: "Asignacion", description: "Individual y masiva" },
    { view: "attendance", label: "Asistencias", description: "Manual, QR y kiosko" }
  ],
  admin: [
    { view: "admin-settings", label: "Configuracion", description: "API y conexion" },
    { view: "admin-users", label: "Usuarios", description: "Perfiles y accesos" }
  ]
};

const ACCESSIBLE_VIEWS = [
  "dashboard",
  "assistants",
  "congregants-new",
  "catalogs",
  "seasons",
  "participants",
  "attendance",
  "admin-settings",
  "admin-users"
];

const DEFAULT_QR_CAMERA_FACING = detectPreferredQrCameraFacing_();
const PERSON_TYPE_OPTIONS = ["Congregante", "Servidor", "Coordinador", "Lider"];
const CREDENTIAL_PREVIEW_LIMIT = 8;
PERSON_TYPE_OPTIONS.splice(0, PERSON_TYPE_OPTIONS.length, "Congregante", "Servidor", "Coordinador", "L\u00edder");
const MOBILE_NAV_ITEMS = [
  { module: "dashboard", view: "dashboard", label: "Inicio", description: "Pastor" },
  { module: "congregants", view: "assistants", label: "Padron", description: "Altas" },
  { module: "connection", view: "catalogs", label: "Grupos", description: "Operacion" },
  { module: "admin", view: "admin-settings", label: "Admin", description: "Accesos" }
];

const state = {
  user: getStoredUser(),
  apiUrl: getStoredApiUrl(),
  currentView: getStoredUser() ? "dashboard" : "login",
  connectionStatus: null,
  metrics: {
    peopleCount: null,
    directoryCount: null
  },
  dashboardExecutive: null,
  dashboardLeaderDetail: null,
  dashboardSessionInsights: null,
  dashboardSeasonMatrix: null,
  adminUsers: [],
  adminUsersSupport: {
    available: true,
    message: ""
  },
  viewLoadToken: 0,
  cacheKeys: {
    participants: "",
    attendance: "",
    attendanceDetail: "",
    qrSummary: "",
    dashboardSeasonMatrix: ""
  },
  loaded: {
    bootstrap: false,
    groups: false,
    ministries: false,
    seasons: false,
    people: false,
    peopleDirectory: false,
    activeSession: false,
    users: false
  },
  catalogs: {
    groups: [],
    ministries: []
  },
  seasons: [],
  sessionsBySeason: {},
  sessionGroupsByKey: {},
  people: [],
  peopleDirectory: [],
  activeSession: null,
  participants: [],
  participantContext: null,
  attendanceContext: null,
  attendanceForm: {},
  attendanceBaseline: {},
  attendanceDetail: null,
  realtimeSummary: null,
  qrSessionActivity: [],
  peopleImport: {
    fileName: "",
    rows: [],
    summary: null,
    progress: null
  },
  qrLastResult: null,
  qrScanner: {
    enabled: false,
    status: "idle",
    message: "Activa la camara para comenzar el registro automatico.",
    result: null,
    cameraFacing: ""
  },
  selectedBulkPeople: [],
  ui: {
    mobileNavOpen: false,
    editingGroupId: "",
    editingMinistryId: "",
    editingUserEmail: ""
  },
  filters: {
    dashboard: {
      seasonId: "",
      sessionId: "",
      groupId: "",
      recentFrom: "",
      recentTo: ""
    },
    assistants: {
      search: "",
      status: "ACTIVO",
      type: "ALL"
    },
    congregants: {
      recentFrom: "",
      recentTo: ""
    },
    seasons: {
      seasonId: ""
    },
    participants: {
      seasonId: "",
      sessionId: "",
      groupId: "",
      peopleSearch: "",
      bulkSearch: "",
      moveTargets: {}
    },
    attendance: {
      seasonId: "",
      sessionId: "",
      groupId: "",
      search: "",
      mode: "manual"
    },
    qr: {
      mode: "active",
      surface: "scanner",
      seasonId: "",
      sessionId: "",
      personId: "",
      peopleSearch: "",
      cameraFacing: DEFAULT_QR_CAMERA_FACING
    },
    admin: {
      userSearch: "",
      groupSearch: "",
      ministrySearch: ""
    }
  }
};

const pendingResourceLoads = {
  bootstrap: null,
  groups: null,
  ministries: null,
  seasons: null,
  people: null,
  peopleDirectory: null,
  activeSession: null,
  users: null
};

const qrScannerRuntime = {
  stream: null,
  detector: null,
  engine: "",
  canvas: null,
  context: null,
  animationFrameId: 0,
  busy: false,
  pausedUntil: 0,
  lastValue: "",
  lastValueAt: 0
};

const credentialRenderRuntime = {
  logoPromise: null
};

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
window.addEventListener("resize", () => {
  syncAppShellAfterRender_();
});
window.addEventListener("beforeunload", () => {
  stopQrScannerRuntime_();
});

init();

async function init() {
  initializeDateFilters_();
  renderApp();

  if (state.user) {
    await bootstrapApplication();
  }
}

function initializeDateFilters_() {
  const dashboardRange = getDefaultRecentRange_(90);
  const congregantsRange = getDefaultRecentRange_(30);

  if (!state.filters.dashboard.recentFrom) {
    state.filters.dashboard.recentFrom = dashboardRange.from;
  }

  if (!state.filters.dashboard.recentTo) {
    state.filters.dashboard.recentTo = dashboardRange.to;
  }

  if (!state.filters.congregants.recentFrom) {
    state.filters.congregants.recentFrom = congregantsRange.from;
  }

  if (!state.filters.congregants.recentTo) {
    state.filters.congregants.recentTo = congregantsRange.to;
  }
}

function getCurrentModule_() {
  const view = VIEW_META[state.currentView];
  return view?.module || "dashboard";
}

function getModuleTabs_(moduleId) {
  return (MODULE_TABS[moduleId] || []).filter((item) => canAccessView_(item.view));
}

function getUserPermissions_() {
  return Array.isArray(state.user?.permissions) && state.user.permissions.length
    ? state.user.permissions
    : ACCESSIBLE_VIEWS.slice();
}

function canAccessView_(view) {
  return getUserPermissions_().includes(view);
}

function getFirstAccessibleView_(views) {
  const allowed = views.find((view) => canAccessView_(view));
  return allowed || "dashboard";
}

function getDefaultViewForModule_(moduleId) {
  const meta = MODULE_META[moduleId];
  const tabs = getModuleTabs_(moduleId);

  if (tabs.length) {
    return tabs[0].view;
  }

  return meta?.defaultView || "dashboard";
}

function ensureAccessibleCurrentView_() {
  if (!state.user) {
    return;
  }

  if (!VIEW_META[state.currentView] || !canAccessView_(state.currentView)) {
    state.currentView = getFirstAccessibleView_(ACCESSIBLE_VIEWS);
  }
}

function renderModuleTabs_(moduleId) {
  const tabs = getModuleTabs_(moduleId);

  if (tabs.length <= 1) {
    return "";
  }

  return `
    <div class="module-tabs" role="tablist" aria-label="Fichas del modulo">
      ${tabs.map((tab) => renderModuleTabButton_(tab)).join("")}
    </div>
  `;
}

function renderModuleTabButton_(tab) {
  const isActive = state.currentView === tab.view || (tab.view === "attendance" && state.currentView === "qr");

  return `
    <button
      class="module-tab-button ${isActive ? "active" : ""}"
      data-action="navigate"
      data-view="${escapeHtml(tab.view)}"
      role="tab"
      aria-selected="${isActive ? "true" : "false"}"
    >
      <strong>${escapeHtml(tab.label)}</strong>
      <small>${escapeHtml(tab.description || "")}</small>
    </button>
  `;
}

function isUnknownActionError_(error, actionName = "") {
  if (!(error instanceof ApiError)) {
    return false;
  }

  const code = String(error.code || "").toUpperCase();
  const message = String(error.message || "");

  if (code === "UNKNOWN_ACTION") {
    return !actionName || message.includes(actionName);
  }

  return message.includes("Unknown action:") && (!actionName || message.includes(actionName));
}

function buildBackendRouteMissingError_(actionName, label) {
  return new ApiError(
    `Tu backend publicado aun no incluye ${label || actionName}. Actualiza los archivos .gs y vuelve a desplegar la Web App.`,
    "BACKEND_OUTDATED",
    {
      action: actionName
    }
  );
}

function loadViewDataInBackground_(view) {
  const token = ++state.viewLoadToken;
  const targetView = view || state.currentView;

  void loadCurrentViewData({
    showLoading: false
  })
    .then(() => {
      if (!state.user || token !== state.viewLoadToken || state.currentView !== targetView) {
        return;
      }

      renderApp();
    })
    .catch((error) => {
      if (token !== state.viewLoadToken || state.currentView !== targetView) {
        return;
      }

      handleError(error);
    });
}

function renderApp() {
  if (!state.user) {
    root.innerHTML = renderLoginView();
    schedulePostRenderSync_();
    return;
  }

  ensureAccessibleCurrentView_();

  const view = VIEW_META[state.currentView] || VIEW_META.dashboard;
  const currentModule = getCurrentModule_();
  const moduleMeta = MODULE_META[currentModule] || MODULE_META.dashboard;
  const apiDescriptor = describeApiUrl(state.apiUrl);
  const apiHost = describeApiHost(state.apiUrl);
  const mobileNavOpen = Boolean(state.ui.mobileNavOpen);

  root.innerHTML = `
    <div class="app-shell view-${escapeHtml(state.currentView)} ${mobileNavOpen ? "app-shell-nav-open" : ""}">
      <button
        class="mobile-nav-backdrop ${mobileNavOpen ? "visible" : ""}"
        data-action="close-mobile-nav"
        aria-label="Cerrar menu"
      ></button>

      ${renderMobileAppBar_(view)}

      <aside class="sidebar ${mobileNavOpen ? "is-open" : ""}">
        <div class="sidebar-inner">
          <div class="sidebar-mobile-head">
            <div class="sidebar-mobile-copy">
              <span class="sidebar-mobile-label">Navegacion</span>
              <strong>${escapeHtml(APP_CONFIG.appName)}</strong>
            </div>
            <button class="btn btn-ghost sidebar-close-button" data-action="close-mobile-nav">Cerrar</button>
          </div>

          <div class="sidebar-brand">
            <img src="assets/logo-fuertes.png" alt="Fuertes">
            <p>${escapeHtml(APP_CONFIG.appName)}<br>Control ministerial, asistencia y seguimiento.</p>
          </div>

          <nav class="sidebar-nav">
            ${Object.keys(MODULE_META).map((moduleId) => renderNavButton(moduleId)).filter(Boolean).join("")}
          </nav>

          <div class="sidebar-foot">
            <strong>${escapeHtml(state.user.name || "Usuario")}</strong>
            <span>${escapeHtml(state.user.role || "SIN ROL")}</span>
            <div class="actions-row">
              <button class="btn btn-secondary" data-action="refresh-app">Actualizar</button>
              <button class="btn btn-ghost" data-action="logout">Salir</button>
            </div>
          </div>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="topbar-copy">
            <span class="eyebrow">${escapeHtml(moduleMeta.title)}</span>
            <h1>${escapeHtml(view.title)}</h1>
            <p>${escapeHtml(view.subtitle)}</p>
          </div>

          <div class="topbar-actions">
            <div class="topbar-meta" title="${escapeHtml(state.apiUrl)}">
              <span class="topbar-meta-label">API conectada</span>
              <strong class="topbar-meta-value">${escapeHtml(apiHost)}</strong>
              <small class="topbar-meta-copy">${escapeHtml(apiDescriptor)}</small>
            </div>
            <button class="btn btn-ghost" data-action="refresh-app">Actualizar</button>
          </div>
        </header>

        ${renderModuleTabs_(currentModule)}

        ${renderCurrentView()}
      </main>

      ${renderMobileTabBar_()}
    </div>
  `;

  schedulePostRenderSync_();
}

function schedulePostRenderSync_() {
  window.requestAnimationFrame(() => {
    void syncRuntimeAfterRender_();
  });
}

async function syncRuntimeAfterRender_() {
  syncResponsiveTablesAfterRender_();
  syncAppShellAfterRender_();

  if (!state.user) {
    stopQrScannerRuntime_();
    return;
  }

  if (state.currentView === "assistants") {
    stopQrScannerRuntime_();
    syncCredentialQrsAfterRender_();
    return;
  }

  const attendanceMode = resolveConnectionAttendanceMode_();
  const shouldKeepQrRuntime = state.currentView === "qr" || (state.currentView === "attendance" && attendanceMode !== "manual");

  if (!shouldKeepQrRuntime) {
    stopQrScannerRuntime_();
    return;
  }

  if (!state.qrScanner.enabled) {
    stopQrScannerRuntime_(true);
    return;
  }

  await ensureQrScannerStarted_();
}

function renderLoginView() {
  return `
    <div class="login-shell">
      <section class="login-panel">
        <div>
          <div class="brand-lockup">
            <span class="eyebrow">Sistema Version 2</span>
            <img class="brand-logo" src="assets/logo-fuertes.png" alt="Fuertes">
<h1 class="login-title">Gestion moderna para congregantes y voluntarios</h1>
            <p class="login-copy">
              Esta nueva base del sistema se conecta a tu API V2 de Apps Script y deja listo el camino para
              login, dashboard, temporadas, grupos, asistencias y flujo de QR o kiosko con una experiencia
              mucho mas ordenada.
            </p>
          </div>

          <div class="feature-list">
            <article class="feature-item">
              <span class="feature-icon">01</span>
              <div>
                <h2 class="feature-title">Backend nuevo, frontend limpio</h2>
                <p class="feature-copy">Sin JSONP viejo, con configuracion central de API y respuestas estandarizadas.</p>
              </div>
            </article>

            <article class="feature-item">
              <span class="feature-icon">02</span>
              <div>
                <h2 class="feature-title">Operacion diaria mas rapida</h2>
                <p class="feature-copy">Captura manual, edicion, kiosko y consultas desde un solo flujo de trabajo.</p>
              </div>
            </article>

            <article class="feature-item">
              <span class="feature-icon">03</span>
              <div>
                <h2 class="feature-title">Visual sobrio y claro</h2>
                <p class="feature-copy">Paleta blanca, negra y gris para alinearse con el logo y reforzar legibilidad.</p>
              </div>
            </article>
          </div>
        </div>

        <div class="login-form-card">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Ingresar al sistema</h2>
              <p class="section-copy">Usa un usuario existente de la hoja USUARIOS de tu backend V2.</p>
            </div>
            ${renderConnectionChip()}
          </div>

          <form id="login-form">
            <div class="field-grid">
              <div class="field">
                <label for="login-email">Correo</label>
                <input id="login-email" name="email" type="email" placeholder="correo@iglesia.com" required>
              </div>

              <div class="field">
                <label for="login-password">Contrasena</label>
                <input id="login-password" name="password" type="password" placeholder="Tu contrasena" required>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Ingresar</button>
            </div>
          </form>

          <div class="field-grid" style="margin-top: 18px;">
            <div class="field">
              <label for="api-url-input">URL de la API</label>
              <input id="api-url-input" type="url" value="${escapeHtml(state.apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec">
              <span class="field-help">
                Ya deje cargada la URL mas reciente que validaste. Si publicas una nueva version del Apps Script, solo reemplazala aqui.
              </span>
            </div>
          </div>

          <div class="actions-row">
            <button class="btn btn-secondary" data-action="save-api-url">Guardar URL</button>
            <button class="btn btn-ghost" data-action="test-api-connection">Probar conexion</button>
          </div>
        </div>
      </section>

      <aside class="login-aside">
        <div class="aside-head">
          <div>
            <span class="eyebrow">Ruta sugerida</span>
            <h2 class="aside-title">Primero base operativa, luego refinamos cada modulo</h2>
            <p class="aside-copy">
              Este frontend ya nace pensando en migracion total a V2: menos friccion para los lideres,
              mejor orden visual y una capa de codigo mucho mas mantenible.
            </p>
          </div>
        </div>

        <div class="metric-grid">
          <article class="metric-card">
            <span class="metric-value">7</span>
            <span class="metric-label">Pantallas base conectadas</span>
          </article>
          <article class="metric-card">
            <span class="metric-value">1</span>
            <span class="metric-label">Configuracion central de API</span>
          </article>
          <article class="metric-card">
            <span class="metric-value">0</span>
            <span class="metric-label">Dependencias pesadas</span>
          </article>
          <article class="metric-card">
            <span class="metric-value">100%</span>
            <span class="metric-label">Alineado al backend V2</span>
          </article>
        </div>

        <div class="connection-box">
          <span class="eyebrow">Siguiente etapa</span>
          <p>
            Cuando esta base te guste visualmente, el siguiente paso natural es conectar camara QR en navegador,
              formularios mas avanzados de voluntarios y reportes historicos.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function renderMobileAppBar_(view) {
  const activeSession = state.activeSession && state.activeSession.found ? state.activeSession.session : null;

  return `
    <header class="mobile-appbar">
      <div class="mobile-appbar-brand">
        <img src="assets/logo-fuertes.png" alt="Fuertes">
        <div class="mobile-appbar-copy">
          <span class="mobile-appbar-label">${escapeHtml(APP_CONFIG.appName)}</span>
          <strong>${escapeHtml(view.title)}</strong>
        </div>
      </div>

      <div class="mobile-appbar-actions">
        ${activeSession ? `<span class="mobile-appbar-chip">Sesion ABIERTA</span>` : ""}
        <button class="btn btn-ghost mobile-menu-button" data-action="toggle-mobile-nav">Menu</button>
      </div>
    </header>
  `;
}

function renderMobileTabBar_() {
  return `
    <nav class="mobile-tabbar" aria-label="Navegacion principal movil">
      <div class="mobile-tabbar-inner">
        ${MOBILE_NAV_ITEMS.map((item) => renderMobileNavButton_(item.module, item.view, item.label, item.description)).filter(Boolean).join("")}
      </div>
    </nav>
  `;
}

function renderModuleMobileHero_(options) {
  const {
    tone = "neutral",
    eyebrow = "",
    title = "",
    copy = "",
    badge = null,
    metrics = [],
    actions = []
  } = options || {};

  return `
    <article class="module-mobile-hero module-mobile-hero-${escapeHtml(tone)}">
      <div class="module-mobile-hero-head">
        <div>
          ${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(copy)}</p>
        </div>
        ${badge ? `<span class="pill ${escapeHtml(badge.kind || "dark")}">${escapeHtml(badge.label || "")}</span>` : ""}
      </div>

      ${metrics.length ? `
        <div class="module-mobile-metrics">
          ${metrics.map((metric) => renderModuleMobileMetric_(metric)).join("")}
        </div>
      ` : ""}

      ${actions.length ? `
        <div class="actions-row module-mobile-actions">
          ${actions.map((action) => renderModuleMobileAction_(action)).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderModuleMobileMetric_(metric) {
  return `
    <span class="context-item">
      <strong>${escapeHtml(metric.label || "")}:</strong> ${escapeHtml(metric.value || "")}
    </span>
  `;
}

function renderModuleMobileAction_(action) {
  const variant = action.variant || "secondary";
  const actionName = action.action || (action.view ? "navigate" : "scroll-to-section");
  const sectionIdAttribute = action.sectionId ? ` data-section-id="${escapeHtml(action.sectionId)}"` : "";
  const viewAttribute = action.view ? ` data-view="${escapeHtml(action.view)}"` : "";

  return `
    <button
      class="btn btn-${escapeHtml(variant)}"
      data-action="${escapeHtml(actionName)}"${sectionIdAttribute}${viewAttribute}
    >
      ${escapeHtml(action.label || "Abrir")}
    </button>
  `;
}

function renderDashboardMobileShortcut_(shortcut) {
  const actionName = shortcut.action || (shortcut.view ? "navigate" : "scroll-to-section");
  const sectionIdAttribute = shortcut.sectionId ? ` data-section-id="${escapeHtml(shortcut.sectionId)}"` : "";
  const viewAttribute = shortcut.view ? ` data-view="${escapeHtml(shortcut.view)}"` : "";

  return `
    <button
      class="dashboard-mobile-shortcut"
      data-action="${escapeHtml(actionName)}"${sectionIdAttribute}${viewAttribute}
    >
      <strong>${escapeHtml(shortcut.label || "Abrir")}</strong>
      <span>${escapeHtml(shortcut.copy || "")}</span>
    </button>
  `;
}

function renderDashboardMobileHero_(options) {
  const {
    seasonName = "Sin temporada",
    sessionsCount = 0,
    activeSessionName = "Sin sesion",
    groupsPending = 0,
    attendanceRate = 0,
    activeSessionOpen = false
  } = options || {};

  return `
    <article class="dashboard-mobile-hero">
      <div class="dashboard-mobile-hero-head">
        <div>
          <h2>Dashboard Ejecutivo</h2>
        </div>
        <span class="pill ${activeSessionOpen ? "success" : "warning"}">${activeSessionOpen ? "Sesion abierta" : "Sin sesion"}</span>
      </div>

      <div class="dashboard-mobile-chip-grid">
        <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(seasonName)}</span>
        <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(sessionsCount || 0))}</span>
        <span class="context-item"><strong>Sesion:</strong> ${escapeHtml(activeSessionName || "Sin sesion")}</span>
        <span class="context-item"><strong>Pendientes:</strong> ${escapeHtml(String(groupsPending || 0))}</span>
        <span class="context-item"><strong>Cobertura:</strong> ${escapeHtml(String(attendanceRate || 0))}%</span>
      </div>
    </article>
  `;
}

function renderCurrentView() {
  switch (state.currentView) {
    case "assistants":
      return renderCongregantsDirectoryView_();
    case "congregants-new":
      return renderCongregantsRecentView_();
    case "catalogs":
      return renderCatalogsView_();
    case "seasons":
      return renderConnectionSectionView_(renderSeasonsView());
    case "participants":
      return renderConnectionSectionView_(renderParticipantsView());
    case "attendance":
      return renderConnectionAttendanceView_();
    case "qr":
      return renderConnectionAttendanceView_();
    case "admin-settings":
      return renderAdminSettingsView_();
    case "admin-users":
      return renderAdminUsersView_();
    case "dashboard":
    default:
      return renderDashboardView();
  }
}

function renderCongregantsDirectoryView_() {
  return renderAssistantsView();
}

function renderConnectionSectionView_(content) {
  return content;
}

function resolveConnectionAttendanceMode_() {
  if (state.currentView === "qr") {
    return state.filters.qr.surface === "kiosk" ? "kiosk" : "qr";
  }

  if (state.filters.attendance.mode === "qr" || state.filters.attendance.mode === "kiosk") {
    return state.filters.attendance.mode;
  }

  return "manual";
}

function renderConnectionAttendanceView_() {
  const mode = resolveConnectionAttendanceMode_();
  const modeCards = [
    {
      mode: "manual",
      title: "Captura manual",
      copy: "Elige grupo, revisa sesion activa y pasa lista en pantalla."
    },
    {
      mode: "qr",
      title: "Escaneo QR asistido",
      copy: "Un operador escanea o captura el QR con seguimiento inmediato."
    },
    {
      mode: "kiosk",
      title: "Modo kiosko",
      copy: "Pantalla tipo aeropuerto para auto registro con camara."
    }
  ];
  const content = mode === "manual" ? renderAttendanceView() : renderQrView();

  return `
    <section class="view-grid">
      <article class="panel-card attendance-mode-switcher">
        <div class="panel-head">
          <div>
            <h2>Modalidades de asistencia</h2>
            <p>El modulo de asistencias concentra tus tres formas de operacion en un solo punto.</p>
          </div>
          <span class="pill dark">${escapeHtml(mode === "manual" ? "Manual" : (mode === "qr" ? "QR asistido" : "Kiosko"))}</span>
        </div>

        <div class="mode-card-grid">
          ${modeCards.map((item) => `
            <button
              class="mode-card ${mode === item.mode ? "active" : ""}"
              data-action="set-attendance-mode"
              data-mode="${escapeHtml(item.mode)}"
            >
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.copy)}</span>
            </button>
          `).join("")}
        </div>
      </article>
    </section>

    ${content}
  `;
}

function renderCongregantsRecentView_() {
  const rows = getRecentCongregants_();
  const activeCount = rows.filter((row) => String(row.estado || "").toUpperCase() === "ACTIVO").length;
  const withPhoneCount = rows.filter((row) => String(row.telefono || "").trim()).length;
  const withBirthDateCount = rows.filter((row) => String(row.fechaNacimiento || "").trim()).length;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "assistants",
        eyebrow: "Nuevos congregantes",
        title: "Consulta pastoral por periodo",
        copy: "Filtra altas recientes y revisa los datos clave para seguimiento.",
        badge: {
          label: `${rows.length} en periodo`,
          kind: rows.length ? "success" : "warning"
        },
        metrics: [
          { label: "Activos", value: String(activeCount) },
          { label: "Telefonos", value: String(withPhoneCount) },
          { label: "Nacimiento", value: String(withBirthDateCount) }
        ],
        actions: [
          { label: "Ir al padron", variant: "primary", view: "assistants" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip success">Altas en periodo</span>
          <strong>${escapeHtml(String(rows.length))}</strong>
          <span>Congregantes nuevos segun el rango de fechas seleccionado.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Activos</span>
          <strong>${escapeHtml(String(activeCount))}</strong>
          <span>Registros activos listos para seguimiento pastoral.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Con telefono</span>
          <strong>${escapeHtml(String(withPhoneCount))}</strong>
          <span>Facilita contacto, bienvenida y seguimiento inicial.</span>
        </article>
      </div>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <h2>Filtro de periodo</h2>
            <p>Consulta el ultimo mes o define manualmente desde y hasta.</p>
          </div>
        </div>

        <div class="field-grid two">
          <div class="field">
            <label for="congregants-recent-from">Desde</label>
            <input id="congregants-recent-from" type="date" value="${escapeHtml(state.filters.congregants.recentFrom)}">
          </div>
          <div class="field">
            <label for="congregants-recent-to">Hasta</label>
            <input id="congregants-recent-to" type="date" value="${escapeHtml(state.filters.congregants.recentTo)}">
          </div>
        </div>

        <div class="actions-row">
          <button class="btn btn-secondary" data-action="set-congregants-period" data-days="30">Ultimo mes</button>
          <button class="btn btn-ghost" data-action="set-congregants-period" data-days="90">Ultimos 3 meses</button>
        </div>
      </article>

      <article class="detail-card">
        <div class="panel-head">
          <div>
            <h2>Consulta de nuevos congregantes</h2>
            <p>Nombre, telefono, fecha de nacimiento, estado civil y edad de cada alta reciente.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(rows.length))} resultados</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Fecha nacimiento</th>
                <th>Estado civil</th>
                <th>Edad</th>
                <th>Alta</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((row) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(row.nombreCompleto || row.nombre || "Sin nombre")}</span>
                    <span class="row-meta">${escapeHtml(row.numero || "")} | QR ${escapeHtml(row.id || "")}</span>
                  </td>
                  <td>${escapeHtml(row.telefono || "Sin telefono")}</td>
                  <td>${escapeHtml(formatDate(row.fechaNacimiento) || "Sin fecha")}</td>
                  <td>${escapeHtml(row.estadoCivil || "Sin dato")}</td>
                  <td>${escapeHtml(String(row.edad || "Sin dato"))}</td>
                  <td>${escapeHtml(formatDate(row.fechaIngreso) || "Sin fecha")}</td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="6">
                    <div class="empty-state">No hay congregantes nuevos en el periodo seleccionado.</div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `;
}

function renderCatalogsView_() {
  const groupSearch = normalizeText(state.filters.admin.groupSearch);
  const ministrySearch = normalizeText(state.filters.admin.ministrySearch);
  const groups = state.catalogs.groups.filter((group) => {
    const haystack = `${group.id} ${group.name}`.toLowerCase();
    return !groupSearch || haystack.includes(groupSearch);
  });
  const ministries = state.catalogs.ministries.filter((ministry) => {
    const haystack = `${ministry.id} ${ministry.name}`.toLowerCase();
    return !ministrySearch || haystack.includes(ministrySearch);
  });
  const editingGroup = state.catalogs.groups.find((group) => String(group.id) === String(state.ui.editingGroupId || "")) || null;
  const editingMinistry = state.catalogs.ministries.find((ministry) => String(ministry.id) === String(state.ui.editingMinistryId || "")) || null;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "participants",
        eyebrow: "Base operativa",
        title: "Catalogos de grupos y ministerios",
        copy: "Mantiene alineados los grupos de conexion y las areas de servicio.",
        badge: {
          label: `${state.catalogs.groups.length} grupos`,
          kind: "dark"
        },
        metrics: [
          { label: "Grupos", value: String(state.catalogs.groups.length) },
          { label: "Ministerios", value: String(state.catalogs.ministries.length) }
        ],
        actions: [
          { label: "Temporadas", variant: "primary", view: "seasons" },
          { label: "Asignacion", variant: "secondary", view: "participants" }
        ]
      })}

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Catalogo de grupos</h2>
              <p>Agrega o actualiza los grupos de conexion base.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(groups.length))} visibles</span>
          </div>

          <form id="catalog-group-form">
            <input type="hidden" name="id" value="${escapeHtml(editingGroup?.id || "")}">
            <div class="field-grid two">
              <div class="field">
                <label for="catalog-group-id">ID</label>
                <input id="catalog-group-id" value="${escapeHtml(editingGroup?.id || "Automatico")}" disabled>
              </div>
              <div class="field">
                <label for="catalog-group-name">Nombre del grupo</label>
                <input id="catalog-group-name" name="name" value="${escapeHtml(editingGroup?.name || "")}" placeholder="Nuevo grupo de conexion" required>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">${editingGroup ? "Guardar grupo" : "Crear grupo"}</button>
              <button class="btn btn-ghost" type="button" data-action="clear-catalog-group-form" ${editingGroup ? "" : "disabled"}>Limpiar</button>
            </div>
          </form>

          <div class="field catalog-search-field">
            <label for="admin-group-search">Buscar grupo</label>
            <input id="admin-group-search" value="${escapeHtml(state.filters.admin.groupSearch)}" placeholder="Nombre o ID">
          </div>

          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Grupo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                ${groups.length ? groups.map((group) => `
                  <tr>
                    <td>${escapeHtml(String(group.id))}</td>
                    <td>${escapeHtml(group.name)}</td>
                    <td><button class="btn btn-secondary" data-action="edit-group-catalog" data-group-id="${escapeHtml(String(group.id))}">Editar</button></td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="3"><div class="empty-state">No hay grupos que coincidan con la busqueda.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Catalogo de ministerios</h2>
              <p>Administra las areas ministeriales usadas en el padron.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(ministries.length))} visibles</span>
          </div>

          <form id="catalog-ministry-form">
            <input type="hidden" name="id" value="${escapeHtml(editingMinistry?.id || "")}">
            <div class="field-grid two">
              <div class="field">
                <label for="catalog-ministry-id">ID</label>
                <input id="catalog-ministry-id" value="${escapeHtml(editingMinistry?.id || "Automatico")}" disabled>
              </div>
              <div class="field">
                <label for="catalog-ministry-name">Nombre del ministerio</label>
                <input id="catalog-ministry-name" name="name" value="${escapeHtml(editingMinistry?.name || "")}" placeholder="Nuevo ministerio" required>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">${editingMinistry ? "Guardar ministerio" : "Crear ministerio"}</button>
              <button class="btn btn-ghost" type="button" data-action="clear-catalog-ministry-form" ${editingMinistry ? "" : "disabled"}>Limpiar</button>
            </div>
          </form>

          <div class="field catalog-search-field">
            <label for="admin-ministry-search">Buscar ministerio</label>
            <input id="admin-ministry-search" value="${escapeHtml(state.filters.admin.ministrySearch)}" placeholder="Nombre o ID">
          </div>

          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ministerio</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                ${ministries.length ? ministries.map((ministry) => `
                  <tr>
                    <td>${escapeHtml(String(ministry.id))}</td>
                    <td>${escapeHtml(ministry.name)}</td>
                    <td><button class="btn btn-secondary" data-action="edit-ministry-catalog" data-ministry-id="${escapeHtml(String(ministry.id))}">Editar</button></td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="3"><div class="empty-state">No hay ministerios que coincidan con la busqueda.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderAdminSettingsView_() {
  const permissions = getUserPermissions_();
  const currentModule = getCurrentModule_();
  const usersSupport = state.adminUsersSupport;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "seasons",
        eyebrow: "Administracion",
        title: "Configuracion del sistema",
        copy: "Centraliza la API, prueba conexion y revisa quien opera la herramienta.",
        badge: {
          label: state.connectionStatus?.type === "success" ? "Conectado" : "Listo",
          kind: state.connectionStatus?.type === "success" ? "success" : "dark"
        },
        metrics: [
          { label: "Accesos", value: String(permissions.length) },
          { label: "Usuarios", value: String(state.adminUsers.length) },
          { label: "Modulo", value: MODULE_META[currentModule]?.title || "Admin" }
        ],
        actions: [
          { label: "Usuarios", variant: "primary", view: "admin-users" },
          { label: "Probar API", variant: "secondary", action: "test-api-connection" }
        ]
      })}

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>URL de la API</h2>
              <p>Actualiza la direccion base del Apps Script y valida la conexion.</p>
            </div>
          </div>

          <div class="field">
            <label for="api-url-input">URL base</label>
            <input id="api-url-input" value="${escapeHtml(state.apiUrl || "")}" placeholder="https://script.google.com/macros/s/.../exec">
          </div>

          <div class="actions-row">
            <button class="btn btn-primary" data-action="save-api-url">Guardar URL</button>
            <button class="btn btn-secondary" data-action="test-api-connection">Probar conexion</button>
          </div>

          ${!usersSupport.available ? `
            <p class="footer-note">${escapeHtml(usersSupport.message)}</p>
          ` : ""}

          ${state.connectionStatus ? `
            <p class="footer-note">${escapeHtml(state.connectionStatus.message || "")}</p>
          ` : ""}
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Resumen administrativo</h2>
              <p>Te recuerda rapidamente que partes del sistema estan listas para operar.</p>
            </div>
          </div>

          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Usuarios</span>
              <strong>${escapeHtml(String(state.adminUsers.length))}</strong>
              <span>Operadores dados de alta en esta V2.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Permisos propios</span>
              <strong>${escapeHtml(String(permissions.length))}</strong>
              <span>Fichas visibles para tu usuario actual.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip dark">Grupos</span>
              <strong>${escapeHtml(String(state.catalogs.groups.length))}</strong>
              <span>Catalogo base ya sincronizado.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip dark">Temporadas</span>
              <strong>${escapeHtml(String(state.seasons.length))}</strong>
              <span>Ciclos disponibles en la V2.</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderAdminUsersView_() {
  const editingUser = state.adminUsers.find((user) => String(user.email) === String(state.ui.editingUserEmail || "")) || null;
  const users = getFilteredAdminUsers_();
  const selectedPermissions = editingUser?.permissions?.length ? editingUser.permissions : ACCESSIBLE_VIEWS.slice();
  const usersSupport = state.adminUsersSupport;
  const usersAdminAvailable = usersSupport.available;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "seasons",
        eyebrow: "Accesos",
        title: "Usuarios, perfiles y fichas",
        copy: "Cada usuario puede entrar solo a los modulos que realmente necesita operar.",
        badge: {
          label: `${state.adminUsers.length} usuarios`,
          kind: "dark"
        },
        metrics: [
          { label: "Activos", value: String(state.adminUsers.filter((user) => String(user.status || "").toUpperCase() === "ACTIVO").length) },
          { label: "Busqueda", value: state.filters.admin.userSearch ? "Filtrada" : "General" }
        ],
        actions: [
          { label: "Nuevo usuario", variant: "primary", action: "clear-admin-user-form" },
          { label: "Configuracion", variant: "secondary", view: "admin-settings" }
        ]
      })}

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>${editingUser ? "Editar usuario" : "Alta de usuario"}</h2>
              <p>Define perfil, estado y fichas visibles dentro del sistema.</p>
            </div>
          </div>

          ${!usersAdminAvailable ? `
            <div class="empty-state">${escapeHtml(usersSupport.message)}</div>
          ` : ""}

          <form id="admin-user-form">
            <input type="hidden" name="editingEmail" value="${escapeHtml(editingUser?.email || "")}">
            <div class="field-grid two">
              <div class="field">
                <label for="admin-user-email">Correo</label>
                <input id="admin-user-email" name="email" value="${escapeHtml(editingUser?.email || "")}" placeholder="usuario@iglesia.com" ${editingUser ? "readonly" : ""} ${usersAdminAvailable ? "" : "disabled"} required>
              </div>
              <div class="field">
                <label for="admin-user-name">Nombre</label>
                <input id="admin-user-name" name="name" value="${escapeHtml(editingUser?.name || "")}" placeholder="Nombre del usuario" ${usersAdminAvailable ? "" : "disabled"} required>
              </div>
            </div>

            <div class="field-grid two">
              <div class="field">
                <label for="admin-user-role">Perfil</label>
                <select id="admin-user-role" name="role" ${usersAdminAvailable ? "" : "disabled"}>
                  ${renderOptions([
                    { value: "ADMIN", label: "ADMIN" },
                    { value: "PASTOR", label: "PASTOR" },
                    { value: "LIDER", label: "LIDER" },
                    { value: "OPERADOR", label: "OPERADOR" }
                  ], editingUser?.role || "OPERADOR", "Selecciona perfil")}
                </select>
              </div>
              <div class="field">
                <label for="admin-user-status">Estado</label>
                <select id="admin-user-status" name="status" ${usersAdminAvailable ? "" : "disabled"}>
                  ${renderOptions([
                    { value: "ACTIVO", label: "ACTIVO" },
                    { value: "INACTIVO", label: "INACTIVO" }
                  ], editingUser?.status || "ACTIVO", "Selecciona estado")}
                </select>
              </div>
            </div>

            <div class="field">
              <label for="admin-user-password">${editingUser ? "Nueva contrasena" : "Contrasena"}</label>
              <input id="admin-user-password" name="password" type="password" placeholder="${editingUser ? "Solo si deseas actualizarla" : "Contrasena inicial"}" ${usersAdminAvailable ? "" : "disabled"} ${editingUser ? "" : "required"}>
            </div>

            <div class="field">
              <label>Fichas con acceso</label>
              <div class="permission-grid">
                ${ACCESSIBLE_VIEWS.map((permission) => `
                  <label class="permission-card">
                    <input type="checkbox" name="permissions" value="${escapeHtml(permission)}" ${selectedPermissions.includes(permission) ? "checked" : ""} ${usersAdminAvailable ? "" : "disabled"}>
                    <span>
                      <strong>${escapeHtml(getPermissionLabel_(permission))}</strong>
                      <small>${escapeHtml(getPermissionDescription_(permission))}</small>
                    </span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit" ${usersAdminAvailable ? "" : "disabled"}>${editingUser ? "Guardar cambios" : "Crear usuario"}</button>
              <button class="btn btn-ghost" type="button" data-action="clear-admin-user-form" ${editingUser && usersAdminAvailable ? "" : "disabled"}>Limpiar</button>
            </div>
          </form>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Usuarios del sistema</h2>
              <p>Busca un operador y entra a editar su perfil o accesos.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(users.length))} visibles</span>
          </div>

          <div class="field">
            <label for="admin-user-search">Buscar usuario</label>
            <input id="admin-user-search" value="${escapeHtml(state.filters.admin.userSearch)}" placeholder="Nombre, correo o perfil">
          </div>

          <div class="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                  <th>Fichas</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                ${!usersAdminAvailable ? `
                  <tr>
                    <td colspan="5"><div class="empty-state">${escapeHtml(usersSupport.message)}</div></td>
                  </tr>
                ` : users.length ? users.map((user) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(user.name || user.email)}</span>
                      <span class="row-meta">${escapeHtml(user.email)}</span>
                    </td>
                    <td>${escapeHtml(user.role || "SIN ROL")}</td>
                    <td>${renderPill(user.status || "ACTIVO")}</td>
                    <td>${escapeHtml(String(user.permissions?.length || 0))}</td>
                    <td><button class="btn btn-secondary" data-action="edit-admin-user" data-user-email="${escapeHtml(user.email)}">Editar</button></td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="5"><div class="empty-state">No hay usuarios que coincidan con la busqueda.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderDashboardView() {
  const executive = state.dashboardExecutive;
  const latestSeason = getLatestSeason();
  const focusSeason = executive?.seasonFocus || (latestSeason ? {
    id: latestSeason.id,
    name: latestSeason.name,
    status: latestSeason.status,
    startDate: latestSeason.startDate,
    sessionsCount: latestSeason.sessionsCount || getSessions(latestSeason.id).length
  } : null);
  const activeSession = executive?.activeSession || (state.activeSession && state.activeSession.found ? state.activeSession.session : null);
  const peopleCount = getDashboardPeopleCount_();
  const totals = executive?.totals || {};
  const pastor = executive?.pastorIndicators || {};
  const seasonal = executive?.seasonalIndicators || {};
  const today = executive?.todaySummary || {
    found: false,
    totalGroups: 0,
    groupsCaptured: 0,
    groupsPending: 0,
    totalParticipants: 0,
    presentCount: 0,
    attendanceRate: 0,
    pendingGroupNames: []
  };
  const groupsRanking = executive?.groupsRanking || [];
  const topGroups = executive?.topGroups || groupsRanking.slice(0, 5);
  const selectedGroupId = state.filters.dashboard.groupId;
  const selectedGroupRow = groupsRanking.find((group) => String(group.groupId) === String(selectedGroupId)) || null;
  const leaderSummary = buildDashboardLeaderSummary_(selectedGroupRow, state.dashboardLeaderDetail);
  const seasonMatrix = state.dashboardSeasonMatrix;
  const dashboardSeasonId = state.filters.dashboard.seasonId || focusSeason?.id || "";
  const recentCongregants = getRecentCongregants_("dashboard");
  const mobileSeasonSessionsCount = focusSeason
    ? Number(focusSeason.sessionsCount || getSessions(focusSeason.id).length || 0)
    : Number(latestSeason?.sessionsCount || getSessions(latestSeason?.id || '').length || 0);
  const seasonStatsLabel = focusSeason
    ? `${focusSeason.name} | ${focusSeason.sessionsCount || 0} sesiones`
    : 'Selecciona una temporada para ver el resumen ejecutivo';
  const dashboardGroupOptions = renderOptions(
    state.catalogs.groups.map((group) => ({
      value: String(group.id),
      label: `${group.name} (${group.id})`
    })),
    selectedGroupId,
    'Selecciona grupo'
  );

  return `
    <section class="view-grid">
      ${renderDashboardMobileHero_({
        seasonName: focusSeason ? focusSeason.name : (latestSeason ? latestSeason.name : 'Sin temporada'),
        sessionsCount: mobileSeasonSessionsCount,
        activeSessionName: activeSession ? activeSession.name : 'Sin sesion',
        groupsPending: today.groupsPending || 0,
        attendanceRate: today.attendanceRate || seasonal.attendanceRate || 0,
        activeSessionOpen: Boolean(activeSession)
      })}

      <article class="panel-card dashboard-toolbar-card module-section-anchor" id="dashboard-toolbar">
        <div class="panel-head">
          <div>
            <h2>Dashboard ejecutivo</h2>
            <p>Consulta temporada, revisa grupos y exporta cortes para pastor y lideres.</p>
          </div>
          <div class="dashboard-toolbar-actions">
            <button class="btn btn-secondary" data-action="refresh-dashboard-executive">Actualizar</button>
            <button class="btn btn-primary" data-action="export-dashboard-ranking" ${groupsRanking.length ? '' : 'disabled'}>Exportar ranking</button>
          </div>
        </div>

        <div class="field-grid two dashboard-filter-grid">
          ${renderSeasonSelect('dashboard-season', state.filters.dashboard.seasonId)}
          <div class="field">
            <label for="dashboard-group">Consulta para lideres</label>
            <select id="dashboard-group">
              ${dashboardGroupOptions}
            </select>
            <span class="field-help">Elige un grupo para ver su detalle y exportarlo.</span>
          </div>

          <div class="field">
            <label>Periodo de nuevos congregantes</label>
            <div class="inline-date-range">
              <input id="dashboard-recent-from" type="date" value="${escapeHtml(state.filters.dashboard.recentFrom)}">
              <input id="dashboard-recent-to" type="date" value="${escapeHtml(state.filters.dashboard.recentTo)}">
            </div>
            <span class="field-help">Usa este rango para el bloque de crecimiento reciente.</span>
          </div>
        </div>

        <div class="summary-strip">
          <span class="context-item"><strong>Temporada analizada:</strong> ${focusSeason ? escapeHtml(focusSeason.name) : 'Sin temporada'}</span>
          <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(seasonMatrix?.sessions?.length || focusSeason?.sessionsCount || 0))}</span>
          <span class="context-item"><strong>Generado:</strong> ${escapeHtml(executive ? formatDateTime_(executive.generatedAt) : 'Cargando...')}</span>
        </div>

        <div class="actions-row dashboard-filter-actions">
          <button class="btn btn-secondary" data-action="set-dashboard-period" data-days="30">Ultimo mes</button>
          <button class="btn btn-ghost" data-action="set-dashboard-period" data-days="90">Ultimos 3 meses</button>
          <button class="btn btn-primary" data-action="load-dashboard-group-query" ${state.filters.dashboard.groupId ? '' : 'disabled'}>Consultar grupo</button>
          <button class="btn btn-secondary" data-action="export-dashboard-group-detail" ${state.filters.dashboard.groupId ? '' : 'disabled'}>Exportar grupo</button>
          <button class="btn btn-ghost" data-action="clear-dashboard-group-query" ${state.filters.dashboard.groupId || state.dashboardLeaderDetail ? '' : 'disabled'}>Limpiar consulta</button>
        </div>
      </article>

      <article class="detail-card dashboard-season-matrix-card">
        <div class="panel-head">
          <div>
            <h2>Grupos por sesion</h2>
            <p>Consulta vital para Pastor: cada celda muestra el total del grupo en la sesion y su composicion entre voluntarios y congregantes. Toca un grupo para abrir su detalle.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(seasonMatrix?.groups?.length || 0))} grupos</span>
        </div>

        ${seasonMatrix ? `
          <div class="summary-strip">
            <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(seasonMatrix.seasonName || focusSeason?.name || "Sin temporada")}</span>
            <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(seasonMatrix.sessions.length || 0))}</span>
            <span class="context-item"><strong>Clave:</strong> Total = Voluntarios + Congregantes</span>
          </div>

          <div class="table-wrap season-matrix-wrap">
            <table class="season-matrix-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  ${seasonMatrix.sessions.map((session) => `
                    <th>${escapeHtml(session.shortLabel || session.name)}</th>
                  `).join("")}
                </tr>
              </thead>
              <tbody>
                ${seasonMatrix.groups.length ? seasonMatrix.groups.map((group) => `
                  <tr>
                    <td>
                      <button
                        class="season-matrix-group-button"
                        data-action="open-dashboard-session-group"
                        data-group-id="${escapeHtml(String(group.groupId || ""))}"
                        type="button"
                      >
                        <span class="row-title">${escapeHtml(group.groupName)}</span>
                        <span class="row-meta">Grupo ${escapeHtml(String(group.groupId))}</span>
                      </button>
                    </td>
                    ${group.sessions.map((cell) => `
                      <td>
                        <div class="season-matrix-cell">
                          <strong>${escapeHtml(String(cell.total || 0))}</strong>
                          <span>${escapeHtml(`${cell.volunteers || 0} V + ${cell.congregants || 0} C`)}</span>
                        </div>
                      </td>
                    `).join("")}
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="${Math.max((seasonMatrix.sessions.length || 0) + 1, 2)}">
                      <div class="empty-state">Aun no hay participantes cargados en esta temporada.</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">Estamos preparando la matriz de grupos por sesion para esta temporada.</div>
        `}
      </article>

      <div class="stats-grid dashboard-stats-grid">
        <article class="stat-card">
          <span class="status-chip neutral">Padron activo</span>
          <strong>${escapeHtml(String(totals.activePeople || peopleCount || 0))}</strong>
          <span>Personas activas listas para seguimiento pastoral</span>
        </article>

        <article class="stat-card">
          <span class="status-chip dark">Liderazgo</span>
          <strong>${escapeHtml(String(totals.leadership || 0))}</strong>
          <span>${escapeHtml(String(pastor.leadershipRatio || 0))}% del padron activo esta en coordinacion o liderazgo</span>
        </article>

        <article class="stat-card">
          <span class="status-chip success">Asistencia temporada</span>
          <strong>${escapeHtml(String(seasonal.attendanceRate || 0))}%</strong>
          <span>${escapeHtml(seasonStatsLabel)}</span>
        </article>

        <article class="stat-card">
          <span class="status-chip ${today.found ? (today.groupsPending ? 'warning' : 'success') : 'warning'}">
            ${today.found ? 'Pendientes hoy' : 'Sesion no detectada'}
          </span>
          <strong>${escapeHtml(String(today.groupsPending || 0))}</strong>
          <span>${today.found ? `${today.groupsCaptured || 0} de ${today.totalGroups || 0} grupos ya capturaron` : 'Abre una sesion para usar control operativo'}</span>
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="hero-card dashboard-activity-card dashboard-executive-card">
          <div class="panel-head">
            <div>
              <h2>Indicadores para Pastor</h2>
              <p>Vista rapida de crecimiento, cobertura y avance.</p>
            </div>
            ${focusSeason ? renderPill(focusSeason.status) : `<span class="pill warning">Sin temporada</span>`}
          </div>

          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Nuevos este mes</span>
              <strong>${escapeHtml(String(pastor.newPeopleThisMonth || 0))}</strong>
              <span>Altas activas durante el mes actual.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip dark">Progreso de captura</span>
              <strong>${escapeHtml(String(seasonal.captureProgress || 0))}%</strong>
              <span>${escapeHtml(String(seasonal.capturedSessionGroups || 0))} de ${escapeHtml(String(seasonal.totalSessionGroups || 0))} capturas temporada-grupo.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Grupos fuertes</span>
              <strong>${escapeHtml(String(pastor.strongGroups || 0))}</strong>
              <span>Grupos con asistencia acumulada igual o superior al 70%.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip warning">Grupos a vigilar</span>
              <strong>${escapeHtml(String(pastor.watchGroups || 0))}</strong>
              <span>Grupos con asistencia acumulada menor al 50%.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Personas unicas</span>
              <strong>${escapeHtml(String(seasonal.uniquePeople || 0))}</strong>
              <span>Participantes distintos involucrados en la temporada analizada.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip dark">Sesiones capturadas</span>
              <strong>${escapeHtml(String(seasonal.sessionsCaptured || 0))}/${escapeHtml(String(seasonal.sessionsCount || 0))}</strong>
              <span>Sesiones con al menos una captura registrada.</span>
            </div>
          </div>
        </article>

        <article class="panel-card dashboard-shortcuts-card dashboard-ops-card">
          <div class="panel-head">
            <div>
              <h2>Operacion del dia</h2>
              <p>Revisa en segundos si hoy ya capturaste o si aun hay pendientes.</p>
            </div>
            ${today.found ? `<span class="pill ${today.groupsPending ? 'warning' : 'success'}">${today.session ? escapeHtml(today.session.name) : 'Sesion activa'}</span>` : `<span class="pill warning">Sin sesion</span>`}
          </div>

          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Participantes hoy</span>
              <strong>${escapeHtml(String(today.totalParticipants || 0))}</strong>
              <span>Total esperado entre todos los grupos de la sesion activa.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Presentes hoy</span>
              <strong>${escapeHtml(String(today.presentCount || 0))}</strong>
              <span>${escapeHtml(String(today.attendanceRate || 0))}% de asistencia sobre los participantes cargados.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip warning">Grupos pendientes</span>
              <strong>${escapeHtml(String(today.groupsPending || 0))}</strong>
              <span>${today.pendingGroupNames && today.pendingGroupNames.length ? escapeHtml(today.pendingGroupNames.join(', ')) : 'Sin pendientes visibles'}</span>
            </div>
          </div>
        </article>
      </div>

      <article class="detail-card dashboard-ranking-card module-section-anchor" id="dashboard-ranking">
        <div class="panel-head">
          <div>
            <h2>Ranking de grupos por temporada</h2>
            <p>Comparativo rapido para detectar constancia y alertas.</p>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Personas</th>
                <th>Asistencia</th>
                <th>Sesiones capturadas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${topGroups.length ? topGroups.map((group) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(group.groupName)}</span>
                    <span class="row-meta">${escapeHtml(String(group.groupId))}</span>
                  </td>
                  <td>${escapeHtml(String(group.uniquePeople || 0))}</td>
                  <td>${escapeHtml(String(group.attendanceRate || 0))}%</td>
                  <td>${escapeHtml(String(group.sessionsCaptured || 0))}/${escapeHtml(String(group.totalSessions || 0))}</td>
                  <td>${renderPill(group.status)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5">
                    <div class="empty-state">Todavia no hay actividad suficiente para construir el ranking ejecutivo.</div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      <div class="view-grid columns-2 dashboard-leader-grid module-section-anchor" id="dashboard-leaders">
        <article class="panel-card dashboard-leader-query-card">
          <div class="panel-head">
            <div>
              <h2>Consulta para lideres</h2>
              <p>Selecciona un grupo para revisar su avance y exportarlo.</p>
            </div>
            ${selectedGroupRow ? renderPill(selectedGroupRow.status) : `<span class="pill dark">Sin grupo</span>`}
          </div>

          ${selectedGroupRow ? `
            <div class="summary-stack dashboard-summary-grid">
              <div class="summary-box">
                <span class="status-chip neutral">Grupo</span>
                <strong>${escapeHtml(selectedGroupRow.groupName)}</strong>
                <span>${escapeHtml(String(selectedGroupRow.groupId))}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Asistencia</span>
                <strong>${escapeHtml(String(selectedGroupRow.attendanceRate || 0))}%</strong>
                <span>${escapeHtml(String(selectedGroupRow.attendanceYes || 0))} asistencias positivas sobre ${escapeHtml(String(selectedGroupRow.attendanceRecords || 0))} registros.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Personas</span>
                <strong>${escapeHtml(String(selectedGroupRow.uniquePeople || 0))}</strong>
                <span>${escapeHtml(String(selectedGroupRow.participantAssignments || 0))} asignaciones acumuladas en la temporada.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Captura</span>
                <strong>${escapeHtml(String(selectedGroupRow.sessionsCaptured || 0))}/${escapeHtml(String(selectedGroupRow.totalSessions || 0))}</strong>
                <span>${escapeHtml(String(selectedGroupRow.captureProgress || 0))}% de sesiones del grupo ya quedaron capturadas.</span>
              </div>
            </div>
          ` : `
            <div class="empty-state">Elige un grupo arriba para abrir la consulta.</div>
          `}
        </article>

        <article class="panel-card dashboard-leader-roster-card">
          <div class="panel-head">
            <div>
              <h2>Personas destacadas del grupo</h2>
              <p>Top de constancia dentro del grupo consultado.</p>
            </div>
          </div>

          ${leaderSummary ? `
            <div class="results-list dashboard-leader-list">
              ${leaderSummary.topPeople.length ? leaderSummary.topPeople.map((person) => `
                <article class="result-card">
                  <div class="result-row">
                    <div class="result-copy-stack">
                      <span class="row-title">${escapeHtml(person.name)}</span>
                      <span class="row-meta">${escapeHtml(person.personId)} | ${escapeHtml(String(person.totalPresent || 0))} asistencias SI</span>
                      <span class="row-meta">${escapeHtml(String(leaderSummary.totalSessions))} sesiones en el periodo consultado.</span>
                    </div>
                    <span class="pill dark">${escapeHtml(String(person.attendanceRate))}%</span>
                  </div>
                </article>
              `).join('') : `
                <div class="empty-state">El grupo seleccionado todavia no tiene historial suficiente.</div>
              `}
            </div>
          ` : `
            <div class="empty-state">Cuando consultes un grupo veras su top de constancia y estado general.</div>
          `}
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="detail-card dashboard-recent-people-card">
          <div class="panel-head">
            <div>
              <h2>Nuevos congregantes</h2>
              <p>Seguimiento rapido de crecimiento reciente con periodo editable.</p>
            </div>
            <span class="pill ${recentCongregants.length ? "success" : "warning"}">${escapeHtml(String(recentCongregants.length))} en periodo</span>
          </div>

          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Periodo</span>
              <strong>${escapeHtml(formatDate(state.filters.dashboard.recentFrom) || state.filters.dashboard.recentFrom || "-")}</strong>
              <span>Hasta ${escapeHtml(formatDate(state.filters.dashboard.recentTo) || state.filters.dashboard.recentTo || "-")}</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Con telefono</span>
              <strong>${escapeHtml(String(recentCongregants.filter((row) => String(row.telefono || "").trim()).length))}</strong>
              <span>Listos para contacto o bienvenida.</span>
            </div>
          </div>

          <div class="results-list dashboard-recent-people-list">
            ${recentCongregants.length ? recentCongregants.slice(0, 8).map((person) => `
              <article class="result-card">
                <div class="result-row">
                  <div class="result-copy-stack">
                    <span class="row-title">${escapeHtml(person.nombreCompleto || person.nombre || "Sin nombre")}</span>
                    <span class="row-meta">${escapeHtml(person.telefono || "Sin telefono")} | ${escapeHtml(person.estadoCivil || "Sin estado civil")}</span>
                    <span class="row-meta">Nacimiento: ${escapeHtml(formatDate(person.fechaNacimiento) || "Sin fecha")} | Alta: ${escapeHtml(formatDate(person.fechaIngreso) || "Sin fecha")}</span>
                  </div>
                  <span class="pill dark">${escapeHtml(String(person.edad || "S/D"))}</span>
                </div>
              </article>
            `).join("") : `
              <div class="empty-state">No hay congregantes nuevos en el rango seleccionado.</div>
            `}
          </div>

          <div class="actions-row">
            <button class="btn btn-secondary" data-action="navigate" data-view="congregants-new">Abrir consulta completa</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

function getDashboardPeopleCount_() {
  if (state.metrics.peopleCount !== null && state.metrics.peopleCount !== undefined) {
    return String(state.metrics.peopleCount);
  }

  if (state.people.length) {
    return String(state.people.length);
  }

  return "...";
}

function buildDashboardLeaderSummary_(groupAggregate, detail) {
  if (!groupAggregate || !detail) {
    return null;
  }

  const totalSessions = Number(groupAggregate.totalSessions || detail?.totalSessions || 0);
  const topPeople = Array.isArray(detail?.people)
    ? detail.people
      .map((person) => ({
        ...person,
        attendanceRate: totalSessions ? Math.round(((Number(person.totalPresent || 0)) / totalSessions) * 100) : 0
      }))
      .sort((left, right) => {
        if (right.totalPresent !== left.totalPresent) {
          return right.totalPresent - left.totalPresent;
        }

        return normalizeText(left.name).localeCompare(normalizeText(right.name), "es");
      })
      .slice(0, 8)
    : [];

  return {
    totalSessions,
    topPeople
  };
}

function getDashboardSelectedGroupRow_() {
  const groupsRanking = state.dashboardExecutive?.groupsRanking || [];
  const selectedGroupId = state.filters.dashboard.groupId;
  return groupsRanking.find((group) => String(group.groupId) === String(selectedGroupId)) || null;
}

function buildDashboardSeasonMatrix_({ seasonId, seasonName, sessions, sessionGroupsBySession, participantsBySession }) {
  const groupMap = new Map();

  (sessions || []).forEach((session) => {
    const sessionGroups = sessionGroupsBySession[String(session.id)] || [];

    sessionGroups.forEach((group) => {
      const groupId = String(group.groupId || "");

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          groupName: group.groupName || resolveGroupName_(groupId) || `Grupo ${groupId}`,
          cells: {}
        });
      }
    });
  });

  (sessions || []).forEach((session) => {
    const sessionId = String(session.id || "");
    const rows = participantsBySession[sessionId] || [];

    rows.forEach((participant) => {
      const groupId = String(participant.groupId || "");
      const typeKey = getPersonTypeKey_(participant.type || "");
      let group = groupMap.get(groupId);

      if (!group) {
        group = {
          groupId,
          groupName: resolveGroupName_(groupId) || `Grupo ${groupId}`,
          cells: {}
        };
        groupMap.set(groupId, group);
      }

      if (!group.cells[sessionId]) {
        group.cells[sessionId] = {
          total: 0,
          volunteers: 0,
          congregants: 0
        };
      }

      group.cells[sessionId].total += 1;

      if (typeKey === "congregante") {
        group.cells[sessionId].congregants += 1;
      } else {
        group.cells[sessionId].volunteers += 1;
      }
    });
  });

  return {
    key: String(seasonId || ""),
    seasonId: String(seasonId || ""),
    seasonName: seasonName || resolveSeasonName_(seasonId) || "",
    sessions: (sessions || []).map((session) => ({
      id: session.id,
      name: session.name,
      shortLabel: session.number ? `S${session.number}` : session.name,
      date: session.date
    })),
    groups: Array.from(groupMap.values())
      .map((group) => ({
        groupId: group.groupId,
        groupName: group.groupName,
        sessions: (sessions || []).map((session) => {
          const cell = group.cells[String(session.id)] || {
            total: 0,
            volunteers: 0,
            congregants: 0
          };

          return {
            sessionId: session.id,
            ...cell
          };
        })
      }))
      .sort((left, right) => normalizeText(left.groupName).localeCompare(normalizeText(right.groupName), "es"))
  };
}

function invalidateDashboardSeasonMatrix_() {
  state.dashboardSeasonMatrix = null;
  state.cacheKeys.dashboardSeasonMatrix = "";
}

function buildDashboardSessionInsights_({ seasonId, sessionId, sessionGroups, participants, attendances }) {
  const session = getSessions(seasonId).find((item) => String(item.id) === String(sessionId)) || null;
  const peopleById = new Map();
  const groupsMap = new Map();
  const attendanceMap = new Map();

  state.peopleDirectory.forEach((person) => {
    peopleById.set(String(person.id), person);
  });

  (sessionGroups || []).forEach((group) => {
    groupsMap.set(String(group.groupId), {
      groupId: String(group.groupId),
      groupName: group.groupName || resolveGroupName_(group.groupId) || `Grupo ${group.groupId}`,
      total: 0,
      congregants: 0,
      volunteers: 0,
      present: 0,
      rate: 0
    });
  });

  (attendances || []).forEach((attendance) => {
    if (String(attendance.attended || "").toUpperCase() === "SI") {
      attendanceMap.set(`${attendance.groupId}::${attendance.personId}`, true);
    }
  });

  (participants || []).forEach((participant) => {
    const groupId = String(participant.groupId || "");
    const personId = String(participant.personId || "");
    const sourcePerson = peopleById.get(personId) || {};
    const typeKey = getPersonTypeKey_(participant.type || sourcePerson.tipoPersona || "");
    const group = groupsMap.get(groupId) || {
      groupId,
      groupName: resolveGroupName_(groupId) || `Grupo ${groupId}`,
      total: 0,
      congregants: 0,
      volunteers: 0,
      present: 0,
      rate: 0
    };

    group.total += 1;

    if (typeKey === "congregante") {
      group.congregants += 1;
    } else {
      group.volunteers += 1;
    }

    if (attendanceMap.has(`${groupId}::${personId}`)) {
      group.present += 1;
    }

    groupsMap.set(groupId, group);
  });

  const groups = Array.from(groupsMap.values())
    .map((group) => ({
      ...group,
      rate: group.total ? Math.round((group.present / group.total) * 100) : 0
    }))
    .sort((left, right) => {
      if (right.rate !== left.rate) {
        return right.rate - left.rate;
      }

      if (right.present !== left.present) {
        return right.present - left.present;
      }

      return normalizeText(left.groupName).localeCompare(normalizeText(right.groupName), "es");
    });

  const totalParticipants = groups.reduce((sum, group) => sum + group.total, 0);
  const totalPresent = groups.reduce((sum, group) => sum + group.present, 0);

  return {
    key: `${seasonId}::${sessionId}`,
    seasonId,
    sessionId,
    sessionName: session?.name || sessionId,
    groups,
    totalParticipants,
    totalPresent,
    attendanceRate: totalParticipants ? Math.round((totalPresent / totalParticipants) * 100) : 0
  };
}

function getRecentCongregants_(scope = "congregants") {
  const filter = scope === "dashboard" ? state.filters.dashboard : state.filters.congregants;
  const fromDate = parseDateToTimestamp_(filter.recentFrom, false);
  const toDate = parseDateToTimestamp_(filter.recentTo, true);

  return state.peopleDirectory
    .filter((person) => {
      const typeKey = getPersonTypeKey_(person.tipoPersona || "");
      const status = String(person.estado || "").toUpperCase();
      const joinedAt = parseDateToTimestamp_(person.fechaIngreso, true);

      if (typeKey !== "congregante") {
        return false;
      }

      if (status && status !== "ACTIVO") {
        return false;
      }

      if (!joinedAt) {
        return false;
      }

      if (fromDate && joinedAt < fromDate) {
        return false;
      }

      if (toDate && joinedAt > toDate) {
        return false;
      }

      return true;
    })
    .sort((left, right) => parseDateToTimestamp_(right.fechaIngreso, true) - parseDateToTimestamp_(left.fechaIngreso, true));
}

function buildCsvText_(rows) {
  return rows.map((row) => row.map(toCsvValue_).join(",")).join("\n");
}

function downloadCsvTextFile_(csvText, fileName) {
  const blob = new Blob(["\ufeff", csvText], {
    type: "text/csv;charset=utf-8"
  });
  downloadBlob_(blob, fileName);
}

function buildDashboardExportFileName_(prefix, label) {
  const safeLabel = label ? `_${sanitizeFileNamePart_(label)}` : "";
  return `${prefix}_${formatTimestampToken_()}${safeLabel}.csv`;
}

function buildDashboardRankingCsv_() {
  const executive = state.dashboardExecutive;
  const groupsRanking = executive?.groupsRanking || [];
  const seasonName = executive?.seasonFocus?.name || "Sin temporada";
  const rows = [[
    "TEMPORADA",
    "GRUPO_ID",
    "GRUPO",
    "PERSONAS",
    "ASIGNACIONES",
    "ASISTENCIAS_SI",
    "REGISTROS_ASISTENCIA",
    "PORCENTAJE_ASISTENCIA",
    "SESIONES_CAPTURADAS",
    "TOTAL_SESIONES",
    "PROGRESO_CAPTURA",
    "ESTADO"
  ]];

  groupsRanking.forEach((group) => {
    rows.push([
      seasonName,
      group.groupId || "",
      group.groupName || "",
      group.uniquePeople || 0,
      group.participantAssignments || 0,
      group.attendanceYes || 0,
      group.attendanceRecords || 0,
      `${group.attendanceRate || 0}%`,
      group.sessionsCaptured || 0,
      group.totalSessions || 0,
      `${group.captureProgress || 0}%`,
      group.status || ""
    ]);
  });

  return buildCsvText_(rows);
}

function buildDashboardGroupDetailCsv_() {
  const executive = state.dashboardExecutive;
  const detail = state.dashboardLeaderDetail;
  const selectedGroupRow = getDashboardSelectedGroupRow_();
  const sessions = Array.isArray(detail?.sessions) ? detail.sessions : [];
  const seasonName = executive?.seasonFocus?.name || resolveSeasonName_(detail?.seasonId) || "Sin temporada";
  const groupId = selectedGroupRow?.groupId || detail?.groupId || state.filters.dashboard.groupId || "";
  const groupName = selectedGroupRow?.groupName || resolveGroupName_(groupId) || `Grupo ${groupId}`;
  const rows = [[
    "TEMPORADA",
    "GRUPO_ID",
    "GRUPO",
    "PERSONA_ID",
    "NOMBRE",
    "TOTAL_SI",
    "PORCENTAJE_ASISTENCIA",
    ...sessions.map((session) => session.name || session.id || "Sesion")
  ]];

  (detail?.people || []).forEach((person) => {
    const attendanceRate = sessions.length
      ? Math.round((Number(person.totalPresent || 0) / sessions.length) * 100)
      : 0;

    rows.push([
      seasonName,
      groupId,
      groupName,
      person.personId || "",
      person.name || "",
      person.totalPresent || 0,
      `${attendanceRate}%`,
      ...sessions.map((session) => person.attendances?.[session.name] || "")
    ]);
  });

  return buildCsvText_(rows);
}

function renderAssistantsView() {
  const filter = state.filters.assistants;
  const summary = buildPeopleDirectorySummary_();
  const rows = getFilteredPeopleDirectory_();
  const credentialPreviewRows = rows.slice(0, CREDENTIAL_PREVIEW_LIMIT);
  const importSummary = state.peopleImport.summary;
  const importProgress = state.peopleImport.progress;
  const previewRows = state.peopleImport.rows.slice(0, 6);
  const invalidPreviewRows = state.peopleImport.rows.filter((row) => row.errors.length).slice(0, 4);
  const groupOptions = renderOptions(
    state.catalogs.groups.map((group) => ({
      value: String(group.id),
      label: `${group.name} (${group.id})`
    })),
    "",
    "Selecciona grupo base"
  );

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "assistants",
        eyebrow: "Padron y QR",
        title: "Alta, importacion y credenciales",
        copy: "Entra directo a la tarea del momento.",
        badge: {
          label: `${summary.active} activos`,
          kind: "dark"
        },
        metrics: [
          { label: "Padron", value: String(summary.total) },
          { label: "Congregantes", value: String(summary.congregants) },
          { label: "Voluntarios", value: String(summary.servers) },
          { label: "Filtrados", value: String(rows.length) },
          { label: "Importacion", value: importSummary ? `${importSummary.validRows} listas` : "Sin archivo" }
        ],
        actions: [
          { label: "Alta", variant: "primary", sectionId: "assistants-create" },
          { label: "Importar", variant: "secondary", sectionId: "assistants-import" },
          { label: "Credenciales", variant: "ghost", sectionId: "assistants-credentials" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip neutral">Padron total</span>
          <strong>${escapeHtml(String(summary.total))}</strong>
          <span>Registros cargados en la base general</span>
        </article>

        <article class="stat-card">
          <span class="status-chip success">Congregantes</span>
          <strong>${escapeHtml(String(summary.congregants))}</strong>
          <span>Personas base de la congregacion</span>
        </article>

        <article class="stat-card">
          <span class="status-chip neutral">Voluntarios</span>
          <strong>${escapeHtml(String(summary.servers))}</strong>
          <span>Registros con rol activo de servicio</span>
        </article>

        <article class="stat-card">
          <span class="status-chip neutral">Liderazgo</span>
          <strong>${escapeHtml(String(summary.leadership))}</strong>
          <span>Coordinadores y lideres cargados</span>
        </article>
      </div>

      <div class="view-grid columns-2 assistants-mobile-grid">
        <article class="panel-card module-section-anchor assistants-create-card" id="assistants-create">
          <div class="panel-head">
            <div>
              <h2>Alta individual</h2>
              <p>Da de alta una persona nueva desde esta misma pantalla y dejala lista para asignarla a grupos.</p>
            </div>
          </div>

          <form id="assistant-create-form">
            <div class="field-grid two">
              <div class="field">
                <label for="assistant-nombre">Nombre</label>
                <input id="assistant-nombre" name="nombre" placeholder="Pedro" required>
              </div>

              <div class="field">
                <label for="assistant-apellidos">Apellidos</label>
                <input id="assistant-apellidos" name="apellidos" placeholder="Gutierrez" required>
              </div>

              <div class="field">
                <label for="assistant-telefono">Telefono</label>
                <input id="assistant-telefono" name="telefono" placeholder="5551234567">
              </div>

              <div class="field">
                <label for="assistant-email">Email</label>
                <input id="assistant-email" name="email" type="email" placeholder="correo@iglesia.com">
              </div>

              <div class="field">
                <label for="assistant-grupo">Grupo base</label>
                <select id="assistant-grupo" name="grupo">
                  ${groupOptions}
                </select>
              </div>

              <div class="field">
                <label for="assistant-fecha">Fecha de ingreso</label>
                <input id="assistant-fecha" name="fechaIngreso" type="date" value="${escapeHtml(formatDateForInput_(new Date()))}">
              </div>

              <div class="field">
                <label for="assistant-tipo">Tipo de persona</label>
                <select id="assistant-tipo" name="tipoPersona">
                  ${PERSON_TYPE_OPTIONS.map((type) => `
                    <option value="${escapeHtml(type)}" ${type === "Congregante" ? "selected" : ""}>${escapeHtml(getPersonTypeDisplayLabel_(type))}</option>
                  `).join("")}
                </select>
              </div>

              <div class="field">
                <label for="assistant-estado">Estado</label>
                <select id="assistant-estado" name="estado">
                  <option value="ACTIVO" selected>ACTIVO</option>
                  <option value="BAJA">BAJA</option>
                </select>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Guardar congregante</button>
              <button class="btn btn-ghost" type="button" data-action="refresh-assistants">Actualizar padron</button>
            </div>
          </form>
        </article>

        <article class="panel-card module-section-anchor assistants-import-card" id="assistants-import">
          <div class="panel-head">
            <div>
              <h2>Importacion desde Excel</h2>
              <p>Sube un archivo del padron, valida columnas y guarda registros nuevos o actualizaciones sin duplicar.</p>
            </div>
            ${importSummary ? `<span class="pill dark">${escapeHtml(String(importSummary.validRows))} listos</span>` : ""}
          </div>

          <div class="import-dropzone">
            <strong>${escapeHtml(state.peopleImport.fileName || "Carga tu archivo Excel")}</strong>
            <p>
              Usa <code>.xlsx</code>, <code>.xls</code> o <code>.csv</code>. La plantilla recomendada contiene:
              <code>NOMBRE</code>, <code>APELLIDOS</code>, <code>TELEFONO</code>, <code>EMAIL</code>, <code>GRUPO</code>, <code>FECHA</code>, <code>TIPO_PERSONA</code>.
              Tipos validos: <code>Congregante</code>, <code>Voluntario</code>, <code>Coordinador</code> y <code>Lider</code>.
            </p>
            <div class="actions-row">
              <button class="btn btn-secondary" type="button" data-action="download-people-template">Descargar plantilla</button>
              <button class="btn btn-primary" type="button" data-action="open-people-import">Seleccionar archivo</button>
              <button class="btn btn-ghost" type="button" data-action="clear-people-import" ${state.peopleImport.rows.length || state.peopleImport.fileName ? "" : "disabled"}>Limpiar</button>
            </div>
            <input id="people-import-file" type="file" accept=".xlsx,.xls,.csv" class="hidden">
          </div>

          ${importSummary ? `
            <div class="summary-strip" style="margin-top: 18px;">
              <span class="context-item"><strong>Total filas:</strong> ${escapeHtml(String(importSummary.totalRows))}</span>
              <span class="context-item"><strong>Validas:</strong> ${escapeHtml(String(importSummary.validRows))}</span>
              <span class="context-item"><strong>Invalidas:</strong> ${escapeHtml(String(importSummary.invalidRows))}</span>
              <span class="context-item"><strong>Nuevas:</strong> ${escapeHtml(String(importSummary.createRows))}</span>
              <span class="context-item"><strong>Actualizan:</strong> ${escapeHtml(String(importSummary.updateRows))}</span>
            </div>
          ` : `
            <p class="footer-note" style="margin-top: 16px;">
              Cuando cargues un archivo veras una vista previa antes de iniciar la importacion.
            </p>
          `}

          ${importProgress ? `
            <div class="import-progress-card">
              <span class="status-chip ${importProgress.failed ? "warning" : "success"}">${escapeHtml(importProgress.phase)}</span>
              <strong>${escapeHtml(`${importProgress.processed}/${importProgress.total}`)} procesados</strong>
              <span class="row-meta">
                Creados: ${escapeHtml(String(importProgress.created))} | Actualizados: ${escapeHtml(String(importProgress.updated))} | Fallidos: ${escapeHtml(String(importProgress.failed))}
              </span>
            </div>
          ` : ""}

          ${invalidPreviewRows.length ? `
            <div class="import-alert-list">
              ${invalidPreviewRows.map((row) => `
                <div class="import-alert-item">
                  <strong>Fila ${escapeHtml(String(row.rowNumber))}</strong>
                  <span>${escapeHtml(row.errors.join(" | "))}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}

          ${previewRows.length ? `
            <div class="table-wrap" style="margin-top: 18px;">
              <table class="compact-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Grupo</th>
                    <th>Operacion</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewRows.map((row) => `
                    <tr>
                      <td>${escapeHtml(String(row.rowNumber))}</td>
                      <td>
                        <span class="row-title">${escapeHtml(row.payload.nombreCompleto)}</span>
                        <span class="row-meta">${escapeHtml(row.payload.email || row.payload.telefono || "Sin email o telefono")}</span>
                      </td>
                      <td>${renderPersonTypePill_(row.payload.tipoPersona)}</td>
                      <td>${escapeHtml(resolveGroupName_(row.payload.grupo) || row.payload.grupo || "-")}</td>
                      <td>${row.errors.length ? renderPersonImportOperationPill_("error") : renderPersonImportOperationPill_(row.operation)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : ""}

          <div class="actions-row">
            <button class="btn btn-primary" type="button" data-action="start-people-import" ${importSummary && importSummary.validRows ? "" : "disabled"}>Importar registros</button>
          </div>
        </article>
      </div>

      <article class="detail-card module-section-anchor" id="assistants-directory">
        <div class="panel-head">
          <div>
            <h2>Padron de personas</h2>
            <p>Busca congregantes o voluntarios ya cargados y revisa rapidamente su informacion base.</p>
          </div>
          <button class="btn btn-secondary" data-action="refresh-assistants">Actualizar listado</button>
        </div>

        <div class="field-grid directory-filter-grid">
          <div class="field">
            <label for="assistants-search">Buscar</label>
            <input id="assistants-search" value="${escapeHtml(filter.search)}" placeholder="Nombre, QR ID, numero, email o telefono">
          </div>

          <div class="field">
            <label for="assistants-status">Estado</label>
            <select id="assistants-status">
              ${renderOptions([
                { value: "ALL", label: "Todos los estados" },
                { value: "ACTIVO", label: "ACTIVO" },
                { value: "BAJA", label: "BAJA" }
              ], filter.status, "Filtrar estado")}
            </select>
          </div>

          <div class="field">
            <label for="assistants-type">Tipo</label>
            <select id="assistants-type">
              ${renderOptions([
                { value: "ALL", label: "Todos los tipos" },
                ...PERSON_TYPE_OPTIONS.map((type) => ({
                  value: type,
                  label: getPersonTypeDisplayLabel_(type)
                }))
              ], filter.type, "Filtrar tipo")}
            </select>
          </div>
        </div>

        ${rows.length ? `
          <div class="table-wrap" style="margin-top: 18px;">
            <table>
              <thead>
                <tr>
                  <th>Numero congregante</th>
                  <th>Persona</th>
                  <th>Tipo</th>
                  <th>Grupo</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((person) => `
                  <tr>
                    <td>${escapeHtml(person.numero || "-")}</td>
                    <td>
                      <span class="row-title">${escapeHtml(person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "-")}</span>
                      <span class="row-meta">No. ${escapeHtml(person.numero || "-")} | QR ${escapeHtml(person.id || "-")}</span>
                      <span class="row-meta">Ingreso ${escapeHtml(formatDate(person.fechaIngreso) || "-")}</span>
                    </td>
                    <td>${renderPersonTypePill_(person.tipoPersona)}</td>
                    <td>${escapeHtml(resolveGroupName_(person.grupo) || person.grupo || "-")}</td>
                    <td>
                      <span class="row-title">${escapeHtml(person.telefono || "Sin telefono")}</span>
                      <span class="row-meta">${escapeHtml(person.email || "Sin email")}</span>
                    </td>
                    <td>${renderPill(person.estado)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">
            No hay registros que coincidan con los filtros actuales. Puedes crear uno nuevo o importar un archivo Excel.
          </div>
        `}
      </article>

      <article class="detail-card module-section-anchor" id="assistants-credentials">
        <div class="panel-head">
          <div>
            <h2>Credenciales QR</h2>
            <p>El QR queda listo para kiosko y registro rapido. Puedes descargar un lote masivo para WhatsApp o compartir una credencial individual desde iPad o movil.</p>
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary" data-action="print-credential-preview" ${credentialPreviewRows.length ? "" : "disabled"}>Imprimir vista previa</button>
            <button class="btn btn-secondary" data-action="print-credential-batch" ${rows.length ? "" : "disabled"}>Imprimir filtradas</button>
            <button class="btn btn-primary" data-action="download-credential-batch" ${rows.length ? "" : "disabled"}>Descargar lote ZIP</button>
          </div>
        </div>

        <div class="summary-strip">
          <span class="context-item"><strong>Activos:</strong> ${escapeHtml(String(summary.active))}</span>
          <span class="context-item"><strong>Coordinadores:</strong> ${escapeHtml(String(summary.coordinators))}</span>
          <span class="context-item"><strong>Lideres:</strong> ${escapeHtml(String(summary.leaders))}</span>
          <span class="context-item"><strong>Credenciales filtradas:</strong> ${escapeHtml(String(rows.length))}</span>
          <span class="context-item"><strong>Vista previa:</strong> ${escapeHtml(String(credentialPreviewRows.length))}</span>
        </div>

        <div class="credential-ops-note">
          <strong>Flujo recomendado para WhatsApp</strong>
          <span>Primero filtra el padron, luego descarga el lote ZIP con PNG y CSV de apoyo. En iPad, iPhone o Android tambien puedes usar <strong>Compartir</strong> en cada credencial para abrir el menu nativo y elegir WhatsApp.</span>
        </div>

        ${credentialPreviewRows.length ? `
          <div class="credential-grid">
            ${credentialPreviewRows.map((person) => renderCredentialCard_(person)).join("")}
          </div>
          ${rows.length > credentialPreviewRows.length ? `
            <p class="footer-note">
              Se muestran las primeras ${escapeHtml(String(credentialPreviewRows.length))} credenciales. Usa <strong>Imprimir filtradas</strong> para sacar el lote completo.
            </p>
          ` : ""}
        ` : `
          <div class="empty-state">
            Ajusta los filtros del padron para mostrar las personas a las que quieres generar su credencial QR.
          </div>
        `}
      </article>
    </section>
  `;
}

function renderSeasonsView() {
  const selectedSeason = state.seasons.find((item) => item.id === state.filters.seasons.seasonId) || getLatestSeason();
  const sessions = selectedSeason ? getSessions(selectedSeason.id) : [];
  const sessionGroups = selectedSeason && sessions.length ? getSessionGroups(selectedSeason.id, sessions[0].id) : [];
  const activeSession = state.activeSession && state.activeSession.found ? state.activeSession.session : null;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "seasons",
        eyebrow: "Ciclo operativo",
        title: "Temporadas y sesiones",
        copy: "Crea, abre y revisa sesiones sin rodeos.",
        badge: {
          label: activeSession ? "Sesion ABIERTA hoy" : "Sin sesion hoy",
          kind: activeSession ? "success" : "warning"
        },
        metrics: [
          { label: "Temporada", value: selectedSeason ? selectedSeason.name : "Sin crear" },
          { label: "Sesiones", value: String(sessions.length) },
          { label: "Inicio", value: selectedSeason ? formatDate(selectedSeason.startDate) : "Pendiente" },
          { label: "Grupos", value: String(state.catalogs.groups.length) }
        ],
        actions: [
          { label: "Nueva", variant: "primary", sectionId: "seasons-create" },
          { label: "Temporadas", variant: "secondary", sectionId: "seasons-list" },
          { label: "Sesiones", variant: "ghost", sectionId: "seasons-sessions" }
        ]
      })}

      <div class="view-grid columns-2 seasons-mobile-grid">
        <article class="panel-card module-section-anchor seasons-create-card" id="seasons-create">
          <div class="panel-head">
            <div>
              <h2>Nueva temporada</h2>
              <p>Crea la temporada y genera automaticamente todas sus sesiones y grupos por sesion.</p>
            </div>
          </div>

          <form id="season-create-form">
            <div class="field-grid two">
              <div class="field">
                <label for="season-name">Nombre</label>
                <input id="season-name" name="name" placeholder="Primera Temporada V2" required>
              </div>

              <div class="field">
                <label for="season-year">Ano</label>
                <input id="season-year" name="year" type="number" value="${new Date().getFullYear()}" required>
              </div>

              <div class="field">
                <label for="season-sessions">Cantidad de sesiones</label>
                <input id="season-sessions" name="sessionsCount" type="number" min="1" value="8" required>
              </div>

              <div class="field">
                <label for="season-start">Fecha de inicio</label>
                <input id="season-start" name="startDate" type="date" required>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Crear temporada</button>
              <button class="btn btn-ghost" type="button" data-action="refresh-app">Recargar datos</button>
            </div>
          </form>
        </article>

        <article class="summary-card seasons-summary-card module-section-anchor" id="seasons-current">
          <div class="panel-head">
            <div>
              <h2>Resumen operativo</h2>
              <p>Lectura rapida del estado actual de la configuracion.</p>
            </div>
          </div>

          <div class="summary-stack">
            <div class="summary-box">
              <span class="status-chip neutral">Temporada seleccionada</span>
              <strong>${selectedSeason ? escapeHtml(selectedSeason.name) : "Sin temporada"}</strong>
              <span>${selectedSeason ? `${escapeHtml(formatDate(selectedSeason.startDate))} | ${escapeHtml(String(selectedSeason.sessionsCount || 0))} sesiones` : "Crea o selecciona una temporada."}</span>
            </div>

            <div class="summary-box">
              <span class="status-chip neutral">Catalogo de grupos</span>
              <strong>${state.catalogs.groups.length}</strong>
              <span>Grupos que se asignan automaticamente a cada sesion creada.</span>
            </div>

            <div class="summary-box">
              <span class="status-chip ${state.activeSession && state.activeSession.found ? "success" : "warning"}">Sesion activa de hoy</span>
              <strong>${state.activeSession && state.activeSession.found ? escapeHtml(state.activeSession.session.name) : "No activa"}</strong>
              <span>${state.activeSession && state.activeSession.found ? escapeHtml(formatDate(state.activeSession.session.date)) : "El modulo QR depende de una sesion ABIERTA en la fecha de hoy."}</span>
            </div>
          </div>
        </article>
      </div>

      <article class="panel-card module-section-anchor" id="seasons-list">
        <div class="panel-head">
          <div>
            <h2>Temporadas creadas</h2>
            <p>Selecciona una temporada para revisar sus sesiones y cambiar estados.</p>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Temporada</th>
                <th>Inicio</th>
                <th>Sesiones</th>
                <th>Estado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              ${state.seasons.length ? state.seasons.map((season) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(season.name)}</span>
                    <span class="row-meta">${escapeHtml(season.id)} | ${escapeHtml(String(season.year || ""))}</span>
                  </td>
                  <td>${escapeHtml(formatDate(season.startDate))}</td>
                  <td>${escapeHtml(String(season.sessionsCount || 0))}</td>
                  <td>${renderPill(season.status)}</td>
                  <td>
                    <button class="btn btn-secondary" data-action="select-season" data-season-id="${escapeHtml(season.id)}">Ver sesiones</button>
                  </td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="5">
                    <div class="empty-state">No hay temporadas todavia.</div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      <article class="detail-card module-section-anchor" id="seasons-sessions">
        <div class="panel-head">
          <div>
            <h2>Sesiones de la temporada</h2>
            <p>${selectedSeason ? `Estas viendo ${escapeHtml(selectedSeason.name)}.` : "Selecciona una temporada para ver las sesiones."}</p>
          </div>
          ${selectedSeason ? `<span class="pill dark">${escapeHtml(selectedSeason.id)}</span>` : ""}
        </div>

        ${selectedSeason ? `
          <div class="context-strip" style="margin-bottom: 18px;">
            <span class="context-item"><strong>Inicio:</strong> ${escapeHtml(formatDate(selectedSeason.startDate))}</span>
            <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(sessions.length))}</span>
            <span class="context-item"><strong>Grupos por sesion:</strong> ${escapeHtml(String(state.catalogs.groups.length))}</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sesion</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map((session) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(session.name)}</span>
                      <span class="row-meta">${escapeHtml(session.id)} | Numero ${escapeHtml(String(session.number || ""))}</span>
                    </td>
                    <td>${escapeHtml(formatDate(session.date))}</td>
                    <td>${renderPill(session.status)}</td>
                    <td>
                      <button
                        class="btn ${session.status === "ABIERTA" ? "btn-danger" : "btn-primary"}"
                        data-action="toggle-session-status"
                        data-season-id="${escapeHtml(selectedSeason.id)}"
                        data-session-id="${escapeHtml(session.id)}"
                        data-status="${session.status === "ABIERTA" ? "CERRADA" : "ABIERTA"}"
                      >
                        ${session.status === "ABIERTA" ? "Cerrar" : "Abrir"}
                      </button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <p class="footer-note">La primera sesion de esta temporada tiene ${sessionGroups.length} grupos ligados en la hoja de grupos por sesion.</p>
        ` : `
          <div class="empty-state">Aun no hay una temporada seleccionada.</div>
        `}
      </article>
    </section>
  `;
}

function renderParticipantsView() {
  const filter = state.filters.participants;
  const groups = getSessionGroups(filter.seasonId, filter.sessionId);
  const context = state.participantContext;
  const sessions = getSessions(filter.seasonId);
  const selectedSession = sessions.find((item) => item.id === filter.sessionId) || null;
  const selectedGroup = groups.find((group) => String(group.groupId) === String(filter.groupId)) || null;
  const participantPersonIds = getParticipantPersonIdSet_();
  const hasSingleSearch = Boolean(normalizeText(filter.peopleSearch));
  const peopleSearchResults = hasSingleSearch ? filterPeople(state.people, filter.peopleSearch).slice(0, 8) : [];
  const selectedPeople = getSelectedBulkPeople_();
  const selectedBulkSet = new Set(state.selectedBulkPeople.map((personId) => String(personId)));
  const hasBulkSearch = Boolean(normalizeText(filter.bulkSearch));
  const bulkMatches = hasBulkSearch ? filterPeople(state.people, filter.bulkSearch) : [];
  const bulkResults = bulkMatches.slice(0, 10);
  const queuedVisibleBulkCount = bulkResults.filter((person) => selectedBulkSet.has(String(person.id))).length;
  const assignedVisibleBulkCount = bulkResults.filter((person) => participantPersonIds.has(String(person.id))).length;
  const selectedAlreadyAssignedCount = selectedPeople.filter((person) => participantPersonIds.has(String(person.id))).length;
  const selectedNewCount = Math.max(selectedPeople.length - selectedAlreadyAssignedCount, 0);
  const hiddenBulkCount = Math.max(bulkMatches.length - bulkResults.length, 0);
  const serverCount = state.participants.filter((participant) => normalizeText(participant.type) === "servidor").length;
  const moveGroups = groups;
  const canBulkAssign = Boolean(filter.seasonId && filter.sessionId && filter.groupId && sessions.length && selectedPeople.length);
  const selectedGroupName = context ? context.group.name : (selectedGroup ? selectedGroup.groupName : "Sin grupo");
  const bulkAssignLabel = selectedPeople.length
    ? `Asignar ${selectedPeople.length} persona${selectedPeople.length === 1 ? "" : "s"} a ${sessions.length} sesion${sessions.length === 1 ? "" : "es"}`
    : "Selecciona personas para asignar";

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "participants",
        eyebrow: "Grupo en operacion",
        title: "Asignacion simple por grupo",
        copy: "Carga el contexto y asigna individual o masivamente.",
        badge: {
          label: context ? context.group.name : (selectedGroup ? selectedGroup.groupName : "Selecciona grupo"),
          kind: context ? "dark" : "warning"
        },
        metrics: [
          { label: "Temporada", value: context ? context.season.name : (resolveSeasonName_(filter.seasonId) || "Pendiente") },
          { label: "Sesion", value: context ? context.session.name : (selectedSession ? selectedSession.name : "Pendiente") },
          { label: "Grupo", value: context ? context.group.name : (selectedGroup ? selectedGroup.groupName : "Pendiente") },
          { label: "Participantes", value: String(state.participants.length) }
        ],
        actions: [
          { label: "Contexto", variant: "primary", sectionId: "participants-context" },
          { label: "Individual", variant: "secondary", sectionId: "participants-single" },
          { label: "Masivo", variant: "ghost", sectionId: "participants-bulk" }
        ]
      })}

      <div class="stats-grid participant-stats-grid">
        <article class="stat-card">
          <span>Participantes actuales</span>
          <strong>${escapeHtml(String(state.participants.length))}</strong>
          <span>Activos en el grupo y sesion seleccionados</span>
        </article>
        <article class="stat-card">
          <span>Voluntarios</span>
          <strong>${escapeHtml(String(serverCount))}</strong>
          <span>Contados segun el tipo del participante</span>
        </article>
        <article class="stat-card">
          <span>Sesiones de la temporada</span>
          <strong>${escapeHtml(String(sessions.length))}</strong>
          <span>Base disponible para asignacion masiva</span>
        </article>
        <article class="stat-card">
          <span>Seleccion masiva</span>
          <strong>${escapeHtml(String(state.selectedBulkPeople.length))}</strong>
          <span>Lote listo para enviarse a toda la temporada</span>
        </article>
      </div>

      <article class="panel-card module-section-anchor" id="participants-context">
        <div class="panel-head">
          <div>
            <h2>Contexto del grupo</h2>
            <p>Selecciona temporada, sesion y grupo. El listado se recarga sobre los endpoints reales de la V2.</p>
          </div>
          <button class="btn btn-secondary" data-action="load-participants">Actualizar listado</button>
        </div>

        <div class="field-grid two">
          ${renderSeasonSelect("participants-season", filter.seasonId)}
          ${renderSessionSelect("participants-session", filter.seasonId, filter.sessionId)}
          ${renderGroupSelect("participants-group", groups, filter.groupId)}
          <div class="field">
            <label>Resumen</label>
            <div class="context-strip">
              <span class="context-item"><strong>Participantes:</strong> ${state.participants.length}</span>
              <span class="context-item"><strong>Temporada:</strong> ${context ? escapeHtml(context.season.name) : "Sin cargar"}</span>
              <span class="context-item"><strong>Sesion:</strong> ${context ? escapeHtml(context.session.name) : "Sin cargar"}</span>
              <span class="context-item"><strong>Grupo:</strong> ${context ? escapeHtml(context.group.name) : "Sin cargar"}</span>
              <span class="context-item"><strong>Grupos en la sesion:</strong> ${groups.length}</span>
            </div>
          </div>
        </div>
      </article>

      <div class="view-grid columns-2 participants-mobile-grid">
        <article class="panel-card module-section-anchor" id="participants-single">
          <div class="panel-head">
            <div>
              <h2>Agregar participante individual</h2>
              <p>Ideal para altas rapidas. Busca a la persona y agregala solo a esta sesion y grupo.</p>
            </div>
            <span class="pill dark">Esta sesion</span>
          </div>

          <div class="participant-flow-note">
            <strong>Alta inmediata</strong>
            <span>Cuando pulses agregar, el participante entrara a esta sesion sin recargar todo el modulo.</span>
          </div>

          <div class="field">
            <label for="participant-people-search">Buscar persona</label>
            <input id="participant-people-search" value="${escapeHtml(filter.peopleSearch)}" placeholder="Escribe nombre, QR ID, numero o correo">
          </div>

          <div class="context-strip participant-search-meta">
            <span class="context-item"><strong>Participantes actuales:</strong> ${escapeHtml(String(state.participants.length))}</span>
            <span class="context-item"><strong>Coincidencias:</strong> ${escapeHtml(String(peopleSearchResults.length))}</span>
            <span class="context-item"><strong>Grupo activo:</strong> ${escapeHtml(selectedGroupName)}</span>
          </div>

          <div class="results-list participants-picker-results">
            ${!hasSingleSearch ? `
              <div class="empty-state participant-picker-empty">
                <strong>Empieza escribiendo un nombre</strong>
                <span>Busca por nombre, QR ID, numero interno o correo para agregar rapido a la sesion actual.</span>
              </div>
            ` : peopleSearchResults.length ? peopleSearchResults.map((person) => `
              <article class="result-card participant-picker-card ${participantPersonIds.has(String(person.id)) ? "result-card-muted" : ""}">
                <div class="result-row">
                  <div class="result-copy-stack">
                    <div class="result-title-row">
                      <span class="row-title">${escapeHtml(person.name)}</span>
                      ${participantPersonIds.has(String(person.id)) ? `<span class="pill success">Ya en esta sesion</span>` : ""}
                    </div>
                    <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                    ${participantPersonIds.has(String(person.id)) ? `<span class="row-meta">Esta persona ya forma parte del grupo actual.</span>` : ""}
                  </div>
                  <div class="participant-action-stack">
                    <button
                      class="btn btn-primary"
                      data-action="add-person"
                      data-person-id="${escapeHtml(person.id)}"
                      ${participantPersonIds.has(String(person.id)) ? "disabled" : ""}
                    >
                      ${participantPersonIds.has(String(person.id)) ? "Asignado" : "Agregar a esta sesion"}
                    </button>
                  </div>
                </div>
              </article>
            `).join("") : `
              <div class="empty-state participant-picker-empty">
                <strong>Sin coincidencias</strong>
                <span>No encontramos personas con esa busqueda. Prueba otro nombre, QR ID, numero interno o correo.</span>
              </div>
            `}
          </div>
        </article>

        <article class="panel-card module-section-anchor" id="participants-bulk">
          <div class="panel-head">
            <div>
              <h2>Asignacion masiva a toda la temporada</h2>
              <p>Construye el lote poco a poco: busca, agrega al bloque y cuando termines confirma la asignacion.</p>
            </div>
            <span class="pill dark">${state.selectedBulkPeople.length} en lote</span>
          </div>

          <div class="bulk-impact-card">
            <div class="bulk-impact-copy">
              <strong>Impacto de esta accion</strong>
              <span>
                ${filter.seasonId && filter.groupId
                  ? `Trabajaras sobre ${escapeHtml(resolveSeasonName_(filter.seasonId) || "la temporada actual")} para el grupo ${escapeHtml(selectedGroupName)}.`
                  : "Primero define temporada, sesion y grupo para que la asignacion masiva se haga sobre el contexto correcto."}
              </span>
            </div>

            <div class="bulk-impact-grid">
              <div class="bulk-impact-item">
                <label>Sesiones destino</label>
                <strong>${escapeHtml(String(sessions.length))}</strong>
                <span>Toda la temporada seleccionada</span>
              </div>
              <div class="bulk-impact-item">
                <label>Seleccionadas</label>
                <strong>${escapeHtml(String(selectedPeople.length))}</strong>
                <span>Personas listas para asignar</span>
              </div>
              <div class="bulk-impact-item">
                <label>Nuevas en esta sesion</label>
                <strong>${escapeHtml(String(selectedNewCount))}</strong>
                <span>Entrarian desde este mismo grupo</span>
              </div>
              <div class="bulk-impact-item">
                <label>Ya presentes</label>
                <strong>${escapeHtml(String(selectedAlreadyAssignedCount))}</strong>
                <span>Se completaran solo sesiones faltantes</span>
              </div>
            </div>
          </div>

          <div class="participants-bulk-builder">
            <div class="bulk-search-panel">
              <div class="field">
                <label for="participant-bulk-search">Buscar para asignacion masiva</label>
                <input id="participant-bulk-search" value="${escapeHtml(filter.bulkSearch)}" placeholder="Escribe nombre, QR ID o numero interno">
              </div>

              <div class="context-strip participant-search-meta">
                <span class="context-item"><strong>Coincidencias:</strong> ${escapeHtml(String(bulkMatches.length))}</span>
                <span class="context-item"><strong>En lote:</strong> ${escapeHtml(String(queuedVisibleBulkCount))}</span>
                <span class="context-item"><strong>Ya en esta sesion:</strong> ${escapeHtml(String(assignedVisibleBulkCount))}</span>
              </div>

              <div class="results-list participants-picker-results">
                ${!hasBulkSearch ? `
                  <div class="empty-state participant-picker-empty">
                    <strong>Busca y agrega al lote</strong>
                    <span>Escribe un nombre, QR ID o numero interno. Ve sumando personas una por una hasta completar tu bloque.</span>
                  </div>
                ` : bulkResults.length ? bulkResults.map((person) => `
                  <article class="result-card participant-picker-card ${participantPersonIds.has(String(person.id)) ? "result-card-muted" : ""}">
                    <div class="result-row">
                      <div class="result-copy-stack">
                        <div class="result-title-row">
                          <span class="row-title">${escapeHtml(person.name)}</span>
                          ${participantPersonIds.has(String(person.id)) ? `<span class="pill success">Ya en esta sesion</span>` : ""}
                          ${selectedBulkSet.has(String(person.id)) ? `<span class="pill dark">En lote</span>` : ""}
                        </div>
                        <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                        <span class="row-meta">
                          ${participantPersonIds.has(String(person.id))
                            ? "Puedes incluirlo si quieres completar las sesiones restantes de la temporada."
                            : "Listo para agregarse a todas las sesiones del ciclo."}
                        </span>
                      </div>
                      <div class="participant-action-stack">
                        <button
                          class="btn ${selectedBulkSet.has(String(person.id)) ? "btn-secondary" : "btn-primary"}"
                          data-action="add-bulk-person"
                          data-person-id="${escapeHtml(String(person.id))}"
                          ${selectedBulkSet.has(String(person.id)) ? "disabled" : ""}
                        >
                          ${selectedBulkSet.has(String(person.id)) ? "Ya en el lote" : "Agregar al lote"}
                        </button>
                      </div>
                    </div>
                  </article>
                `).join("") : `
                  <div class="empty-state participant-picker-empty">
                    <strong>Sin coincidencias</strong>
                    <span>No encontramos personas con esa busqueda. Ajusta el texto y sigue armando el lote.</span>
                  </div>
                `}
              </div>

              <p class="footer-note participant-bulk-note">
                ${hasBulkSearch
                  ? `Mostrando ${escapeHtml(String(bulkResults.length))} de ${escapeHtml(String(bulkMatches.length))} coincidencias para este filtro.`
                  : "Usa la busqueda para ir encontrando personas y agregarlas paso a paso al lote."}
                ${hiddenBulkCount ? ` Refina la busqueda si necesitas revisar las ${escapeHtml(String(hiddenBulkCount))} coincidencias restantes.` : ""}
              </p>
            </div>

            <div class="bulk-queue-panel">
              <div class="bulk-selected-tray">
                <div class="bulk-selected-head">
                  <strong>Lote actual</strong>
                  <span class="row-meta">${escapeHtml(String(selectedAlreadyAssignedCount))} ya estaban en esta sesion y ${escapeHtml(String(selectedNewCount))} se agregaran aqui por primera vez.</span>
                </div>

                ${selectedPeople.length ? `
                  <div class="results-list bulk-queue-list">
                    ${selectedPeople.map((person) => `
                      <article class="result-card bulk-queue-card ${participantPersonIds.has(String(person.id)) ? "result-card-muted" : ""}">
                        <div class="result-row">
                          <div class="result-copy-stack">
                            <div class="result-title-row">
                              <span class="row-title">${escapeHtml(person.name)}</span>
                              ${participantPersonIds.has(String(person.id)) ? `<span class="pill success">Ya en esta sesion</span>` : `<span class="pill dark">Nuevo en esta sesion</span>`}
                            </div>
                            <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                            <span class="row-meta">Se tomara en cuenta para las ${escapeHtml(String(sessions.length))} sesiones de la temporada.</span>
                          </div>
                          <div class="participant-action-stack">
                            <button
                              class="btn btn-ghost"
                              data-action="remove-bulk-person"
                              data-person-id="${escapeHtml(String(person.id))}"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </article>
                    `).join("")}
                  </div>
                ` : `
                  <div class="bulk-empty-selection">
                    <strong>Tu lote aun esta vacio</strong>
                    <span>Busca personas en el panel izquierdo y ve agregandolas una a una hasta completar el bloque.</span>
                  </div>
                `}
              </div>

              <div class="bulk-footer-actions">
                <div class="bulk-footer-copy">
                  <strong>${escapeHtml(bulkAssignLabel)}</strong>
                  <span class="row-meta">
                    ${canBulkAssign
                      ? `El sistema revisara las ${escapeHtml(String(sessions.length))} sesiones de la temporada y evitara duplicados donde ya existan participantes.`
                      : "Necesitas contexto valido y al menos una persona en el lote para ejecutar la asignacion."}
                  </span>
                </div>

                <div class="actions-row">
                  <button class="btn btn-primary" data-action="bulk-assign" ${canBulkAssign ? "" : "disabled"}>${escapeHtml(bulkAssignLabel)}</button>
                  <button class="btn btn-ghost" data-action="clear-bulk-selection" ${selectedPeople.length ? "" : "disabled"}>Vaciar lote</button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article class="detail-card module-section-anchor" id="participants-roster">
        <div class="panel-head">
          <div>
            <h2>Participantes del grupo</h2>
            <p>${context ? `${escapeHtml(context.season.name)} | ${escapeHtml(context.session.name)} | ${escapeHtml(context.group.name)}` : "Carga primero un contexto valido."}</p>
          </div>
          ${context ? renderPill(context.group.status) : ""}
        </div>

        ${state.participants.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Mover a grupo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${state.participants.map((participant) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(participant.name)}</span>
                      <span class="row-meta">${escapeHtml(participant.personId)} | ${escapeHtml(participant.id)}</span>
                    </td>
                    <td>${renderPersonTypePill_(participant.type)}</td>
                    <td>${renderPill(participant.status)}</td>
                    <td>
                      <select
                        class="inline-select"
                        id="move-target-${escapeHtml(participant.id)}"
                        data-role="move-target"
                        data-participant-id="${escapeHtml(participant.id)}"
                        ${moveGroups.length ? "" : "disabled"}
                      >
                        <option value="">${moveGroups.length ? "Selecciona grupo" : "No hay otro grupo en esta sesion"}</option>
                        ${moveGroups.map((group) => `
                          <option
                            value="${escapeHtml(String(group.groupId))}"
                            ${String(state.filters.participants.moveTargets[participant.id] || "") === String(group.groupId) ? "selected" : ""}
                            ${String(participant.groupId) === String(group.groupId) ? "disabled" : ""}
                          >
                            ${escapeHtml(group.groupName)}
                          </option>
                        `).join("")}
                      </select>
                    </td>
                    <td>
                      <div class="inline-actions">
                        <button
                          class="btn btn-secondary"
                          data-action="move-participant"
                          data-participant-id="${escapeHtml(participant.id)}"
                          ${state.filters.participants.moveTargets[participant.id] ? "" : "disabled"}
                        >
                          Mover
                        </button>
                        <button class="btn btn-danger" data-action="deactivate-participant" data-participant-id="${escapeHtml(participant.id)}">Dar de baja</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">No hay participantes activos en el grupo seleccionado.</div>
        `}
      </article>
    </section>
  `;
}

function renderAttendanceView() {
  const filter = state.filters.attendance;
  const activeSession = getActiveAttendanceSession_();
  const groups = activeSession ? getSessionGroups(activeSession.seasonId, activeSession.id) : [];
  const activeSeasonName = activeSession ? resolveSeasonName_(activeSession.seasonId) : "";
  const context = state.attendanceContext;
  const summary = buildAttendanceSummary();
  const filteredParticipants = getFilteredAttendanceParticipants_();
  const selectedGroup = groups.find((group) => String(group.groupId) === String(filter.groupId)) || null;
  const selectedGroupName = context ? context.group.name : (selectedGroup ? selectedGroup.groupName : "Pendiente");
  const visiblePresent = filteredParticipants.filter((participant) => state.attendanceForm[participant.personId] === "SI").length;
  const visibleAbsent = Math.max(filteredParticipants.length - visiblePresent, 0);
  const draftLabel = summary.changed
    ? `${summary.changed} cambio${summary.changed === 1 ? "" : "s"} sin guardar`
    : (context
      ? (context.alreadyCaptured ? "Sin cambios pendientes" : "Lista lista para guardar")
      : "Pendiente");
  const listCaption = context
    ? `${escapeHtml(context.season.name)} | ${escapeHtml(context.session.name)} | ${escapeHtml(context.group.name)}`
    : (!activeSession
      ? "No hay una sesion ABIERTA hoy para cargar asistentes."
      : (!filter.groupId
        ? "Selecciona un grupo para desplegar a todos sus asistentes."
        : "Cargando el contexto del grupo seleccionado..."));
  const emptyAttendanceMessage = !activeSession
    ? "No hay una sesion ABIERTA en la fecha de hoy. Abrela desde Temporadas y Sesiones para comenzar la captura manual."
    : (!filter.groupId
      ? "Selecciona un grupo para cargar su lista de asistentes."
      : "No hay participantes activos para capturar en este contexto.");

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "attendance",
        eyebrow: "Captura del dia",
        title: "Asistencia lista para operar",
        copy: "Elige grupo y empieza a marcar o editar la lista.",
        badge: {
          label: activeSession ? draftLabel : "Sin sesion ABIERTA",
          kind: activeSession ? (summary.changed ? "warning" : (context && context.alreadyCaptured ? "dark" : "success")) : "warning"
        },
        metrics: [
          { label: "Temporada", value: activeSeasonName || "Pendiente" },
          { label: "Sesion", value: activeSession ? activeSession.name : "Sin abrir" },
          { label: "Grupo", value: selectedGroupName },
          { label: "Asistieron", value: String(summary.present) }
        ],
        actions: [
          { label: "Contexto", variant: "primary", sectionId: "attendance-context" },
          { label: "Lista", variant: "secondary", sectionId: "attendance-list" },
          { label: "QR", action: "open-qr-operator", variant: "ghost" },
          { label: "Kiosko", action: "open-qr-kiosk", variant: "ghost" }
        ]
      })}

      <article class="panel-card module-section-anchor" id="attendance-context">
        <div class="panel-head">
          <div>
            <h2>Contexto de captura</h2>
            <p>La captura manual trabaja sobre la sesion activa del dia. Elige el grupo y el sistema cargara al instante su lista operativa.</p>
          </div>
          <button class="btn btn-secondary" data-action="load-attendance">Actualizar sesion de hoy</button>
        </div>

        <div class="field-grid two attendance-context-grid">
          <div class="field">
            <label>Sesion activa detectada</label>
            ${activeSession ? `
              <div class="context-strip">
                <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(activeSeasonName || activeSession.seasonId)}</span>
                <span class="context-item"><strong>Sesion:</strong> ${escapeHtml(activeSession.name)}</span>
                <span class="context-item"><strong>Fecha:</strong> ${escapeHtml(formatDate(activeSession.date))}</span>
                <span class="context-item"><strong>Estado:</strong> ${escapeHtml(activeSession.status || "ABIERTA")}</span>
              </div>
              <span class="field-help">La sesion debe estar ABIERTA y con la fecha de hoy para habilitar esta vista.</span>
            ` : `
              <div class="empty-state">Hoy no hay una sesion ABIERTA. Abrela desde Temporadas y Sesiones para capturar asistencia manual.</div>
            `}
          </div>

          <div class="field">
            <label>Grupo de captura</label>
            ${activeSession ? `
              <div class="attendance-group-grid">
                ${groups.length ? groups.map((group) => `
                  <button
                    class="attendance-group-card ${String(filter.groupId) === String(group.groupId) ? "active" : ""}"
                    data-action="set-attendance-group"
                    data-group-id="${escapeHtml(String(group.groupId))}"
                  >
                    <strong>${escapeHtml(group.groupName)}</strong>
                    <span>${String(filter.groupId) === String(group.groupId) ? "Grupo actual" : `Grupo ${escapeHtml(String(group.groupId))}`}</span>
                  </button>
                `).join("") : `
                  <div class="empty-state">No hay grupos asociados a la sesion activa.</div>
                `}
              </div>
              <span class="field-help">Toca un grupo para cargar su lista. No necesitas abrir menus para comenzar.</span>
            ` : `
              <div class="empty-state">Sin sesion activa no se habilita la seleccion de grupo.</div>
            `}
          </div>

          <div class="field">
            <label>Estado actual</label>
            <div class="context-strip">
              <span class="context-item"><strong>Capturado:</strong> ${context ? (context.alreadyCaptured ? "Si" : "No") : "Pendiente"}</span>
              <span class="context-item"><strong>Participantes:</strong> ${context ? context.participants.length : 0}</span>
              <span class="context-item"><strong>Grupo:</strong> ${escapeHtml(context ? context.group.name : (groups.find((group) => String(group.groupId) === String(filter.groupId))?.groupName || "Sin seleccionar"))}</span>
            </div>
          </div>
        </div>

        <div class="actions-row attendance-context-actions">
          <button class="btn btn-secondary" data-action="open-qr-operator">Ir a escaneo QR</button>
          <button class="btn btn-ghost" data-action="open-qr-kiosk">Ir a modo kiosko</button>
        </div>
      </article>

      <article class="panel-card attendance-ops-card">
        <div class="panel-head">
          <div>
            <h2>Operacion rapida</h2>
            <p>Usa estos atajos para marcar grupos completos o guardar sin moverte de pantalla.</p>
          </div>
          <span class="pill ${summary.changed ? "warning" : "dark"}" data-role="attendance-draft-badge">${escapeHtml(draftLabel)}</span>
        </div>

        <div class="summary-stack attendance-ops-grid">
          <div class="summary-box">
            <span class="status-chip neutral">Participantes</span>
            <strong data-role="attendance-total-count">${summary.total}</strong>
            <span>Total cargado en el grupo actual.</span>
          </div>
          <div class="summary-box">
            <span class="status-chip success">Asistieron</span>
            <strong data-role="attendance-present-count">${summary.present}</strong>
            <span>Marcados actualmente como SI.</span>
          </div>
          <div class="summary-box">
            <span class="status-chip warning">No asistieron</span>
            <strong data-role="attendance-absent-count">${summary.absent}</strong>
            <span>Marcados actualmente como NO.</span>
          </div>
          <div class="summary-box">
            <span class="status-chip dark">Cambios</span>
            <strong data-role="attendance-dirty-count">${summary.changed}</strong>
            <span>Pendientes de guardar en esta vista.</span>
          </div>
          <div class="summary-box">
            <span class="status-chip neutral">Visibles</span>
            <strong data-role="attendance-visible-count">${filteredParticipants.length}</strong>
            <span>${visiblePresent} SI y ${visibleAbsent} NO segun el filtro actual.</span>
          </div>
        </div>

        <div class="actions-row attendance-bulk-actions">
          <button class="btn btn-secondary" data-action="set-attendance-all" data-value="SI" ${context && context.participants.length ? "" : "disabled"}>Marcar todo el grupo SI</button>
          <button class="btn btn-ghost" data-action="set-attendance-all" data-value="NO" ${context && context.participants.length ? "" : "disabled"}>Marcar todo el grupo NO</button>
          <button class="btn btn-secondary" data-action="set-attendance-visible" data-value="SI" ${filteredParticipants.length ? "" : "disabled"}>Marcar visibles SI</button>
          <button class="btn btn-ghost" data-action="set-attendance-visible" data-value="NO" ${filteredParticipants.length ? "" : "disabled"}>Marcar visibles NO</button>
          <button class="btn btn-primary" type="submit" form="attendance-form" ${context && context.participants.length ? "" : "disabled"}>
            ${context && context.alreadyCaptured ? "Guardar cambios" : "Guardar asistencia"}
          </button>
        </div>
      </article>

      <div class="view-grid columns-2 attendance-mobile-grid">
        <article class="detail-card module-section-anchor" id="attendance-list">
          <div class="panel-head">
            <div>
              <h2>Lista de asistencia</h2>
              <p>${listCaption}</p>
            </div>
            ${context ? `<span class="pill ${context.alreadyCaptured ? "warning" : "success"}">${context.alreadyCaptured ? "Edicion" : "Primera captura"}</span>` : ""}
          </div>

          ${context && context.participants.length ? `
            <div class="field attendance-search-field">
              <label for="attendance-search">Buscar participante</label>
              <input id="attendance-search" value="${escapeHtml(filter.search)}" placeholder="Nombre, QR ID o tipo de persona">
              <span class="field-help">Filtra la lista para trabajar solo con una parte del grupo sin perder el resto de tu captura.</span>
            </div>

            <p class="footer-note attendance-list-note">
              Mostrando ${escapeHtml(String(filteredParticipants.length))} de ${escapeHtml(String(context.participants.length))} participantes.
              Marca cada tarjeta con <strong>SI</strong> o <strong>NO</strong> y guarda cuando termines.
            </p>

            <form id="attendance-form" class="attendance-grid">
              ${filteredParticipants.length ? filteredParticipants.map((participant) => `
                <article
                  class="attendance-row ${state.attendanceForm[participant.personId] === "SI" ? "attendance-row-present" : "attendance-row-absent"}"
                  data-role="attendance-card"
                  data-person-id="${escapeHtml(participant.personId)}"
                >
                  <div class="attendance-row-main">
                    <div>
                      <span class="row-title">${escapeHtml(participant.name)}</span>
                      <span class="row-meta">${escapeHtml(participant.personId)} | ${escapeHtml(getPersonTypeDisplayLabel_(participant.type || ""))}</span>
                      <span class="row-meta">${state.attendanceForm[participant.personId] === "SI" ? "Marcado como asistente" : "Marcado como no asistente"}</span>
                    </div>
                  </div>
                  <div class="attendance-choice-group">
                    <button
                      type="button"
                      class="attendance-choice ${state.attendanceForm[participant.personId] === "SI" ? "active" : ""}"
                      data-role="attendance-choice"
                      data-person-id="${escapeHtml(participant.personId)}"
                      data-action="set-person-attendance"
                      data-value="SI"
                      aria-pressed="${state.attendanceForm[participant.personId] === "SI" ? "true" : "false"}"
                    >
                      SI
                    </button>
                    <button
                      type="button"
                      class="attendance-choice ${state.attendanceForm[participant.personId] === "NO" ? "active" : ""}"
                      data-role="attendance-choice"
                      data-person-id="${escapeHtml(participant.personId)}"
                      data-action="set-person-attendance"
                      data-value="NO"
                      aria-pressed="${state.attendanceForm[participant.personId] === "NO" ? "true" : "false"}"
                    >
                      NO
                    </button>
                  </div>
                </article>
              `).join("") : `
                <div class="empty-state">No hay participantes que coincidan con la busqueda actual.</div>
              `}

              <div class="actions-row attendance-form-footer">
                <button class="btn btn-ghost" type="button" data-action="refresh-attendance-detail" ${filter.groupId ? "" : "disabled"}>Cargar detalle historico</button>
                <button class="btn btn-primary" type="submit">${context.alreadyCaptured ? "Guardar cambios" : "Guardar asistencia"}</button>
              </div>
            </form>
          ` : `
            <div class="empty-state">${escapeHtml(emptyAttendanceMessage)}</div>
          `}
        </article>

        <article class="summary-card module-section-anchor attendance-summary-card" id="attendance-summary-card">
          <div class="panel-head">
            <div>
              <h2>Resumen y control</h2>
              <p>Monitorea tu avance actual y usa el detalle historico solo cuando realmente lo necesites.</p>
            </div>
          </div>

          <div class="summary-stack" id="attendance-summary">
            <div class="summary-box">
              <span class="status-chip neutral">Participantes</span>
              <strong data-role="attendance-total-count">${summary.total}</strong>
              <span>Total cargado en el grupo actual.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Asistieron</span>
              <strong data-role="attendance-present-count">${summary.present}</strong>
              <span>Marcados actualmente como SI.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip warning">No asistieron</span>
              <strong data-role="attendance-absent-count">${summary.absent}</strong>
              <span>Marcados actualmente como NO.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip dark">Cambios</span>
              <strong data-role="attendance-dirty-count">${summary.changed}</strong>
              <span>Cambios pendientes de guardar.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Visibles</span>
              <strong data-role="attendance-visible-count">${filteredParticipants.length}</strong>
              <span>${visiblePresent} SI y ${visibleAbsent} NO segun el filtro actual.</span>
            </div>
          </div>

          <div class="attendance-flow-note">
            <strong>Flujo recomendado</strong>
            <span>1. Elige el grupo. 2. Marca rapidamente con SI o NO. 3. Guarda. 4. Si necesitas revisar el historial del grupo, cargalo al final.</span>
          </div>
        </article>
      </div>

      <article class="detail-card module-section-anchor" id="attendance-detail">
        <div class="panel-head">
          <div>
            <h2>Detalle historico del grupo</h2>
            <p>Consulta la matriz solo si la necesitas. Se carga aparte para que la captura diaria sea mas rapida.</p>
          </div>
          <button class="btn btn-secondary" data-action="refresh-attendance-detail" ${filter.groupId ? "" : "disabled"}>${state.attendanceDetail ? "Actualizar detalle" : "Cargar detalle"}</button>
        </div>

        ${state.attendanceDetail && state.attendanceDetail.sessions && state.attendanceDetail.sessions.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  ${state.attendanceDetail.sessions.map((session) => `<th>${escapeHtml(session.name)}</th>`).join("")}
                  <th>Total SI</th>
                </tr>
              </thead>
              <tbody>
                ${state.attendanceDetail.people.length ? state.attendanceDetail.people.map((person) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(person.name)}</span>
                      <span class="row-meta">${escapeHtml(person.personId)}</span>
                    </td>
                    ${state.attendanceDetail.sessions.map((session) => `
                      <td>${renderPill(person.attendances[session.name] || "-")}</td>
                    `).join("")}
                    <td>${escapeHtml(String(person.totalPresent || 0))}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="${state.attendanceDetail.sessions.length + 2}">
                      <div class="empty-state">Todavia no hay asistencias registradas para este grupo.</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">Aun no has cargado el detalle historico de este grupo en esta vista.</div>
        `}
      </article>
    </section>
  `;
}

function renderQrView() {
  const filter = state.filters.qr;
  const activeSession = state.activeSession && state.activeSession.found ? state.activeSession.session : null;
  const qrSearchResults = filterPeople(state.people, filter.peopleSearch).slice(0, 8);
  const summary = state.realtimeSummary;
  const activity = state.qrSessionActivity || [];
  const kioskResult = getQrKioskResult_();
  const kioskContext = resolveQrContext();
  const isKioskSurface = filter.surface === "kiosk";
  const kioskTone = kioskResult ? kioskResult.tone : (state.qrScanner.enabled ? "live" : "idle");
  const kioskBadge = kioskResult
    ? kioskResult.badge
    : (state.qrScanner.enabled
      ? (isKioskSurface ? "Escaneo en vivo" : "Lectura en vivo")
      : (isKioskSurface ? "Kiosko en espera" : "Escaner en espera"));
  const kioskTitle = kioskResult ? kioskResult.title : (isKioskSurface ? "Escanea tu codigo QR" : "Escaneo QR asistido listo");
  const kioskMessage = kioskResult ? kioskResult.message : state.qrScanner.message;
  const selectedCameraLabel = getQrCameraLabel_(filter.cameraFacing);
  const activeCameraLabel = getQrCameraLabel_(state.qrScanner.cameraFacing || filter.cameraFacing);
  const kioskSessionLabel = kioskContext
    ? `${kioskContext.sessionId} | ${filter.mode === "manual" ? "Sesion forzada" : "Sesion activa"}`
    : "Sin sesion seleccionada";
  const surfaceEyebrow = isKioskSurface ? "Kiosko de asistencia" : "Escaneo QR del equipo";
  const surfaceTitle = isKioskSurface ? "Registro tipo aeropuerto" : "Escaneo QR asistido";
  const surfaceCopy = isKioskSurface
    ? "La camara queda lista para recibir un QR tras otro. Cuando el registro sea exitoso, la pantalla responde en verde y muestra los datos del asistente en tiempo real."
    : "Ideal para un voluntario en recepcion o control. La camara valida un QR a la vez y deja visible el ultimo registro junto con la actividad reciente de la sesion.";
  const surfacePlaceholder = isKioskSurface
    ? "Activa el kiosko para iniciar el escaneo continuo."
    : "Activa la camara para comenzar a escanear QRs de forma asistida.";
  const surfaceCameraLabel = isKioskSurface ? "Camara del kiosko" : "Camara de escaneo";

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "qr",
        eyebrow: "QR y kiosko",
        title: "Escanea, busca o registra",
        copy: "Opera kiosko, escaneo asistido o captura manual por QR ID.",
        badge: {
          label: state.qrScanner.enabled ? (isKioskSurface ? "Kiosko activo" : "Escaneo activo") : "Camara en espera",
          kind: state.qrScanner.enabled ? "success" : "warning"
        },
        metrics: [
          { label: "Sesion", value: activeSession ? activeSession.name : "Sin abrir" },
          { label: "Modo", value: filter.mode === "manual" ? "Manual" : "Automatico" },
          { label: "Superficie", value: isKioskSurface ? "Kiosko" : "Escaneo" },
          { label: "Cobertura", value: summary ? `${summary.percentage || 0}%` : "Sin dato" }
        ],
        actions: [
          { label: "Escanear", variant: "primary", sectionId: "qr-kiosk-stage" },
          { label: "Manual", variant: "secondary", sectionId: "qr-manual-entry" },
          { label: "Actividad", variant: "ghost", sectionId: "qr-activity" }
        ]
      })}

      <article class="kiosk-stage kiosk-surface-${escapeHtml(filter.surface)} kiosk-tone-${escapeHtml(kioskTone)}" id="qr-kiosk-stage">
        <div class="kiosk-stage-head">
          <div>
            <span class="eyebrow kiosk-eyebrow">${escapeHtml(surfaceEyebrow)}</span>
            <h2 class="kiosk-title">${escapeHtml(surfaceTitle)}</h2>
            <p class="kiosk-copy">
              ${escapeHtml(surfaceCopy)}
            </p>
          </div>

          <div class="kiosk-head-actions">
            <div class="toggle-group kiosk-toggle-group">
              <button class="toggle-button ${filter.surface === "scanner" ? "active" : ""}" data-action="set-qr-surface" data-surface="scanner">Escaneo asistido</button>
              <button class="toggle-button ${filter.surface === "kiosk" ? "active" : ""}" data-action="set-qr-surface" data-surface="kiosk">Modo kiosko</button>
            </div>
            <button class="btn ${state.qrScanner.enabled ? "btn-danger" : "btn-primary"}" data-action="${state.qrScanner.enabled ? "stop-kiosk-camera" : "start-kiosk-camera"}">
              ${state.qrScanner.enabled ? "Detener camara" : "Activar camara"}
            </button>
            ${isKioskSurface ? `<button class="btn btn-ghost" data-action="toggle-kiosk-fullscreen">Pantalla completa</button>` : ""}
            <button class="btn btn-secondary" data-action="clear-kiosk-result">Limpiar resultado</button>
          </div>
        </div>

        <div class="kiosk-strip">
          <span class="kiosk-chip">${escapeHtml(isKioskSurface ? "Superficie kiosko" : "Escaneo asistido")}</span>
          <span class="kiosk-chip">${escapeHtml(filter.mode === "manual" ? "Modo manual" : "Modo automatico")}</span>
          <span class="kiosk-chip">${escapeHtml(kioskSessionLabel)}</span>
          <span class="kiosk-chip">${escapeHtml(activeSession ? activeSession.name : "Sin sesion abierta hoy")}</span>
          <span class="kiosk-chip">Camara seleccionada: ${escapeHtml(selectedCameraLabel)}</span>
        </div>

        <div class="kiosk-camera-row">
          <span class="kiosk-camera-label">${escapeHtml(surfaceCameraLabel)}</span>
          <div class="toggle-group kiosk-toggle-group">
            <button class="toggle-button ${filter.cameraFacing === "front" ? "active" : ""}" data-action="set-kiosk-camera" data-camera-facing="front">Frontal</button>
            <button class="toggle-button ${filter.cameraFacing === "rear" ? "active" : ""}" data-action="set-kiosk-camera" data-camera-facing="rear">Trasera</button>
          </div>
        </div>

        <div class="kiosk-grid">
          <div class="kiosk-scanner-shell">
            <div class="kiosk-scanner-frame">
              <video id="qr-kiosk-video" class="kiosk-video" autoplay muted playsinline></video>
              <div class="kiosk-video-placeholder ${state.qrScanner.enabled ? "hidden" : ""}">
                <strong>Camara en espera</strong>
                <span>${escapeHtml(surfacePlaceholder)}</span>
              </div>
              <div class="kiosk-scan-overlay">
                <span class="kiosk-corner kiosk-corner-tl"></span>
                <span class="kiosk-corner kiosk-corner-tr"></span>
                <span class="kiosk-corner kiosk-corner-bl"></span>
                <span class="kiosk-corner kiosk-corner-br"></span>
                <span class="kiosk-scan-line ${state.qrScanner.enabled ? "" : "hidden"}"></span>
                <div class="kiosk-scan-copy">Alinea el QR dentro del marco</div>
              </div>
            </div>

            <div class="kiosk-scanner-meta">
              <span class="status-chip ${state.qrScanner.enabled ? "success" : "neutral"}">
                ${state.qrScanner.enabled ? "Camara activa" : "Camara apagada"}
              </span>
              <span class="kiosk-camera-note">
                Vista actual: ${escapeHtml(activeCameraLabel)}
              </span>
              <span class="footer-note">
                ${escapeHtml(isKioskSurface
                  ? "En iPad se prioriza la camara frontal y puedes alternar a trasera cuando lo necesites."
                  : "Usa este modo cuando haya un operador presente recibiendo asistentes con su propio dispositivo.")}
              </span>
            </div>
          </div>

          <aside class="kiosk-result-card kiosk-tone-${escapeHtml(kioskTone)}">
            <span class="kiosk-result-badge">${escapeHtml(kioskBadge)}</span>
            <h3>${escapeHtml(kioskTitle)}</h3>
            <p>${escapeHtml(kioskMessage)}</p>

            <div class="kiosk-result-grid">
              <div class="kiosk-result-item">
                <label>Nombre</label>
                <strong>${escapeHtml(kioskResult?.name || "Esperando registro")}</strong>
              </div>
              <div class="kiosk-result-item">
                <label>Grupo de Conexion</label>
                <strong>${escapeHtml(kioskResult?.groupName || "Pendiente")}</strong>
              </div>
              <div class="kiosk-result-item">
                <label>ID de participante</label>
                <strong>${escapeHtml(kioskResult?.participantId || "Pendiente")}</strong>
              </div>
              <div class="kiosk-result-item">
                <label>QR ID</label>
                <strong>${escapeHtml(kioskResult?.personId || "Pendiente")}</strong>
              </div>
            </div>

            <div class="kiosk-result-footer">
              <span>${escapeHtml(kioskResult?.sessionName || (activeSession ? activeSession.name : "Sin sesion activa"))}</span>
              <span>${escapeHtml(kioskResult?.timestampLabel || "Sin ultima lectura")}</span>
            </div>
          </aside>
        </div>
      </article>

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Sesion activa y modo de registro</h2>
              <p>Usa el modo automatico cuando exista una sesion ABIERTA para la fecha de hoy. Si no, fuerza una sesion para pruebas o kiosko manual.</p>
            </div>
            <button class="btn btn-secondary" data-action="refresh-active-session">Actualizar</button>
          </div>

          <div class="summary-stack">
            <div class="summary-box">
              <span class="status-chip ${activeSession ? "success" : "warning"}">${activeSession ? "Sesion detectada" : "Sesion no detectada"}</span>
              <strong>${activeSession ? escapeHtml(activeSession.name) : "No abierta"}</strong>
              <span>${activeSession ? `${escapeHtml(activeSession.seasonId)} | ${escapeHtml(formatDate(activeSession.date))}` : "El backend indico que hoy no existe una sesion ABIERTA."}</span>
            </div>
          </div>

          <div style="margin-top: 18px;">
            <div class="toggle-group">
              <button class="toggle-button ${filter.mode === "active" ? "active" : ""}" data-action="set-qr-mode" data-mode="active">Usar sesion activa</button>
              <button class="toggle-button ${filter.mode === "manual" ? "active" : ""}" data-action="set-qr-mode" data-mode="manual">Forzar sesion</button>
            </div>
          </div>

          ${filter.mode === "manual" ? `
            <div class="field-grid two" style="margin-top: 18px;">
              ${renderSeasonSelect("qr-season", filter.seasonId)}
              ${renderSessionSelect("qr-session", filter.seasonId, filter.sessionId)}
            </div>
          ` : `
            <p class="footer-note">En modo activo no necesitas elegir temporada o sesion; la API lo resuelve automaticamente segun la fecha de hoy.</p>
          `}
        </article>

        <article class="summary-card">
          <div class="panel-head">
            <div>
              <h2>Resumen en tiempo real</h2>
              <p>Este bloque consulta el endpoint attendances.realtimeSummary de la misma API V2.</p>
            </div>
            <button class="btn btn-ghost" data-action="refresh-realtime">Actualizar resumen</button>
          </div>

          ${summary ? `
            <div class="summary-stack">
              <div class="summary-box">
                <span class="status-chip neutral">Participantes</span>
                <strong>${escapeHtml(String(summary.participants || 0))}</strong>
                <span>Personas activas esperadas en la sesion.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Asistencias</span>
                <strong>${escapeHtml(String(summary.attendances || 0))}</strong>
                <span>Asistencias ya registradas como SI.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Cobertura</span>
                <strong>${escapeHtml(String(summary.percentage || 0))}%</strong>
                <span>Porcentaje del avance de captura.</span>
              </div>
            </div>
          ` : `
            <div class="empty-state">No hay un resumen disponible todavia para el contexto seleccionado.</div>
          `}
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="scanner-card panel-card module-section-anchor" id="qr-manual-entry">
          <div class="panel-head">
            <div>
              <h2>Registro manual por codigo</h2>
              <p>Sirve como respaldo para lector tipo teclado o captura manual del QR ID numerico.</p>
            </div>
          </div>

          <form id="qr-form">
            <div class="field">
              <label for="qr-person-id">QR ID / Codigo QR</label>
              <input id="qr-person-id" name="personId" value="${escapeHtml(filter.personId)}" placeholder="Ejemplo: 8154920637" required>
              <span class="field-help">El QR debe contener el ID numerico de la persona, por ejemplo 8154920637.</span>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Registrar asistencia</button>
            </div>
          </form>

          ${state.qrLastResult ? `
            <div class="summary-box">
              <span class="status-chip success">Ultimo registro</span>
              <strong>${escapeHtml(state.qrLastResult.participant?.name || state.qrLastResult.attendance?.name || "Registro exitoso")}</strong>
              <span>
                ${state.qrLastResult.activeSession ? `${escapeHtml(state.qrLastResult.activeSession.name)} | ${escapeHtml(formatDate(state.qrLastResult.activeSession.date))}` : "Asistencia registrada"}
              </span>
            </div>
          ` : `
            <div class="empty-state">Todavia no se ha registrado una asistencia desde este modulo.</div>
          `}
        </article>

        <article class="panel-card module-section-anchor" id="qr-activity">
          <div class="panel-head">
            <div>
              <h2>Actividad reciente de la sesion</h2>
              <p>Te ayuda a monitorear en tiempo real a quien ya quedo registrado por QR o kiosko.</p>
            </div>
            <button class="btn btn-ghost" data-action="refresh-realtime">Actualizar</button>
          </div>

          <div class="results-list" style="margin-top: 16px;">
            ${activity.length ? activity.map((record) => `
              <article class="result-card">
                <div class="result-row">
                  <div>
                    <span class="row-title">${escapeHtml(record.name)}</span>
                    <span class="row-meta">${escapeHtml(record.personId)} | ${escapeHtml(record.groupName || "Sin grupo")}</span>
                  </div>
                  <span class="pill success">${escapeHtml(record.timestampLabel || "Registrado")}</span>
                </div>
              </article>
            `).join("") : `
              <div class="empty-state">Todavia no hay registros recientes para la sesion seleccionada.</div>
            `}
          </div>
        </article>
      </div>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <h2>Registro por busqueda y contingencia</h2>
            <p>Busca una persona y registra su asistencia sin escribir el codigo, ideal para respaldo o filtros en recepcion.</p>
          </div>
        </div>

        <div class="field">
          <label for="qr-people-search">Buscar persona</label>
          <input id="qr-people-search" value="${escapeHtml(filter.peopleSearch)}" placeholder="Nombre, QR ID, numero o correo">
        </div>

        <div class="results-list" style="margin-top: 16px;">
          ${qrSearchResults.length ? qrSearchResults.map((person) => `
            <article class="result-card">
              <div class="result-row">
                <div>
                  <span class="row-title">${escapeHtml(person.name)}</span>
                  <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")}</span>
                </div>
                <button class="btn btn-primary" data-action="register-qr-person" data-person-id="${escapeHtml(person.id)}">Registrar</button>
              </div>
            </article>
          `).join("") : `
            <div class="empty-state">No hay personas para la busqueda actual.</div>
          `}
        </div>
      </article>
    </section>
  `;
}

function getQrKioskResult_() {
  return state.qrScanner.result;
}

function buildQrSuccessResult_(response, personId, source) {
  const participant = response?.participant || {};
  const attendance = response?.attendance || {};
  const activeSession = response?.activeSession || null;
  const participantId = participant.id || attendance.id || "";
  const groupId = participant.groupId || attendance.groupId || "";
  const groupName = resolveGroupName_(groupId);

  return {
    tone: "success",
    badge: source === "scanner" ? "Registro aceptado" : "Registro confirmado",
    title: source === "scanner" ? "Acceso autorizado" : "Asistencia registrada",
    message: source === "scanner"
      ? "El asistente fue validado correctamente. La camara ya puede leer el siguiente codigo."
      : "La asistencia quedo guardada correctamente en la sesion actual.",
    name: participant.name || attendance.name || "Sin nombre",
    groupName: groupName || `Grupo ${groupId || "sin dato"}`,
    participantId: participantId || "Sin ID",
    personId: attendance.personId || personId,
    sessionName: activeSession ? activeSession.name : "Sesion actual",
    timestampLabel: formatDateTime_(new Date())
  };
}

function buildQrFailureResult_(error, personId) {
  const normalizedCode = error instanceof ApiError ? error.code : "UNEXPECTED_ERROR";
  const tone = normalizedCode === "DUPLICATE_QR_ATTENDANCE" ? "warning" : "error";
  const titleMap = {
    DUPLICATE_QR_ATTENDANCE: "Asistencia ya registrada",
    SESSION_NOT_ACTIVE: "No hay sesion abierta",
    PARTICIPANT_NOT_IN_ACTIVE_SESSION: "Participante fuera de la sesion",
    MISSING_QR_CONTEXT: "Contexto incompleto",
    UNSUPPORTED_QR_SCANNER: "Escaner no soportado",
    CAMERA_PERMISSION_DENIED: "Permiso de camara denegado",
    INVALID_QR_VALUE: "QR no reconocido"
  };

  return {
    tone,
    badge: tone === "warning" ? "Revisar registro" : "Registro rechazado",
    title: titleMap[normalizedCode] || "No se pudo registrar",
    message: error instanceof Error ? error.message : "Ocurrio un problema al registrar el QR.",
    name: "Sin registro",
    groupName: "Pendiente",
    participantId: "Pendiente",
    personId: personId || "Sin dato",
    sessionName: "Operacion QR",
    timestampLabel: formatDateTime_(new Date())
  };
}

function resolveGroupName_(groupId) {
  const match = state.catalogs.groups.find((group) => String(group.id) === String(groupId));
  return match ? match.name : "";
}

function resolveSeasonName_(seasonId) {
  const match = state.seasons.find((season) => String(season.id) === String(seasonId));
  return match ? match.name : "";
}

function getActiveAttendanceSession_() {
  return state.activeSession && state.activeSession.found ? state.activeSession.session : null;
}

function renderNavButton(moduleId) {
  const meta = MODULE_META[moduleId];
  const targetView = getDefaultViewForModule_(moduleId);

  if (!meta || !canAccessView_(targetView)) {
    return "";
  }

  const isActive = getCurrentModule_() === moduleId;

  return `
    <button class="nav-button ${isActive ? "active" : ""}" data-action="navigate" data-view="${targetView}">
      <span class="nav-copy">
        <strong>${escapeHtml(meta.title)}</strong>
        <small>${escapeHtml(meta.description)}</small>
      </span>
      <span class="nav-state">${isActive ? "Actual" : "Abrir"}</span>
    </button>
  `;
}

function renderMobileNavButton_(moduleId, view, label, description) {
  if (!canAccessView_(view)) {
    return "";
  }

  const isActive = getCurrentModule_() === moduleId;

  return `
    <button class="mobile-tab-button ${isActive ? "active" : ""}" data-action="navigate" data-view="${view}">
      <strong>${escapeHtml(label)}</strong>
      <small>${escapeHtml(description)}</small>
    </button>
  `;
}

function renderQuickLink(view, title, copy) {
  if (true) {
    return `
      <button class="quick-link" data-action="navigate" data-view="${view}">
        <span class="quick-link-copy">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(copy)}</small>
        </span>
        <span class="quick-link-mark">Ir</span>
      </button>
    `;
  }
  return `
    <button class="quick-link" data-action="navigate" data-view="${view}">
      <span>${escapeHtml(title)}<small>${escapeHtml(copy)}</small></span>
      <span>â†’</span>
    </button>
  `;
}

function renderSeasonSelect(id, selectedValue) {
  return `
    <div class="field">
      <label for="${id}">Temporada</label>
      <select id="${id}">
        ${renderOptions(
          state.seasons.map((season) => ({
            value: season.id,
            label: `${season.name} (${season.id})`
          })),
          selectedValue,
          "Selecciona temporada"
        )}
      </select>
    </div>
  `;
}

function renderSessionSelect(id, seasonId, selectedValue) {
  const sessions = getSessions(seasonId);

  return `
    <div class="field">
      <label for="${id}">Sesion</label>
      <select id="${id}">
        ${renderOptions(
          sessions.map((session) => ({
            value: session.id,
            label: `${session.name} | ${formatDate(session.date)}`
          })),
          selectedValue,
          "Selecciona sesion"
        )}
      </select>
    </div>
  `;
}

function renderGroupSelect(id, groups, selectedValue) {
  return `
    <div class="field">
      <label for="${id}">Grupo</label>
      <select id="${id}">
        ${renderOptions(
          groups.map((group) => ({
            value: String(group.groupId),
            label: `${group.groupName} (${group.groupId})`
          })),
          selectedValue,
          "Selecciona grupo"
        )}
      </select>
    </div>
  `;
}

function renderOptions(items, selectedValue, placeholder) {
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`];

  items.forEach((item) => {
    const isSelected = String(item.value) === String(selectedValue);
    options.push(`<option value="${escapeHtml(String(item.value))}" ${isSelected ? "selected" : ""}>${escapeHtml(item.label)}</option>`);
  });

  return options.join("");
}

function renderConnectionChip() {
  if (!state.connectionStatus) {
    return `<span class="status-chip neutral">Sin prueba reciente</span>`;
  }

  return `
    <span class="status-chip ${escapeHtml(state.connectionStatus.type)}">
      ${escapeHtml(state.connectionStatus.message)}
    </span>
  `;
}

function renderPill(value) {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "ACTIVO" || normalized === "ABIERTA" || normalized === "SI") {
    return `<span class="pill success">${escapeHtml(value)}</span>`;
  }

  if (normalized === "NO" || normalized === "BAJA" || normalized === "CERRADA") {
    return `<span class="pill warning">${escapeHtml(value)}</span>`;
  }

  if (normalized === "-") {
    return `<span class="pill">${escapeHtml(value)}</span>`;
  }

  return `<span class="pill dark">${escapeHtml(value || "SIN DATO")}</span>`;
}

function getPersonTypeDisplayLabel_(value, options = {}) {
  const canonicalValue = normalizePersonTypeValue_(value);
  const normalizedKey = getPersonTypeKey_(canonicalValue);
  let label = canonicalValue;

  if (normalizedKey === "servidor") {
    label = "Voluntario";
  }

  return options.uppercase ? label.toUpperCase() : label;
}

function renderPersonTypePill_(value) {
  const normalized = normalizePersonTypeValue_(value);
  const normalizedKey = getPersonTypeKey_(normalized);
  const displayLabel = getPersonTypeDisplayLabel_(normalized);

  if (normalizedKey === "congregante") {
    return `<span class="pill success">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "servidor") {
    return `<span class="pill dark">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "coordinador") {
    return `<span class="pill warning">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "lider") {
    return `<span class="pill danger">${escapeHtml(displayLabel)}</span>`;
  }

  return `<span class="pill">${escapeHtml(displayLabel || "SIN DATO")}</span>`;
}

function renderPersonImportOperationPill_(value) {
  if (value === "update") {
    return `<span class="pill warning">Actualizar</span>`;
  }

  if (value === "create") {
    return `<span class="pill success">Crear</span>`;
  }

  if (value === "error") {
    return `<span class="pill danger">Con errores</span>`;
  }

  return `<span class="pill">Revision</span>`;
}

function renderCredentialCard_(person) {
  const groupName = resolveGroupName_(person.grupo) || person.grupo || "Sin grupo";
  const visibleId = person.id || "SIN QR ID";
  const visibleName = person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "Sin nombre";
  const qrValue = buildCredentialQrValue_(person);

  return `
    <article class="credential-card">
      <div class="credential-card-head">
        <img src="assets/logo-conexion.png" alt="Conexion">
        <span class="credential-card-caption">Credencial Digital</span>
      </div>

      <div class="credential-qr-shell">
        <canvas
          class="credential-qr-canvas"
          data-role="credential-qr"
          data-qr-size="248"
          data-qr-value="${escapeHtml(qrValue)}"
        ></canvas>
      </div>

      <div class="credential-identity">
        <strong>${escapeHtml(visibleName)}</strong>
        <span class="credential-group-copy">${escapeHtml(`Grupo de conexion: ${groupName}`)}</span>
      </div>

      <div class="credential-id-block">
        <label>QR ID</label>
        <strong>${escapeHtml(visibleId)}</strong>
      </div>

      <div class="actions-row credential-actions">
        <button class="btn btn-secondary" data-action="download-single-credential" data-person-id="${escapeHtml(person.id || "")}">Descargar PNG</button>
        <button class="btn btn-primary" data-action="share-single-credential" data-person-id="${escapeHtml(person.id || "")}">Compartir</button>
        <button class="btn btn-ghost" data-action="print-single-credential" data-person-id="${escapeHtml(person.id || "")}">Imprimir esta credencial</button>
      </div>
    </article>
  `;
}

async function handleClick(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const { action } = button.dataset;

  try {
    if (action === "toggle-mobile-nav") {
      state.ui.mobileNavOpen = !state.ui.mobileNavOpen;
      renderApp();
      return;
    }

    if (action === "close-mobile-nav") {
      state.ui.mobileNavOpen = false;
      renderApp();
      return;
    }

    if (action === "save-api-url") {
      const value = document.getElementById("api-url-input")?.value?.trim();
      ensureApiUrl(value);
      state.apiUrl = value;
      setStoredApiUrl(value);
      showToast("Configuracion actualizada", "La URL de la API se guardo correctamente.", "success");
      renderApp();
      return;
    }

    if (action === "test-api-connection") {
      await testConnection();
      renderApp();
      return;
    }

    if (action === "scroll-to-section") {
      scrollToSection_(button.dataset.sectionId || "");
      return;
    }

    if (action === "navigate") {
      state.currentView = button.dataset.view;
      state.ui.mobileNavOpen = false;
      renderApp();
      scrollViewportToTop_();
      loadViewDataInBackground_(state.currentView);
      return;
    }

    if (action === "set-dashboard-period") {
      const range = getDefaultRecentRange_(Number(button.dataset.days || 30));
      state.filters.dashboard.recentFrom = range.from;
      state.filters.dashboard.recentTo = range.to;
      renderApp();
      return;
    }

    if (action === "set-congregants-period") {
      const range = getDefaultRecentRange_(Number(button.dataset.days || 30));
      state.filters.congregants.recentFrom = range.from;
      state.filters.congregants.recentTo = range.to;
      renderApp();
      return;
    }

    if (action === "open-dashboard-session-group") {
      state.filters.dashboard.groupId = button.dataset.groupId || "";
      await loadDashboardLeaderDetail_({
        force: true,
        message: "Abriendo detalle del grupo..."
      });
      renderApp();
      scrollToSection_("dashboard-leaders");
      return;
    }

    if (action === "refresh-app") {
      await bootstrapApplication();
      return;
    }

    if (action === "refresh-dashboard-executive") {
      await loadDashboardExecutive_({
        force: true,
        message: "Actualizando indicadores ejecutivos..."
      });
      await loadDashboardSeasonMatrix_({
        force: true,
        showLoading: false
      });

      if (state.filters.dashboard.groupId) {
        await loadDashboardLeaderDetail_({
          force: true,
          showLoading: false
        });
      }

      renderApp();
      return;
    }

    if (action === "export-dashboard-ranking") {
      const groupsRanking = state.dashboardExecutive?.groupsRanking || [];
      const seasonLabel = state.dashboardExecutive?.seasonFocus?.name || "dashboard";

      if (!groupsRanking.length) {
        showToast("Sin datos", "Todavia no hay ranking suficiente para exportar.", "warning");
        return;
      }

      downloadCsvTextFile_(
        buildDashboardRankingCsv_(),
        buildDashboardExportFileName_("DASHBOARD_RANKING", seasonLabel)
      );
      showToast("Exportacion lista", "Se descargo el ranking ejecutivo en CSV.", "success");
      return;
    }

    if (action === "load-dashboard-group-query") {
      if (!state.filters.dashboard.groupId) {
        showToast("Selecciona un grupo", "Elige un grupo antes de abrir la consulta para lideres.", "warning");
        return;
      }

      await loadDashboardLeaderDetail_({
        force: true,
        message: "Consultando grupo..."
      });
      renderApp();
      return;
    }

    if (action === "export-dashboard-group-detail") {
      if (!state.filters.dashboard.groupId) {
        showToast("Selecciona un grupo", "Elige un grupo antes de exportar el detalle.", "warning");
        return;
      }

      if (!state.dashboardLeaderDetail) {
        await loadDashboardLeaderDetail_({
          force: true,
          message: "Preparando exportacion del grupo..."
        });
      }

      if (!state.dashboardLeaderDetail?.people?.length) {
        showToast("Sin detalle", "Ese grupo todavia no tiene detalle suficiente para exportar.", "warning");
        return;
      }

      const groupRow = getDashboardSelectedGroupRow_();
      const groupLabel = groupRow?.groupName || `grupo_${state.filters.dashboard.groupId}`;
      downloadCsvTextFile_(
        buildDashboardGroupDetailCsv_(),
        buildDashboardExportFileName_("DASHBOARD_GRUPO", groupLabel)
      );
      showToast("Exportacion lista", "Se descargo el detalle del grupo en CSV.", "success");
      return;
    }

    if (action === "clear-dashboard-group-query") {
      state.filters.dashboard.groupId = "";
      state.dashboardLeaderDetail = null;
      renderApp();
      return;
    }

    if (action === "refresh-assistants") {
      await withLoading(async () => {
        await refreshPeopleSources_();
      }, "Actualizando padron...");
      renderApp();
      return;
    }

    if (action === "edit-group-catalog") {
      state.ui.editingGroupId = String(button.dataset.groupId || "");
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "clear-catalog-group-form") {
      state.ui.editingGroupId = "";
      renderApp();
      return;
    }

    if (action === "edit-ministry-catalog") {
      state.ui.editingMinistryId = String(button.dataset.ministryId || "");
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "clear-catalog-ministry-form") {
      state.ui.editingMinistryId = "";
      renderApp();
      return;
    }

    if (action === "edit-admin-user") {
      state.ui.editingUserEmail = String(button.dataset.userEmail || "");
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "clear-admin-user-form") {
      state.ui.editingUserEmail = "";
      renderApp();
      return;
    }

    if (action === "download-people-template") {
      downloadPeopleTemplate_();
      return;
    }

    if (action === "open-people-import") {
      const input = document.getElementById("people-import-file");
      if (input instanceof HTMLInputElement) {
        input.click();
      }
      return;
    }

    if (action === "clear-people-import") {
      clearPeopleImportState_();
      const input = document.getElementById("people-import-file");
      if (input instanceof HTMLInputElement) {
        input.value = "";
      }
      renderApp();
      return;
    }

    if (action === "start-people-import") {
      await importPreparedPeopleRows_();
      return;
    }

    if (action === "print-credential-preview") {
      printCredentialCards_(getFilteredPeopleDirectory_().slice(0, CREDENTIAL_PREVIEW_LIMIT), "Credenciales QR - Vista previa");
      return;
    }

    if (action === "print-credential-batch") {
      printCredentialCards_(getFilteredPeopleDirectory_(), "Credenciales QR - Lote completo");
      return;
    }

    if (action === "download-credential-batch") {
      await downloadCredentialBatchZip_(getFilteredPeopleDirectory_(), "Credenciales QR - Lote completo");
      return;
    }

    if (action === "print-single-credential") {
      const person = state.peopleDirectory.find((item) => String(item.id) === String(button.dataset.personId || ""));
      if (!person) {
        showToast("Credencial no disponible", "No se encontro la persona seleccionada para imprimir su credencial.", "warning");
        return;
      }

      printCredentialCards_([person], `Credencial QR - ${person.nombreCompleto || person.nombre || "Persona"}`);
      return;
    }

    if (action === "download-single-credential") {
      const person = state.peopleDirectory.find((item) => String(item.id) === String(button.dataset.personId || ""));
      if (!person) {
        showToast("Credencial no disponible", "No se encontro la persona seleccionada para descargar su credencial.", "warning");
        return;
      }

      await downloadCredentialPng_(person);
      return;
    }

    if (action === "share-single-credential") {
      const person = state.peopleDirectory.find((item) => String(item.id) === String(button.dataset.personId || ""));
      if (!person) {
        showToast("Credencial no disponible", "No se encontro la persona seleccionada para compartir su credencial.", "warning");
        return;
      }

      await shareCredentialPng_(person);
      return;
    }

    if (action === "logout") {
      clearStoredUser();
      resetRuntimeState();
      state.user = null;
      state.currentView = "login";
      renderApp();
      return;
    }

    if (action === "select-season") {
      state.filters.seasons.seasonId = button.dataset.seasonId || "";
      await ensureSessionsForSeason(state.filters.seasons.seasonId);
      renderApp();
      return;
    }

    if (action === "toggle-session-status") {
      await withLoading(async () => {
        await apiPost("sessions.setStatus", {
          sessionId: button.dataset.sessionId,
          status: button.dataset.status
        });
        delete state.sessionsBySeason[button.dataset.seasonId];
        await refreshSeasons();
        await ensureSessionsForSeason(button.dataset.seasonId);
      }, "Actualizando sesion...");

      showToast("Sesion actualizada", "El estado de la sesion se guardo correctamente.", "success");
      renderApp();
      return;
    }

    if (action === "load-participants") {
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (action === "add-person") {
      await addParticipant(button.dataset.personId);
      return;
    }

    if (action === "add-bulk-person") {
      toggleBulkSelection(String(button.dataset.personId || ""), true);
      renderApp();
      focusInputById_("participant-bulk-search");
      return;
    }

    if (action === "bulk-assign") {
      await bulkAssignParticipants();
      return;
    }

    if (action === "clear-bulk-selection") {
      state.selectedBulkPeople = [];
      renderApp();
      focusInputById_("participant-bulk-search");
      return;
    }

    if (action === "remove-bulk-person") {
      toggleBulkSelection(String(button.dataset.personId || ""), false);
      renderApp();
      focusInputById_("participant-bulk-search");
      return;
    }

    if (action === "move-participant") {
      const participantId = button.dataset.participantId;
      const targetGroupId = state.filters.participants.moveTargets[participantId] || "";

      if (!targetGroupId) {
        showToast("Falta grupo destino", "Selecciona un grupo antes de mover al participante.", "warning");
        return;
      }

      await withLoading(async () => {
        await apiPost("participants.changeGroup", {
          participantId,
          groupId: targetGroupId
        });
        delete state.filters.participants.moveTargets[participantId];
        invalidateDashboardSeasonMatrix_();
        await loadParticipantsData({
          force: true
        });
      }, "Moviendo participante...");

      showToast("Participante movido", "El cambio de grupo ya se reflejo en la lista.", "success");
      renderApp();
      return;
    }

    if (action === "deactivate-participant") {
      const participantId = button.dataset.participantId;
      const confirmed = window.confirm("Esta accion dara de baja al participante del grupo actual. Deseas continuar?");

      if (!confirmed) {
        return;
      }

      await withLoading(async () => {
        await apiPost("participants.deactivate", {
          participantId
        });
        delete state.filters.participants.moveTargets[participantId];
        invalidateDashboardSeasonMatrix_();
        await loadParticipantsData({
          force: true
        });
      }, "Dando de baja participante...");

      showToast("Participante dado de baja", "El registro quedo actualizado.", "success");
      renderApp();
      return;
    }

    if (action === "load-attendance") {
      await loadActiveSession();
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (action === "set-attendance-group") {
      const nextGroupId = String(button.dataset.groupId || "");

      if (!nextGroupId || state.filters.attendance.groupId === nextGroupId) {
        return;
      }

      state.filters.attendance.groupId = nextGroupId;
      state.filters.attendance.search = "";
      await loadAttendanceData();
      renderApp();
      scrollToSection_("attendance-list");
      focusInputById_("attendance-search");
      return;
    }

    if (action === "refresh-attendance-detail") {
      await loadAttendanceDetailOnly({
        force: true
      });
      renderApp();
      return;
    }

    if (action === "set-attendance-all") {
      setAttendanceForAll(button.dataset.value);
      renderApp();
      focusInputById_("attendance-search");
      return;
    }

    if (action === "set-attendance-visible") {
      setAttendanceForVisible(button.dataset.value);
      renderApp();
      focusInputById_("attendance-search");
      return;
    }

    if (action === "set-person-attendance") {
      const personId = String(button.dataset.personId || "");
      const nextValue = button.dataset.value === "SI" ? "SI" : "NO";

      if (!personId || state.attendanceForm[personId] === nextValue) {
        return;
      }

      setAttendanceForPerson_(personId, nextValue);
      syncAttendanceCardUi_(personId);
      syncAttendanceSummaryDom_();
      return;
    }

    if (action === "open-qr-operator") {
      syncAttendanceContextIntoQr_();
      state.filters.qr.surface = "scanner";
      state.filters.attendance.mode = "qr";
      state.currentView = "attendance";
      await loadQrSummary();
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "open-qr-kiosk") {
      syncAttendanceContextIntoQr_();
      state.filters.qr.surface = "kiosk";
      state.filters.attendance.mode = "kiosk";
      state.currentView = "attendance";
      await loadQrSummary();
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "set-attendance-mode") {
      const nextMode = button.dataset.mode === "kiosk"
        ? "kiosk"
        : (button.dataset.mode === "qr" ? "qr" : "manual");

      state.filters.attendance.mode = nextMode;

      if (nextMode === "manual") {
        state.currentView = "attendance";
        await loadActiveSession();
        await loadAttendanceData();
      } else {
        state.currentView = "attendance";
        state.filters.qr.surface = nextMode === "kiosk" ? "kiosk" : "scanner";
        await loadQrSummary();
      }

      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "start-kiosk-camera") {
      state.qrScanner.enabled = true;
      state.qrScanner.status = "starting";
      state.qrScanner.message = `Solicitando acceso a la camara ${getQrCameraLabel_(state.filters.qr.cameraFacing)} y preparando el lector...`;
      renderApp();
      return;
    }

    if (action === "stop-kiosk-camera") {
      state.qrScanner.enabled = false;
      state.qrScanner.status = "idle";
      state.qrScanner.message = "Camara detenida. Puedes volver a activarla cuando quieras.";
      stopQrScannerRuntime_(true);
      renderApp();
      return;
    }

    if (action === "toggle-kiosk-fullscreen") {
      await toggleKioskFullscreen_();
      return;
    }

    if (action === "clear-kiosk-result") {
      state.qrScanner.result = null;
      renderApp();
      return;
    }

    if (action === "set-kiosk-camera") {
      const nextFacing = button.dataset.cameraFacing === "front" ? "front" : "rear";
      if (state.filters.qr.cameraFacing === nextFacing) {
        return;
      }

      state.filters.qr.cameraFacing = nextFacing;
      state.qrScanner.result = null;

      if (state.qrScanner.enabled) {
        state.qrScanner.status = "starting";
        state.qrScanner.message = `Cambiando a camara ${getQrCameraLabel_(nextFacing)}...`;
        stopQrScannerRuntime_(true);
      } else {
        state.qrScanner.cameraFacing = "";
        state.qrScanner.message = `Camara ${getQrCameraLabel_(nextFacing)} lista para iniciar ${state.filters.qr.surface === "kiosk" ? "el kiosko" : "el escaneo asistido"}.`;
      }

      renderApp();
      return;
    }

    if (action === "set-qr-surface") {
      const nextSurface = button.dataset.surface === "kiosk" ? "kiosk" : "scanner";
      state.filters.qr.surface = nextSurface;
      renderApp();
      return;
    }

    if (action === "set-qr-mode") {
      state.filters.qr.mode = button.dataset.mode || "active";
      await loadQrSummary({
        force: true
      });
      renderApp();
      return;
    }

    if (action === "refresh-active-session") {
      await withLoading(async () => {
        await loadActiveSession();
        await loadQrSummary({
          force: true
        });
      }, "Consultando sesion activa...");
      renderApp();
      return;
    }

    if (action === "refresh-realtime") {
      await loadQrSummary({
        force: true
      });
      renderApp();
      return;
    }

    if (action === "register-qr-person") {
      await registerQrAttendance(button.dataset.personId || "");
      return;
    }
  } catch (error) {
    handleError(error);
  }
}

async function handleSubmit(event) {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  try {
    if (form.id === "login-form") {
      const email = form.email.value.trim();
      const password = form.password.value;

      ensureApiUrl(state.apiUrl);
      const data = await withLoading(() => apiPost("auth.login", {
        email,
        password
      }), "Validando credenciales...");

      state.user = data.user;
      setStoredUser(data.user);
      state.currentView = "dashboard";
      renderApp();
      showToast("Bienvenido", `Sesion iniciada como ${data.user.name}.`, "success");
      await bootstrapApplication({
        message: "Preparando dashboard..."
      });
      scrollViewportToTop_();

      return;
    }

    if (form.id === "season-create-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        const result = await apiPost("seasons.create", payload);
        await refreshSeasons();
        invalidateDashboardSeasonMatrix_();
        state.filters.seasons.seasonId = result.season.id;
        state.filters.participants.seasonId = result.season.id;
        state.filters.attendance.seasonId = result.season.id;
        state.filters.qr.seasonId = result.season.id;
        await syncAllFilters();
        await loadCurrentViewData();
      }, "Creando temporada...");

      showToast("Temporada creada", "La temporada, sesiones y grupos por sesion ya fueron generados.", "success");
      form.reset();
      renderApp();
      return;
    }

    if (form.id === "assistant-create-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveAssistant(payload);
      form.reset();
      renderApp();
      return;
    }

    if (form.id === "catalog-group-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        await apiPost("catalog.groups.save", payload);
        await loadGroupsCatalog_();
      }, payload.id ? "Actualizando grupo..." : "Creando grupo...");

      state.ui.editingGroupId = "";
      showToast("Catalogo actualizado", "El grupo quedo guardado correctamente.", "success");
      renderApp();
      return;
    }

    if (form.id === "catalog-ministry-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        await apiPost("catalog.ministries.save", payload);
        await loadMinistriesCatalog_();
      }, payload.id ? "Actualizando ministerio..." : "Creando ministerio...");

      state.ui.editingMinistryId = "";
      showToast("Catalogo actualizado", "El ministerio quedo guardado correctamente.", "success");
      renderApp();
      return;
    }

    if (form.id === "attendance-form") {
      await saveAttendanceCapture();
      return;
    }

    if (form.id === "admin-user-form") {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.permissions = formData.getAll("permissions");

      await withLoading(async () => {
        try {
          await apiPost("users.save", payload);
        } catch (error) {
          if (isUnknownActionError_(error, "users.save")) {
            throw buildBackendRouteMissingError_("users.save", "la ruta users.save");
          }

          throw error;
        }

        await loadAdminUsers_();
      }, payload.editingEmail ? "Actualizando usuario..." : "Creando usuario...");

      state.ui.editingUserEmail = "";
      showToast("Usuario guardado", "El perfil y sus accesos quedaron actualizados.", "success");
      renderApp();
      return;
    }

    if (form.id === "qr-form") {
      const personId = form.personId.value.trim();
      await registerQrAttendance(personId);
      return;
    }
  } catch (error) {
    handleError(error);
  }
}

async function handleChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  try {
    if (target.id === "assistants-status") {
      state.filters.assistants.status = target.value;
      renderApp();
      return;
    }

    if (target.id === "assistants-type") {
      state.filters.assistants.type = target.value;
      renderApp();
      return;
    }

    if (target.id === "dashboard-season") {
      state.filters.dashboard.seasonId = target.value;
      state.filters.dashboard.sessionId = "";
      state.dashboardLeaderDetail = null;
      invalidateDashboardSeasonMatrix_();
      await loadDashboardExecutive_({
        force: true,
        message: "Actualizando temporada ejecutiva..."
      });
      await loadDashboardSeasonMatrix_({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "dashboard-group") {
      state.filters.dashboard.groupId = target.value;
      state.dashboardLeaderDetail = null;
      renderApp();
      return;
    }

    if (target.id === "dashboard-recent-from") {
      state.filters.dashboard.recentFrom = target.value;
      renderApp();
      return;
    }

    if (target.id === "dashboard-recent-to") {
      state.filters.dashboard.recentTo = target.value;
      renderApp();
      return;
    }

    if (target.id === "congregants-recent-from") {
      state.filters.congregants.recentFrom = target.value;
      renderApp();
      return;
    }

    if (target.id === "congregants-recent-to") {
      state.filters.congregants.recentTo = target.value;
      renderApp();
      return;
    }

    if (target.id === "people-import-file" && target instanceof HTMLInputElement) {
      const file = target.files && target.files[0];
      if (file) {
        await processPeopleImportFile_(file);
        target.value = "";
        renderApp();
      }
      return;
    }

    if (target.id === "participants-season") {
      state.filters.participants.seasonId = target.value;
      state.filters.participants.sessionId = "";
      state.filters.participants.groupId = "";
      resetParticipantInteractionState_();
      await syncFilterState("participants");
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "participants-session") {
      state.filters.participants.sessionId = target.value;
      state.filters.participants.groupId = "";
      resetParticipantInteractionState_();
      await syncFilterState("participants");
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "participants-group") {
      state.filters.participants.groupId = target.value;
      resetParticipantInteractionState_();
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "attendance-season") {
      state.filters.attendance.seasonId = target.value;
      state.filters.attendance.sessionId = "";
      state.filters.attendance.groupId = "";
      state.filters.attendance.search = "";
      await syncFilterState("attendance");
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (target.id === "attendance-session") {
      state.filters.attendance.sessionId = target.value;
      state.filters.attendance.groupId = "";
      state.filters.attendance.search = "";
      await syncFilterState("attendance");
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (target.id === "attendance-group") {
      state.filters.attendance.groupId = target.value;
      state.filters.attendance.search = "";
      await loadAttendanceData();
      renderApp();
      focusInputById_("attendance-search");
      return;
    }

    if (target.id === "qr-season") {
      state.filters.qr.seasonId = target.value;
      state.filters.qr.sessionId = "";
      await syncFilterState("qr");
      await loadQrSummary();
      renderApp();
      return;
    }

    if (target.id === "qr-session") {
      state.filters.qr.sessionId = target.value;
      await loadQrSummary();
      renderApp();
      return;
    }

    if (target.dataset.role === "move-target") {
      state.filters.participants.moveTargets[target.dataset.participantId] = target.value;
      renderApp();
      return;
    }

  } catch (error) {
    handleError(error);
  }
}

function handleInput(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.id === "api-url-input") {
    state.apiUrl = target.value;
    return;
  }

  if (target.id === "assistants-search") {
    state.filters.assistants.search = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "participant-people-search") {
    state.filters.participants.peopleSearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "participant-bulk-search") {
    state.filters.participants.bulkSearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "attendance-search") {
    state.filters.attendance.search = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "qr-people-search") {
    state.filters.qr.peopleSearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "admin-user-search") {
    state.filters.admin.userSearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "admin-group-search") {
    state.filters.admin.groupSearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "admin-ministry-search") {
    state.filters.admin.ministrySearch = target.value;
    rerenderPreservingInput_(target);
    return;
  }

  if (target.id === "qr-person-id") {
    state.filters.qr.personId = target.value;
  }
}

async function bootstrapApplication(options = {}) {
  const task = async () => {
    await loadBootstrapData_();
    syncBootstrapFilters_();

    if (state.currentView !== "dashboard") {
      await loadCurrentViewData();
    }
  };

  if (options.showLoading === false) {
    await task();
  } else {
    await withLoading(task, options.message || "Preparando dashboard...");
  }

  renderApp();
  warmDashboardExecutiveInBackground_();
  warmCommonDataInBackground_();
}

async function loadCurrentViewData(options = {}) {
  if (!state.user) {
    return;
  }

  switch (state.currentView) {
    case "dashboard":
      await ensureDashboardViewData_(options);
      return;
    case "assistants":
    case "congregants-new":
      await ensureAssistantsViewData_(options);
      return;
    case "catalogs":
      await ensureCatalogsViewData_(options);
      return;
    case "seasons":
      await ensureSeasonViewData(options);
      return;
    case "participants":
      await ensureParticipantsViewData_(options);
      return;
    case "attendance":
      if (resolveConnectionAttendanceMode_() === "manual") {
        await loadActiveSession();
        await loadAttendanceData(options);
      } else {
        await ensureQrViewData_(options);
      }
      return;
    case "qr":
      await ensureQrViewData_(options);
      return;
    case "admin-settings":
    case "admin-users":
      await ensureAdminViewData_(options);
      return;
    default:
      await ensureSessionsForSeason(getLatestSeason()?.id || "");
  }
}

function runSharedLoad_(key, task) {
  if (pendingResourceLoads[key]) {
    return pendingResourceLoads[key];
  }

  pendingResourceLoads[key] = Promise.resolve()
    .then(task)
    .finally(() => {
      pendingResourceLoads[key] = null;
    });

  return pendingResourceLoads[key];
}

async function loadBootstrapData_() {
  return runSharedLoad_("bootstrap", async () => {
    try {
      applyAppBootstrapPayload_(await apiGet("app.bootstrap"));
      state.loaded.bootstrap = true;
      return;
    } catch (error) {
      if (!shouldFallbackToLegacyBootstrap_(error)) {
        throw error;
      }
    }

    await loadLegacyBootstrapData_();
    state.loaded.bootstrap = true;
  });
}

function shouldFallbackToLegacyBootstrap_(error) {
  return error instanceof ApiError && error.code !== "NETWORK_ERROR";
}

function applyAppBootstrapPayload_(payload) {
  const latestSeason = Array.isArray(payload.seasons) && payload.seasons.length
    ? payload.seasons[payload.seasons.length - 1]
    : null;

  state.catalogs.groups = Array.isArray(payload.groups) ? payload.groups : [];
  state.loaded.groups = true;
  state.seasons = Array.isArray(payload.seasons) ? payload.seasons : [];
  state.loaded.seasons = true;
  state.activeSession = payload.activeSession || null;
  state.loaded.activeSession = true;
  state.metrics.peopleCount = toOptionalNumber_(payload.metrics && payload.metrics.peopleCount);
  state.metrics.directoryCount = toOptionalNumber_(payload.metrics && payload.metrics.directoryCount);
  state.sessionsBySeason = {};
  state.sessionGroupsByKey = {};

  if (latestSeason && Array.isArray(payload.latestSeasonSessions)) {
    state.sessionsBySeason[latestSeason.id] = payload.latestSeasonSessions;
  }
}

async function loadLegacyBootstrapData_() {
  state.sessionsBySeason = {};
  state.sessionGroupsByKey = {};

  await Promise.all([
    loadGroupsCatalog_(),
    refreshSeasons(),
    loadActiveSession()
  ]);

  if (getLatestSeason()) {
    await ensureSessionsForSeason(getLatestSeason().id);
  }
}

function syncBootstrapFilters_() {
  initializeDateFilters_();
  state.filters.dashboard.seasonId = ensureValidSeasonId(state.filters.dashboard.seasonId);
  if (!state.catalogs.groups.some((group) => String(group.id) === String(state.filters.dashboard.groupId))) {
    state.filters.dashboard.groupId = "";
  }
  state.filters.seasons.seasonId = ensureValidSeasonId(state.filters.seasons.seasonId);
}

async function loadCatalogs(options = {}) {
  await loadGroupsCatalog_();

  if (options.includeMinistries) {
    await loadMinistriesCatalog_();
  }
}

async function loadGroupsCatalog_() {
  return runSharedLoad_("groups", async () => {
    state.catalogs.groups = await apiGet("catalog.groups.list");
    state.loaded.groups = true;
    return state.catalogs.groups;
  });
}

async function loadMinistriesCatalog_() {
  return runSharedLoad_("ministries", async () => {
    state.catalogs.ministries = await apiGet("catalog.ministries.list");
    state.loaded.ministries = true;
    return state.catalogs.ministries;
  });
}

async function refreshSeasons() {
  return runSharedLoad_("seasons", async () => {
    state.seasons = await apiGet("seasons.list");
    state.loaded.seasons = true;
    return state.seasons;
  });
}

async function loadPeople() {
  return runSharedLoad_("people", async () => {
    state.people = await apiGet("people.list");
    state.metrics.peopleCount = state.people.length;
    state.loaded.people = true;
    return state.people;
  });
}

async function loadPeopleDirectory() {
  return runSharedLoad_("peopleDirectory", async () => {
    state.peopleDirectory = await apiGet("servers.list");
    state.metrics.directoryCount = state.peopleDirectory.length;
    state.loaded.peopleDirectory = true;
    return state.peopleDirectory;
  });
}

async function loadActiveSession() {
  return runSharedLoad_("activeSession", async () => {
    state.activeSession = await apiGet("sessions.active");
    state.loaded.activeSession = true;
    return state.activeSession;
  });
}

async function loadAdminUsers_(options = {}) {
  return runSharedLoad_("users", async () => {
    try {
      state.adminUsers = await apiGet("users.list");
      state.adminUsersSupport = {
        available: true,
        message: ""
      };
      state.loaded.users = true;
      return state.adminUsers;
    } catch (error) {
      if (!isUnknownActionError_(error, "users.list")) {
        throw error;
      }

      state.adminUsers = [];
      state.adminUsersSupport = {
        available: false,
        message: "La administracion de usuarios aun no esta publicada en tu backend actual. Actualiza los archivos .gs y vuelve a desplegar."
      };
      state.loaded.users = true;

      if (options.silentUnsupported) {
        return state.adminUsers;
      }

      throw buildBackendRouteMissingError_("users.list", "la ruta users.list");
    }
  });
}

async function refreshPeopleSources_() {
  await Promise.all([
    loadPeople(),
    loadPeopleDirectory()
  ]);
}

function syncDashboardFilterState_() {
  state.filters.dashboard.seasonId = ensureValidSeasonId(state.filters.dashboard.seasonId);

  if (!state.filters.dashboard.recentFrom || !state.filters.dashboard.recentTo) {
    initializeDateFilters_();
  }

  if (!state.catalogs.groups.some((group) => String(group.id) === String(state.filters.dashboard.groupId))) {
    state.filters.dashboard.groupId = "";
  }
}

async function ensureDashboardSessionFilterState_() {
  syncDashboardFilterState_();

  const seasonId = state.filters.dashboard.seasonId;
  const sessions = await ensureSessionsForSeason(seasonId);
  const activeSession = getActiveAttendanceSession_();
  const activeMatchesSeason = activeSession && String(activeSession.seasonId) === String(seasonId);

  if (!sessions.some((session) => String(session.id) === String(state.filters.dashboard.sessionId))) {
    state.filters.dashboard.sessionId = activeMatchesSeason
      ? activeSession.id
      : (sessions[sessions.length - 1]?.id || sessions[0]?.id || "");
  }
}

async function loadDashboardExecutive_(options = {}) {
  syncDashboardFilterState_();

  const seasonId = state.filters.dashboard.seasonId;
  const currentSeasonId = state.dashboardExecutive?.seasonFocus?.id || "";

  if (!options.force && state.dashboardExecutive && currentSeasonId === seasonId) {
    return state.dashboardExecutive;
  }

  const task = async () => {
    state.dashboardExecutive = await apiGet("dashboard.executive", {
      seasonId
    });
    return state.dashboardExecutive;
  };

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Calculando dashboard ejecutivo...");
}

async function loadDashboardLeaderDetail_(options = {}) {
  syncDashboardFilterState_();

  const seasonId = state.filters.dashboard.seasonId;
  const groupId = state.filters.dashboard.groupId;
  const currentDetailSeasonId = state.dashboardLeaderDetail?.seasonId || "";
  const currentDetailGroupId = String(state.dashboardLeaderDetail?.groupId || "");

  if (!seasonId || !groupId) {
    state.dashboardLeaderDetail = null;
    return null;
  }

  if (!options.force && state.dashboardLeaderDetail && currentDetailSeasonId === seasonId && currentDetailGroupId === String(groupId)) {
    return state.dashboardLeaderDetail;
  }

  const task = async () => {
    state.dashboardLeaderDetail = await apiGet("attendances.groupDetail", {
      seasonId,
      groupId
    });
    return state.dashboardLeaderDetail;
  };

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Consultando grupo...");
}

async function ensureAssistantsViewData_() {
  if (!state.loaded.peopleDirectory) {
    await loadPeopleDirectory();
  }
}

async function ensureCatalogsViewData_() {
  await loadCatalogs({
    includeMinistries: true
  });
}

async function ensureParticipantsViewData_(options = {}) {
  if (!state.loaded.people) {
    await loadPeople();
  }

  await loadParticipantsData(options);
}

async function ensureDashboardViewData_() {
  syncDashboardFilterState_();
  await loadDashboardExecutive_({
    showLoading: false
  });
  await loadPeopleDirectory();
  await loadDashboardSeasonMatrix_({
    showLoading: false
  });

  if (state.filters.dashboard.groupId) {
    await loadDashboardLeaderDetail_({
      showLoading: false
    });
  }
}

async function ensureAdminViewData_() {
  await loadCatalogs({
    includeMinistries: true
  });
  await loadAdminUsers_({
    silentUnsupported: true
  });
}

async function ensureQrViewData_(options = {}) {
  if (!state.loaded.people) {
    await loadPeople();
  }

  await loadQrSummary(options);
}

function warmDashboardExecutiveInBackground_() {
  if (!state.user || state.currentView !== "dashboard") {
    return;
  }

  void ensureDashboardViewData_()
    .then(() => {
      if (state.currentView === "dashboard") {
        renderApp();
      }
    })
    .catch(() => {});
}

function warmCommonDataInBackground_() {
  if (!state.user || (state.loaded.people && state.loaded.peopleDirectory)) {
    return;
  }

  void Promise.all([
    state.loaded.people || pendingResourceLoads.people ? Promise.resolve() : loadPeople(),
    state.loaded.peopleDirectory || pendingResourceLoads.peopleDirectory ? Promise.resolve() : loadPeopleDirectory()
  ])
    .then(() => {
      if (state.currentView === "dashboard") {
        renderApp();
      }
    })
    .catch(() => {});
}

async function ensureSessionsForSeason(seasonId) {
  const cleanSeasonId = String(seasonId || "");

  if (!cleanSeasonId) {
    return [];
  }

  if (!state.sessionsBySeason[cleanSeasonId]) {
    state.sessionsBySeason[cleanSeasonId] = await apiGet("sessions.list", {
      seasonId: cleanSeasonId
    });
  }

  return state.sessionsBySeason[cleanSeasonId];
}

async function ensureSeasonViewData() {
  const seasonId = state.filters.seasons.seasonId;
  const sessions = await ensureSessionsForSeason(seasonId);

  if (seasonId && sessions.length) {
    await ensureSessionGroupsFor(seasonId, sessions[0].id);
  }
}

async function loadDashboardSessionInsights_(options = {}) {
  await ensureDashboardSessionFilterState_();

  const seasonId = state.filters.dashboard.seasonId;
  const sessionId = state.filters.dashboard.sessionId;
  const cacheKey = `${seasonId}::${sessionId}`;

  if (!seasonId || !sessionId) {
    state.dashboardSessionInsights = null;
    return null;
  }

  if (!options.force && state.dashboardSessionInsights?.key === cacheKey) {
    return state.dashboardSessionInsights;
  }

  const task = async () => {
    if (!state.loaded.peopleDirectory) {
      await loadPeopleDirectory();
    }

    const [sessionGroups, participants, attendances] = await Promise.all([
      ensureSessionGroupsFor(seasonId, sessionId),
      apiGet("participants.list", {
        seasonId,
        sessionId,
        status: "ACTIVO"
      }),
      apiGet("attendances.list", {
        seasonId,
        sessionId
      })
    ]);

    state.dashboardSessionInsights = buildDashboardSessionInsights_({
      seasonId,
      sessionId,
      sessionGroups,
      participants,
      attendances
    });

    return state.dashboardSessionInsights;
  };

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Calculando sesion ejecutiva...");
}

async function loadDashboardSeasonMatrix_(options = {}) {
  syncDashboardFilterState_();

  const seasonId = state.filters.dashboard.seasonId || getLatestSeason()?.id || "";
  const cacheKey = String(seasonId || "");

  if (!seasonId) {
    state.dashboardSeasonMatrix = null;
    state.cacheKeys.dashboardSeasonMatrix = "";
    return null;
  }

  if (!options.force && state.cacheKeys.dashboardSeasonMatrix === cacheKey && state.dashboardSeasonMatrix) {
    return state.dashboardSeasonMatrix;
  }

  const task = async () => {
    const sessions = await ensureSessionsForSeason(seasonId);
    const sessionGroupsList = await Promise.all(
      sessions.map((session) => ensureSessionGroupsFor(seasonId, session.id))
    );
    const participantsList = await Promise.all(
      sessions.map((session) => apiGet("participants.list", {
        seasonId,
        sessionId: session.id,
        status: "ACTIVO"
      }))
    );
    const sessionGroupsBySession = {};
    const participantsBySession = {};
    const seasonName = resolveSeasonName_(seasonId) || sessions[0]?.seasonName || "";

    sessions.forEach((session, index) => {
      sessionGroupsBySession[String(session.id)] = sessionGroupsList[index] || [];
      participantsBySession[String(session.id)] = participantsList[index] || [];
    });

    state.dashboardSeasonMatrix = buildDashboardSeasonMatrix_({
      seasonId,
      seasonName,
      sessions,
      sessionGroupsBySession,
      participantsBySession
    });
    state.cacheKeys.dashboardSeasonMatrix = cacheKey;
    return state.dashboardSeasonMatrix;
  };

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Preparando matriz pastoral...");
}

async function ensureSessionGroupsFor(seasonId, sessionId) {
  const cleanSeasonId = String(seasonId || "");
  const cleanSessionId = String(sessionId || "");

  if (!cleanSeasonId || !cleanSessionId) {
    return [];
  }

  const key = `${cleanSeasonId}::${cleanSessionId}`;

  if (!state.sessionGroupsByKey[key]) {
    state.sessionGroupsByKey[key] = await apiGet("sessionGroups.list", {
      seasonId: cleanSeasonId,
      sessionId: cleanSessionId
    });
  }

  return state.sessionGroupsByKey[key];
}

async function syncAllFilters() {
  state.filters.seasons.seasonId = ensureValidSeasonId(state.filters.seasons.seasonId);
  await syncFilterState("participants");
  await syncFilterState("attendance");
  await syncFilterState("qr");
}

async function syncFilterState(viewName) {
  const filter = state.filters[viewName];

  if (!filter) {
    return;
  }

  if (viewName === "attendance") {
    await syncAttendanceFilterState_();
    return;
  }

  filter.seasonId = ensureValidSeasonId(filter.seasonId);

  const sessions = await ensureSessionsForSeason(filter.seasonId);
  if (!sessions.some((item) => item.id === filter.sessionId)) {
    filter.sessionId = sessions[0] ? sessions[0].id : "";
  }

  const groups = await ensureSessionGroupsFor(filter.seasonId, filter.sessionId);
  if (!groups.some((item) => String(item.groupId) === String(filter.groupId))) {
    filter.groupId = groups[0] ? String(groups[0].groupId) : "";
  }
}

function ensureValidSeasonId(currentSeasonId) {
  if (!state.seasons.length) {
    return "";
  }

  const exists = state.seasons.some((season) => season.id === currentSeasonId);
  if (exists) {
    return currentSeasonId;
  }

  return getLatestSeason()?.id || "";
}

async function loadParticipantsData(options = {}) {
  await syncFilterState("participants");

  const filter = state.filters.participants;
  const requestKey = `${filter.seasonId}::${filter.sessionId}::${filter.groupId}`;

  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    resetParticipantInteractionState_();
    state.participants = [];
    state.participantContext = null;
    state.cacheKeys.participants = "";
    return;
  }

  if (!options.force && state.cacheKeys.participants === requestKey && state.participantContext) {
    return;
  }

  const task = async () => {
    const [participants, context] = await Promise.all([
      apiGet("participants.list", {
        seasonId: filter.seasonId,
        sessionId: filter.sessionId,
        groupId: filter.groupId
      }),
      apiGet("participants.groupContext", {
        seasonId: filter.seasonId,
        sessionId: filter.sessionId,
        groupId: filter.groupId
      })
    ]);

    state.participants = participants;
    state.participantContext = context;
    state.filters.participants.moveTargets = {};
    state.cacheKeys.participants = requestKey;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, "Cargando participantes...");
}

async function saveAssistant(rawPayload) {
  const payload = sanitizeAssistantPayload_(rawPayload);
  const existing = findExistingPersonMatch_(payload);

  if (existing) {
    showToast(
      "Registro duplicado",
      `Ya existe ${existing.nombreCompleto || existing.nombre || "esta persona"} con el folio ${existing.numero || existing.id}.`,
      "warning"
    );
    return;
  }

  await withLoading(async () => {
    await apiPost("servers.save", payload);
    await refreshPeopleSources_();
  }, "Guardando congregante...");

  showToast("Congregante guardado", "La persona ya forma parte del padron base del sistema.", "success");
}

async function processPeopleImportFile_(file) {
  await withLoading(async () => {
    ensureXlsxLoaded_();
    const rows = await readWorkbookRows_(file);
    const preparedRows = prepareImportedPeopleRows_(rows);

    state.peopleImport.fileName = file.name;
    state.peopleImport.rows = preparedRows;
    state.peopleImport.summary = summarizePreparedPeopleRows_(preparedRows);
    state.peopleImport.progress = null;
  }, "Leyendo archivo de importacion...");

  showToast("Archivo cargado", `Se prepararon ${state.peopleImport.summary?.totalRows || 0} filas para revision.`, "success");
}

async function importPreparedPeopleRows_() {
  const validRows = state.peopleImport.rows.filter((row) => !row.errors.length);

  if (!validRows.length) {
    showToast("Sin registros validos", "Carga un archivo con al menos una fila valida antes de importar.", "warning");
    return;
  }

  state.peopleImport.progress = {
    phase: "Importando",
    total: validRows.length,
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0
  };
  renderApp();

  try {
    showLoading("Iniciando importacion...");

    for (const row of validRows) {
      setLoadingMessage_(`Importando fila ${row.rowNumber} de ${row.sourceTotalRows}...`);

      try {
        await apiPost("servers.save", row.payload);
        state.peopleImport.progress.processed += 1;

        if (row.operation === "update") {
          state.peopleImport.progress.updated += 1;
        } else {
          state.peopleImport.progress.created += 1;
        }
      } catch (error) {
        state.peopleImport.progress.processed += 1;
        state.peopleImport.progress.failed += 1;
        row.errors.push(error instanceof Error ? error.message : "No se pudo guardar el registro.");
      }
    }
  } finally {
    hideLoading();
  }

  state.peopleImport.progress.phase = state.peopleImport.progress.failed ? "Importacion completada con observaciones" : "Importacion completada";
  state.peopleImport.summary = summarizePreparedPeopleRows_(state.peopleImport.rows);

  await refreshPeopleSources_();
  renderApp();

  showToast(
    "Importacion finalizada",
    `Creados: ${state.peopleImport.progress.created}, actualizados: ${state.peopleImport.progress.updated}, fallidos: ${state.peopleImport.progress.failed}.`,
    state.peopleImport.progress.failed ? "warning" : "success"
  );
}

function downloadPeopleTemplate_() {
  const headers = [[
    "NOMBRE",
    "APELLIDOS",
    "EDAD",
    "ESTADO_CIVIL",
    "ANIO_NACIMIENTO",
    "TELEFONO",
    "EMAIL",
    "MINISTERIO1",
    "MINISTERIO2",
    "MINISTERIO3",
    "MINISTERIO4",
    "GRUPO",
    "FECHA",
    "TIPO_PERSONA",
    "FECHA_NACIMIENTO"
  ]];

  if (typeof window.XLSX === "function" || window.XLSX?.utils) {
    const worksheet = window.XLSX.utils.aoa_to_sheet(headers);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "ASISTENTES");
    window.XLSX.writeFile(workbook, "PLANTILLA_ASISTENTES_V2.xlsx");
    return;
  }

  downloadFallbackTemplateCsv_(headers[0]);
}

function clearPeopleImportState_() {
  state.peopleImport = {
    fileName: "",
    rows: [],
    summary: null,
    progress: null
  };
}

async function addParticipant(personId) {
  const filter = state.filters.participants;
  let createdParticipant = null;
  ensureContextReady(filter, "participantes");

  await withLoading(async () => {
    createdParticipant = await apiPost("participants.add", {
      seasonId: filter.seasonId,
      sessionId: filter.sessionId,
      groupId: filter.groupId,
      personId
    });
  }, "Agregando participante...");

  invalidateDashboardSeasonMatrix_();
  mergeParticipantsIntoCurrentContext_([createdParticipant]);
  showToast("Participante agregado", "La persona ya fue agregada al grupo actual.", "success");
  renderApp();
  focusInputById_("participant-people-search");
}

async function bulkAssignParticipants() {
  const filter = state.filters.participants;
  const selectedPeople = getSelectedBulkPeople_();
  const seasonName = resolveSeasonName_(filter.seasonId) || filter.seasonId;
  const groupName = state.participantContext ? state.participantContext.group.name : (resolveGroupName_(filter.groupId) || filter.groupId);
  const sessionCount = getSessions(filter.seasonId).length;
  let assignmentResult = null;
  ensureContextReady(filter, "asignacion masiva");

  if (!selectedPeople.length) {
    showToast("Sin seleccion", "Selecciona al menos una persona para la asignacion masiva.", "warning");
    return;
  }

  if (!window.confirm(`Se asignaran ${selectedPeople.length} persona(s) al grupo ${groupName} durante ${sessionCount} sesion(es) de ${seasonName}. Deseas continuar?`)) {
    return;
  }

  await withLoading(async () => {
    assignmentResult = await apiPost("participants.bulkAssign", {
      seasonId: filter.seasonId,
      groupId: filter.groupId,
      people: state.selectedBulkPeople.map((personId) => ({ personId }))
    });
    state.selectedBulkPeople = [];
  }, "Asignando participantes...");

  invalidateDashboardSeasonMatrix_();
  mergeParticipantsIntoCurrentContext_((assignmentResult && assignmentResult.inserted) || []);
  showToast(
    "Asignacion completada",
    `Se asignaron ${assignmentResult?.totalPeople || selectedPeople.length} persona(s) a ${sessionCount} sesion(es). En esta sesion quedaron ${state.participants.length} participantes activos.`,
    "success"
  );
  renderApp();
  focusInputById_("participant-bulk-search");
}

async function loadAttendanceData(options = {}) {
  await syncFilterState("attendance");

  const filter = state.filters.attendance;
  const requestKey = `${filter.seasonId}::${filter.sessionId}::${filter.groupId}`;

  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    state.attendanceContext = null;
    state.attendanceDetail = null;
    state.attendanceForm = {};
    state.attendanceBaseline = {};
    state.cacheKeys.attendance = "";
    return;
  }

  if (!options.force && state.cacheKeys.attendance === requestKey && state.attendanceContext) {
    return;
  }

  const task = async () => {
    const context = await apiGet("attendances.captureContext", {
      seasonId: filter.seasonId,
      sessionId: filter.sessionId,
      groupId: filter.groupId
    });

    state.attendanceContext = context;
    state.attendanceDetail = null;
    state.attendanceForm = {};
    state.attendanceBaseline = {};

    context.participants.forEach((participant) => {
      const normalizedValue = participant.attendance === "SI" ? "SI" : "NO";
      state.attendanceForm[participant.personId] = normalizedValue;
      state.attendanceBaseline[participant.personId] = normalizedValue;
    });
    state.cacheKeys.attendance = requestKey;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, "Cargando lista de asistencia...");
}

async function syncAttendanceFilterState_() {
  const filter = state.filters.attendance;
  const activeSession = getActiveAttendanceSession_();

  if (!activeSession) {
    filter.seasonId = "";
    filter.sessionId = "";
    filter.groupId = "";
    return;
  }

  const sessionChanged = filter.seasonId !== activeSession.seasonId || filter.sessionId !== activeSession.id;
  filter.seasonId = activeSession.seasonId;
  filter.sessionId = activeSession.id;

  await ensureSessionsForSeason(filter.seasonId);
  const groups = await ensureSessionGroupsFor(filter.seasonId, filter.sessionId);

  if (sessionChanged) {
    filter.groupId = "";
  }

  if (!groups.some((item) => String(item.groupId) === String(filter.groupId))) {
    filter.groupId = "";
  }
}

async function loadAttendanceDetailOnly(options = {}) {
  const filter = state.filters.attendance;
  const requestKey = `${filter.seasonId}::${filter.groupId}`;
  ensureContextReady(filter, "detalle de asistencia");

  if (!options.force && state.cacheKeys.attendanceDetail === requestKey && state.attendanceDetail) {
    return;
  }

  const task = async () => {
    state.attendanceDetail = await apiGet("attendances.groupDetail", {
      seasonId: filter.seasonId,
      groupId: filter.groupId
    });
    state.cacheKeys.attendanceDetail = requestKey;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, "Actualizando detalle historico...");
}

async function saveAttendanceCapture() {
  const filter = state.filters.attendance;
  const summary = buildAttendanceSummary();
  ensureContextReady(filter, "captura de asistencia");

  const attendances = Object.entries(state.attendanceForm).map(([personId, attended]) => ({
    personId,
    attended
  }));

  if (!attendances.length) {
    showToast("Sin participantes", "No hay registros para guardar en esta captura.", "warning");
    return;
  }

  if (state.attendanceContext && state.attendanceContext.alreadyCaptured && summary.changed === 0) {
    showToast("Sin cambios", "No hay cambios nuevos por guardar en esta captura.", "warning");
    return;
  }

  await withLoading(async () => {
    await apiPost(
      state.attendanceContext && state.attendanceContext.alreadyCaptured ? "attendances.editCapture" : "attendances.capture",
      {
        seasonId: filter.seasonId,
        sessionId: filter.sessionId,
        groupId: filter.groupId,
        attendances
      }
    );

    await loadAttendanceData({
      force: true
    });
  }, "Guardando asistencia...");

  showToast("Asistencia guardada", "La captura quedo registrada correctamente.", "success");
  renderApp();
}

async function loadQrSummary(options = {}) {
  const context = resolveQrContext();

  if (!context) {
    state.realtimeSummary = null;
    state.qrSessionActivity = [];
    state.cacheKeys.qrSummary = "";
    return;
  }

  const requestKey = `${context.seasonId}::${context.sessionId}`;

  if (!options.force && state.cacheKeys.qrSummary === requestKey && state.realtimeSummary) {
    return;
  }

  const task = async () => {
    const [summary, attendances] = await Promise.all([
      apiGet("attendances.realtimeSummary", {
        seasonId: context.seasonId,
        sessionId: context.sessionId
      }),
      apiGet("attendances.list", {
        seasonId: context.seasonId,
        sessionId: context.sessionId
      })
    ]);

    state.realtimeSummary = summary;
    state.qrSessionActivity = buildQrSessionActivity_(attendances);
    state.cacheKeys.qrSummary = requestKey;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, "Consultando resumen...");
}

async function registerQrAttendance(personId, options = {}) {
  const cleanPersonId = String(personId || "").trim();
  if (!cleanPersonId) {
    showToast("Falta QR ID", "Escribe o selecciona un QR ID valido.", "warning");
    return;
  }

  const context = resolveQrContext();
  const payload = {
    personId: cleanPersonId
  };

  if (state.filters.qr.mode === "manual") {
    if (!context || !context.seasonId || !context.sessionId) {
      throw new ApiError("Selecciona temporada y sesion antes de registrar un QR en modo manual.", "MISSING_QR_CONTEXT");
    }
    payload.seasonId = context.seasonId;
    payload.sessionId = context.sessionId;
  }

  const source = options.source || "manual";
  const task = async () => {
    state.qrLastResult = await apiPost("qr.registerAttendance", payload);
    state.qrScanner.result = buildQrSuccessResult_(state.qrLastResult, cleanPersonId, source);
    state.qrScanner.status = "success";
    state.qrScanner.message = state.qrScanner.result.message;
    state.filters.qr.personId = "";
    await loadActiveSession();
    await loadQrSummary({
      showLoading: options.showLoading !== false,
      force: true
    });
  };

  try {
    if (options.showLoading === false) {
      await task();
    } else {
      await withLoading(task, "Registrando asistencia QR...");
    }

    if (!options.suppressToast) {
      showToast("Registro exitoso", "La asistencia se guardo desde el modulo QR/Kiosko.", "success");
    }

    playKioskSignal_(state.qrScanner.result?.tone || "success");
    renderApp();
  } catch (error) {
    state.qrScanner.result = buildQrFailureResult_(error, cleanPersonId);
    state.qrScanner.status = state.qrScanner.result.tone === "warning" ? "warning" : "error";
    state.qrScanner.message = state.qrScanner.result.message;
    playKioskSignal_(state.qrScanner.result.tone);

    if (!options.suppressToast) {
      throw error;
    }

    renderApp();
  }
}

async function ensureQrScannerStarted_() {
  if (!state.qrScanner.enabled) {
    return;
  }

  const video = document.getElementById("qr-kiosk-video");
  if (!(video instanceof HTMLVideoElement)) {
    return;
  }

  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    throwQrScannerError_("UNSUPPORTED_QR_SCANNER", "El kiosko con camara requiere HTTPS o localhost para acceder al video.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throwQrScannerError_("UNSUPPORTED_QR_SCANNER", "Este navegador no permite acceder a la camara para el kiosko.");
    return;
  }

  if (!qrScannerRuntime.detector) {
    if ("BarcodeDetector" in window) {
      qrScannerRuntime.detector = new window.BarcodeDetector({
        formats: ["qr_code"]
      });
      qrScannerRuntime.engine = "native";
    } else if (typeof window.jsQR === "function") {
      qrScannerRuntime.detector = {
        detect() {
          return [];
        }
      };
      qrScannerRuntime.engine = "jsqr";
      qrScannerRuntime.canvas = document.createElement("canvas");
      qrScannerRuntime.context = qrScannerRuntime.canvas.getContext("2d", {
        willReadFrequently: true
      });
    } else {
      throwQrScannerError_("UNSUPPORTED_QR_SCANNER", "No se encontro un motor de lectura QR compatible. Recarga la pagina y vuelve a intentar.");
      return;
    }
  }

  if (!qrScannerRuntime.stream) {
    try {
      qrScannerRuntime.stream = await requestQrCameraStream_(state.filters.qr.cameraFacing);
    } catch (error) {
      throwQrScannerError_("CAMERA_PERMISSION_DENIED", "No se pudo abrir la camara. Revisa permisos del navegador y vuelve a intentar.");
      return;
    }
  }

  if (video.srcObject !== qrScannerRuntime.stream) {
    video.srcObject = qrScannerRuntime.stream;
  }

  try {
    await video.play();
  } catch (error) {
    throwQrScannerError_("CAMERA_PERMISSION_DENIED", "La camara no pudo iniciar correctamente en esta pantalla.");
    return;
  }

  state.qrScanner.cameraFacing = resolveQrCameraFacingFromStream_(qrScannerRuntime.stream, state.filters.qr.cameraFacing);
  state.qrScanner.status = "scanning";
  state.qrScanner.message = qrScannerRuntime.engine === "native"
    ? `Escaneo activo con camara ${getQrCameraLabel_(state.qrScanner.cameraFacing)}. Acerca el QR al marco central.`
    : `Escaneo activo con lector compatible y camara ${getQrCameraLabel_(state.qrScanner.cameraFacing)}. Acerca el QR al marco central.`;

  if (!qrScannerRuntime.animationFrameId) {
    scanQrFrame_();
  }
}

function stopQrScannerRuntime_(keepStatus = false) {
  if (qrScannerRuntime.animationFrameId) {
    window.cancelAnimationFrame(qrScannerRuntime.animationFrameId);
    qrScannerRuntime.animationFrameId = 0;
  }

  qrScannerRuntime.busy = false;
  qrScannerRuntime.pausedUntil = 0;
  qrScannerRuntime.lastValue = "";
  qrScannerRuntime.lastValueAt = 0;
  qrScannerRuntime.detector = null;
  qrScannerRuntime.engine = "";
  qrScannerRuntime.canvas = null;
  qrScannerRuntime.context = null;

  if (qrScannerRuntime.stream) {
    qrScannerRuntime.stream.getTracks().forEach((track) => track.stop());
    qrScannerRuntime.stream = null;
  }

  const video = document.getElementById("qr-kiosk-video");
  if (video instanceof HTMLVideoElement) {
    video.srcObject = null;
  }

  if (!keepStatus) {
    state.qrScanner.cameraFacing = "";
    state.qrScanner.status = "idle";
    state.qrScanner.message = "Activa la camara para comenzar el registro automatico.";
  }
}

function scanQrFrame_() {
  if (!state.qrScanner.enabled || (state.currentView !== "qr" && (state.currentView !== "attendance" || resolveConnectionAttendanceMode_() === "manual"))) {
    qrScannerRuntime.animationFrameId = 0;
    return;
  }

  qrScannerRuntime.animationFrameId = window.requestAnimationFrame(scanQrFrame_);

  const video = document.getElementById("qr-kiosk-video");
  if (!(video instanceof HTMLVideoElement) || video.readyState < 2) {
    return;
  }

  if (qrScannerRuntime.busy || Date.now() < qrScannerRuntime.pausedUntil || !qrScannerRuntime.detector) {
    return;
  }

  qrScannerRuntime.busy = true;

  detectQrFromVideo_(video)
    .then((rawValue) => {
      if (!rawValue) {
        return;
      }

      processQrRawValue_(rawValue);
    })
    .catch(() => {
      // Si la deteccion falla en un frame aislado, dejamos continuar el siguiente intento.
    })
    .finally(() => {
      qrScannerRuntime.busy = false;
    });
}

async function detectQrFromVideo_(video) {
  if (qrScannerRuntime.engine === "native") {
    const codes = await Promise.resolve(qrScannerRuntime.detector.detect(video));
    const detectedCode = Array.isArray(codes) ? codes.find((item) => item?.rawValue) : null;
    return detectedCode?.rawValue ? String(detectedCode.rawValue).trim() : "";
  }

  if (qrScannerRuntime.engine === "jsqr") {
    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;

    if (!width || !height || !qrScannerRuntime.canvas || !qrScannerRuntime.context || typeof window.jsQR !== "function") {
      return "";
    }

    if (qrScannerRuntime.canvas.width !== width || qrScannerRuntime.canvas.height !== height) {
      qrScannerRuntime.canvas.width = width;
      qrScannerRuntime.canvas.height = height;
    }

    qrScannerRuntime.context.drawImage(video, 0, 0, width, height);
    const imageData = qrScannerRuntime.context.getImageData(0, 0, width, height);
    const decoded = window.jsQR(imageData.data, width, height, {
      inversionAttempts: "dontInvert"
    });

    return decoded?.data ? String(decoded.data).trim() : "";
  }

  return "";
}

function processQrRawValue_(rawValue) {
  const extractedPersonId = extractPersonIdFromScan_(rawValue);

  if (!extractedPersonId) {
    state.qrScanner.result = buildQrFailureResult_(
      new ApiError("El codigo QR no contiene un QR ID reconocible.", "INVALID_QR_VALUE"),
      rawValue
    );
    state.qrScanner.status = "error";
    state.qrScanner.message = state.qrScanner.result.message;
    qrScannerRuntime.pausedUntil = Date.now() + 2400;
    playKioskSignal_("error");
    renderApp();
    return;
  }

  const now = Date.now();
  const isDuplicateRead = qrScannerRuntime.lastValue === extractedPersonId && (now - qrScannerRuntime.lastValueAt) < 3000;

  if (isDuplicateRead) {
    return;
  }

  qrScannerRuntime.lastValue = extractedPersonId;
  qrScannerRuntime.lastValueAt = now;
  qrScannerRuntime.pausedUntil = now + 2200;
  state.qrScanner.status = "processing";
  state.qrScanner.message = "Validando asistencia y registrando acceso...";
  renderApp();
  void registerQrAttendance(extractedPersonId, {
    source: "scanner",
    showLoading: false,
    suppressToast: true
  });
}

function extractPersonIdFromScan_(rawValue) {
  const text = String(rawValue || "").trim();

  if (!text) {
    return "";
  }

  try {
    const parsed = JSON.parse(text);
    return String(parsed.personId || parsed.id || parsed.codigo || "").trim();
  } catch (error) {
    // Continuamos con otras estrategias de lectura.
  }

  try {
    const url = new URL(text);
    return String(
      url.searchParams.get("personId") ||
      url.searchParams.get("id") ||
      url.searchParams.get("code") ||
      ""
    ).trim() || text;
  } catch (error) {
    return text;
  }
}

function throwQrScannerError_(code, message) {
  state.qrScanner.enabled = false;
  state.qrScanner.status = "error";
  state.qrScanner.message = message;
  state.qrScanner.result = buildQrFailureResult_(new ApiError(message, code), "");
  stopQrScannerRuntime_(true);
  renderApp();
}

async function toggleKioskFullscreen_() {
  const kioskStage = document.getElementById("qr-kiosk-stage");
  if (!(kioskStage instanceof HTMLElement)) {
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await kioskStage.requestFullscreen();
}

function playKioskSignal_(tone) {
  if (!window.AudioContext && !window.webkitAudioContext) {
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const isSuccess = tone === "success";
    const isWarning = tone === "warning";

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(isSuccess ? 880 : (isWarning ? 540 : 260), now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(isSuccess ? 0.08 : 0.05, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isSuccess ? 0.24 : 0.18));

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (isSuccess ? 0.26 : 0.2));
    oscillator.onended = () => {
      void context.close();
    };
  } catch (error) {
    // Si el sonido no se puede reproducir, el kiosko sigue funcionando visualmente.
  }
}

function resolveQrContext() {
  if (state.filters.qr.mode === "manual") {
    if (!state.filters.qr.seasonId || !state.filters.qr.sessionId) {
      return null;
    }

    return {
      seasonId: state.filters.qr.seasonId,
      sessionId: state.filters.qr.sessionId
    };
  }

  if (state.activeSession && state.activeSession.found) {
    return {
      seasonId: state.activeSession.session.seasonId,
      sessionId: state.activeSession.session.id
    };
  }

  return null;
}

function setAttendanceForAll(value) {
  if (!state.attendanceContext || !state.attendanceContext.participants.length) {
    return;
  }

  state.attendanceContext.participants.forEach((participant) => {
    state.attendanceForm[participant.personId] = value;
  });
}

function toggleBulkSelection(personId, checked) {
  const normalizedPersonId = String(personId || "");

  if (!normalizedPersonId) {
    return;
  }

  if (checked) {
    if (!state.selectedBulkPeople.includes(normalizedPersonId)) {
      state.selectedBulkPeople.push(normalizedPersonId);
    }
    return;
  }

  state.selectedBulkPeople = state.selectedBulkPeople.filter((item) => item !== normalizedPersonId);
}

function getParticipantPersonIdSet_() {
  return new Set(state.participants.map((participant) => String(participant.personId)));
}

function getSelectedBulkPeople_() {
  const selectedMap = new Map(state.people.map((person) => [String(person.id), person]));

  return state.selectedBulkPeople
    .map((personId) => selectedMap.get(String(personId)) || null)
    .filter(Boolean);
}

function mergeParticipantsIntoCurrentContext_(records) {
  const activeFilter = state.filters.participants;
  const mergedParticipants = new Map(state.participants.map((participant) => [String(participant.id), participant]));

  (records || []).forEach((participant) => {
    if (!participant) {
      return;
    }

    if (String(participant.sessionId) !== String(activeFilter.sessionId) || String(participant.groupId) !== String(activeFilter.groupId)) {
      return;
    }

    mergedParticipants.set(String(participant.id), participant);
  });

  state.participants = Array.from(mergedParticipants.values()).sort((left, right) => {
    const byName = normalizeText(left.name).localeCompare(normalizeText(right.name), "es");

    if (byName !== 0) {
      return byName;
    }

    return String(left.personId || left.id).localeCompare(String(right.personId || right.id), "es");
  });
  state.filters.participants.moveTargets = {};
}

function resetParticipantInteractionState_() {
  state.selectedBulkPeople = [];
  state.filters.participants.peopleSearch = "";
  state.filters.participants.bulkSearch = "";
  state.filters.participants.moveTargets = {};
}

function buildAttendanceSummary() {
  const values = Object.values(state.attendanceForm);
  const present = values.filter((value) => value === "SI").length;
  const changed = Object.keys(state.attendanceForm).filter((personId) => {
    const currentValue = state.attendanceForm[personId] === "SI" ? "SI" : "NO";
    const baselineValue = state.attendanceBaseline[personId] === "SI" ? "SI" : "NO";
    return currentValue !== baselineValue;
  }).length;

  return {
    total: values.length,
    present,
    absent: values.length - present,
    changed
  };
}

function getFilteredAttendanceParticipants_() {
  const participants = state.attendanceContext?.participants || [];
  const search = normalizeText(state.filters.attendance.search);

  if (!search) {
    return participants;
  }

  return participants.filter((participant) => normalizeText([
    participant.name,
    participant.personId,
    participant.type
  ].join(" ")).includes(search));
}

function setAttendanceForVisible(value) {
  const normalizedValue = value === "SI" ? "SI" : "NO";

  getFilteredAttendanceParticipants_().forEach((participant) => {
    state.attendanceForm[participant.personId] = normalizedValue;
  });
}

function setAttendanceForPerson_(personId, value) {
  const normalizedPersonId = String(personId || "");

  if (!normalizedPersonId) {
    return;
  }

  state.attendanceForm[normalizedPersonId] = value === "SI" ? "SI" : "NO";
}

function syncAttendanceCardUi_(personId) {
  const normalizedPersonId = String(personId || "");
  const currentValue = state.attendanceForm[normalizedPersonId] === "SI" ? "SI" : "NO";

  root.querySelectorAll('[data-role="attendance-card"]').forEach((card) => {
    if (!(card instanceof HTMLElement) || card.dataset.personId !== normalizedPersonId) {
      return;
    }

    card.classList.toggle("attendance-row-present", currentValue === "SI");
    card.classList.toggle("attendance-row-absent", currentValue !== "SI");

    const metaRows = card.querySelectorAll(".row-meta");
    const statusCopy = metaRows[1];
    if (statusCopy instanceof HTMLElement) {
      statusCopy.textContent = currentValue === "SI" ? "Marcado como asistente" : "Marcado como no asistente";
    }
  });

  root.querySelectorAll('[data-role="attendance-choice"]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement) || button.dataset.personId !== normalizedPersonId) {
      return;
    }

    const isActive = button.dataset.value === currentValue;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function syncAttendanceSummaryDom_() {
  const summary = buildAttendanceSummary();
  const filteredParticipants = getFilteredAttendanceParticipants_();
  const visiblePresent = filteredParticipants.filter((participant) => state.attendanceForm[participant.personId] === "SI").length;
  const visibleAbsent = Math.max(filteredParticipants.length - visiblePresent, 0);
  const draftLabel = summary.changed
    ? `${summary.changed} cambio${summary.changed === 1 ? "" : "s"} sin guardar`
    : (state.attendanceContext
      ? (state.attendanceContext.alreadyCaptured ? "Sin cambios pendientes" : "Lista lista para guardar")
      : "Pendiente");

  root.querySelectorAll('[data-role="attendance-total-count"]').forEach((element) => {
    element.textContent = String(summary.total);
  });
  root.querySelectorAll('[data-role="attendance-present-count"]').forEach((element) => {
    element.textContent = String(summary.present);
  });
  root.querySelectorAll('[data-role="attendance-absent-count"]').forEach((element) => {
    element.textContent = String(summary.absent);
  });
  root.querySelectorAll('[data-role="attendance-dirty-count"]').forEach((element) => {
    element.textContent = String(summary.changed);
  });
  root.querySelectorAll('[data-role="attendance-visible-count"]').forEach((element) => {
    element.textContent = String(filteredParticipants.length);
  });
  root.querySelectorAll('[data-role="attendance-draft-badge"]').forEach((element) => {
    element.textContent = draftLabel;

    if (!(element instanceof HTMLElement)) {
      return;
    }

    element.classList.remove("warning", "dark", "success");
    element.classList.add(summary.changed ? "warning" : (state.attendanceContext && state.attendanceContext.alreadyCaptured ? "dark" : "success"));
  });

  root.querySelectorAll(".summary-box").forEach((box) => {
    const countNode = box.querySelector('[data-role="attendance-visible-count"]');
    if (!countNode) {
      return;
    }

    const description = box.querySelector("span:last-child");
    if (description instanceof HTMLElement) {
      description.textContent = `${visiblePresent} SI y ${visibleAbsent} NO segun el filtro actual.`;
    }
  });
}

function syncAttendanceContextIntoQr_() {
  const attendanceFilter = state.filters.attendance;

  if (!attendanceFilter.seasonId || !attendanceFilter.sessionId) {
    return;
  }

  state.filters.qr.mode = "manual";
  state.filters.qr.seasonId = attendanceFilter.seasonId;
  state.filters.qr.sessionId = attendanceFilter.sessionId;
}

function buildQrSessionActivity_(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record.attended === "SI")
    .sort((left, right) => {
      const leftTime = Date.parse(left.registeredAt || "") || 0;
      const rightTime = Date.parse(right.registeredAt || "") || 0;
      return rightTime - leftTime;
    })
    .slice(0, 10)
    .map((record) => ({
      ...record,
      groupName: resolveGroupName_(record.groupId) || (record.groupId ? `Grupo ${record.groupId}` : "Sin grupo"),
      timestampLabel: formatDateTime_(record.registeredAt)
    }));
}

function getLatestSeason() {
  if (!state.seasons.length) {
    return null;
  }

  return state.seasons[state.seasons.length - 1];
}

function getSessions(seasonId) {
  if (!seasonId) {
    return [];
  }

  return state.sessionsBySeason[seasonId] || [];
}

function getSessionGroups(seasonId, sessionId) {
  if (!seasonId || !sessionId) {
    return [];
  }

  return state.sessionGroupsByKey[`${seasonId}::${sessionId}`] || [];
}

function getFilteredPeopleDirectory_() {
  const search = normalizeText(state.filters.assistants.search);
  const status = String(state.filters.assistants.status || "ALL").toUpperCase();
  const typeKey = state.filters.assistants.type === "ALL" ? "ALL" : getPersonTypeKey_(state.filters.assistants.type);

  return state.peopleDirectory.filter((person) => {
    const haystack = normalizeText([
      person.numero,
      person.nombre,
      person.apellidos,
      person.nombreCompleto,
      person.email,
      person.telefono,
      person.id
    ].join(" "));
    const normalizedStatus = String(person.estado || "").toUpperCase();
    const normalizedType = getPersonTypeKey_(person.tipoPersona);

    return (!search || haystack.includes(search))
      && (status === "ALL" || normalizedStatus === status)
      && (typeKey === "ALL" || normalizedType === typeKey);
  });
}

function buildPeopleDirectorySummary_() {
  const summary = {
    total: state.peopleDirectory.length,
    active: 0,
    congregants: 0,
    servers: 0,
    coordinators: 0,
    leaders: 0,
    leadership: 0
  };

  state.peopleDirectory.forEach((person) => {
    const typeKey = getPersonTypeKey_(person.tipoPersona);

    if (String(person.estado || "").toUpperCase() === "ACTIVO") {
      summary.active += 1;
    }

    if (typeKey === "congregante") {
      summary.congregants += 1;
    }

    if (typeKey === "servidor") {
      summary.servers += 1;
    }

    if (typeKey === "coordinador") {
      summary.coordinators += 1;
      summary.leadership += 1;
    }

    if (typeKey === "lider") {
      summary.leaders += 1;
      summary.leadership += 1;
    }
  });

  return summary;
}

function sanitizeAssistantPayload_(payload) {
  const clean = {
    nombre: V(payload.nombre),
    apellidos: V(payload.apellidos),
    telefono: V(payload.telefono),
    email: V(payload.email),
    grupo: V(payload.grupo),
    fechaIngreso: V(payload.fechaIngreso) || formatDateForInput_(new Date()),
    tipoPersona: normalizePersonTypeValue_(payload.tipoPersona || "Congregante"),
    estado: V(payload.estado) || "ACTIVO"
  };

  if (!clean.nombre || !clean.apellidos) {
    throw new ApiError("Debes completar nombre y apellidos para guardar un congregante.", "VALIDATION_ERROR");
  }

  return clean;
}

function findExistingPersonMatch_(payload) {
  const normalizedEmail = normalizeText(payload.email);
  const normalizedFullName = normalizeText(payload.nombreCompleto || [payload.nombre, payload.apellidos].join(" "));
  const normalizedPhone = normalizePhone_(payload.telefono);

  if (normalizedEmail) {
    const emailMatch = state.peopleDirectory.find((person) => normalizeText(person.email) === normalizedEmail);
    if (emailMatch) {
      return emailMatch;
    }
  }

  if (normalizedFullName && normalizedPhone) {
    return state.peopleDirectory.find((person) => (
      normalizeText(person.nombreCompleto || [person.nombre, person.apellidos].join(" ")) === normalizedFullName
      && normalizePhone_(person.telefono) === normalizedPhone
    )) || null;
  }

  return null;
}

function ensureXlsxLoaded_() {
  if (!window.XLSX?.utils) {
    throw new ApiError("No se encontro la libreria de Excel en esta pagina. Recarga el frontend y vuelve a intentar.", "XLSX_NOT_AVAILABLE");
  }
}

async function readWorkbookRows_(file) {
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, {
    type: "array"
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    throw new ApiError("El archivo no contiene hojas para importar.", "INVALID_IMPORT_FILE");
  }

  return window.XLSX.utils.sheet_to_json(firstSheet, {
    defval: ""
  });
}

function prepareImportedPeopleRows_(rows) {
  const preparedRows = [];
  const seenEmails = {};
  const seenNamesAndPhones = {};

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const payload = normalizeImportedPersonRow_(row);
    const errors = [];
    const normalizedEmail = normalizeText(payload.email);
    const nameAndPhoneKey = buildNamePhoneKey_(payload);

    if (!payload.nombre) {
      errors.push("Falta NOMBRE.");
    }

    if (!payload.apellidos) {
      errors.push("Faltan APELLIDOS.");
    }

    if (normalizedEmail) {
      if (seenEmails[normalizedEmail]) {
        errors.push(`EMAIL duplicado con la fila ${seenEmails[normalizedEmail]}.`);
      } else {
        seenEmails[normalizedEmail] = rowNumber;
      }
    }

    if (nameAndPhoneKey) {
      if (seenNamesAndPhones[nameAndPhoneKey]) {
        errors.push(`Nombre y telefono duplicados con la fila ${seenNamesAndPhones[nameAndPhoneKey]}.`);
      } else {
        seenNamesAndPhones[nameAndPhoneKey] = rowNumber;
      }
    }

    const existing = errors.length ? null : findExistingPersonMatch_(payload);
    if (existing) {
      payload.id = existing.id;
    }

    preparedRows.push({
      rowNumber,
      sourceTotalRows: rows.length,
      payload,
      operation: existing ? "update" : "create",
      existingId: existing?.id || "",
      errors
    });
  });

  return preparedRows;
}

function summarizePreparedPeopleRows_(rows) {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => !row.errors.length).length,
    invalidRows: rows.filter((row) => row.errors.length).length,
    createRows: rows.filter((row) => !row.errors.length && row.operation === "create").length,
    updateRows: rows.filter((row) => !row.errors.length && row.operation === "update").length
  };
}

function normalizeImportedPersonRow_(row) {
  const fullNameFallback = V(getImportValue_(row, ["nombre_completo", "nombre completo", "nombre y apellidos"]));
  const splitName = splitFullName_(fullNameFallback);
  const nombre = V(getImportValue_(row, ["nombre"])) || splitName.nombre;
  const apellidos = V(getImportValue_(row, ["apellidos"])) || splitName.apellidos;
  const fechaIngreso = parseInputDateValue_(getImportValue_(row, ["fecha", "fecha_ingreso", "fecha ingreso"]));
  const fechaNacimiento = parseInputDateValue_(getImportValue_(row, ["fecha_nacimiento", "fecha nacimiento"]));

  return {
    id: "",
    nombre,
    apellidos,
    nombreCompleto: [nombre, apellidos].join(" ").trim(),
    edad: V(getImportValue_(row, ["edad"])),
    estadoCivil: V(getImportValue_(row, ["estado_civil", "estado civil"])),
    anioNacimiento: V(getImportValue_(row, ["anio_nacimiento", "ano_nacimiento", "anio nacimiento", "ano nacimiento"])),
    telefono: V(getImportValue_(row, ["telefono", "celular", "movil"])),
    email: V(getImportValue_(row, ["email", "correo", "correo_electronico", "correo electronico"])),
    ministerio1: V(getImportValue_(row, ["ministerio1", "ministerio_principal", "ministerio principal"])),
    ministerio2: V(getImportValue_(row, ["ministerio2"])),
    ministerio3: V(getImportValue_(row, ["ministerio3"])),
    ministerio4: V(getImportValue_(row, ["ministerio4"])),
    grupo: normalizeCatalogGroupValue_(getImportValue_(row, ["grupo", "groupid", "group_id", "id_grupo"])),
    fechaIngreso: fechaIngreso || formatDateForInput_(new Date()),
    estado: V(getImportValue_(row, ["estado"])) || "ACTIVO",
    tipoPersona: normalizePersonTypeValue_(getImportValue_(row, ["tipo_persona", "tipo", "tipo persona"]) || "Congregante"),
    fechaNacimiento
  };
}

function getImportValue_(row, aliases) {
  const entries = Object.entries(row || {});

  for (const [key, value] of entries) {
    const normalizedKey = normalizeImportHeader_(key);
    if (aliases.some((alias) => normalizeImportHeader_(alias) === normalizedKey)) {
      return value;
    }
  }

  return "";
}

function normalizeImportHeader_(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_");
}

function splitFullName_(value) {
  const parts = V(value).split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return {
      nombre: "",
      apellidos: ""
    };
  }

  if (parts.length === 1) {
    return {
      nombre: parts[0],
      apellidos: ""
    };
  }

  return {
    nombre: parts.shift() || "",
    apellidos: parts.join(" ")
  };
}

function parseInputDateValue_(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateForInput_(value);
  }

  const text = V(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDateForInput_(parsedDate);
  }

  return text;
}

function buildNamePhoneKey_(payload) {
  const normalizedFullName = normalizeText(payload.nombreCompleto || [payload.nombre, payload.apellidos].join(" "));
  const normalizedPhone = normalizePhone_(payload.telefono);

  if (!normalizedFullName || !normalizedPhone) {
    return "";
  }

  return `${normalizedFullName}::${normalizedPhone}`;
}

function normalizeCatalogGroupValue_(value) {
  const rawValue = V(value);

  if (!rawValue) {
    return "";
  }

  const normalized = normalizeText(rawValue);
  const match = state.catalogs.groups.find((group) => (
    String(group.id) === rawValue || normalizeText(group.name) === normalized
  ));

  return match ? String(match.id) : rawValue;
}

function normalizePersonTypeValue_(value) {
  const rawValue = V(value);
  const normalized = normalizeText(rawValue);

  if (!normalized || normalized === "asistente" || normalized === "congregante") {
    return "Congregante";
  }

  if (normalized === "servidor" || normalized === "voluntario") {
    return "Servidor";
  }

  if (normalized === "coordinador") {
    return "Coordinador";
  }

  if (normalized === "lider") {
    return "Lider";
  }

  return rawValue || "Congregante";
}

const normalizePersonTypeValueBase_ = normalizePersonTypeValue_;
normalizePersonTypeValue_ = function(value) {
  const resolvedValue = normalizePersonTypeValueBase_(value);

  if (normalizeText(resolvedValue) === "lider") {
    return "L\u00edder";
  }

  return resolvedValue;
};

function getPersonTypeKey_(value) {
  return normalizeText(normalizePersonTypeValue_(value));
}

function buildCredentialQrValue_(person) {
  return String(person.id || "").trim();
}

function syncCredentialQrsAfterRender_() {
  const qrCanvases = document.querySelectorAll('[data-role="credential-qr"]');

  qrCanvases.forEach((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      return;
    }

    const value = element.dataset.qrValue || "";
    const size = Number(element.dataset.qrSize || 164);
    renderCredentialQrCanvas_(element, value, size);
  });
}

function renderCredentialQrCanvas_(canvas, value, size = 164) {
  if (!window.QRious) {
    return;
  }

  const qr = new window.QRious({
    element: canvas,
    value,
    size,
    level: "H",
    foreground: "#050505",
    background: "#ffffff"
  });

  qr.set({
    value,
    size
  });
}

function buildCredentialQrDataUrl_(person, size = 220) {
  if (!window.QRious) {
    throw new ApiError("No se encontro la libreria para generar QR. Recarga la pagina y vuelve a intentar.", "QR_RENDER_NOT_AVAILABLE");
  }

  const canvas = document.createElement("canvas");
  renderCredentialQrCanvas_(canvas, buildCredentialQrValue_(person), size);
  return canvas.toDataURL("image/png");
}

async function downloadCredentialPng_(person, options = {}) {
  const fileName = `${buildCredentialFileName_(person)}.png`;

  await withLoading(async () => {
    const blob = await buildCredentialPngBlob_(person);
    downloadBlob_(blob, fileName);
  }, "Generando credencial PNG...");

  if (options.showToast !== false) {
    showToast("Credencial descargada", "El PNG quedo listo para enviarlo por WhatsApp o guardarlo.", "success");
  }
}

async function shareCredentialPng_(person) {
  const shareTitle = `Credencial QR - ${person.nombreCompleto || person.nombre || "Persona"}`;
  const fileName = `${buildCredentialFileName_(person)}.png`;

  await withLoading(async () => {
    const blob = await buildCredentialPngBlob_(person);
    const file = new File([blob], fileName, {
      type: "image/png"
    });

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const canShareFiles = typeof navigator.canShare !== "function" || navigator.canShare({
        files: [file]
      });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: buildCredentialShareText_(person)
          });
          showToast("Menu de compartir abierto", "Puedes elegir WhatsApp, AirDrop, Mail u otra app compatible.", "success");
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }

          throw error;
        }
      }
    }

    downloadBlob_(blob, fileName);
    showToast("Compartir no disponible", "Este navegador no permite compartir archivos directo. Se descargo el PNG para enviarlo manualmente por WhatsApp.", "warning");
  }, "Preparando credencial para compartir...");
}

async function downloadCredentialBatchZip_(people, title) {
  const rows = Array.isArray(people) ? people.filter(Boolean) : [];

  if (!rows.length) {
    showToast("Sin credenciales", "No hay personas disponibles para generar el lote con los filtros actuales.", "warning");
    return;
  }

  await withLoading(async () => {
    const JSZipLibrary = window.JSZip;

    if (!JSZipLibrary) {
      throw new ApiError("No se encontro la libreria para generar el ZIP. Recarga la pagina y vuelve a intentar.", "ZIP_LIBRARY_NOT_AVAILABLE");
    }

    const zip = new JSZipLibrary();
    const folder = zip.folder("credenciales_qr");
    const manifestCsv = buildCredentialManifestCsv_(rows);
    const helpText = buildCredentialBatchHelpText_(rows.length, title);

    for (const person of rows) {
      const fileName = `${buildCredentialFileName_(person)}.png`;
      const blob = await buildCredentialPngBlob_(person);
      folder.file(fileName, blob);
    }

    zip.file("MANIFIESTO_CREDENCIALES.csv", manifestCsv);
    zip.file("README_WHATSAPP.txt", helpText);

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    downloadBlob_(zipBlob, buildCredentialBatchZipFileName_(rows.length));
  }, `Generando ${rows.length} credenciales para descarga masiva...`);

  showToast("Lote descargado", `Se genero un ZIP con ${rows.length} credenciales PNG y un CSV de apoyo para WhatsApp.`, "success");
}

async function buildCredentialPngBlob_(person, options = {}) {
  const width = Number(options.width || 1080);
  const height = Number(options.height || 1600);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const assets = await getCredentialRenderAssets_();
  const qrImage = await loadImageElement_(buildCredentialQrDataUrl_(person, 620));
  const name = (person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "Sin nombre").toUpperCase();
  const groupName = resolveGroupName_(person.grupo) || person.grupo || "Sin grupo";
  const qrId = person.id || "SIN QR ID";
  const cardX = 52;
  const cardY = 52;
  const cardWidth = width - (cardX * 2);
  const cardHeight = height - (cardY * 2);
  const qrShellSize = 652;
  const qrSize = 560;
  const qrShellX = (width - qrShellSize) / 2;
  const qrShellY = 308;
  const qrX = qrShellX + ((qrShellSize - qrSize) / 2);
  const qrY = qrShellY + ((qrShellSize - qrSize) / 2);

  if (!context) {
    throw new ApiError("No se pudo crear el lienzo para exportar la credencial.", "CANVAS_NOT_AVAILABLE");
  }

  canvas.width = width;
  canvas.height = height;

  context.fillStyle = "#f3f3f3";
  context.fillRect(0, 0, width, height);

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.08)";
  context.shadowBlur = 36;
  context.shadowOffsetY = 16;
  drawRoundedRectPath_(context, cardX, cardY, cardWidth, cardHeight, 54);
  context.fillStyle = "#ffffff";
  context.fill();
  context.restore();

  context.lineWidth = 2;
  context.strokeStyle = "#ececec";
  drawRoundedRectPath_(context, cardX, cardY, cardWidth, cardHeight, 54);
  context.stroke();

  const logoWidth = Math.min(assets.logo.naturalWidth, 540);
  const logoScale = logoWidth / assets.logo.naturalWidth;
  const logoRenderWidth = assets.logo.naturalWidth * logoScale;
  const logoRenderHeight = assets.logo.naturalHeight * logoScale;
  const logoX = (width - logoRenderWidth) / 2;

  context.drawImage(assets.logo, logoX, 118, logoRenderWidth, logoRenderHeight);

  context.fillStyle = "#5f5f5f";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "500 42px Manrope, Arial, sans-serif";
  context.fillText("Credencial Digital", width / 2, 264);

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#e7e7e7";
  context.lineWidth = 2;
  drawRoundedRectPath_(context, qrShellX, qrShellY, qrShellSize, qrShellSize, 42);
  context.fill();
  context.stroke();
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const nameBlock = fitCanvasTextBlock_(context, name, 760, {
    maxLines: 2,
    maxFontSize: 78,
    minFontSize: 42,
    fontWeight: 800
  });
  const nameLineHeight = Math.round(nameBlock.fontSize * 1.02);
  let cursorY = 1046;

  context.fillStyle = "#1a1a1a";
  context.font = `800 ${nameBlock.fontSize}px Manrope, Arial, sans-serif`;
  nameBlock.lines.forEach((line) => {
    context.fillText(line, width / 2, cursorY);
    cursorY += nameLineHeight;
  });

  const groupBlock = fitCanvasTextBlock_(context, `Grupo de conexion: ${groupName}`, 760, {
    maxLines: 2,
    maxFontSize: 30,
    minFontSize: 22,
    fontWeight: 700
  });
  const groupLineHeight = Math.round(groupBlock.fontSize * 1.2);
  cursorY += 54;
  context.fillStyle = "#666666";
  context.font = `700 ${groupBlock.fontSize}px Manrope, Arial, sans-serif`;
  groupBlock.lines.forEach((line) => {
    context.fillText(line, width / 2, cursorY);
    cursorY += groupLineHeight;
  });

  context.strokeStyle = "#ededed";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(180, 1410);
  context.lineTo(width - 180, 1410);
  context.stroke();

  context.fillStyle = "#7d7d7d";
  context.font = "800 20px Manrope, Arial, sans-serif";
  context.fillText("QR ID", width / 2, 1474);

  context.fillStyle = "#1a1a1a";
  context.font = "700 42px Manrope, Arial, sans-serif";
  context.fillText(qrId, width / 2, 1538);

  return canvasToBlob_(canvas, "image/png");
}

function getCredentialRenderAssets_() {
  if (!credentialRenderRuntime.logoPromise) {
    credentialRenderRuntime.logoPromise = loadImageElement_(getCredentialLogoAssetUrl_()).then((logo) => ({
      logo
    }));
  }

  return credentialRenderRuntime.logoPromise;
}

function loadImageElement_(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ApiError(`No se pudo cargar el recurso visual: ${src}`, "ASSET_LOAD_ERROR"));
    image.src = src;
  });
}

function canvasToBlob_(canvas, type = "image/png", quality = 1) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new ApiError("No se pudo exportar la credencial como archivo.", "BLOB_EXPORT_ERROR"));
    }, type, quality);
  });
}

function drawRoundedRectPath_(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function wrapCanvasText_(context, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  if (!words.length) {
    return [""];
  }

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function trimCanvasLineWithEllipsis_(context, text, maxWidth) {
  let output = String(text || "").trim();

  while (output && context.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1).trim();
  }

  return output ? `${output}...` : "...";
}

function fitCanvasTextBlock_(context, text, maxWidth, options = {}) {
  const maxLines = Number(options.maxLines || 2);
  const maxFontSize = Number(options.maxFontSize || 64);
  const minFontSize = Number(options.minFontSize || 26);
  const fontWeight = Number(options.fontWeight || 700);

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    context.font = `${fontWeight} ${fontSize}px Manrope, Arial, sans-serif`;
    const lines = wrapCanvasText_(context, text, maxWidth);

    if (lines.length <= maxLines) {
      return {
        fontSize,
        lines
      };
    }
  }

  context.font = `${fontWeight} ${minFontSize}px Manrope, Arial, sans-serif`;
  const lines = wrapCanvasText_(context, text, maxWidth).slice(0, maxLines);

  if (lines.length) {
    lines[lines.length - 1] = trimCanvasLineWithEllipsis_(context, lines[lines.length - 1], maxWidth);
  }

  return {
    fontSize: minFontSize,
    lines
  };
}

function buildCredentialFileName_(person) {
  const qrId = sanitizeFileNamePart_(person.id || "sin_qr_id");
  const name = sanitizeFileNamePart_(person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "persona");
  return `CREDENCIAL_QR_${qrId}_${name}`.slice(0, 120);
}

function sanitizeFileNamePart_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "SIN_DATO";
}

function buildCredentialBatchZipFileName_(total) {
  return `CREDENCIALES_QR_${formatTimestampToken_()}_${String(total || 0).padStart(3, "0")}.zip`;
}

function formatTimestampToken_() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");
}

function buildCredentialManifestCsv_(people) {
  const rows = [
    ["QR_ID", "NUMERO", "NOMBRE", "TIPO_PERSONA", "GRUPO", "TELEFONO", "EMAIL", "WHATSAPP_URL"]
  ];

  people.forEach((person) => {
    rows.push([
      person.id || "",
      person.numero || "",
      person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "",
      getPersonTypeDisplayLabel_(person.tipoPersona),
      resolveGroupName_(person.grupo) || person.grupo || "",
      person.telefono || "",
      person.email || "",
      buildWhatsappShareUrl_(person)
    ]);
  });

  return rows.map((row) => row.map(toCsvValue_).join(",")).join("\n");
}

function toCsvValue_(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

function buildCredentialBatchHelpText_(total, title) {
  return [
    title || "Credenciales QR",
    `Total de credenciales: ${total}`,
    "",
    "Uso sugerido:",
    "1. Descomprime este archivo ZIP.",
    "2. Encontraras un PNG por persona listo para compartir.",
    "3. Usa MANIFIESTO_CREDENCIALES.csv como apoyo para identificar telefono, grupo y QR ID.",
    "4. Para envio automatico masivo por WhatsApp se requiere una integracion aparte con WhatsApp Business Cloud API."
  ].join("\n");
}

function buildCredentialShareText_(person) {
  const name = person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "Persona";
  const groupName = resolveGroupName_(person.grupo) || person.grupo || "Sin grupo";
  const qrId = person.id || "Sin QR ID";

  return [
    `Credencial QR de ${name}`,
    `Grupo: ${groupName}`,
    `QR ID: ${qrId}`,
    "Presentala al llegar al kiosko o en el registro de asistencia."
  ].join("\n");
}

function buildWhatsappShareUrl_(person) {
  const phone = normalizeWhatsappPhone_(person.telefono);

  if (!phone) {
    return "";
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildCredentialShareText_(person))}`;
}

function normalizeWhatsappPhone_(value) {
  const digits = normalizePhone_(value);

  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `52${digits}`;
  }

  if (digits.length === 13 && digits.indexOf("521") === 0) {
    return `52${digits.slice(-10)}`;
  }

  return digits;
}

function downloadBlob_(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

function printCredentialCards_(people, title) {
  const rows = Array.isArray(people) ? people.filter(Boolean) : [];

  if (!rows.length) {
    showToast("Sin credenciales", "No hay personas disponibles para generar credenciales con los filtros actuales.", "warning");
    return;
  }

  const logoUrl = getCredentialLogoAssetUrl_();
  const cardsHtml = rows.map((person) => {
    const groupName = resolveGroupName_(person.grupo) || person.grupo || "Sin grupo";
    const qrDataUrl = buildCredentialQrDataUrl_(person, 320);
    const name = person.nombreCompleto || [person.nombre, person.apellidos].join(" ").trim() || "Sin nombre";
    const id = person.id || person.numero || "SIN ID";

    return `
      <article class="print-credential-card">
        <div class="print-credential-head">
          <img src="${logoUrl}" alt="Conexion">
          <span class="print-credential-caption">Credencial Digital</span>
        </div>
        <div class="print-credential-body">
          <img class="print-credential-qr" src="${qrDataUrl}" alt="QR ${escapeHtml(id)}">
          <div class="print-credential-copy">
            <strong>${escapeHtml(name)}</strong>
            <span class="print-credential-group">${escapeHtml(`Grupo de conexion: ${groupName}`)}</span>
            <span class="print-credential-id">${escapeHtml(id)}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");

  if (!printWindow) {
    showToast("Ventana bloqueada", "Permite ventanas emergentes para abrir la impresion de credenciales.", "warning");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(title || "Credenciales QR")}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 28px;
          font-family: Manrope, Arial, sans-serif;
          color: #111111;
          background: #f2f2f2;
        }
        .print-shell {
          display: grid;
          gap: 18px;
        }
        .print-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 18px;
        }
        .print-head h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.03em;
        }
        .print-head p {
          margin: 8px 0 0;
          color: #555555;
        }
        .print-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
          gap: 18px;
        }
        .print-credential-card {
          background: #ffffff;
          border: 1px solid #dedede;
          border-radius: 28px;
          padding: 26px 22px 28px;
          break-inside: avoid;
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
        }
        .print-credential-head {
          display: grid;
          justify-items: center;
          gap: 12px;
        }
        .print-credential-head img {
          width: 290px;
          max-width: 100%;
          display: block;
        }
        .print-credential-caption {
          font-size: 22px;
          color: #2e2e2e;
          font-weight: 500;
        }
        .print-credential-body {
          display: grid;
          justify-items: center;
          gap: 22px;
          margin-top: 22px;
        }
        .print-credential-qr {
          width: 320px;
          height: 320px;
          padding: 12px;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #d8d8d8;
        }
        .print-credential-copy {
          display: grid;
          gap: 10px;
          justify-items: center;
          text-align: center;
        }
        .print-credential-copy strong {
          font-size: 40px;
          line-height: 1.08;
          letter-spacing: -0.05em;
          text-transform: uppercase;
          max-width: 10ch;
        }
        .print-credential-role {
          font-size: 24px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #1d1d1d;
        }
        .print-credential-group {
          font-size: 16px;
          color: #555555;
        }
        .print-credential-id {
          margin-top: 8px;
          font-size: 22px;
          letter-spacing: 0.08em;
          color: #202020;
        }
        @media print {
          body { padding: 0; background: #ffffff; }
          .print-head { margin-bottom: 12px; }
          .print-grid { gap: 12px; }
          .print-credential-card { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="print-shell">
        <div class="print-head">
          <div>
            <h1>${escapeHtml(title || "Credenciales QR")}</h1>
            <p>${escapeHtml(`Total de credenciales: ${rows.length}`)}</p>
          </div>
          <p>${escapeHtml(formatDateTime_(new Date()))}</p>
        </div>
        <section class="print-grid">
          ${cardsHtml}
        </section>
      </div>
      <script>
        window.addEventListener("load", function () {
          window.print();
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function getCredentialLogoAssetUrl_() {
  return new URL("./assets/logo-conexion.png", window.location.href).href;
}

function normalizePhone_(value) {
  return String(value || "").replace(/\D/g, "");
}

function coerceClientDate_(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    return new Date(
      Number(isoDateMatch[1]),
      Number(isoDateMatch[2]) - 1,
      Number(isoDateMatch[3]),
      12,
      0,
      0,
      0
    );
  }

  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    return new Date(
      Number(slashDateMatch[3]),
      Number(slashDateMatch[2]) - 1,
      Number(slashDateMatch[1]),
      12,
      0,
      0,
      0
    );
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForInput_(value) {
  const date = coerceClientDate_(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateToTimestamp_(value, endOfDay = false) {
  const date = coerceClientDate_(value);

  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date.getTime();
}

function getDefaultRecentRange_(days) {
  const totalDays = Math.max(Number(days || 30), 1);
  const to = new Date();
  const from = new Date();

  from.setDate(from.getDate() - (totalDays - 1));

  return {
    from: formatDateForInput_(from),
    to: formatDateForInput_(to)
  };
}

function getFilteredAdminUsers_() {
  const search = normalizeText(state.filters.admin.userSearch);

  return state.adminUsers.filter((user) => {
    const haystack = normalizeText([user.name, user.email, user.role, user.status].join(" "));
    return !search || haystack.includes(search);
  });
}

function getPermissionLabel_(permission) {
  const labels = {
    dashboard: "Dashboard Ejecutivo",
    assistants: "Congregantes",
    "congregants-new": "Nuevos congregantes",
    catalogs: "Catalogos",
    seasons: "Temporadas",
    participants: "Asignacion",
    attendance: "Asistencias",
    "admin-settings": "Configuracion",
    "admin-users": "Usuarios"
  };

  return labels[permission] || permission;
}

function getPermissionDescription_(permission) {
  const descriptions = {
    dashboard: "Indicadores, consultas y exportaciones para pastor y lideres.",
    assistants: "Padron general, altas, importacion y credenciales QR.",
    "congregants-new": "Consulta de congregantes nuevos por periodo.",
    catalogs: "Catalogos de grupos y ministerios.",
    seasons: "Temporadas, sesiones y estados operativos.",
    participants: "Asignacion individual y masiva a grupos.",
    attendance: "Captura manual, QR asistido y kiosko.",
    "admin-settings": "URL de API y conexion del sistema.",
    "admin-users": "Alta de usuarios, perfiles y permisos."
  };

  return descriptions[permission] || "Ficha operativa del sistema.";
}

function downloadFallbackTemplateCsv_(headers) {
  const csv = `${headers.join(",")}\n`;
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "PLANTILLA_ASISTENTES_V2.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function syncResponsiveTablesAfterRender_() {
  root.querySelectorAll(".table-wrap table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((header, index) => {
      const normalized = normalizeInlineText_(header.textContent);
      return normalized || `Columna ${index + 1}`;
    });

    Array.from(table.tBodies).forEach((tbody) => {
      Array.from(tbody.rows).forEach((row) => {
        let columnIndex = 0;

        Array.from(row.cells).forEach((cell) => {
          if (cell.tagName !== "TD") {
            return;
          }

          const colspan = Math.max(Number(cell.getAttribute("colspan") || 1), 1);
          const label = headers[columnIndex] || "";

          if (label && colspan === 1) {
            cell.setAttribute("data-label", label);
          } else {
            cell.removeAttribute("data-label");
          }

          columnIndex += colspan;
        });
      });
    });
  });
}

function syncAppShellAfterRender_() {
  if (typeof document === "undefined") {
    return;
  }

  const shouldLockBody = Boolean(state.user && state.ui.mobileNavOpen && window.innerWidth <= 980);
  document.body.classList.toggle("mobile-nav-open", shouldLockBody);
}

function scrollViewportToTop_() {
  if (typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto"
    });
  });
}

function scrollToSection_(sectionId) {
  const section = document.getElementById(sectionId);

  if (!section) {
    return;
  }

  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function rerenderPreservingInput_(target) {
  const focusSnapshot = captureInputFocusSnapshot_(target);
  renderApp();
  restoreInputFocusSnapshot_(focusSnapshot);
}

function captureInputFocusSnapshot_(target) {
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
    return null;
  }

  return {
    id: target.id,
    selectionStart: typeof target.selectionStart === "number" ? target.selectionStart : null,
    selectionEnd: typeof target.selectionEnd === "number" ? target.selectionEnd : null,
    selectionDirection: target.selectionDirection || "none"
  };
}

function restoreInputFocusSnapshot_(snapshot) {
  if (!snapshot || typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    const target = document.getElementById(snapshot.id);

    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }

    target.focus({ preventScroll: true });

    if (snapshot.selectionStart === null || snapshot.selectionEnd === null) {
      return;
    }

    try {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd, snapshot.selectionDirection);
    } catch (error) {
      // Some input types do not support restoring cursor selection.
    }
  });
}

function focusInputById_(inputId) {
  if (!inputId || typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    const target = document.getElementById(inputId);

    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }

    target.focus({ preventScroll: true });

    try {
      const endPosition = target.value.length;
      target.setSelectionRange(endPosition, endPosition, "none");
    } catch (error) {
      // Some input types do not support cursor positioning.
    }
  });
}

function toOptionalNumber_(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeInlineText_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function filterPeople(people, searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) {
    return people;
  }

  return people.filter((person) => normalizeText([person.name, person.numero, person.id].join(" ")).includes(normalizedSearch));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function V(value) {
  return String(value || "").trim();
}

async function testConnection() {
  const apiUrlInput = document.getElementById("api-url-input");
  const nextApiUrl = apiUrlInput ? apiUrlInput.value.trim() : state.apiUrl.trim();

  ensureApiUrl(nextApiUrl);
  state.apiUrl = nextApiUrl;
  setStoredApiUrl(nextApiUrl);

  await withLoading(async () => {
    const response = await apiGet("health");
    state.connectionStatus = {
      type: "success",
      message: response.status === "ok" ? "API OK" : "Respuesta recibida"
    };
  }, "Probando conexion...");

  showToast("Conexion correcta", "La API respondio satisfactoriamente.", "success");
}

function resetRuntimeState() {
  stopQrScannerRuntime_();
  state.connectionStatus = null;
  state.metrics = {
    peopleCount: null,
    directoryCount: null
  };
  state.dashboardExecutive = null;
  state.dashboardLeaderDetail = null;
  state.dashboardSessionInsights = null;
  state.dashboardSeasonMatrix = null;
  state.adminUsers = [];
  state.adminUsersSupport = {
    available: true,
    message: ""
  };
  state.viewLoadToken = 0;
  state.cacheKeys = {
    participants: "",
    attendance: "",
    attendanceDetail: "",
    qrSummary: "",
    dashboardSeasonMatrix: ""
  };
  state.loaded = {
    bootstrap: false,
    groups: false,
    ministries: false,
    seasons: false,
    people: false,
    peopleDirectory: false,
    activeSession: false,
    users: false
  };
  state.catalogs = {
    groups: [],
    ministries: []
  };
  state.seasons = [];
  state.sessionsBySeason = {};
  state.sessionGroupsByKey = {};
  state.people = [];
  state.peopleDirectory = [];
  state.activeSession = null;
  state.participants = [];
  state.participantContext = null;
  state.attendanceContext = null;
  state.attendanceForm = {};
  state.attendanceBaseline = {};
  state.attendanceDetail = null;
  state.realtimeSummary = null;
  state.qrSessionActivity = [];
  clearPeopleImportState_();
  state.qrLastResult = null;
  state.qrScanner = {
    enabled: false,
    status: "idle",
    message: "Activa la camara para comenzar el registro automatico.",
    result: null,
    cameraFacing: ""
  };
  state.selectedBulkPeople = [];
  state.ui = {
    mobileNavOpen: false,
    editingGroupId: "",
    editingMinistryId: "",
    editingUserEmail: ""
  };
  state.filters.dashboard = {
    seasonId: "",
    sessionId: "",
    groupId: "",
    recentFrom: "",
    recentTo: ""
  };
  state.filters.congregants = {
    recentFrom: "",
    recentTo: ""
  };
  state.filters.attendance.mode = "manual";
  state.filters.admin = {
    userSearch: "",
    groupSearch: "",
    ministrySearch: ""
  };
  initializeDateFilters_();

  Object.keys(pendingResourceLoads).forEach((key) => {
    pendingResourceLoads[key] = null;
  });
}

function detectPreferredQrCameraFacing_() {
  if (typeof navigator === "undefined") {
    return "rear";
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const isTouchMac = platform === "MacIntel" && touchPoints > 1;
  const isIOSLike = /iPad|iPhone|iPod/i.test(userAgent) || isTouchMac;

  return isIOSLike ? "front" : "rear";
}

function normalizeQrCameraFacing_(value, fallback = "rear") {
  if (value === "user" || value === "front") {
    return "front";
  }

  if (value === "environment" || value === "rear") {
    return "rear";
  }

  return fallback;
}

function getQrFacingModeConstraint_(cameraFacing) {
  return cameraFacing === "front" ? "user" : "environment";
}

function getQrCameraLabel_(cameraFacing = "rear") {
  return cameraFacing === "front" ? "frontal" : "trasera";
}

function buildQrCameraConstraints_(cameraFacing, strict = false) {
  const facingMode = getQrFacingModeConstraint_(cameraFacing);

  return {
    audio: false,
    video: {
      facingMode: strict
        ? { exact: facingMode }
        : { ideal: facingMode },
      width: {
        ideal: 1280
      },
      height: {
        ideal: 720
      }
    }
  };
}

async function requestQrCameraStream_(cameraFacing) {
  const attempts = [
    buildQrCameraConstraints_(cameraFacing, true),
    buildQrCameraConstraints_(cameraFacing, false),
    {
      audio: false,
      video: {
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      }
    }
  ];

  let lastError = null;

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("QR camera unavailable");
}

function resolveQrCameraFacingFromStream_(stream, fallback = "rear") {
  const track = stream?.getVideoTracks?.()[0];
  const detectedFacingMode = track?.getSettings?.().facingMode || "";
  return normalizeQrCameraFacing_(detectedFacingMode, fallback);
}

function ensureContextReady(filter, label) {
  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    throw new ApiError(`Completa temporada, sesion y grupo antes de continuar con ${label}.`, "MISSING_CONTEXT");
  }
}

function ensureApiUrl(value) {
  if (!value) {
    throw new ApiError("Debes indicar la URL de la API.", "MISSING_API_URL");
  }

  try {
    new URL(value);
  } catch (error) {
    throw new ApiError("La URL de la API no es valida.", "INVALID_API_URL");
  }
}

async function withLoading(fn, message) {
  showLoading(message);

  try {
    return await fn();
  } finally {
    hideLoading();
  }
}

function showLoading(message) {
  loadingMessage.textContent = message || "Cargando...";
  loadingOverlay.classList.remove("hidden");
}

function setLoadingMessage_(message) {
  loadingMessage.textContent = message || "Cargando...";
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function handleError(error) {
  console.error(error);

  let message = error instanceof ApiError
    ? error.message
    : "Ocurrio un error inesperado";

  if (isUnknownActionError_(error)) {
    message = "La API publicada todavia no incluye esa accion. Actualiza los archivos .gs y vuelve a desplegar la Web App.";
  }

  showToast("No se pudo completar la accion", message, "danger");
}

function showToast(title, copy, type = "success") {
  const toast = document.createElement("article");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <p class="toast-title">${escapeHtml(title)}</p>
    <p class="toast-copy">${escapeHtml(copy)}</p>
  `;

  toastRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = coerceClientDate_(value);
  if (!date || Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatDateTime_(value) {
  const date = coerceClientDate_(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "Sin hora";
  }

  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function describeApiUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const match = url.pathname.match(/\/macros\/s\/([^/]+)\/exec/i);

    if (match && match[1]) {
      const deploymentId = match[1];
      return `Apps Script ${deploymentId.slice(0, 8)}...${deploymentId.slice(-6)}`;
    }

    return `${url.hostname}${url.pathname}`;
  } catch (error) {
    const text = String(value || "").trim();
    return text.length > 32 ? `${text.slice(0, 29)}...` : text;
  }
}

function describeApiHost(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname;
  } catch (error) {
    return "Sin host";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

