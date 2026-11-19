import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sortCoursesByRelevance,
  filterCourses,
  joinIncidentsWithCourses,
  computeDashboardStats,
  toggleFavoriteNrc,
  pushRecentSearch,
  buildCourseExportRows,
  generateCSVFromRows,
} from './etop-core.js';

const sampleCourses = [
  {
    id: '1',
    nrc: '1507_MBAES614_202681',
    'codigo curso': 'MBAES614',
    'nombre curso': 'Proyecto de Grado',
    estado: 'PREPARACION',
    tutor: 'MARTA GONZALEZ',
    facultad: 'MEDI',
    intake: 'MAG_MBAES_V1',
    'fecha inicio': '2028-04-01',
    'fecha fin': '2028-04-30',
  },
  {
    id: '2',
    nrc: '1492_MBAES601_202683',
    'codigo curso': 'MBAES601',
    'nombre curso': 'Administración en Salud',
    estado: 'ACTIVO',
    tutor: 'MARTA GONZALEZ',
    facultad: 'MEDI',
    intake: 'MAG_MBAES_V1',
    'fecha inicio': '2026-11-22',
    'fecha fin': '2026-12-20',
  },
  {
    id: '3',
    nrc: '1089_MBAES613_202582',
    'codigo curso': 'MBAES613',
    'nombre curso': 'Taller de Proyecto',
    estado: 'CERRADO',
    tutor: 'HANS NOVAKOVIC',
    facultad: 'FACEA',
    intake: 'MAG_MBAES_V0',
    'fecha inicio': '2026-08-01',
    'fecha fin': '2026-08-31',
  },
  {
    id: '4',
    nrc: '1669_MBAES604_202682',
    'codigo curso': 'MBAES604',
    'nombre curso': 'Economía de la Salud',
    estado: 'EN CIERRE',
    tutor: 'MARTA GONZALEZ',
    facultad: 'MEDI',
    intake: 'MAG_MBAES_V2',
    'fecha inicio': '2026-11-01',
    'fecha fin': '2026-11-25',
  },
];

const sampleIncidents = [
  {
    idIncidencia: 'INC-10',
    cursoId: '2',
    qaIncidencias: 'CON INCIDENCIA',
    estadoIncidencia: 'PENDIENTE',
    descripcionIncidencia: 'Enlace roto en semana 2',
  },
  {
    idIncidencia: 'INC-11',
    cursoId: '3',
    qaIncidencias: 'CON INCIDENCIA',
    estadoIncidencia: 'CORREGIDA',
    descripcionIncidencia: 'Rúbrica actualizada',
  },
  {
    idIncidencia: 'INC-12',
    cursoId: '2',
    qaIncidencias: 'SIN INCIDENCIA',
    estadoIncidencia: 'PENDIENTE',
    descripcionIncidencia: 'No debe contarse',
  },
];

test('sortCoursesByRelevance prioritizes ACTIVO > EN CIERRE > PREPARACION > CERRADO', () => {
  const sorted = sortCoursesByRelevance(sampleCourses, new Date(2026, 10, 19));
  assert.deepEqual(
    sorted.map((c) => c.estado),
    ['ACTIVO', 'EN CIERRE', 'PREPARACION', 'CERRADO']
  );
});

test('filterCourses supports accent-insensitive search, status, and tutor scope', () => {
  const byAccent = filterCourses(sampleCourses, { term: 'administracion' });
  assert.equal(byAccent.length, 1);
  assert.equal(byAccent[0].id, '2');

  const byTutor = filterCourses(sampleCourses, { onlyTutor: 'MARTA GONZALEZ', status: 'ACTIVO' });
  assert.equal(byTutor.length, 1);
  assert.equal(byTutor[0].nrc, '1492_MBAES601_202683');

  const upcoming = filterCourses(sampleCourses, {
    upcoming: true,
    nowDate: new Date(2026, 10, 19),
  });
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].id, '2');
});

test('joinIncidentsWithCourses filters CON INCIDENCIA and attaches course details', () => {
  const joined = joinIncidentsWithCourses(sampleIncidents, sampleCourses);
  assert.equal(joined.length, 2);
  assert.equal(joined[0].stateGroup, 'pendiente');
  assert.equal(joined[0].nrc, '1492_MBAES601_202683');
  assert.equal(joined[0].tutor, 'MARTA GONZALEZ');
  assert.equal(joined[1].stateGroup, 'corregida');
});

test('computeDashboardStats computes global and tutor-scoped KPIs including pending incidents', () => {
  const globalStats = computeDashboardStats(sampleCourses, sampleIncidents, {
    nowDate: new Date(2026, 10, 19),
  });
  assert.equal(globalStats.total, 4);
  assert.equal(globalStats.active, 1);
  assert.equal(globalStats.closing, 1);
  assert.equal(globalStats.upcoming, 1);
  assert.equal(globalStats.pendingIncidents, 1);
  assert.equal(globalStats.correctedIncidents, 1);

  const martaStats = computeDashboardStats(sampleCourses, sampleIncidents, {
    onlyTutor: 'MARTA GONZALEZ',
    nowDate: new Date(2026, 10, 19),
  });
  assert.equal(martaStats.total, 3);
  assert.equal(martaStats.pendingIncidents, 1);
  assert.equal(martaStats.correctedIncidents, 0);
});

test('favorites and recent searches helpers toggle and deduplicate cleanly', () => {
  let favs = toggleFavoriteNrc([], '1492_MBAES601_202683');
  assert.deepEqual(favs, ['1492_MBAES601_202683']);
  favs = toggleFavoriteNrc(favs, '1507_MBAES614_202681');
  assert.deepEqual(favs, ['1507_MBAES614_202681', '1492_MBAES601_202683']);
  favs = toggleFavoriteNrc(favs, '1492_MBAES601_202683');
  assert.deepEqual(favs, ['1507_MBAES614_202681']);

  let recents = pushRecentSearch([], 'MBA');
  recents = pushRecentSearch(recents, 'salud');
  recents = pushRecentSearch(recents, 'mba');
  assert.deepEqual(recents, ['mba', 'salud']);
});

test('CSV export includes BOM and escapes quotes and commas', () => {
  const rows = buildCourseExportRows([
    {
      nrc: '100_TEST',
      'nombre curso': 'Gestión, "Calidad" y Salud',
      estado: 'ACTIVO',
    },
  ]);
  const csv = generateCSVFromRows(rows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Gestión, ""Calidad"" y Salud"/);
});
