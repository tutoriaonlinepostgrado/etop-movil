export function norm(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

export function safe(value) {
  return String(value ?? "").trim();
}

export function field(obj, ...keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return safe(obj[key]);
    }
  }
  return "";
}

export function etopDate(v) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function etopStartKey(c) {
  const d = etopDate(field(c, "fecha inicio", "FECHA_INICIO"));
  if (!d || Number.isNaN(d.getTime())) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function statusRank(course) {
  const s = norm(field(course, "estado", "ESTADO_CAL"));
  if (s === "activo") return 0;
  if (s.includes("cierre")) return 1;
  if (s.includes("prepar")) return 2;
  if (s.includes("cerrado") || s.includes("finaliz") || s.includes("termin")) return 4;
  return 3;
}

export function sortCoursesByRelevance(list, nowDate = new Date()) {
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  return [...list].sort((a, b) => {
    const rankDiff = statusRank(a) - statusRank(b);
    if (rankDiff !== 0) return rankDiff;
    const da = etopDate(field(a, "fecha inicio", "FECHA_INICIO"));
    const db = etopDate(field(b, "fecha inicio", "FECHA_INICIO"));
    const ta = da ? da.getTime() : Number.MAX_SAFE_INTEGER;
    const tb = db ? db.getTime() : Number.MAX_SAFE_INTEGER;
    const rank = statusRank(a);
    if (rank === 4) {
      // Closed courses: most recently started first
      if (ta !== tb) return tb - ta;
    } else if (rank === 2) {
      // Preparation courses: closest upcoming start date first
      const distA = Math.abs(ta - today);
      const distB = Math.abs(tb - today);
      if (distA !== distB) return distA - distB;
    } else {
      // Active / Closing: soonest start date first
      if (ta !== tb) return ta - tb;
    }
    return field(a, "nombre curso", "NOMBRE_CURSO").localeCompare(
      field(b, "nombre curso", "NOMBRE_CURSO"),
      "es"
    );
  });
}

export function filterCourses(courses, opts = {}) {
  const {
    term = "",
    status = "",
    faculty = "",
    tutor = "",
    intake = "",
    startDate = "",
    monthPrefix = "",
    upcoming = false,
    onlyTutor = "",
    nowDate = new Date(),
  } = opts;

  const q = norm(term);
  const st = norm(status);
  const fac = norm(faculty);
  const tut = norm(tutor);
  const intk = norm(intake);
  const lockedTutor = norm(onlyTutor);
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());

  return (courses || []).filter((c) => {
    if (lockedTutor && norm(field(c, "tutor", "NOMBRE_TUTOR")) !== lockedTutor) {
      return false;
    }
    if (startDate && etopStartKey(c) !== startDate) {
      return false;
    }
    if (monthPrefix && !etopStartKey(c).startsWith(monthPrefix)) {
      return false;
    }
    if (upcoming) {
      const d = etopDate(field(c, "fecha inicio", "FECHA_INICIO"));
      if (!d || d < today || (d - today) / 86400000 > 7) return false;
    }
    if (st) {
      const courseStatus = norm(field(c, "estado", "ESTADO_CAL"));
      if (st === "en cierre") {
        if (!courseStatus.includes("cierre")) return false;
      } else if (!courseStatus.includes(st)) {
        return false;
      }
    }
    if (fac && !norm(field(c, "facultad", "FACULTAD")).includes(fac)) {
      return false;
    }
    if (tut && !norm(field(c, "tutor", "NOMBRE_TUTOR")).includes(tut)) {
      return false;
    }
    if (intk && !norm(field(c, "intake", "INTAKE")).includes(intk)) {
      return false;
    }
    if (q) {
      const match = [
        "nrc",
        "NRC_COD_CAL",
        "codigo curso",
        "codigo",
        "COD_CURSO",
        "nombre curso",
        "NOMBRE_CURSO",
        "tutor",
        "NOMBRE_TUTOR",
        "intake",
        "INTAKE",
        "facultad",
        "FACULTAD",
        "programa",
        "PROGRAMA",
      ].some((k) => norm(c[k]).includes(q) && safe(c[k]));
      if (!match) return false;
    }
    return true;
  });
}

