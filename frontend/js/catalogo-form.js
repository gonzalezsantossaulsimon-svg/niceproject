import {
  getMateria,
  crearMateria,
  actualizarMateria,
  getSalon,
  crearSalon,
  actualizarSalon,
  getGrupo,
  crearGrupo,
  actualizarGrupo,
  getFranjaHoraria,
  crearFranjaHoraria,
  actualizarFranjaHoraria,
  getAcademias
} from './api.js';
import { requiereSesion } from './auth.js';

const formularios = {
  materias: {
    singular: 'materia',
    lista: 'materias.html',
    tituloNuevo: 'Nueva materia',
    tituloEditar: 'Editar materia',
    get: getMateria,
    crear: crearMateria,
    actualizar: actualizarMateria,
    campos: [
      { id: 'clave', clave: 'clave' },
      { id: 'nombre', clave: 'nombre' },
      { id: 'academiaClave', clave: 'academiaClave' },
      { id: 'horasSemanales', clave: 'horasSemanales', numero: true },
      { id: 'tipoRequerido', clave: 'tipoRequerido' }
    ],
    caracteristicasId: 'caracteristicasMateria',
    preparar: async () => {
      const academias = await getAcademias();
      const select = document.getElementById('academiaClave');
      select.replaceChildren();

      const sinAcademia = document.createElement('option');
      sinAcademia.value = '';
      sinAcademia.textContent = 'Sin academia';
      select.appendChild(sinAcademia);

      academias.forEach((academia) => {
        const opcion = document.createElement('option');
        opcion.value = academia.clave;
        opcion.textContent = `${academia.clave} — ${academia.nombre}`;
        select.appendChild(opcion);
      });
    },
    normalizar: (datos) => ({
      ...datos,
      clave: datos.clave.toUpperCase(),
      academiaClave: datos.academiaClave || null,
      tipoRequerido: datos.tipoRequerido || null
    }),
    validar: (datos) => (!datos.clave || !datos.nombre
      ? 'La clave y el nombre son obligatorios.'
      : ![4, 5, 6].includes(datos.horasSemanales)
        ? 'Las horas semanales deben ser 4, 5 o 6.'
        : '')
  },
  salones: {
    singular: 'salón',
    lista: 'salones.html',
    tituloNuevo: 'Nuevo salón',
    tituloEditar: 'Editar salón',
    get: getSalon,
    crear: crearSalon,
    actualizar: actualizarSalon,
    campos: [
      { id: 'clave', clave: 'clave' },
      { id: 'nombre', clave: 'nombre' },
      { id: 'capacidad', clave: 'capacidad', numero: true },
      { id: 'tipo', clave: 'tipo' }
    ],
    caracteristicasId: 'caracteristicasSalon',
    normalizar: (datos) => ({ ...datos, clave: datos.clave.toUpperCase() }),
    validar: (datos) => {
      if (!datos.clave || !datos.nombre) {
        return 'La clave y el nombre son obligatorios.';
      }

      if (!Number.isInteger(datos.capacidad) || datos.capacidad < 1) {
        return 'La capacidad debe ser un entero mayor o igual a 1.';
      }

      return '';
    }
  },
  grupos: {
    singular: 'grupo',
    lista: 'grupos.html',
    tituloNuevo: 'Nuevo grupo',
    tituloEditar: 'Editar grupo',
    get: getGrupo,
    crear: crearGrupo,
    actualizar: actualizarGrupo,
    campos: [
      { id: 'clave', clave: 'clave' },
      { id: 'nombre', clave: 'nombre' },
      { id: 'cantidadAlumnos', clave: 'cantidadAlumnos', numero: true }
    ],
    normalizar: (datos) => ({ ...datos, clave: datos.clave.toUpperCase() }),
    validar: (datos) => {
      if (!datos.clave || !datos.nombre) {
        return 'La clave y el nombre son obligatorios.';
      }

      if (!Number.isInteger(datos.cantidadAlumnos) || datos.cantidadAlumnos < 1) {
        return 'La cantidad de alumnos debe ser un entero mayor o igual a 1.';
      }

      return '';
    }
  },
  'franjas-horarias': {
    singular: 'horario disponible',
    lista: 'franjas-horarias.html',
    tituloNuevo: 'Nuevo horario disponible',
    tituloEditar: 'Editar horario disponible',
    get: getFranjaHoraria,
    crear: crearFranjaHoraria,
    actualizar: actualizarFranjaHoraria,
    campos: [
      { id: 'dia', clave: 'dia' },
      { id: 'horaInicio', clave: 'horaInicio' },
      { id: 'horaFin', clave: 'horaFin' }
    ],
    validar: (datos) => {
      if (!datos.dia || !datos.horaInicio || !datos.horaFin) {
        return 'El día, la hora de inicio y la hora de fin son obligatorios.';
      }

      if (datos.horaInicio >= datos.horaFin) {
        return 'La hora de inicio debe ser anterior a la hora de fin.';
      }

      return '';
    }
  }
};

function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.style.display = mensaje ? 'block' : 'none';
}

export async function inicializarCatalogoFormulario(nombreCatalogo) {
  requiereSesion();

  const catalogo = formularios[nombreCatalogo];
  if (!catalogo) {
    throw new Error('El formulario solicitado no existe');
  }

  const form = document.getElementById('formulario');
  const titulo = document.getElementById('titulo');
  const mensaje = document.getElementById('mensaje');
  const guardar = document.getElementById('guardar');
  const id = new URLSearchParams(window.location.search).get('id');

  function leerDatos() {
    const datos = Object.fromEntries(catalogo.campos.map((campo) => {
      const control = document.getElementById(campo.id);
      const valor = campo.numero ? Number(control.value) : control.value.trim();
      return [campo.clave, valor];
    }));
    if (catalogo.caracteristicasId) {
      datos.caracteristicas = Array.from(
        document.querySelectorAll(`#${catalogo.caracteristicasId} input[type="checkbox"]:checked`)
      ).map((checkbox) => checkbox.value);
    }
    return datos;
  }

  async function prepararFormulario() {
    if (catalogo.preparar) {
      await catalogo.preparar();
    }

    if (!id) {
      return;
    }

    titulo.textContent = catalogo.tituloEditar;
    const registro = await catalogo.get(id);
    catalogo.campos.forEach((campo) => {
      const control = document.getElementById(campo.id);
      control.value = registro[campo.clave] ?? '';
    });
    if (catalogo.caracteristicasId) {
      const seleccionadas = new Set(registro.caracteristicas || []);
      document.querySelectorAll(`#${catalogo.caracteristicasId} input[type="checkbox"]`)
        .forEach((checkbox) => { checkbox.checked = seleccionadas.has(checkbox.value); });
    }
  }

  try {
    guardar.disabled = true;
    await prepararFormulario();
  } catch (error) {
    mostrarError(mensaje, error.message || `No se pudo cargar el ${catalogo.singular}.`);
    return;
  } finally {
    guardar.disabled = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mostrarError(mensaje, '');

    let datos = leerDatos();
    const errorValidacion = catalogo.validar(datos);
    if (errorValidacion) {
      mostrarError(mensaje, errorValidacion);
      return;
    }

    if (catalogo.normalizar) {
      datos = catalogo.normalizar(datos);
    }

    guardar.disabled = true;
    try {
      if (id) {
        await catalogo.actualizar(id, datos);
      } else {
        await catalogo.crear(datos);
      }

      window.location.href = catalogo.lista;
    } catch (error) {
      mostrarError(mensaje, error.message || `No se pudo guardar el ${catalogo.singular}.`);
    } finally {
      guardar.disabled = false;
    }
  });
}
