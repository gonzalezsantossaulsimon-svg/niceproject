import {
  getPeriodos,
  getMaterias,
  getGrupos,
  getPlanificacionPeriodo,
  crearNecesidadPeriodo,
  actualizarNecesidad,
  eliminarNecesidad,
  generarPropuestas,
  aplicarPropuesta
} from './api.js';
import { requiereSesion } from './auth.js';

requiereSesion();

const periodoSelect = document.getElementById('periodoId');
const estadoCarga = document.getElementById('estadoCarga');
const contenido = document.getElementById('contenido');
const mensajeOperacion = document.getElementById('mensajeOperacion');
let materiasCatalogo = [];
let gruposCatalogo = [];

function mostrarMensaje(texto, tipo = 'success') {
  mensajeOperacion.textContent = texto;
  mensajeOperacion.className = tipo === 'error'
    ? 'w3-panel w3-pale-red w3-border w3-border-red'
    : tipo === 'warning'
      ? 'w3-panel w3-pale-yellow w3-border w3-border-orange'
      : 'w3-panel w3-pale-green w3-border w3-border-green';
  mensajeOperacion.style.display = 'block';
}

function tarjeta(valor, etiqueta, color = 'w3-white') {
  const contenedor = document.createElement('div');
  contenedor.className = 'w3-col s6 m3';
  const card = document.createElement('div');
  card.className = `w3-card w3-padding w3-center ${color}`;
  const numero = document.createElement('p');
  numero.className = 'w3-xlarge';
  numero.textContent = String(valor);
  const texto = document.createElement('p');
  texto.textContent = etiqueta;
  card.append(numero, texto);
  contenedor.append(card);
  return contenedor;
}

function linea(card, etiqueta, valor) {
  const p = document.createElement('p');
  p.textContent = `${etiqueta}: ${valor}`;
  card.append(p);
}

function opcion(valor, etiqueta) {
  const item = document.createElement('option');
  item.value = String(valor);
  item.textContent = etiqueta;
  return item;
}

async function cambiarEstadoNecesidad(necesidadId, estado, periodoId) {
  try {
    await actualizarNecesidad(necesidadId, { estado });
    mostrarMensaje(
      estado === 'OMITIDA'
        ? 'Necesidad marcada como OMITIDA. Ya no forma parte del progreso activo.'
        : 'Necesidad restaurada como PENDIENTE.',
      'success'
    );
    await cargar(periodoId);
  } catch (error) {
    mostrarMensaje(error.message || 'No se pudo cambiar el estado de la necesidad.', 'error');
  }
}

function mostrarEdicionNecesidad(necesidad, card, periodoId) {
  card.querySelectorAll('.edicion-necesidad').forEach((item) => item.remove());
  const formulario = document.createElement('form');
  formulario.className = 'w3-panel w3-pale-blue edicion-necesidad';
  const materiaLabel = document.createElement('label');
  materiaLabel.htmlFor = `edit-materia-${necesidad.id}`;
  materiaLabel.innerHTML = '<b>Materia</b>';
  const materiaSelect = document.createElement('select');
  materiaSelect.id = `edit-materia-${necesidad.id}`;
  materiaSelect.className = 'w3-select w3-border w3-margin-bottom';
  materiaSelect.append(opcion('', 'Selecciona una materia'));
  for (const materia of materiasCatalogo) {
    materiaSelect.append(opcion(materia.id, `${materia.clave} — ${materia.nombre}`));
  }
  materiaSelect.value = String(necesidad.materiaId);

  const grupoLabel = document.createElement('label');
  grupoLabel.htmlFor = `edit-grupo-${necesidad.id}`;
  grupoLabel.innerHTML = '<b>Grupo</b>';
  const grupoSelect = document.createElement('select');
  grupoSelect.id = `edit-grupo-${necesidad.id}`;
  grupoSelect.className = 'w3-select w3-border w3-margin-bottom';
  grupoSelect.append(opcion('', 'Selecciona un grupo'));
  for (const grupo of gruposCatalogo) {
    grupoSelect.append(opcion(grupo.id, `${grupo.clave} — ${grupo.nombre}`));
  }
  grupoSelect.value = String(necesidad.grupoId);

  const estadoLabel = document.createElement('label');
  estadoLabel.htmlFor = `edit-estado-${necesidad.id}`;
  estadoLabel.innerHTML = '<b>Estado</b>';
  const estadoSelect = document.createElement('select');
  estadoSelect.id = `edit-estado-${necesidad.id}`;
  estadoSelect.className = 'w3-select w3-border w3-margin-bottom';
  estadoSelect.append(opcion('PENDIENTE', 'PENDIENTE'), opcion('OMITIDA', 'OMITIDA'));
  estadoSelect.value = necesidad.estado;

  const guardar = document.createElement('button');
  guardar.type = 'submit';
  guardar.className = 'w3-button w3-green w3-round w3-margin-right';
  guardar.textContent = 'Guardar cambios';
  const cancelar = document.createElement('button');
  cancelar.type = 'button';
  cancelar.className = 'w3-button w3-gray w3-round';
  cancelar.textContent = 'Cancelar';
  cancelar.addEventListener('click', () => formulario.remove());
  formulario.append(materiaLabel, materiaSelect, grupoLabel, grupoSelect, estadoLabel, estadoSelect, guardar, cancelar);
  formulario.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await actualizarNecesidad(necesidad.id, {
        materiaId: Number(materiaSelect.value),
        grupoId: Number(grupoSelect.value),
        estado: estadoSelect.value
      });
      mostrarMensaje('Necesidad actualizada correctamente.', 'success');
      await cargar(periodoId);
    } catch (error) {
      mostrarMensaje(error.message || 'No se pudo actualizar la necesidad.', 'error');
    }
  });
  card.append(formulario);
}