export function incidentValue(x, ...keys) {
  for (const k of keys) {
    const v = x?.[k];
    if (v !== undefined && v !== null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}

export function classifyIncidentState(item) {
  const state = norm(incidentValue(item, "estadoIncidencia", "ESTADO_INCIDENCIA"));
  if (state.includes("pendiente")) return "pendiente";
  if (state.includes("corregid") || state.includes("resuelt") || state.includes("cerrad")) return "corregida";
  if (state.includes("derivad")) return "derivada";
  return "otro";
}

export function joinIncidentsWithCourses(incidents, courses) {
  const courseById = new Map();
  for (const c of courses || []) {
    const id = field(c, "id", "ID");
    if (id) courseById.set(id, c);
  }
  const out = [];
  for (const item of incidents || []) {
    if (incidentValue(item, "qaIncidencias").toUpperCase() !== "CON INCIDENCIA") continue;
    const cursoId = safe(item.cursoId ?? item.CURSO_ID ?? "");
    const course = cursoId ? courseById.get(cursoId) || null : null;
    const stateGroup = classifyIncidentState(item);
    out.push({
      item,
      course,
      cursoId,
      stateRaw: incidentValue(item, "estadoIncidencia", "ESTADO_INCIDENCIA").toUpperCase() || "SIN ESTADO",
      stateGroup,
      nrc: course ? field(course, "nrc", "NRC_COD_CAL") : incidentValue(item, "nrc", "NRC_COD_CAL"),
      courseName: course
        ? field(course, "nombre curso", "NOMBRE_CURSO", "nombre")
        : incidentValue(item, "nombreCurso", "NOMBRE_CURSO") || "Curso sin detalle",
      tutor: course ? field(course, "tutor", "NOMBRE_TUTOR") : incidentValue(item, "tutor", "NOMBRE_TUTOR"),
      facultad: course ? field(course, "facultad", "FACULTAD") : incidentValue(item, "facultad", "FACULTAD"),
    });
  }
  const order = { pendiente: 0, derivada: 1, otro: 2, corregida: 3 };
  out.sort((a, b) => (order[a.stateGroup] ?? 9) - (order[b.stateGroup] ?? 9));
  return out;
}

export function computeDashboardStats(courses, incidents = [], opts = {}) {
  const { onlyTutor = "", nowDate = new Date() } = opts;
  const scopedCourses = onlyTutor ? filterCourses(courses, { onlyTutor, nowDate }) : courses || [];
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  let upcoming = 0;
  let active = 0;
  let closing = 0;

  for (const c of scopedCourses) {
    const d = etopDate(field(c, "fecha inicio", "FECHA_INICIO"));
    if (d && d >= today && (d - today) / 86400000 <= 7) upcoming++;
    const st = norm(field(c, "estado", "ESTADO_CAL"));
    if (st === "activo") active++;
    if (st.includes("cierre")) closing++;
  }

  const joinedIncidents = joinIncidentsWithCourses(incidents, courses);
  const lockedTutor = norm(onlyTutor);
  const scopedIncidents = lockedTutor
    ? joinedIncidents.filter((entry) => norm(entry.tutor) === lockedTutor)
    : joinedIncidents;

  let pendingIncidents = 0;
  let derivedIncidents = 0;
  let correctedIncidents = 0;
  for (const entry of scopedIncidents) {
    if (entry.stateGroup === "pendiente") pendingIncidents++;
    else if (entry.stateGroup === "derivada") derivedIncidents++;
    else if (entry.stateGroup === "corregida") correctedIncidents++;
  }

  return {
    upcoming,
    active,
    closing,
    total: scopedCourses.length,
    pendingIncidents,
    derivedIncidents,
    correctedIncidents,
    totalIncidents: scopedIncidents.length,
    scopedCourses,
    scopedIncidents,
  };
}

export function toggleFavoriteNrc(favorites, nrc) {
  const clean = safe(nrc);
  if (!clean) return [...(favorites || [])];
  const list = [...(favorites || [])];
  const idx = list.indexOf(clean);
  if (idx >= 0) {
    list.splice(idx, 1);
    return list;
  }
  return [clean, ...list].slice(0, 24);
}

export function pushRecentSearch(recents, term, max = 6) {
  const clean = safe(term);
  if (!clean || clean.length < 2) return [...(recents || [])];
  const lowered = norm(clean);
  const filtered = (recents || []).filter((item) => norm(item) !== lowered);
  return [clean, ...filtered].slice(0, max);
}

function escapeCsvCell(val) {
  const str = String(val ?? "");
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCourseExportRows(courses) {
  return (courses || []).map((c) => ({
    NRC: field(c, "nrc", "NRC_COD_CAL"),
    Codigo: field(c, "codigo curso", "codigo", "COD_CURSO"),
    Nombre_Curso: field(c, "nombre curso", "NOMBRE_CURSO", "nombre"),
    Estado: field(c, "estado", "ESTADO_CAL"),
    Tutor: field(c, "tutor", "NOMBRE_TUTOR"),
    Facultad: field(c, "facultad", "FACULTAD"),
    Programa: field(c, "programa", "PROGRAMA"),
    Intake: field(c, "intake", "INTAKE"),
    Fecha_Inicio: field(c, "fecha inicio", "FECHA_INICIO"),
    Fecha_Termino: field(c, "fecha fin", "FECHA_FIN"),
  }));
}

export function generateCSVFromRows(rows) {
  if (!rows || !rows.length) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}
