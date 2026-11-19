import {
  norm,
  safe,
  field,
  etopDate,
  etopStartKey,
  formatLocalDateKey,
  sortCoursesByRelevance,
  filterCourses,
  incidentValue,
  joinIncidentsWithCourses,
  computeDashboardStats,
  toggleFavoriteNrc,
  pushRecentSearch,
  buildCourseExportRows,
  generateCSVFromRows,
} from "./etop-core.js";

// ─── INSTITUTIONAL CONNECTIONS (PRESERVED INTACT) ────────────────────────────
const DATA_URL = "https://tutoriaonlinepostgrado.github.io/sitiowebetop/nrcs.json";
const ETOP_INCIDENCES_JSON = "https://tutoriaonlinepostgrado.github.io/sitiowebetop/incidencias.json";
const INCIDENTS_URL = "https://tutoriaonlinepostgrado.github.io/etop-incidencias-app/";
const POWERAPP_EDITOR = "https://apps.powerapps.com/play/e/default-8fbed393-d03b-49f8-be79-cd5e1f590fb2/a/8d0fd473-95da-45be-8063-4cfebbbd6624";
const ETOP_INC_POWERAPP = "https://apps.powerapps.com/play/e/default-8fbed393-d03b-49f8-be79-cd5e1f590fb2/a/c71f7c75-4561-43ed-8824-0f1cb74d1967?tenantId=8fbed393-d03b-49f8-be79-cd5e1f590fb2&source=iframe";
const SHAREPOINT_COURSES_BASE = "https://unabportal365.sharepoint.com/sites/actasynrc/Lists/NRC_TUTOR_ACTUAL/";
const SHAREPOINT_STUDENTS_URL = "https://unabportal365.sharepoint.com/sites/actasynrc/Lists/BASESEMAFORO_20/Todosloselementos.aspx";
const CANVAS_INTEGRATION_URL = "https://lms.unab.cl/int-canvas/";
const XLSX_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

// ─── LOCAL STORAGE KEYS ──────────────────────────────────────────────────────
const STORAGE_KEYS = {
  favorites: "etop_favorites_v1",
  recents: "etop_recent_searches_v1",
  prefs: "etop_prefs_v1",
  syncMeta: "etop_sync_meta_v1",
};

// ─── DOM REFERENCES ──────────────────────────────────────────────────────────
const homeView = document.getElementById("home-view");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("search");
const searchClearBtn = document.getElementById("searchClear");
const searchBtn = document.getElementById("searchBtn");
const resultsEl = document.getElementById("results");
const favoritesSection = document.getElementById("favorites-section");
const recentSearchesEl = document.getElementById("recent-searches");
const portfolioBanner = document.getElementById("portfolio-banner");
const homeDashboard = document.getElementById("mobile-dashboard");
const detailSection = document.getElementById("course-detail");
const detailContent = document.getElementById("detail-content");
const detailBackBtn = document.getElementById("detail-back");
const detailPinBtn = document.getElementById("detail-pin");
const calendarPage = document.getElementById("calendar-page");
const editorPage = document.getElementById("editor-page");
const reportsPage = document.getElementById("reports-page");
const settingsPage = document.getElementById("settings-page");
const headerRefreshBtn = document.getElementById("header-refresh");
const toastEl = document.getElementById("app-toast");
const tileIncidentsSub = document.getElementById("tile-incidents-sub");

// ─── APP STATE ───────────────────────────────────────────────────────────────
let courses = null;
let incidentsRaw = null;
let incidentsPromise = null;
let coursesPromise = null;
let lastSyncInfo = readJson(STORAGE_KEYS.syncMeta, { coursesAt: null, incidentsAt: null, offline: false });

let favorites = readJson(STORAGE_KEYS.favorites, []);
let recentSearches = readJson(STORAGE_KEYS.recents, []);
let prefs = readJson(STORAGE_KEYS.prefs, { defaultTutor: "", filterHomeByTutor: false });

let activeStatusFilter = "";
let searchMatches = [];
let searchOffset = 0;
const SEARCH_PAGE_SIZE = 25;

let currentDetailCourse = null;
let detailReturnView = "home";
let detailReturnPayload = null;

let calendarFiltered = [];
let calendarOffset = 0;
let calendarContextCourse = null;

let editorReturnCourse = null;
let editorReturnView = "calendarios";
let editorOriginCourse = null;

let toastTimer = null;

// ─── STORAGE & UTILITY HELPERS ───────────────────────────────────────────────
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function showToast(message, type = "") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = "app-toast" + (type ? " is-" + type : "");
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 3400);
}

function formatSyncTimestamp(iso) {
  if (!iso) return "Sin registro";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin registro";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activeTutorScope() {
  return prefs.filterHomeByTutor && prefs.defaultTutor ? prefs.defaultTutor : "";
}

function stateClass(estado) {
  const s = norm(estado);
  if (s === "activo") return "is-active";
  if (s.includes("cierre")) return "is-closing";
  if (s.includes("prepar")) return "is-prep";
  return "is-closed";
}

function activateNav(name) {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === name);
  });
}

function hideAllPages() {
  homeView.hidden = true;
  detailSection.hidden = true;
  calendarPage.hidden = true;
  editorPage.hidden = true;
  editorPage.classList.remove("incident-workspace");
  reportsPage.hidden = true;
  settingsPage.hidden = true;
}

function showMain() {
  hideAllPages();
  homeView.hidden = false;
  activateNav("Inicio");
  renderPortfolioBanner();
  renderFavorites();
  renderRecentSearches();
}

// ─── DATA LOADING (LIVE + OFFLINE SERVICE WORKER FALLBACK) ───────────────────
async function loadCourses(forceRefresh = false) {
  if (courses && !forceRefresh) return courses;
  if (coursesPromise && !forceRefresh) return coursesPromise;

  coursesPromise = (async () => {
    const url = forceRefresh ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("El catálogo no tiene el formato esperado.");
    courses = data;
    lastSyncInfo = {
      ...lastSyncInfo,
      coursesAt: new Date().toISOString(),
      offline: !navigator.onLine,
    };
    writeJson(STORAGE_KEYS.syncMeta, lastSyncInfo);
    return courses;
  })();

  try {
    return await coursesPromise;
  } finally {
    coursesPromise = null;
  }
}

async function loadIncidents(forceRefresh = false) {
  if (incidentsRaw && !forceRefresh) return incidentsRaw;
  if (incidentsPromise && !forceRefresh) return incidentsPromise;

  incidentsPromise = (async () => {
    const url = forceRefresh ? `${ETOP_INCIDENCES_JSON}?t=${Date.now()}` : ETOP_INCIDENCES_JSON;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Formato de incidencias inesperado.");
    incidentsRaw = data;
    lastSyncInfo = {
      ...lastSyncInfo,
      incidentsAt: new Date().toISOString(),
    };
    writeJson(STORAGE_KEYS.syncMeta, lastSyncInfo);
    return incidentsRaw;
  })();

  try {
    return await incidentsPromise;
  } finally {
    incidentsPromise = null;
  }
}

function updateReadyStatus() {
  if (!courses) return;
  const scope = activeTutorScope();
  const count = scope
    ? filterCourses(courses, { onlyTutor: scope }).length
    : courses.length;
  const formattedCount = count.toLocaleString("es-CL");
  const syncLabel = lastSyncInfo.coursesAt ? ` · Actualizado ${formatSyncTimestamp(lastSyncInfo.coursesAt)}` : "";
  statusEl.textContent = scope
    ? `Catálogo listo · ${formattedCount} cursos de ${scope}${syncLabel}`
    : `Catálogo listo · ${formattedCount} cursos disponibles${syncLabel}`;
}

// ─── PORTFOLIO BANNER, FAVORITES & RECENTS ───────────────────────────────────
function renderPortfolioBanner() {
  if (!prefs.defaultTutor) {
    portfolioBanner.hidden = true;
    portfolioBanner.replaceChildren();
    return;
  }
  portfolioBanner.hidden = false;
  portfolioBanner.replaceChildren();

  const text = make("div", "");
  if (prefs.filterHomeByTutor) {
    text.append(
      document.createTextNode("Mostrando tu cartera: "),
      make("strong", "", prefs.defaultTutor)
    );
  } else {
    text.append(
      document.createTextNode("Viendo todo el catálogo · Tutor configurado: "),
      make("strong", "", prefs.defaultTutor)
    );
  }

  const actions = make("div", "portfolio-banner-actions");
  const toggleBtn = make(
    "button",
    "inline-btn",
    prefs.filterHomeByTutor ? "Ver todo el catálogo" : "Filtrar mi cartera"
  );
  toggleBtn.type = "button";
  toggleBtn.addEventListener("click", () => {
    prefs.filterHomeByTutor = !prefs.filterHomeByTutor;
    writeJson(STORAGE_KEYS.prefs, prefs);
    renderPortfolioBanner();
    if (courses) {
      renderHomeDashboard(courses, incidentsRaw || []);
      updateReadyStatus();
      if (searchInput.value.trim() || activeStatusFilter) runSearch(false);
    }
  });
  actions.append(toggleBtn);
  portfolioBanner.append(text, actions);
}

function isPinned(nrc) {
  return Boolean(nrc && favorites.includes(nrc));
}