async function cargar(periodoId) {
  if (!periodoId) return;
  estadoCarga.textContent = 'Cargando planificación...';
  estadoCarga.style.display = 'block';
  contenido.style.display = 'none';
  try {
    const data = await getPlanificacionPeriodo(periodoId);
    estadoCarga.style.display = 'none';
    contenido.style.display = 'block';

    const escrituraPermitida = data.periodo.estado === 'BORRADOR';
    document.getElementById('formNecesidad').querySelectorAll('select, button').forEach((control) => {
      control.disabled = !escrituraPermitida;
    });
    if (!escrituraPermitida) {
      mostrarMensaje(`El periodo está ${data.periodo.estado}; solo puede consultarse.`, 'warning');
    }

    document.getElementById('progreso').replaceChildren(
      tarjeta(data.progreso.total, 'Necesidades activas'),
      tarjeta(data.progreso.asignadas, 'Asignadas', 'w3-pale-green'),
      tarjeta(data.progreso.pendientes, 'Pendientes', 'w3-pale-yellow'),
      tarjeta(data.progreso.omitidas, 'Omitidas', 'w3-pale-blue')
    );
    const barra = document.getElementById('barraProgreso');
    barra.style.width = `${data.progreso.porcentaje}%`;
    barra.textContent = `${data.progreso.porcentaje}%`;

    const necesidades = document.getElementById('necesidades');
    necesidades.replaceChildren();
    if (!data.necesidades.length) {
      const vacio = document.createElement('p');
      vacio.textContent = 'No hay necesidades académicas registradas para este periodo.';
      necesidades.append(vacio);
    }
    for (const necesidad of data.necesidades) {
      const card = document.createElement('div');
      card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
      const titulo = document.createElement('b');
      titulo.textContent = `${necesidad.materiaClave} — ${necesidad.materiaNombre}`;
      card.append(titulo);
      linea(card, 'Grupo', `${necesidad.grupoClave} — ${necesidad.grupoNombre}`);
      linea(card, 'Carga', `${necesidad.horasSemanales} horas semanales`);
      linea(card, 'Estado', necesidad.estado);
      const acciones = document.createElement('div');
      acciones.className = 'necesidad-acciones';
      if (necesidad.estado === 'PENDIENTE') {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'w3-button w3-indigo w3-round';
        boton.textContent = 'Generar propuestas';
        boton.addEventListener('click', async () => {
          await mostrarAlternativas(periodoId, necesidad.id, card);
        });
        acciones.append(boton);

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'w3-button w3-blue w3-round';
        editar.textContent = 'Editar';
        editar.addEventListener('click', () => mostrarEdicionNecesidad(necesidad, card, periodoId));
        acciones.append(editar);

        const omitir = document.createElement('button');
        omitir.type = 'button';
        omitir.className = 'w3-button w3-orange w3-round';
        omitir.textContent = 'Omitir';
        omitir.addEventListener('click', async () => {
          await cambiarEstadoNecesidad(necesidad.id, 'OMITIDA', periodoId);
        });
        acciones.append(omitir);
      } else if (necesidad.estado === 'OMITIDA') {
        const restaurar = document.createElement('button');
        restaurar.type = 'button';
        restaurar.className = 'w3-button w3-green w3-round';
        restaurar.textContent = 'Volver a pendiente';
        restaurar.addEventListener('click', async () => {
          await cambiarEstadoNecesidad(necesidad.id, 'PENDIENTE', periodoId);
        });
        acciones.append(restaurar);
      }
      if (necesidad.estado !== 'ASIGNADA') {
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'w3-button w3-red w3-round';
        eliminar.textContent = 'Eliminar';
        eliminar.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar esta necesidad académica?')) return;
          try {
            await eliminarNecesidad(necesidad.id);
            mostrarMensaje('Necesidad eliminada correctamente.', 'success');
            await cargar(periodoId);
          } catch (error) {
            mostrarMensaje(error.message || 'No se pudo eliminar la necesidad.', 'error');
          }
        });
        acciones.append(eliminar);
      }
      card.append(acciones);
      necesidades.append(card);
    }

    const profesores = document.getElementById('profesores');
    profesores.replaceChildren();
    if (!data.profesores.length) {
      profesores.textContent = 'No hay profesores registrados.';
    }
    for (const profesor of data.profesores) {
      const cont = document.createElement('div');
      cont.className = 'w3-col s12 m6 l4';
      const card = document.createElement('div');
      card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
      const titulo = document.createElement('b');
      titulo.textContent = profesor.nombre;
      card.append(titulo);
      linea(card, 'Carga', `${profesor.cargaActual} / ${profesor.maximo} h`);
      linea(card, 'Porcentaje', `${profesor.porcentaje}%`);
      linea(card, 'Horas restantes', `${profesor.horasRestantes} h`);
      linea(card, 'Estado', profesor.clasificacion === 'NORMAL' ? 'Normal'
        : profesor.clasificacion === 'CERCA_DEL_MAXIMO' ? 'Cerca del máximo'
        : 'Máximo superado');
      cont.append(card);
      profesores.append(cont);
    }

    const salones = document.getElementById('salones');
    salones.replaceChildren();
    if (!data.salones.length) {
      salones.textContent = 'No hay salones registrados.';
    }
    for (const salon of data.salones) {
      const cont = document.createElement('div');
      cont.className = 'w3-col s12 m6 l4';
      const card = document.createElement('div');
      card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
      const titulo = document.createElement('b');
      titulo.textContent = `${salon.clave} — ${salon.nombre}`;
      card.append(titulo);
      linea(card, 'Tipo', salon.tipo);
      linea(card, 'Capacidad', `${salon.capacidad}`);
      linea(card, 'Cursos asignados', `${salon.cursosAsignados}`);
      linea(card, 'Bloques ocupados', `${salon.bloquesOcupados}`);
      cont.append(card);
      salones.append(cont);
    }

    const conflictos = document.getElementById('conflictos');
    conflictos.replaceChildren();
    if (!data.necesidadesConflicto.length) {
      conflictos.textContent = 'No hay necesidades asignadas con conflictos.';
    } else {
      for (const item of data.necesidadesConflicto) {
        const link = document.createElement('a');
        link.className = 'w3-button w3-pale-red w3-margin-bottom';
        link.href = `conflictos.html?periodoId=${encodeURIComponent(periodoId)}`;
        link.textContent = `${item.materia} — ${item.grupo} (curso ${item.cursoId})`;
        conflictos.append(link);
      }
    }
  } catch (error) {
    estadoCarga.textContent = error.message || 'No se pudo cargar la planificación.';
    estadoCarga.className = 'w3-panel w3-pale-red';
    estadoCarga.style.display = 'block';
  }
}

