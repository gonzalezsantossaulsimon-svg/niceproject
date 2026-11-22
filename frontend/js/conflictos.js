import { getPeriodos, getConflictosPeriodo, actualizarPeriodo } from './api.js';
import { requiereSesion } from './auth.js';

requiereSesion();
const periodoSelect = document.getElementById('periodoId');
const resumen = document.getElementById('resumen');
const conflictos = document.getElementById('conflictos');
const advertencias = document.getElementById('advertencias');
const mensaje = document.getElementById('mensaje');
let periodoActual = null;

function tarjeta(valor, etiqueta, color) {
  const cont = document.createElement('div');
  cont.className = 'w3-col s6 m3';
  const card = document.createElement('div');
  card.className = `w3-card w3-padding w3-center ${color}`;
  const numero = document.createElement('p');
  numero.className = 'w3-xlarge';
  numero.textContent = String(valor);
  const texto = document.createElement('p');
  texto.textContent = etiqueta;
  card.append(numero, texto);
  cont.append(card);
  return cont;
}

async function cargar(periodoId) {
  if (!periodoId) return;
  mensaje.style.display = 'none';
  const data = await getConflictosPeriodo(periodoId);
  periodoActual = data.periodo;
  resumen.replaceChildren(
    tarjeta(data.cursosTotales, 'Cursos totales', 'w3-white'),
    tarjeta(data.cursosValidos, 'Correctos', 'w3-pale-green'),
    tarjeta(data.advertencias, 'Advertencias', 'w3-pale-yellow'),
    tarjeta(data.conflictos.length, 'Conflictos', 'w3-pale-red')
  );
  conflictos.replaceChildren();
  if (!data.conflictos.length) {
    const vacio = document.createElement('p');
    vacio.textContent = 'No hay conflictos bloqueantes.';
    conflictos.append(vacio);
  }
  for (const conflicto of data.conflictos) {
    const card = document.createElement('div');
    card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
    const titulo = document.createElement('b');
    titulo.textContent = `Curso ${conflicto.cursoId}: ${conflicto.materia} — ${conflicto.grupo} (${conflicto.tipo})`;
    const motivo = document.createElement('p');
    motivo.textContent = conflicto.motivo;
    const lista = document.createElement('ul');
    for (const bloqueo of conflicto.bloqueos) {
      const li = document.createElement('li');
      li.textContent = bloqueo;
      lista.append(li);
    }
    card.append(titulo, motivo, lista);
    conflictos.append(card);
  }
  advertencias.replaceChildren();
  if (!data.detalleAdvertencias?.length) {
    const sinAdvertencias = document.createElement('p');
    sinAdvertencias.textContent = 'No hay advertencias registradas.';
    advertencias.append(sinAdvertencias);
  } else {
    for (const advertencia of data.detalleAdvertencias) {
      const card = document.createElement('div');
      card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
      const titulo = document.createElement('b');
      titulo.textContent = `${advertencia.materia} — ${advertencia.grupo} (${advertencia.tipo})`;
      const motivo = document.createElement('p');
      motivo.textContent = advertencia.motivo;
      card.append(titulo, motivo);
      advertencias.append(card);
    }
  }

  document.getElementById('accionesPeriodo')?.remove();
  {
    const acciones = document.createElement('div');
    acciones.id = 'accionesPeriodo';
    acciones.className = 'w3-margin-top';
    const validar = document.createElement('button');
    validar.type = 'button';
    validar.className = 'w3-button w3-green w3-round w3-margin-right';
    validar.textContent = 'Validar periodo';
    validar.addEventListener('click', async () => {
      if (data.conflictos.length) {
        mensaje.textContent = `No se puede publicar el periodo porque existen ${data.conflictos.length} conflictos bloqueantes.`;
        mensaje.style.display = 'block';
        return;
      }
      await actualizarPeriodo(periodoId, { ...periodoActual, estado: 'VALIDADO' });
      await cargar(periodoId);
    });
    const publicar = document.createElement('button');
    publicar.type = 'button';
    publicar.className = 'w3-button w3-indigo w3-round';
    publicar.textContent = 'Publicar periodo';
    publicar.addEventListener('click', async () => {
      try {
        await actualizarPeriodo(periodoId, { ...periodoActual, estado: 'PUBLICADO' });
        await cargar(periodoId);
      } catch (error) {
        mensaje.textContent = error.message;
        mensaje.style.display = 'block';
      }
    });
    acciones.append(validar, publicar);
    document.querySelector('main').append(acciones);
  }
}

(async () => {
  const periodos = await getPeriodos();
  periodoSelect.replaceChildren();
  for (const periodo of periodos) {
    const opcion = document.createElement('option');
    opcion.value = String(periodo.id);
    opcion.textContent = `${periodo.clave} — ${periodo.nombre} — ${periodo.estado}`;
    periodoSelect.append(opcion);
  }
  const seleccionado = new URLSearchParams(window.location.search).get('periodoId');
  if (seleccionado) periodoSelect.value = seleccionado;
  periodoSelect.addEventListener('change', () => cargar(periodoSelect.value));
  await cargar(periodoSelect.value);
})();