function handleToggleFavorite(nrc, courseName = "") {
  if (!nrc) return;
  const wasPinned = isPinned(nrc);
  favorites = toggleFavoriteNrc(favorites, nrc);
  writeJson(STORAGE_KEYS.favorites, favorites);
  showToast(
    wasPinned ? `Quitado de fijados (${nrc})` : `Curso fijado: ${courseName || nrc}`,
    wasPinned ? "" : "success"
  );
  renderFavorites();
  if (currentDetailCourse && field(currentDetailCourse, "nrc", "NRC_COD_CAL") === nrc) {
    syncDetailPinButton(nrc);
  }
  if (!resultsEl.hidden && searchMatches.length) {
    renderSearchResultsPage();
  }
}

function renderFavorites() {
  favoritesSection.replaceChildren();
  if (!favorites.length || !courses) {
    favoritesSection.hidden = true;
    return;
  }
  const byNrc = new Map();
  for (const c of courses) {
    const n = field(c, "nrc", "NRC_COD_CAL");
    if (n) byNrc.set(n, c);
  }
  const pinnedCourses = favorites.map((nrc) => byNrc.get(nrc)).filter(Boolean);
  if (!pinnedCourses.length) {
    favoritesSection.hidden = true;
    return;
  }

  favoritesSection.hidden = false;
  const head = make("div", "section-head");
  head.append(make("h2", "", "Cursos fijados"), make("span", "section-meta", String(pinnedCourses.length)));
  favoritesSection.append(head);

  const list = make("div", "favorites-list");
  for (const c of pinnedCourses) {
    const nrc = field(c, "nrc", "NRC_COD_CAL");
    const name = field(c, "nombre curso", "NOMBRE_CURSO", "nombre") || "Curso ETOP";
    const estado = field(c, "estado", "ESTADO_CAL") || "Sin estado";
    const row = make("div", "favorite-row");

    const openBtn = make("button", "favorite-open");
    openBtn.type = "button";
    openBtn.append(
      make("strong", "", name),
      make("span", "", `${nrc} · ${estado}`)
    );
    openBtn.addEventListener("click", () => openCourse(c, "home"));

    const unpinBtn = make("button", "pin-icon-btn is-pinned", "★");
    unpinBtn.type = "button";
    unpinBtn.setAttribute("aria-label", `Quitar ${name} de cursos fijados`);
    unpinBtn.addEventListener("click", () => handleToggleFavorite(nrc, name));

    row.append(openBtn, unpinBtn);
    list.append(row);
  }
  favoritesSection.append(list);
}

function renderRecentSearches() {
  recentSearchesEl.replaceChildren();
  if (!recentSearches.length) {
    recentSearchesEl.hidden = true;
    return;
  }
  recentSearchesEl.hidden = false;
  const head = make("div", "recent-head");
  head.append(make("span", "", "Búsquedas recientes"));
  const clearBtn = make("button", "text-link-btn", "Limpiar");
  clearBtn.type = "button";
  clearBtn.addEventListener("click", () => {
    recentSearches = [];
    writeJson(STORAGE_KEYS.recents, recentSearches);
    renderRecentSearches();
  });
  head.append(clearBtn);

  const list = make("div", "recent-list");
  for (const term of recentSearches) {
    const btn = make("button", "recent-item", term);
    btn.type = "button";
    btn.addEventListener("click", () => {
      searchInput.value = term;
      syncSearchClearBtn();
      runSearch(false);
    });
    list.append(btn);
  }
  recentSearchesEl.append(head, list);
}

// ─── COURSE DETAIL (FICHA 360) ───────────────────────────────────────────────
function syncDetailPinButton(nrc) {
  const pinned = isPinned(nrc);
  detailPinBtn.textContent = pinned ? "★ Fijado" : "☆ Fijar curso";
  detailPinBtn.classList.toggle("is-pinned", pinned);
  detailPinBtn.setAttribute("aria-pressed", String(pinned));
}

