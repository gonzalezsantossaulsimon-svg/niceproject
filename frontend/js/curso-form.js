import {
  actualizarCurso,
  crearCurso,
  getCurso,
  getFranjasHorarias,
  getGrupos,
  getMaterias,
  getPeriodos,
  getPatronesMateria,
  getProfesoresRecomendados,
  getSalonesDisponibles
} from './api.js';
import { requiereSesion } from './auth.js';
import { crearSelectorCurso } from './selector-curso.mjs';

const sesion = requiereSesion();
if (sesion) inicializarFormularioCurso();

function texto(elemento, valor) {
  elemento.textContent = valor;
  elemento.style.display = valor ? 'block' : 'none';
}

function opcion(valor, etiqueta) {
  const control = document.createElement('option');
  control.value = String(valor);
  control.textContent = etiqueta;
  return control;
}

async function inicializarFormularioCurso() {
  const formulario = document.getElementById('formulario');
  const titulo = document.getElementById('titulo');
  const mensaje = document.getElementById('mensaje');
  const guardar = document.getElementById('guardar');
  const periodoSelect = document.getElementById('periodoId');
  const materiaSelect = document.getElementById('materiaId');
  const grupoSelect = document.getElementById('grupoId');
  const baseSelect = document.getElementById('horarioBaseId');
  const horarioGenerado = document.getElementById('horarioGenerado');
  const profesores = crearSelectorCurso(document.getElementById('profesores'), 'profesor', actualizarResumen);
  const aulas = crearSelectorCurso(document.getElementById('salones'), 'aula', actualizarResumen);
  const estadoSeleccion = document.getElementById('estadoSeleccion');
  const reintentar = document.getElementById('reintentar');
  const resumen = document.getElementById('resumen');
  const id = new URLSearchParams(window.location.search).get('id');

  let catalogos = { periodos: [], materias: [], grupos: [], horarios: [] };
  let patron = null;
  let seleccionInicial = null;
  let estadoCurso = 'BORRADOR';
  let periodoProtegido = false;
  let consulta = 0;
  let consultando = false;
  let guardando = false;

  function cargarSelect(select, items, etiqueta, textoItem) {
    select.replaceChildren(opcion('', etiqueta));
    for (const item of items) select.append(opcion(item.id, textoItem(item)));
  }

  function materiaActual() {
    return catalogos.materias.find((item) => String(item.id) === materiaSelect.value);
  }
  function grupoActual() {
    return catalogos.grupos.find((item) => String(item.id) === grupoSelect.value);
  }
  function periodoActual() {
    return catalogos.periodos.find((item) => String(item.id) === periodoSelect.value);
  }

  function mostrarMateria() {
    const materia = materiaActual();
    const existente = document.getElementById('detalleMateria');
    if (existente) existente.remove();
    if (!materia) return;
    const panel = document.createElement('div');
    panel.id = 'detalleMateria';
    panel.className = 'w3-panel w3-pale-blue w3-border w3-margin-top';
    const titulo = document.createElement('b');
    titulo.textContent = `${materia.clave} — ${materia.nombre}`;
    const horas = document.createElement('p');
    horas.textContent = `${materia.horasSemanales} horas semanales`;
    const requiere = document.createElement('p');
    requiere.textContent = materia.tipoRequerido
      ? `Requiere: ${materia.tipoRequerido}${materia.caracteristicas?.length ? ` — ${materia.caracteristicas.join(', ')}` : ''}`
      : 'Sin requisito específico de espacio';
    panel.append(titulo, horas, requiere);
    materiaSelect.after(panel);
  }

  function cargarBases() {
    const anterior = baseSelect.value;
    baseSelect.replaceChildren(opcion('', 'Selecciona un horario base'));
    const materia = materiaActual();
    if (!materia) return;
    const horas = Number(materia.horasSemanales);
    const basesPermitidas = horas === 6 ? ['Lunes'] : ['Lunes', 'Martes'];
    for (const dia of basesPermitidas) {
      for (const franja of catalogos.horarios) {
        if (franja.dia === dia && (Number(franja.horaFin.slice(0, 2)) - Number(franja.horaInicio.slice(0, 2))) === 2) {
          baseSelect.append(opcion(franja.id, `${dia} ${franja.horaInicio}–${franja.horaFin}`));
        }
      }
    }
    if (Array.from(baseSelect.options).some(item => item.value === anterior)) baseSelect.value = anterior;
  }

  function lineaResumen(etiqueta, valor) {
    const parrafo = document.createElement('p');
    const label = document.createElement('strong');
    label.textContent = `${etiqueta}: `;
    parrafo.append(label, document.createTextNode(valor));
    resumen.append(parrafo);
  }

  function actualizarResumen() {
    resumen.replaceChildren();
    const materia = materiaActual();
    const grupo = grupoActual();
    const periodo = periodoActual();
    lineaResumen('Periodo', periodo ? `${periodo.clave} — ${periodo.nombre}` : 'Sin seleccionar');
    lineaResumen('Materia', materia ? `${materia.clave} — ${materia.nombre}` : 'Sin seleccionar');
    lineaResumen('Carga', materia ? `${materia.horasSemanales} horas semanales` : 'Sin seleccionar');
    lineaResumen('Grupo', grupo ? `${grupo.nombre} — ${grupo.cantidadAlumnos} alumnos` : 'Sin seleccionar');
    const profesorSeleccionado = profesores.actual;
    const salonSeleccionado = aulas.actual;
    lineaResumen('Profesor', profesorSeleccionado ? `${profesorSeleccionado.nombre} — ${profesorSeleccionado.numeroEmpleado} — ${profesorSeleccionado.calificacionMateria}/10` : 'Sin seleccionar');
    lineaResumen('Aula', salonSeleccionado ? `${salonSeleccionado.clave} — capacidad ${salonSeleccionado.capacidad}` : 'Sin seleccionar');
    lineaResumen('Estado', estadoCurso);

    guardar.disabled = !puedeGuardar();
    if (periodoProtegido) estadoSeleccion.textContent = 'Este curso pertenece a un periodo de solo lectura.';
    else if (consultando) estadoSeleccion.textContent = 'Consultando profesores y aulas disponibles…';
    else if (!reintentar.hidden) estadoSeleccion.textContent = 'Vuelve a consultar la disponibilidad para continuar.';
    else if (!patron) estadoSeleccion.textContent = 'Selecciona periodo, materia, grupo y horario base.';
    else if (!profesorSeleccionado && !salonSeleccionado) estadoSeleccion.textContent = 'Elige profesor y aula para completar el curso.';
    else if (!profesorSeleccionado) estadoSeleccion.textContent = 'Falta elegir el profesor.';
    else if (!salonSeleccionado) estadoSeleccion.textContent = 'Falta elegir el aula.';
    else estadoSeleccion.textContent = 'Curso listo para guardar.';
  }

  function puedeGuardar() {
    return !guardando && !periodoProtegido && periodoActual()?.estado === 'BORRADOR'
      && patron?.ok && profesores.actual && aulas.actual;
  }

  function mostrarHorario(horario) {
    const titulo = document.createElement('h3');
    titulo.className = 'w3-medium';
    titulo.textContent = 'Horario semanal generado automáticamente';
    horarioGenerado.append(titulo);
    for (const franja of horario.horarios) {
      const p = document.createElement('p');
      p.textContent = `${franja.dia} ${franja.horaInicio}–${franja.horaFin}`;
      horarioGenerado.append(p);
    }
    const total = document.createElement('b');
    total.textContent = `Total: ${horario.horasSemanales} horas semanales`;
    horarioGenerado.append(total);
  }

  async function recalcular() {
    const turno = ++consulta;
    const materia = materiaActual();
    const grupo = grupoActual();
    const periodo = periodoActual();
    const base = Number(baseSelect.value);
    patron = null;
    profesores.suspender();
    aulas.suspender();
    horarioGenerado.replaceChildren();
    texto(mensaje, '');
    reintentar.hidden = true;
    consultando = Boolean(materia && grupo && periodo && base);
    actualizarResumen();
    if (!consultando) return;
    try {
      const horario = await getPatronesMateria(materia.id, base);
      if (turno !== consulta) return;
      mostrarHorario(horario);
      const [candidatos, salones] = await Promise.all([
        getProfesoresRecomendados(materia.id, periodo.id, horario.horarioIds, id),
        getSalonesDisponibles(materia.id, grupo.id, horario.horarioIds, periodo.id, id)
      ]);
      if (turno !== consulta) return;
      profesores.cargar(candidatos, seleccionInicial?.profesorId);
      aulas.cargar(salones, seleccionInicial?.salonId);
      seleccionInicial = null;
      patron = horario;
    } catch (error) {
      if (turno !== consulta) return;
      reintentar.hidden = false;
      texto(mensaje, error.message || 'No se pudo consultar la disponibilidad.');
    } finally {
      if (turno === consulta) {
        consultando = false;
        actualizarResumen();
      }
    }
  }

  formulario.addEventListener('submit', guardarCurso);
  reintentar.addEventListener('click', recalcular);

  try {
    const [periodos, materias, grupos, horarios, curso] = await Promise.all([
      getPeriodos(), getMaterias(), getGrupos(), getFranjasHorarias(), id ? getCurso(id) : null
    ]);
    catalogos = { periodos, materias, grupos, horarios };
    const periodosVisibles = periodos.filter(item => item.estado === 'BORRADOR' || item.id === curso?.periodoId);
    cargarSelect(periodoSelect, periodosVisibles, 'Selecciona un periodo', (item) => `${item.clave} — ${item.nombre} — ${item.estado}`);
    cargarSelect(materiaSelect, materias, 'Selecciona una materia', (item) => `${item.clave} — ${item.nombre}`);
    cargarSelect(grupoSelect, grupos, 'Selecciona un grupo', (item) => `${item.nombre} — ${item.cantidadAlumnos} alumnos`);

    materiaSelect.addEventListener('change', () => {
      mostrarMateria();
      cargarBases();
      recalcular();
    });
    grupoSelect.addEventListener('change', recalcular);
    periodoSelect.addEventListener('change', recalcular);
    baseSelect.addEventListener('change', recalcular);

    if (curso) {
      titulo.textContent = 'Editar curso';
      estadoCurso = curso.estado || 'BORRADOR';
      periodoProtegido = Boolean(curso.periodo && curso.periodo.estado !== 'BORRADOR');
      if (periodoProtegido) {
        for (const campo of [periodoSelect, materiaSelect, grupoSelect, baseSelect, document.getElementById('recursosCurso')]) {
          campo.disabled = true;
        }
      }
      seleccionInicial = curso;
      periodoSelect.value = String(curso.periodoId || '');
      materiaSelect.value = String(curso.materiaId);
      grupoSelect.value = String(curso.grupoId);
      mostrarMateria();
      cargarBases();
      const baseExistente = catalogos.horarios.find((franja) =>
        (curso.horarioIds || []).includes(franja.id)
        && ['Lunes', 'Martes'].includes(franja.dia)
        && (Number(franja.horaFin.slice(0, 2)) - Number(franja.horaInicio.slice(0, 2))) === 2);
      if (baseExistente) baseSelect.value = String(baseExistente.id);
      await recalcular();
    }
    actualizarResumen();
  } catch (error) {
    texto(mensaje, error.message || 'No se pudieron cargar los datos del curso.');
  }

  async function guardarCurso(event) {
    event.preventDefault();
    if (guardando) return;
    if (!puedeGuardar()) {
      actualizarResumen();
      return;
    }
    const payload = {
      periodoId: Number(periodoSelect.value),
      materiaId: Number(materiaSelect.value),
      grupoId: Number(grupoSelect.value),
      profesorId: profesores.actual.id,
      salonId: aulas.actual.id,
      horarioIds: patron.horarioIds,
      estado: estadoCurso
    };
    guardando = true;
    guardar.disabled = true;
    formulario.inert = true;
    texto(mensaje, '');
    try {
      if (id) await actualizarCurso(id, payload);
      else await crearCurso(payload);
      window.location.href = 'cursos.html';
    } catch (error) {
      guardando = false;
      formulario.inert = false;
      await recalcular();
      if (!mensaje.textContent) texto(mensaje, error.message || 'No se pudo guardar el curso.');
    }
  }
}
