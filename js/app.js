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
    title: "Dashboard",
    subtitle: "Resumen general del sistema, actividad del dia y atajos operativos."
  },
  seasons: {
    title: "Temporadas y Sesiones",
    subtitle: "Crea temporadas, revisa sesiones y controla cuales estan abiertas o cerradas."
  },
  participants: {
    title: "Participantes por Grupo",
    subtitle: "Asigna personas por grupo, mueve registros y administra participantes activos."
  },
  attendance: {
    title: "Captura de Asistencia",
    subtitle: "Registra o edita asistencias manuales por temporada, sesion y grupo."
  },
  qr: {
    title: "QR y Kiosko",
    subtitle: "Registra asistencia rapida desde lector QR o kiosko de busqueda manual."
  }
};

const state = {
  user: getStoredUser(),
  apiUrl: getStoredApiUrl(),
  currentView: getStoredUser() ? "dashboard" : "login",
  connectionStatus: null,
  catalogs: {
    groups: [],
    ministries: []
  },
  seasons: [],
  sessionsBySeason: {},
  sessionGroupsByKey: {},
  people: [],
  activeSession: null,
  participants: [],
  participantContext: null,
  attendanceContext: null,
  attendanceForm: {},
  attendanceDetail: null,
  realtimeSummary: null,
  qrLastResult: null,
  qrScanner: {
    enabled: false,
    status: "idle",
    message: "Activa la camara para comenzar el registro automatico.",
    result: null
  },
  selectedBulkPeople: [],
  filters: {
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
      groupId: ""
    },
    qr: {
      mode: "active",
      seasonId: "",
      sessionId: "",
      personId: "",
      peopleSearch: ""
    }
  }
};

const qrScannerRuntime = {
  stream: null,
  detector: null,
  animationFrameId: 0,
  busy: false,
  pausedUntil: 0,
  lastValue: "",
  lastValueAt: 0
};

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
window.addEventListener("beforeunload", () => {
  stopQrScannerRuntime_();
});

init();

async function init() {
  renderApp();

  if (state.user) {
    await bootstrapApplication();
  }
}