function openCourse(c, returnView = "home", returnPayload = null) {
  currentDetailCourse = c;
  detailReturnView = returnView;
  detailReturnPayload = returnPayload;
  hideAllPages();
  detailSection.hidden = false;
  activateNav("Cursos");

  const nrc = field(c, "nrc", "NRC_COD_CAL");
  const id = field(c, "id", "ID");
  const intake = field(c, "intake", "INTAKE");
  const state = field(c, "estado", "ESTADO_CAL") || "Sin estado";
  const courseName = field(c, "nombre curso", "NOMBRE_CURSO", "nombre") || "Ficha del curso";

  detailBackBtn.textContent =
    returnView === "calendarios"
      ? "← Volver a calendarios"
      : returnView === "incidencias"
      ? "← Volver a incidencias"
      : "← Volver al inicio";
  syncDetailPinButton(nrc);

  detailContent.replaceChildren();

  const heading = make("div", "course-heading");
  const kicker = make("p", "course-kicker");
  const stateSpan = make("span", `state-text ${stateClass(state)}`, state);
  const faculty = field(c, "facultad", "FACULTAD");
  kicker.append(stateSpan);
  if (faculty) kicker.append(document.createTextNode(` · ${faculty}`));
  heading.append(
    kicker,
    make("h2", "", courseName),
    make("p", "course-nrc", "NRC " + (nrc || "No disponible"))
  );
  detailContent.append(heading);

  const section = make("section", "detail-section");
  section.append(make("h3", "", "Datos del curso"));
  const grid = make("div", "detail-grid");
  for (const [label, keys] of [
    ["Tutor", ["tutor", "NOMBRE_TUTOR"]],
    ["Código", ["codigo curso", "codigo", "COD_CURSO"]],
    ["Inicio", ["fecha inicio", "FECHA_INICIO"]],
    ["Término", ["fecha fin", "FECHA_FIN"]],
    ["Facultad", ["facultad", "FACULTAD"]],
    ["Intake", ["intake", "INTAKE"]],
    ["Programa", ["programa", "PROGRAMA"]],
  ]) {
    const value = field(c, ...keys);
    if (!value) continue;
    const item = make("div", "detail-field");
    item.append(make("span", "", label), make("strong", "", value));
    grid.append(item);
  }
  section.append(grid);
  detailContent.append(section);

  // QA2 summary inside Ficha 360 if incidents already loaded
  let courseIncidentCount = null;
  let coursePendingCount = 0;
  if (Array.isArray(incidentsRaw) && id) {
    const courseInc = joinIncidentsWithCourses(
      incidentsRaw.filter((x) => safe(x.cursoId ?? "") === id),
      [c]
    );
    courseIncidentCount = courseInc.length;
    coursePendingCount = courseInc.filter((i) => i.stateGroup === "pendiente").length;
  }

  const follow = make("section", "detail-section");
  follow.append(make("h3", "", "Seguimiento operativo"));
  const metrics = make("div", "metric-grid");
  const metricItems = [
    [courseIncidentCount === null ? "—" : String(courseIncidentCount), "Incidencias QA2"],
    [courseIncidentCount === null ? "—" : String(coursePendingCount), "QA2 pendientes"],
    ["—", "Estudiantes (M365)"],
  ];
  for (const [val, label] of metricItems) {
    const m = make("div", "metric-box");
    m.append(make("strong", "", val), make("span", "", label));
    metrics.append(m);
  }
  follow.append(
    metrics,
    make(
      "p",
      "detail-caption",
      "Indicadores QA2 provenientes del consolidado publicado. El seguimiento de estudiantes requiere abrir Base Semáforo con cuenta Microsoft 365."
    )
  );
  detailContent.append(follow);

  // Institutional Links & Actions (ALL 7 preserved with identical parameters)
  const actions = make("section", "detail-section");
  actions.append(make("h3", "", "Accesos y herramientas del NRC"));
  const actionGrid = make("div", "detail-actions");

  const sharepointCourse = id
    ? SHAREPOINT_COURSES_BASE + "DispForm.aspx?ID=" + encodeURIComponent(id) + "&env=Embedded"
    : "";

  const sharepointIntake = intake ? new URL("Vista_version.aspx", SHAREPOINT_COURSES_BASE) : null;
  if (sharepointIntake) {
    const p = sharepointIntake.searchParams;
    p.set("viewid", "f4c009bb-0552-43a5-9718-9c1d37d8f98b");
    p.set("env", "WebViewList");
    p.set("FilterField1", "field_8");
    p.set("FilterValue1", intake);
  }

  const students = nrc ? new URL(SHAREPOINT_STUDENTS_URL) : null;
  if (students) {
    students.searchParams.set("FilterField1", "NRC_COD_CAL_FILTRO");
    students.searchParams.set("FilterValue1", nrc);
    students.searchParams.set("FilterType1", "Text");
    students.searchParams.set("viewid", "1f85f1c7-089f-47d6-8635-a2cc761fecc3");
    students.searchParams.set("env", "Embedded");
  }

  const pieces = nrc.split("_");
  const period = pieces.at(-1);
  const crn = pieces[0];
  const integration = crn && period ? new URL(CANVAS_INTEGRATION_URL) : null;
  if (integration) {
    for (const [k, v] of Object.entries({
      term_code: period,
      periodo: period,
      nrc: crn,
      nrc_code: crn,
      crn,
      NRC: crn,
    })) {
      integration.searchParams.set(k, v);
    }
  }

  const incLabel =
    courseIncidentCount !== null && courseIncidentCount > 0
      ? `Incidencias del curso (${courseIncidentCount})`
      : "Ver incidencias del curso";

  const links = [
    ["Ver calendarios", "", () => openCalendars(c)],
    ["Curso en SharePoint", sharepointCourse],
    ["Cursos del intake", sharepointIntake?.href],
    ["Base Semáforo", students?.href],
    ["Web de Integración", integration?.href],
    ["Editar curso", "", () => openCourseEditor(c, null, "ficha")],
    [incLabel, "", () => openIncidents(c)],
  ];

  for (const [label, url, action] of links) {
    let b;
    if (action) {
      b = make("button", "action-enabled", label);
      b.type = "button";
      b.addEventListener("click", action);
    } else if (url) {
      b = make("a", "action-link", label + " ↗");
      b.href = url;
      b.target = "_blank";
      b.rel = "noopener noreferrer";
    } else {
      b = make("button", "", label);
      b.disabled = true;
      b.title = "No hay identificador o dato suficiente para construir el acceso";
    }
    actionGrid.append(b);
  }

  actions.append(
    actionGrid,
    make(
      "p",
      "detail-caption",
      "Los accesos institucionales requieren permisos Microsoft 365. Las vistas externas se abren en una nueva pestaña."
    )
  );
  detailContent.append(actions);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

detailBackBtn.addEventListener("click", () => {
  if (detailReturnView === "calendarios") {
    openCalendars(detailReturnPayload?.selectedCourse || null, detailReturnPayload?.filters || {});
  } else if (detailReturnView === "incidencias") {
    openIncidents(null, detailReturnPayload || {});
  } else {
    showMain();
  }
});

detailPinBtn.addEventListener("click", () => {
  if (!currentDetailCourse) return;
  const nrc = field(currentDetailCourse, "nrc", "NRC_COD_CAL");
  const name = field(currentDetailCourse, "nombre curso", "NOMBRE_CURSO", "nombre");
  handleToggleFavorite(nrc, name);
});

// ─── POWER APPS COURSE EDITOR ────────────────────────────────────────────────
function closeCourseEditor() {
  editorPage.replaceChildren();
  editorPage.hidden = true;
  if (editorReturnView === "ficha" && editorOriginCourse) {
    openCourse(editorOriginCourse);
  } else if (editorReturnCourse) {
    openCalendars(editorReturnCourse);
  } else {
    openCalendars();
  }
}

function openCourseEditor(c, contextCourse = null, origin = "calendarios") {
  const id = field(c, "id", "ID");
  if (!id) {
    showToast("El catálogo no contiene el ID de SharePoint necesario para abrir el editor.", "error");
    return;
  }
  editorReturnCourse = contextCourse;
  editorReturnView = origin;
  editorOriginCourse = c;
  const url = new URL(POWERAPP_EDITOR);
  url.searchParams.set("tenantId", "8fbed393-d03b-49f8-be79-cd5e1f590fb2");
  url.searchParams.set("ids", id);
  const target = url.href;

  hideAllPages();
  editorPage.hidden = false;
  editorPage.replaceChildren();

  const header = make("div", "editor-top");
  const back = make(
    "button",
    "calendar-back",
    origin === "ficha" ? "← Volver a ficha 360" : "← Volver a calendarios"
  );
  back.type = "button";
  back.addEventListener("click", closeCourseEditor);
  const title = make("div", "");
  title.append(
    make("h2", "", "Editar curso"),
    make("p", "detail-caption", field(c, "nombre curso", "NOMBRE_CURSO") || "Curso ETOP"),
    make("p", "detail-caption", "NRC " + (field(c, "nrc", "NRC_COD_CAL") || ""))
  );
  header.append(back, title);
  editorPage.append(header);

  editorPage.append(
    make(
      "p",
      "detail-caption",
      "Editor institucional de Microsoft Power Apps. Inicia sesión con tu cuenta UNAB si se solicita. Si el formulario no aparece, utiliza Abrir editor."
    )
  );
  const frame = make("iframe", "editor-frame");
  frame.title = "Editor institucional del curso";
  frame.src = target;
  frame.setAttribute("loading", "eager");
  frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  editorPage.append(frame);

  const fallback = make("a", "calendar-new", "Abrir editor en Microsoft 365 ↗");
  fallback.href = target;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  editorPage.append(fallback);
  editorPage.append(
    make(
      "p",
      "detail-caption",
      "Al regresar, el catálogo público puede tardar en reflejar los cambios guardados en SharePoint."
    )
  );
  window.scrollTo(0, 0);
}

// ─── CALENDARS PAGE ──────────────────────────────────────────────────────────
function optionSelect(label, values, idPrefix = "cal-options-") {
  const wrap = make("label", "calendar-filter");
  wrap.append(make("span", "", label));
  const input = make("input", "calendar-filter-input");
  input.type = "search";
  input.placeholder = "Todos · buscar " + label.toLowerCase();
  input.setAttribute("aria-label", "Filtrar por " + label);
  const datalist = make("datalist");
  datalist.id = idPrefix + label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  values.forEach((v) => datalist.append(new Option(v, v)));
  input.setAttribute("list", datalist.id);
  wrap.append(input, datalist);
  return { wrap, select: input };
}

function renderCalendarRows() {
  const list = document.getElementById("calendar-list");
  if (!list) return;
  list.replaceChildren();
  const subset = calendarFiltered.slice(calendarOffset, calendarOffset + 35);
  for (const c of subset) {
    const card = make("article", "calendar-row");
    const estado = field(c, "estado", "ESTADO_CAL") || "Sin estado";
    const top = make("div", "calendar-row-top");
    top.append(
      make("strong", "", field(c, "nombre curso", "NOMBRE_CURSO") || "Curso sin nombre"),
      make("span", `state-text ${stateClass(estado)}`, estado)
    );
    card.append(
      top,
      make(
        "p",
        "",
        "NRC " +
          field(c, "nrc", "NRC_COD_CAL") +
          " · " +
          field(c, "codigo curso", "codigo", "COD_CURSO")
      ),
      make("p", "", "Tutor: " + (field(c, "tutor", "NOMBRE_TUTOR") || "Sin asignar"))
    );
    const dates = make("div", "calendar-row-dates");
    dates.append(
      make("span", "", "Inicio: " + (field(c, "fecha inicio", "FECHA_INICIO") || "—")),
      make("span", "", "Término: " + (field(c, "fecha fin", "FECHA_FIN") || "—"))
    );
    card.append(dates);

    const actions = make("div", "calendar-row-actions");
    const view = make("button", "calendar-action", "Ver ficha");
    view.type = "button";
    view.addEventListener("click", () => {
      openCourse(c, "calendarios", { selectedCourse: calendarContextCourse });
    });
    const edit = make("button", "calendar-action calendar-edit", "Editar curso");
    edit.type = "button";
    edit.addEventListener("click", () => openCourseEditor(c, calendarContextCourse));
    actions.append(view, edit);
    card.append(actions);
    list.append(card);
  }
  const countEl = document.getElementById("calendar-count");
  if (countEl) {
    countEl.textContent =
      calendarFiltered.length.toLocaleString("es-CL") +
      " cursos · mostrando " +
      (calendarFiltered.length ? calendarOffset + 1 : 0) +
      "–" +
      Math.min(calendarOffset + 35, calendarFiltered.length);
  }
  const prevBtn = document.getElementById("calendar-prev");
  const nextBtn = document.getElementById("calendar-next");
  if (prevBtn) prevBtn.disabled = calendarOffset === 0;
  if (nextBtn) nextBtn.disabled = calendarOffset + 35 >= calendarFiltered.length;
}

async function openCalendars(selectedCourse = null, initialFilters = {}) {
  calendarContextCourse = selectedCourse;
  hideAllPages();
  calendarPage.hidden = false;
  activateNav("Cursos");
  calendarPage.replaceChildren(
    make("h2", "", "Calendarios ETOP"),
    make("p", "detail-caption", "Consultando catálogo de cursos…")
  );
  window.scrollTo(0, 0);

  try {
    const allData = await loadCourses();
    const intake = selectedCourse ? field(selectedCourse, "intake", "INTAKE") : "";
    if (selectedCourse && !intake) {
      calendarPage.replaceChildren(
        make("h2", "", "Calendario de la versión"),
        make(
          "p",
          "detail-caption",
          "Este NRC no tiene intake o versión informada en el catálogo; no es posible identificar sus cursos relacionados."
        )
      );
      const back = make("button", "calendar-back", "← Volver a la ficha");
      back.type = "button";
      back.addEventListener("click", () => openCourse(selectedCourse));
      calendarPage.append(back);
      return;
    }

    const baseData = intake
      ? allData.filter((c) => norm(field(c, "intake", "INTAKE")) === norm(intake))
      : allData;

    calendarPage.replaceChildren(
      make("h2", "", selectedCourse ? "Calendario de la versión" : "Calendarios ETOP"),
      make(
        "p",
        "detail-caption",
        selectedCourse
          ? "Cursos del mismo intake o versión que el NRC seleccionado."
          : "Consulta del catálogo ETOP con filtros combinables por estado, facultad, tutor e intake."
      )
    );

    if (selectedCourse) {
      const back = make("button", "calendar-back", "← Volver a la ficha");
      back.type = "button";
      back.addEventListener("click", () => openCourse(selectedCourse));
      calendarPage.append(back, make("p", "calendar-scope", "Versión: " + intake));
    }

    const scopeTutor = !selectedCourse && !initialFilters.ignoreTutorScope ? activeTutorScope() : "";
    const calendarMonthData = scopeTutor
      ? filterCourses(baseData, { onlyTutor: scopeTutor })
      : baseData;

    if (!selectedCourse && !initialFilters.startDate) {
      etopMonthCalendar(calendarPage, calendarMonthData, (key) =>
        openCalendars(null, { startDate: key })
      );
    }

    if (initialFilters.startDate) {
      const d = etopDate(initialFilters.startDate);
      const title = make("div", "etop-date-selection");
      title.append(
        make(
          "strong",
          "",
          "Cursos que comienzan el " +
            (d
              ? d.toLocaleDateString("es-CL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : initialFilters.startDate)
        )
      );
      const backMonth = make("button", "calendar-back", "← Volver al calendario mensual");
      backMonth.type = "button";
      backMonth.addEventListener("click", () => openCalendars());
      title.append(backMonth);
      calendarPage.append(title);
    }

    const query = make("input", "calendar-query");
    query.type = "search";
    query.placeholder = "Buscar NRC, curso o tutor";
    query.setAttribute("aria-label", "Buscar cursos del calendario");
    calendarPage.append(query);

    const filters = make("div", "calendar-filters");
    const selects = {};
    for (const [label, key] of [
      ["Estado", "estado"],
      ["Facultad", "facultad"],
      ["Tutor", "tutor"],
      ["Intake", "intake"],
    ]) {
      const values = [...new Set(baseData.map((c) => field(c, key)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      );
      const control = optionSelect(label, values, "cal-opt-");
      filters.append(control.wrap);
      selects[key] = control.select;
    }

    if (selectedCourse) {
      selects.intake.value = intake;
      selects.intake.readOnly = true;
    }
    if (initialFilters.status) selects.estado.value = initialFilters.status;
    if (initialFilters.tutor) selects.tutor.value = initialFilters.tutor;
    else if (scopeTutor) selects.tutor.value = scopeTutor;
    calendarPage.append(filters);

    const toolbar = make("div", "calendar-toolbar");
    const newCourse = make("a", "calendar-new", "＋ Agregar curso en SharePoint ↗");
    newCourse.href = SHAREPOINT_COURSES_BASE + "NewForm.aspx";
    newCourse.target = "_blank";
    newCourse.rel = "noopener noreferrer";
    toolbar.append(
      newCourse,
      make(
        "p",
        "detail-caption",
        "Editar y agregar abren Microsoft 365 con tus permisos institucionales; los cambios se reflejan tras la siguiente publicación del catálogo."
      )
    );

    const countP = make("p", "calendar-count", "");
    countP.id = "calendar-count";
    const list = make("div", "calendar-list");
    list.id = "calendar-list";

    const pager = make("div", "calendar-pager");
    const prev = make("button", "", "← Anteriores");
    prev.type = "button";
    prev.id = "calendar-prev";
    const next = make("button", "", "Siguientes →");
    next.type = "button";
    next.id = "calendar-next";
    prev.addEventListener("click", () => {
      calendarOffset = Math.max(0, calendarOffset - 35);
      renderCalendarRows();
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    next.addEventListener("click", () => {
      calendarOffset += 35;
      renderCalendarRows();
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    pager.append(prev, next);

    calendarPage.append(toolbar, countP, list, pager);

    const apply = () => {
      const filtered = filterCourses(baseData, {
        term: query.value,
        status: selects.estado.value,
        faculty: selects.facultad.value,
        tutor: selects.tutor.value,
        intake: selects.intake.value,
        startDate: initialFilters.startDate || "",
        upcoming: Boolean(initialFilters.upcoming),
      });
      calendarFiltered = sortCoursesByRelevance(filtered);
      calendarOffset = 0;
      renderCalendarRows();
    };

    query.addEventListener("input", apply);
    Object.values(selects).forEach((el) => el.addEventListener("input", apply));
    apply();
  } catch {
    calendarPage.append(
      make("p", "native-incident-error", "No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentar.")
    );
  }
}

// ─── MONTHLY CALENDAR WIDGET ─────────────────────────────────────────────────
function etopMonthCalendar(container, data, onSelect) {
  const shell = make("section", "etop-month-calendar");
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  const todayKey = formatLocalDateKey(today);

  const counts = new Map();
  for (const c of data) {
    const key = etopStartKey(c);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const heading = make("div", "etop-month-heading");
  heading.append(make("strong", "", "Inicio de cursos"));
  const controls = make("div", "etop-month-controls");
  const prev = make("button", "", "‹");
  prev.type = "button";
  prev.setAttribute("aria-label", "Mes anterior");
  const label = make("span", "etop-month-label", "");
  const next = make("button", "", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Mes siguiente");
  const current = make("button", "etop-month-today", "Hoy");
  current.type = "button";
  controls.append(prev, label, next, current);
  heading.append(controls);

  const weekdays = make("div", "etop-month-weekdays");
  ["L", "M", "X", "J", "V", "S", "D"].forEach((x) => weekdays.append(make("span", "", x)));
  const grid = make("div", "etop-month-grid");
  const caption = make("p", "etop-month-caption", "Toca un día con cursos para consultar su listado.");
  shell.append(heading, weekdays, grid, caption);
  container.append(shell);

  const draw = () => {
    label.textContent = new Date(year, month, 1).toLocaleDateString("es-CL", {
      month: "long",
      year: "numeric",
    });
    grid.replaceChildren();
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < first; i++) {
      const blank = make("span", "etop-month-blank");
      blank.setAttribute("aria-hidden", "true");
      grid.append(blank);
    }

    let monthly = 0;
    for (let day = 1; day <= days; day++) {
      const key = [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
      const n = counts.get(key) || 0;
      monthly += n;
      const btn = make("button", "etop-month-day" + (n ? " has-courses" : ""));
      btn.type = "button";
      btn.disabled = !n;
      if (key === todayKey) btn.classList.add("is-today");
      btn.append(make("span", "etop-day-number", String(day)));
      if (n) btn.append(make("strong", "etop-day-count", String(n)));
      btn.setAttribute("aria-label", `${day} de ${label.textContent}: ${n} cursos que comienzan`);
      if (n) btn.addEventListener("click", () => onSelect(key, n));
      grid.append(btn);
    }
    caption.textContent = `${monthly.toLocaleString("es-CL")} inicios de curso en este mes · Toca un día con número para ver sus cursos.`;
  };

  prev.addEventListener("click", () => {
    const d = new Date(year, month - 1, 1);
    year = d.getFullYear();
    month = d.getMonth();
    draw();
  });
  next.addEventListener("click", () => {
    const d = new Date(year, month + 1, 1);
    year = d.getFullYear();
    month = d.getMonth();
    draw();
  });
  current.addEventListener("click", () => {
    year = today.getFullYear();
    month = today.getMonth();
    draw();
  });
  draw();
  return shell;
}

// ─── NATIVE INCIDENTS WORKSPACE (PER-COURSE & GLOBAL DASHBOARD) ──────────────
function incidentUrl(value) {
  const v =
    typeof value === "object" && value
      ? value.Url || value.url || value.Value || value.value
      : value;
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

function incidentAction(label, url, kind = "") {
  if (!url) return null;
  const a = make("a", "incident-action " + kind, label);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function incidentDetails(label, value) {
  if (!value) return null;
  const wrap = make("div", "incident-description");
  wrap.append(make("span", "", label), make("p", "", value));
  return wrap;
}

function buildIncidentCard(entry, index, showCourseLink = false) {
  const { item, course, stateRaw, stateGroup, nrc, courseName, tutor } = entry;
  const card = make("article", "native-incident-card");

  const top = make("div", "native-incident-top");
  const titleText = showCourseLink
    ? courseName
    : "Incidencia " + (incidentValue(item, "idIncidencia", "id", "ID") || String(index + 1));
  top.append(make("strong", "", titleText));

  const badge = make("span", "native-incident-status", stateRaw);
  if (stateGroup === "pendiente") badge.classList.add("is-pending");
  else if (stateGroup === "corregida") badge.classList.add("is-corrected");
  else if (stateGroup === "derivada") badge.classList.add("is-derived");
  top.append(badge);
  card.append(top);

  // Clean unboxed metadata line
  const metaParts = [];
  if (showCourseLink && nrc) metaParts.push(`NRC ${nrc}`);
  if (showCourseLink && tutor) metaParts.push(tutor);
  for (const v of [
    incidentValue(item, "tipoQA", "TIPO_QA"),
    incidentValue(item, "categoria", "CATEGORIA"),
    incidentValue(item, "semanaUnidad", "semana"),
  ]) {
    if (v) metaParts.push(v);
  }
  if (metaParts.length) {
    card.append(make("div", "native-incident-meta", metaParts.join(" · ")));
  }

  const description = incidentDetails(
    "Descripción",
    incidentValue(item, "descripcionIncidencia", "DESCRIPCION_INCIDENCIA")
  );
  if (description) card.append(description);

  const solution = incidentDetails(
    "Solución registrada",
    incidentValue(item, "descripcionSolucion", "DESCRIPCION_SOLUCION")
  );
  if (solution) {
    const d = make("details", "native-incident-more");
    d.append(make("summary", "", "Ver solución registrada"), solution);
    card.append(d);
  }

  const actions = make("div", "native-incident-actions");
  if (showCourseLink && course) {
    const openFicha = make("button", "incident-action", "Ver Ficha 360");
    openFicha.type = "button";
    openFicha.addEventListener("click", () => openCourse(course, "incidencias"));
    actions.append(openFicha);
  }
  const canvas = incidentAction(
    "Abrir Canvas ↗",
    incidentUrl(item.urlCanvas || item.URL_QA2_FI_Url || course?.URL_CANVAS)
  );
  const evidence = incidentAction(
    "Ver evidencia ↗",
    incidentUrl(item.urlEvidencia || item.URL_EVIDENCIA)
  );
  const manageUrl = new URL(ETOP_INC_POWERAPP);
  if (nrc) manageUrl.searchParams.set("nrc", nrc);
  const manage = incidentAction("Gestionar ↗", manageUrl.href, "primary");

  for (const link of [canvas, evidence, manage]) {
    if (link) actions.append(link);
  }
  card.append(actions);
  return card;
}

async function openIncidents(c = null, initialOpts = {}) {
  const returnCourse = c;
  hideAllPages();
  editorPage.hidden = false;
  editorPage.replaceChildren();
  editorPage.classList.add("incident-workspace");
  activateNav(c ? "Cursos" : "Inicio");

  const nrc = c ? field(c, "nrc", "NRC_COD_CAL") : "";
  const header = make("div", "incident-workspace-header");
  const back = make("button", "incident-nav-back", c ? "← Ficha 360" : "← Inicio");
  back.type = "button";
  back.addEventListener("click", () => {
    editorPage.replaceChildren();
    editorPage.classList.remove("incident-workspace");
    editorPage.hidden = true;
    if (returnCourse) openCourse(returnCourse);
    else showMain();
  });

  const heading = make("div", "incident-workspace-title");
  heading.append(make("strong", "", nrc ? "Incidencias del curso" : "Tablero de incidencias QA2"));
  if (nrc) heading.append(make("small", "", nrc));
  else heading.append(make("small", "", "Consolidado publicado · seguimiento operativo"));

  const refresh = make("button", "incident-nav-refresh", "↻ Actualizar");
  refresh.type = "button";

  header.append(back, heading, refresh);
  if (!c) {
    const ext = make("a", "incident-nav-external", "App externa ↗");
    ext.href = INCIDENTS_URL;
    ext.target = "_blank";
    ext.rel = "noopener noreferrer";
    header.append(ext);
  }
  editorPage.append(header);

  const body = make("div", "native-incidents-body");
  editorPage.append(body);

  let selectedState = initialOpts.stateFilter || "pendiente";
  let searchText = "";
  let tutorFilter = initialOpts.tutor || activeTutorScope();
  let incOffset = 0;
  const INC_PAGE = 25;

  const load = async (force = false) => {
    refresh.disabled = true;
    body.replaceChildren(make("p", "native-incident-message", "Consultando incidencias publicadas…"));
    try {
      const [allIncidents, allCourses] = await Promise.all([
        loadIncidents(force),
        loadCourses(false),
      ]);
      body.replaceChildren();

      // Per-course view
      if (c) {
        const courseId = field(c, "id", "ID");
        if (!courseId) {
          body.append(
            make(
              "p",
              "native-incident-message",
              "Este curso no tiene identificador de SharePoint en el catálogo. No es posible asociar sus incidencias con seguridad."
            )
          );
          return;
        }
        const rows = allIncidents.filter((x) => safe(x.cursoId ?? "") === courseId);
        const joined = joinIncidentsWithCourses(rows, [c]);
        const info = make("div", "native-incidents-summary");
        info.append(
          make("strong", "", field(c, "nombre curso", "NOMBRE_CURSO") || "Curso ETOP"),
          make(
            "span",
            "",
            `${joined.length} ${joined.length === 1 ? "incidencia registrada" : "incidencias registradas"}`
          )
        );
        body.append(info);
        if (!joined.length) {
          body.append(
            make(
              "p",
              "native-incident-message",
              rows.length
                ? "No hay incidencias registradas en los controles QA2 publicados."
                : "No se encontraron registros QA2 para este NRC en el catálogo publicado."
            )
          );
          return;
        }
        const grid = make("div", "incidents-grid");
        joined.forEach((entry, i) => grid.append(buildIncidentCard(entry, i, false)));
        body.append(
          grid,
          make(
            "p",
            "native-incident-footnote",
            "Consulta de solo lectura desde el consolidado publicado. La gestión se realiza en Power Apps institucional; pulsa Actualizar para consultar los cambios publicados."
          )
        );
        return;
      }

      // Global operational QA2 dashboard
      const allJoined = joinIncidentsWithCourses(allIncidents, allCourses);
      const tutors = [...new Set(allJoined.map((x) => x.tutor).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es")
      );

      const kpiStrip = make("div", "incidents-kpi-strip");
      const filterBar = make("div", "status-filters");
      const stateTabs = [
        ["pendiente", "Pendientes"],
        ["derivada", "Derivadas"],
        ["corregida", "Corregidas"],
        ["", "Todas"],
      ];

      const searchRow = make("div", "incidents-search-row");
      const textWrap = make("label", "calendar-filter");
      textWrap.append(make("span", "", "Buscar NRC, curso o detalle"));
      const textInput = make("input", "calendar-filter-input");
      textInput.type = "search";
      textInput.placeholder = "Ej: MBA, enlace roto, NRC…";
      textInput.value = searchText;
      textWrap.append(textInput);

      const tutorControl = optionSelect("Tutor", tutors, "inc-tutor-");
      tutorControl.select.value = tutorFilter;
      searchRow.append(textWrap, tutorControl.wrap);

      const countP = make("p", "calendar-count", "");
      const grid = make("div", "incidents-grid");
      const pager = make("div", "calendar-pager");
      const prevBtn = make("button", "", "← Anteriores");
      prevBtn.type = "button";
      const nextBtn = make("button", "", "Siguientes →");
      nextBtn.type = "button";
      pager.append(prevBtn, nextBtn);

      body.append(
        kpiStrip,
        filterBar,
        searchRow,
        countP,
        grid,
        pager,
        make(
          "p",
          "native-incident-footnote",
          "Tablero nativo alimentado por incidencias.json cruzado con nrcs.json. La edición se realiza en Power Apps institucional."
        )
      );

      let currentFiltered = [];

      const renderList = () => {
        grid.replaceChildren();
        const slice = currentFiltered.slice(incOffset, incOffset + INC_PAGE);
        if (!slice.length) {
          grid.append(
            make(
              "p",
              "native-incident-message",
              "No hay incidencias que coincidan con los filtros seleccionados."
            )
          );
        } else {
          slice.forEach((entry, i) => grid.append(buildIncidentCard(entry, incOffset + i, true)));
        }
        countP.textContent = `${currentFiltered.length.toLocaleString("es-CL")} incidencias · mostrando ${
          currentFiltered.length ? incOffset + 1 : 0
        }–${Math.min(incOffset + INC_PAGE, currentFiltered.length)}`;
        prevBtn.disabled = incOffset === 0;
        nextBtn.disabled = incOffset + INC_PAGE >= currentFiltered.length;
      };

      const applyFilters = () => {
        const q = norm(textInput.value);
        const tut = norm(tutorControl.select.value);

        const scopedByTutor = tut
          ? allJoined.filter((e) => norm(e.tutor).includes(tut))
          : allJoined;

        const cPend = scopedByTutor.filter((e) => e.stateGroup === "pendiente").length;
        const cDeriv = scopedByTutor.filter((e) => e.stateGroup === "derivada").length;
        const cCorr = scopedByTutor.filter((e) => e.stateGroup === "corregida").length;

        kpiStrip.replaceChildren();
        for (const [val, lbl, cls] of [
          [cPend, "Pendientes", "is-pending"],
          [cDeriv, "Derivadas", "is-derived"],
          [cCorr, "Corregidas", "is-corrected"],
          [scopedByTutor.length, "Total QA2", ""],
        ]) {
          const box = make("div", "incident-kpi " + cls);
          box.append(make("strong", "", val.toLocaleString("es-CL")), make("span", "", lbl));
          kpiStrip.append(box);
        }

        currentFiltered = scopedByTutor.filter((e) => {
          if (selectedState && e.stateGroup !== selectedState) return false;
          if (!q) return true;
          const haystack = norm(
            [
              e.nrc,
              e.courseName,
              e.tutor,
              e.facultad,
              incidentValue(e.item, "descripcionIncidencia", "DESCRIPCION_INCIDENCIA"),
              incidentValue(e.item, "categoria", "CATEGORIA"),
            ].join(" ")
          );
          return haystack.includes(q);
        });
        incOffset = 0;
        renderList();
      };

      for (const [val, lbl] of stateTabs) {
        const btn = make("button", "filter-tab" + (selectedState === val ? " active" : ""), lbl);
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(selectedState === val));
        btn.addEventListener("click", () => {
          selectedState = val;
          filterBar.querySelectorAll(".filter-tab").forEach((b) => {
            const active = b === btn;
            b.classList.toggle("active", active);
            b.setAttribute("aria-pressed", String(active));
          });
          applyFilters();
        });
        filterBar.append(btn);
      }

      textInput.addEventListener("input", applyFilters);
      tutorControl.select.addEventListener("input", applyFilters);
      prevBtn.addEventListener("click", () => {
        incOffset = Math.max(0, incOffset - INC_PAGE);
        renderList();
      });
      nextBtn.addEventListener("click", () => {
        incOffset += INC_PAGE;
        renderList();
      });

      applyFilters();
      // Refresh home KPI counts with latest incidents
      renderHomeDashboard(allCourses, allIncidents);
    } catch (e) {
      body.replaceChildren(
        make(
          "p",
          "native-incident-error",
          "No fue posible consultar las incidencias: " +
            e.message +
            ". Comprueba la conexión e intenta actualizar."
        )
      );
    } finally {
      refresh.disabled = false;
    }
  };

  refresh.addEventListener("click", () => load(true));
  load(false);
  window.scrollTo(0, 0);
}

// ─── REPORTS MODULE (EXCEL + CSV EXPORT) ─────────────────────────────────────
function ensureXlsxLoaded() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = XLSX_CDN_URL;
    script.async = true;
    script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX no disponible")));
    script.onerror = () => reject(new Error("Sin conexión para cargar el generador Excel"));
    document.head.append(script);
  });
}

function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportRows(rows, baseFilename, format) {
  if (!rows.length) {
    showToast("No hay registros para exportar con los filtros actuales.", "error");
    return;
  }
  const stamp = formatLocalDateKey(new Date());
  if (format === "csv") {
    const csv = generateCSVFromRows(rows);
    triggerFileDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${baseFilename}_${stamp}.csv`);
    showToast(`CSV descargado (${rows.length.toLocaleString("es-CL")} registros)`, "success");
    return;
  }
  try {
    const XLSX = await ensureXlsxLoaded();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_ETOP");
    XLSX.writeFile(wb, `${baseFilename}_${stamp}.xlsx`);
    showToast(`Excel descargado (${rows.length.toLocaleString("es-CL")} registros)`, "success");
  } catch {
    const csv = generateCSVFromRows(rows);
    triggerFileDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${baseFilename}_${stamp}.csv`);
    showToast("Sin conexión para .xlsx; se descargó en formato CSV compatible con Excel.", "success");
  }
}

async function openReports() {
  hideAllPages();
  reportsPage.hidden = false;
  activateNav("Reportes");
  reportsPage.replaceChildren(
    make("h2", "", "Reportes y exportación"),
    make("p", "detail-caption", "Preparando catálogo para exportación…")
  );
  window.scrollTo(0, 0);

  try {
    const data = await loadCourses();
    const incs = incidentsRaw || (await loadIncidents().catch(() => []));
    reportsPage.replaceChildren();

    const header = make("div", "page-header-row");
    header.append(make("h2", "", "Reportes y exportación"));
    const backBtn = make("button", "inline-btn", "← Inicio");
    backBtn.type = "button";
    backBtn.addEventListener("click", showMain);
    header.append(backBtn);
    reportsPage.append(
      header,
      make(
        "p",
        "detail-caption",
        "Filtra el catálogo ETOP y descarga reportes listos en Excel (.xlsx) o CSV compatible con Excel sin salir del celular."
      )
    );

    const card = make("section", "reports-card");
    card.append(make("h3", "", "Reporte de cursos del catálogo"));

    const filtersGrid = make("div", "calendar-filters");
    const statuses = [...new Set(data.map((c) => field(c, "estado", "ESTADO_CAL")).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
    const faculties = [...new Set(data.map((c) => field(c, "facultad", "FACULTAD")).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
    const tutors = [...new Set(data.map((c) => field(c, "tutor", "NOMBRE_TUTOR")).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es")
    );

    const fEstado = optionSelect("Estado", statuses, "rep-");
    const fFacultad = optionSelect("Facultad", faculties, "rep-");
    const fTutor = optionSelect("Tutor", tutors, "rep-");
    if (activeTutorScope()) fTutor.select.value = activeTutorScope();

    const monthWrap = make("label", "calendar-filter");
    monthWrap.append(make("span", "", "Mes de inicio"));
    const monthInput = make("input", "calendar-filter-input");
    monthInput.type = "month";
    monthInput.setAttribute("aria-label", "Filtrar por mes de inicio");
    monthWrap.append(monthInput);

    filtersGrid.append(fEstado.wrap, fFacultad.wrap, fTutor.wrap, monthWrap);
    card.append(filtersGrid);

    const summaryRow = make("div", "report-summary-row");
    const actionsRow = make("div", "reports-actions");
    const btnXlsx = make("button", "btn-primary", "⇩ Descargar Excel (.xlsx)");
    btnXlsx.type = "button";
    const btnCsv = make("button", "btn-secondary", "⇩ Descargar CSV");
    btnCsv.type = "button";
    actionsRow.append(btnXlsx, btnCsv);

    const tableScroll = make("div", "table-scroll");
    card.append(summaryRow, actionsRow, tableScroll);
    reportsPage.append(card);

    let currentRows = [];

    const updatePreview = () => {
      const filtered = sortCoursesByRelevance(
        filterCourses(data, {
          status: fEstado.select.value,
          faculty: fFacultad.select.value,
          tutor: fTutor.select.value,
          monthPrefix: monthInput.value,
        })
      );
      currentRows = filtered;

      const cAct = filtered.filter((c) => norm(field(c, "estado", "ESTADO_CAL")) === "activo").length;
      const cCierre = filtered.filter((c) => norm(field(c, "estado", "ESTADO_CAL")).includes("cierre")).length;
      const cPrep = filtered.filter((c) => norm(field(c, "estado", "ESTADO_CAL")).includes("prepar")).length;

      summaryRow.replaceChildren();
      for (const [lbl, val] of [
        ["Coincidencias", filtered.length.toLocaleString("es-CL")],
        ["Activos", cAct.toLocaleString("es-CL")],
        ["En cierre", cCierre.toLocaleString("es-CL")],
        ["Preparación", cPrep.toLocaleString("es-CL")],
      ]) {
        const span = make("span", "");
        span.append(document.createTextNode(`${lbl}: `), make("strong", "", val));
        summaryRow.append(span);
      }

      tableScroll.replaceChildren();
      if (!filtered.length) {
        tableScroll.append(make("p", "native-incident-message", "Sin cursos para los filtros elegidos."));
        return;
      }
      const table = make("table", "data-table");
      const thead = make("thead");
      const trH = make("tr");
      ["NRC", "Curso", "Estado", "Tutor", "Inicio"].forEach((h) => trH.append(make("th", "", h)));
      thead.append(trH);

      const tbody = make("tbody");
      filtered.slice(0, 12).forEach((c) => {
        const tr = make("tr");
        [
          field(c, "nrc", "NRC_COD_CAL"),
          field(c, "nombre curso", "NOMBRE_CURSO"),
          field(c, "estado", "ESTADO_CAL"),
          field(c, "tutor", "NOMBRE_TUTOR"),
          field(c, "fecha inicio", "FECHA_INICIO"),
        ].forEach((val) => tr.append(make("td", "", val || "—")));
        tbody.append(tr);
      });
      table.append(thead, tbody);
      tableScroll.append(table);
    };

    [fEstado.select, fFacultad.select, fTutor.select, monthInput].forEach((el) =>
      el.addEventListener("input", updatePreview)
    );
    btnXlsx.addEventListener("click", () =>
      exportRows(buildCourseExportRows(currentRows), "ETOP_Cursos", "xlsx")
    );
    btnCsv.addEventListener("click", () =>
      exportRows(buildCourseExportRows(currentRows), "ETOP_Cursos", "csv")
    );
    updatePreview();

    // Incidents export card
    const joinedInc = joinIncidentsWithCourses(incs, data);
    const incCard = make("section", "reports-card");
    incCard.append(
      make("h3", "", "Reporte de incidencias QA2"),
      make(
        "p",
        "detail-caption",
        `${joinedInc.length.toLocaleString("es-CL")} incidencias activas/registradas cruzadas con NRC y tutor.`
      )
    );
    const incActions = make("div", "reports-actions");
    const incXlsx = make("button", "btn-primary", "⇩ Incidencias (.xlsx)");
    incXlsx.type = "button";
    const incCsv = make("button", "btn-secondary", "⇩ Incidencias (.csv)");
    incCsv.type = "button";
    const buildIncExport = () =>
      joinedInc.map((e) => ({
        ID: incidentValue(e.item, "idIncidencia", "id", "ID"),
        NRC: e.nrc,
        Curso: e.courseName,
        Tutor: e.tutor,
        Facultad: e.facultad,
        Estado: e.stateRaw,
        Tipo_QA: incidentValue(e.item, "tipoQA", "TIPO_QA"),
        Categoria: incidentValue(e.item, "categoria", "CATEGORIA"),
        Semana: incidentValue(e.item, "semanaUnidad", "semana"),
        Descripcion: incidentValue(e.item, "descripcionIncidencia", "DESCRIPCION_INCIDENCIA"),
        Solucion: incidentValue(e.item, "descripcionSolucion", "DESCRIPCION_SOLUCION"),
      }));
    incXlsx.addEventListener("click", () => exportRows(buildIncExport(), "ETOP_Incidencias_QA2", "xlsx"));
    incCsv.addEventListener("click", () => exportRows(buildIncExport(), "ETOP_Incidencias_QA2", "csv"));
    incActions.append(incXlsx, incCsv);
    incCard.append(incActions);
    reportsPage.append(incCard);
  } catch {
    reportsPage.append(
      make("p", "native-incident-error", "No se pudo preparar el módulo de reportes sin datos del catálogo.")
    );
  }
}

// ─── SETTINGS MODULE (DEFAULT TUTOR & OFFLINE SYNC) ──────────────────────────
async function openSettings() {
  hideAllPages();
  settingsPage.hidden = false;
  activateNav("Ajustes");
  settingsPage.replaceChildren();
  window.scrollTo(0, 0);

  const header = make("div", "page-header-row");
  header.append(make("h2", "", "Ajustes de coordinación"));
  const backBtn = make("button", "inline-btn", "← Inicio");
  backBtn.type = "button";
  backBtn.addEventListener("click", showMain);
  header.append(backBtn);
  settingsPage.append(header);

  const data = courses || (await loadCourses().catch(() => []));
  const tutors = [...new Set(data.map((c) => field(c, "tutor", "NOMBRE_TUTOR")).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );

  // Profile card
  const profileCard = make("section", "settings-card");
  profileCard.append(
    make("h3", "", "Mi cartera de tutoría"),
    make(
      "p",
      "detail-caption",
      "Configura tu nombre de tutor para filtrar el Panel Operativo, el calendario mensual y los reportes en un toque."
    )
  );

  const fieldWrap = make("div", "settings-field");
  const tutorLabel = make("label", "", "Tutor predeterminado");
  tutorLabel.setAttribute("for", "settings-tutor-input");
  const tutorInput = make("input", "calendar-filter-input");
  tutorInput.id = "settings-tutor-input";
  tutorInput.type = "search";
  tutorInput.placeholder = "Ej: MARTA GONZALEZ";
  tutorInput.value = prefs.defaultTutor || "";
  const tutorList = make("datalist");
  tutorList.id = "settings-tutor-list";
  tutors.forEach((t) => tutorList.append(new Option(t, t)));
  tutorInput.setAttribute("list", tutorList.id);
  fieldWrap.append(tutorLabel, tutorInput, tutorList);

  const chkLabel = make("label", "checkbox-row");
  const chk = make("input");
  chk.type = "checkbox";
  chk.id = "settings-filter-home";
  chk.checked = Boolean(prefs.filterHomeByTutor);
  chkLabel.append(chk, document.createTextNode("Filtrar el Inicio y el calendario por mi cartera automáticamente"));

  const profileActions = make("div", "reports-actions");
  const saveBtn = make("button", "btn-primary", "Guardar preferencias");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    prefs = {
      defaultTutor: safe(tutorInput.value),
      filterHomeByTutor: Boolean(chk.checked && safe(tutorInput.value)),
    };
    writeJson(STORAGE_KEYS.prefs, prefs);
    if (courses) {
      renderHomeDashboard(courses, incidentsRaw || []);
      updateReadyStatus();
    }
    renderPortfolioBanner();
    showToast("Preferencias guardadas en este dispositivo.", "success");
  });

  const clearTutorBtn = make("button", "btn-secondary", "Ver todo el catálogo");
  clearTutorBtn.type = "button";
  clearTutorBtn.addEventListener("click", () => {
    tutorInput.value = "";
    chk.checked = false;
    prefs = { defaultTutor: "", filterHomeByTutor: false };
    writeJson(STORAGE_KEYS.prefs, prefs);
    if (courses) {
      renderHomeDashboard(courses, incidentsRaw || []);
      updateReadyStatus();
    }
    renderPortfolioBanner();
    showToast("Filtro de cartera desactivado.");
  });

  profileActions.append(saveBtn, clearTutorBtn);
  profileCard.append(fieldWrap, chkLabel, profileActions);
  settingsPage.append(profileCard);

  // Sync & offline card
  const syncCard = make("section", "settings-card");
  syncCard.append(make("h3", "", "Catálogo y consulta sin conexión"));

  const metaGrid = make("div", "sync-meta-grid");
  for (const [val, lbl] of [
    [courses ? courses.length.toLocaleString("es-CL") : "—", "Cursos cargados"],
    [incidentsRaw ? incidentsRaw.length.toLocaleString("es-CL") : "—", "Registros QA2"],
    [formatSyncTimestamp(lastSyncInfo.coursesAt), "Última sincronización"],
    [navigator.onLine ? "En línea" : "Sin conexión", "Estado de red"],
  ]) {
    const box = make("div", "metric-box");
    box.append(make("strong", "", val), make("span", "", lbl));
    metaGrid.append(box);
  }
  syncCard.append(metaGrid);

  const syncActions = make("div", "reports-actions");
  const forceSyncBtn = make("button", "btn-primary", "↻ Sincronizar catálogo ahora");
  forceSyncBtn.type = "button";
  forceSyncBtn.addEventListener("click", async () => {
    forceSyncBtn.disabled = true;
    await refreshAllData(true);
    openSettings();
  });

  const clearLocalBtn = make("button", "btn-secondary btn-danger-outline", "Limpiar fijados e historial");
  clearLocalBtn.type = "button";
  clearLocalBtn.addEventListener("click", () => {
    favorites = [];
    recentSearches = [];
    writeJson(STORAGE_KEYS.favorites, favorites);
    writeJson(STORAGE_KEYS.recents, recentSearches);
    renderFavorites();
    renderRecentSearches();
    showToast("Cursos fijados e historial eliminados.");
  });

  syncActions.append(forceSyncBtn, clearLocalBtn);
  syncCard.append(
    syncActions,
    make(
      "p",
      "detail-caption",
      "El Service Worker guarda la última descarga de nrcs.json e incidencias.json para permitir consultas en terreno incluso sin señal."
    )
  );
  settingsPage.append(syncCard);
}

// ─── HOME DASHBOARD ──────────────────────────────────────────────────────────
function dashboardCard(label, count, description, action, extraClass = "") {
  const b = make("button", "dashboard-card " + extraClass);
  b.type = "button";
  if (extraClass.includes("card-span-2")) {
    const meta = make("div", "card-meta");
    meta.append(make("span", "", label), make("small", "", description));
    b.append(meta, make("strong", "", String(count)));
  } else {
    b.append(
      make("strong", "", String(count)),
      make("span", "", label),
      make("small", "", description)
    );
  }
  b.addEventListener("click", action);
  return b;
}

function renderHomeDashboard(data, incidents = []) {
  homeDashboard.replaceChildren();
  const scope = activeTutorScope();
  const stats = computeDashboardStats(data, incidents, { onlyTutor: scope });

  const h = make("div", "dashboard-heading");
  h.append(
    make("h2", "", scope ? "Panel de mi cartera" : "Panel operativo"),
    make("span", "", lastSyncInfo.coursesAt ? `Sincronizado ${formatSyncTimestamp(lastSyncInfo.coursesAt)}` : "Catálogo ETOP")
  );
  homeDashboard.append(h);

  const cards = make("div", "dashboard-grid");
  cards.append(
    dashboardCard(
      "Próximos 7 días",
      stats.upcoming.toLocaleString("es-CL"),
      "Cursos por iniciar",
      () => openCalendars(null, { upcoming: true })
    ),
    dashboardCard(
      "Activos",
      stats.active.toLocaleString("es-CL"),
      "Cursos en ejecución",
      () => openCalendars(null, { status: "ACTIVO" })
    ),
    dashboardCard(
      "En cierre",
      stats.closing.toLocaleString("es-CL"),
      "Cursos en cierre",
      () => openCalendars(null, { status: "EN CIERRE" })
    ),
    dashboardCard(
      "Total cursos",
      stats.total.toLocaleString("es-CL"),
      scope ? "En tu cartera" : "En catálogo publicado",
      () => openCalendars()
    ),
    dashboardCard(
      "Incidencias QA2 pendientes",
      incidentsRaw ? stats.pendingIncidents.toLocaleString("es-CL") : "…",
      incidentsRaw
        ? `${stats.derivedIncidents} derivadas · ${stats.totalIncidents} registradas`
        : "Consultando consolidado QA2…",
      () => openIncidents(null, { stateFilter: "pendiente" }),
      "card-span-2" + (stats.pendingIncidents > 0 ? " is-alert" : "")
    )
  );
  homeDashboard.append(cards);

  if (tileIncidentsSub && incidentsRaw) {
    tileIncidentsSub.textContent = `${stats.pendingIncidents.toLocaleString("es-CL")} pendientes · ${stats.totalIncidents.toLocaleString("es-CL")} en total`;
  }

  etopMonthCalendar(homeDashboard, stats.scopedCourses, (key) =>
    openCalendars(null, { startDate: key })
  );

  homeDashboard.append(
    make(
      "p",
      "dashboard-note",
      "Indicadores calculados a partir de los consolidados publicados (nrcs.json e incidencias.json)."
    )
  );
}

// ─── SEARCH WITH RELEVANCE SORTING & PAGINATION ──────────────────────────────
function syncSearchClearBtn() {
  searchClearBtn.hidden = !searchInput.value;
}

function renderSearchResultsPage() {
  resultsEl.replaceChildren();
  const total = searchMatches.length;

  const head = make("div", "results-head");
  head.append(
    make("h2", "", `Resultados (${total.toLocaleString("es-CL")})`),
    make("span", "section-meta", "Orden: Activos → En cierre → Próximos")
  );
  resultsEl.append(head);

  if (!total) {
    resultsEl.append(
      make(
        "p",
        "native-incident-message",
        "No encontramos coincidencias. Prueba otro NRC, código, curso, tutor o cambia el filtro de estado."
      )
    );
    return;
  }

  const list = make("div", "results-list");
  const subset = searchMatches.slice(searchOffset, searchOffset + SEARCH_PAGE_SIZE);

  for (const c of subset) {
    const nrc = field(c, "nrc", "NRC_COD_CAL");
    const name = field(c, "nombre curso", "NOMBRE_CURSO", "nombre") || "Curso sin nombre";
    const estado = field(c, "estado", "ESTADO_CAL") || "Sin estado";
    const codigo = field(c, "codigo curso", "codigo", "COD_CURSO");
    const tutor = field(c, "tutor", "NOMBRE_TUTOR");
    const facultad = field(c, "facultad", "FACULTAD");
    const inicio = field(c, "fecha inicio", "FECHA_INICIO");
    const fin = field(c, "fecha fin", "FECHA_FIN");

    const article = make("article", "course-card");
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-label", `Abrir ficha de ${name} (${nrc})`);
    article.addEventListener("click", () => openCourse(c, "home"));
    article.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCourse(c, "home");
      }
    });

    const top = make("div", "course-card-top");
    top.append(make("h3", "", name));

    const pinned = isPinned(nrc);
    const pinBtn = make("button", "pin-icon-btn" + (pinned ? " is-pinned" : ""), pinned ? "★" : "☆");
    pinBtn.type = "button";
    pinBtn.setAttribute("aria-label", pinned ? `Quitar ${name} de fijados` : `Fijar ${name}`);
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleToggleFavorite(nrc, name);
    });
    top.append(pinBtn);
    article.append(top);

    const meta = make("p", "course-meta-line");
    meta.append(make("span", `state-text ${stateClass(estado)}`, estado));
    if (nrc) meta.append(document.createTextNode(` · NRC ${nrc}`));
    if (codigo) meta.append(document.createTextNode(` · ${codigo}`));
    if (facultad) meta.append(document.createTextNode(` · ${facultad}`));
    article.append(meta);

    if (tutor) {
      const p = make("p", "");
      p.append(make("strong", "", "Tutor: "), document.createTextNode(tutor));
      article.append(p);
    }
    if (inicio || fin) {
      const p = make("p", "");
      p.append(
        make("strong", "", "Fechas: "),
        document.createTextNode(`${inicio || "—"} al ${fin || "—"}`)
      );
      article.append(p);
    }

    list.append(article);
  }
  resultsEl.append(list);

  if (total > SEARCH_PAGE_SIZE) {
    const pager = make("div", "calendar-pager");
    const prev = make("button", "", "← Anteriores");
    prev.type = "button";
    prev.disabled = searchOffset === 0;
    prev.addEventListener("click", () => {
      searchOffset = Math.max(0, searchOffset - SEARCH_PAGE_SIZE);
      renderSearchResultsPage();
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const next = make("button", "", "Siguientes →");
    next.type = "button";
    next.disabled = searchOffset + SEARCH_PAGE_SIZE >= total;
    next.addEventListener("click", () => {
      searchOffset += SEARCH_PAGE_SIZE;
      renderSearchResultsPage();
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    pager.append(prev, next);
    resultsEl.append(
      make(
        "p",
        "result-note",
        `Mostrando ${searchOffset + 1}–${Math.min(searchOffset + SEARCH_PAGE_SIZE, total)} de ${total.toLocaleString("es-CL")} coincidencias.`
      ),
      pager
    );
  }
}

async function runSearch(saveToHistory = true) {
  const rawTerm = safe(searchInput.value);
  const term = norm(rawTerm);
  if (!term && !activeStatusFilter) {
    resultsEl.replaceChildren();
    searchMatches = [];
    updateReadyStatus();
    return;
  }

  try {
    const data = await loadCourses();
    if (saveToHistory && term.length >= 2) {
      recentSearches = pushRecentSearch(recentSearches, rawTerm);
      writeJson(STORAGE_KEYS.recents, recentSearches);
      renderRecentSearches();
    }
    const filtered = filterCourses(data, {
      term: rawTerm,
      status: activeStatusFilter,
      onlyTutor: activeTutorScope(),
    });
    searchMatches = sortCoursesByRelevance(filtered);
    searchOffset = 0;
    statusEl.textContent = `${searchMatches.length.toLocaleString("es-CL")} coincidencias · Fuente: catálogo publicado por ETOP.`;
    renderSearchResultsPage();
  } catch (e) {
    statusEl.textContent =
      "No se pudo consultar el catálogo de cursos. Comprueba tu conexión o vuelve a intentar.";
    resultsEl.replaceChildren();
    console.error("Error de consulta ETOP:", e.message);
  }
}

// ─── GLOBAL REFRESH & HASH ROUTING ───────────────────────────────────────────
async function refreshAllData(showFeedback = false) {
  headerRefreshBtn.disabled = true;
  headerRefreshBtn.textContent = "↻ Sincronizando…";
  try {
    const [courseData, incidentData] = await Promise.all([
      loadCourses(true),
      loadIncidents(true).catch(() => incidentsRaw || []),
    ]);
    renderHomeDashboard(courseData, incidentData);
    renderFavorites();
    updateReadyStatus();
    if (showFeedback) {
      showToast(`Catálogo actualizado (${courseData.length.toLocaleString("es-CL")} cursos)`, "success");
    }
  } catch {
    if (showFeedback) {
      showToast("No fue posible actualizar desde la red; se mantiene la copia disponible.", "error");
    }
  } finally {
    headerRefreshBtn.disabled = false;
    headerRefreshBtn.textContent = "↻ Actualizar";
  }
}

function handleHashRoute() {
  const hash = (window.location.hash || "").toLowerCase();
  if (hash === "#cursos") {
    openCalendars();
  } else if (hash === "#incidencias") {
    openIncidents(null, { stateFilter: "pendiente" });
  } else if (hash === "#reportes") {
    openReports();
  } else if (hash === "#ajustes") {
    openSettings();
  } else {
    showMain();
  }
}

// ─── EVENT BINDINGS ──────────────────────────────────────────────────────────
searchBtn.addEventListener("click", () => runSearch(true));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch(true);
});

let searchDebounce = null;
searchInput.addEventListener("input", () => {
  syncSearchClearBtn();
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    if (searchInput.value.trim().length >= 2 || activeStatusFilter) {
      runSearch(false);
    } else if (!searchInput.value.trim()) {
      resultsEl.replaceChildren();
      searchMatches = [];
      updateReadyStatus();
    }
  }, 240);
});

searchClearBtn.addEventListener("click", () => {
  searchInput.value = "";
  syncSearchClearBtn();
  if (activeStatusFilter) {
    runSearch(false);
  } else {
    resultsEl.replaceChildren();
    searchMatches = [];
    updateReadyStatus();
  }
  searchInput.focus();
});

document.querySelectorAll("[data-status-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeStatusFilter = btn.dataset.statusFilter || "";
    document.querySelectorAll("[data-status-filter]").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    runSearch(false);
  });
});

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;
    if (tool === "Calendarios") openCalendars();
    else if (tool === "Incidencias") openIncidents(null, { stateFilter: "pendiente" });
    else if (tool === "Reportes") openReports();
  });
});

document.querySelectorAll("button[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    const nav = button.dataset.nav;
    if (nav === "Inicio") {
      history.replaceState(null, "", "#inicio");
      showMain();
      window.scrollTo(0, 0);
    } else if (nav === "Cursos") {
      history.replaceState(null, "", "#cursos");
      openCalendars();
    } else if (nav === "Reportes") {
      history.replaceState(null, "", "#reportes");
      openReports();
    } else if (nav === "Ajustes") {
      history.replaceState(null, "", "#ajustes");
      openSettings();
    }
  });
});

headerRefreshBtn.addEventListener("click", () => refreshAllData(true));
window.addEventListener("hashchange", handleHashRoute);

// ─── INITIAL BOOT ────────────────────────────────────────────────────────────
renderPortfolioBanner();
renderRecentSearches();

Promise.allSettled([loadCourses(), loadIncidents()]).then(([coursesRes, incidentsRes]) => {
  if (coursesRes.status === "fulfilled") {
    const courseData = coursesRes.value;
    const incData = incidentsRes.status === "fulfilled" ? incidentsRes.value : [];
    renderHomeDashboard(courseData, incData);
    renderFavorites();
    updateReadyStatus();
  } else {
    statusEl.textContent = "Sin conexión al catálogo ETOP. Intenta actualizar cuando recuperes señal.";
    homeDashboard.replaceChildren(
      make("p", "dashboard-note", "Panel operativo no disponible sin conexión al catálogo.")
    );
  }
  handleHashRoute();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
