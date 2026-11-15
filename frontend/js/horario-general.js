import { getCursos } from './api.js';
import { requiereSesion } from './auth.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

if (requiereSesion()) inicializarHorarioGeneral();

function mostrarError(elemento, texto) {
  elemento.textContent = texto;
  elemento.style.display = texto ? 'block' : 'none';
}

function crearCelda(texto) {
  const celda = document.createElement('td');
  celda.textContent = texto || '';
  return celda;
}

function nombreProfesor(curso) {
  return `${curso.profesor?.nombre || ''} ${curso.profesor?.apellido || ''}`.trim()
    || curso.profesor?.numeroEmpleado
    || `Profesor ${curso.profesorId}`;
}

function aRenglones(cursos) {
  return cursos.flatMap((curso) => (curso.horarios || []).map((horario) => ({
    ...horario,
    materia: curso.materia?.nombre || `Materia ${curso.materiaId}`,
    profesorId: curso.profesorId,
    profesor: nombreProfesor(curso),
    numeroEmpleado: curso.profesor?.numeroEmpleado || '',
    grupo: curso.grupo?.nombre || curso.grupo?.clave || `Grupo ${curso.grupoId}`,
    salon: curso.salon?.nombre || curso.salon?.clave || `Salón ${curso.salonId}`
  })));
}

async function inicializarHorarioGeneral() {
  const tbody = document.getElementById('tbody');
  const semana = document.getElementById('semana');
  const mensaje = document.getElementById('msg');
  const contador = document.getElementById('contador');
  const filtroProfesor = document.getElementById('filtroProfesor');
  const filtroDia = document.getElementById('filtroDia');
  const filtroMateria = document.getElementById('filtroMateria');
  const filtroSalon = document.getElementById('filtroSalon');
  const filtroGrupo = document.getElementById('filtroGrupo');
  const vistaTabla = document.getElementById('vistaTabla');
  const vistaSemanal = document.getElementById('vistaSemanal');
  let horarios = [];

  function horariosFiltrados() {
    const profesorId = filtroProfesor.value;
    const dia = filtroDia.value;
    const materia = filtroMateria.value.trim().toLocaleLowerCase();
    const salon = filtroSalon.value.trim().toLocaleLowerCase();
    const grupo = filtroGrupo.value.trim().toLocaleLowerCase();

    return horarios.filter((horario) => (
      (!profesorId || String(horario.profesorId) === profesorId)
      && (!dia || horario.dia === dia)
      && (!materia || horario.materia.toLocaleLowerCase().includes(materia))
      && (!salon || horario.salon.toLocaleLowerCase().includes(salon))
      && (!grupo || horario.grupo.toLocaleLowerCase().includes(grupo))
    ));
  }

  function renderizarTabla() {
    const filtrados = horariosFiltrados();
    contador.textContent = `Mostrando ${filtrados.length} bloques horarios`;
    tbody.replaceChildren();

    if (filtrados.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');
      celda.colSpan = 6;
      celda.className = 'w3-center w3-text-grey';
      celda.textContent = 'No se encontraron asignaciones';
      fila.appendChild(celda);
      tbody.appendChild(fila);
      return;
    }

    filtrados.forEach((horario) => {
      const fila = document.createElement('tr');
      fila.append(
        crearCelda(horario.dia),
        crearCelda(`${horario.horaInicio}–${horario.horaFin}`),
        crearCelda(horario.materia),
        crearCelda(horario.profesor),
        crearCelda(horario.grupo),
        crearCelda(horario.salon)
      );
      tbody.appendChild(fila);
    });
  }

  function renderizarSemana() {
    const filtrados = horariosFiltrados();
    semana.replaceChildren();
    contador.textContent = `Mostrando ${filtrados.length} bloques horarios`;

    DIAS.forEach((dia) => {
      const columna = document.createElement('div');
      columna.className = 'w3-col l2 m6 s12 w3-margin-bottom';
      const tarjeta = document.createElement('div');
      tarjeta.className = 'w3-card-4 w3-light-grey w3-padding';
      const encabezado = document.createElement('h2');
      encabezado.className = 'w3-medium w3-text-indigo';
      encabezado.textContent = dia;
      const lista = document.createElement('div');
      const delDia = filtrados
        .filter((horario) => horario.dia === dia)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

      if (delDia.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'w3-text-grey';
        vacio.textContent = 'Sin clases';
        lista.appendChild(vacio);
      }

      delDia.forEach((horario) => {
        const bloque = document.createElement('article');
        bloque.className = 'w3-panel w3-white w3-border w3-margin-top w3-padding-small';
        const hora = document.createElement('strong');
        hora.className = 'w3-small w3-text-indigo';
        hora.textContent = `${horario.horaInicio}–${horario.horaFin}`;
        const materia = document.createElement('div');
        materia.textContent = horario.materia;
        const grupo = document.createElement('div');
        grupo.textContent = horario.grupo;
        const profesor = document.createElement('div');
        profesor.textContent = horario.profesor;
        const salon = document.createElement('div');
        salon.className = 'w3-small w3-text-grey';
        salon.textContent = horario.salon;
        bloque.append(hora, materia, grupo, profesor, salon);
        lista.appendChild(bloque);
      });

      tarjeta.append(encabezado, lista);
      columna.appendChild(tarjeta);
      semana.appendChild(columna);
    });
  }

  function renderizarVista() {
    if (vistaTabla.style.display !== 'none') renderizarTabla();
    else renderizarSemana();
  }

  function agregarProfesor(profesor) {
    const opcion = document.createElement('option');
    opcion.value = String(profesor.id);
    opcion.textContent = `${profesor.numeroEmpleado || ''} — ${nombreProfesor({ profesor })}`;
    filtroProfesor.appendChild(opcion);
  }

  try {
    const cursos = await getCursos();
    if (!Array.isArray(cursos)) throw new Error('La respuesta de cursos no es válida.');
    horarios = aRenglones(cursos).sort((a, b) => (
      DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio)
    ));

    const profesores = new Map();
    cursos.forEach((curso) => {
      if (curso.profesor && !profesores.has(String(curso.profesorId))) {
        profesores.set(String(curso.profesorId), curso.profesor);
      }
    });
    profesores.forEach(agregarProfesor);
    renderizarTabla();
  } catch (error) {
    mostrarError(mensaje, error.message || 'No se pudo cargar el horario general.');
    contador.textContent = 'No se pudieron cargar las asignaciones';
  }

  filtroProfesor.addEventListener('change', renderizarVista);
  filtroDia.addEventListener('change', renderizarVista);
  filtroMateria.addEventListener('input', renderizarVista);
  filtroSalon.addEventListener('input', renderizarVista);
  filtroGrupo.addEventListener('input', renderizarVista);

  document.getElementById('btnTabla').addEventListener('click', () => {
    vistaTabla.style.display = 'block';
    vistaSemanal.style.display = 'none';
    document.getElementById('btnTabla').className = 'w3-btn w3-indigo w3-round';
    document.getElementById('btnSemanal').className = 'w3-btn w3-white w3-border w3-round';
    renderizarTabla();
  });

  document.getElementById('btnSemanal').addEventListener('click', () => {
    vistaTabla.style.display = 'none';
    vistaSemanal.style.display = 'block';
    document.getElementById('btnTabla').className = 'w3-btn w3-white w3-border w3-round';
    document.getElementById('btnSemanal').className = 'w3-btn w3-indigo w3-round';
    renderizarSemana();
  });
}
