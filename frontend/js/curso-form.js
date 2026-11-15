import {
  actualizarCurso,
  crearCurso,
  getCurso,
  getFranjasHorarias,
  getGrupos,
  getMaterias,
  getProfesores,
  getSalones
} from './api.js';
import { requiereSesion } from './auth.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const sesion = requiereSesion();

if (sesion) inicializarFormularioCurso();

function mostrarMensaje(elemento, texto) {
  elemento.textContent = texto;
  elemento.style.display = texto ? 'block' : 'none';
}

function agregarOpcion(select, valor, texto) {
  const opcion = document.createElement('option');
  opcion.value = String(valor);
  opcion.textContent = texto;
  select.appendChild(opcion);
}

function minutos(hora) {
  const [horas, minutosHora] = hora.split(':').map(Number);
  return horas * 60 + minutosHora;
}

function seSolapan(a, b) {
  return a.dia === b.dia
    && minutos(a.horaInicio) < minutos(b.horaFin)
    && minutos(a.horaFin) > minutos(b.horaInicio);
}

async function inicializarFormularioCurso() {
  const formulario = document.getElementById('formulario');
  const titulo = document.getElementById('titulo');
  const mensaje = document.getElementById('mensaje');
  const guardar = document.getElementById('guardar');
  const selectores = {
    materia: document.getElementById('materiaId'),
    profesor: document.getElementById('profesorId'),
    grupo: document.getElementById('grupoId'),
    salon: document.getElementById('salonId')
  };
  const contenedorHorarios = document.getElementById('horarios');
  const resumen = document.getElementById('resumen');
  const id = new URLSearchParams(window.location.search).get('id');
  let catalogos = { materias: [], profesores: [], grupos: [], salones: [], horarios: [] };
  let datosListos = false;

  function seleccionActual() {
    return {
      materia: catalogos.materias.find((item) => String(item.id) === selectores.materia.value),
      profesor: catalogos.profesores.find((item) => String(item.id) === selectores.profesor.value),
      grupo: catalogos.grupos.find((item) => String(item.id) === selectores.grupo.value),
      salon: catalogos.salones.find((item) => String(item.id) === selectores.salon.value),
      horarios: Array.from(contenedorHorarios.querySelectorAll('input[type="checkbox"]:checked'))
        .map((checkbox) => catalogos.horarios.find((horario) => String(horario.id) === checkbox.value))
        .filter(Boolean)
    };
  }

  function construirResumenLinea(etiqueta, valor) {
    const parrafo = document.createElement('p');
    const label = document.createElement('b');
    label.textContent = `${etiqueta}: `;
    const contenido = document.createElement('span');
    contenido.textContent = valor;
    parrafo.append(label, contenido);
    resumen.appendChild(parrafo);
  }

  function validarSeleccion(seleccion) {
    if (!seleccion.materia || !seleccion.profesor || !seleccion.grupo || !seleccion.salon) {
      return 'Selecciona una materia, un profesor, un grupo y un salón.';
    }
    if (seleccion.horarios.length === 0) return 'Selecciona al menos un horario.';

    const horariosOrdenados = [...seleccion.horarios].sort((a, b) => (
      DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio)
    ));
    for (let i = 0; i < horariosOrdenados.length; i += 1) {
      for (let j = i + 1; j < horariosOrdenados.length; j += 1) {
        if (seSolapan(horariosOrdenados[i], horariosOrdenados[j])) {
          return 'Las franjas del mismo curso se solapan. Ajusta la selección antes de guardar.';
        }
      }
    }

    if (Number(seleccion.grupo.cantidadAlumnos) > Number(seleccion.salon.capacidad)) {
      return `El grupo tiene ${seleccion.grupo.cantidadAlumnos} alumnos y el salón solamente tiene capacidad para ${seleccion.salon.capacidad}.`;
    }
    return '';
  }

  function actualizarResumen() {
    const seleccion = seleccionActual();
    resumen.replaceChildren();

    construirResumenLinea('Materia', seleccion.materia?.nombre || 'Sin seleccionar');
    construirResumenLinea('Profesor', seleccion.profesor
      ? `${seleccion.profesor.nombre} ${seleccion.profesor.apellido}`.trim()
      : 'Sin seleccionar');
    construirResumenLinea('Grupo', seleccion.grupo
      ? `${seleccion.grupo.nombre} — ${seleccion.grupo.cantidadAlumnos} alumnos`
      : 'Sin seleccionar');
    construirResumenLinea('Salón', seleccion.salon
      ? `${seleccion.salon.nombre} — capacidad ${seleccion.salon.capacidad}`
      : 'Sin seleccionar');
    construirResumenLinea('Horarios', seleccion.horarios.length
      ? seleccion.horarios.map((horario) => `${horario.dia} ${horario.horaInicio}–${horario.horaFin}`).join('\n')
      : 'Sin seleccionar');

    const error = validarSeleccion(seleccion);
    mostrarMensaje(mensaje, error);
    guardar.disabled = !datosListos || Boolean(error);
  }

  function cargarSelect(select, items, textoVacio, textoOpcion) {
    select.replaceChildren();
    agregarOpcion(select, '', textoVacio);
    for (const item of items) agregarOpcion(select, item.id, textoOpcion(item));
  }

  function cargarHorarios() {
    contenedorHorarios.replaceChildren();
    const porDia = new Map(DIAS.map((dia) => [dia, []]));
    for (const horario of catalogos.horarios) porDia.get(horario.dia)?.push(horario);

    for (const dia of DIAS) {
      const franjas = porDia.get(dia);
      if (!franjas.length) continue;

      const seccion = document.createElement('section');
      seccion.className = 'w3-margin-bottom';
      const encabezado = document.createElement('h3');
      encabezado.className = 'w3-medium w3-text-indigo';
      encabezado.textContent = dia;
      seccion.appendChild(encabezado);

      for (const franja of franjas) {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'w3-block w3-padding-small';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(franja.id);
        checkbox.className = 'w3-check';
        checkbox.addEventListener('change', actualizarResumen);
        const texto = document.createElement('span');
        texto.className = 'w3-margin-left';
        texto.textContent = `${franja.dia} ${franja.horaInicio}–${franja.horaFin}`;
        etiqueta.append(checkbox, texto);
        seccion.appendChild(etiqueta);
      }
      contenedorHorarios.appendChild(seccion);
    }

    if (catalogos.horarios.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'w3-text-grey';
      vacio.textContent = 'No hay horarios disponibles registrados.';
      contenedorHorarios.appendChild(vacio);
    }
  }

  try {
    guardar.disabled = true;
    const [materias, profesores, grupos, salones, horarios] = await Promise.all([
      getMaterias(),
      getProfesores(),
      getGrupos(),
      getSalones(),
      getFranjasHorarias()
    ]);
    catalogos = { materias, profesores, grupos, salones, horarios };

    if (![materias, profesores, grupos, salones, horarios].every(Array.isArray)) {
      throw new Error('No se pudo cargar correctamente uno o varios catálogos.');
    }

    cargarSelect(selectores.materia, materias, 'Selecciona una materia', (item) => `${item.clave} — ${item.nombre}`);
    cargarSelect(selectores.profesor, profesores, 'Selecciona un profesor', (item) => (
      `${item.numeroEmpleado} — ${item.nombre} ${item.apellido}`.trim()
    ));
    cargarSelect(selectores.grupo, grupos, 'Selecciona un grupo', (item) => (
      `${item.nombre} — ${item.cantidadAlumnos} alumnos`
    ));
    cargarSelect(selectores.salon, salones, 'Selecciona un salón', (item) => (
      `${item.nombre} — capacidad ${item.capacidad}`
    ));
    catalogos.horarios.sort((a, b) => (
      DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio)
    ));
    cargarHorarios();

    if (id) {
      titulo.textContent = 'Editar curso';
      const curso = await getCurso(id);
      selectores.materia.value = String(curso.materiaId);
      selectores.profesor.value = String(curso.profesorId);
      selectores.grupo.value = String(curso.grupoId);
      selectores.salon.value = String(curso.salonId);
      const horariosSeleccionados = new Set((curso.horarioIds || []).map(String));
      contenedorHorarios.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = horariosSeleccionados.has(checkbox.value);
      });
    }

    datosListos = true;
    actualizarResumen();
  } catch (error) {
    mostrarMensaje(mensaje, error.message || 'No se pudieron cargar los datos del curso.');
    guardar.disabled = true;
  }

  Object.values(selectores).forEach((select) => select.addEventListener('change', actualizarResumen));

  formulario.addEventListener('submit', async (event) => {
    event.preventDefault();
    const seleccion = seleccionActual();
    const error = validarSeleccion(seleccion);
    mostrarMensaje(mensaje, error);
    if (error || !datosListos) return;

    const payload = {
      materiaId: Number(selectores.materia.value),
      profesorId: Number(selectores.profesor.value),
      grupoId: Number(selectores.grupo.value),
      salonId: Number(selectores.salon.value),
      horarioIds: seleccion.horarios.map((horario) => Number(horario.id))
    };

    guardar.disabled = true;
    try {
      if (id) await actualizarCurso(id, payload);
      else await crearCurso(payload);
      window.location.href = 'cursos.html';
    } catch (saveError) {
      mostrarMensaje(mensaje, saveError.message || 'No se pudo guardar el curso.');
      guardar.disabled = false;
    }
  });
}
