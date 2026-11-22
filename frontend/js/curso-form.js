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
  const profesoresDiv = document.getElementById('profesores');
  const salonesDiv = document.getElementById('salones');
  const resumen = document.getElementById('resumen');
  const id = new URLSearchParams(window.location.search).get('id');

  let catalogos = { periodos: [], materias: [], grupos: [], horarios: [] };
  let patron = null;
  let profesorSeleccionado = null;
  let salonSeleccionado = null;

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
    baseSelect.replaceChildren(opcion('', 'Selecciona un horario base'));
    const materia = materiaActual();
    if (!materia) return;
    const horas = Number(materia.horasSemanales);
    const basesPermitidas = horas === 6 ? ['Lunes'] : ['Lunes', 'Martes'];
    const duracion = horas === 4 ? 120 : horas === 5 ? 120 : 120;
    for (const dia of basesPermitidas) {
      for (const franja of catalogos.horarios) {
        if (franja.dia === dia && (Number(franja.horaFin.slice(0, 2)) - Number(franja.horaInicio.slice(0, 2))) === duracion / 60) {
          baseSelect.append(opcion(franja.id, `${dia} ${franja.horaInicio}–${franja.horaFin}`));
        }
      }
    }
  }

  function limpiarRecomendaciones() {
    profesoresDiv.replaceChildren();
    salonesDiv.replaceChildren();
    profesorSeleccionado = null;
    salonSeleccionado = null;
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
    lineaResumen('Profesor', profesorSeleccionado ? `${profesorSeleccionado.nombre} — ${profesorSeleccionado.numeroEmpleado} — ${profesorSeleccionado.calificacionMateria}/10` : 'Sin seleccionar');
    lineaResumen('Salón', salonSeleccionado ? `${salonSeleccionado.clave} — capacidad ${salonSeleccionado.capacidad}` : 'Sin seleccionar');
    lineaResumen('Estado', 'BORRADOR');

    const valido = periodo && materia && grupo && patron?.ok && profesorSeleccionado?.compatible
      && salonSeleccionado?.compatible !== false;
    guardar.disabled = !valido;
  }

  function crearTarjetaProfesor(profesor) {
    const card = document.createElement('div');
    card.className = `w3-card w3-white w3-padding w3-margin-bottom ${profesor.compatible ? '' : 'w3-opacity'}`;
    const titulo = document.createElement('p');
    titulo.append(document.createTextNode(profesor.clasificacion === 'RECOMENDADO' ? '★ RECOMENDADO — ' : `${profesor.clasificacion} — `));
    const nombre = document.createElement('strong');
    nombre.textContent = `${profesor.nombre} (${profesor.numeroEmpleado})`;
    titulo.append(nombre);
    card.append(titulo);
    const datos = [
      `Calificación en la materia: ${profesor.calificacionMateria.toFixed(1)} / 10`,
      `Carga: ${profesor.cargaActual} / ${profesor.maxHorasSemanales} h`,
      `Disponible: ${profesor.compatible ? 'Sí' : 'No'}`,
      `Conflictos: ${profesor.bloqueos.filter((item) => item.includes('CONFLICTO')).length}`
    ];
    for (const dato of datos) {
      const p = document.createElement('p');
      p.textContent = dato;
      card.append(p);
    }
    if (profesor.razones.length) {
      const razones = document.createElement('div');
      const encabezado = document.createElement('b');
      encabezado.textContent = '¿Por qué?';
      razones.append(encabezado);
      const ul = document.createElement('ul');
      for (const razon of profesor.razones) {
        const li = document.createElement('li');
        li.textContent = razon;
        ul.append(li);
      }
      razones.append(ul);
      card.append(razones);
    }
    if (profesor.compatible) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'w3-button w3-indigo w3-round';
      boton.textContent = profesorSeleccionado?.id === profesor.id ? 'Profesor seleccionado' : 'Seleccionar profesor';
      boton.addEventListener('click', () => {
        profesorSeleccionado = profesor;
        actualizarResumen();
        refrescarBotonesProfesores();
      });
      card.append(boton);
    } else {
      const bloqueo = document.createElement('p');
      bloqueo.className = 'w3-text-red';
      bloqueo.textContent = profesor.bloqueos.join('; ');
      card.append(bloqueo);
    }
    return card;
  }

  function refrescarBotonesProfesores() {
    Array.from(profesoresDiv.children).forEach((card, index) => {
      const boton = card.querySelector('button');
      if (!boton) return;
      const profesor = window.__candidatosCurso?.[index];
      if (profesor) boton.textContent = profesorSeleccionado?.id === profesor.id ? 'Profesor seleccionado' : 'Seleccionar profesor';
    });
  }

  async function recalcular() {
    const materia = materiaActual();
    const grupo = grupoActual();
    limpiarRecomendaciones();
    horarioGenerado.replaceChildren();
    patron = null;
    resumen.replaceChildren();
    actualizarResumen();
    if (!materia || !grupo || !baseSelect.value) return;
    try {
      patron = await getPatronesMateria(materia.id, Number(baseSelect.value));
      const titulo = document.createElement('h3');
      titulo.className = 'w3-medium';
      titulo.textContent = 'Horario semanal generado automáticamente';
      horarioGenerado.append(titulo);
      for (const franja of patron.horarios) {
        const p = document.createElement('p');
        p.textContent = `${franja.dia} ${franja.horaInicio}–${franja.horaFin}`;
        horarioGenerado.append(p);
      }
      const total = document.createElement('b');
      total.textContent = `Total: ${patron.horasSemanales} horas semanales`;
      horarioGenerado.append(total);

      const periodo = periodoActual();
      if (!periodo) return;
      const candidatos = await getProfesoresRecomendados(materia.id, periodo.id, patron.horarioIds);
      window.__candidatosCurso = candidatos;
      profesoresDiv.replaceChildren();
      for (const candidato of candidatos) profesoresDiv.append(crearTarjetaProfesor(candidato));
      if (candidatos.length === 0) {
        const vacio = document.createElement('p');
        vacio.textContent = 'No hay profesores calificados para esta materia.';
        profesoresDiv.append(vacio);
      }

      const salones = await getSalonesDisponibles(materia.id, grupo.id, patron.horarioIds);
      window.__salonesCurso = salones;
      salonesDiv.replaceChildren();
      for (const salon of salones) {
        const card = document.createElement('div');
        card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
        const nombre = document.createElement('b');
        nombre.textContent = `★ ${salon.clave} — ${salon.nombre}`;
        const capacidad = document.createElement('p');
        capacidad.textContent = `Capacidad: ${salon.capacidad}; Grupo: ${grupo.cantidadAlumnos}`;
        const caracteristicas = document.createElement('p');
        caracteristicas.textContent = `Características: ${salon.caracteristicas.join(', ') || 'Ninguna'}; Disponible en todo el horario: Sí`;
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'w3-button w3-green w3-round';
        boton.textContent = salonSeleccionado?.id === salon.id ? 'Salón seleccionado' : 'Seleccionar salón';
        boton.addEventListener('click', () => {
          salonSeleccionado = salon;
          actualizarResumen();
          Array.from(salonesDiv.querySelectorAll('button')).forEach((item) => {
            item.textContent = item === boton ? 'Salón seleccionado' : 'Seleccionar salón';
          });
        });
        card.append(nombre, capacidad, caracteristicas, boton);
        salonesDiv.append(card);
      }
      if (salones.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'w3-text-red';
        vacio.textContent = 'No hay salones compatibles y disponibles para este curso.';
        salonesDiv.append(vacio);
      }
    } catch (error) {
      texto(mensaje, error.message || 'No se pudo generar el horario.');
    }
  }

  try {
    const [periodos, materias, grupos, horarios] = await Promise.all([
      getPeriodos(), getMaterias(), getGrupos(), getFranjasHorarias()
    ]);
    catalogos = { periodos, materias, grupos, horarios };
    cargarSelect(periodoSelect, periodos.filter((item) => item.estado !== 'CERRADO'), 'Selecciona un periodo', (item) => `${item.clave} — ${item.nombre} — ${item.estado}`);
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

    if (id) {
      titulo.textContent = 'Editar curso';
      const curso = await getCurso(id);
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
      profesorSeleccionado = window.__candidatosCurso?.find((item) => item.id === curso.profesorId) || null;
      salonSeleccionado = window.__salonesCurso?.find((item) => item.id === curso.salonId) || null;
    }
    actualizarResumen();
  } catch (error) {
    texto(mensaje, error.message || 'No se pudieron cargar los datos del curso.');
  }

  formulario.addEventListener('submit', async (event) => {
    event.preventDefault();
    texto(mensaje, '');
    if (!patron?.ok || !profesorSeleccionado?.compatible || !salonSeleccionado) {
      texto(mensaje, 'Selecciona periodo, materia, grupo, horario, profesor compatible y salón disponible.');
      return;
    }
    const payload = {
      periodoId: Number(periodoSelect.value),
      materiaId: Number(materiaSelect.value),
      grupoId: Number(grupoSelect.value),
      profesorId: profesorSeleccionado.id,
      salonId: salonSeleccionado.id,
      horarioIds: patron.horarioIds,
      estado: 'BORRADOR'
    };
    guardar.disabled = true;
    try {
      if (id) await actualizarCurso(id, payload);
      else await crearCurso(payload);
      window.location.href = 'cursos.html';
    } catch (error) {
      texto(mensaje, error.message || 'No se pudo guardar el curso.');
      guardar.disabled = false;
    }
  });
}