function renderApp() {
  if (!state.user) {
    root.innerHTML = renderLoginView();
    schedulePostRenderSync_();
    return;
  }

  const view = VIEW_META[state.currentView] || VIEW_META.dashboard;
  const apiDescriptor = describeApiUrl(state.apiUrl);
  const apiHost = describeApiHost(state.apiUrl);

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div class="sidebar-brand">
            <img src="assets/logo-fuertes.png" alt="Fuertes">
            <p>${escapeHtml(APP_CONFIG.appName)}<br>Control ministerial, asistencia y seguimiento.</p>
          </div>

          <nav class="sidebar-nav">
            ${renderNavButton("dashboard", "Resumen y actividad")}
            ${renderNavButton("seasons", "Temporadas y sesiones")}
            ${renderNavButton("participants", "Asignacion por grupo")}
            ${renderNavButton("attendance", "Captura manual")}
            ${renderNavButton("qr", "Registro rapido")}
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
          <div>
            <span class="eyebrow">Frontend V2 conectado</span>
            <h1>${escapeHtml(view.title)}</h1>
            <p>${escapeHtml(view.subtitle)}</p>
          </div>

          <div class="topbar-actions">
            <div class="topbar-meta" title="${escapeHtml(state.apiUrl)}">
              <span class="topbar-meta-label">API conectada</span>
              <strong class="topbar-meta-value">${escapeHtml(apiDescriptor)}</strong>
              <small class="topbar-meta-copy">${escapeHtml(apiHost)}</small>
            </div>
            <button class="btn btn-ghost" data-action="test-api-connection">Probar conexion</button>
          </div>
        </header>

        ${renderCurrentView()}
      </main>
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
  if (!state.user || state.currentView !== "qr") {
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
            <h1 class="login-title">Gestion moderna para congregantes y servidores</h1>
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
            <span class="metric-value">6</span>
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
            formularios mas avanzados de servidores y reportes historicos.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function renderCurrentView() {
  switch (state.currentView) {
    case "seasons":
      return renderSeasonsView();
    case "participants":
      return renderParticipantsView();
    case "attendance":
      return renderAttendanceView();
    case "qr":
      return renderQrView();
    case "dashboard":
    default:
      return renderDashboardView();
  }
}

function renderDashboardView() {
  const latestSeason = getLatestSeason();
  const latestSeasonSessions = latestSeason ? getSessions(latestSeason.id) : [];
  const activeSession = state.activeSession && state.activeSession.found ? state.activeSession.session : null;
  const apiDescriptor = describeApiUrl(state.apiUrl);

  return `
    <section class="view-grid">
      <div class="stats-grid">
        <article class="stat-card">
          <span class="status-chip neutral">Temporadas</span>
          <strong>${state.seasons.length}</strong>
          <span>Temporadas creadas en la V2</span>
        </article>

        <article class="stat-card">
          <span class="status-chip neutral">Personas</span>
          <strong>${state.people.length}</strong>
          <span>Personas activas en el padron</span>
        </article>

        <article class="stat-card">
          <span class="status-chip neutral">Grupos</span>
          <strong>${state.catalogs.groups.length}</strong>
          <span>Grupos disponibles en catalogo</span>
        </article>

        <article class="stat-card">
          <span class="status-chip ${activeSession ? "success" : "warning"}">
            ${activeSession ? "Sesion activa" : "Sin sesion abierta"}
          </span>
          <strong>${activeSession ? escapeHtml(activeSession.name) : "0"}</strong>
          <span>${activeSession ? escapeHtml(formatDate(activeSession.date)) : "Abre una sesion para usar QR automatico"}</span>
        </article>
      </div>

      <div class="view-grid columns-2">
        <article class="hero-card">
          <div class="panel-head">
            <div>
              <h2>Actividad reciente</h2>
              <p>Una vista rapida para saber por donde seguir trabajando hoy.</p>
            </div>
            ${activeSession ? `<span class="pill success">${escapeHtml(activeSession.status)}</span>` : `<span class="pill warning">Pendiente</span>`}
          </div>

          <div class="summary-strip">
            <span class="context-item"><strong>Temporada principal:</strong> ${latestSeason ? escapeHtml(latestSeason.name) : "Sin datos"}</span>
            <span class="context-item"><strong>Sesiones cargadas:</strong> ${latestSeasonSessions.length}</span>
            <span class="context-item" title="${escapeHtml(state.apiUrl)}"><strong>API base:</strong> ${escapeHtml(apiDescriptor)}</span>
          </div>

          <div class="table-wrap" style="margin-top: 18px;">
            <table>
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Sesiones</th>
                </tr>
              </thead>
              <tbody>
                ${state.seasons.length ? state.seasons.map((season) => `
                  <tr>
                    <td>
                      <span class="row-title">${escapeHtml(season.name)}</span>
                      <span class="row-meta">${escapeHtml(season.id)} | ${escapeHtml(String(season.year || ""))}</span>
                    </td>
                    <td>${renderPill(season.status)}</td>
                    <td>${escapeHtml(formatDate(season.startDate))}</td>
                    <td>${escapeHtml(String(season.sessionsCount || 0))}</td>
                  </tr>
                `).join("") : `
                  <tr>
                    <td colspan="4">
                      <div class="empty-state">Todavia no hay temporadas creadas. Puedes comenzar desde la pantalla de temporadas y sesiones.</div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Accesos rapidos</h2>
              <p>Flujo sugerido para operar el sistema sin perder tiempo.</p>
            </div>
          </div>

          <div class="quick-actions">
            ${renderQuickLink("seasons", "Crear o revisar temporadas", "Define sesiones y abre o cierra estados")}
            ${renderQuickLink("participants", "Asignar participantes", "Carga personas al grupo correcto")}
            ${renderQuickLink("attendance", "Capturar asistencia", "Guarda o edita asistencias manuales")}
            ${renderQuickLink("qr", "Usar QR o kiosko", "Registro rapido para sesiones activas")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderSeasonsView() {
  const selectedSeason = state.seasons.find((item) => item.id === state.filters.seasons.seasonId) || getLatestSeason();
  const sessions = selectedSeason ? getSessions(selectedSeason.id) : [];
  const sessionGroups = selectedSeason && sessions.length ? getSessionGroups(selectedSeason.id, sessions[0].id) : [];

  return `
    <section class="view-grid">
      <div class="view-grid columns-2">
        <article class="panel-card">
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

        <article class="summary-card">
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

      <article class="panel-card">
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

      <article class="detail-card">
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
  const peopleSearchResults = filterPeople(state.people, filter.peopleSearch).slice(0, 8);
  const bulkResults = filterPeople(state.people, filter.bulkSearch).slice(0, 12);

  return `
    <section class="view-grid">
      <article class="panel-card">
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
              <span class="context-item"><strong>Grupo:</strong> ${context ? escapeHtml(context.group.name) : "Sin cargar"}</span>
            </div>
          </div>
        </div>
      </article>

      <div class="view-grid columns-2">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Agregar participante individual</h2>
              <p>Busca una persona activa y agregala solo a esta sesion y grupo.</p>
            </div>
          </div>

          <div class="field">
            <label for="participant-people-search">Buscar persona</label>
            <input id="participant-people-search" value="${escapeHtml(filter.peopleSearch)}" placeholder="Escribe nombre, numero o correo">
          </div>

          <div class="results-list" style="margin-top: 16px;">
            ${peopleSearchResults.length ? peopleSearchResults.map((person) => `
              <article class="result-card">
                <div class="result-row">
                  <div>
                    <span class="row-title">${escapeHtml(person.name)}</span>
                    <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")} | ${escapeHtml(person.type || "")}</span>
                  </div>
                  <button class="btn btn-primary" data-action="add-person" data-person-id="${escapeHtml(person.id)}">Agregar</button>
                </div>
              </article>
            `).join("") : `
              <div class="empty-state">No hay resultados para la busqueda actual.</div>
            `}
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Asignacion masiva a toda la temporada</h2>
              <p>Selecciona varias personas y el sistema las insertara en todas las sesiones de la temporada para el grupo elegido.</p>
            </div>
            <span class="pill dark">${state.selectedBulkPeople.length} seleccionados</span>
          </div>

          <div class="field">
            <label for="participant-bulk-search">Buscar para asignacion masiva</label>
            <input id="participant-bulk-search" value="${escapeHtml(filter.bulkSearch)}" placeholder="Filtra personas por nombre o numero">
          </div>

          <div class="check-list">
            ${bulkResults.length ? bulkResults.map((person) => `
              <label class="check-item">
                <input
                  type="checkbox"
                  data-role="bulk-person-checkbox"
                  value="${escapeHtml(person.id)}"
                  ${state.selectedBulkPeople.includes(person.id) ? "checked" : ""}
                >
                <span>
                  <span class="row-title">${escapeHtml(person.name)}</span>
                  <span class="row-meta">${escapeHtml(person.id)} | ${escapeHtml(person.numero || "")}</span>
                </span>
              </label>
            `).join("") : `
              <div class="empty-state">No se encontraron personas para la busqueda actual.</div>
            `}
          </div>

          <div class="actions-row">
            <button class="btn btn-primary" data-action="bulk-assign">Asignar a toda la temporada</button>
            <button class="btn btn-ghost" data-action="clear-bulk-selection">Limpiar seleccion</button>
          </div>
        </article>
      </div>

      <article class="detail-card">
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
                    <td>${escapeHtml(participant.type)}</td>
                    <td>${renderPill(participant.status)}</td>
                    <td>
                      <select class="inline-select" id="move-target-${escapeHtml(participant.id)}" data-role="move-target" data-participant-id="${escapeHtml(participant.id)}">
                        <option value="">Selecciona grupo</option>
                        ${state.catalogs.groups.map((group) => `
                          <option value="${escapeHtml(String(group.id))}" ${String(participant.groupId) === String(group.id) ? "disabled" : ""}>
                            ${escapeHtml(group.name)}
                          </option>
                        `).join("")}
                      </select>
                    </td>
                    <td>
                      <div class="inline-actions">
                        <button class="btn btn-secondary" data-action="move-participant" data-participant-id="${escapeHtml(participant.id)}">Mover</button>
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
  const groups = getSessionGroups(filter.seasonId, filter.sessionId);
  const context = state.attendanceContext;
  const summary = buildAttendanceSummary();

  return `
    <section class="view-grid">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <h2>Contexto de captura</h2>
            <p>Cuando el grupo ya fue capturado, esta misma pantalla entra en modo de edicion.</p>
          </div>
          <button class="btn btn-secondary" data-action="load-attendance">Cargar contexto</button>
        </div>

        <div class="field-grid two">
          ${renderSeasonSelect("attendance-season", filter.seasonId)}
          ${renderSessionSelect("attendance-session", filter.seasonId, filter.sessionId)}
          ${renderGroupSelect("attendance-group", groups, filter.groupId)}
          <div class="field">
            <label>Estado actual</label>
            <div class="context-strip">
              <span class="context-item"><strong>Capturado:</strong> ${context ? (context.alreadyCaptured ? "Si" : "No") : "Pendiente"}</span>
              <span class="context-item"><strong>Participantes:</strong> ${context ? context.participants.length : 0}</span>
            </div>
          </div>
        </div>
      </article>

      <div class="view-grid columns-2">
        <article class="detail-card">
          <div class="panel-head">
            <div>
              <h2>Lista de asistencia</h2>
              <p>${context ? `${escapeHtml(context.season.name)} | ${escapeHtml(context.session.name)} | ${escapeHtml(context.group.name)}` : "Selecciona un grupo valido."}</p>
            </div>
            ${context ? `<span class="pill ${context.alreadyCaptured ? "warning" : "success"}">${context.alreadyCaptured ? "Edicion" : "Primera captura"}</span>` : ""}
          </div>

          ${context && context.participants.length ? `
            <div class="actions-row" style="margin-bottom: 16px;">
              <button class="btn btn-secondary" data-action="set-attendance-all" data-value="SI">Marcar todos SI</button>
              <button class="btn btn-ghost" data-action="set-attendance-all" data-value="NO">Marcar todos NO</button>
            </div>

            <form id="attendance-form" class="attendance-grid">
              ${context.participants.map((participant) => `
                <div class="attendance-row">
                  <div>
                    <span class="row-title">${escapeHtml(participant.name)}</span>
                    <span class="row-meta">${escapeHtml(participant.personId)} | ${escapeHtml(participant.type || "")}</span>
                  </div>
                  <div class="field">
                    <label for="attendance-${escapeHtml(participant.personId)}">Asistencia</label>
                    <select
                      id="attendance-${escapeHtml(participant.personId)}"
                      data-role="attendance-select"
                      data-person-id="${escapeHtml(participant.personId)}"
                    >
                      <option value="SI" ${state.attendanceForm[participant.personId] === "SI" ? "selected" : ""}>SI</option>
                      <option value="NO" ${state.attendanceForm[participant.personId] === "NO" ? "selected" : ""}>NO</option>
                    </select>
                  </div>
                </div>
              `).join("")}

              <div class="actions-row">
                <button class="btn btn-primary" type="submit">${context.alreadyCaptured ? "Guardar cambios" : "Guardar asistencia"}</button>
              </div>
            </form>
          ` : `
            <div class="empty-state">No hay participantes activos para capturar en este contexto.</div>
          `}
        </article>

        <article class="summary-card">
          <div class="panel-head">
            <div>
              <h2>Resumen de la captura</h2>
              <p>Se actualiza con base en lo que vayas seleccionando arriba.</p>
            </div>
          </div>

          <div class="summary-stack" id="attendance-summary">
            <div class="summary-box">
              <span class="status-chip neutral">Participantes</span>
              <strong>${summary.total}</strong>
              <span>Total cargado en el grupo actual.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip success">Asistieron</span>
              <strong>${summary.present}</strong>
              <span>Marcados actualmente como SI.</span>
            </div>
            <div class="summary-box">
              <span class="status-chip warning">No asistieron</span>
              <strong>${summary.absent}</strong>
              <span>Marcados actualmente como NO.</span>
            </div>
          </div>
        </article>
      </div>

      <article class="detail-card">
        <div class="panel-head">
          <div>
            <h2>Detalle historico del grupo</h2>
            <p>Consulta por temporada y grupo para ver una matriz rapida de asistencias.</p>
          </div>
          <button class="btn btn-secondary" data-action="refresh-attendance-detail">Actualizar detalle</button>
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
          <div class="empty-state">Cargando o sin detalle disponible para este grupo.</div>
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
  const kioskResult = getQrKioskResult_();
  const kioskContext = resolveQrContext();
  const kioskTone = kioskResult ? kioskResult.tone : (state.qrScanner.enabled ? "live" : "idle");
  const kioskBadge = kioskResult ? kioskResult.badge : (state.qrScanner.enabled ? "Escaneo en vivo" : "Kiosko en espera");
  const kioskTitle = kioskResult ? kioskResult.title : "Escanea tu codigo QR";
  const kioskMessage = kioskResult ? kioskResult.message : state.qrScanner.message;
  const kioskSessionLabel = kioskContext
    ? `${kioskContext.sessionId} | ${filter.mode === "manual" ? "Sesion forzada" : "Sesion activa"}`
    : "Sin sesion seleccionada";

  return `
    <section class="view-grid">
      <article class="kiosk-stage kiosk-tone-${escapeHtml(kioskTone)}" id="qr-kiosk-stage">
        <div class="kiosk-stage-head">
          <div>
            <span class="eyebrow kiosk-eyebrow">Kiosko de asistencia</span>
            <h2 class="kiosk-title">Registro tipo aeropuerto</h2>
            <p class="kiosk-copy">
              La camara queda lista para recibir un QR tras otro. Cuando el registro sea exitoso,
              la pantalla responde en verde y muestra los datos del asistente en tiempo real.
            </p>
          </div>

          <div class="kiosk-head-actions">
            <button class="btn ${state.qrScanner.enabled ? "btn-danger" : "btn-primary"}" data-action="${state.qrScanner.enabled ? "stop-kiosk-camera" : "start-kiosk-camera"}">
              ${state.qrScanner.enabled ? "Detener camara" : "Activar camara"}
            </button>
            <button class="btn btn-ghost" data-action="toggle-kiosk-fullscreen">Pantalla completa</button>
            <button class="btn btn-secondary" data-action="clear-kiosk-result">Limpiar resultado</button>
          </div>
        </div>

        <div class="kiosk-strip">
          <span class="kiosk-chip">${escapeHtml(filter.mode === "manual" ? "Modo manual" : "Modo automatico")}</span>
          <span class="kiosk-chip">${escapeHtml(kioskSessionLabel)}</span>
          <span class="kiosk-chip">${escapeHtml(activeSession ? activeSession.name : "Sin sesion abierta hoy")}</span>
        </div>

        <div class="kiosk-grid">
          <div class="kiosk-scanner-shell">
            <div class="kiosk-scanner-frame">
              <video id="qr-kiosk-video" class="kiosk-video" autoplay muted playsinline></video>
              <div class="kiosk-video-placeholder ${state.qrScanner.enabled ? "hidden" : ""}">
                <strong>Camara en espera</strong>
                <span>Activa el kiosko para iniciar el escaneo continuo.</span>
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
              <span class="footer-note">
                Recomendado: Chrome o Edge sobre HTTPS para aprovechar la deteccion nativa de QR con mejor rendimiento.
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
                <label>Person ID</label>
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
        <article class="scanner-card panel-card">
          <div class="panel-head">
            <div>
              <h2>Registro manual por codigo</h2>
              <p>Sirve como respaldo para lector tipo teclado o captura manual del personId.</p>
            </div>
          </div>

          <form id="qr-form">
            <div class="field">
              <label for="qr-person-id">Person ID / Codigo QR</label>
              <input id="qr-person-id" name="personId" value="${escapeHtml(filter.personId)}" placeholder="Ejemplo: SRV00001" required>
              <span class="field-help">El QR debe contener el identificador de persona, por ejemplo SRV00001.</span>
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

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h2>Modo kiosko por busqueda</h2>
              <p>Busca una persona y registra su asistencia sin escribir el codigo, ideal para contingencias.</p>
            </div>
          </div>

          <div class="field">
            <label for="qr-people-search">Buscar persona</label>
            <input id="qr-people-search" value="${escapeHtml(filter.peopleSearch)}" placeholder="Nombre, numero o correo">
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
      </div>
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

function renderNavButton(view, description) {
  const isActive = state.currentView === view;
  if (true) {
    return `
      <button class="nav-button ${isActive ? "active" : ""}" data-action="navigate" data-view="${view}">
        <span class="nav-copy">
          <strong>${escapeHtml(VIEW_META[view].title)}</strong>
          <small>${escapeHtml(description)}</small>
        </span>
        <span class="nav-state">${isActive ? "Actual" : "Abrir"}</span>
      </button>
    `;
  }
  return `
    <button class="nav-button ${isActive ? "active" : ""}" data-action="navigate" data-view="${view}">
      <span>${escapeHtml(VIEW_META[view].title)}<small>${escapeHtml(description)}</small></span>
      <span>${isActive ? "●" : "○"}</span>
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
      <span>→</span>
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

async function handleClick(event) {
  const button = event.target.closest("[data-action]");

  if (!button) {
    return;
  }

  const { action } = button.dataset;

  try {
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

    if (action === "navigate") {
      state.currentView = button.dataset.view;
      await loadCurrentViewData();
      renderApp();
      return;
    }

    if (action === "refresh-app") {
      await bootstrapApplication();
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

    if (action === "bulk-assign") {
      await bulkAssignParticipants();
      return;
    }

    if (action === "clear-bulk-selection") {
      state.selectedBulkPeople = [];
      renderApp();
      return;
    }

    if (action === "move-participant") {
      const participantId = button.dataset.participantId;
      const select = document.getElementById(`move-target-${participantId}`);
      const targetGroupId = select ? select.value : "";

      if (!targetGroupId) {
        showToast("Falta grupo destino", "Selecciona un grupo antes de mover al participante.", "warning");
        return;
      }

      await withLoading(async () => {
        await apiPost("participants.changeGroup", {
          participantId,
          groupId: targetGroupId
        });
        await loadParticipantsData();
      }, "Moviendo participante...");

      showToast("Participante movido", "El cambio de grupo ya se reflejo en la lista.", "success");
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
        await loadParticipantsData();
      }, "Dando de baja participante...");

      showToast("Participante dado de baja", "El registro quedo actualizado.", "success");
      return;
    }

    if (action === "load-attendance") {
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (action === "refresh-attendance-detail") {
      await loadAttendanceDetailOnly();
      renderApp();
      return;
    }

    if (action === "set-attendance-all") {
      setAttendanceForAll(button.dataset.value);
      renderApp();
      return;
    }

    if (action === "start-kiosk-camera") {
      state.qrScanner.enabled = true;
      state.qrScanner.status = "starting";
      state.qrScanner.message = "Solicitando acceso a la camara y preparando el lector...";
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

    if (action === "set-qr-mode") {
      state.filters.qr.mode = button.dataset.mode || "active";
      await loadQrSummary();
      renderApp();
      return;
    }

    if (action === "refresh-active-session") {
      await withLoading(async () => {
        await loadActiveSession();
        await loadQrSummary();
      }, "Consultando sesion activa...");
      renderApp();
      return;
    }

    if (action === "refresh-realtime") {
      await loadQrSummary();
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

      await withLoading(async () => {
        ensureApiUrl(state.apiUrl);
        const data = await apiPost("auth.login", {
          email,
          password
        });

        state.user = data.user;
        setStoredUser(data.user);
        state.currentView = "dashboard";
        showToast("Bienvenido", `Sesion iniciada como ${data.user.name}.`, "success");
        await bootstrapApplication();
      }, "Validando credenciales...");

      return;
    }

    if (form.id === "season-create-form") {
      const payload = Object.fromEntries(new FormData(form).entries());

      await withLoading(async () => {
        const result = await apiPost("seasons.create", payload);
        await refreshSeasons();
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

    if (form.id === "attendance-form") {
      await saveAttendanceCapture();
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
    if (target.id === "participants-season") {
      state.filters.participants.seasonId = target.value;
      state.filters.participants.sessionId = "";
      state.filters.participants.groupId = "";
      await syncFilterState("participants");
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "participants-session") {
      state.filters.participants.sessionId = target.value;
      state.filters.participants.groupId = "";
      await syncFilterState("participants");
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "participants-group") {
      state.filters.participants.groupId = target.value;
      await loadParticipantsData();
      renderApp();
      return;
    }

    if (target.id === "attendance-season") {
      state.filters.attendance.seasonId = target.value;
      state.filters.attendance.sessionId = "";
      state.filters.attendance.groupId = "";
      await syncFilterState("attendance");
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (target.id === "attendance-session") {
      state.filters.attendance.sessionId = target.value;
      state.filters.attendance.groupId = "";
      await syncFilterState("attendance");
      await loadAttendanceData();
      renderApp();
      return;
    }

    if (target.id === "attendance-group") {
      state.filters.attendance.groupId = target.value;
      await loadAttendanceData();
      renderApp();
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

    if (target.dataset.role === "bulk-person-checkbox") {
      toggleBulkSelection(target.value, target.checked);
      renderApp();
      return;
    }

    if (target.dataset.role === "attendance-select") {
      state.attendanceForm[target.dataset.personId] = target.value;
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

  if (target.id === "participant-people-search") {
    state.filters.participants.peopleSearch = target.value;
    renderApp();
    return;
  }

  if (target.id === "participant-bulk-search") {
    state.filters.participants.bulkSearch = target.value;
    renderApp();
    return;
  }

  if (target.id === "qr-people-search") {
    state.filters.qr.peopleSearch = target.value;
    renderApp();
    return;
  }

  if (target.id === "qr-person-id") {
    state.filters.qr.personId = target.value;
  }
}

async function bootstrapApplication() {
  await withLoading(async () => {
    await Promise.all([
      loadCatalogs(),
      refreshSeasons(),
      loadPeople(),
      loadActiveSession()
    ]);

    await syncAllFilters();
    await loadCurrentViewData();
  }, "Cargando datos iniciales...");

  renderApp();
}

async function loadCurrentViewData() {
  if (!state.user) {
    return;
  }

  switch (state.currentView) {
    case "seasons":
      await ensureSeasonViewData();
      return;
    case "participants":
      await loadParticipantsData();
      return;
    case "attendance":
      await loadAttendanceData();
      return;
    case "qr":
      await loadQrSummary();
      return;
    case "dashboard":
    default:
      await ensureSessionsForSeason(getLatestSeason()?.id || "");
  }
}

async function loadCatalogs() {
  const [groups, ministries] = await Promise.all([
    apiGet("catalog.groups.list"),
    apiGet("catalog.ministries.list")
  ]);

  state.catalogs.groups = groups;
  state.catalogs.ministries = ministries;
}

async function refreshSeasons() {
  state.seasons = await apiGet("seasons.list");
}

async function loadPeople() {
  state.people = await apiGet("people.list");
}

async function loadActiveSession() {
  state.activeSession = await apiGet("sessions.active");
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

async function loadParticipantsData() {
  await syncFilterState("participants");

  const filter = state.filters.participants;
  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    state.participants = [];
    state.participantContext = null;
    return;
  }

  await withLoading(async () => {
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
  }, "Cargando participantes...");
}

async function addParticipant(personId) {
  const filter = state.filters.participants;
  ensureContextReady(filter, "participantes");

  await withLoading(async () => {
    await apiPost("participants.add", {
      seasonId: filter.seasonId,
      sessionId: filter.sessionId,
      groupId: filter.groupId,
      personId
    });
    await loadParticipantsData();
  }, "Agregando participante...");

  showToast("Participante agregado", "La persona ya fue agregada al grupo actual.", "success");
  renderApp();
}

async function bulkAssignParticipants() {
  const filter = state.filters.participants;
  ensureContextReady(filter, "asignacion masiva");

  if (!state.selectedBulkPeople.length) {
    showToast("Sin seleccion", "Selecciona al menos una persona para la asignacion masiva.", "warning");
    return;
  }

  await withLoading(async () => {
    await apiPost("participants.bulkAssign", {
      seasonId: filter.seasonId,
      groupId: filter.groupId,
      people: state.selectedBulkPeople.map((personId) => ({ personId }))
    });
    state.selectedBulkPeople = [];
    await loadParticipantsData();
  }, "Asignando participantes...");

  showToast("Asignacion completada", "Las personas se asignaron a todas las sesiones de la temporada.", "success");
  renderApp();
}

async function loadAttendanceData() {
  await syncFilterState("attendance");

  const filter = state.filters.attendance;
  if (!filter.seasonId || !filter.sessionId || !filter.groupId) {
    state.attendanceContext = null;
    state.attendanceDetail = null;
    state.attendanceForm = {};
    return;
  }

  await withLoading(async () => {
    const [context, detail] = await Promise.all([
      apiGet("attendances.captureContext", {
        seasonId: filter.seasonId,
        sessionId: filter.sessionId,
        groupId: filter.groupId
      }),
      apiGet("attendances.groupDetail", {
        seasonId: filter.seasonId,
        groupId: filter.groupId
      })
    ]);

    state.attendanceContext = context;
    state.attendanceDetail = detail;
    state.attendanceForm = {};

    context.participants.forEach((participant) => {
      state.attendanceForm[participant.personId] = participant.attendance === "SI" ? "SI" : "NO";
    });
  }, "Cargando asistencia...");
}

async function loadAttendanceDetailOnly() {
  const filter = state.filters.attendance;
  ensureContextReady(filter, "detalle de asistencia");

  await withLoading(async () => {
    state.attendanceDetail = await apiGet("attendances.groupDetail", {
      seasonId: filter.seasonId,
      groupId: filter.groupId
    });
  }, "Actualizando detalle historico...");
}

async function saveAttendanceCapture() {
  const filter = state.filters.attendance;
  ensureContextReady(filter, "captura de asistencia");

  const attendances = Object.entries(state.attendanceForm).map(([personId, attended]) => ({
    personId,
    attended
  }));

  if (!attendances.length) {
    showToast("Sin participantes", "No hay registros para guardar en esta captura.", "warning");
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

    await loadAttendanceData();
  }, "Guardando asistencia...");

  showToast("Asistencia guardada", "La captura quedo registrada correctamente.", "success");
  renderApp();
}

async function loadQrSummary(options = {}) {
  const context = resolveQrContext();

  if (!context) {
    state.realtimeSummary = null;
    return;
  }

  const task = async () => {
    state.realtimeSummary = await apiGet("attendances.realtimeSummary", {
      seasonId: context.seasonId,
      sessionId: context.sessionId
    });
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
    showToast("Falta personId", "Escribe o selecciona un personId valido.", "warning");
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
      showLoading: options.showLoading !== false
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

  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    throwQrScannerError_("UNSUPPORTED_QR_SCANNER", "Este navegador no soporta el lector QR nativo. Usa Chrome o Edge actualizado.");
    return;
  }

  if (!qrScannerRuntime.detector) {
    qrScannerRuntime.detector = new window.BarcodeDetector({
      formats: ["qr_code"]
    });
  }

  if (!qrScannerRuntime.stream) {
    try {
      qrScannerRuntime.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: "environment"
          },
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        }
      });
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

  state.qrScanner.status = "scanning";
  state.qrScanner.message = "Escaneo activo. Acerca el QR al marco central.";

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

  if (qrScannerRuntime.stream) {
    qrScannerRuntime.stream.getTracks().forEach((track) => track.stop());
    qrScannerRuntime.stream = null;
  }

  const video = document.getElementById("qr-kiosk-video");
  if (video instanceof HTMLVideoElement) {
    video.srcObject = null;
  }

  if (!keepStatus) {
    state.qrScanner.status = "idle";
    state.qrScanner.message = "Activa la camara para comenzar el registro automatico.";
  }
}

function scanQrFrame_() {
  if (!state.qrScanner.enabled || state.currentView !== "qr") {
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

  Promise.resolve(qrScannerRuntime.detector.detect(video))
    .then((codes) => {
      const detectedCode = Array.isArray(codes) ? codes.find((item) => item?.rawValue) : null;

      if (!detectedCode || !detectedCode.rawValue) {
        return;
      }

      const rawValue = String(detectedCode.rawValue).trim();
      const extractedPersonId = extractPersonIdFromScan_(rawValue);

      if (!extractedPersonId) {
        state.qrScanner.result = buildQrFailureResult_(
          new ApiError("El codigo QR no contiene un personId reconocible.", "INVALID_QR_VALUE"),
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
    })
    .catch(() => {
      // Si la deteccion falla en un frame aislado, dejamos continuar el siguiente intento.
    })
    .finally(() => {
      qrScannerRuntime.busy = false;
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
  if (checked) {
    if (!state.selectedBulkPeople.includes(personId)) {
      state.selectedBulkPeople.push(personId);
    }
    return;
  }

  state.selectedBulkPeople = state.selectedBulkPeople.filter((item) => item !== personId);
}

function buildAttendanceSummary() {
  const values = Object.values(state.attendanceForm);
  const present = values.filter((value) => value === "SI").length;

  return {
    total: values.length,
    present,
    absent: values.length - present
  };
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
  state.catalogs = {
    groups: [],
    ministries: []
  };
  state.seasons = [];
  state.sessionsBySeason = {};
  state.sessionGroupsByKey = {};
  state.people = [];
  state.activeSession = null;
  state.participants = [];
  state.participantContext = null;
  state.attendanceContext = null;
  state.attendanceForm = {};
  state.attendanceDetail = null;
  state.realtimeSummary = null;
  state.qrLastResult = null;
  state.qrScanner = {
    enabled: false,
    status: "idle",
    message: "Activa la camara para comenzar el registro automatico.",
    result: null
  };
  state.selectedBulkPeople = [];
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

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function handleError(error) {
  console.error(error);

  const message = error instanceof ApiError
    ? error.message
    : "Ocurrio un error inesperado";

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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
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
