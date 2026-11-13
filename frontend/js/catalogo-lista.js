import {
  getMaterias,
  eliminarMateria,
  getSalones,
  eliminarSalon,
  getGrupos,
  eliminarGrupo,
  getFranjasHorarias,
  eliminarFranjaHoraria,
  getAcademias
} from './api.js';
import { requiereSesion } from './auth.js';

const catalogos = {
  materias: {
    singular: 'materia',
    plural: 'materias',
    formulario: 'materia-form.html',
    getItems: getMaterias,
    eliminar: eliminarMateria,
    busqueda: ['clave', 'nombre'],
    columnas: [
      { titulo: 'Clave', valor: (materia) => materia.clave },
      { titulo: 'Nombre', valor: (materia) => materia.nombre },
      {
        titulo: 'Academia',
        valor: (materia, academias) => {
          const academia = academias.get(materia.academiaClave);
          return academia
            ? `${academia.nombre} (${academia.clave})`
            : materia.academiaClave || '—';
        }
      }
    ]
  },
  salones: {
    singular: 'salón',
    plural: 'salones',
    formulario: 'salon-form.html',
    getItems: getSalones,
    eliminar: eliminarSalon,
    busqueda: ['clave', 'nombre'],
    columnas: [
      { titulo: 'Clave', valor: (salon) => salon.clave },
      { titulo: 'Nombre', valor: (salon) => salon.nombre },
      { titulo: 'Capacidad', valor: (salon) => salon.capacidad }
    ]
  },
  grupos: {
    singular: 'grupo',
    plural: 'grupos',
    formulario: 'grupo-form.html',
    getItems: getGrupos,
    eliminar: eliminarGrupo,
    busqueda: ['clave', 'nombre'],
    columnas: [
      { titulo: 'Clave', valor: (grupo) => grupo.clave },
      { titulo: 'Nombre', valor: (grupo) => grupo.nombre },
      { titulo: 'Cantidad de alumnos', valor: (grupo) => grupo.cantidadAlumnos }
    ]
  },
  'franjas-horarias': {
    singular: 'horario disponible',
    plural: 'horarios disponibles',
    formulario: 'franja-horaria-form.html',
    getItems: getFranjasHorarias,
    eliminar: eliminarFranjaHoraria,
    busqueda: [],
    columnas: [
      { titulo: 'Día', valor: (franja) => franja.dia },
      { titulo: 'Hora inicio', valor: (franja) => franja.horaInicio },
      { titulo: 'Hora fin', valor: (franja) => franja.horaFin }
    ]
  }
};

function crearCelda(texto) {
  const celda = document.createElement('td');
  celda.textContent = texto == null ? '' : String(texto);
  return celda;
}

function mostrarMensaje(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.style.display = mensaje ? 'block' : 'none';
}

export async function inicializarCatalogoLista(nombreCatalogo) {
  requiereSesion();

  const catalogo = catalogos[nombreCatalogo];
  if (!catalogo) {
    throw new Error('El catálogo solicitado no existe');
  }

  const tabla = document.getElementById('registros');
  const contador = document.getElementById('contador');
  const mensaje = document.getElementById('mensaje');
  const busqueda = document.getElementById('busqueda');
  const filtroDia = document.getElementById('filtroDia');
  let registros = [];
  let academiasPorClave = new Map();

  function renderizar() {
    const textoBusqueda = busqueda?.value.trim().toLocaleLowerCase() || '';
    const diaSeleccionado = filtroDia?.value || '';
    const filtrados = registros.filter((registro) => {
      const coincideTexto = !textoBusqueda || catalogo.busqueda.some((campo) =>
        String(registro[campo] || '').toLocaleLowerCase().includes(textoBusqueda)
      );
      const coincideDia = !diaSeleccionado || registro.dia === diaSeleccionado;
      return coincideTexto && coincideDia;
    });

    tabla.replaceChildren();
    contador.textContent = `Mostrando ${filtrados.length} de ${registros.length} ${catalogo.plural}`;

    if (filtrados.length === 0) {
      const fila = document.createElement('tr');
      const celda = crearCelda('No se encontraron registros');
      celda.colSpan = catalogo.columnas.length + 1;
      celda.className = 'w3-center w3-text-grey';
      fila.appendChild(celda);
      tabla.appendChild(fila);
      return;
    }

    filtrados.forEach((registro) => {
      const fila = document.createElement('tr');
      catalogo.columnas.forEach((columna) => {
        fila.appendChild(crearCelda(columna.valor(registro, academiasPorClave)));
      });

      const acciones = document.createElement('td');
      const editar = document.createElement('a');
      editar.href = `${catalogo.formulario}?id=${encodeURIComponent(registro.id)}`;
      editar.className = 'w3-button w3-amber w3-small w3-round w3-margin-right';
      editar.textContent = 'Editar';

      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.className = 'w3-button w3-red w3-small w3-round';
      eliminar.textContent = 'Eliminar';
      eliminar.addEventListener('click', async () => {
        const identificador = registro.clave || registro.id;
        if (!window.confirm(`¿Eliminar ${catalogo.singular} ${identificador}?`)) {
          return;
        }

        try {
          await catalogo.eliminar(registro.id);
          mostrarMensaje(mensaje, '');
          await cargar();
        } catch (error) {
          mostrarMensaje(mensaje, error.message || `No se pudo eliminar ${catalogo.singular}`);
        }
      });

      acciones.append(editar, eliminar);
      fila.appendChild(acciones);
      tabla.appendChild(fila);
    });
  }

  async function cargar() {
    try {
      const resultado = await catalogo.getItems();
      if (!Array.isArray(resultado)) {
        throw new Error(`La respuesta de ${catalogo.plural} no es válida`);
      }

      registros = resultado;
      let advertencia = '';
      academiasPorClave = new Map();
      if (nombreCatalogo === 'materias') {
        try {
          const academias = await getAcademias();
          if (!Array.isArray(academias)) {
            throw new Error('La respuesta de academias no es válida');
          }
          academiasPorClave = new Map(academias.map((academia) => [academia.clave, academia]));
        } catch (error) {
          advertencia = `No se pudieron cargar los nombres de academias; se muestran sus claves. ${error.message || ''}`.trim();
        }
      }

      mostrarMensaje(mensaje, advertencia);
      renderizar();
    } catch (error) {
      mostrarMensaje(mensaje, error.message || `No se pudieron cargar ${catalogo.plural}`);
    }
  }

  busqueda?.addEventListener('input', renderizar);
  filtroDia?.addEventListener('change', renderizar);
  await cargar();
}
