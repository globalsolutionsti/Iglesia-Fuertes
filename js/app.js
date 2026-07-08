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
    title: "Dashboard Iglesia",
    subtitle: "Indicadores pastorales, consulta de grupos y crecimiento de la iglesia."
  },
  assistants: {
    module: "directory",
    title: "Congregantes",
    subtitle: "Padron administrativo, credenciales QR y gestion masiva."
  },
  "congregants-new": {
    module: "welcome",
    title: "Bienvenida: Nuevos",
    subtitle: "Da de alta a las nuevas personas y revisa sus primeros datos pastorales."
  },
  "welcome-followup": {
    module: "welcome",
    title: "Bienvenida: Seguimientos",
    subtitle: "Lleva el CRM pastoral de contactos, notas y próximos pasos."
  },
  "welcome-prospects": {
    module: "welcome",
    title: "Bienvenida: Prospectos",
    subtitle: "Ubica a cada nuevo en su grupo ideal y avisa al líder correspondiente."
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
  formation: {
    module: "formation",
    title: "Proceso de Formación",
    subtitle: "Prospecta, valida y da seguimiento al historial formativo de cada congregante."
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
    title: "Dashboard Iglesia",
    description: "Pastor, lideres e indicadores clave",
    defaultView: "dashboard"
  },
  welcome: {
    title: "Bienvenida",
    description: "Nuevos, seguimientos y prospectos",
    defaultView: "congregants-new"
  },
  directory: {
    title: "Congregantes",
    description: "Padron administrativo y credenciales",
    defaultView: "assistants"
  },
  connection: {
    title: "Grupos de Conexion",
    description: "Catalogos, temporadas, asignacion y asistencias",
    defaultView: "catalogs"
  },
  formation: {
    title: "Proceso de Formacion",
    description: "Prospectos, validaciones, niveles e historial",
    defaultView: "formation"
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
  welcome: [
    { view: "congregants-new", label: "Nuevos", description: "Alta inicial" },
    { view: "welcome-followup", label: "Seguimientos", description: "CRM pastoral" },
    { view: "welcome-prospects", label: "Prospectos", description: "Aviso al líder" }
  ],
  directory: [
    { view: "assistants", label: "Congregantes", description: "Padron y credenciales" }
  ],
  connection: [
    { view: "catalogs", label: "Catalogos", description: "Grupos y ministerios" },
    { view: "seasons", label: "Temporadas", description: "Sesiones y estados" },
    { view: "participants", label: "Asignacion", description: "Individual y masiva" },
    { view: "attendance", label: "Asistencias", description: "Manual, QR y kiosko" }
  ],
  formation: [
    { view: "formation", label: "Formación", description: "Prospectos, niveles e historial" }
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
  "welcome-followup",
  "welcome-prospects",
  "catalogs",
  "seasons",
  "participants",
  "attendance",
  "formation",
  "admin-settings",
  "admin-users"
];

const DEFAULT_QR_CAMERA_FACING = detectPreferredQrCameraFacing_();
const PERSON_TYPE_OPTIONS = ["NUEVO", "PROSPECTO GP", "CONGREGANTE", "PROSPECTO GF", "VOLUNTARIOS", "LIDER", "COORDINADOR"];
const CREDENTIAL_PREVIEW_LIMIT = 8;
const MOBILE_NAV_ITEMS = [
  { module: "dashboard", view: "dashboard", label: "Inicio", description: "Pastor" },
  { module: "welcome", view: "congregants-new", label: "Bienvenida", description: "Nuevos" },
  { module: "directory", view: "assistants", label: "Congregantes", description: "Padron" },
  { module: "connection", view: "catalogs", label: "Grupos", description: "Operacion" },
  { module: "formation", view: "formation", label: "Formacion", description: "Proceso" },
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
  welcomePeople: [],
  welcomeProfile: null,
  formationCatalog: [],
  formationRecords: [],
  formationCandidates: [],
  formationProfile: null,
  adminUsers: [],
  adminUsersSupport: {
    available: true,
    message: ""
  },
  backendSupport: {
    dashboardSeasonMatrixRoute: null
  },
  viewLoadToken: 0,
  cacheKeys: {
    participants: "",
    participantSeasonAssignments: "",
    attendance: "",
    attendanceDetail: "",
    qrSummary: "",
    dashboardSeasonMatrix: "",
    welcomePeople: "",
    formationRecords: "",
    formationCandidates: ""
  },
  loaded: {
    bootstrap: false,
    groups: false,
    ministries: false,
    seasons: false,
    people: false,
    peopleDirectory: false,
    activeSession: false,
    users: false,
    welcome: false,
    formationCatalog: false,
    formationRecords: false,
    formationCandidates: false
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
  participantSeasonAssignments: {},
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
    editingUserEmail: "",
    editingFormationLevelId: "",
    editingFormationRecordId: "",
    selectedWelcomePersonId: "",
    selectedFormationPersonId: "",
    confirmation: null
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
    welcome: {
      search: "",
      status: "ALL",
      groupId: ""
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
      mode: "manual",
      scope: "today",
      pickerSeasonId: "",
      pickerSessionId: ""
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
    formation: {
      seasonId: "",
      groupId: "",
      levelId: "",
      status: "ALL",
      search: ""
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
  users: null,
  welcome: null,
  welcomeProfile: null,
  formationCatalog: null,
  formationRecords: null,
  formationCandidates: null,
  formationProfile: null
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
  const basePermissions = Array.isArray(state.user?.permissions) && state.user.permissions.length
    ? state.user.permissions.slice()
    : ACCESSIBLE_VIEWS.slice();

  if (
    (basePermissions.includes("congregants-new") || basePermissions.includes("welcome-followup"))
    && !basePermissions.includes("welcome-prospects")
  ) {
    basePermissions.push("welcome-prospects");
  }

  return basePermissions;
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

function shouldShowDashboardLoading_() {
  const seasonId = String(state.filters.dashboard.seasonId || getLatestSeason()?.id || "");
  const executiveSeasonId = String(state.dashboardExecutive?.seasonFocus?.id || "");
  const matrixSeasonId = String(state.dashboardSeasonMatrix?.seasonId || "");

  return !state.dashboardExecutive ||
    !state.dashboardSeasonMatrix ||
    executiveSeasonId !== seasonId ||
    matrixSeasonId !== seasonId;
}

function loadViewDataInBackground_(view) {
  const token = ++state.viewLoadToken;
  const targetView = view || state.currentView;
  const shouldShowLoading = targetView === "dashboard" && shouldShowDashboardLoading_();

  void loadCurrentViewData({
    showLoading: shouldShowLoading,
    message: shouldShowLoading ? "Cargando Dashboard Iglesia..." : undefined
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
    root.innerHTML = `
      ${renderLoginView()}
      ${renderSystemConfirmationDialog_()}
    `;
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

    ${renderSystemConfirmationDialog_()}
  `;

  schedulePostRenderSync_();
}

function renderSystemConfirmationDialog_() {
  const confirmation = state.ui.confirmation;

  if (!confirmation) {
    return "";
  }

  return `
    <div class="system-modal-backdrop">
      <section class="system-modal-card" role="dialog" aria-modal="true" aria-labelledby="system-modal-title">
        <div class="panel-head">
          <div>
            <h2 id="system-modal-title">${escapeHtml(confirmation.title || "Confirmar accion")}</h2>
            <p>${escapeHtml(confirmation.copy || "Revisa los detalles antes de continuar.")}</p>
          </div>
          <span class="pill ${escapeHtml(confirmation.tone === "danger" ? "warning" : "dark")}">${escapeHtml(confirmation.badge || "Confirmacion")}</span>
        </div>

        ${confirmation.notes && confirmation.notes.length ? `
          <div class="system-modal-notes">
            ${confirmation.notes.map((note) => `<span class="context-item">${escapeHtml(note)}</span>`).join("")}
          </div>
        ` : ""}

        <div class="actions-row">
          <button class="btn btn-ghost" data-action="cancel-system-confirmation">${escapeHtml(confirmation.cancelLabel || "Cancelar")}</button>
          <button class="btn ${confirmation.tone === "danger" ? "btn-danger" : "btn-primary"}" data-action="confirm-system-action">${escapeHtml(confirmation.confirmLabel || "Confirmar")}</button>
        </div>
      </section>
    </div>
  `;
}

function openSystemConfirmation_(config) {
  state.ui.confirmation = {
    kind: config.kind || "",
    title: config.title || "Confirmar accion",
    copy: config.copy || "",
    badge: config.badge || "Confirmacion",
    confirmLabel: config.confirmLabel || "Confirmar",
    cancelLabel: config.cancelLabel || "Cancelar",
    tone: config.tone || "primary",
    notes: Array.isArray(config.notes) ? config.notes : [],
    payload: config.payload || {}
  };
  renderApp();
}

function closeSystemConfirmation_() {
  state.ui.confirmation = null;
  renderApp();
}

async function confirmSystemAction_() {
  const confirmation = state.ui.confirmation;

  if (!confirmation) {
    return;
  }

  state.ui.confirmation = null;
  renderApp();

  if (confirmation.kind === "bulk-assign") {
    await executeBulkAssign_();
    return;
  }

  if (confirmation.kind === "deactivate-participant") {
    await executeDeactivateParticipant_(confirmation.payload.participantId);
  }
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
          <h2>Dashboard Iglesia</h2>
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
      return renderWelcomeNewView_();
    case "welcome-followup":
      return renderWelcomeFollowupView_();
    case "welcome-prospects":
      return renderWelcomeProspectsView_();
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
    case "formation":
      return renderFormationView_();
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

function renderWelcomeNewView_() {
  const rows = getWelcomeNewPeople_();
  const allNewRows = state.welcomePeople.filter((person) => String(person.welcomeStatus || "").toUpperCase() === "NUEVO");
  const hiddenNewCount = Math.max(allNewRows.length - rows.length, 0);
  const withPhoneCount = rows.filter((row) => String(row.telefono || "").trim()).length;
  const withBirthDateCount = rows.filter((row) => String(row.fechaNacimiento || "").trim()).length;
  const withFollowupCount = rows.filter((row) => Number(row.followupsCount || 0) > 0).length;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "assistants",
        eyebrow: "Bienvenida",
        title: "Nuevos congregantes",
        copy: "Registra a cada nueva persona y déjala lista para seguimiento pastoral.",
        badge: {
          label: hiddenNewCount ? `${rows.length} visibles de ${allNewRows.length}` : `${rows.length} nuevos en periodo`,
          kind: rows.length ? "success" : "warning"
        },
        metrics: [
          { label: "Nuevos", value: String(rows.length) },
          { label: "Telefonos", value: String(withPhoneCount) },
          { label: "Seguimientos", value: String(withFollowupCount) },
          { label: "Nacimiento", value: String(withBirthDateCount) }
        ],
        actions: [
          { label: "Alta", variant: "primary", sectionId: "welcome-new-create" },
          { label: "Seguimientos", variant: "secondary", view: "welcome-followup" },
          { label: "Prospectos", variant: "ghost", view: "welcome-prospects" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip success">Nuevos en periodo</span>
          <strong>${escapeHtml(String(rows.length))}</strong>
          <span>Personas registradas por Bienvenida dentro del rango seleccionado.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Con teléfono</span>
          <strong>${escapeHtml(String(withPhoneCount))}</strong>
          <span>Listos para iniciar seguimiento inmediato.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Con historial</span>
          <strong>${escapeHtml(String(withFollowupCount))}</strong>
          <span>Ya cuentan con al menos un contacto registrado.</span>
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="panel-card module-section-anchor" id="welcome-new-create">
          <div class="panel-head">
            <div>
              <h2>Alta de nuevo congregante</h2>
              <p>Este registro nace como <strong>NUEVO</strong> dentro de Bienvenida y después continuará a Seguimientos o Prospectos.</p>
            </div>
          </div>

          <form id="assistant-create-form">
            <input type="hidden" name="tipoPersona" value="NUEVO">
            <input type="hidden" name="estado" value="ACTIVO">
            <input type="hidden" name="estatusBienvenida" value="NUEVO">
            <input type="hidden" name="workflowOrigin" value="welcome">

            <div class="field-grid two">
              <div class="field">
                <label for="welcome-new-nombre">Nombre</label>
                <input id="welcome-new-nombre" name="nombre" placeholder="Pedro" required>
              </div>
              <div class="field">
                <label for="welcome-new-apellidos">Apellidos</label>
                <input id="welcome-new-apellidos" name="apellidos" placeholder="Gutierrez" required>
              </div>
              <div class="field">
                <label for="welcome-new-telefono">Teléfono</label>
                <input id="welcome-new-telefono" name="telefono" placeholder="5551234567">
              </div>
              <div class="field">
                <label for="welcome-new-email">Email</label>
                <input id="welcome-new-email" name="email" type="email" placeholder="correo@iglesia.com">
              </div>
              <div class="field">
                <label for="welcome-new-estado-civil">Estado civil</label>
                <input id="welcome-new-estado-civil" name="estadoCivil" placeholder="Soltero, casado, viudo...">
              </div>
              <div class="field">
                <label for="welcome-new-edad">Edad</label>
                <input id="welcome-new-edad" name="edad" type="number" min="0" placeholder="28">
              </div>
              <div class="field">
                <label for="welcome-new-fecha-nacimiento">Fecha de nacimiento</label>
                <input id="welcome-new-fecha-nacimiento" name="fechaNacimiento" type="date">
              </div>
              <div class="field">
                <label for="welcome-new-fecha">Fecha de llegada</label>
                <input id="welcome-new-fecha" name="fechaIngreso" type="date" value="${escapeHtml(formatDateForInput_(new Date()))}">
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Registrar nuevo</button>
              <button class="btn btn-secondary" type="button" data-action="navigate" data-view="welcome-followup">Ir a seguimientos</button>
            </div>
          </form>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Filtro de Bienvenida</h2>
              <p>El listado se actualiza al aplicar el filtro o al usar un atajo rápido.</p>
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
            <button class="btn btn-primary" data-action="apply-congregants-filter">Aplicar filtro</button>
            <button class="btn btn-secondary" data-action="set-congregants-period" data-days="30">Último mes</button>
            <button class="btn btn-ghost" data-action="set-congregants-period" data-days="90">Últimos 3 meses</button>
            <button class="btn btn-ghost" data-action="clear-congregants-period">Ver todo</button>
          </div>

          <div class="summary-stack" style="margin-top: 18px;">
            <div class="summary-box">
              <span class="status-chip neutral">Rango activo</span>
              <strong>${escapeHtml(formatDate(state.filters.congregants.recentFrom) || "Sin inicio")} - ${escapeHtml(formatDate(state.filters.congregants.recentTo) || "Sin fin")}</strong>
              <span>${hiddenNewCount ? `${hiddenNewCount} nuevo(s) quedan fuera del rango actual.` : "Mostrando todos los nuevos dentro del rango elegido."}</span>
            </div>
          </div>

          <div class="summary-stack" style="margin-top: 18px;">
            <div class="summary-box">
              <span class="status-chip neutral">Pendientes de seguimiento</span>
              <strong>${escapeHtml(String(rows.filter((row) => !row.followupsCount).length))}</strong>
              <span>Nuevos sin bitácora todavía.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Con fecha de nacimiento</span>
              <strong>${escapeHtml(String(withBirthDateCount))}</strong>
              <span>Información lista para ubicar mejor el grupo ideal.</span>
            </div>
          </div>
        </article>
      </div>

      <article class="detail-card module-section-anchor" id="welcome-new-list">
        <div class="panel-head">
          <div>
            <h2>Listado de nuevos</h2>
            <p>Desde aquí Bienvenida puede abrir el expediente, agregar notas y luego moverlos a Prospectos.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(rows.length))} resultados</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Perfil</th>
                <th>Seguimiento</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((row) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(row.nombreCompleto || row.nombre || "Sin nombre")}</span>
                    <span class="row-meta">${escapeHtml(row.numero || "")} | QR ${escapeHtml(row.id || "")}</span>
                  </td>
                  <td>
                    <span class="row-title">${escapeHtml(row.telefono || "Sin teléfono")}</span>
                    <span class="row-meta">${escapeHtml(row.email || "Sin email")}</span>
                  </td>
                  <td>
                    <span class="row-title">${escapeHtml(row.estadoCivil || "Sin dato")}</span>
                    <span class="row-meta">Edad ${escapeHtml(String(row.edad || "Sin dato"))} | Alta ${escapeHtml(formatDate(row.fechaIngreso) || "Sin fecha")}</span>
                  </td>
                  <td>
                    <span class="row-title">${escapeHtml(row.followupsCount ? `${row.followupsCount} contacto(s)` : "Sin contactos")}</span>
                    <span class="row-meta">${escapeHtml(row.lastFollowupResult || "Pendiente")}</span>
                  </td>
                  <td>
                    <div class="inline-actions">
                      <button class="btn btn-secondary" data-action="open-welcome-profile" data-person-id="${escapeHtml(row.id || "")}">Seguimientos</button>
                    </div>
                  </td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="5">
                    <div class="empty-state">${hiddenNewCount ? `Hay ${hiddenNewCount} nuevo(s) fuera del rango actual. Usa "Ver todo" o ajusta las fechas.` : "No hay nuevos congregantes en el periodo seleccionado."}</div>
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

function renderWelcomeFollowupView_() {
  const rows = getWelcomeFollowupPeople_();
  const selectedProfile = state.welcomeProfile;
  const selectedPerson = selectedProfile?.person || null;
  const summary = buildWelcomeSummary_();
  const selectedHealth = selectedPerson ? getWelcomeFollowupHealth_(selectedPerson) : null;
  const overdueCount = rows.filter((row) => getWelcomeFollowupHealth_(row).overdue).length;
  const inTimeCount = Math.max(rows.length - overdueCount, 0);
  const withSuggestedGroupCount = rows.filter((row) => row.suggestedGroupId).length;
  const statusOptions = [
    { value: "ALL", label: "Todos los estatus" },
    { value: "NUEVO", label: "Nuevo" },
    { value: "PROSPECTO GP", label: "Prospecto GP" },
    { value: "CONGREGANTE", label: "Congregante" }
  ];
  const groupOptions = renderOptions(
    state.catalogs.groups.map((group) => ({
      value: String(group.id),
      label: `${group.name} (${group.id})`
    })),
    state.filters.welcome.groupId,
    "Todos los grupos"
  );

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "assistants",
        eyebrow: "Ministerio de Bienvenida",
        title: "Seguimientos",
        copy: "Consulta los nuevos, identifica casos vencidos y registra cada contacto con claridad.",
        badge: {
          label: `${overdueCount} vencidos`,
          kind: overdueCount ? "warning" : "success"
        },
        metrics: [
          { label: "Activos", value: String(rows.length) },
          { label: "Nuevos", value: String(summary.newPeople) },
          { label: "Prospectos", value: String(summary.prospects) },
          { label: "En tiempo", value: String(inTimeCount) }
        ],
        actions: [
          { label: "Nuevos", variant: "secondary", view: "congregants-new" },
          { label: "Prospectos", variant: "primary", view: "welcome-prospects" },
          { label: "Detalle", variant: "ghost", sectionId: "welcome-profile" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip neutral">Casos activos</span>
          <strong>${escapeHtml(String(rows.length))}</strong>
          <span>Nuevos y prospectos GP que siguen bajo cuidado de Bienvenida.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip success">En tiempo</span>
          <strong>${escapeHtml(String(inTimeCount))}</strong>
          <span>Tienen seguimiento vigente y próximo contacto programado.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip danger">Vencidos</span>
          <strong>${escapeHtml(String(overdueCount))}</strong>
          <span>Sin seguimiento o con próximo contacto ya vencido.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Con grupo sugerido</span>
          <strong>${escapeHtml(String(withSuggestedGroupCount))}</strong>
          <span>Listos para avanzar a Prospectos y avisar al líder correcto.</span>
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Filtro pastoral</h2>
              <p>Busca por nombre y localiza rápido quién necesita seguimiento hoy.</p>
            </div>
            <button class="btn btn-secondary" data-action="refresh-welcome">Actualizar</button>
          </div>

          <div class="field-grid two">
            <div class="field">
              <label for="welcome-search">Buscar</label>
              <input id="welcome-search" value="${escapeHtml(state.filters.welcome.search)}" placeholder="Nombre, teléfono, QR ID o grupo">
            </div>
            <div class="field">
              <label for="welcome-status">Estatus</label>
              <select id="welcome-status">
                ${renderOptions(statusOptions, state.filters.welcome.status, "Todos los estatus")}
              </select>
            </div>
            <div class="field">
              <label for="welcome-group">Grupo sugerido</label>
              <select id="welcome-group">
                ${groupOptions}
              </select>
            </div>
          </div>
        </article>

        <article class="panel-card module-section-anchor" id="welcome-profile">
          <div class="panel-head">
            <div>
              <h2>${selectedPerson ? "Ficha de seguimiento" : "Selecciona una persona"}</h2>
              <p>${selectedPerson ? "Actualiza su estatus, grupo sugerido y próximo contacto antes de registrar un nuevo evento." : "Toca Ver seguimientos desde la tabla para abrir el expediente pastoral."}</p>
            </div>
            ${selectedPerson ? renderWorkflowStatusPill_(selectedPerson.welcomeStatus) : `<span class="pill dark">Sin selección</span>`}
          </div>

          ${selectedPerson ? `
            <div class="summary-stack">
              <div class="summary-box">
                <span class="status-chip neutral">Persona</span>
                <strong>${escapeHtml(selectedPerson.nombreCompleto || selectedPerson.nombre || "Sin nombre")}</strong>
                <span>${escapeHtml(selectedPerson.numero || "-")} | QR ${escapeHtml(selectedPerson.id || "-")}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip ${selectedHealth?.tone === "danger" ? "danger" : "success"}">Semaforo</span>
                <strong>${escapeHtml(selectedHealth?.label || "Sin dato")}</strong>
                <span>${escapeHtml(selectedPerson.nextFollowUpDate ? `Proximo: ${formatDate(selectedPerson.nextFollowUpDate)}` : "Programa el siguiente contacto")}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Grupo sugerido</span>
                <strong>${escapeHtml(selectedPerson.suggestedGroupName || "Sin sugerencia")}</strong>
                <span>${escapeHtml(getWelcomeLeaderContactSummary_(selectedPerson))}</span>
              </div>
            </div>

            <form id="welcome-person-form" style="margin-top: 18px;">
              <input type="hidden" name="personId" value="${escapeHtml(selectedPerson.id || "")}">
              <div class="field-grid two">
                <div class="field">
                  <label for="welcome-person-status">Estatus</label>
                  <select id="welcome-person-status" name="status">
                    ${renderOptions(statusOptions.filter((item) => item.value !== "ALL"), selectedPerson.welcomeStatus, "Selecciona estatus")}
                  </select>
                </div>
                <div class="field">
                  <label for="welcome-person-group">Grupo sugerido</label>
                  <select id="welcome-person-group" name="suggestedGroupId">
                    ${renderOptions(
                      state.catalogs.groups.map((group) => ({
                        value: String(group.id),
                        label: `${group.name} (${group.id})`
                      })),
                      selectedPerson.suggestedGroupId,
                      "Selecciona grupo sugerido"
                    )}
                  </select>
                </div>
                <div class="field">
                  <label for="welcome-person-next">Próximo seguimiento</label>
                  <input id="welcome-person-next" name="nextFollowUpDate" type="date" value="${escapeHtml(formatDateForInput_(selectedPerson.nextFollowUpDate) || "")}">
                </div>
                <div class="field">
                  <label for="welcome-person-notes">Notas actuales</label>
                  <input id="welcome-person-notes" name="notes" value="${escapeHtml(selectedPerson.notasBienvenida || selectedPerson.lastFollowupNotes || "")}" placeholder="Contexto pastoral del caso">
                </div>
              </div>

              <div class="actions-row">
                <button class="btn btn-primary" type="submit">Guardar ficha</button>
                ${renderWelcomeLeaderWhatsappButtons_(selectedPerson)}
              </div>
            </form>
          ` : `
            <div class="empty-state">Abre un expediente desde el listado para revisar su semáforo, actualizar la ficha y registrar el siguiente contacto.</div>
          `}
        </article>
      </div>

      <article class="detail-card">
        <div class="panel-head">
          <div>
            <h2>Listado de seguimientos</h2>
            <p>La tabla te marca qué casos están al día y cuáles requieren atención inmediata.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(rows.length))} resultados</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Congregante</th>
                <th>Estatus</th>
                <th>Semaforo</th>
                <th>Próximo contacto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map((row) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(row.nombreCompleto || row.nombre || "Sin nombre")}</span>
                    <span class="row-meta">${escapeHtml(row.telefono || "Sin teléfono")} | Alta ${escapeHtml(formatDate(row.fechaIngreso) || "-")}</span>
                    <span class="row-meta">${escapeHtml(row.numero || "-")} | QR ${escapeHtml(row.id || "-")}</span>
                  </td>
                  <td>${renderWorkflowStatusPill_(row.welcomeStatus)}</td>
                  <td>${renderWelcomeFollowupHealthPill_(row)}</td>
                  <td>
                    <span class="row-title">${escapeHtml(formatDate(row.nextFollowUpDate) || "Sin fecha")}</span>
                    <span class="row-meta">${escapeHtml(row.lastFollowupResult || row.lastActionType || "Sin resultado")}</span>
                  </td>
                  <td>
                    <div class="inline-actions">
                      <button class="btn btn-secondary" data-action="open-welcome-profile" data-person-id="${escapeHtml(row.id || "")}">Ver seguimientos</button>
                    </div>
                  </td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="5"><div class="empty-state">No hay personas nuevas o prospectos GP que coincidan con los filtros.</div></td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      ${selectedPerson ? `
        <article class="detail-card">
          <div class="panel-head">
            <div>
              <h2>Bitácora de seguimiento</h2>
              <p>Registra cómo fue el contacto, qué pasó y cuándo debe ocurrir el siguiente acercamiento.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(selectedProfile?.followups?.length || 0))} eventos</span>
          </div>

          <form id="welcome-followup-form" style="margin-bottom: 18px;">
            <input type="hidden" name="personId" value="${escapeHtml(selectedPerson.id || "")}">
            <div class="field-grid two">
              <div class="field">
                <label for="welcome-followup-type">Tipo de contacto</label>
                <select id="welcome-followup-type" name="actionType">
                  ${renderOptions([
                    { value: "LLAMADA", label: "Llamada" },
                    { value: "CORREO", label: "Correo" },
                    { value: "WHATSAPP", label: "WhatsApp" },
                    { value: "SEGUIMIENTO", label: "Seguimiento" }
                  ], "LLAMADA", "Selecciona contacto")}
                </select>
              </div>
              <div class="field">
                <label for="welcome-followup-date">Fecha de contacto</label>
                <input id="welcome-followup-date" name="actionDate" type="date" value="${escapeHtml(formatDateForInput_(new Date()))}">
              </div>
              <div class="field">
                <label for="welcome-followup-owner">Responsable</label>
                <input id="welcome-followup-owner" name="owner" placeholder="Bienvenida / líder / seguimiento">
              </div>
              <div class="field">
                <label for="welcome-followup-next">Próximo contacto</label>
                <input id="welcome-followup-next" name="nextFollowUpDate" type="date" value="${escapeHtml(formatDateForInput_(selectedPerson.nextFollowUpDate) || "")}">
              </div>
              <div class="field">
                <label for="welcome-followup-result">Resultado breve</label>
                <input id="welcome-followup-result" name="result" placeholder="Confirmó interés, no respondió, pidió llamada...">
              </div>
              <div class="field">
                <label for="welcome-followup-status">Nuevo estatus</label>
                <select id="welcome-followup-status" name="status">
                  ${renderOptions(statusOptions.filter((item) => item.value !== "ALL"), selectedPerson.welcomeStatus, "Selecciona estatus")}
                </select>
              </div>
              <div class="field">
                <label for="welcome-followup-group">Grupo sugerido</label>
                <select id="welcome-followup-group" name="suggestedGroupId">
                  ${renderOptions(
                    state.catalogs.groups.map((group) => ({
                      value: String(group.id),
                      label: `${group.name} (${group.id})`
                    })),
                    selectedPerson.suggestedGroupId,
                    "Selecciona grupo sugerido"
                  )}
                </select>
              </div>
              <div class="field" style="grid-column: 1 / -1;">
                <label for="welcome-followup-notes">Descripción del seguimiento</label>
                <textarea id="welcome-followup-notes" name="notes" rows="3" placeholder="Qué pasó en el contacto, qué respondió la persona y cuál será el siguiente paso"></textarea>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">Registrar seguimiento</button>
            </div>
          </form>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Contacto</th>
                  <th>Resultado</th>
                  <th>Responsable</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                ${(selectedProfile?.followups || []).length ? (selectedProfile.followups || []).map((followup) => `
                  <tr>
                    <td>${escapeHtml(formatDateTimeCompact_(followup.actionDate) || "-")}</td>
                    <td>
                      <span class="row-title">${escapeHtml(followup.actionType || "-")}</span>
                      <span class="row-meta">${escapeHtml(followup.nextFollowUpDate ? `Siguiente: ${formatDate(followup.nextFollowUpDate)}` : "Sin próximo contacto")}</span>
                    </td>
                    <td>${renderWorkflowResultPill_(followup.result)}</td>
                    <td>${escapeHtml(followup.owner || "Sin responsable")}</td>
                    <td>${escapeHtml(followup.notes || "Sin descripción")}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="5"><div class="empty-state">Todavía no hay seguimientos registrados para esta persona.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>
      ` : ""}
    </section>
  `;
}

function renderWelcomeProspectsView_() {
  const rows = getWelcomeProspectPeople_();
  const selectedProfile = state.welcomeProfile;
  const selectedPerson = selectedProfile?.person || null;
  const selectedMatchesView = selectedPerson && rows.some((row) => String(row.id) === String(selectedPerson.id));
  const activePerson = selectedMatchesView ? selectedPerson : null;
  const readyToSend = rows.filter((row) => row.suggestedGroupId && getWelcomeLeaderWhatsappTargets_(row).length).length;

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "assistants",
        eyebrow: "Ministerio de Bienvenida",
        title: "Prospectos para grupos de conexión",
        copy: "Ubica a cada nuevo en su grupo sugerido, pásalo a prospecto y prepara el aviso para el líder.",
        badge: {
          label: `${rows.length} por integrar`,
          kind: rows.length ? "warning" : "success"
        },
        metrics: [
          { label: "Pendientes", value: String(rows.length) },
          { label: "Listos", value: String(readyToSend) },
          { label: "Con grupo", value: String(rows.filter((row) => row.suggestedGroupId).length) },
          { label: "Con líder", value: String(rows.filter((row) => hasWelcomeLeaderContact_(row)).length) }
        ],
        actions: [
          { label: "Seguimientos", variant: "secondary", view: "welcome-followup" },
          { label: "Asignación", variant: "primary", view: "participants" },
          { label: "Detalle", variant: "ghost", sectionId: "welcome-prospect-profile" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip warning">Pendientes de grupo</span>
          <strong>${escapeHtml(String(rows.length))}</strong>
          <span>Personas nuevas o prospectos que todavía no quedan integrados en la temporada actual.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Listos para aviso</span>
          <strong>${escapeHtml(String(readyToSend))}</strong>
          <span>Ya tienen grupo sugerido y líder detectado para preparar WhatsApp.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Ajuste manual</span>
          <strong>${escapeHtml(String(rows.filter((row) => !row.suggestedGroupId).length))}</strong>
          <span>Casos que todavía requieren revisar o corregir el grupo ideal.</span>
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="detail-card">
          <div class="panel-head">
            <div>
              <h2>Listado de prospectos</h2>
              <p>Selecciona el caso correcto, valida el grupo sugerido y desde ahí avisa al líder.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(rows.length))} casos</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Congregante</th>
                  <th>Grupo sugerido</th>
                  <th>Líderes</th>
                  <th>Estatus</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows.map((row) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(row.nombreCompleto || row.nombre || "Sin nombre")}</span>
                      <span class="row-meta">${escapeHtml(row.telefono || "Sin teléfono")} | ${escapeHtml(row.numero || "-")}</span>
                      <span class="row-meta">Alta ${escapeHtml(formatDate(row.fechaIngreso) || "-")} | QR ${escapeHtml(row.id || "-")}</span>
                    </td>
                    <td>
                      <span class="row-title">${escapeHtml(row.suggestedGroupName || "Sin grupo sugerido")}</span>
                      <span class="row-meta">${escapeHtml(row.estadoCivil || "Sin estado civil")} | Edad ${escapeHtml(String(row.edad || "Sin dato"))}</span>
                    </td>
                    <td>
                      <span class="row-title">${escapeHtml((row.leaderContacts || []).length ? `${row.leaderContacts.length} contacto(s)` : "Sin líder detectado")}</span>
                      <span class="row-meta">${escapeHtml(getWelcomeLeaderContactSummary_(row))}</span>
                    </td>
                    <td>${renderWorkflowStatusPill_(row.welcomeStatus)}</td>
                    <td>
                      <div class="inline-actions">
                        <button class="btn btn-secondary" data-action="open-welcome-profile" data-person-id="${escapeHtml(row.id || "")}">Abrir</button>
                        <button
                          class="btn btn-ghost"
                          data-action="send-welcome-prospect"
                          data-person-id="${escapeHtml(row.id || "")}"
                          ${row.suggestedGroupId ? "" : "disabled"}
                        >
                          Enviar
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="5"><div class="empty-state">No hay prospectos pendientes. Cuando un nuevo pase a grupo, aquí aparecerá listo para avisar al líder.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel-card module-section-anchor" id="welcome-prospect-profile">
          <div class="panel-head">
            <div>
              <h2>${activePerson ? "Preparar prospecto" : "Selecciona una persona"}</h2>
              <p>${activePerson ? "Confirma grupo, deja notas y el sistema la moverá a PROSPECTO GP para preparar el WhatsApp del líder." : "Abre un caso desde el listado para definir el grupo de conexión y avisar al líder."}</p>
            </div>
            ${activePerson ? renderWorkflowStatusPill_(activePerson.welcomeStatus) : `<span class="pill dark">Sin selección</span>`}
          </div>

          ${activePerson ? `
            <div class="summary-stack">
              <div class="summary-box">
                <span class="status-chip neutral">Congregante</span>
                <strong>${escapeHtml(activePerson.nombreCompleto || activePerson.nombre || "Sin nombre")}</strong>
                <span>${escapeHtml(activePerson.numero || "-")} | QR ${escapeHtml(activePerson.id || "-")}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Grupo sugerido</span>
                <strong>${escapeHtml(activePerson.suggestedGroupName || "Sin sugerencia")}</strong>
                <span>${escapeHtml(getWelcomeLeaderContactSummary_(activePerson))}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Próximo paso</span>
                <strong>${escapeHtml(formatDate(activePerson.nextFollowUpDate) || "Sin fecha")}</strong>
                <span>${escapeHtml(activePerson.lastFollowupNotes || activePerson.notasBienvenida || "Sin notas registradas")}</span>
              </div>
            </div>

            <form id="welcome-prospect-form" style="margin-top: 18px;">
              <input type="hidden" name="personId" value="${escapeHtml(activePerson.id || "")}">
              <input type="hidden" name="status" value="PROSPECTO GP">
              <div class="field-grid two">
                <div class="field">
                  <label for="welcome-prospect-group">Grupo de conexión</label>
                  <select id="welcome-prospect-group" name="suggestedGroupId" required>
                    ${renderOptions(
                      state.catalogs.groups.map((group) => ({
                        value: String(group.id),
                        label: `${group.name} (${group.id})`
                      })),
                      activePerson.suggestedGroupId,
                      "Selecciona grupo sugerido"
                    )}
                  </select>
                </div>
                <div class="field">
                  <label for="welcome-prospect-next">Próximo seguimiento</label>
                  <input id="welcome-prospect-next" name="nextFollowUpDate" type="date" value="${escapeHtml(formatDateForInput_(activePerson.nextFollowUpDate) || "")}">
                </div>
                <div class="field" style="grid-column: 1 / -1;">
                  <label for="welcome-prospect-notes">Notas para el líder</label>
                  <textarea id="welcome-prospect-notes" name="notes" rows="4" placeholder="Indica edad, contexto, cómo llegó a la iglesia y lo que debe revisar el líder">${escapeHtml(activePerson.lastFollowupNotes || activePerson.notasBienvenida || "")}</textarea>
                </div>
              </div>

              <div class="actions-row">
                <button class="btn btn-primary" type="submit">Guardar y preparar WhatsApp</button>
                ${renderWelcomeLeaderWhatsappButtons_(activePerson, {
                  variant: "btn btn-secondary",
                  emptyLabel: "Sin WhatsApp líder"
                })}
                <button class="btn btn-secondary" type="button" data-action="navigate" data-view="participants">Ir a asignación</button>
              </div>
            </form>
          ` : `
            <div class="empty-state">No hay un prospecto abierto en pantalla. Selecciona uno desde la tabla para continuar.</div>
          `}
        </article>
      </div>
    </section>
  `;
}

function renderFormationView_() {
  const candidates = getFilteredFormationCandidates_();
  const records = getFilteredFormationRecords_();
  const profile = state.formationProfile;
  const selectedPersonId = state.ui.selectedFormationPersonId;
  const selectedCandidate = candidates.find((item) => String(item.personId) === String(selectedPersonId || ""))
    || profile?.currentCandidate
    || (profile?.person ? {
      personId: profile.person.id,
      personName: profile.person.nombreCompleto || profile.person.nombre || "Congregante",
      personNumber: profile.person.numero || "",
      groupId: profile.person.grupo || "",
      groupName: resolveGroupName_(profile.person.grupo) || profile.person.grupo || "Sin grupo",
      seasonId: state.filters.formation.seasonId || "",
      formationStatus: profile.person.estatusFormacion || "",
      currentLevel: profile.person.nivelFormacionActual || ""
    } : null);
  const editingLevel = state.formationCatalog.find((item) => String(item.id) === String(state.ui.editingFormationLevelId || "")) || null;
  const editingRecord = records.find((item) => String(item.id) === String(state.ui.editingFormationRecordId || "")) || profile?.records?.find((item) => String(item.id) === String(state.ui.editingFormationRecordId || "")) || null;
  const summary = buildFormationSummary_();
  const seasonId = state.filters.formation.seasonId || getLatestSeason()?.id || "";

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "participants",
        eyebrow: "Proceso de Formación",
        title: "Prospectos, validación e historial",
        copy: "Evalúa asistencia, manda prospectos a coordinación y visualiza el avance completo por persona.",
        badge: {
          label: `${summary.pending} por validar`,
          kind: summary.pending ? "warning" : "dark"
        },
        metrics: [
          { label: "Candidatos", value: String(summary.candidates) },
          { label: "Prospectos", value: String(summary.prospects) },
          { label: "Aceptados", value: String(summary.accepted) },
          { label: "Acreditados", value: String(summary.approved) }
        ],
        actions: [
          { label: "Asignacion", variant: "secondary", view: "participants" },
          { label: "Asistencias", variant: "primary", view: "attendance" },
          { label: "Historial", variant: "ghost", sectionId: "formation-profile" }
        ]
      })}

      <div class="stats-grid assistants-stats-grid">
        <article class="stat-card">
          <span class="status-chip neutral">Catálogo activo</span>
          <strong>${escapeHtml(String(state.formationCatalog.length))}</strong>
          <span>Niveles cargados para ordenar todo el proceso.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip warning">Pendientes</span>
          <strong>${escapeHtml(String(summary.pending))}</strong>
          <span>Prospectos esperando validación o arranque formal.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip success">En curso</span>
          <strong>${escapeHtml(String(summary.inProgress))}</strong>
          <span>Congregantes avanzando en su formación.</span>
        </article>
        <article class="stat-card">
          <span class="status-chip neutral">Historial</span>
          <strong>${escapeHtml(String(records.length))}</strong>
          <span>Casos registrados dentro del proceso formativo.</span>
        </article>
      </div>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <h2>Filtro operativo</h2>
            <p>Selecciona la temporada y el grupo para revisar quién ya puede ser prospectado.</p>
          </div>
          <button class="btn btn-secondary" data-action="refresh-formation">Actualizar</button>
        </div>

        <div class="field-grid two">
          ${renderSeasonSelect("formation-season", state.filters.formation.seasonId || seasonId)}
          <div class="field">
            <label for="formation-group">Grupo</label>
            <select id="formation-group">
              ${renderOptions(
                state.catalogs.groups.map((group) => ({
                  value: String(group.id),
                  label: `${group.name} (${group.id})`
                })),
                state.filters.formation.groupId,
                "Todos los grupos"
              )}
            </select>
          </div>
          <div class="field">
            <label for="formation-level-filter">Nivel</label>
            <select id="formation-level-filter">
              ${renderOptions(
                state.formationCatalog.map((level) => ({
                  value: level.id,
                  label: `${level.name} (${level.order})`
                })),
                state.filters.formation.levelId,
                "Todos los niveles"
              )}
            </select>
          </div>
          <div class="field">
            <label for="formation-status-filter">Estatus</label>
            <select id="formation-status-filter">
              ${renderOptions([
                { value: "ALL", label: "Todos los estatus" },
                { value: "PROSPECTO GF", label: "Prospecto GF" },
                { value: "ACEPTADO_FORMACION", label: "Aceptado" },
                { value: "RECHAZADO_FORMACION", label: "Rechazado" },
                { value: "EN_CURSO", label: "En curso" },
                { value: "ACREDITADO", label: "Acreditado" },
                { value: "NO_ACREDITADO", label: "No acreditado" }
              ], state.filters.formation.status, "Todos los estatus")}
            </select>
          </div>
          <div class="field" style="grid-column: 1 / -1;">
            <label for="formation-search">Buscar</label>
            <input id="formation-search" value="${escapeHtml(state.filters.formation.search)}" placeholder="Nombre, QR ID, grupo o nivel">
          </div>
        </div>
      </article>

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>${editingRecord ? "Actualizar caso formativo" : "Prospectar o validar congregante"}</h2>
              <p>${selectedCandidate ? `${selectedCandidate.personName} | ${selectedCandidate.groupName || "Sin grupo"}` : "Selecciona un congregante desde la tabla para cargarlo en el formulario."}</p>
            </div>
            ${selectedCandidate ? renderWorkflowStatusPill_(selectedCandidate.formationStatus || "SIN_PROCESO") : `<span class="pill dark">Sin selección</span>`}
          </div>

          <form id="formation-record-form">
            <input type="hidden" name="id" value="${escapeHtml(editingRecord?.id || "")}">
            <input type="hidden" name="personId" value="${escapeHtml(selectedCandidate?.personId || profile?.person?.id || "")}">
            <input type="hidden" name="seasonId" value="${escapeHtml(selectedCandidate?.seasonId || seasonId || "")}">
            <input type="hidden" name="groupId" value="${escapeHtml(selectedCandidate?.groupId || profile?.currentCandidate?.groupId || "")}">

            <div class="field-grid two">
              <div class="field">
                <label for="formation-level">Nivel</label>
                <select id="formation-level" name="levelId">
                  ${renderOptions(
                    state.formationCatalog.map((level) => ({
                      value: level.id,
                      label: `${level.name} (${level.order})`
                    })),
                    editingRecord?.levelId || profile?.nextLevel?.id || "",
                    "Selecciona nivel"
                  )}
                </select>
              </div>
              <div class="field">
                <label for="formation-status">Estatus</label>
                <select id="formation-status" name="status">
                  ${renderOptions([
                    { value: "PROSPECTO GF", label: "Prospecto GF" },
                    { value: "ACEPTADO_FORMACION", label: "Aceptado formación" },
                    { value: "RECHAZADO_FORMACION", label: "Rechazado formación" },
                    { value: "EN_CURSO", label: "En curso" },
                    { value: "ACREDITADO", label: "Acreditado" },
                    { value: "NO_ACREDITADO", label: "No acreditado" }
                  ], editingRecord?.status || "PROSPECTO GF", "Selecciona estatus")}
                </select>
              </div>
              <div class="field">
                <label for="formation-requested-by">Solicitado por</label>
                <input id="formation-requested-by" name="requestedBy" value="${escapeHtml(editingRecord?.requestedBy || state.user?.name || "")}" placeholder="Líder o responsable">
              </div>
              <div class="field">
                <label for="formation-reviewed-by">Revisado por</label>
                <input id="formation-reviewed-by" name="reviewedBy" value="${escapeHtml(editingRecord?.reviewedBy || "")}" placeholder="Coordinación">
              </div>
              <div class="field">
                <label for="formation-start-date">Inicio</label>
                <input id="formation-start-date" name="startDate" type="date" value="${escapeHtml(formatDateForInput_(editingRecord?.startDate) || "")}">
              </div>
              <div class="field">
                <label for="formation-end-date">Fin</label>
                <input id="formation-end-date" name="endDate" type="date" value="${escapeHtml(formatDateForInput_(editingRecord?.endDate) || "")}">
              </div>
              <div class="field">
                <label for="formation-result">Resultado</label>
                <input id="formation-result" name="result" value="${escapeHtml(editingRecord?.result || "")}" placeholder="Aprobado, por iniciar, reagendado...">
              </div>
              <div class="field">
                <label for="formation-reason">Motivo / observación</label>
                <input id="formation-reason" name="reason" value="${escapeHtml(editingRecord?.reason || "")}" placeholder="Usa este campo si fue rechazado o reagendado">
              </div>
              <div class="field" style="grid-column: 1 / -1;">
                <label for="formation-notes">Notas</label>
                <textarea id="formation-notes" name="notes" rows="3" placeholder="Seguimiento del líder, validación de coordinación o acuerdos pastorales">${escapeHtml(editingRecord?.notes || "")}</textarea>
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit" ${selectedCandidate || profile?.person ? "" : "disabled"}>${editingRecord ? "Guardar cambios" : "Registrar caso"}</button>
              <button class="btn btn-ghost" type="button" data-action="clear-formation-record-form" ${editingRecord || selectedCandidate ? "" : "disabled"}>Limpiar</button>
              ${profile?.records?.[0]?.coordinatorWhatsappUrl ? `<a class="btn btn-secondary" href="${escapeHtml(profile.records[0].coordinatorWhatsappUrl)}" target="_blank" rel="noreferrer">Preparar WhatsApp coordinación</a>` : ""}
            </div>
          </form>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>${editingLevel ? "Editar nivel" : "Catálogo de niveles"}</h2>
              <p>Ordena la ruta de formación y deja listo el siguiente paso cuando alguien acredite.</p>
            </div>
          </div>

          <form id="formation-level-form">
            <input type="hidden" name="id" value="${escapeHtml(editingLevel?.id || "")}">
            <div class="field-grid two">
              <div class="field">
                <label for="formation-level-name">Nombre</label>
                <input id="formation-level-name" name="name" value="${escapeHtml(editingLevel?.name || "")}" placeholder="Encuentro" required>
              </div>
              <div class="field">
                <label for="formation-level-order">Orden</label>
                <input id="formation-level-order" name="order" type="number" min="0" value="${escapeHtml(String(editingLevel?.order || state.formationCatalog.length + 1))}" required>
              </div>
              <div class="field">
                <label for="formation-level-status">Estado</label>
                <select id="formation-level-status" name="status">
                  ${renderOptions([
                    { value: "ACTIVO", label: "ACTIVO" },
                    { value: "INACTIVO", label: "INACTIVO" }
                  ], editingLevel?.status || "ACTIVO", "Selecciona estado")}
                </select>
              </div>
              <div class="field" style="grid-column: 1 / -1;">
                <label for="formation-level-description">Descripción</label>
                <input id="formation-level-description" name="description" value="${escapeHtml(editingLevel?.description || "")}" placeholder="Objetivo pastoral o alcance del nivel">
              </div>
            </div>

            <div class="actions-row">
              <button class="btn btn-primary" type="submit">${editingLevel ? "Guardar nivel" : "Crear nivel"}</button>
              <button class="btn btn-ghost" type="button" data-action="clear-formation-level-form" ${editingLevel ? "" : "disabled"}>Limpiar</button>
            </div>
          </form>

          <div class="table-wrap" style="margin-top: 18px;">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Nivel</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${state.formationCatalog.length ? state.formationCatalog.map((level) => `
                  <tr>
                    <td>${escapeHtml(String(level.order || 0))}</td>
                    <td>
                      <span class="row-title">${escapeHtml(level.name)}</span>
                      <span class="row-meta">${escapeHtml(level.description || "Sin descripción")}</span>
                    </td>
                    <td>${renderPill(level.status)}</td>
                    <td><button class="btn btn-secondary" data-action="edit-formation-level" data-level-id="${escapeHtml(level.id)}">Editar</button></td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="4"><div class="empty-state">Crea el catálogo inicial de niveles para activar este módulo.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article class="detail-card">
        <div class="panel-head">
          <div>
            <h2>Candidatos por asistencia</h2>
            <p>Usa la asistencia como criterio. Aquí ves cada grupo, su porcentaje y desde aquí arrancas el proceso.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(candidates.length))} candidatos</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Congregante</th>
                <th>Grupo</th>
                <th>Asistencia</th>
                <th>Formación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${candidates.length ? candidates.map((candidate) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(candidate.personName)}</span>
                    <span class="row-meta">${escapeHtml(candidate.personNumber || "-")} | QR ${escapeHtml(candidate.personId)}</span>
                  </td>
                  <td>${escapeHtml(candidate.groupName || "Sin grupo")}</td>
                  <td>
                    <span class="row-title">${escapeHtml(String(candidate.attendanceRate || 0))}%</span>
                    <span class="row-meta">${escapeHtml(String(candidate.attendanceCount || 0))}/${escapeHtml(String(candidate.sessionsCount || 0))} sesiones</span>
                  </td>
                  <td>
                    ${renderWorkflowStatusPill_(candidate.formationStatus || "SIN_PROCESO")}
                    <span class="row-meta">${escapeHtml(candidate.currentLevel || "Sin nivel actual")}</span>
                  </td>
                  <td>
                    <div class="inline-actions">
                      <button class="btn btn-secondary" data-action="select-formation-person" data-person-id="${escapeHtml(candidate.personId)}">Cargar</button>
                      <button class="btn btn-ghost" data-action="open-formation-profile" data-person-id="${escapeHtml(candidate.personId)}">Perfil</button>
                    </div>
                  </td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="5"><div class="empty-state">No hay candidatos para la temporada y filtros seleccionados.</div></td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      <article class="detail-card">
        <div class="panel-head">
          <div>
            <h2>Casos de formación</h2>
            <p>Consulta el historial operativo: quién fue prospectado, quién fue aceptado y quién ya acreditó.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(records.length))} registros</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Congregante</th>
                <th>Nivel</th>
                <th>Estatus</th>
                <th>Seguimiento</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${records.length ? records.map((record) => `
                <tr>
                  <td>
                    <span class="row-title">${escapeHtml(record.personName)}</span>
                    <span class="row-meta">${escapeHtml(record.groupName || "Sin grupo")} | ${escapeHtml(record.seasonId || "Sin temporada")}</span>
                  </td>
                  <td>${escapeHtml(record.levelName || "Sin nivel")}</td>
                  <td>${renderWorkflowStatusPill_(record.status)}</td>
                  <td>
                    <span class="row-title">${escapeHtml(formatDate(record.requestedAt) || "Sin fecha")}</span>
                    <span class="row-meta">${escapeHtml(record.reviewedBy || record.requestedBy || "Sin responsable")}</span>
                  </td>
                  <td>
                    <div class="inline-actions">
                      <button class="btn btn-secondary" data-action="edit-formation-record" data-record-id="${escapeHtml(record.id)}" data-person-id="${escapeHtml(record.personId)}">Editar</button>
                      <button class="btn btn-ghost" data-action="open-formation-profile" data-person-id="${escapeHtml(record.personId)}">Perfil</button>
                    </div>
                  </td>
                </tr>
              `).join("") : `
                <tr>
                  <td colspan="5"><div class="empty-state">Todavía no hay casos formativos registrados.</div></td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </article>

      <article class="detail-card module-section-anchor" id="formation-profile">
        <div class="panel-head">
          <div>
            <h2>${profile?.person ? "Perfil formativo" : "Selecciona un congregante"}</h2>
            <p>${profile?.person ? "Aquí ves todo su historial, el nivel actual y el siguiente paso recomendado." : "Abre el perfil desde Candidatos o Casos para consultar el historial completo."}</p>
          </div>
          ${profile?.person ? renderWorkflowStatusPill_(profile.person.estatusFormacion || "SIN_PROCESO") : `<span class="pill dark">Sin perfil</span>`}
        </div>

        ${profile?.person ? `
          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Congregante</span>
              <strong>${escapeHtml(profile.person.nombreCompleto || profile.person.nombre || "-")}</strong>
              <span>${escapeHtml(profile.person.numero || "-")} | QR ${escapeHtml(profile.person.id || "-")}</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Grupo actual</span>
              <strong>${escapeHtml(profile.currentCandidate?.groupName || resolveGroupName_(profile.person.grupo) || "Sin grupo")}</strong>
              <span>${escapeHtml(profile.currentCandidate ? `${profile.currentCandidate.attendanceCount}/${profile.currentCandidate.sessionsCount} asistencias` : "Sin resumen de asistencia")}</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Nivel actual</span>
              <strong>${escapeHtml(profile.person.nivelFormacionActual || "Sin nivel")}</strong>
              <span>${escapeHtml(profile.person.estatusFormacion || "Sin proceso")}</span>
            </div>
            <div class="summary-box">
              <span class="status-chip neutral">Siguiente paso</span>
              <strong>${escapeHtml(profile.nextLevel?.name || "Sin recomendación")}</strong>
              <span>${escapeHtml(profile.nextLevel ? `Orden ${profile.nextLevel.order}` : "Primero define el catálogo o acredita un nivel")}</span>
            </div>
          </div>

          <div class="table-wrap" style="margin-top: 18px;">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nivel</th>
                  <th>Estatus</th>
                  <th>Resultado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                ${(profile.records || []).length ? profile.records.map((record) => `
                  <tr>
                    <td>${escapeHtml(formatDate(record.requestedAt) || "-")}</td>
                    <td>
                      <span class="row-title">${escapeHtml(record.levelName || "Sin nivel")}</span>
                      <span class="row-meta">${escapeHtml(record.reviewedBy || record.requestedBy || "Sin responsable")}</span>
                    </td>
                    <td>${renderWorkflowStatusPill_(record.status)}</td>
                    <td>${escapeHtml(record.result || record.reason || "Sin resultado")}</td>
                    <td>${escapeHtml(record.notes || "Sin notas")}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="5"><div class="empty-state">Este congregante aún no tiene historial dentro del proceso de formación.</div></td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">Selecciona una persona para consultar su historial, revisar su asistencia y decidir si avanza al siguiente nivel.</div>
        `}
      </article>
    </section>
  `;
}

function renderCatalogsView_() {
  const groupSearch = normalizeText(state.filters.admin.groupSearch);
  const ministrySearch = normalizeText(state.filters.admin.ministrySearch);
  const groups = state.catalogs.groups.filter((group) => {
    const haystack = `${group.id} ${group.name} ${group.leader1Name || ""} ${group.leader2Name || ""}`.toLowerCase();
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
              <p>Agrega grupos y deja capturados sus dos líderes con WhatsApp.</p>
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
              <div class="field">
                <label for="catalog-group-leader1-name">Líder 1</label>
                <input id="catalog-group-leader1-name" name="leader1Name" value="${escapeHtml(editingGroup?.leader1Name || "")}" placeholder="Nombre del líder principal">
              </div>
              <div class="field">
                <label for="catalog-group-leader1-phone">WhatsApp líder 1</label>
                <input id="catalog-group-leader1-phone" name="leader1Phone" value="${escapeHtml(editingGroup?.leader1Phone || "")}" placeholder="5215551234567">
              </div>
              <div class="field">
                <label for="catalog-group-leader2-name">Líder 2</label>
                <input id="catalog-group-leader2-name" name="leader2Name" value="${escapeHtml(editingGroup?.leader2Name || "")}" placeholder="Nombre del segundo líder">
              </div>
              <div class="field">
                <label for="catalog-group-leader2-phone">WhatsApp líder 2</label>
                <input id="catalog-group-leader2-phone" name="leader2Phone" value="${escapeHtml(editingGroup?.leader2Phone || "")}" placeholder="5215559876543">
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
                  <th>Liderazgo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                ${groups.length ? groups.map((group) => `
                  <tr>
                    <td>${escapeHtml(String(group.id))}</td>
                    <td>${escapeHtml(group.name)}</td>
                    <td>
                      <span class="row-title">${escapeHtml([group.leader1Name, group.leader2Name].filter(Boolean).join(" / ") || "Sin líderes")}</span>
                      <span class="row-meta">${escapeHtml([group.leader1Phone, group.leader2Phone].filter(Boolean).join(" / ") || "Sin teléfonos")}</span>
                    </td>
                    <td><button class="btn btn-secondary" data-action="edit-group-catalog" data-group-id="${escapeHtml(String(group.id))}">Editar</button></td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="4"><div class="empty-state">No hay grupos que coincidan con la busqueda.</div></td>
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

function renderDashboardViewLegacy_() {
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
  const seasonMatrix = state.dashboardSeasonMatrix;
  const sessionTotals = seasonMatrix?.sessionTotals || [];
  const topGroups = executive?.topGroups || groupsRanking.slice(0, 5);
  const selectedGroupId = state.filters.dashboard.groupId;
  const selectedGroupRow = groupsRanking.find((group) => String(group.groupId) === String(selectedGroupId)) || null;
  const selectedMatrixGroup = seasonMatrix?.groups?.find((group) => String(group.groupId) === String(selectedGroupId)) || null;
  const leaderSummary = buildDashboardLeaderSummary_(selectedMatrixGroup || selectedGroupRow, state.dashboardLeaderDetail);
  const selectedGroupMeta = leaderSummary || selectedMatrixGroup || selectedGroupRow || null;
  const trackedRecentCongregants = getDashboardRecentCongregantsTracking_();
  const recentInGroupCount = trackedRecentCongregants.filter((person) => person.inGroup).length;
  const recentPendingCount = trackedRecentCongregants.length - recentInGroupCount;
  const recentWithPhoneCount = trackedRecentCongregants.filter((person) => String(person.telefono || "").trim()).length;
  const mobileSeasonSessionsCount = focusSeason
    ? Number(focusSeason.sessionsCount || getSessions(focusSeason.id).length || 0)
    : Number(latestSeason?.sessionsCount || getSessions(latestSeason?.id || '').length || 0);
  const seasonStatsLabel = focusSeason
    ? `${focusSeason.name} | ${focusSeason.sessionsCount || 0} sesiones`
    : 'Selecciona una temporada para ver el resumen ejecutivo';
  const dashboardGroupSource = seasonMatrix?.groups?.length
    ? seasonMatrix.groups.map((group) => ({
      id: String(group.groupId),
      name: group.groupName
    }))
    : state.catalogs.groups;
  const dashboardGroupOptions = renderOptions(
    dashboardGroupSource.map((group) => ({
      value: String(group.id),
      label: `${group.name} (${group.id})`
    })),
    selectedGroupId,
    'Selecciona grupo'
  );
  const dashboardConsultShortcuts = [
    {
      label: "Consulta global",
      copy: "Asistencia por grupo y sesion",
      sectionId: "dashboard-season-matrix"
    },
    {
      label: "Abrir grupo",
      copy: selectedGroupMeta ? (selectedGroupMeta.groupName || "Grupo seleccionado") : "Selecciona un grupo",
      sectionId: "dashboard-consult-hub"
    },
    {
      label: "Detalle lista",
      copy: selectedGroupMeta ? "Ver asistentes y marcas por sesion" : "Sin grupo consultado",
      sectionId: "dashboard-group-detail"
    },
    {
      label: "Nuevos",
      copy: "Seguimiento reciente",
      sectionId: "dashboard-recent-people"
    }
  ];

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

      <div class="dashboard-mobile-shortcuts">
        ${dashboardConsultShortcuts.map((shortcut) => renderDashboardMobileShortcut_(shortcut)).join("")}
      </div>

      <article class="panel-card dashboard-toolbar-card module-section-anchor" id="dashboard-toolbar">
        <div class="panel-head">
          <div>
            <h2>Dashboard ejecutivo</h2>
            <p>Empieza por la consulta pastoral y luego interpreta los indicadores ejecutivos.</p>
          </div>
          <div class="dashboard-toolbar-actions">
            <button class="btn btn-secondary" data-action="refresh-dashboard-executive">Actualizar</button>
            <button class="btn btn-primary" data-action="export-dashboard-ranking" ${groupsRanking.length ? '' : 'disabled'}>Exportar ranking</button>
          </div>
        </div>

        <div class="field-grid dashboard-toolbar-season-grid">
          ${renderSeasonSelect('dashboard-season', state.filters.dashboard.seasonId)}
        </div>

        <div class="summary-strip">
          <span class="context-item"><strong>Temporada analizada:</strong> ${focusSeason ? escapeHtml(focusSeason.name) : 'Sin temporada'}</span>
          <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(seasonMatrix?.sessions?.length || focusSeason?.sessionsCount || 0))}</span>
          <span class="context-item"><strong>Asistencia global:</strong> ${seasonMatrix?.overall ? escapeHtml(`${seasonMatrix.overall.presentTotal}/${seasonMatrix.overall.capturedBaseTotal || 0}`) : 'Pendiente'}</span>
          <span class="context-item"><strong>Generado:</strong> ${escapeHtml(executive ? formatDateTime_(executive.generatedAt) : 'Cargando...')}</span>
        </div>
      </article>

      <article class="panel-card dashboard-consult-hub-card module-section-anchor" id="dashboard-consult-hub">
        <div class="panel-head">
          <div>
            <h2>Centro de consulta pastoral</h2>
            <p>Selecciona un grupo, revisa la asistencia global por sesion y entra al detalle por asistente sin salir del dashboard.</p>
          </div>
          ${selectedGroupMeta
            ? renderDashboardTrendPill_(selectedGroupMeta.trend || leaderSummary?.trend)
            : `<span class="pill dark">Sin grupo</span>`}
        </div>

        <div class="view-grid columns-2 dashboard-consult-hub-grid">
          <div class="dashboard-consult-hub-panel">
            <div class="field-grid dashboard-toolbar-season-grid">
              <div class="field">
                <label for="dashboard-group">Grupo de conexion</label>
                <select id="dashboard-group">
                  ${dashboardGroupOptions}
                </select>
                <span class="field-help">Puedes elegir el grupo aqui o tocarlo directamente dentro de la matriz por sesion.</span>
              </div>
            </div>

            <div class="actions-row dashboard-filter-actions">
              <button class="btn btn-primary" data-action="load-dashboard-group-query" ${state.filters.dashboard.groupId ? '' : 'disabled'}>Consultar grupo</button>
              <button class="btn btn-secondary" data-action="export-dashboard-group-detail" ${state.filters.dashboard.groupId ? '' : 'disabled'}>Exportar grupo</button>
              <button class="btn btn-ghost" data-action="clear-dashboard-group-query" ${state.filters.dashboard.groupId || state.dashboardLeaderDetail ? '' : 'disabled'}>Limpiar consulta</button>
            </div>

            <div class="dashboard-consult-tip">
              <strong>Flujo sugerido</strong>
              <span>1. Mira la asistencia global por sesion. 2. Toca un grupo. 3. Revisa tendencia y listado de asistentes.</span>
            </div>
          </div>

          <div class="dashboard-consult-hub-panel">
            ${selectedGroupMeta ? `
              <div class="summary-stack dashboard-summary-grid">
                <div class="summary-box">
                  <span class="status-chip neutral">Grupo</span>
                  <strong>${escapeHtml(selectedGroupMeta.groupName || "Sin grupo")}</strong>
                  <span>${escapeHtml(String(selectedGroupMeta.groupId || ""))}</span>
                </div>
                <div class="summary-box">
                  <span class="status-chip success">Asistencia</span>
                  <strong>${escapeHtml(String(selectedGroupMeta.attendanceRate || 0))}%</strong>
                  <span>${leaderSummary ? escapeHtml(`${leaderSummary.presentTotal || 0} presentes sobre ${leaderSummary.capturedBaseTotal || 0} capturas esperadas.`) : "Consulta el grupo para ver detalle."}</span>
                </div>
                <div class="summary-box">
                  <span class="status-chip neutral">Personas</span>
                  <strong>${escapeHtml(String(selectedGroupMeta.uniquePeople || 0))}</strong>
                  <span>${escapeHtml(String(selectedGroupMeta.participantAssignments || 0))} asignaciones acumuladas.</span>
                </div>
                <div class="summary-box">
                  <span class="status-chip dark">Captura</span>
                  <strong>${escapeHtml(String(selectedGroupMeta.capturedSessions || 0))}/${escapeHtml(String(selectedGroupMeta.totalSessions || 0))}</strong>
                  <span>${escapeHtml(String(selectedGroupMeta.captureProgress || 0))}% de sesiones capturadas.</span>
                </div>
              </div>
            ` : `
              <div class="empty-state">Selecciona un grupo o toca uno en la matriz para abrir su consulta completa.</div>
            `}
          </div>
        </div>
      </article>

      <article class="detail-card dashboard-season-matrix-card module-section-anchor" id="dashboard-season-matrix">
        <div class="panel-head">
          <div>
            <h2>Grupos por sesion</h2>
            <p>Consulta vital para Pastor: cada celda muestra la asistencia real del grupo por sesion y su base de participantes. Toca un grupo para abrir su detalle.</p>
          </div>
          <span class="pill dark">${escapeHtml(String(seasonMatrix?.groups?.length || 0))} grupos</span>
        </div>

        ${seasonMatrix ? `
          <div class="summary-strip">
            <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(seasonMatrix.seasonName || focusSeason?.name || "Sin temporada")}</span>
            <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(seasonMatrix.sessions.length || 0))}</span>
            <span class="context-item"><strong>Global temporada:</strong> ${escapeHtml(`${seasonMatrix.overall.presentTotal || 0}/${seasonMatrix.overall.capturedBaseTotal || 0}`)} (${escapeHtml(String(seasonMatrix.overall.attendanceRate || 0))}%)</span>
            <span class="context-item"><strong>Clave:</strong> Presentes / Base capturada</span>
          </div>

          <div class="dashboard-session-total-grid">
            ${sessionTotals.map((session) => `
              <article class="summary-box dashboard-session-total-card">
                <span class="status-chip ${session.groupsCaptured ? "success" : "warning"}">${escapeHtml(session.shortLabel || session.name)}</span>
                <strong>${session.capturedBaseTotal ? escapeHtml(`${session.presentTotal}/${session.capturedBaseTotal}`) : "Sin captura"}</strong>
                <span>${escapeHtml(String(session.attendanceRate || 0))}% asistencia | ${escapeHtml(String(session.groupsCaptured || 0))}/${escapeHtml(String(session.groupsConfigured || 0))} grupos</span>
                <small>${escapeHtml(formatDate(session.date))}</small>
              </article>
            `).join("")}
          </div>

          <div class="table-wrap season-matrix-wrap">
            <table class="season-matrix-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  ${seasonMatrix.sessions.map((session) => `
                    <th>${escapeHtml(session.shortLabel || session.name)}</th>
                  `).join("")}
                  <th>Total grupo</th>
                  <th>Tendencia</th>
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
                        <span class="row-meta">Grupo ${escapeHtml(String(group.groupId))} | ${escapeHtml(String(group.uniquePeople || 0))} personas</span>
                      </button>
                    </td>
                    ${group.sessions.map((cell) => `
                      <td>
                        <div class="season-matrix-cell ${cell.captured ? "captured" : "pending"}">
                          <strong>${cell.captured ? escapeHtml(`${cell.present || 0}/${cell.total || 0}`) : escapeHtml(cell.total ? `-/${cell.total}` : "0")}</strong>
                          <span>${cell.captured ? escapeHtml(`${cell.rate || 0}% asistencia`) : (cell.total ? "Sin captura" : "Sin base")}</span>
                          <small>${escapeHtml(`${cell.volunteers || 0} V + ${cell.congregants || 0} C`)}</small>
                        </div>
                      </td>
                    `).join("")}
                    <td>
                      <div class="season-matrix-total-card">
                        <strong>${group.capturedBaseTotal ? escapeHtml(`${group.presentTotal || 0}/${group.capturedBaseTotal || 0}`) : "Sin captura"}</strong>
                        <span>${escapeHtml(String(group.attendanceRate || 0))}% | ${escapeHtml(String(group.capturedSessions || 0))}/${escapeHtml(String(group.totalSessions || 0))} sesiones</span>
                      </div>
                    </td>
                    <td>
                      <div class="season-matrix-trend-card">
                        ${renderDashboardTrendPill_(group.trend)}
                        <span>${escapeHtml(group.trend?.summary || "Sin tendencia disponible.")}</span>
                      </div>
                    </td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="${Math.max((seasonMatrix.sessions.length || 0) + 3, 4)}">
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

      <div class="view-grid columns-2 dashboard-leader-grid module-section-anchor" id="dashboard-group-analysis">
        <article class="panel-card dashboard-group-summary-card">
          <div class="panel-head">
            <div>
              <h2>Resumen del grupo consultado</h2>
              <p>Lectura ejecutiva para identificar cobertura, constancia y seguimiento del grupo seleccionado.</p>
            </div>
            ${leaderSummary ? renderDashboardTrendPill_(leaderSummary.trend) : `<span class="pill dark">Sin grupo</span>`}
          </div>

          ${selectedGroupMeta ? `
            <div class="summary-stack dashboard-summary-grid">
              <div class="summary-box">
                <span class="status-chip neutral">Grupo</span>
                <strong>${escapeHtml(selectedGroupMeta.groupName || "Sin grupo")}</strong>
                <span>${escapeHtml(String(selectedGroupMeta.groupId || ""))}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Asistencia acumulada</span>
                <strong>${escapeHtml(`${leaderSummary?.presentTotal ?? selectedGroupMeta.presentTotal ?? 0}/${leaderSummary?.capturedBaseTotal ?? selectedGroupMeta.capturedBaseTotal ?? 0}`)}</strong>
                <span>${escapeHtml(String(leaderSummary?.attendanceRate ?? selectedGroupMeta.attendanceRate ?? 0))}% de asistencia real acumulada.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Cobertura</span>
                <strong>${escapeHtml(`${leaderSummary?.capturedSessions ?? selectedGroupMeta.capturedSessions ?? 0}/${leaderSummary?.totalSessions ?? selectedGroupMeta.totalSessions ?? 0}`)}</strong>
                <span>${escapeHtml(String(leaderSummary?.captureProgress ?? selectedGroupMeta.captureProgress ?? 0))}% de sesiones del grupo ya cuentan con captura.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Personas</span>
                <strong>${escapeHtml(String(leaderSummary?.uniquePeople ?? selectedGroupMeta.uniquePeople ?? 0))}</strong>
                <span>${escapeHtml(String(leaderSummary?.participantAssignments ?? selectedGroupMeta.participantAssignments ?? 0))} asignaciones acumuladas dentro de la temporada.</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Mejor sesion</span>
                <strong>${leaderSummary?.bestSession ? escapeHtml(leaderSummary.bestSession.shortLabel || leaderSummary.bestSession.name) : "Sin dato"}</strong>
                <span>${leaderSummary?.bestSession ? escapeHtml(`${leaderSummary.bestSession.present || 0}/${leaderSummary.bestSession.total || 0} (${leaderSummary.bestSession.rate || 0}%)`) : "Aun no hay sesiones capturadas para comparar."}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Seguimiento clave</span>
                <strong>${leaderSummary?.topPeople?.length ? escapeHtml(leaderSummary.topPeople[0].name) : "Sin dato"}</strong>
                <span>${leaderSummary?.topPeople?.length ? escapeHtml(`${leaderSummary.topPeople[0].totalPresent || 0} asistencias SI registradas.`) : "Cuando consultes el grupo veras aqui a la persona mas constante."}</span>
              </div>
            </div>

            <div class="actions-row dashboard-filter-actions">
              <button class="btn btn-secondary" data-action="export-dashboard-group-detail" ${state.filters.dashboard.groupId ? '' : 'disabled'}>Exportar grupo</button>
              <button class="btn btn-ghost" data-action="clear-dashboard-group-query" ${state.filters.dashboard.groupId || state.dashboardLeaderDetail ? '' : 'disabled'}>Limpiar consulta</button>
            </div>
          ` : `
            <div class="empty-state">Selecciona un grupo desde la consulta superior o tocando una fila dentro de la matriz para abrir su resumen ejecutivo.</div>
          `}
        </article>

        <article class="panel-card dashboard-leader-roster-card">
          <div class="panel-head">
            <div>
              <h2>Tendencia del grupo</h2>
              <p>Observa sesion por sesion si el grupo aumento o disminuyo su asistencia.</p>
            </div>
          </div>

          ${leaderSummary ? `
            ${renderDashboardTrendChart_(leaderSummary)}

            <div class="summary-stack dashboard-summary-grid dashboard-group-trend-summary">
              <div class="summary-box">
                <span class="status-chip neutral">Mejor sesion</span>
                <strong>${leaderSummary.bestSession ? escapeHtml(leaderSummary.bestSession.shortLabel || leaderSummary.bestSession.name) : "Sin dato"}</strong>
                <span>${leaderSummary.bestSession ? escapeHtml(`${leaderSummary.bestSession.present || 0}/${leaderSummary.bestSession.total || 0} (${leaderSummary.bestSession.rate || 0}%)`) : "Todavia no hay sesiones capturadas."}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Ultima sesion capturada</span>
                <strong>${leaderSummary.latestSession ? escapeHtml(leaderSummary.latestSession.shortLabel || leaderSummary.latestSession.name) : "Sin dato"}</strong>
                <span>${leaderSummary.latestSession ? escapeHtml(`${leaderSummary.latestSession.present || 0}/${leaderSummary.latestSession.total || 0} (${leaderSummary.latestSession.rate || 0}%)`) : "Sin captura reciente."}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Tendencia</span>
                <strong>${escapeHtml(leaderSummary.trend?.label || "Sin tendencia")}</strong>
                <span>${escapeHtml(leaderSummary.trend?.summary || "Sin sesiones suficientes para evaluar comportamiento.")}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Top constancia</span>
                <strong>${leaderSummary.topPeople.length ? escapeHtml(leaderSummary.topPeople[0].name) : "Sin dato"}</strong>
                <span>${leaderSummary.topPeople.length ? escapeHtml(`${leaderSummary.topPeople[0].totalPresent || 0} asistencias SI`) : "Aun no hay historial suficiente."}</span>
              </div>
            </div>
          ` : `
            <div class="empty-state">Cuando consultes un grupo veras su grafica de tendencia y el comportamiento de asistencia por sesion.</div>
          `}
        </article>
      </div>

      <article class="detail-card dashboard-group-detail-card module-section-anchor" id="dashboard-group-detail">
        <div class="panel-head">
          <div>
            <h2>Detalle de asistentes por grupo</h2>
            <p>Paloma verde si asistio, cruz roja si no asistio y guion si la sesion aun no tiene captura para esa persona.</p>
          </div>
          ${leaderSummary ? renderDashboardTrendPill_(leaderSummary.trend) : `<span class="pill dark">Sin grupo</span>`}
        </div>

        ${leaderSummary ? `
          <div class="table-wrap dashboard-group-roster-wrap">
            <table class="dashboard-group-roster-table">
              <thead>
                <tr>
                  <th>Asistente</th>
                  <th>Tipo</th>
                  <th>Total</th>
                  ${leaderSummary.sessions.map((session) => `
                    <th>${escapeHtml(session.shortLabel || session.name)}</th>
                  `).join("")}
                </tr>
              </thead>
              <tbody>
                ${leaderSummary.people.length ? leaderSummary.people.map((person) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(person.name)}</span>
                      <span class="row-meta">${escapeHtml(person.personId)}</span>
                    </td>
                    <td>${renderPersonTypePill_(person.type || "")}</td>
                    <td>
                      <div class="dashboard-person-total">
                        <strong>${escapeHtml(`${person.totalPresent || 0}/${person.totalAssignedSessions || leaderSummary.totalSessions || 0}`)}</strong>
                        <span>${escapeHtml(String(person.attendanceRate || 0))}%</span>
                      </div>
                    </td>
                    ${leaderSummary.sessions.map((session) => `
                      <td>
                        <div class="dashboard-attendance-cell">
                          ${renderDashboardAttendanceMark_(person.attendances?.[session.sessionId] || person.attendances?.[session.id] || "")}
                        </div>
                      </td>
                    `).join("")}
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="${Math.max((leaderSummary.sessions.length || 0) + 3, 4)}">
                      <div class="empty-state">Este grupo todavia no tiene personas suficientes para construir el detalle.</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">Selecciona un grupo desde la matriz o desde la consulta para ver el listado detallado de asistentes y su comportamiento por sesion.</div>
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

      <div class="view-grid columns-2">
        <article class="detail-card dashboard-recent-people-card">
          <div class="panel-head">
            <div>
              <h2>Nuevos congregantes</h2>
              <p>Consulta pastoral independiente para revisar crecimiento reciente y seguimiento en grupos de conexion.</p>
            </div>
            <span class="pill ${trackedRecentCongregants.length ? "success" : "warning"}">${escapeHtml(String(trackedRecentCongregants.length))} en periodo</span>
          </div>

          <div class="field-grid two">
            <div class="field">
              <label for="dashboard-recent-from">Desde</label>
              <input id="dashboard-recent-from" type="date" value="${escapeHtml(state.filters.dashboard.recentFrom)}">
            </div>
            <div class="field">
              <label for="dashboard-recent-to">Hasta</label>
              <input id="dashboard-recent-to" type="date" value="${escapeHtml(state.filters.dashboard.recentTo)}">
            </div>
          </div>

          <div class="actions-row dashboard-filter-actions">
            <button class="btn btn-secondary" data-action="set-dashboard-period" data-days="30">Ultimo mes</button>
            <button class="btn btn-ghost" data-action="set-dashboard-period" data-days="90">Ultimos 3 meses</button>
            <button class="btn btn-secondary" data-action="navigate" data-view="congregants-new">Abrir consulta completa</button>
          </div>

          <div class="summary-stack dashboard-summary-grid">
            <div class="summary-box">
              <span class="status-chip neutral">Periodo</span>
              <strong>${escapeHtml(formatDate(state.filters.dashboard.recentFrom) || state.filters.dashboard.recentFrom || "-")}</strong>
              <span>Hasta ${escapeHtml(formatDate(state.filters.dashboard.recentTo) || state.filters.dashboard.recentTo || "-")}</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Ya en grupo</span>
              <strong>${escapeHtml(String(recentInGroupCount))}</strong>
              <span>Congregantes recientes que ya forman parte de un grupo de conexion.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip warning">Pendientes</span>
              <strong>${escapeHtml(String(recentPendingCount))}</strong>
              <span>Personas recientes que aun no muestran grupo asignado.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Con telefono</span>
              <strong>${escapeHtml(String(recentWithPhoneCount))}</strong>
              <span>Listos para contacto o bienvenida.</span>
            </div>
          </div>

          <div class="results-list dashboard-recent-people-list">
            ${trackedRecentCongregants.length ? trackedRecentCongregants.slice(0, 8).map((person) => `
              <article class="result-card">
                <div class="result-row">
                  <div class="result-copy-stack">
                    <span class="row-title">${escapeHtml(person.nombreCompleto || person.nombre || "Sin nombre")}</span>
                    <span class="row-meta">${escapeHtml(person.telefono || "Sin telefono")} | ${escapeHtml(person.estadoCivil || "Sin estado civil")}</span>
                    <span class="row-meta">Nacimiento: ${escapeHtml(formatDate(person.fechaNacimiento) || "Sin fecha")} | Alta: ${escapeHtml(formatDate(person.fechaIngreso) || "Sin fecha")}</span>
                    <span class="row-meta">${escapeHtml(person.followUpLabel)}</span>
                  </div>
                  <div class="result-copy-stack dashboard-recent-person-status">
                    <span class="pill ${person.inGroup ? "success" : "warning"}">${person.inGroup ? "En grupo" : "Pendiente"}</span>
                    <span class="pill dark">${escapeHtml(String(person.edad || "S/D"))}</span>
                  </div>
                </div>
              </article>
            `).join("") : `
              <div class="empty-state">No hay congregantes nuevos en el rango seleccionado.</div>
            `}
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
  if (!groupAggregate && !detail) {
    return null;
  }

  const sessions = Array.isArray(detail?.sessions)
    ? detail.sessions
    : (Array.isArray(groupAggregate?.sessions) ? groupAggregate.sessions : []);
  const summaryBase = detail?.summary || groupAggregate || {};
  const totalSessions = Number(detail?.totalSessions || groupAggregate?.totalSessions || sessions.length || 0);
  const sourcePeople = Array.isArray(detail?.people)
    ? detail.people
    : (Array.isArray(groupAggregate?.people) ? groupAggregate.people : []);
  const topPeople = sourcePeople.length
    ? [...sourcePeople]
      .sort((left, right) => {
        if (right.totalPresent !== left.totalPresent) {
          return right.totalPresent - left.totalPresent;
        }

        if (right.attendanceRate !== left.attendanceRate) {
          return right.attendanceRate - left.attendanceRate;
        }

        return normalizeText(left.name).localeCompare(normalizeText(right.name), "es");
      })
      .slice(0, 8)
    : [];
  const capturedSessions = sessions.filter((session) => session.captured);
  const bestSession = capturedSessions.length
    ? [...capturedSessions].sort((left, right) => {
      if (right.rate !== left.rate) {
        return right.rate - left.rate;
      }

      return Number(right.present || 0) - Number(left.present || 0);
    })[0]
    : null;
  const latestSession = capturedSessions.length ? capturedSessions[capturedSessions.length - 1] : null;

  return {
    groupId: detail?.groupId || groupAggregate?.groupId || "",
    groupName: detail?.groupName || groupAggregate?.groupName || resolveGroupName_(detail?.groupId || groupAggregate?.groupId || ""),
    totalSessions,
    sessions,
    uniquePeople: Number(summaryBase.uniquePeople || detail?.people?.length || 0),
    participantAssignments: Number(summaryBase.participantAssignments || groupAggregate?.participantAssignments || 0),
    presentTotal: Number(summaryBase.presentTotal || groupAggregate?.presentTotal || 0),
    capturedBaseTotal: Number(summaryBase.capturedBaseTotal || groupAggregate?.capturedBaseTotal || 0),
    absentTotal: Number(summaryBase.absentTotal || groupAggregate?.absentTotal || 0),
    attendanceRate: Number(summaryBase.attendanceRate || groupAggregate?.attendanceRate || 0),
    capturedSessions: Number(summaryBase.capturedSessions || groupAggregate?.capturedSessions || capturedSessions.length || 0),
    captureProgress: Number(summaryBase.captureProgress || groupAggregate?.captureProgress || 0),
    trend: summaryBase.trend || groupAggregate?.trend || buildDashboardTrendMeta_(sessions),
    bestSession,
    latestSession,
    people: sourcePeople,
    topPeople
  };
}

function getDashboardSelectedGroupRow_() {
  const groupsRanking = state.dashboardExecutive?.groupsRanking || [];
  const selectedGroupId = state.filters.dashboard.groupId;
  return groupsRanking.find((group) => String(group.groupId) === String(selectedGroupId)) || null;
}

function renderDashboardTrendPill_(trend) {
  const normalizedDirection = String(trend?.direction || "pending");
  const variant = normalizedDirection === "up"
    ? "success"
    : (normalizedDirection === "down" ? "warning" : "dark");

  return `<span class="pill ${variant}">${escapeHtml(trend?.label || "Sin tendencia")}</span>`;
}

function renderDashboardAttendanceMark_(status) {
  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "SI") {
    return `
      <span class="dashboard-attendance-mark dashboard-attendance-mark-yes" title="Asistio" aria-label="Asistio">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M4.5 10.5 8 14l7.5-8"></path>
        </svg>
      </span>
    `;
  }

  if (normalizedStatus === "NO") {
    return `
      <span class="dashboard-attendance-mark dashboard-attendance-mark-no" title="No asistio" aria-label="No asistio">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="m5 5 10 10"></path>
          <path d="m15 5-10 10"></path>
        </svg>
      </span>
    `;
  }

  return `<span class="dashboard-attendance-mark dashboard-attendance-mark-pending" title="Sin captura" aria-label="Sin captura">-</span>`;
}

function renderDashboardTrendChart_(summary, options = {}) {
  const sessions = Array.isArray(summary?.sessions) ? summary.sessions : [];
  const compact = Boolean(options.compact);
  const chartClassName = compact ? "dashboard-trend-chart compact" : "dashboard-trend-chart";
  const maxBarHeight = compact ? 100 : 132;
  const minCapturedHeight = compact ? 12 : 8;
  const pendingHeight = compact ? 8 : 10;
  const ariaLabel = options.ariaLabel || "Grafica de tendencia de asistencia por sesion";
  const accessibilityAttributes = compact
    ? `aria-label="${escapeHtml(ariaLabel)}"`
    : `role="img" aria-label="${escapeHtml(ariaLabel)}"`;
  const groupId = String(options.groupId || summary?.groupId || "");
  const activeSessionId = String(options.activeSessionId || "");

  if (!sessions.length) {
    return `<div class="empty-state">Aun no hay sesiones para construir la grafica.</div>`;
  }

  return `
    <div class="${chartClassName}" ${accessibilityAttributes}>
      ${sessions.map((session) => {
        const sessionId = String(session.sessionId || session.id || "");
        const height = session.captured
          ? Math.max(Math.round((Number(session.rate || 0) / 100) * maxBarHeight), minCapturedHeight)
          : pendingHeight;
        const totalLabel = Number(session.total || 0) > 0
          ? escapeHtml(String(session.total || 0))
          : "-";
        const presentLabel = session.captured
          ? escapeHtml(String(session.present || 0))
          : "-";
        const isFocused = activeSessionId && activeSessionId === sessionId;

        if (compact) {
          return `
            <div class="dashboard-trend-slot ${isFocused ? "is-focused" : ""}">
              <span class="dashboard-trend-rate">${session.captured ? `${escapeHtml(String(session.rate || 0))}%` : "S/C"}</span>
              <button
                class="dashboard-trend-bar-rail dashboard-trend-bar-rail-button ${isFocused ? "is-focused" : ""}"
                type="button"
                data-action="open-dashboard-group-session-detail"
                data-group-id="${escapeHtml(groupId)}"
                data-session-id="${escapeHtml(sessionId)}"
                aria-label="${escapeHtml(`Abrir detalle de ${summary?.groupName || "grupo"} en ${session.shortLabel || session.name || "sesion"}`)}"
              >
                <span class="dashboard-trend-bar-count">${presentLabel}</span>
                <div
                  class="dashboard-trend-bar ${session.captured ? "captured" : "pending"}"
                  style="height: ${height}px;"
                ></div>
              </button>
              <span class="dashboard-trend-label">${escapeHtml(session.shortLabel || session.name || "Sesion")}</span>
              <small class="dashboard-trend-base">${totalLabel}</small>
            </div>
          `;
        }

        return `
          <div class="dashboard-trend-slot ${isFocused ? "is-focused" : ""}">
            <span class="dashboard-trend-rate">${session.captured ? `${escapeHtml(String(session.rate || 0))}%` : "S/C"}</span>
            <div class="dashboard-trend-bar-rail ${isFocused ? "is-focused" : ""}">
              <div
                class="dashboard-trend-bar ${session.captured ? "captured" : "pending"}"
                style="height: ${height}px;"
              ></div>
            </div>
            <span class="dashboard-trend-label">${escapeHtml(session.shortLabel || session.name || "Sesion")}</span>
            <small>${session.captured ? escapeHtml(`${session.present || 0}/${session.total || 0}`) : "Sin captura"}</small>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDashboardExecutiveGroupCard_(summary, selectedGroupId, activeSessionId) {
  const isSelected = String(summary?.groupId || "") === String(selectedGroupId || "");
  const peopleLabel = String(summary?.uniquePeople || 0);
  const focusedSessionId = isSelected ? String(activeSessionId || "") : "";

  return `
    <article class="dashboard-group-visual-card ${isSelected ? "is-selected" : ""}">
      <div class="dashboard-group-visual-head">
        <div class="dashboard-group-visual-copy">
          <h3 class="dashboard-group-visual-name">${escapeHtml(summary?.groupName || "Grupo")}</h3>
          <p class="dashboard-group-visual-count">
            <strong>${escapeHtml(peopleLabel)}</strong>
            <span>personas registradas</span>
          </p>
        </div>
      </div>

      ${renderDashboardTrendChart_(summary, {
        compact: true,
        ariaLabel: `Tendencia de asistencia del grupo ${summary?.groupName || "Grupo"}`,
        groupId: summary?.groupId || "",
        activeSessionId: focusedSessionId
      })}

      <button
        class="btn btn-secondary dashboard-group-visual-button"
        data-action="open-dashboard-session-group"
        data-group-id="${escapeHtml(String(summary?.groupId || ""))}"
        type="button"
      >
        Ver detalle
      </button>
    </article>
  `;
}

function renderDashboardExecutiveGroupBoard_(groups, selectedGroupId, activeSessionId) {
  const summaries = Array.isArray(groups)
    ? groups.map((group) => buildDashboardLeaderSummary_(group)).filter(Boolean)
    : [];

  if (!summaries.length) {
    return `<div class="empty-state">Aun no hay grupos con participantes para mostrar el panorama ejecutivo.</div>`;
  }

  return `
    <div class="dashboard-group-visual-grid">
      ${summaries.map((summary) => renderDashboardExecutiveGroupCard_(summary, selectedGroupId, activeSessionId)).join("")}
    </div>
  `;
}

function buildDashboardSeasonMatrix_({ seasonId, seasonName, sessions, sessionGroupsBySession, participants, attendances }) {
  const normalizedSessions = (sessions || []).map((session) => ({
    id: String(session.id || ""),
    name: session.name || String(session.id || ""),
    shortLabel: session.number ? `S${session.number}` : (session.name || String(session.id || "")),
    number: Number(session.number || 0),
    date: session.date || "",
    status: session.status || ""
  }));
  const sessionLookup = new Map();
  const sessionTotalsMap = new Map();
  const groupMap = new Map();

  const ensureGroup = (groupId, fallbackName) => {
    const normalizedGroupId = String(groupId || "");

    if (!groupMap.has(normalizedGroupId)) {
      groupMap.set(normalizedGroupId, {
        groupId: normalizedGroupId,
        groupName: fallbackName || resolveGroupName_(normalizedGroupId) || `Grupo ${normalizedGroupId}`,
        cells: {},
        peopleMap: new Map()
      });
    }

    return groupMap.get(normalizedGroupId);
  };

  const ensureCell = (group, sessionId) => {
    const normalizedSessionId = String(sessionId || "");

    if (!group.cells[normalizedSessionId]) {
      group.cells[normalizedSessionId] = {
        total: 0,
        volunteers: 0,
        congregants: 0,
        present: 0,
        recorded: 0,
        captured: false
      };
    }

    return group.cells[normalizedSessionId];
  };

  const ensurePerson = (group, personId, fallbackName, fallbackType) => {
    const normalizedPersonId = String(personId || "");

    if (!group.peopleMap.has(normalizedPersonId)) {
      group.peopleMap.set(normalizedPersonId, {
        personId: normalizedPersonId,
        name: fallbackName || normalizedPersonId,
        type: fallbackType || "",
        assignedSessions: {},
        attendances: {}
      });
    }

    const person = group.peopleMap.get(normalizedPersonId);

    if (fallbackName && (!person.name || person.name === person.personId)) {
      person.name = fallbackName;
    }

    if (fallbackType && !person.type) {
      person.type = fallbackType;
    }

    return person;
  };

  normalizedSessions.forEach((session) => {
    sessionLookup.set(session.id, session);
    sessionTotalsMap.set(session.id, {
      sessionId: session.id,
      name: session.name,
      shortLabel: session.shortLabel,
      date: session.date,
      status: session.status,
      assignedTotal: 0,
      assignedVolunteers: 0,
      assignedCongregants: 0,
      presentTotal: 0,
      absentTotal: 0,
      capturedBaseTotal: 0,
      groupsConfigured: 0,
      groupsWithPeopleSet: new Set(),
      groupsCapturedSet: new Set()
    });

    (sessionGroupsBySession[String(session.id)] || []).forEach((group) => {
      const groupId = String(group.groupId || "");
      ensureGroup(groupId, group.groupName);
      sessionTotalsMap.get(session.id).groupsConfigured += 1;
    });
  });

  (participants || []).forEach((participant) => {
    const sessionId = String(participant.sessionId || "");
    const groupId = String(participant.groupId || "");
    const personId = String(participant.personId || "");
    const sessionTotal = sessionTotalsMap.get(sessionId);
    const typeKey = getPersonTypeKey_(participant.type || "");
    let group;
    let cell;
    let person;

    if (!sessionLookup.has(sessionId) || !groupId || !personId) {
      return;
    }

    group = ensureGroup(groupId, resolveGroupName_(groupId));
    cell = ensureCell(group, sessionId);
    person = ensurePerson(group, personId, participant.name || personId, participant.type || "");

    cell.total += 1;
    sessionTotal.assignedTotal += 1;
    person.assignedSessions[sessionId] = true;

    if (typeKey === "congregante") {
      cell.congregants += 1;
      sessionTotal.assignedCongregants += 1;
    } else {
      cell.volunteers += 1;
      sessionTotal.assignedVolunteers += 1;
    }
  });

  (attendances || []).forEach((attendance) => {
    const sessionId = String(attendance.sessionId || "");
    const groupId = String(attendance.groupId || "");
    const personId = String(attendance.personId || "");
    const attended = String(attendance.attended || "").toUpperCase();
    const sessionTotal = sessionTotalsMap.get(sessionId);
    let group;
    let cell;
    let person;

    if (!sessionLookup.has(sessionId) || !groupId || !personId) {
      return;
    }

    group = ensureGroup(groupId, resolveGroupName_(groupId));
    cell = ensureCell(group, sessionId);
    person = ensurePerson(group, personId, attendance.name || personId, "");

    cell.recorded += 1;
    cell.captured = true;
    person.attendances[sessionId] = attended === "SI" ? "SI" : "NO";
    sessionTotal.groupsCapturedSet.add(groupId);

    if (attended === "SI") {
      cell.present += 1;
      sessionTotal.presentTotal += 1;
    }
  });

  const groups = Array.from(groupMap.values())
    .map((group) => {
      let presentTotal = 0;
      let capturedBaseTotal = 0;
      let capturedSessions = 0;
      let participantAssignments = 0;
      const sessionRows = normalizedSessions.map((session) => {
        const rawCell = group.cells[session.id] || {
          total: 0,
          volunteers: 0,
          congregants: 0,
          present: 0,
          recorded: 0,
          captured: false
        };
        const captured = Boolean(rawCell.captured || rawCell.recorded > 0);
        const absent = captured ? Math.max(rawCell.total - rawCell.present, 0) : 0;
        const rate = captured && rawCell.total ? Math.round((rawCell.present / rawCell.total) * 100) : 0;
        const sessionTotal = sessionTotalsMap.get(session.id);

        participantAssignments += rawCell.total;

        if (rawCell.total > 0 && sessionTotal) {
          sessionTotal.groupsWithPeopleSet.add(group.groupId);
        }

        if (captured) {
          presentTotal += rawCell.present;
          capturedBaseTotal += rawCell.total;
          capturedSessions += 1;

          if (sessionTotal) {
            sessionTotal.capturedBaseTotal += rawCell.total;
            sessionTotal.absentTotal += absent;
          }
        }

        return {
          sessionId: session.id,
          name: session.name,
          shortLabel: session.shortLabel,
          date: session.date,
          status: session.status,
          total: rawCell.total,
          volunteers: rawCell.volunteers,
          congregants: rawCell.congregants,
          present: rawCell.present,
          absent,
          recorded: rawCell.recorded,
          captured,
          rate
        };
      });
      const trend = buildDashboardTrendMeta_(sessionRows);
      const people = Array.from(group.peopleMap.values())
        .map((person) => {
          let totalPresent = 0;
          let totalAssignedSessions = 0;
          const attendancesBySession = {};

          normalizedSessions.forEach((session) => {
            const assigned = Boolean(person.assignedSessions[session.id]);
            const cell = group.cells[session.id] || null;
            const captured = Boolean(cell && (cell.captured || cell.recorded > 0));
            let status = "";

            if (assigned) {
              totalAssignedSessions += 1;

              if (person.attendances[session.id] === "SI") {
                status = "SI";
                totalPresent += 1;
              } else if (person.attendances[session.id] === "NO") {
                status = "NO";
              } else if (captured) {
                status = "NO";
              }
            }

            attendancesBySession[session.id] = status;
          });

          return {
            personId: person.personId,
            name: person.name || person.personId,
            type: person.type || "",
            totalPresent,
            totalAssignedSessions,
            attendanceRate: totalAssignedSessions ? Math.round((totalPresent / totalAssignedSessions) * 100) : 0,
            attendances: attendancesBySession
          };
        })
        .sort((left, right) => {
          if (right.totalPresent !== left.totalPresent) {
            return right.totalPresent - left.totalPresent;
          }

          if (right.attendanceRate !== left.attendanceRate) {
            return right.attendanceRate - left.attendanceRate;
          }

          return normalizeText(left.name).localeCompare(normalizeText(right.name), "es");
        });

      return {
        groupId: group.groupId,
        groupName: group.groupName,
        uniquePeople: people.length,
        participantAssignments,
        presentTotal,
        capturedBaseTotal,
        absentTotal: Math.max(capturedBaseTotal - presentTotal, 0),
        attendanceRate: capturedBaseTotal ? Math.round((presentTotal / capturedBaseTotal) * 100) : 0,
        capturedSessions,
        totalSessions: normalizedSessions.length,
        captureProgress: normalizedSessions.length ? Math.round((capturedSessions / normalizedSessions.length) * 100) : 0,
        trend,
        sessions: sessionRows,
        people
      };
    })
    .sort((left, right) => normalizeText(left.groupName).localeCompare(normalizeText(right.groupName), "es"));

  const sessionTotals = normalizedSessions.map((session) => {
    const total = sessionTotalsMap.get(session.id);
    const groupsCaptured = total ? total.groupsCapturedSet.size : 0;
    const groupsWithPeople = total ? total.groupsWithPeopleSet.size : 0;

    return {
      sessionId: session.id,
      name: session.name,
      shortLabel: session.shortLabel,
      number: session.number,
      date: session.date,
      status: session.status,
      assignedTotal: total ? total.assignedTotal : 0,
      assignedVolunteers: total ? total.assignedVolunteers : 0,
      assignedCongregants: total ? total.assignedCongregants : 0,
      presentTotal: total ? total.presentTotal : 0,
      absentTotal: total ? total.absentTotal : 0,
      capturedBaseTotal: total ? total.capturedBaseTotal : 0,
      groupsConfigured: total ? total.groupsConfigured : 0,
      groupsWithPeople,
      groupsCaptured,
      attendanceRate: total && total.capturedBaseTotal ? Math.round((total.presentTotal / total.capturedBaseTotal) * 100) : 0,
      captureCoverage: total && total.groupsConfigured ? Math.round((groupsCaptured / total.groupsConfigured) * 100) : 0
    };
  });
  const overall = {
    presentTotal: groups.reduce((sum, group) => sum + Number(group.presentTotal || 0), 0),
    capturedBaseTotal: groups.reduce((sum, group) => sum + Number(group.capturedBaseTotal || 0), 0),
    uniquePeople: groups.reduce((sum, group) => sum + Number(group.uniquePeople || 0), 0),
    groups: groups.length,
    sessions: normalizedSessions.length
  };
  const groupDetailsById = {};

  groups.forEach((group) => {
    groupDetailsById[String(group.groupId)] = {
      seasonId: String(seasonId || ""),
      groupId: String(group.groupId || ""),
      groupName: group.groupName,
      totalSessions: group.totalSessions,
      sessions: group.sessions,
      summary: {
        uniquePeople: group.uniquePeople,
        participantAssignments: group.participantAssignments,
        presentTotal: group.presentTotal,
        capturedBaseTotal: group.capturedBaseTotal,
        absentTotal: group.absentTotal,
        attendanceRate: group.attendanceRate,
        capturedSessions: group.capturedSessions,
        captureProgress: group.captureProgress,
        trend: group.trend
      },
      people: group.people
    };
  });

  overall.attendanceRate = overall.capturedBaseTotal
    ? Math.round((overall.presentTotal / overall.capturedBaseTotal) * 100)
    : 0;

  return {
    key: String(seasonId || ""),
    seasonId: String(seasonId || ""),
    seasonName: seasonName || resolveSeasonName_(seasonId) || "",
    sessions: normalizedSessions,
    sessionTotals,
    overall,
    groups,
    groupDetailsById
  };
}

function buildDashboardTrendMeta_(sessions) {
  const capturedSessions = (sessions || []).filter((session) => session && session.captured && Number.isFinite(Number(session.rate)));

  if (!capturedSessions.length) {
    return {
      direction: "pending",
      label: "Sin captura",
      summary: "Aun no hay sesiones capturadas para medir tendencia.",
      delta: 0
    };
  }

  if (capturedSessions.length === 1) {
    return {
      direction: "new",
      label: "Primer dato",
      summary: `${capturedSessions[0].shortLabel || capturedSessions[0].name}: ${capturedSessions[0].rate}%`,
      delta: 0
    };
  }

  const first = capturedSessions[0];
  const last = capturedSessions[capturedSessions.length - 1];
  const delta = Number(last.rate || 0) - Number(first.rate || 0);

  if (delta >= 5) {
    return {
      direction: "up",
      label: "Aumento",
      summary: `Subio ${delta} pts entre ${first.shortLabel || first.name} y ${last.shortLabel || last.name}.`,
      delta
    };
  }

  if (delta <= -5) {
    return {
      direction: "down",
      label: "Disminuyo",
      summary: `Bajo ${Math.abs(delta)} pts entre ${first.shortLabel || first.name} y ${last.shortLabel || last.name}.`,
      delta
    };
  }

  return {
    direction: "stable",
    label: "Estable",
    summary: `Se mantiene entre ${first.shortLabel || first.name} y ${last.shortLabel || last.name}.`,
    delta
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

function getDashboardRecentCongregantsTracking_() {
  return getRecentCongregants_("dashboard").map((person) => {
    const livePerson = state.people.find((item) => String(item.id || "") === String(person.id || "")) || null;
    const rawGroupValue = String(livePerson?.groupId || person.grupo || "").trim();
    const resolvedGroupName = resolveGroupName_(rawGroupValue) || rawGroupValue;
    const inGroup = Boolean(resolvedGroupName);

    return {
      ...person,
      inGroup,
      groupName: resolvedGroupName || "",
      followUpLabel: inGroup
        ? `Grupo de conexion: ${resolvedGroupName}`
        : "Sin grupo de conexion asignado todavia"
    };
  });
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
  const seasonMatrix = state.dashboardSeasonMatrix;
  const sessionTotals = seasonMatrix?.sessionTotals || [];
  const selectedGroupId = String(state.filters.dashboard.groupId || "");
  const selectedSessionId = String(state.filters.dashboard.sessionId || "");
  const selectedGroupRow = getDashboardSelectedGroupRow_();
  const selectedMatrixGroup = seasonMatrix?.groups?.find((group) => String(group.groupId) === selectedGroupId) || null;
  const groupVisualSummaries = seasonMatrix?.groups?.length
    ? seasonMatrix.groups.map((group) => buildDashboardLeaderSummary_(group)).filter(Boolean)
    : [];
  const selectedDetail = state.dashboardLeaderDetail && String(state.dashboardLeaderDetail.groupId || "") === selectedGroupId
    ? state.dashboardLeaderDetail
    : null;
  const leaderSummary = buildDashboardLeaderSummary_(selectedMatrixGroup || selectedGroupRow, selectedDetail);
  const selectedGroupMeta = leaderSummary || selectedMatrixGroup || selectedGroupRow || null;
  const overall = seasonMatrix?.overall || {
    presentTotal: 0,
    capturedBaseTotal: 0,
    uniquePeople: 0,
    groups: 0,
    sessions: 0,
    attendanceRate: 0
  };
  const sessionsCount = Number(seasonMatrix?.sessions?.length || focusSeason?.sessionsCount || 0);
  const groupsCount = Number(groupVisualSummaries.length || seasonMatrix?.groups?.length || 0);
  const capturedSessionsCount = sessionTotals.filter((session) => Number(session.capturedBaseTotal || 0) > 0 || Number(session.groupsCaptured || 0) > 0).length;
  const groupsWithCaptureCount = groupVisualSummaries.filter((group) => Number(group.capturedSessions || 0) > 0).length;
  const dashboardGroupSource = seasonMatrix?.groups?.length
    ? seasonMatrix.groups.map((group) => ({
      id: String(group.groupId),
      name: group.groupName
    }))
    : state.catalogs.groups;
  const dashboardGroupOptions = renderOptions(
    dashboardGroupSource.map((group) => ({
      value: String(group.id),
      label: `${group.name} (${group.id})`
    })),
    selectedGroupId,
    "Selecciona grupo"
  );
  const hasSeasonData = Boolean(focusSeason);
  const globalAttendanceLabel = overall.capturedBaseTotal
    ? `${overall.presentTotal}/${overall.capturedBaseTotal}`
    : "Sin captura";
  const selectedTrend = selectedGroupMeta?.trend || leaderSummary?.trend || null;
  const focusedSession = leaderSummary?.sessions?.find((session) => String(session.sessionId || session.id || "") === selectedSessionId) || null;

  return `
    <section class="view-grid dashboard-executive-flow">
      <article class="panel-card dashboard-toolbar-card dashboard-season-selector-card module-section-anchor" id="dashboard-season-selector">
        <div class="panel-head">
          <div>
            <h2>Dashboard ejecutivo</h2>
            <p>Selecciona la temporada y consulta la asistencia global, por sesion y por grupo en un solo flujo.</p>
          </div>
          <div class="dashboard-toolbar-actions">
            <button class="btn btn-secondary" data-action="refresh-dashboard-executive">Actualizar</button>
          </div>
        </div>

        <div class="field-grid dashboard-toolbar-season-grid">
          ${renderSeasonSelect("dashboard-season", state.filters.dashboard.seasonId)}
        </div>

        <div class="summary-strip">
          <span class="context-item"><strong>Temporada:</strong> ${focusSeason ? escapeHtml(focusSeason.name) : "Sin temporada"}</span>
          <span class="context-item"><strong>Sesiones:</strong> ${escapeHtml(String(sessionsCount))}</span>
          <span class="context-item"><strong>Grupos:</strong> ${escapeHtml(String(groupsCount))}</span>
          <span class="context-item"><strong>Actualizado:</strong> ${escapeHtml(executive?.generatedAt ? formatDateTime_(executive.generatedAt) : "Pendiente")}</span>
        </div>
      </article>

      ${!hasSeasonData ? `
        <div class="empty-state">Selecciona o crea una temporada para comenzar la consulta ejecutiva.</div>
      ` : `
        <article class="detail-card dashboard-overview-card module-section-anchor" id="dashboard-overview">
          <div class="panel-head">
            <div>
              <h2>Resumen global de la temporada</h2>
              <p>Lectura rapida para saber como va la temporada antes de entrar al detalle por grupo.</p>
            </div>
            ${focusSeason ? renderPill(focusSeason.status) : `<span class="pill warning">Sin temporada</span>`}
          </div>

          <div class="stats-grid dashboard-stats-grid dashboard-overview-grid">
            <article class="stat-card">
              <span class="status-chip success">Asistencia global</span>
              <strong>${escapeHtml(globalAttendanceLabel)}</strong>
              <span>${escapeHtml(String(overall.attendanceRate || 0))}% sobre la base ya capturada.</span>
            </article>

            <article class="stat-card">
              <span class="status-chip neutral">Sesiones capturadas</span>
              <strong>${escapeHtml(`${capturedSessionsCount}/${sessionsCount}`)}</strong>
              <span>${sessionsCount ? escapeHtml(`${Math.round((capturedSessionsCount / sessionsCount) * 100)}% de avance`) : "Sin sesiones"}</span>
            </article>

            <article class="stat-card">
              <span class="status-chip dark">Grupos en temporada</span>
              <strong>${escapeHtml(String(groupsCount))}</strong>
              <span>Grupos incluidos en la consulta global de esta temporada.</span>
            </article>

            <article class="stat-card">
              <span class="status-chip neutral">Participantes unicos</span>
              <strong>${escapeHtml(String(overall.uniquePeople || 0))}</strong>
              <span>Personas que forman parte de los grupos analizados.</span>
            </article>
          </div>
        </article>

        <article class="detail-card dashboard-visual-board-card module-section-anchor" id="dashboard-visual-board">
          <div class="panel-head">
            <div>
              <h2>Panorama visual por grupo</h2>
              <p>Se carga automaticamente para que el pastor o lider vea de inmediato la tendencia de cada grupo y abra el detalle con un toque.</p>
            </div>
            <span class="pill dark">${escapeHtml(`${groupsWithCaptureCount}/${groupsCount}`)} con captura</span>
          </div>

          <div class="summary-strip dashboard-visual-board-strip">
            <span class="context-item"><strong>Asistencia global:</strong> ${escapeHtml(String(overall.attendanceRate || 0))}%</span>
            <span class="context-item"><strong>Grupos con captura:</strong> ${escapeHtml(String(groupsWithCaptureCount))} de ${escapeHtml(String(groupsCount))}</span>
            <span class="context-item"><strong>Sesiones capturadas:</strong> ${escapeHtml(String(capturedSessionsCount))} de ${escapeHtml(String(sessionsCount))}</span>
            <span class="context-item"><strong>Accion:</strong> toca el nombre del grupo para abrir el detalle</span>
          </div>

          ${renderDashboardExecutiveGroupBoard_(seasonMatrix?.groups || [], selectedGroupId, selectedSessionId)}
        </article>

        <article class="detail-card dashboard-session-overview-card module-section-anchor" id="dashboard-session-overview">
          <div class="panel-head">
            <div>
              <h2>Asistencia por sesion</h2>
              <p>Cada tarjeta resume el total de presentes y la cobertura de grupos capturados en esa sesion.</p>
            </div>
          </div>

          ${sessionTotals.length ? `
            <div class="dashboard-session-total-grid">
              ${sessionTotals.map((session) => `
                <article class="summary-box dashboard-session-total-card">
                  <span class="status-chip ${session.groupsCaptured ? "success" : "warning"}">${escapeHtml(session.shortLabel || session.name)}</span>
                  <strong>${session.capturedBaseTotal ? escapeHtml(`${session.presentTotal}/${session.capturedBaseTotal}`) : "Sin captura"}</strong>
                  <span>${escapeHtml(String(session.attendanceRate || 0))}% asistencia</span>
                  <small>${escapeHtml(formatDate(session.date))}</small>
                  <small>${escapeHtml(`${session.groupsCaptured || 0}/${session.groupsConfigured || 0} grupos | ${session.assignedVolunteers || 0} V + ${session.assignedCongregants || 0} C`)}</small>
                </article>
              `).join("")}
            </div>
          ` : `
            <div class="empty-state">Todavia no hay sesiones disponibles para esta temporada.</div>
          `}
        </article>

        <article class="detail-card dashboard-season-matrix-card module-section-anchor" id="dashboard-season-matrix">
          <div class="panel-head">
            <div>
              <h2>Tabla por grupo y sesion</h2>
              <p>Vista tabular para validar rapidamente totales, composicion voluntarios + congregantes y cobertura por sesion.</p>
            </div>
            <span class="pill dark">${escapeHtml(String(groupsCount))} grupos</span>
          </div>

          ${seasonMatrix ? `
            <div class="table-wrap season-matrix-wrap">
              <table class="season-matrix-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    ${seasonMatrix.sessions.map((session) => `
                      <th>${escapeHtml(session.shortLabel || session.name)}</th>
                    `).join("")}
                    <th>Total grupo</th>
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
                          <span class="row-meta">Grupo ${escapeHtml(String(group.groupId))} | ${escapeHtml(String(group.uniquePeople || 0))} personas</span>
                        </button>
                      </td>
                      ${group.sessions.map((cell) => `
                        <td>
                          <div class="season-matrix-cell ${cell.captured ? "captured" : "pending"}">
                            <strong>${cell.captured ? escapeHtml(`${cell.present || 0}/${cell.total || 0}`) : escapeHtml(cell.total ? `-/${cell.total}` : "0")}</strong>
                            <span>${cell.captured ? escapeHtml(`${cell.rate || 0}% asistencia`) : (cell.total ? "Sin captura" : "Sin base")}</span>
                            <small>${escapeHtml(`${cell.volunteers || 0} V + ${cell.congregants || 0} C`)}</small>
                          </div>
                        </td>
                      `).join("")}
                      <td>
                        <div class="season-matrix-total-card">
                          <strong>${group.capturedBaseTotal ? escapeHtml(`${group.presentTotal || 0}/${group.capturedBaseTotal || 0}`) : "Sin captura"}</strong>
                          <span>${escapeHtml(String(group.attendanceRate || 0))}% | ${escapeHtml(String(group.capturedSessions || 0))}/${escapeHtml(String(group.totalSessions || 0))} sesiones</span>
                        </div>
                      </td>
                    </tr>
                  `).join("") : `
                    <tr>
                      <td colspan="${Math.max((seasonMatrix.sessions.length || 0) + 2, 3)}">
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

        <article class="panel-card dashboard-group-focus-card module-section-anchor" id="dashboard-group-focus">
          <div class="panel-head">
            <div>
              <h2>Detalle del grupo</h2>
              <p>Selecciona un grupo desde el panorama visual, la tabla o la lista para revisar su comportamiento completo.</p>
            </div>
            ${selectedTrend ? renderDashboardTrendPill_(selectedTrend) : `<span class="pill dark">Sin grupo</span>`}
          </div>

          <div class="view-grid columns-2 dashboard-group-focus-grid">
            <div class="dashboard-consult-hub-panel">
              <div class="field">
                <label for="dashboard-group">Grupo de conexion</label>
                <select id="dashboard-group">
                  ${dashboardGroupOptions}
                </select>
                <span class="field-help">Puedes elegir aqui un grupo o tocar directamente una fila dentro de la matriz.</span>
              </div>

              <div class="actions-row dashboard-filter-actions">
                <button class="btn btn-secondary" data-action="export-dashboard-group-detail" ${selectedGroupMeta ? "" : "disabled"}>Exportar grupo</button>
                <button class="btn btn-ghost" data-action="clear-dashboard-group-query" ${selectedGroupMeta ? "" : "disabled"}>Limpiar</button>
              </div>

              <div class="dashboard-consult-tip">
                <strong>Consulta sugerida</strong>
                <span>1. Mira el panorama visual. 2. Toca el grupo que te interese. 3. Exporta o valida su asistencia persona por persona.</span>
              </div>
            </div>

            <div class="dashboard-consult-hub-panel">
              ${selectedGroupMeta ? `
                <div class="summary-stack dashboard-summary-grid">
                  <div class="summary-box">
                    <span class="status-chip neutral">Grupo</span>
                    <strong>${escapeHtml(selectedGroupMeta.groupName || "Sin grupo")}</strong>
                    <span>${escapeHtml(String(selectedGroupMeta.groupId || ""))}</span>
                  </div>
                  <div class="summary-box">
                    <span class="status-chip success">Asistencia</span>
                    <strong>${escapeHtml(`${leaderSummary?.presentTotal ?? selectedGroupMeta.presentTotal ?? 0}/${leaderSummary?.capturedBaseTotal ?? selectedGroupMeta.capturedBaseTotal ?? 0}`)}</strong>
                    <span>${escapeHtml(String(leaderSummary?.attendanceRate ?? selectedGroupMeta.attendanceRate ?? 0))}% acumulado.</span>
                  </div>
                  <div class="summary-box">
                    <span class="status-chip dark">Cobertura</span>
                    <strong>${escapeHtml(`${leaderSummary?.capturedSessions ?? selectedGroupMeta.capturedSessions ?? 0}/${leaderSummary?.totalSessions ?? selectedGroupMeta.totalSessions ?? 0}`)}</strong>
                    <span>${escapeHtml(String(leaderSummary?.captureProgress ?? selectedGroupMeta.captureProgress ?? 0))}% de sesiones con captura.</span>
                  </div>
                  <div class="summary-box">
                    <span class="status-chip neutral">Participantes</span>
                    <strong>${escapeHtml(String(leaderSummary?.uniquePeople ?? selectedGroupMeta.uniquePeople ?? 0))}</strong>
                    <span>${escapeHtml(String(leaderSummary?.participantAssignments ?? selectedGroupMeta.participantAssignments ?? 0))} asignaciones acumuladas.</span>
                  </div>
                </div>
              ` : `
                <div class="empty-state">Selecciona un grupo para ver su resumen, tendencia y detalle de asistentes.</div>
              `}
            </div>
          </div>
        </article>

        <article class="detail-card dashboard-group-trend-card module-section-anchor" id="dashboard-group-summary">
          <div class="panel-head">
            <div>
              <h2>Tendencia del grupo</h2>
              <p>Comportamiento de asistencia del grupo durante toda la temporada seleccionada.</p>
            </div>
            ${leaderSummary ? renderDashboardTrendPill_(leaderSummary.trend) : `<span class="pill dark">Sin grupo</span>`}
          </div>

          ${leaderSummary ? `
            ${renderDashboardTrendChart_(leaderSummary, {
              activeSessionId: selectedSessionId
            })}

            <div class="summary-stack dashboard-summary-grid dashboard-group-trend-summary">
              ${focusedSession ? `
                <div class="summary-box dashboard-focused-session-box">
                  <span class="status-chip success">Sesion enfocada</span>
                  <strong>${escapeHtml(focusedSession.shortLabel || focusedSession.name || "Sesion")}</strong>
                  <span>${focusedSession.captured ? escapeHtml(`${focusedSession.present || 0}/${focusedSession.total || 0} (${focusedSession.rate || 0}%)`) : "Sin captura en esta sesion."}</span>
                </div>
              ` : ""}
              <div class="summary-box">
                <span class="status-chip neutral">Mejor sesion</span>
                <strong>${leaderSummary.bestSession ? escapeHtml(leaderSummary.bestSession.shortLabel || leaderSummary.bestSession.name) : "Sin dato"}</strong>
                <span>${leaderSummary.bestSession ? escapeHtml(`${leaderSummary.bestSession.present || 0}/${leaderSummary.bestSession.total || 0} (${leaderSummary.bestSession.rate || 0}%)`) : "Aun no hay sesiones capturadas."}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip dark">Ultima sesion</span>
                <strong>${leaderSummary.latestSession ? escapeHtml(leaderSummary.latestSession.shortLabel || leaderSummary.latestSession.name) : "Sin dato"}</strong>
                <span>${leaderSummary.latestSession ? escapeHtml(`${leaderSummary.latestSession.present || 0}/${leaderSummary.latestSession.total || 0} (${leaderSummary.latestSession.rate || 0}%)`) : "Sin captura reciente."}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip success">Tendencia</span>
                <strong>${escapeHtml(leaderSummary.trend?.label || "Sin tendencia")}</strong>
                <span>${escapeHtml(leaderSummary.trend?.summary || "Sin sesiones suficientes para evaluar el comportamiento del grupo.")}</span>
              </div>
              <div class="summary-box">
                <span class="status-chip neutral">Mayor constancia</span>
                <strong>${leaderSummary.topPeople.length ? escapeHtml(leaderSummary.topPeople[0].name) : "Sin dato"}</strong>
                <span>${leaderSummary.topPeople.length ? escapeHtml(`${leaderSummary.topPeople[0].totalPresent || 0} asistencias SI`) : "Aun no hay historial suficiente."}</span>
              </div>
            </div>
          ` : `
            <div class="empty-state">Selecciona un grupo para visualizar su tendencia de asistencia por sesion.</div>
          `}
        </article>

        <article class="detail-card dashboard-group-detail-card module-section-anchor" id="dashboard-group-detail">
          <div class="panel-head">
            <div>
              <h2>Detalle de asistentes por grupo</h2>
              <p>Paloma verde si asistio, cruz roja si no asistio y guion cuando esa sesion aun no tiene captura.</p>
            </div>
            ${leaderSummary ? renderDashboardTrendPill_(leaderSummary.trend) : `<span class="pill dark">Sin grupo</span>`}
          </div>

          ${leaderSummary ? `
            ${focusedSession ? `
              <div class="summary-strip dashboard-focused-session-strip">
                <span class="context-item"><strong>Sesion enfocada:</strong> ${escapeHtml(focusedSession.shortLabel || focusedSession.name || "Sesion")}</span>
                <span class="context-item"><strong>Asistieron:</strong> ${focusedSession.captured ? escapeHtml(String(focusedSession.present || 0)) : "-"}</span>
                <span class="context-item"><strong>Base:</strong> ${escapeHtml(String(focusedSession.total || 0))}</span>
                <span class="context-item"><strong>Porcentaje:</strong> ${focusedSession.captured ? escapeHtml(`${focusedSession.rate || 0}%`) : "Sin captura"}</span>
              </div>
            ` : ""}
            <div class="table-wrap dashboard-group-roster-wrap">
              <table class="dashboard-group-roster-table">
                <thead>
                  <tr>
                    <th>Asistente</th>
                    <th>Tipo</th>
                    <th>Total</th>
                    ${leaderSummary.sessions.map((session) => `
                      <th
                        class="${String(session.sessionId || session.id || "") === selectedSessionId ? "is-focused" : ""}"
                        data-dashboard-session-header="${escapeHtml(String(session.sessionId || session.id || ""))}"
                      >${escapeHtml(session.shortLabel || session.name)}</th>
                    `).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${leaderSummary.people.length ? leaderSummary.people.map((person) => `
                    <tr>
                      <td>
                        <span class="row-title">${escapeHtml(person.name)}</span>
                        <span class="row-meta">${escapeHtml(person.personId)}</span>
                      </td>
                      <td>${renderPersonTypePill_(person.type || "")}</td>
                      <td>
                        <div class="dashboard-person-total">
                          <strong>${escapeHtml(`${person.totalPresent || 0}/${person.totalAssignedSessions || leaderSummary.totalSessions || 0}`)}</strong>
                          <span>${escapeHtml(String(person.attendanceRate || 0))}%</span>
                        </div>
                      </td>
                      ${leaderSummary.sessions.map((session) => `
                        <td
                          class="${String(session.sessionId || session.id || "") === selectedSessionId ? "is-focused" : ""}"
                          data-dashboard-session-cell="${escapeHtml(String(session.sessionId || session.id || ""))}"
                        >
                          <div class="dashboard-attendance-cell ${String(session.sessionId || session.id || "") === selectedSessionId ? "is-focused" : ""}">
                            ${renderDashboardAttendanceMark_(person.attendances?.[session.sessionId] || person.attendances?.[session.id] || "")}
                          </div>
                        </td>
                      `).join("")}
                    </tr>
                  `).join("") : `
                    <tr>
                      <td colspan="${Math.max((leaderSummary.sessions.length || 0) + 3, 4)}">
                        <div class="empty-state">Este grupo todavia no tiene personas suficientes para construir el detalle.</div>
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="empty-state">Selecciona un grupo para revisar el listado detallado de asistentes y su historial por sesion.</div>
          `}
        </article>
      `}
    </section>
  `;
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
  const selectedGroupId = String(state.filters.dashboard.groupId || "");
  const detail = (state.dashboardLeaderDetail && String(state.dashboardLeaderDetail.groupId || "") === selectedGroupId)
    ? state.dashboardLeaderDetail
    : (state.dashboardSeasonMatrix?.groupDetailsById?.[selectedGroupId] || null);
  const selectedGroupRow = getDashboardSelectedGroupRow_();
  const sessions = Array.isArray(detail?.sessions) ? detail.sessions : [];
  const seasonName = executive?.seasonFocus?.name || resolveSeasonName_(detail?.seasonId) || "Sin temporada";
  const groupId = selectedGroupRow?.groupId || detail?.groupId || selectedGroupId || "";
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
      ? Math.round((Number(person.totalPresent || 0) / Math.max(Number(person.totalAssignedSessions || sessions.length), 1)) * 100)
      : 0;

    rows.push([
      seasonName,
      groupId,
      groupName,
      person.personId || "",
      person.name || "",
      person.totalPresent || 0,
      `${attendanceRate}%`,
      ...sessions.map((session) => person.attendances?.[session.sessionId] || person.attendances?.[session.id] || "")
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
            <input type="hidden" name="estatusBienvenida" value="CONGREGANTE">
            <input type="hidden" name="workflowOrigin" value="directory">
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
                    <option value="${escapeHtml(type)}" ${type === "CONGREGANTE" ? "selected" : ""}>${escapeHtml(getPersonTypeDisplayLabel_(type))}</option>
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
              Tipos validos: <code>NUEVO</code>, <code>PROSPECTO GP</code>, <code>CONGREGANTE</code>, <code>PROSPECTO GF</code>, <code>VOLUNTARIOS</code>, <code>LIDER</code> y <code>COORDINADOR</code>.
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
  const buildSessionStatusActions = (session) => {
    const actions = [];
    const status = String(session.status || "").toUpperCase();

    if (status === "ABIERTA") {
      actions.push({ label: "Cerrar", status: "CERRADA", variant: "btn-danger" });
      actions.push({ label: "Suspender", status: "SUSPENDIDA", variant: "btn-ghost" });
    } else if (status === "SUSPENDIDA") {
      actions.push({ label: "Dejar cerrada", status: "CERRADA", variant: "btn-secondary" });
      actions.push({ label: "Abrir", status: "ABIERTA", variant: "btn-primary" });
    } else {
      actions.push({ label: "Abrir", status: "ABIERTA", variant: "btn-primary" });
      actions.push({ label: "Suspender", status: "SUSPENDIDA", variant: "btn-ghost" });
    }

    return `
      <div class="actions-row session-actions">
        ${actions.map((action) => `
          <button
            class="btn ${action.variant}"
            data-action="toggle-session-status"
            data-season-id="${escapeHtml(selectedSeason.id)}"
            data-session-id="${escapeHtml(session.id)}"
            data-status="${escapeHtml(action.status)}"
          >
            ${escapeHtml(action.label)}
          </button>
        `).join("")}
      </div>
    `;
  };

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
                    <td>${buildSessionStatusActions(session)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <article class="summary-card session-create-inline-card">
            <div class="panel-head">
              <div>
                <h3>Agregar una sesion extra</h3>
                <p>Crea una sola sesion nueva, asigna todos los grupos y hereda automaticamente los asistentes activos que ya tiene cada grupo en la temporada.</p>
              </div>
            </div>

            <form id="session-create-single-form">
              <input name="seasonId" type="hidden" value="${escapeHtml(selectedSeason.id)}">

              <div class="field-grid three season-single-session-grid">
                <div class="field">
                  <label for="single-session-date">Fecha</label>
                  <input id="single-session-date" name="date" type="date" required>
                </div>

                <div class="field">
                  <label for="single-session-name">Nombre</label>
                  <input id="single-session-name" name="name" placeholder="Sesion 9">
                </div>

                <div class="field">
                  <label for="single-session-status">Estado inicial</label>
                  <select id="single-session-status" name="status">
                    ${renderOptions([
                      { value: "CERRADA", label: "CERRADA" },
                      { value: "ABIERTA", label: "ABIERTA" },
                      { value: "SUSPENDIDA", label: "SUSPENDIDA" }
                    ], "CERRADA", "Selecciona estado")}
                  </select>
                </div>
              </div>

              <div class="actions-row">
                <button class="btn btn-primary" type="submit">Agregar sesion</button>
                <button class="btn btn-ghost" type="button" data-action="select-season" data-season-id="${escapeHtml(selectedSeason.id)}">Actualizar lista</button>
              </div>
            </form>
          </article>

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
  const getPersonAssignmentState = (person) => getParticipantSeasonAssignmentState_(person.id, filter.groupId, participantPersonIds);
  const queuedVisibleBulkCount = bulkResults.filter((person) => selectedBulkSet.has(String(person.id))).length;
  const assignedVisibleBulkCount = bulkResults.filter((person) => participantPersonIds.has(String(person.id))).length;
  const selectedAlreadyAssignedCount = selectedPeople.filter((person) => participantPersonIds.has(String(person.id))).length;
  const selectedBlockedCount = selectedPeople.filter((person) => getPersonAssignmentState(person).blockedByOtherGroup).length;
  const selectedNewCount = selectedPeople.filter((person) => {
    const assignmentState = getPersonAssignmentState(person);
    return !assignmentState.currentSessionAssigned && !assignmentState.blockedByOtherGroup;
  }).length;
  const hiddenBulkCount = Math.max(bulkMatches.length - bulkResults.length, 0);
  const serverCount = state.participants.filter((participant) => normalizeText(participant.type) === "servidor").length;
  const moveGroups = groups;
  const canBulkAssign = Boolean(filter.seasonId && filter.sessionId && filter.groupId && sessions.length && selectedPeople.length && !selectedBlockedCount);
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
            ` : peopleSearchResults.length ? peopleSearchResults.map((person) => {
              const assignmentState = getPersonAssignmentState(person);
              const disabled = assignmentState.currentSessionAssigned || assignmentState.blockedByOtherGroup;
              const seasonAssignmentLabel = assignmentState.blockedByOtherGroup
                ? `Ya pertenece a ${assignmentState.seasonAssignment?.groupNames?.join(" / ") || assignmentState.seasonAssignment?.groupName || "otro grupo"} en esta temporada.`
                : (assignmentState.assignedToCurrentGroupOnly && !assignmentState.currentSessionAssigned
                  ? "Ya pertenece a este grupo en otras sesiones; aqui puedes completar la sesion actual."
                  : "");

              return `
                <article class="result-card participant-picker-card ${disabled ? "result-card-muted" : ""}">
                  <div class="result-row">
                    <div class="result-copy-stack">
                      <div class="result-title-row">
                        <span class="row-title">${escapeHtml(person.name)}</span>
                        ${assignmentState.currentSessionAssigned ? `<span class="pill success">Ya en esta sesion</span>` : ""}
                        ${assignmentState.blockedByOtherGroup ? `<span class="pill warning">Ya en otro grupo</span>` : ""}
                      </div>
                      <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                      ${assignmentState.currentSessionAssigned ? `<span class="row-meta">Esta persona ya forma parte del grupo actual.</span>` : ""}
                      ${seasonAssignmentLabel ? `<span class="row-meta">${escapeHtml(seasonAssignmentLabel)}</span>` : ""}
                    </div>
                    <div class="participant-action-stack">
                      <button
                        class="btn btn-primary"
                        data-action="add-person"
                        data-person-id="${escapeHtml(person.id)}"
                        ${disabled ? "disabled" : ""}
                      >
                        ${assignmentState.currentSessionAssigned ? "Asignado" : assignmentState.blockedByOtherGroup ? "Bloqueado" : "Agregar a esta sesion"}
                      </button>
                    </div>
                  </div>
                </article>
              `;
            }).join("") : `
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
                ` : bulkResults.length ? bulkResults.map((person) => {
                  const assignmentState = getPersonAssignmentState(person);
                  const disabled = selectedBulkSet.has(String(person.id)) || assignmentState.blockedByOtherGroup;
                  const helperCopy = assignmentState.blockedByOtherGroup
                    ? `Ya pertenece a ${assignmentState.seasonAssignment?.groupNames?.join(" / ") || assignmentState.seasonAssignment?.groupName || "otro grupo"} en esta temporada.`
                    : (participantPersonIds.has(String(person.id))
                      ? "Puedes incluirlo si quieres completar las sesiones restantes de la temporada."
                      : "Listo para agregarse a todas las sesiones del ciclo.");

                  return `
                    <article class="result-card participant-picker-card ${disabled ? "result-card-muted" : ""}">
                      <div class="result-row">
                        <div class="result-copy-stack">
                          <div class="result-title-row">
                            <span class="row-title">${escapeHtml(person.name)}</span>
                            ${participantPersonIds.has(String(person.id)) ? `<span class="pill success">Ya en esta sesion</span>` : ""}
                            ${selectedBulkSet.has(String(person.id)) ? `<span class="pill dark">En lote</span>` : ""}
                            ${assignmentState.blockedByOtherGroup ? `<span class="pill warning">Otro grupo</span>` : ""}
                          </div>
                          <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                          <span class="row-meta">${escapeHtml(helperCopy)}</span>
                        </div>
                        <div class="participant-action-stack">
                          <button
                            class="btn ${selectedBulkSet.has(String(person.id)) || assignmentState.blockedByOtherGroup ? "btn-secondary" : "btn-primary"}"
                            data-action="add-bulk-person"
                            data-person-id="${escapeHtml(String(person.id))}"
                            ${disabled ? "disabled" : ""}
                          >
                            ${selectedBulkSet.has(String(person.id)) ? "Ya en el lote" : assignmentState.blockedByOtherGroup ? "Bloqueado" : "Agregar al lote"}
                          </button>
                        </div>
                      </div>
                    </article>
                  `;
                }).join("") : `
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
                  <span class="row-meta">${escapeHtml(String(selectedAlreadyAssignedCount))} ya estaban en esta sesion, ${escapeHtml(String(selectedNewCount))} se agregaran aqui por primera vez y ${escapeHtml(String(selectedBlockedCount))} requieren correccion.</span>
                </div>

                ${selectedPeople.length ? `
                  <div class="results-list bulk-queue-list">
                    ${selectedPeople.map((person) => {
                      const assignmentState = getPersonAssignmentState(person);
                      const blockedCopy = assignmentState.blockedByOtherGroup
                        ? `Conflicto: ya pertenece a ${assignmentState.seasonAssignment?.groupNames?.join(" / ") || assignmentState.seasonAssignment?.groupName || "otro grupo"} en esta temporada.`
                        : `Se tomara en cuenta para las ${String(sessions.length)} sesiones de la temporada.`;

                      return `
                      <article class="result-card bulk-queue-card ${participantPersonIds.has(String(person.id)) || assignmentState.blockedByOtherGroup ? "result-card-muted" : ""}">
                        <div class="result-row">
                          <div class="result-copy-stack">
                            <div class="result-title-row">
                              <span class="row-title">${escapeHtml(person.name)}</span>
                              ${participantPersonIds.has(String(person.id)) ? `<span class="pill success">Ya en esta sesion</span>` : `<span class="pill dark">Nuevo en esta sesion</span>`}
                              ${assignmentState.blockedByOtherGroup ? `<span class="pill warning">Otro grupo</span>` : ""}
                            </div>
                            <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                            <span class="row-meta">${escapeHtml(blockedCopy)}</span>
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
                    `;}).join("")}
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
                    ${selectedBlockedCount
                      ? "Hay personas en conflicto con otro grupo de la temporada. Quitalas del lote antes de continuar."
                      : (canBulkAssign
                        ? `El sistema revisara las ${escapeHtml(String(sessions.length))} sesiones de la temporada y evitara duplicados donde ya existan participantes.`
                        : "Necesitas contexto valido y al menos una persona en el lote para ejecutar la asignacion.")}
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
  const workingSession = getAttendanceWorkingSession_();
  const workingSessionSource = filter.scope === "selected" ? "manual" : "today";
  const workingSeasonName = workingSession ? resolveSeasonName_(workingSession.seasonId) : "";
  const groups = workingSession ? getSessionGroups(workingSession.seasonId, workingSession.id) : [];
  const context = state.attendanceContext;
  const summary = buildAttendanceSummary();
  const filteredParticipants = getFilteredAttendanceParticipants_();
  const pickerSeasonId = filter.pickerSeasonId || filter.seasonId || activeSession?.seasonId || getLatestSeason()?.id || "";
  const pickerSessions = getSessions(pickerSeasonId);
  const pickerSessionId = filter.pickerSessionId
    || ((filter.scope === "selected" && String(filter.seasonId) === String(pickerSeasonId)) ? filter.sessionId : "")
    || pickerSessions[pickerSessions.length - 1]?.id
    || pickerSessions[0]?.id
    || "";
  const pickerSession = pickerSessions.find((session) => String(session.id) === String(pickerSessionId)) || null;
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
    : (!workingSession
      ? (workingSessionSource === "manual"
        ? "Activa una sesion historica o especial para cargar asistentes."
        : "No hay una sesion ABIERTA hoy para cargar asistentes.")
      : (!filter.groupId
        ? "Selecciona un grupo para desplegar a todos sus asistentes."
        : "Cargando el contexto del grupo seleccionado..."));
  const emptyAttendanceMessage = !workingSession
    ? (workingSessionSource === "manual"
      ? "Selecciona una temporada, elige la sesion que necesitas y activala para capturar asistencia manual."
      : "No hay una sesion ABIERTA en la fecha de hoy. Puedes abrir una para hoy o activar una sesion historica desde este mismo modulo.")
    : (!filter.groupId
      ? "Selecciona un grupo para cargar su lista de asistentes."
      : "No hay participantes activos para capturar en este contexto.");
  const sourceBadgeLabel = workingSession
    ? (workingSessionSource === "manual" ? "Sesion manual activada" : "Sesion de hoy activa")
    : (workingSessionSource === "manual" ? "Sin sesion manual" : "Sin sesion de hoy");

  return `
    <section class="view-grid">
      ${renderModuleMobileHero_({
        tone: "attendance",
        eyebrow: "Captura operativa",
        title: "Asistencia lista para operar",
        copy: "Trabaja con la sesion de hoy o activa una sesion anterior para captura manual.",
        badge: {
          label: workingSession ? draftLabel : sourceBadgeLabel,
          kind: workingSession ? (summary.changed ? "warning" : (context && context.alreadyCaptured ? "dark" : "success")) : "warning"
        },
        metrics: [
          { label: "Fuente", value: workingSessionSource === "manual" ? "Sesion elegida" : "Sesion de hoy" },
          { label: "Temporada", value: workingSeasonName || "Pendiente" },
          { label: "Sesion", value: workingSession ? workingSession.name : "Sin activar" },
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
            <p>Usa la sesion activa de hoy o activa una sesion anterior para capturar asistencia manual sin depender de la fecha actual.</p>
          </div>
          <button class="btn btn-secondary" data-action="load-attendance">Refrescar contexto</button>
        </div>

        <div class="view-grid columns-2 attendance-session-source-grid">
          <article class="summary-card attendance-source-card ${workingSessionSource === "today" ? "attendance-source-card-active" : ""}">
            <div class="panel-head">
              <div>
                <h3>Sesion de hoy</h3>
                <p>Ideal cuando capturas la reunion del dia y quieres seguir el flujo automatico del sistema.</p>
              </div>
              <span class="pill ${workingSessionSource === "today" ? "success" : "dark"}">${workingSessionSource === "today" ? "En uso" : "Disponible"}</span>
            </div>

            ${activeSession ? `
              <div class="context-strip">
                <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(resolveSeasonName_(activeSession.seasonId) || activeSession.seasonId)}</span>
                <span class="context-item"><strong>Sesion:</strong> ${escapeHtml(activeSession.name)}</span>
                <span class="context-item"><strong>Fecha:</strong> ${escapeHtml(formatDate(activeSession.date))}</span>
                <span class="context-item"><strong>Estado:</strong> ${escapeHtml(activeSession.status || "ABIERTA")}</span>
              </div>
              <div class="actions-row">
                <button class="btn btn-primary" data-action="activate-attendance-today">Usar sesion de hoy</button>
              </div>
            ` : `
              <div class="empty-state">Hoy no hay una sesion ABIERTA. Si necesitas avanzar, activa una sesion historica en el bloque de al lado.</div>
            `}
          </article>

          <article class="summary-card attendance-source-card ${workingSessionSource === "manual" ? "attendance-source-card-active" : ""}">
            <div class="panel-head">
              <div>
                <h3>Sesion historica o especial</h3>
                <p>Selecciona una sesion anterior, activala en esta vista y luego elige el grupo para capturar o editar asistencia manual.</p>
              </div>
              <span class="pill ${workingSessionSource === "manual" ? "warning" : "dark"}">${workingSessionSource === "manual" ? "Activa" : "Lista"}</span>
            </div>

            <div class="field-grid two attendance-session-picker-grid">
              ${renderSeasonSelect("attendance-season", pickerSeasonId)}
              ${renderSessionSelect("attendance-session", pickerSeasonId, pickerSessionId)}
            </div>

            ${pickerSession ? `
              <div class="context-strip">
                <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(resolveSeasonName_(pickerSeasonId) || pickerSeasonId)}</span>
                <span class="context-item"><strong>Sesion:</strong> ${escapeHtml(pickerSession.name)}</span>
                <span class="context-item"><strong>Fecha:</strong> ${escapeHtml(formatDate(pickerSession.date))}</span>
                <span class="context-item"><strong>Estado:</strong> ${escapeHtml(pickerSession.status || "CERRADA")}</span>
              </div>
            ` : `
              <div class="empty-state">Selecciona una temporada para cargar sus sesiones.</div>
            `}

            <div class="actions-row">
              <button class="btn btn-primary" data-action="activate-attendance-selection" ${pickerSeasonId && pickerSessionId ? "" : "disabled"}>Activar esta sesion</button>
            </div>
            <span class="field-help">Activarla aqui no cambia QR ni kiosko. Solo define con que sesion trabajas en esta captura manual.</span>
          </article>
        </div>

        <div class="field-grid two attendance-context-grid">
          <div class="field">
            <label>Sesion activa en captura manual</label>
            ${workingSession ? `
              <div class="context-strip">
                <span class="context-item"><strong>Fuente:</strong> ${escapeHtml(workingSessionSource === "manual" ? "Sesion historica activada" : "Sesion de hoy")}</span>
                <span class="context-item"><strong>Temporada:</strong> ${escapeHtml(workingSeasonName || workingSession.seasonId)}</span>
                <span class="context-item"><strong>Sesion:</strong> ${escapeHtml(workingSession.name)}</span>
                <span class="context-item"><strong>Fecha:</strong> ${escapeHtml(formatDate(workingSession.date))}</span>
                <span class="context-item"><strong>Estado:</strong> ${escapeHtml(workingSession.status || "ABIERTA")}</span>
              </div>
              <span class="field-help">${workingSessionSource === "manual" ? "Esta sesion quedo activada para trabajo manual en esta pantalla." : "Esta es la sesion detectada automaticamente para hoy."}</span>
            ` : `
              <div class="empty-state">${workingSessionSource === "manual" ? "Aun no activas una sesion historica para esta captura." : "Hoy no hay una sesion ABIERTA para trabajar en automatico."}</div>
            `}
          </div>

          <div class="field">
            <label>Grupo de captura</label>
            ${workingSession ? `
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
                  <div class="empty-state">No hay grupos asociados a la sesion seleccionada.</div>
                `}
              </div>
              <span class="field-help">Toca un grupo para cargar su lista. Puedes usar esta misma pantalla tanto para sesiones actuales como anteriores.</span>
            ` : `
              <div class="empty-state">Primero activa la sesion con la que vas a trabajar y despues elige el grupo.</div>
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

function getSelectedAttendanceSession_() {
  const filter = state.filters.attendance;
  const sessions = getSessions(filter.seasonId);
  return sessions.find((session) => String(session.id) === String(filter.sessionId)) || null;
}

function getAttendanceWorkingSession_() {
  return state.filters.attendance.scope === "selected"
    ? getSelectedAttendanceSession_()
    : getActiveAttendanceSession_();
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

  if (normalized === "SUSPENDIDA") {
    return `<span class="pill danger">${escapeHtml(value)}</span>`;
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
  const labels = {
    nuevo: "Nuevo",
    prospectogp: "Prospecto GP",
    congregante: "Congregante",
    prospectogf: "Prospecto GF",
    voluntarios: "Voluntarios",
    lider: "Lider",
    coordinador: "Coordinador"
  };
  const label = labels[normalizedKey] || canonicalValue;

  return options.uppercase ? label.toUpperCase() : label;
}

function renderPersonTypePill_(value) {
  const normalized = normalizePersonTypeValue_(value);
  const normalizedKey = getPersonTypeKey_(normalized);
  const displayLabel = getPersonTypeDisplayLabel_(normalized);

  if (normalizedKey === "nuevo") {
    return `<span class="pill warning">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "prospectogp" || normalizedKey === "prospectogf") {
    return `<span class="pill dark">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "congregante") {
    return `<span class="pill success">${escapeHtml(displayLabel)}</span>`;
  }

  if (normalizedKey === "voluntarios" || normalizedKey === "servidor") {
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

    if (action === "cancel-system-confirmation") {
      closeSystemConfirmation_();
      return;
    }

    if (action === "confirm-system-action") {
      await confirmSystemAction_();
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
      if (state.currentView === "dashboard" && shouldShowDashboardLoading_()) {
        loadingMessage.textContent = "Cargando Dashboard Iglesia...";
        loadingOverlay.classList.remove("hidden");
      }
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
      scrollToSection_("welcome-new-list");
      return;
    }

    if (action === "apply-congregants-filter") {
      renderApp();
      scrollToSection_("welcome-new-list");
      return;
    }

    if (action === "clear-congregants-period") {
      state.filters.congregants.recentFrom = "";
      state.filters.congregants.recentTo = "";
      renderApp();
      scrollToSection_("welcome-new-list");
      return;
    }

    if (action === "open-dashboard-session-group") {
      state.filters.dashboard.groupId = button.dataset.groupId || "";
      if (button.dataset.sessionId) {
        state.filters.dashboard.sessionId = button.dataset.sessionId || "";
      }
      await loadDashboardLeaderDetail_({
        force: true,
        showLoading: false
      });
      renderApp();
      scrollToSection_("dashboard-group-focus");
      return;
    }

    if (action === "open-dashboard-group-session-detail") {
      state.filters.dashboard.groupId = button.dataset.groupId || "";
      state.filters.dashboard.sessionId = button.dataset.sessionId || "";
      await loadDashboardLeaderDetail_({
        force: true,
        showLoading: false
      });
      renderApp();
      scrollToSection_("dashboard-group-detail");
      focusDashboardSessionColumn_(state.filters.dashboard.sessionId);
      return;
    }

    if (action === "refresh-app") {
      await bootstrapApplication();
      return;
    }

    if (action === "refresh-dashboard-executive") {
      await ensureDashboardViewData_({
        force: true,
        message: "Actualizando Dashboard Iglesia..."
      });
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
        showLoading: false
      });
      renderApp();
      scrollToSection_("dashboard-group-focus");
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
      scrollToSection_("dashboard-group-focus");
      return;
    }

    if (action === "refresh-assistants") {
      await withLoading(async () => {
        await refreshPeopleSources_();
        invalidateWelcomeCache_();
      }, "Actualizando padron...");
      renderApp();
      return;
    }

    if (action === "refresh-welcome") {
      await Promise.all([
        loadWelcomePeople_({
          force: true,
          showLoading: false
        }),
        state.ui.selectedWelcomePersonId
          ? loadWelcomeProfile_(state.ui.selectedWelcomePersonId, {
            force: true,
            showLoading: false
          })
          : Promise.resolve()
      ]);
      renderApp();
      return;
    }

    if (action === "open-welcome-profile") {
      await loadWelcomeProfile_(button.dataset.personId || "", {
        force: true,
        showLoading: false
      });

      if (state.currentView === "congregants-new") {
        state.currentView = "welcome-followup";
      }

      renderApp();
      scrollToSection_(state.currentView === "welcome-prospects" ? "welcome-prospect-profile" : "welcome-profile");
      return;
    }

    if (action === "send-welcome-prospect") {
      const personId = String(button.dataset.personId || "");
      const person = state.welcomePeople.find((row) => String(row.id) === personId);

      if (!personId || !person) {
        showToast("Prospecto no disponible", "Recarga la ficha de Bienvenida e intenta de nuevo.", "warning");
        return;
      }

      if (!person.suggestedGroupId) {
        showToast("Falta grupo sugerido", "Antes de avisar al líder asigna un grupo de conexión sugerido.", "warning");
        return;
      }

      await saveWelcomePerson_({
        personId,
        status: "PROSPECTO GP",
        suggestedGroupId: person.suggestedGroupId,
        nextFollowUpDate: person.nextFollowUpDate,
        notes: person.lastFollowupNotes || person.notasBienvenida || ""
      }, {
        openLeaderWhatsapp: true,
        loadingMessage: "Preparando prospecto para el líder...",
        successTitle: "Prospecto preparado",
        successMessage: "El caso quedó como PROSPECTO GP y se preparó el WhatsApp del líder."
      });
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
        await loadActiveSession();
        invalidateDashboardSeasonMatrix_();
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
      const personId = String(button.dataset.personId || "");
      const assignmentState = getParticipantSeasonAssignmentState_(personId, state.filters.participants.groupId, getParticipantPersonIdSet_());

      if (assignmentState.blockedByOtherGroup) {
        showToast("Asignacion no permitida", buildParticipantConflictToastCopy_(assignmentState.seasonAssignment), "warning");
        return;
      }

      toggleBulkSelection(personId, true);
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
        invalidateWelcomeCache_();
        await loadParticipantsData({
          force: true,
          showLoading: false
        });
      }, "Moviendo participante...");

      showToast("Participante movido", "El cambio de grupo ya se reflejo en toda la temporada.", "success");
      renderApp();
      return;
    }

    if (action === "deactivate-participant") {
      const participantId = button.dataset.participantId;
      const participant = state.participants.find((item) => String(item.id) === String(participantId));

      openSystemConfirmation_({
        kind: "deactivate-participant",
        title: "Confirmar baja del participante",
        copy: `Daras de baja a ${participant?.name || "este participante"} en todas las sesiones activas de la temporada.`,
        badge: "Toda la temporada",
        confirmLabel: "Dar de baja",
        tone: "danger",
        notes: [
          participant?.name || "Participante seleccionado",
          resolveSeasonName_(state.filters.participants.seasonId) || state.filters.participants.seasonId,
          resolveGroupName_(state.filters.participants.groupId) || state.filters.participants.groupId
        ],
        payload: {
          participantId
        }
      });
      return;
    }

    if (action === "load-attendance") {
      if (state.filters.attendance.scope !== "selected") {
        await loadActiveSession();
      }
      await loadAttendanceData({
        force: true
      });
      renderApp();
      return;
    }

    if (action === "activate-attendance-today") {
      state.filters.attendance.scope = "today";
      state.filters.attendance.groupId = "";
      state.filters.attendance.search = "";
      await loadActiveSession();
      await loadAttendanceData({
        force: true
      });
      showToast("Sesion de hoy activada", "La captura manual vuelve a trabajar con la sesion activa del dia. Ahora elige el grupo.", "success");
      renderApp();
      scrollToSection_("attendance-context");
      return;
    }

    if (action === "activate-attendance-selection") {
      const attendanceFilter = state.filters.attendance;
      const seasonId = String(attendanceFilter.pickerSeasonId || "");
      const sessionId = String(attendanceFilter.pickerSessionId || "");
      const session = getSessions(seasonId).find((item) => String(item.id) === sessionId) || null;

      if (!seasonId || !sessionId || !session) {
        showToast("Sesion pendiente", "Selecciona la temporada y la sesion que quieres usar antes de activarla.", "warning");
        return;
      }

      if (String(session.status || "").toUpperCase() === "SUSPENDIDA") {
        showToast("Sesion suspendida", "Esta sesion esta suspendida y no permite registrar asistencia.", "warning");
        return;
      }

      attendanceFilter.scope = "selected";
      attendanceFilter.seasonId = seasonId;
      attendanceFilter.sessionId = sessionId;
      attendanceFilter.groupId = "";
      attendanceFilter.search = "";
      await loadAttendanceData({
        force: true
      });
      showToast("Sesion activada", `Ahora la captura manual trabajara con ${session.name}. Elige el grupo para registrar asistencia.`, "success");
      renderApp();
      scrollToSection_("attendance-context");
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

    if (action === "refresh-formation") {
      await ensureFormationViewData_({
        force: true,
        message: "Actualizando proceso de formación..."
      });
      if (state.ui.selectedFormationPersonId) {
        await loadFormationProfile_(state.ui.selectedFormationPersonId, {
          force: true,
          showLoading: false
        });
      }
      renderApp();
      return;
    }

    if (action === "select-formation-person") {
      state.ui.selectedFormationPersonId = String(button.dataset.personId || "");
      state.ui.editingFormationRecordId = "";
      await loadFormationProfile_(state.ui.selectedFormationPersonId, {
        force: true,
        showLoading: false
      });
      renderApp();
      scrollToSection_("formation-profile");
      return;
    }

    if (action === "open-formation-profile") {
      state.ui.selectedFormationPersonId = String(button.dataset.personId || "");
      await loadFormationProfile_(state.ui.selectedFormationPersonId, {
        force: true,
        showLoading: false
      });
      renderApp();
      scrollToSection_("formation-profile");
      return;
    }

    if (action === "edit-formation-level") {
      state.ui.editingFormationLevelId = String(button.dataset.levelId || "");
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "clear-formation-level-form") {
      state.ui.editingFormationLevelId = "";
      renderApp();
      return;
    }

    if (action === "edit-formation-record") {
      state.ui.editingFormationRecordId = String(button.dataset.recordId || "");
      state.ui.selectedFormationPersonId = String(button.dataset.personId || "");
      await loadFormationProfile_(state.ui.selectedFormationPersonId, {
        force: true,
        showLoading: false
      });
      renderApp();
      scrollViewportToTop_();
      return;
    }

    if (action === "clear-formation-record-form") {
      state.ui.editingFormationRecordId = "";
      renderApp();
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

    if (form.id === "session-create-single-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        await apiPost("sessions.createSingle", payload);
        delete state.sessionsBySeason[payload.seasonId];
        await refreshSeasons();
        invalidateDashboardSeasonMatrix_();
        await ensureSessionsForSeason(payload.seasonId);
        await loadActiveSession();
        await syncAllFilters();
      }, "Agregando sesion...");

      showToast("Sesion agregada", "La sesion nueva ya tiene grupos y heredo a los asistentes activos del grupo en esta temporada.", "success");
      form.reset();
      renderApp();
      return;
    }

    if (form.id === "assistant-create-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveAssistant(payload);
      form.reset();
      renderApp();
      if (state.currentView === "congregants-new") {
        scrollToSection_("welcome-new-list");
      }
      return;
    }

    if (form.id === "welcome-person-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveWelcomePerson_(payload);
      return;
    }

    if (form.id === "welcome-prospect-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveWelcomePerson_(payload, {
        openLeaderWhatsapp: true,
        loadingMessage: "Preparando prospecto para el líder...",
        successTitle: "Prospecto preparado",
        successMessage: "El caso quedó como PROSPECTO GP y se preparó el WhatsApp del líder."
      });
      return;
    }

    if (form.id === "welcome-followup-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveWelcomeFollowup_(payload);
      form.reset();
      renderApp();
      return;
    }

    if (form.id === "catalog-group-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        await apiPost("catalog.groups.save", payload);
        await loadGroupsCatalog_({
          force: true
        });
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
        await loadMinistriesCatalog_({
          force: true
        });
      }, payload.id ? "Actualizando ministerio..." : "Creando ministerio...");

      state.ui.editingMinistryId = "";
      showToast("Catalogo actualizado", "El ministerio quedo guardado correctamente.", "success");
      renderApp();
      return;
    }

    if (form.id === "formation-level-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveFormationLevel_(payload);
      form.reset();
      renderApp();
      return;
    }

    if (form.id === "formation-record-form") {
      const payload = Object.fromEntries(new FormData(form).entries());
      await saveFormationRecord_(payload);
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

    if (target.id === "welcome-status") {
      state.filters.welcome.status = target.value;
      renderApp();
      return;
    }

    if (target.id === "welcome-group") {
      state.filters.welcome.groupId = target.value;
      renderApp();
      return;
    }

    if (target.id === "dashboard-season") {
      state.filters.dashboard.seasonId = target.value;
      state.filters.dashboard.sessionId = "";
      state.filters.dashboard.groupId = "";
      state.dashboardExecutive = null;
      state.dashboardLeaderDetail = null;
      invalidateDashboardSeasonMatrix_();
      await ensureDashboardViewData_({
        force: true,
        message: "Cargando Dashboard Iglesia..."
      });
      renderApp();
      return;
    }

    if (target.id === "dashboard-group") {
      state.filters.dashboard.groupId = target.value;
      state.dashboardLeaderDetail = null;
      renderApp();
      if (target.value) {
        scrollToSection_("dashboard-group-summary");
      }
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
      await loadParticipantsData({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "participants-session") {
      state.filters.participants.sessionId = target.value;
      state.filters.participants.moveTargets = {};
      await syncFilterState("participants");
      await loadParticipantsData({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "participants-group") {
      state.filters.participants.groupId = target.value;
      state.filters.participants.moveTargets = {};
      await loadParticipantsData({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "attendance-season") {
      state.filters.attendance.pickerSeasonId = target.value;
      state.filters.attendance.pickerSessionId = "";
      if (target.value) {
        await ensureSessionsForSeason(target.value);
      }
      renderApp();
      return;
    }

    if (target.id === "attendance-session") {
      state.filters.attendance.pickerSessionId = target.value;
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

    if (target.id === "formation-season") {
      state.filters.formation.seasonId = target.value;
      state.ui.editingFormationRecordId = "";
      state.formationProfile = null;
      await ensureFormationViewData_({
        force: true,
        showLoading: false
      });
      if (state.ui.selectedFormationPersonId) {
        await loadFormationProfile_(state.ui.selectedFormationPersonId, {
          force: true,
          showLoading: false
        });
      }
      renderApp();
      return;
    }

    if (target.id === "formation-group") {
      state.filters.formation.groupId = target.value;
      await loadFormationData_({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "formation-level-filter") {
      state.filters.formation.levelId = target.value;
      await loadFormationData_({
        force: true,
        showLoading: false
      });
      renderApp();
      return;
    }

    if (target.id === "formation-status-filter") {
      state.filters.formation.status = target.value;
      await loadFormationData_({
        force: true,
        showLoading: false
      });
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

  if (target.id === "welcome-search") {
    state.filters.welcome.search = target.value;
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

  if (target.id === "formation-search") {
    state.filters.formation.search = target.value;
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
    await loadCurrentViewData({
      showLoading: false,
      force: options.force
    });
  };

  if (options.showLoading === false) {
    await task();
  } else {
    await withLoading(
      task,
      options.message || (state.currentView === "dashboard" ? "Cargando Dashboard Iglesia..." : "Preparando dashboard...")
    );
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
      await ensureAssistantsViewData_(options);
      return;
    case "congregants-new":
    case "welcome-followup":
    case "welcome-prospects":
      await ensureWelcomeViewData_(options);
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
    case "formation":
      await ensureFormationViewData_(options);
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
  state.filters.formation.seasonId = ensureValidSeasonId(state.filters.formation.seasonId);
}

async function loadCatalogs(options = {}) {
  await loadGroupsCatalog_(options);

  if (options.includeMinistries) {
    await loadMinistriesCatalog_(options);
  }
}

async function loadGroupsCatalog_(options = {}) {
  if (!options.force && state.loaded.groups) {
    return state.catalogs.groups;
  }

  const task = async () => {
    state.catalogs.groups = await apiGet("catalog.groups.list");
    state.loaded.groups = true;
    return state.catalogs.groups;
  };

  if (options.force) {
    return task();
  }

  return runSharedLoad_("groups", task);
}

async function loadMinistriesCatalog_(options = {}) {
  if (!options.force && state.loaded.ministries) {
    return state.catalogs.ministries;
  }

  const task = async () => {
    state.catalogs.ministries = await apiGet("catalog.ministries.list");
    state.loaded.ministries = true;
    return state.catalogs.ministries;
  };

  if (options.force) {
    return task();
  }

  return runSharedLoad_("ministries", task);
}

async function refreshSeasons() {
  return runSharedLoad_("seasons", async () => {
    state.seasons = await apiGet("seasons.list");
    state.loaded.seasons = true;
    return state.seasons;
  });
}

async function loadPeople(options = {}) {
  if (!options.force && state.loaded.people) {
    return state.people;
  }

  const task = async () => {
    state.people = await apiGet("people.list");
    state.metrics.peopleCount = state.people.length;
    state.loaded.people = true;
    return state.people;
  };

  if (options.force) {
    return task();
  }

  return runSharedLoad_("people", task);
}

async function loadPeopleDirectory(options = {}) {
  if (!options.force && state.loaded.peopleDirectory) {
    return state.peopleDirectory;
  }

  const task = async () => {
    state.peopleDirectory = await apiGet("servers.list");
    state.metrics.directoryCount = state.peopleDirectory.length;
    state.loaded.peopleDirectory = true;
    return state.peopleDirectory;
  };

  if (options.force) {
    return task();
  }

  return runSharedLoad_("peopleDirectory", task);
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
    loadPeople({
      force: true
    }),
    loadPeopleDirectory({
      force: true
    })
  ]);
}

function invalidateWelcomeCache_() {
  state.loaded.welcome = false;
  state.cacheKeys.welcomePeople = "";
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
  const loadKey = `dashboardExecutive::${seasonId || "none"}`;

  if (!options.force && state.dashboardExecutive && currentSeasonId === seasonId) {
    return state.dashboardExecutive;
  }

  const task = () => runSharedLoad_(loadKey, async () => {
    state.dashboardExecutive = await apiGet("dashboard.executive", {
      seasonId
    });
    return state.dashboardExecutive;
  });

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Calculando Dashboard Iglesia...");
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
    if (!state.dashboardSeasonMatrix || state.dashboardSeasonMatrix.seasonId !== String(seasonId)) {
      await loadDashboardSeasonMatrix_({
        force: options.force,
        showLoading: false
      });
    }

    state.dashboardLeaderDetail = state.dashboardSeasonMatrix?.groupDetailsById?.[String(groupId)] || null;

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

async function loadWelcomePeople_(options = {}) {
  const requestKey = "welcomePeople::all";

  if (!options.force && state.loaded.welcome && state.cacheKeys.welcomePeople === requestKey) {
    return state.welcomePeople;
  }

  const task = async () => {
    state.welcomePeople = await apiGet("welcome.people.list");
    state.loaded.welcome = true;
    state.cacheKeys.welcomePeople = requestKey;
    return state.welcomePeople;
  };

  if (options.force) {
    return task();
  }

  if (options.showLoading === false) {
    return runSharedLoad_("welcome", task);
  }

  return withLoading(() => runSharedLoad_("welcome", task), options.message || "Cargando seguimiento de Bienvenida...");
}

async function loadWelcomeProfile_(personId, options = {}) {
  const cleanPersonId = String(personId || "");

  if (!cleanPersonId) {
    state.welcomeProfile = null;
    state.ui.selectedWelcomePersonId = "";
    return null;
  }

  if (!options.force && state.ui.selectedWelcomePersonId === cleanPersonId && state.welcomeProfile?.person?.id === cleanPersonId) {
    return state.welcomeProfile;
  }

  const task = () => runSharedLoad_(`welcomeProfile::${cleanPersonId}`, async () => {
    state.welcomeProfile = await apiGet("welcome.person.profile", {
      personId: cleanPersonId
    });
    state.ui.selectedWelcomePersonId = cleanPersonId;
    return state.welcomeProfile;
  });

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Abriendo expediente de Bienvenida...");
}

async function loadFormationCatalog_(options = {}) {
  if (!options.force && state.loaded.formationCatalog) {
    return state.formationCatalog;
  }

  const task = () => runSharedLoad_("formationCatalog", async () => {
    state.formationCatalog = await apiGet("formation.catalog.list");
    state.loaded.formationCatalog = true;
    return state.formationCatalog;
  });

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Cargando niveles de formación...");
}

async function syncFormationFilterState_() {
  state.filters.formation.seasonId = ensureValidSeasonId(state.filters.formation.seasonId);

  if (!state.filters.formation.seasonId) {
    state.filters.formation.seasonId = getLatestSeason()?.id || "";
  }

  if (state.filters.formation.groupId && !state.catalogs.groups.some((group) => String(group.id) === String(state.filters.formation.groupId))) {
    state.filters.formation.groupId = "";
  }

  if (state.filters.formation.levelId && !state.formationCatalog.some((level) => String(level.id) === String(state.filters.formation.levelId))) {
    state.filters.formation.levelId = "";
  }
}

async function loadFormationData_(options = {}) {
  await loadFormationCatalog_({
    force: options.force,
    showLoading: false
  });
  await syncFormationFilterState_();

  const filter = state.filters.formation;
  const recordsKey = `${filter.seasonId}::${filter.groupId}::${filter.levelId}::${filter.status}`;
  const candidatesKey = `${filter.seasonId}::${filter.groupId}`;

  if (
    !options.force &&
    state.loaded.formationRecords &&
    state.loaded.formationCandidates &&
    state.cacheKeys.formationRecords === recordsKey &&
    state.cacheKeys.formationCandidates === candidatesKey
  ) {
    return;
  }

  const task = async () => {
    const [records, candidates] = await Promise.all([
      apiGet("formation.records.list", {
        seasonId: filter.seasonId,
        groupId: filter.groupId,
        levelId: filter.levelId,
        status: filter.status === "ALL" ? "" : filter.status
      }),
      apiGet("formation.candidates.list", {
        seasonId: filter.seasonId,
        groupId: filter.groupId
      })
    ]);

    state.formationRecords = records;
    state.formationCandidates = candidates;
    state.cacheKeys.formationRecords = recordsKey;
    state.cacheKeys.formationCandidates = candidatesKey;
    state.loaded.formationRecords = true;
    state.loaded.formationCandidates = true;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, options.message || "Preparando proceso de formación...");
}

async function loadFormationProfile_(personId, options = {}) {
  const cleanPersonId = String(personId || "");

  if (!cleanPersonId) {
    state.formationProfile = null;
    state.ui.selectedFormationPersonId = "";
    state.ui.editingFormationRecordId = "";
    return null;
  }

  const task = () => runSharedLoad_(`formationProfile::${cleanPersonId}`, async () => {
    state.formationProfile = await apiGet("formation.person.profile", {
      personId: cleanPersonId,
      seasonId: state.filters.formation.seasonId
    });
    state.ui.selectedFormationPersonId = cleanPersonId;
    return state.formationProfile;
  });

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Abriendo historial formativo...");
}

async function ensureWelcomeViewData_(options = {}) {
  await Promise.all([
    state.loaded.peopleDirectory ? Promise.resolve() : loadPeopleDirectory(),
    state.loaded.groups ? Promise.resolve() : loadGroupsCatalog_()
  ]);

  await loadWelcomePeople_(options);

  const currentRows = state.currentView === "congregants-new"
    ? getWelcomeNewPeople_()
    : (state.currentView === "welcome-prospects" ? getWelcomeProspectPeople_() : getFilteredWelcomePeople_());
  const currentSelectedAvailable = currentRows.some((row) => String(row.id) === String(state.ui.selectedWelcomePersonId));

  if (!currentRows.length) {
    state.welcomeProfile = null;
    state.ui.selectedWelcomePersonId = "";
    return;
  }

  if (!currentSelectedAvailable) {
    state.welcomeProfile = null;
    state.ui.selectedWelcomePersonId = "";
    return;
  }

  if (
    !state.welcomeProfile
    || String(state.welcomeProfile?.person?.id || "") !== String(state.ui.selectedWelcomePersonId)
  ) {
    await loadWelcomeProfile_(state.ui.selectedWelcomePersonId, {
      showLoading: false
    });
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

async function ensureDashboardViewData_(options = {}) {
  const task = async () => {
    syncDashboardFilterState_();

    await Promise.all([
      loadDashboardExecutive_({
        force: options.force,
        showLoading: false
      }),
      loadDashboardSeasonMatrix_({
        force: options.force,
        showLoading: false
      })
    ]);

    if (state.filters.dashboard.groupId) {
      await loadDashboardLeaderDetail_({
        force: options.force,
        showLoading: false
      });
    }
  };

  if (options.showLoading === false) {
    return task();
  }

  return withLoading(task, options.message || "Cargando Dashboard Iglesia...");
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

async function ensureFormationViewData_(options = {}) {
  await Promise.all([
    state.loaded.groups ? Promise.resolve() : loadGroupsCatalog_(),
    state.loaded.seasons ? Promise.resolve() : refreshSeasons(),
    loadFormationCatalog_({
      showLoading: false
    })
  ]);

  await loadFormationData_(options);

  if (!state.formationProfile || state.formationProfile?.person?.id !== state.ui.selectedFormationPersonId) {
    const selectedCandidate = state.formationCandidates.find((candidate) => String(candidate.personId) === String(state.ui.selectedFormationPersonId || ""))
      || state.formationCandidates[0];

    if (selectedCandidate) {
      await loadFormationProfile_(selectedCandidate.personId, {
        showLoading: false
      });
    }
  }
}

function warmDashboardExecutiveInBackground_() {
  if (!state.user || state.currentView !== "dashboard") {
    return;
  }

  if (
    state.dashboardExecutive &&
    state.dashboardSeasonMatrix &&
    String(state.dashboardExecutive?.seasonFocus?.id || "") === String(state.filters.dashboard.seasonId || "") &&
    String(state.dashboardSeasonMatrix?.seasonId || "") === String(state.filters.dashboard.seasonId || "")
  ) {
    return;
  }

  void ensureDashboardViewData_({
    showLoading: false
  })
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
  const loadKey = `dashboardSeasonMatrix::${cacheKey || "none"}`;

  if (!seasonId) {
    state.dashboardSeasonMatrix = null;
    state.cacheKeys.dashboardSeasonMatrix = "";
    return null;
  }

  if (!options.force && state.cacheKeys.dashboardSeasonMatrix === cacheKey && state.dashboardSeasonMatrix) {
    return state.dashboardSeasonMatrix;
  }

  const legacyTask = async () => {
    const sessions = await ensureSessionsForSeason(seasonId);
    const sessionGroupsList = await Promise.all(
      sessions.map((session) => ensureSessionGroupsFor(seasonId, session.id))
    );
    const [participants, attendances] = await Promise.all([
      apiGet("participants.list", {
        seasonId,
        status: "ACTIVO"
      }),
      apiGet("attendances.list", {
        seasonId
      })
    ]);
    const sessionGroupsBySession = {};
    const seasonName = resolveSeasonName_(seasonId) || sessions[0]?.seasonName || "";

    sessions.forEach((session, index) => {
      sessionGroupsBySession[String(session.id)] = sessionGroupsList[index] || [];
    });

    state.dashboardSeasonMatrix = buildDashboardSeasonMatrix_({
      seasonId,
      seasonName,
      sessions,
      sessionGroupsBySession,
      participants,
      attendances
    });
    state.cacheKeys.dashboardSeasonMatrix = cacheKey;
    return state.dashboardSeasonMatrix;
  };

  const task = () => runSharedLoad_(loadKey, async () => {
    let payload;

    if (state.backendSupport.dashboardSeasonMatrixRoute !== false) {
      try {
        payload = await apiGet("dashboard.seasonMatrix", {
          seasonId
        });
        state.backendSupport.dashboardSeasonMatrixRoute = true;
      } catch (error) {
        if (!isUnknownActionError_(error, "dashboard.seasonMatrix")) {
          throw error;
        }

        state.backendSupport.dashboardSeasonMatrixRoute = false;
      }
    }

    if (!payload) {
      return legacyTask();
    }

    state.dashboardSeasonMatrix = {
      ...payload,
      key: String(payload.key || cacheKey),
      seasonId: String(payload.seasonId || seasonId || ""),
      seasonName: payload.seasonName || resolveSeasonName_(seasonId) || ""
    };
    state.cacheKeys.dashboardSeasonMatrix = cacheKey;
    return state.dashboardSeasonMatrix;
  });

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

async function loadParticipantSeasonAssignments_(options = {}) {
  const seasonId = String(options.seasonId || state.filters.participants.seasonId || "");
  const cacheKey = seasonId;

  if (!seasonId) {
    state.participantSeasonAssignments = {};
    state.cacheKeys.participantSeasonAssignments = "";
    return;
  }

  if (!options.force && state.cacheKeys.participantSeasonAssignments === cacheKey) {
    return;
  }

  const task = async () => {
    const records = await apiGet("participants.list", {
      seasonId,
      status: "ACTIVO"
    });

    state.participantSeasonAssignments = buildParticipantSeasonAssignmentsIndex_(records);
    state.cacheKeys.participantSeasonAssignments = cacheKey;
  };

  if (options.showLoading === false) {
    await task();
    return;
  }

  await withLoading(task, options.message || "Preparando asignaciones de temporada...");
}

async function loadParticipantsData(options = {}) {
  await syncFilterState("participants");

  const filter = state.filters.participants;
  const requestKey = `${filter.seasonId}::${filter.sessionId}::${filter.groupId}`;

  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    resetParticipantInteractionState_();
    state.participants = [];
    state.participantContext = null;
    state.participantSeasonAssignments = {};
    state.cacheKeys.participants = "";
    state.cacheKeys.participantSeasonAssignments = "";
    return;
  }

  if (
    !options.force &&
    state.cacheKeys.participants === requestKey &&
    state.participantContext &&
    state.cacheKeys.participantSeasonAssignments === String(filter.seasonId || "")
  ) {
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

    await loadParticipantSeasonAssignments_({
      force: options.force,
      seasonId: filter.seasonId,
      showLoading: false
    });

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
  const isWelcomeWorkflow = payload.workflowOrigin === "welcome";
  let savedPerson = null;

  if (existing) {
    showToast(
      "Registro duplicado",
      `Ya existe ${existing.nombreCompleto || existing.nombre || "esta persona"} con el folio ${existing.numero || existing.id}.`,
      "warning"
    );
    return;
  }

  await withLoading(async () => {
    savedPerson = await apiPost("servers.save", payload);
    await refreshPeopleSources_();
    invalidateWelcomeCache_();

    if (isWelcomeWorkflow) {
      ensureCongregantsFilterIncludesDate_(savedPerson?.fechaIngreso || payload.fechaIngreso);
      await loadWelcomePeople_({
        force: true,
        showLoading: false
      });
      if (savedPerson?.id && !state.welcomePeople.some((person) => String(person.id) === String(savedPerson.id))) {
        upsertWelcomePersonInState_(savedPerson);
      }
      state.welcomeProfile = null;
      state.ui.selectedWelcomePersonId = "";
    }
  }, isWelcomeWorkflow ? "Registrando nuevo en Bienvenida..." : "Guardando congregante...");

  showToast(
    isWelcomeWorkflow ? "Nuevo registrado" : "Congregante guardado",
    isWelcomeWorkflow
      ? "La persona quedó dada de alta en Bienvenida con estatus NUEVO."
      : "La persona ya forma parte del padrón base del sistema.",
    "success"
  );

  return savedPerson;
}

function ensureCongregantsFilterIncludesDate_(value) {
  const normalizedDate = String(formatDateForInput_(value) || value || "").trim();

  if (!normalizedDate) {
    return;
  }

  if (!state.filters.congregants.recentFrom || normalizedDate < state.filters.congregants.recentFrom) {
    state.filters.congregants.recentFrom = normalizedDate;
  }

  if (!state.filters.congregants.recentTo || normalizedDate > state.filters.congregants.recentTo) {
    state.filters.congregants.recentTo = normalizedDate;
  }
}

function buildWelcomePersonClientDto_(person) {
  const latestSeason = getLatestSeason();
  const suggestedGroupId = String(person?.suggestedGroupId || person?.grupoSugerido || "").trim();
  const suggestedGroup = state.catalogs.groups.find((group) => String(group.id) === suggestedGroupId) || null;
  const leaderContacts = [];
  const addLeader = (name, phone) => {
    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();

    if (!cleanName && !cleanPhone) {
      return;
    }

    leaderContacts.push({
      id: "",
      name: cleanName,
      phone: cleanPhone,
      type: "LIDER"
    });
  };

  addLeader(suggestedGroup?.leader1Name, suggestedGroup?.leader1Phone);
  addLeader(suggestedGroup?.leader2Name, suggestedGroup?.leader2Phone);

  const welcomeStatus = String(
    person?.welcomeStatus
    || person?.estatusBienvenida
    || (String(person?.tipoPersona || "").toUpperCase() === "NUEVO" ? "NUEVO" : "CONGREGANTE")
  ).toUpperCase();
  const nombre = String(person?.nombre || "").trim();
  const apellidos = String(person?.apellidos || "").trim();
  const nombreCompleto = String(person?.nombreCompleto || `${nombre} ${apellidos}`.trim()).trim();

  return {
    ...person,
    nombre,
    apellidos,
    nombreCompleto,
    welcomeStatus,
    latestSeasonId: latestSeason?.id || "",
    latestSeasonName: latestSeason?.name || "",
    assignedInLatestSeason: Boolean(person?.assignedInLatestSeason),
    assignedGroupId: String(person?.assignedGroupId || "").trim(),
    assignedGroupName: String(person?.assignedGroupName || "").trim(),
    suggestedGroupId,
    suggestedGroupName: suggestedGroup?.name || String(person?.suggestedGroupName || "").trim(),
    leader: leaderContacts[0] || null,
    leaderContacts,
    leaderWhatsappUrl: String(person?.leaderWhatsappUrl || "").trim(),
    leaderWhatsappUrls: Array.isArray(person?.leaderWhatsappUrls) ? person.leaderWhatsappUrls : [],
    lastContactAt: String(person?.lastContactAt || "").trim(),
    lastActionType: String(person?.lastActionType || "").trim(),
    lastFollowupResult: String(person?.lastFollowupResult || "").trim(),
    lastFollowupNotes: String(person?.lastFollowupNotes || person?.notasBienvenida || "").trim(),
    nextFollowUpDate: String(person?.nextFollowUpDate || person?.proximoSeguimiento || "").trim(),
    followupsCount: Number(person?.followupsCount || 0),
    availableForAssignment: welcomeStatus === "PROSPECTO GP" && !person?.assignedInLatestSeason
  };
}

function upsertWelcomePersonInState_(person) {
  const nextPerson = buildWelcomePersonClientDto_(person);
  const nextId = String(nextPerson.id || "").trim();

  if (!nextId) {
    return;
  }

  state.welcomePeople = [nextPerson, ...state.welcomePeople.filter((item) => String(item.id || "") !== nextId)]
    .sort((left, right) => parseDateToTimestamp_(right.fechaIngreso, true) - parseDateToTimestamp_(left.fechaIngreso, true));
  state.loaded.welcome = true;
  state.cacheKeys.welcomePeople = "welcomePeople::all";
}

function prepareLeaderWhatsappWindow_(enabled) {
  if (!enabled) {
    return null;
  }

  try {
    return window.open("", "_blank", "noopener,noreferrer");
  } catch (error) {
    return null;
  }
}

function openLeaderWhatsappWindow_(preparedWindow, url) {
  if (!url) {
    if (preparedWindow && !preparedWindow.closed) {
      preparedWindow.close();
    }
    return false;
  }

  try {
    if (preparedWindow && !preparedWindow.closed) {
      preparedWindow.location.href = url;
      if (typeof preparedWindow.focus === "function") {
        preparedWindow.focus();
      }
      return true;
    }

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    return !!popup;
  } catch (error) {
    return false;
  }
}

function handleLeaderWhatsappAfterSave_(preparedWindow, profile, enabled) {
  if (!enabled) {
    return;
  }

  const leaderWhatsappTargets = getWelcomeLeaderWhatsappTargets_(profile?.person);
  const leaderWhatsappUrl = String((leaderWhatsappTargets[0] && leaderWhatsappTargets[0].url) || "");

  if (!leaderWhatsappUrl) {
    showToast("Sin WhatsApp del líder", "El caso se guardó, pero el grupo aún no tiene un líder con teléfono válido para abrir WhatsApp.", "warning");
    openLeaderWhatsappWindow_(preparedWindow, "");
    return;
  }

  if (!openLeaderWhatsappWindow_(preparedWindow, leaderWhatsappUrl)) {
    showToast("WhatsApp bloqueado", "El navegador bloqueó la nueva pestaña. Usa el botón de WhatsApp dentro del expediente.", "warning");
  }
}

async function saveWelcomePerson_(rawPayload, options = {}) {
  const payload = {
    personId: V(rawPayload.personId),
    status: V(rawPayload.status),
    suggestedGroupId: V(rawPayload.suggestedGroupId),
    nextFollowUpDate: V(rawPayload.nextFollowUpDate),
    notes: V(rawPayload.notes)
  };
  const shouldOpenLeaderWhatsapp = Boolean(
    options.openLeaderWhatsapp
    && String(payload.status || "").toUpperCase() === "PROSPECTO GP"
  );
  const preparedWhatsappWindow = prepareLeaderWhatsappWindow_(shouldOpenLeaderWhatsapp);

  if (!payload.personId) {
    openLeaderWhatsappWindow_(preparedWhatsappWindow, "");
    showToast("Selecciona una persona", "Abre primero un expediente de Bienvenida para poder guardarlo.", "warning");
    return;
  }

  try {
    await withLoading(async () => {
      state.welcomeProfile = await apiPost("welcome.people.update", payload);
      await refreshPeopleSources_();
      invalidateWelcomeCache_();
      await loadWelcomePeople_({
        force: true,
        showLoading: false
      });
    }, options.loadingMessage || "Guardando seguimiento de Bienvenida...");
  } catch (error) {
    openLeaderWhatsappWindow_(preparedWhatsappWindow, "");
    throw error;
  }

  state.ui.selectedWelcomePersonId = payload.personId;
  handleLeaderWhatsappAfterSave_(preparedWhatsappWindow, state.welcomeProfile, shouldOpenLeaderWhatsapp);
  showToast(
    options.successTitle || "Seguimiento guardado",
    options.successMessage || "El estatus pastoral y el grupo sugerido quedaron actualizados.",
    "success"
  );
  renderApp();
}

async function saveWelcomeFollowup_(rawPayload) {
  const payload = {
    personId: V(rawPayload.personId),
    actionDate: V(rawPayload.actionDate),
    actionType: V(rawPayload.actionType),
    result: V(rawPayload.result),
    owner: V(rawPayload.owner),
    nextFollowUpDate: V(rawPayload.nextFollowUpDate),
    status: V(rawPayload.status),
    suggestedGroupId: V(rawPayload.suggestedGroupId),
    notes: V(rawPayload.notes)
  };

  if (!payload.personId) {
    showToast("Selecciona una persona", "Abre primero un expediente de Bienvenida para registrar un evento.", "warning");
    return;
  }

  await withLoading(async () => {
    const response = await apiPost("welcome.followups.save", payload);
    state.welcomeProfile = response.profile;
    await refreshPeopleSources_();
    invalidateWelcomeCache_();
    await loadWelcomePeople_({
      force: true,
      showLoading: false
    });
  }, "Registrando evento de Bienvenida...");

  state.ui.selectedWelcomePersonId = payload.personId;
  showToast("Evento registrado", "La bitácora de seguimiento ya quedó actualizada.", "success");
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

async function saveFormationLevel_(rawPayload) {
  const payload = {
    id: V(rawPayload.id),
    name: V(rawPayload.name),
    order: V(rawPayload.order),
    status: V(rawPayload.status),
    description: V(rawPayload.description)
  };

  await withLoading(async () => {
    await apiPost("formation.catalog.save", payload);
    await loadFormationCatalog_({
      force: true,
      showLoading: false
    });
    await loadFormationData_({
      force: true,
      showLoading: false
    });
  }, payload.id ? "Actualizando nivel..." : "Creando nivel...");

  state.ui.editingFormationLevelId = "";
  showToast("Nivel guardado", "El catálogo de formación quedó actualizado.", "success");
}

async function saveFormationRecord_(rawPayload) {
  const payload = {
    id: V(rawPayload.id),
    personId: V(rawPayload.personId),
    seasonId: V(rawPayload.seasonId),
    groupId: V(rawPayload.groupId),
    levelId: V(rawPayload.levelId),
    status: V(rawPayload.status),
    requestedBy: V(rawPayload.requestedBy),
    reviewedBy: V(rawPayload.reviewedBy),
    startDate: V(rawPayload.startDate),
    endDate: V(rawPayload.endDate),
    result: V(rawPayload.result),
    reason: V(rawPayload.reason),
    notes: V(rawPayload.notes)
  };

  if (!payload.personId) {
    showToast("Selecciona una persona", "Carga primero un congregante desde la tabla de candidatos o desde el historial.", "warning");
    return;
  }

  await withLoading(async () => {
    const response = await apiPost("formation.records.save", payload);
    state.formationProfile = response.profile;
    await loadFormationData_({
      force: true,
      showLoading: false
    });
  }, payload.id ? "Actualizando caso formativo..." : "Registrando caso formativo...");

  state.ui.selectedFormationPersonId = payload.personId;
  state.ui.editingFormationRecordId = "";
  showToast("Caso guardado", "El proceso formativo quedó actualizado y ya se reflejó en el historial.", "success");
  renderApp();
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
  const assignmentState = getParticipantSeasonAssignmentState_(personId, filter.groupId, getParticipantPersonIdSet_());
  ensureContextReady(filter, "participantes");

  if (assignmentState.blockedByOtherGroup) {
    showToast(
      "Asignacion no permitida",
      buildParticipantConflictToastCopy_(assignmentState.seasonAssignment),
      "warning"
    );
    return;
  }

  try {
    await withLoading(async () => {
      createdParticipant = await apiPost("participants.add", {
        seasonId: filter.seasonId,
        sessionId: filter.sessionId,
        groupId: filter.groupId,
        personId
      });
    }, "Agregando participante...");
  } catch (error) {
    if (isParticipantSeasonConflictError_(error)) {
      showToast("Asignacion no permitida", buildParticipantConflictToastCopy_(error.details), "warning");
      return;
    }

    throw error;
  }

  invalidateDashboardSeasonMatrix_();
  invalidateWelcomeCache_();
  await loadParticipantSeasonAssignments_({
    force: true,
    seasonId: filter.seasonId,
    showLoading: false
  });
  mergeParticipantsIntoCurrentContext_([createdParticipant]);
  showToast("Participante agregado", "La persona ya fue agregada al grupo actual.", "success");
  renderApp();
  focusInputById_("participant-people-search");
}

async function bulkAssignParticipants() {
  const filter = state.filters.participants;
  const diagnostics = getSelectedBulkPeopleDiagnostics_();
  const selectedPeople = diagnostics.selectedPeople;
  const seasonName = resolveSeasonName_(filter.seasonId) || filter.seasonId;
  const groupName = state.participantContext ? state.participantContext.group.name : (resolveGroupName_(filter.groupId) || filter.groupId);
  const sessionCount = getSessions(filter.seasonId).length;
  ensureContextReady(filter, "asignacion masiva");

  if (!selectedPeople.length) {
    showToast("Sin seleccion", "Selecciona al menos una persona para la asignacion masiva.", "warning");
    return;
  }

  if (diagnostics.blockedPeople.length) {
    showToast(
      "Hay conflictos en el lote",
      buildParticipantConflictToastCopy_({
        conflicts: diagnostics.blockedPeople.map((person) => {
          const seasonAssignment = getParticipantSeasonAssignment_(person.id);
          return {
            personId: person.id,
            personName: person.name,
            existingGroupId: seasonAssignment?.groupId || "",
            existingGroupName: seasonAssignment?.groupName || ""
          };
        })
      }),
      "warning"
    );
    return;
  }

  openSystemConfirmation_({
    kind: "bulk-assign",
    title: "Confirmar asignacion masiva",
    copy: `Asignaras ${selectedPeople.length} persona(s) al grupo ${groupName} en las ${sessionCount} sesiones de ${seasonName}.`,
    badge: "Toda la temporada",
    confirmLabel: "Asignar ahora",
    notes: [
      `${selectedPeople.length} personas en el lote`,
      `${sessionCount} sesiones del ciclo`,
      `${groupName} como grupo unico en la temporada`
    ]
  });
}

async function executeBulkAssign_() {
  const filter = state.filters.participants;
  const diagnostics = getSelectedBulkPeopleDiagnostics_();
  const selectedPeople = diagnostics.selectedPeople;
  const sessionCount = getSessions(filter.seasonId).length;
  let assignmentResult = null;

  if (!selectedPeople.length) {
    showToast("Sin seleccion", "El lote actual ya no tiene personas para asignar.", "warning");
    return;
  }

  try {
    await withLoading(async () => {
      assignmentResult = await apiPost("participants.bulkAssign", {
        seasonId: filter.seasonId,
        groupId: filter.groupId,
        people: state.selectedBulkPeople.map((personId) => ({ personId }))
      });
      state.selectedBulkPeople = [];
    }, "Asignando participantes...");
  } catch (error) {
    if (isParticipantSeasonConflictError_(error)) {
      await loadParticipantSeasonAssignments_({
        force: true,
        seasonId: filter.seasonId,
        showLoading: false
      });
      showToast("Asignacion no permitida", buildParticipantConflictToastCopy_(error.details), "warning");
      renderApp();
      return;
    }

    throw error;
  }

  invalidateDashboardSeasonMatrix_();
  invalidateWelcomeCache_();
  await loadParticipantSeasonAssignments_({
    force: true,
    seasonId: filter.seasonId,
    showLoading: false
  });
  mergeParticipantsIntoCurrentContext_((assignmentResult && assignmentResult.inserted) || []);
  showToast(
    "Asignacion completada",
    `Se asignaron ${assignmentResult?.totalPeople || selectedPeople.length} persona(s) a ${sessionCount} sesion(es). En esta sesion quedaron ${state.participants.length} participantes activos.`,
    "success"
  );
  renderApp();
  focusInputById_("participant-bulk-search");
}

async function executeDeactivateParticipant_(participantId) {
  await withLoading(async () => {
    await apiPost("participants.deactivate", {
      participantId
    });
    delete state.filters.participants.moveTargets[participantId];
    invalidateDashboardSeasonMatrix_();
    invalidateWelcomeCache_();
    await loadParticipantsData({
      force: true,
      showLoading: false
    });
  }, "Dando de baja participante...");

  showToast("Participante dado de baja", "La baja se reflejo en toda la temporada.", "success");
  renderApp();
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
  let pickerSeasonId = ensureValidSeasonId(filter.pickerSeasonId || filter.seasonId || activeSession?.seasonId || "");

  if (!pickerSeasonId && state.seasons.length) {
    pickerSeasonId = getLatestSeason()?.id || "";
  }

  filter.pickerSeasonId = pickerSeasonId;

  if (pickerSeasonId) {
    await ensureSessionsForSeason(pickerSeasonId);

    const pickerSessions = getSessions(pickerSeasonId);
    if (!pickerSessions.some((item) => item.id === filter.pickerSessionId)) {
      if (
        filter.scope === "selected" &&
        String(filter.seasonId) === String(pickerSeasonId) &&
        pickerSessions.some((item) => item.id === filter.sessionId)
      ) {
        filter.pickerSessionId = filter.sessionId;
      } else {
        filter.pickerSessionId = pickerSessions[pickerSessions.length - 1]?.id || pickerSessions[0]?.id || "";
      }
    }
  } else {
    filter.pickerSessionId = "";
  }

  if (filter.scope === "selected") {
    filter.seasonId = ensureValidSeasonId(filter.seasonId);

    if (!filter.seasonId) {
      filter.sessionId = "";
      filter.groupId = "";
      return;
    }

    await ensureSessionsForSeason(filter.seasonId);

    const selectedSessions = getSessions(filter.seasonId);
    if (!selectedSessions.some((item) => item.id === filter.sessionId)) {
      filter.sessionId = "";
      filter.groupId = "";
      return;
    }

    const selectedGroups = await ensureSessionGroupsFor(filter.seasonId, filter.sessionId);
    if (!selectedGroups.some((item) => String(item.groupId) === String(filter.groupId))) {
      filter.groupId = "";
    }

    return;
  }

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

function buildParticipantSeasonAssignmentsIndex_(records) {
  const index = {};

  (Array.isArray(records) ? records : []).forEach((record) => {
    const personId = String(record.personId || "");
    const groupId = String(record.groupId || "");

    if (!personId) {
      return;
    }

    if (!index[personId]) {
      index[personId] = {
        personId,
        name: record.name || "",
        groupIds: [],
        groupNames: [],
        sessionIds: []
      };
    }

    if (groupId && !index[personId].groupIds.includes(groupId)) {
      index[personId].groupIds.push(groupId);
      index[personId].groupNames.push(resolveGroupName_(groupId) || groupId);
    }

    if (record.sessionId && !index[personId].sessionIds.includes(String(record.sessionId))) {
      index[personId].sessionIds.push(String(record.sessionId));
    }
  });

  Object.keys(index).forEach((personId) => {
    const entry = index[personId];
    entry.groupId = entry.groupIds[0] || "";
    entry.groupName = entry.groupNames[0] || "";
    entry.hasMultipleGroups = entry.groupIds.length > 1;
  });

  return index;
}

function getParticipantSeasonAssignment_(personId) {
  return state.participantSeasonAssignments[String(personId)] || null;
}

function getParticipantSeasonAssignmentState_(personId, currentGroupId, currentSessionPersonIds) {
  const normalizedPersonId = String(personId || "");
  const normalizedGroupId = String(currentGroupId || "");
  const currentSessionAssigned = currentSessionPersonIds.has(normalizedPersonId);
  const seasonAssignment = getParticipantSeasonAssignment_(normalizedPersonId);
  const seasonHasAssignment = Boolean(seasonAssignment && seasonAssignment.groupIds.length);
  const assignedToCurrentGroupOnly = Boolean(
    seasonAssignment &&
    !seasonAssignment.hasMultipleGroups &&
    seasonAssignment.groupIds.includes(normalizedGroupId)
  );
  const blockedByOtherGroup = Boolean(
    seasonAssignment &&
    (seasonAssignment.hasMultipleGroups || !assignedToCurrentGroupOnly)
  );

  return {
    seasonAssignment,
    currentSessionAssigned,
    seasonHasAssignment,
    assignedToCurrentGroupOnly,
    blockedByOtherGroup
  };
}

function getSelectedBulkPeople_() {
  const selectedMap = new Map(state.people.map((person) => [String(person.id), person]));

  return state.selectedBulkPeople
    .map((personId) => selectedMap.get(String(personId)) || null)
    .filter(Boolean);
}

function getSelectedBulkPeopleDiagnostics_() {
  const selectedPeople = getSelectedBulkPeople_();
  const currentGroupId = state.filters.participants.groupId;
  const currentSessionPersonIds = getParticipantPersonIdSet_();
  const blockedPeople = selectedPeople.filter((person) => (
    getParticipantSeasonAssignmentState_(person.id, currentGroupId, currentSessionPersonIds).blockedByOtherGroup
  ));
  const eligiblePeople = selectedPeople.filter((person) => (
    !getParticipantSeasonAssignmentState_(person.id, currentGroupId, currentSessionPersonIds).blockedByOtherGroup
  ));

  return {
    selectedPeople,
    blockedPeople,
    eligiblePeople
  };
}

function isParticipantSeasonConflictError_(error) {
  return error instanceof ApiError && error.code === "PARTICIPANT_SEASON_GROUP_CONFLICT";
}

function buildParticipantConflictToastCopy_(details) {
  if (!details) {
    return "La persona ya pertenece a otro grupo de conexion dentro de esta temporada.";
  }

  if (Array.isArray(details.conflicts) && details.conflicts.length) {
    const preview = details.conflicts
      .slice(0, 3)
      .map((conflict) => `${conflict.personName || conflict.personId} -> ${conflict.existingGroupName || conflict.existingGroupId}`)
      .join(", ");
    const remaining = details.conflicts.length > 3 ? ` y ${details.conflicts.length - 3} mas` : "";
    return `Hay personas que ya pertenecen a otro grupo: ${preview}${remaining}.`;
  }

  const personName = details.personName || details.name || details.personId || "La persona seleccionada";
  const groupName = details.existingGroupName || details.groupName || details.existingGroupId || details.groupId || "otro grupo";
  return `${personName} ya pertenece a ${groupName} dentro de esta temporada.`;
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

    if (["nuevo", "prospectogp", "congregante", "prospectogf"].includes(typeKey)) {
      summary.congregants += 1;
    }

    if (typeKey === "voluntarios" || typeKey === "servidor") {
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

function matchesWelcomePeriod_(person) {
  const fromTimestamp = parseDateToTimestamp_(state.filters.congregants.recentFrom, false);
  const toTimestamp = parseDateToTimestamp_(state.filters.congregants.recentTo, true);
  const joinedAtTimestamp = parseDateToTimestamp_(person.fechaIngreso, true);

  if (!joinedAtTimestamp) {
    return false;
  }

  if (fromTimestamp && joinedAtTimestamp < fromTimestamp) {
    return false;
  }

  if (toTimestamp && joinedAtTimestamp > toTimestamp) {
    return false;
  }

  return true;
}

function getWelcomeNewPeople_() {
  return state.welcomePeople.filter((person) => {
    const status = String(person.welcomeStatus || "").toUpperCase();
    return status === "NUEVO" && matchesWelcomePeriod_(person);
  });
}

function getWelcomeFollowupPeople_() {
  const search = normalizeText(state.filters.welcome.search);
  const requestedStatus = String(state.filters.welcome.status || "ALL").toUpperCase();
  const groupId = String(state.filters.welcome.groupId || "");

  return state.welcomePeople.filter((person) => {
    const status = String(person.welcomeStatus || "").toUpperCase();
    const haystack = normalizeText([
      person.id,
      person.numero,
      person.nombreCompleto || [person.nombre, person.apellidos].join(" "),
      person.telefono,
      person.email,
      person.suggestedGroupName,
      person.assignedGroupName,
      person.leader?.name
    ].join(" "));
    const isWelcomeTracked = status === "NUEVO" || status === "PROSPECTO GP";
    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = requestedStatus === "ALL" ? isWelcomeTracked : status === requestedStatus;
    const matchesGroup = !groupId
      || String(person.suggestedGroupId || "") === groupId
      || String(person.assignedGroupId || "") === groupId;

    return isWelcomeTracked && matchesSearch && matchesStatus && matchesGroup;
  });
}

function getFilteredWelcomePeople_() {
  const search = normalizeText(state.filters.welcome.search);
  const status = String(state.filters.welcome.status || "ALL").toUpperCase();
  const groupId = String(state.filters.welcome.groupId || "");

  return state.welcomePeople.filter((person) => {
    const haystack = normalizeText([
      person.id,
      person.numero,
      person.nombreCompleto || [person.nombre, person.apellidos].join(" "),
      person.telefono,
      person.email,
      person.suggestedGroupName,
      person.assignedGroupName,
      person.leader?.name
    ].join(" "));
    const matchesSearch = !search || haystack.includes(search);
    const matchesStatus = status === "ALL" || String(person.welcomeStatus || "").toUpperCase() === status;
    const matchesGroup = !groupId
      || String(person.suggestedGroupId || "") === groupId
      || String(person.assignedGroupId || "") === groupId;

    return matchesSearch && matchesStatus && matchesGroup;
  });
}

function getWelcomeFollowupHealth_(person) {
  const followupsCount = Number(person?.followupsCount || 0);
  const nextContactDate = String(formatDateForInput_(person?.nextFollowUpDate) || "");
  const today = formatDateForInput_(new Date());

  if (!followupsCount) {
    return {
      label: "Sin seguimiento",
      tone: "danger",
      overdue: true
    };
  }

  if (!nextContactDate) {
    return {
      label: "Sin proximo contacto",
      tone: "danger",
      overdue: true
    };
  }

  if (nextContactDate < today) {
    return {
      label: "Seguimiento vencido",
      tone: "danger",
      overdue: true
    };
  }

  return {
    label: "En tiempo",
    tone: "success",
    overdue: false
  };
}

function renderWelcomeFollowupHealthPill_(person) {
  const health = getWelcomeFollowupHealth_(person);
  return `<span class="pill ${health.tone === "danger" ? "danger" : "success"}">${escapeHtml(health.label)}</span>`;
}

function getWelcomeLeaderWhatsappTargets_(person) {
  const targets = Array.isArray(person?.leaderWhatsappUrls)
    ? person.leaderWhatsappUrls
        .filter((item) => item && item.url)
        .map((item, index) => ({
          name: String(item.name || person?.leaderContacts?.[index]?.name || `Lider ${index + 1}`),
          phone: String(item.phone || person?.leaderContacts?.[index]?.phone || ""),
          url: String(item.url || "")
        }))
    : [];

  if (targets.length) {
    return targets;
  }

  const fallbackUrl = String(person?.leaderWhatsappUrl || "").trim();

  if (!fallbackUrl) {
    return [];
  }

  return [{
    name: String(person?.leader?.name || person?.leaderContacts?.[0]?.name || "Lider principal"),
    phone: String(person?.leader?.phone || person?.leaderContacts?.[0]?.phone || ""),
    url: fallbackUrl
  }];
}

function getWelcomeLeaderContactSummary_(person) {
  const labels = (Array.isArray(person?.leaderContacts) ? person.leaderContacts : [])
    .map((contact) => {
      const name = String(contact?.name || "").trim();
      const phone = String(contact?.phone || "").trim();

      if (name && phone) {
        return `${name} · ${phone}`;
      }

      return name || phone || "";
    })
    .filter(Boolean);

  if (labels.length) {
    return labels.join(" / ");
  }

  const fallbackName = String(person?.leader?.name || "").trim();
  const fallbackPhone = String(person?.leader?.phone || "").trim();

  if (fallbackName && fallbackPhone) {
    return `${fallbackName} · ${fallbackPhone}`;
  }

  return fallbackName || fallbackPhone || "Sin lider asignado";
}

function hasWelcomeLeaderContact_(person) {
  return getWelcomeLeaderContactSummary_(person) !== "Sin lider asignado";
}

function renderWelcomeLeaderWhatsappButtons_(person, options = {}) {
  const targets = getWelcomeLeaderWhatsappTargets_(person);
  const variant = options.variant || "btn btn-secondary";
  const emptyLabel = options.emptyLabel || "Sin WhatsApp líder";

  if (!targets.length) {
    return options.showDisabled === false
      ? ""
      : `<button class="${variant}" type="button" disabled>${escapeHtml(emptyLabel)}</button>`;
  }

  return targets.map((target, index) => `
    <a class="${variant}" href="${escapeHtml(target.url)}" target="_blank" rel="noreferrer">
      ${escapeHtml(targets.length === 1 ? "Preparar WhatsApp líder" : `WhatsApp ${target.name || `Lider ${index + 1}`}`)}
    </a>
  `).join("");
}

function getWelcomeProspectPeople_() {
  const search = normalizeText(state.filters.welcome.search);
  const groupId = String(state.filters.welcome.groupId || "");

  return state.welcomePeople.filter((person) => {
    const status = String(person.welcomeStatus || "").toUpperCase();
    const haystack = normalizeText([
      person.id,
      person.numero,
      person.nombreCompleto || [person.nombre, person.apellidos].join(" "),
      person.telefono,
      person.email,
      person.suggestedGroupName,
      person.assignedGroupName,
      person.leader?.name
    ].join(" "));
    const matchesSearch = !search || haystack.includes(search);
    const matchesGroup = !groupId
      || String(person.suggestedGroupId || "") === groupId
      || String(person.assignedGroupId || "") === groupId;

    return !person.assignedInLatestSeason
      && (status === "NUEVO" || status === "PROSPECTO GP")
      && matchesSearch
      && matchesGroup;
  });
}

function buildWelcomeSummary_() {
  const summary = {
    total: state.welcomePeople.length,
    newPeople: 0,
    prospects: 0,
    congregants: 0,
    followupDue: 0,
    withSuggestedGroup: 0
  };
  const today = formatDateForInput_(new Date());

  state.welcomePeople.forEach((person) => {
    const status = String(person.welcomeStatus || "").toUpperCase();

    if (status === "NUEVO") {
      summary.newPeople += 1;
    }

    if (status === "PROSPECTO GP") {
      summary.prospects += 1;
    }

    if (status === "CONGREGANTE") {
      summary.congregants += 1;
    }

    if (person.suggestedGroupId) {
      summary.withSuggestedGroup += 1;
    }

    if (getWelcomeFollowupHealth_(person).overdue) {
      summary.followupDue += 1;
    }
  });

  return summary;
}

function getFilteredFormationCandidates_() {
  const search = normalizeText(state.filters.formation.search);

  return state.formationCandidates.filter((candidate) => {
    const haystack = normalizeText([
      candidate.personId,
      candidate.personName,
      candidate.personNumber,
      candidate.groupName,
      candidate.currentLevel,
      candidate.formationStatus
    ].join(" "));

    return !search || haystack.includes(search);
  });
}

function getFilteredFormationRecords_() {
  const search = normalizeText(state.filters.formation.search);

  return state.formationRecords.filter((record) => {
    const haystack = normalizeText([
      record.personId,
      record.personName,
      record.groupName,
      record.levelName,
      record.status,
      record.result,
      record.reason
    ].join(" "));

    return !search || haystack.includes(search);
  });
}

function buildFormationSummary_() {
  const records = getFilteredFormationRecords_();
  const summary = {
    candidates: getFilteredFormationCandidates_().length,
    prospects: 0,
    accepted: 0,
    pending: 0,
    inProgress: 0,
    approved: 0
  };

  records.forEach((record) => {
    const status = String(record.status || "").toUpperCase();

    if (status === "PROSPECTO_FORMACION" || status === "PROSPECTO GF") {
      summary.prospects += 1;
      summary.pending += 1;
    }

    if (status === "ACEPTADO_FORMACION") {
      summary.accepted += 1;
      summary.pending += 1;
    }

    if (status === "EN_CURSO") {
      summary.inProgress += 1;
    }

    if (status === "ACREDITADO") {
      summary.approved += 1;
    }
  });

  return summary;
}

function renderWorkflowStatusPill_(value) {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "NUEVO") {
    return `<span class="pill warning">Nuevo</span>`;
  }

  if (normalized === "PROSPECTO" || normalized === "PROSPECTO GP" || normalized === "PROSPECTO_FORMACION" || normalized === "PROSPECTO GF") {
    return `<span class="pill dark">${escapeHtml(getWorkflowStatusLabel_(value))}</span>`;
  }

  if (normalized === "CONGREGANTE" || normalized === "ACEPTADO_FORMACION" || normalized === "EN_CURSO" || normalized === "ACREDITADO") {
    return `<span class="pill success">${escapeHtml(getWorkflowStatusLabel_(value))}</span>`;
  }

  if (normalized === "RECHAZADO_FORMACION" || normalized === "NO_ACREDITADO") {
    return `<span class="pill danger">${escapeHtml(getWorkflowStatusLabel_(value))}</span>`;
  }

  return `<span class="pill">${escapeHtml(getWorkflowStatusLabel_(value) || "Sin proceso")}</span>`;
}

function renderWorkflowResultPill_(value) {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "ASISTIO" || normalized === "CONFIRMADO") {
    return `<span class="pill success">${escapeHtml(value)}</span>`;
  }

  if (normalized === "NO_ASISTIO" || normalized === "NO_RESPONDE") {
    return `<span class="pill danger">${escapeHtml(value)}</span>`;
  }

  if (normalized === "PENDIENTE") {
    return `<span class="pill warning">${escapeHtml(value)}</span>`;
  }

  return `<span class="pill dark">${escapeHtml(value || "Sin resultado")}</span>`;
}

function getWorkflowStatusLabel_(value) {
  const normalized = String(value || "").toUpperCase();
  const labels = {
    NUEVO: "Nuevo",
    PROSPECTO: "Prospecto",
    "PROSPECTO GP": "Prospecto GP",
    CONGREGANTE: "Congregante",
    PROSPECTO_FORMACION: "Prospecto formación",
    "PROSPECTO GF": "Prospecto GF",
    ACEPTADO_FORMACION: "Aceptado formación",
    RECHAZADO_FORMACION: "Rechazado formación",
    EN_CURSO: "En curso",
    ACREDITADO: "Acreditado",
    NO_ACREDITADO: "No acreditado",
    SIN_PROCESO: "Sin proceso"
  };

  return labels[normalized] || value || "";
}

function formatDateTimeCompact_(value) {
  const date = coerceClientDate_(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sanitizeAssistantPayload_(payload) {
  const clean = {
    nombre: V(payload.nombre),
    apellidos: V(payload.apellidos),
    telefono: V(payload.telefono),
    email: V(payload.email),
    grupo: V(payload.grupo),
    fechaIngreso: V(payload.fechaIngreso) || formatDateForInput_(new Date()),
    edad: V(payload.edad),
    estadoCivil: V(payload.estadoCivil),
    fechaNacimiento: V(payload.fechaNacimiento),
    tipoPersona: normalizePersonTypeValue_(payload.tipoPersona || "Congregante"),
    estado: V(payload.estado) || "ACTIVO",
    estatusBienvenida: V(payload.estatusBienvenida),
    workflowOrigin: V(payload.workflowOrigin)
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
    return "CONGREGANTE";
  }

  if (normalized === "nuevo") {
    return "NUEVO";
  }

  if (normalized === "prospecto gp" || normalized === "prospectogp" || normalized === "prospecto") {
    return "PROSPECTO GP";
  }

  if (normalized === "prospecto gf" || normalized === "prospectogf" || normalized === "prospecto formacion" || normalized === "prospecto_formacion") {
    return "PROSPECTO GF";
  }

  if (normalized === "servidor" || normalized === "voluntario" || normalized === "voluntarios") {
    return "VOLUNTARIOS";
  }

  if (normalized === "coordinador") {
    return "COORDINADOR";
  }

  if (normalized === "lider") {
    return "LIDER";
  }

  return rawValue || "CONGREGANTE";
}

const normalizePersonTypeValueBase_ = normalizePersonTypeValue_;
normalizePersonTypeValue_ = function(value) {
  return normalizePersonTypeValueBase_(value);
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
    dashboard: "Dashboard Iglesia",
    assistants: "Congregantes",
    "congregants-new": "Nuevos congregantes",
    "welcome-followup": "Bienvenida: Seguimientos",
    "welcome-prospects": "Bienvenida: Prospectos",
    catalogs: "Catalogos",
    seasons: "Temporadas",
    participants: "Asignacion",
    attendance: "Asistencias",
    formation: "Formación",
    "admin-settings": "Configuracion",
    "admin-users": "Usuarios"
  };

  return labels[permission] || permission;
}

function getPermissionDescription_(permission) {
  const descriptions = {
    dashboard: "Indicadores, consultas y exportaciones para pastor y lideres.",
    assistants: "Padron general, altas, importacion y credenciales QR.",
    "congregants-new": "Alta inicial de nuevas personas registradas por Bienvenida.",
    "welcome-followup": "Seguimiento pastoral de nuevos congregantes y prospectos.",
    "welcome-prospects": "Ubicacion al grupo ideal y preparacion de aviso para el líder.",
    catalogs: "Catalogos de grupos y ministerios.",
    seasons: "Temporadas, sesiones y estados operativos.",
    participants: "Asignacion individual y masiva a grupos.",
    attendance: "Captura manual, QR asistido y kiosko.",
    formation: "Prospectos, validaciones, catálogo de niveles e historial formativo.",
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

function focusDashboardSessionColumn_(sessionId) {
  if (!sessionId || typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    const detailSection = document.getElementById("dashboard-group-detail");

    if (!detailSection) {
      return;
    }

    const sessionHeader = Array.from(detailSection.querySelectorAll("[data-dashboard-session-header]"))
      .find((element) => element.getAttribute("data-dashboard-session-header") === String(sessionId));

    if (!sessionHeader || typeof sessionHeader.scrollIntoView !== "function") {
      return;
    }

    sessionHeader.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
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
  state.welcomePeople = [];
  state.welcomeProfile = null;
  state.formationCatalog = [];
  state.formationRecords = [];
  state.formationCandidates = [];
  state.formationProfile = null;
  state.adminUsers = [];
  state.adminUsersSupport = {
    available: true,
    message: ""
  };
  state.backendSupport = {
    dashboardSeasonMatrixRoute: null
  };
  state.viewLoadToken = 0;
  state.cacheKeys = {
    participants: "",
    participantSeasonAssignments: "",
    attendance: "",
    attendanceDetail: "",
    qrSummary: "",
    dashboardSeasonMatrix: "",
    welcomePeople: "",
    formationRecords: "",
    formationCandidates: ""
  };
  state.loaded = {
    bootstrap: false,
    groups: false,
    ministries: false,
    seasons: false,
    people: false,
    peopleDirectory: false,
    activeSession: false,
    users: false,
    welcome: false,
    formationCatalog: false,
    formationRecords: false,
    formationCandidates: false
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
  state.participantSeasonAssignments = {};
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
    editingUserEmail: "",
    editingFormationLevelId: "",
    editingFormationRecordId: "",
    selectedWelcomePersonId: "",
    selectedFormationPersonId: "",
    confirmation: null
  };
  state.filters.assistants = {
    search: "",
    status: "ACTIVO",
    type: "ALL"
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
  state.filters.welcome = {
    search: "",
    status: "ALL",
    groupId: ""
  };
  state.filters.seasons = {
    seasonId: ""
  };
  state.filters.participants = {
    seasonId: "",
    sessionId: "",
    groupId: "",
    peopleSearch: "",
    bulkSearch: "",
    moveTargets: {}
  };
  state.filters.attendance = {
    seasonId: "",
    sessionId: "",
    groupId: "",
    search: "",
    mode: "manual",
    scope: "today",
    pickerSeasonId: "",
    pickerSessionId: ""
  };
  state.filters.qr = {
    mode: "active",
    surface: "scanner",
    seasonId: "",
    sessionId: "",
    personId: "",
    peopleSearch: "",
    cameraFacing: DEFAULT_QR_CAMERA_FACING
  };
  state.filters.formation = {
    seasonId: "",
    groupId: "",
    levelId: "",
    status: "ALL",
    search: ""
  };
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

  if (isParticipantSeasonConflictError_(error)) {
    message = buildParticipantConflictToastCopy_(error.details);
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