async function mostrarAlternativas(periodoId, necesidadId, card) {
  const cargando = Object.assign(document.createElement('p'), { textContent: 'Cargando propuestas...' });
  cargando.className = 'alternativa-propuesta';
  card.append(cargando);
  try {
    const data = await generarPropuestas(periodoId, { necesidadId, limite: 3 });
    cargando.remove();
    card.querySelectorAll('.alternativa-propuesta').forEach((item) => item.remove());
    for (const alternativa of data.alternativas) {
      const alternativaCard = document.createElement('div');
      alternativaCard.className = 'w3-panel w3-pale-blue alternativa-propuesta';
      const titulo = document.createElement('b');
      titulo.textContent = alternativa.profesor.nombre;
      alternativaCard.append(titulo);
      linea(alternativaCard, 'Calificación', `${alternativa.calificacion}/10`);
      linea(alternativaCard, 'Carga', `${alternativa.carga.actual}/${alternativa.carga.maxima} h; resultante ${alternativa.carga.resultante}/${alternativa.carga.maxima} h`);
      linea(alternativaCard, 'Horario', alternativa.horario.horarios.map((item) => `${item.dia} ${item.horaInicio}–${item.horaFin}`).join(', '));
      linea(alternativaCard, 'Salón', `${alternativa.salon.clave} — ${alternativa.salon.tipo} — capacidad ${alternativa.salon.capacidad}`);
      linea(alternativaCard, 'Motivos', alternativa.razones.join('; '));
      if (alternativa.advertencias.length) linea(alternativaCard, 'Advertencias', alternativa.advertencias.join('; '));
      const aceptar = document.createElement('button');
      aceptar.type = 'button';
      aceptar.className = 'w3-button w3-green w3-round';
      aceptar.textContent = 'Aceptar propuesta';
      aceptar.addEventListener('click', async () => {
        const resumen = [
          `Materia: ${alternativa.materia.clave} — ${alternativa.materia.nombre}`,
          `Grupo: ${alternativa.grupo.clave} — ${alternativa.grupo.nombre}`,
          `Profesor: ${alternativa.profesor.nombre}`,
          `Salón: ${alternativa.salon.clave}`,
          `Horario: ${alternativa.horario.horarios.map((item) => `${item.dia} ${item.horaInicio}-${item.horaFin}`).join(', ')}`
        ].join('\n');
        if (!window.confirm(`${resumen}\n\n¿Aceptar esta propuesta?`)) return;
        try {
          await aplicarPropuesta(periodoId, {
            necesidadId,
            profesorId: alternativa.profesor.id,
            salonId: alternativa.salon.id,
            horarioIds: alternativa.horario.horarioIds
          });
          await cargar(periodoId);
        } catch (error) {
          mostrarMensaje(`La propuesta ya no es válida. ${error.message}`, 'error');
          await mostrarAlternativas(periodoId, necesidadId, card);
        }
      });
      alternativaCard.append(aceptar);
      card.append(alternativaCard);
    }
    if (!data.alternativas.length) {
      const vacio = document.createElement('p');
      vacio.textContent = 'No existen alternativas compatibles con las reglas académicas actuales.';
      card.append(vacio);
    }
  } catch (error) {
    cargando.remove();
    mostrarMensaje(error.message || 'No se pudieron generar propuestas.', 'error');
  }
}

