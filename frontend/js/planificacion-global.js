import { getPeriodos, getCursos, generarPlanificacionGlobal } from './api.js';
import { requiereSesion } from './auth.js';
import { CRITERIOS, validarComparacion, cursosPropuestos, cursosRegistrados, cursosPorOrigen, horarioVisible, estadoBusqueda, indicadores } from './planificacion-global-modelo.mjs';
import { limitesSemana, distribuirCarriles, estadosDe, horaTexto } from './horario-semanal-modelo.mjs';

const $ = id => document.getElementById(id);
const HORA = 84;
let periodos = [], resultado = null, planId = 'A', solicitud = 0, ocupado = false;
let registrados = null, conflictosPorCurso = new Map();
const formato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const numero = n => n == null || !Number.isFinite(n) ? '—' : formato.format(n);
const nombre = c => c?.nombre || '—';
const claveNombre = c => [c?.clave, c?.nombre].filter(Boolean).join(' — ') || '—';
const nombreProfesor = c => [c.profesor?.nombre, c.profesor?.apellido].filter(Boolean).join(' ') || `Profesor ${c.profesorId}`;
function crear(tag, texto = '', clase = '') { const e = document.createElement(tag); e.textContent = texto; if (clase) e.className = clase; return e; }
function opcion(id, texto) { const e = crear('option', texto); e.value = String(id); return e; }
function mensaje(texto, error = false) { $('mensaje').textContent = texto; $('mensaje').classList.toggle('pg-error', error); }
function tabla(id, encabezados, filas) {
  const thead = crear('thead'), tr = crear('tr'), tbody = crear('tbody');
  for (const h of encabezados) { const th = crear('th', h); th.scope = 'col'; tr.append(th); }
  thead.append(tr);
  for (const fila of filas) { const r = crear('tr'); for (const valor of fila) r.append(crear('td', String(valor ?? '—'))); tbody.append(r); }
  if (!filas.length) { const r = crear('tr'), c = crear('td', 'Sin registros'); c.colSpan = encabezados.length; r.append(c); tbody.append(r); }
  $(id).replaceChildren(thead, tbody);
}
function lista(id, items, vacio) {
  const ul = crear('ul', '', 'pg-lista'); for (const x of items) ul.append(crear('li', x));
  $(id).replaceChildren(items.length ? ul : crear('p', vacio));
}
function metrica(valor, titulo) { const e = crear('div', '', 'hs-metrica'); e.append(crear('strong', String(valor)), crear('span', titulo)); return e; }
function seleccionado() { return resultado?.planes.find(p => p.id === planId); }
function periodoSeleccionado() { return periodos.find(p => String(p.id) === $('periodo').value); }
function habilitar() { const p = periodoSeleccionado(); $('periodo').disabled = !periodos.length; $('generar').disabled = ocupado || !p || !['BORRADOR','VALIDADO'].includes(p.estado); }
function limpiar() {
  resultado = null;
  registrados = null;
  conflictosPorCurso.clear();
  $('resultado').hidden = true;
  $('calendario').replaceChildren();
  if ($('detalle').open) $('detalle').close();
}
function cambiarPeriodo() {
  ++solicitud; ocupado = false; limpiar();
  $('vista').value = ''; $('recurso').replaceChildren();
  const p = periodoSeleccionado();
  $('horarioReal').href = `horario-semanal.html?periodoId=${encodeURIComponent(p?.id || '')}`;
  $('necesidades').href = `planificacion-periodo.html?periodoId=${encodeURIComponent(p?.id || '')}`;
  mensaje(!p ? 'No hay periodos disponibles.' : ['BORRADOR','VALIDADO'].includes(p.estado) ? `${p.estado} · Listo para generar propuestas.` : `${p.estado} · Este periodo no admite simulación.`);
  habilitar();
}
async function iniciar() {
  const turno = ++solicitud; ocupado = true; habilitar(); limpiar(); $('reintentar').hidden = true; mensaje('Cargando periodos…');
  try {
    const datos = await getPeriodos(); if (turno !== solicitud) return;
    if (!Array.isArray(datos)) throw new Error('Respuesta de periodos no válida.');
    periodos = datos;
    $('periodo').replaceChildren(...periodos.map(p => opcion(p.id, `${p.clave} — ${p.nombre} (${p.estado})`)));
    const id = new URLSearchParams(location.search).get('periodoId');
    if (periodos.some(p => String(p.id) === id)) $('periodo').value = id;
    else if (periodos.length) $('periodo').value = String((periodos.find(p => p.estado === 'BORRADOR') || periodos.find(p => p.estado === 'VALIDADO') || periodos[0]).id);
    ocupado = false; cambiarPeriodo();
  } catch (e) { if (turno === solicitud) { periodos = []; mensaje(e.message, true); $('reintentar').hidden = false; } }
  finally { if (turno === solicitud) { ocupado = false; habilitar(); } }
}
async function generar(planInicial = 'A') {
  if (ocupado || $('generar').disabled) return;
  const id = $('periodo').value, turno = ++solicitud;
  ocupado = true; habilitar(); limpiar();
  mensaje('Generando planes A, B y C y consultando los cursos del periodo…');
  try {
    const [data, existentes] = await Promise.all([
      generarPlanificacionGlobal(id, { modo: 'ABC' }),
      getCursos(id).then(lista => cursosRegistrados(lista, id)).catch(() => null)
    ]);
    if (turno !== solicitud) return;
    resultado = validarComparacion(data, id);
    registrados = existentes;
    conflictosPorCurso = estadosDe({ conflictos: resultado.conflictosExistentes });
    planId = planInicial;
    const parcial = registrados === null;
    $('errorCursos').hidden = !parcial;
    for (const opcion of $('origen').options) opcion.disabled = parcial && opcion.value !== 'propuesto';
    $('origen').value = parcial ? 'propuesto' : 'todos';
    renderizarComparacion(); renderizarPlan(); $('resultado').hidden = false;
    mensaje(parcial ? 'Planes disponibles. La vista semanal es parcial.' : 'Simulación lista para consultar.');
    return true;
  } catch (e) { if (turno === solicitud) { limpiar(); mensaje(e.message || 'No se pudieron generar los planes.', true); } }
  finally { if (turno === solicitud) { ocupado = false; habilitar(); } }
}
function renderizarComparacion() {
  const r = resultado.planes[0].resumen;
  $('resumen').replaceChildren(metrica(r.necesidadesActivas, 'Necesidades activas'), metrica(r.asignadasAntes, 'Asignadas antes'), metrica(r.pendientesAntes, 'Pendientes antes'), metrica(r.omitidas, 'Omitidas'));
  tabla('comparacion', ['Plan','Nuevas','Sin asignar','Cobertura proyectada','Calificación /10','Carga RMS','Carga máxima','Huecos'], resultado.planes.map(p => {
    const [n, s, c, q, rms, max, h] = indicadores(p);
    return [`${p.id} — ${p.nombre}`, n, s, `${numero(c)} %`, numero(q), `${numero(rms)} %`, `${numero(max)} %`, `${numero(h)} min`];
  }));
  $('planes').replaceChildren(...resultado.planes.map(p => {
    const b = crear('button', `Plan ${p.id} — ${p.nombre}`); b.type = 'button'; b.dataset.plan = p.id;
    b.addEventListener('click', () => { planId = p.id; renderizarPlan(); }); return b;
  }));
}
function renderizarPlan() {
  const p = seleccionado(); if (!p) return;
  $('planes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plan === planId)));
  $('tituloPlan').textContent = `Plan ${p.id} — ${p.nombre}`; $('criterio').textContent = CRITERIOS[p.id]; $('busqueda').textContent = estadoBusqueda(p.busqueda);
  tabla('asignaciones', ['Materia','Grupo','Profesor','Salón','Horario','Calificación','Carga final','Advertencias'], p.asignaciones.map(({ alternativa:a }) => [claveNombre(a.materia), claveNombre(a.grupo), nombre(a.profesor), claveNombre(a.salon), a.horario.horarios.map(h => `${h.dia} ${h.horaInicio}–${h.horaFin}`).join('; '), numero(a.calificacion), `${a.carga.resultante}/${a.carga.maxima} h`, (a.advertencias || []).join('; ') || '—']));
  lista('sinAsignar', p.sinAsignar.map(x => `${claveNombre(x.necesidad.materia)} · ${claveNombre(x.necesidad.grupo)}: ${x.motivo} (${x.alternativasEvaluables} alternativas evaluables).`), 'Todas las necesidades pendientes quedaron cubiertas en esta propuesta.');
  lista('conflictos', resultado.conflictosExistentes.map(x => `${x.materia} · ${x.grupo}: ${x.motivo}`), 'El backend no reportó conflictos en cursos existentes al generar la propuesta.');
  $('tituloDetalle').textContent = `Detalle del plan ${p.id}`;
  $('tituloHorario').textContent = `Horario semanal · Plan ${p.id}`;
  renderizarHorario();
}
function actualizarRecursos(cursos) {
  const campo = $('vista').value, anterior = $('recurso').value;
  $('recursoLabel').hidden = !campo;
  $('recurso').replaceChildren(opcion('', 'Todos'));
  if (!campo) return;
  const tipo = campo.replace(/Id$/, '');
  $('nombreRecurso').textContent = $('vista').selectedOptions[0].textContent;
  const entidades = new Map(cursos.map(c => [String(c[campo]), tipo === 'profesor' ? nombreProfesor(c) : claveNombre(c[tipo])]));
  for (const [id, etiqueta] of [...entidades].sort((a, b) => a[1].localeCompare(b[1], 'es'))) {
    $('recurso').append(opcion(id, etiqueta));
  }
  if (entidades.has(anterior)) $('recurso').value = anterior;
}
function conflictoDe(curso) {
  return curso.origen === 'existente' ? conflictosPorCurso.get(String(curso.id)) : null;
}
function detalle(s) {
  const c = s.curso, existente = c.origen === 'existente';
  $('detalleTitulo').textContent = nombre(c.materia);
  const campos = [
    ['Origen', existente ? 'Curso existente' : `Propuesta del plan ${planId}`],
    ['Horario', `${s.dia} ${s.horario.horaInicio}–${s.horario.horaFin}`],
    ['Profesor', nombreProfesor(c)], ['Grupo', claveNombre(c.grupo)], ['Salón', claveNombre(c.salon)]
  ];
  if (existente) {
    campos.push(['Curso registrado', `#${c.id} · ${c.estado}`],
      ['Conflictos al simular', conflictoDe(c)?.motivo || 'Sin conflictos reportados']);
  } else {
    campos.push(['Necesidad', `#${c.necesidadId}`], ['Calificación', numero(c.calificacion)],
      ['Carga final', `${c.carga.resultante}/${c.carga.maxima} h`], ['Advertencias', c.advertencias.join(' · ') || '—']);
  }
  const dl = crear('dl');
  for (const [k, v] of campos) dl.append(crear('dt', k), crear('dd', v));
  $('detalleContenido').replaceChildren(dl); $('detalle').showModal();
}
function bloque(s, inicio) {
  const c = s.curso, conflicto = conflictoDe(c);
  const origen = c.origen === 'existente' ? 'Existente' : 'Propuesta';
  const horario = `${s.horario.horaInicio}–${s.horario.horaFin}`;
  const b = crear('button', '', `hs-curso ${c.origen}`);
  b.type = 'button'; b.dataset.curso = c.claveVisual;
  b.classList.toggle('conflicto', Boolean(conflicto));
  b.style.top = `${(s.inicio - inicio) / 60 * HORA + 2}px`;
  b.style.height = `${(s.fin - s.inicio) / 60 * HORA - 4}px`;
  b.style.left = `calc(${s.carril / s.carriles * 100}% + 2px)`;
  b.style.width = `calc(${100 / s.carriles}% - 4px)`;
  const etiqueta = conflicto ? `${origen} · Conflicto` : origen;
  const recursos = `${c.grupo?.clave || c.grupoId} · ${c.salon?.clave || c.salonId}`;
  b.append(crear('span', etiqueta, 'pg-marca'), crear('strong', nombre(c.materia)), crear('span', horario));
  if (s.fin - s.inicio > 60) b.append(crear('span', recursos), crear('span', nombreProfesor(c)));
  b.setAttribute('aria-label', `${etiqueta}, ${nombre(c.materia)}, ${s.dia} ${horario}, ${recursos}, ${nombreProfesor(c)}`);
  b.addEventListener('click', () => detalle(s));
  return b;
}
function actualizarConteos(conteos, origen) {
  for (const [tipo, id] of [['existente', 'conteoExistente'], ['propuesto', 'conteoPropuesto']]) {
    const { cursos, sesiones } = conteos[tipo];
    let texto = `${cursos} ${cursos === 1 ? 'curso' : 'cursos'} · ${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'}`;
    if (origen !== 'todos' && origen !== tipo) texto = 'Fuera de esta vista';
    if (tipo === 'existente' && registrados === null) texto = 'Datos no disponibles';
    $(id).textContent = texto;
  }
}
function renderizarHorario(actualizarOpciones = true) {
  const origen = $('origen').value;
  const cursos = cursosPorOrigen([...(registrados || []), ...cursosPropuestos(seleccionado(), resultado.periodo.id)], origen);
  if (actualizarOpciones) actualizarRecursos(cursos);
  const { sesiones, sinHorario, invalidas, conteos } = horarioVisible(cursos, $('vista').value, $('recurso').value);
  actualizarConteos(conteos, origen);
  const avisos = [];
  if (!sesiones.length) avisos.push('No hay sesiones para esta selección.');
  if (sinHorario.length) avisos.push(`Cursos sin horario (${sinHorario.length}) · ${sinHorario.map(c => nombre(c.materia)).join(', ')}.`);
  if (invalidas.length) avisos.push(`Franjas inválidas (${invalidas.length}) · ${invalidas.map(s => nombre(s.curso.materia)).join(', ')}.`);
  $('avisoHorario').textContent = avisos.join(' ');
  const cont = $('calendario');
  cont.replaceChildren();
  $('ayudaSemana').hidden = !sesiones.length;
  $('semana').hidden = !sesiones.length;
  if (!sesiones.length) return;
  const { inicio, fin, dias } = limitesSemana(sesiones);
  const porDia = dias.map(dia => distribuirCarriles(sesiones.filter(s => s.dia === dia)));
  const anchos = porDia.map(dia => Math.max(160, ...dia.map(s => s.carriles * 142)));
  cont.style.gridTemplateColumns = `56px ${anchos.map(n => `minmax(${n}px, 1fr)`).join(' ')}`;
  cont.style.setProperty('--minimo', `${56 + anchos.reduce((a, b) => a + b, 0)}px`);
  function columna(titulo) {
    const col = crear('div', '', 'hs-columna'), pista = crear('div', '', 'hs-pista');
    pista.style.height = `${(fin - inicio) / 60 * HORA}px`;
    col.append(crear('div', titulo, 'hs-dia'), pista); cont.append(col);
    return pista;
  }
  const eje = columna('Hora');
  for (let m = inicio; m < fin; m += 60) {
    const t = crear('div', horaTexto(m), 'hs-hora');
    t.style.top = `${(m - inicio) / 60 * HORA}px`;
    eje.append(t);
  }
  dias.forEach((dia, i) => {
    const pista = columna(dia);
    for (const s of porDia[i]) pista.append(bloque(s, inicio));
  });
}
if (requiereSesion()) {
  $('periodo').addEventListener('change', cambiarPeriodo);
  $('generar').addEventListener('click', () => generar());
  $('reintentar').addEventListener('click', iniciar);
  $('recargarHorario').addEventListener('click', async () => {
    if (await generar(planId)) $('origen').focus();
  });
  $('origen').addEventListener('change', () => renderizarHorario());
  $('vista').addEventListener('change', () => { $('recurso').value = ''; renderizarHorario(); });
  $('recurso').addEventListener('change', () => renderizarHorario(false));
  iniciar();
}
