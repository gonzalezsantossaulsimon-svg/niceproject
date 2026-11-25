import { getPeriodos, getCursos, getProfesores, getGrupos, getSalones, getConflictosPeriodo } from './api.js';
import { requiereSesion } from './auth.js';
import { cursosDelPeriodo, sesionesDe, limitesSemana, distribuirCarriles, estadosDe, horaTexto } from './horario-semanal-modelo.mjs';

const $ = id => document.getElementById(id);
const HORA = 84;
const colores = [['#3655ad','#e8edfc'], ['#19734f','#e3f3ea'], ['#7851a9','#f0eafa'], ['#956319','#fff1da'], ['#00758a','#e2f5f7'], ['#a3466e','#fbe8f0']];
const campos = { profesorId: { obtener: getProfesores, etiqueta: p => `${p.nombre} ${p.apellido}` }, grupoId: { obtener: getGrupos, etiqueta: g => `${g.clave} — ${g.nombre}` }, salonId: { obtener: getSalones, etiqueta: s => `${s.clave} — ${s.nombre}` } };
let cursos = [], periodos = [], estados = new Map(), verificado = false, catalogos = {}, solicitud = 0;

function crear(tag, texto = '', clase = '') {
  const e = document.createElement(tag); e.textContent = texto; if (clase) e.className = clase; return e;
}
function opcion(id, texto) { const e = crear('option', texto); e.value = String(id); return e; }
function materia(c) { return c.materia?.nombre || `Materia ${c.materiaId}`; }
function profesor(c) { return c.profesor ? `${c.profesor.nombre || ''} ${c.profesor.apellido || ''}`.trim() : `Profesor ${c.profesorId}`; }
function grupo(c) { return c.grupo?.clave || `Grupo ${c.grupoId}`; }
function salon(c) { return c.salon?.clave || `Salón ${c.salonId}`; }
function metrica(valor, titulo) { const e = crear('div', '', 'hs-metrica'); e.append(crear('strong', String(valor)), crear('span', titulo)); return e; }
function mostrarDetalle(s) {
  const c = s.curso, estado = estados.get(String(c.id));
  $('detalleTitulo').textContent = materia(c);
  const dl = crear('dl');
  for (const [k,v] of [['Horario', `${s.dia} ${s.horario.horaInicio}–${s.horario.horaFin}`], ['Materia', `${c.materia?.clave || ''} ${materia(c)}`.trim()], ['Profesor', profesor(c)], ['Grupo', `${grupo(c)} ${c.grupo?.nombre || ''}`], ['Salón', `${salon(c)} ${c.salon?.nombre || ''}`], ['Estado del curso', c.estado || 'Sin estado'], ['Validación del curso', estado ? `${estado.tipo}: ${estado.motivo}` : verificado ? 'Sin conflictos ni advertencias reportados' : 'No disponible']]) {
    dl.append(crear('dt', k), crear('dd', v));
  }
  $('detalleContenido').replaceChildren(dl);
  $('detalle').showModal();
}
function actualizarFiltro() {
  const campo = $('vista').value, anterior = $('entidad').value;
  $('filtroLabel').hidden = !campo;
  $('entidad').replaceChildren(opcion('', 'Todos'));
  if (campo) {
    const opciones = (catalogos[campo] || []).map(e => ({ id: e.id, nombre: campos[campo].etiqueta(e) }));
    opciones.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es'));
    for (const e of opciones) $('entidad').append(opcion(e.id, e.nombre));
    if (opciones.some(e => String(e.id) === anterior)) $('entidad').value = anterior;
  }
}
function renderizar() {
  const periodoId = $('periodo').value;
  const delPeriodo = cursosDelPeriodo(cursos, periodoId);
  const filtrados = cursosDelPeriodo(cursos, periodoId, $('vista').value, $('entidad').value);
  const { sesiones, sinHorario, invalidas } = sesionesDe(filtrados);
  const { inicio, fin, dias } = limitesSemana(sesionesDe(delPeriodo).sesiones);
  const totalConflictos = filtrados.filter(c => estados.get(String(c.id))?.tipo === 'conflicto').length;
  const totalAvisos = filtrados.filter(c => estados.get(String(c.id))?.tipo === 'advertencia').length;
  $('resumen').replaceChildren(metrica(filtrados.length, 'Cursos visibles'), metrica(sesiones.length, 'Sesiones semanales'), metrica(verificado ? totalConflictos : '—', 'Cursos con conflicto'), metrica(verificado ? totalAvisos : '—', 'Cursos con advertencia'));
  const cont = $('calendario'); cont.replaceChildren();
  const porDia = dias.map(dia => distribuirCarriles(sesiones.filter(s => s.dia === dia)));
  const anchoDia = Math.max(180, ...porDia.flat().map(s => s.carriles * 135));
  cont.style.setProperty('--dias', String(dias.length));
  cont.style.setProperty('--minimo', `${74 + dias.length * anchoDia}px`);
  const alto = (fin - inicio) / 60 * HORA;
  function columna(titulo) {
    const col = crear('div', '', 'hs-columna'), pista = crear('div', '', 'hs-pista');
    pista.style.height = `${alto}px`;
    col.append(crear('div', titulo, 'hs-dia'), pista); cont.append(col); return pista;
  }
  const eje = columna('Hora');
  for (let m = inicio; m < fin; m += 60) {
    const t = crear('div', horaTexto(m), 'hs-hora'); t.style.top = `${(m-inicio)/60*HORA}px`; eje.append(t);
  }
  dias.forEach((dia, i) => {
    const pista = columna(dia);
    for (const s of porDia[i]) {
      const c = s.curso, estado = estados.get(String(c.id));
      const b = crear('button', '', `hs-curso ${estado?.tipo || ''}`); b.type = 'button';
      const [acento, fondo] = colores[Math.abs(Number(c.materiaId) || 0) % colores.length];
      b.style.setProperty('--acento', acento); b.style.setProperty('--fondo', fondo);
      b.style.top = `${(s.inicio-inicio)/60*HORA+2}px`;
      b.style.height = `${(s.fin-s.inicio)/60*HORA-4}px`;
      b.style.left = `calc(${s.carril/s.carriles*100}% + 2px)`;
      b.style.width = `calc(${100/s.carriles}% - 4px)`;
      b.append(crear('strong', materia(c)), crear('span', `${s.horario.horaInicio}–${s.horario.horaFin}`), crear('span', `${grupo(c)} · ${salon(c)}`), crear('span', profesor(c)));
      if (estado) b.append(crear('span', estado.tipo === 'conflicto' ? 'CONFLICTO' : 'ADVERTENCIA'));
      b.setAttribute('aria-label', `${materia(c)}, ${dia} ${s.horario.horaInicio} a ${s.horario.horaFin}, ${grupo(c)}, ${profesor(c)}, ${salon(c)}${estado ? ', '+estado.tipo : ''}`);
      b.addEventListener('click', () => mostrarDetalle(s)); pista.append(b);
    }
  });
  $('excepciones').textContent = [!filtrados.length ? 'No hay cursos para esta selección.' : '', sinHorario.length ? `${sinHorario.length} curso(s) sin horario: ${sinHorario.map(materia).join(', ')}.` : '', invalidas.length ? `${invalidas.length} franja(s) inválida(s): ${invalidas.map(s => materia(s.curso)).join(', ')}.` : ''].filter(Boolean).join(' ');
}
async function cargar() {
  const turno = ++solicitud, periodoId = $('periodo').value;
  $('contenido').hidden = true; $('mensaje').textContent = 'Cargando horario…';
  if (!periodoId) { $('mensaje').textContent = 'No hay periodos disponibles.'; return; }
  $('planificacion').href = `planificacion-periodo.html?periodoId=${encodeURIComponent(periodoId)}`;
  $('conflictos').href = `conflictos.html?periodoId=${encodeURIComponent(periodoId)}`;
  try {
    const [lista, validacion] = await Promise.all([getCursos(), getConflictosPeriodo(periodoId).then(data => ({ data }), () => ({ data: null }))]);
    if (turno !== solicitud) return;
    if (!Array.isArray(lista)) throw new Error('La respuesta de cursos no es válida.');
    cursos = lista; verificado = Array.isArray(validacion.data?.conflictos) && Array.isArray(validacion.data?.detalleAdvertencias); estados = estadosDe(validacion.data);
    renderizar(); $('contenido').hidden = false;
    const periodo = periodos.find(p => String(p.id) === periodoId);
    $('mensaje').textContent = `${periodo?.estado || ''}${verificado ? '' : ' — Validación de conflictos no disponible; no se puede afirmar que el horario esté libre de conflictos.'}`;
  } catch (e) { if (turno === solicitud) $('mensaje').textContent = e.message || 'No fue posible cargar el horario.'; }
}
async function iniciar() {
  $('actualizar').disabled = true;
  ++solicitud;
  $('periodo').disabled = true; $('vista').disabled = true;
  $('contenido').hidden = true; $('mensaje').textContent = 'Cargando catálogos…';
  try {
    const [p, profesores, grupos, salones] = await Promise.all([getPeriodos(), getProfesores(), getGrupos(), getSalones()]);
    if (![p,profesores,grupos,salones].every(Array.isArray)) throw new Error('Respuesta de catálogos no válida.');
    periodos = p; catalogos = { profesorId: profesores, grupoId: grupos, salonId: salones };
    const anterior = $('periodo').value || new URLSearchParams(location.search).get('periodoId');
    $('periodo').replaceChildren(...periodos.map(p => opcion(p.id, `${p.clave} — ${p.nombre}`)));
    if (periodos.some(p => String(p.id) === anterior)) $('periodo').value = anterior;
    else if (periodos.length) $('periodo').value = String((periodos.find(p => p.estado === 'BORRADOR') || periodos[0]).id);
    $('periodo').disabled = !periodos.length; $('vista').disabled = !periodos.length;
    actualizarFiltro(); await cargar();
  } catch (e) { $('contenido').hidden = true; $('mensaje').textContent = e.message || 'No fue posible cargar los catálogos.'; }
  finally { $('actualizar').disabled = false; }
}
if (requiereSesion()) {
  $('periodo').addEventListener('change', cargar);
  $('vista').addEventListener('change', () => { $('entidad').value = ''; actualizarFiltro(); if (!$('contenido').hidden) renderizar(); });
  $('entidad').addEventListener('change', () => { if (!$('contenido').hidden) renderizar(); });
  $('actualizar').addEventListener('click', iniciar);
  iniciar();
}
