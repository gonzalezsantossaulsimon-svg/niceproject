import { getPeriodos, generarPlanificacionGlobal } from './api.js';
import { requiereSesion } from './auth.js';
import { CRITERIOS, validarComparacion, cursosPropuestos, estadoBusqueda, indicadores } from './planificacion-global-modelo.mjs';
import { sesionesDe, limitesSemana, distribuirCarriles, horaTexto } from './horario-semanal-modelo.mjs';

const $ = id => document.getElementById(id);
const HORA = 84;
const colores = [['#3655ad','#e8edfc'], ['#19734f','#e3f3ea'], ['#7851a9','#f0eafa'], ['#956319','#fff1da'], ['#00758a','#e2f5f7'], ['#a3466e','#fbe8f0']];
let periodos = [], resultado = null, planId = 'A', solicitud = 0, ocupado = false;
const formato = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const numero = n => n == null || !Number.isFinite(n) ? '—' : formato.format(n);
const nombre = c => c?.nombre || '—';
const claveNombre = c => [c?.clave, c?.nombre].filter(Boolean).join(' — ') || '—';
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
function habilitar() { const p = periodoSeleccionado(); $('periodo').disabled = ocupado || !periodos.length; $('generar').disabled = ocupado || !p || !['BORRADOR','VALIDADO'].includes(p.estado); }
function limpiar() { resultado = null; $('resultado').hidden = true; $('detalle').open && $('detalle').close(); }
function cambiarPeriodo() {
  ++solicitud; limpiar();
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
async function generar() {
  if (ocupado || $('generar').disabled) return;
  const id = $('periodo').value, turno = ++solicitud; ocupado = true; habilitar(); limpiar(); mensaje('Generando propuestas A, B y C. La duración depende de las necesidades y alternativas disponibles…');
  try {
    const data = await generarPlanificacionGlobal(id, { modo: 'ABC' });
    if (turno !== solicitud) return;
    resultado = validarComparacion(data, id); planId = 'A'; renderizarComparacion(); renderizarPlan(); $('resultado').hidden = false;
    mensaje('Simulación completada. Ningún cambio se ha guardado.');
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
  actualizarRecursos(); renderizarHorario();
}
function cursos() { return cursosPropuestos(seleccionado(), resultado.periodo.id); }
function actualizarRecursos() {
  const campo = $('vista').value, anterior = $('recurso').value;
  $('recursoLabel').hidden = !campo; $('recurso').replaceChildren(opcion('', 'Todos'));
  if (!campo) return;
  const tipo = campo.replace(/Id$/, ''), entidades = new Map(cursos().map(c => [String(c[campo]), tipo === 'profesor' ? nombre(c[tipo]) : claveNombre(c[tipo])]));
  for (const [id, etiqueta] of [...entidades].sort((a,b) => a[1].localeCompare(b[1], 'es'))) $('recurso').append(opcion(id, etiqueta));
  if (entidades.has(anterior)) $('recurso').value = anterior;
}
function detalle(s) {
  const c = s.curso; $('detalleTitulo').textContent = nombre(c.materia); const dl = crear('dl');
  for (const [k,v] of [['Estado','Propuesta sin guardar'],['Horario',`${s.dia} ${s.horario.horaInicio}–${s.horario.horaFin}`],['Profesor',nombre(c.profesor)],['Grupo',claveNombre(c.grupo)],['Salón',claveNombre(c.salon)],['Calificación',numero(c.calificacion)],['Carga final',`${c.carga.resultante}/${c.carga.maxima} h`],['Advertencias',c.advertencias.join('; ') || '—']]) dl.append(crear('dt',k),crear('dd',v));
  $('detalleContenido').replaceChildren(dl); $('detalle').showModal();
}
function renderizarHorario() {
  const todos = cursos(), campo = $('vista').value, id = $('recurso').value;
  const { sesiones, sinHorario, invalidas } = sesionesDe(todos.filter(c => !campo || !id || String(c[campo]) === id));
  const { inicio, fin, dias } = limitesSemana(sesionesDe(todos).sesiones);
  const porDia = dias.map(d => distribuirCarriles(sesiones.filter(s => s.dia === d))), cont = $('calendario'); cont.replaceChildren();
  cont.style.setProperty('--dias', String(dias.length)); cont.style.setProperty('--minimo', `${74 + dias.length * Math.max(180, ...porDia.flat().map(s => s.carriles * 135))}px`);
  function columna(titulo) { const col = crear('div','','hs-columna'), pista = crear('div','','hs-pista'); pista.style.height = `${(fin-inicio)/60*HORA}px`; col.append(crear('div',titulo,'hs-dia'),pista); cont.append(col); return pista; }
  const eje = columna('Hora'); for (let m=inicio; m<fin; m+=60) { const t=crear('div',horaTexto(m),'hs-hora'); t.style.top=`${(m-inicio)/60*HORA}px`; eje.append(t); }
  dias.forEach((d,i) => { const pista = columna(d); for (const s of porDia[i]) {
    const c = s.curso, b = crear('button','','hs-curso'); b.type='button'; const [acento,fondo] = colores[Math.abs(Number(c.materiaId)||0)%colores.length];
    b.style.setProperty('--acento',acento); b.style.setProperty('--fondo',fondo); b.style.top=`${(s.inicio-inicio)/60*HORA+2}px`; b.style.height=`${(s.fin-s.inicio)/60*HORA-4}px`; b.style.left=`calc(${s.carril/s.carriles*100}% + 2px)`; b.style.width=`calc(${100/s.carriles}% - 4px)`;
    b.append(crear('strong',nombre(c.materia)),crear('span',`${s.horario.horaInicio}–${s.horario.horaFin}`),crear('span',`${c.grupo.clave} · ${c.salon.clave}`),crear('span',nombre(c.profesor)));
    b.setAttribute('aria-label',`${nombre(c.materia)}, ${d} ${s.horario.horaInicio} a ${s.horario.horaFin}, propuesta`); b.addEventListener('click',()=>detalle(s)); pista.append(b);
  }});
  $('avisoHorario').textContent = [`${sesiones.length} sesiones propuestas visibles.`, !sesiones.length ? 'No hay sesiones para esta selección.' : '', sinHorario.length || invalidas.length ? 'Hay propuestas con horarios ausentes o inválidos; revisa la tabla.' : ''].filter(Boolean).join(' ');
}
if (requiereSesion()) {
  $('periodo').addEventListener('change', cambiarPeriodo); $('generar').addEventListener('click', generar); $('reintentar').addEventListener('click', iniciar);
  $('vista').addEventListener('change', () => { $('recurso').value = ''; if (resultado) { actualizarRecursos(); renderizarHorario(); } });
  $('recurso').addEventListener('change', () => { if (resultado) renderizarHorario(); }); iniciar();
}
