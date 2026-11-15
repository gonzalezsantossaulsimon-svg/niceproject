import { getCursos, eliminarCurso } from './api.js';
import { requiereSesion } from './auth.js';

if (requiereSesion()) {
  inicializarCursos();
}

function mostrarMensaje(elemento, texto) {
  elemento.textContent = texto;
  elemento.style.display = texto ? 'block' : 'none';
}

function textoMateria(curso) {
  return curso.materia?.nombre || `Materia ${curso.materiaId}`;
}

function textoProfesor(curso) {
  const profesor = curso.profesor;
  if (!profesor) return `Profesor ${curso.profesorId}`;
  const nombre = `${profesor.nombre || ''} ${profesor.apellido || ''}`.trim();
  return nombre || profesor.numeroEmpleado || `Profesor ${curso.profesorId}`;
}

function textoGrupo(curso) {
  return curso.grupo?.nombre || curso.grupo?.clave || `Grupo ${curso.grupoId}`;
}

function textoSalon(curso) {
  return curso.salon?.nombre || curso.salon?.clave || `Salón ${curso.salonId}`;
}

function formatoHorario(horario) {
  return `${horario.dia} ${horario.horaInicio}–${horario.horaFin}`;
}

async function inicializarCursos() {
  const tabla = document.getElementById('registros');
  const contador = document.getElementById('contador');
  const mensaje = document.getElementById('mensaje');
  const filtros = {
    materia: document.getElementById('buscarMateria'),
    profesor: document.getElementById('buscarProfesor'),
    grupo: document.getElementById('buscarGrupo')
  };
  let cursos = [];

  function renderizar() {
    const texto = Object.fromEntries(
      Object.entries(filtros).map(([clave, input]) => [clave, input.value.trim().toLocaleLowerCase()])
    );
    const filtrados = cursos.filter((curso) => (
      texto.materia === ''
        || `${textoMateria(curso)} ${curso.materia?.clave || ''}`.toLocaleLowerCase().includes(texto.materia)
    ) && (
      texto.profesor === ''
        || `${textoProfesor(curso)} ${curso.profesor?.numeroEmpleado || ''}`.toLocaleLowerCase().includes(texto.profesor)
    ) && (
      texto.grupo === ''
        || `${textoGrupo(curso)} ${curso.grupo?.clave || ''}`.toLocaleLowerCase().includes(texto.grupo)
    ));

    tabla.replaceChildren();
    contador.textContent = `Mostrando ${filtrados.length} de ${cursos.length} cursos`;

    if (filtrados.length === 0) {
      const fila = document.createElement('tr');
      const celda = document.createElement('td');
      celda.colSpan = 6;
      celda.className = 'w3-center w3-text-grey';
      celda.textContent = 'No se encontraron cursos';
      fila.appendChild(celda);
      tabla.appendChild(fila);
      return;
    }

    for (const curso of filtrados) {
      const fila = document.createElement('tr');
      const datos = [
        textoMateria(curso),
        textoProfesor(curso),
        textoGrupo(curso),
        textoSalon(curso),
        (curso.horarios || []).map(formatoHorario).join('\n') || '—'
      ];

      for (const dato of datos) {
        const celda = document.createElement('td');
        celda.textContent = dato;
        if (dato.includes('\n')) celda.style.whiteSpace = 'pre-line';
        fila.appendChild(celda);
      }

      const acciones = document.createElement('td');
      const editar = document.createElement('a');
      editar.href = `curso-form.html?id=${encodeURIComponent(curso.id)}`;
      editar.className = 'w3-button w3-amber w3-small w3-round w3-margin-right';
      editar.textContent = 'Editar';

      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.className = 'w3-button w3-red w3-small w3-round';
      eliminar.textContent = 'Eliminar';
      eliminar.addEventListener('click', async () => {
        if (!window.confirm(`¿Eliminar el curso de ${textoMateria(curso)}?`)) return;

        eliminar.disabled = true;
        try {
          await eliminarCurso(curso.id);
          mostrarMensaje(mensaje, '');
          await cargar();
        } catch (error) {
          mostrarMensaje(mensaje, error.message || 'No se pudo eliminar el curso.');
          eliminar.disabled = false;
        }
      });

      acciones.append(editar, eliminar);
      fila.appendChild(acciones);
      tabla.appendChild(fila);
    }
  }

  async function cargar() {
    try {
      const resultado = await getCursos();
      if (!Array.isArray(resultado)) throw new Error('La respuesta de cursos no es válida.');
      cursos = resultado;
      mostrarMensaje(mensaje, '');
      renderizar();
    } catch (error) {
      mostrarMensaje(mensaje, error.message || 'No se pudieron cargar los cursos.');
      contador.textContent = 'No se pudieron cargar los cursos';
    }
  }

  Object.values(filtros).forEach((input) => input.addEventListener('input', renderizar));
  await cargar();
}