(async () => {
  try {
    const [periodos, materias, grupos] = await Promise.all([
      getPeriodos(),
      getMaterias(),
      getGrupos()
    ]);
    materiasCatalogo = materias;
    gruposCatalogo = grupos;
    periodoSelect.replaceChildren();
    for (const periodo of periodos) {
      const opcion = document.createElement('option');
      opcion.value = String(periodo.id);
      opcion.textContent = `${periodo.clave} — ${periodo.nombre} — ${periodo.estado}`;
      periodoSelect.append(opcion);
    }
    const materiaSelect = document.getElementById('materiaNecesidad');
    const grupoSelect = document.getElementById('grupoNecesidad');
    materiaSelect.replaceChildren(opcion('', 'Selecciona una materia'));
    grupoSelect.replaceChildren(opcion('', 'Selecciona un grupo'));
    for (const materia of materias) {
      materiaSelect.append(opcion(materia.id, `${materia.clave} — ${materia.nombre}`));
    }
    for (const grupo of grupos) {
      grupoSelect.append(opcion(grupo.id, `${grupo.clave} — ${grupo.nombre}`));
    }
    document.getElementById('formNecesidad').addEventListener('submit', async (event) => {
      event.preventDefault();
      const periodoId = Number(periodoSelect.value);
      if (!periodoId || !materiaSelect.value || !grupoSelect.value) {
        mostrarMensaje('Selecciona periodo, materia y grupo.', 'warning');
        return;
      }
      const crear = document.getElementById('crearNecesidad');
      crear.disabled = true;
      try {
        await crearNecesidadPeriodo(periodoId, {
          materiaId: Number(materiaSelect.value),
          grupoId: Number(grupoSelect.value)
        });
        mostrarMensaje('Necesidad creada correctamente.', 'success');
        materiaSelect.value = '';
        grupoSelect.value = '';
        await cargar(periodoId);
      } catch (error) {
        mostrarMensaje(error.message || 'No se pudo crear la necesidad.', 'error');
      } finally {
        crear.disabled = false;
      }
    });
    const seleccionado = new URLSearchParams(window.location.search).get('periodoId');
    if (seleccionado) periodoSelect.value = seleccionado;
    periodoSelect.addEventListener('change', () => cargar(periodoSelect.value));
    await cargar(periodoSelect.value);
  } catch (error) {
    estadoCarga.textContent = error.message || 'No se pudieron cargar los periodos.';
  }
})();
