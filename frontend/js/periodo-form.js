import { crearPeriodo, getPeriodos, actualizarPeriodo } from './api.js';
import { requiereSesion } from './auth.js';

requiereSesion();
const id = new URLSearchParams(window.location.search).get('id');
const formulario = document.getElementById('formulario');
const mensaje = document.getElementById('mensaje');

async function cargar() {
  if (!id) return;
  document.getElementById('titulo').textContent = 'Editar periodo';
  const periodo = (await getPeriodos()).find((item) => String(item.id) === id);
  if (!periodo) throw new Error('Periodo no encontrado');
  document.getElementById('clave').value = periodo.clave;
  document.getElementById('nombre').value = periodo.nombre;
  document.getElementById('fechaInicio').value = periodo.fechaInicio || '';
  document.getElementById('fechaFin').value = periodo.fechaFin || '';
  document.getElementById('estado').value = periodo.estado === 'PUBLICADO' ? 'BORRADOR' : periodo.estado;
}

formulario.addEventListener('submit', async (event) => {
  event.preventDefault();
  const inicio = document.getElementById('fechaInicio').value;
  const fin = document.getElementById('fechaFin').value;
  if (inicio && fin && fin < inicio) {
    mensaje.textContent = 'La fecha fin no puede ser anterior a la fecha inicio.';
    mensaje.style.display = 'block';
    return;
  }
  const payload = {
    clave: document.getElementById('clave').value.trim(),
    nombre: document.getElementById('nombre').value.trim(),
    fechaInicio: inicio,
    fechaFin: fin,
    estado: document.getElementById('estado').value
  };
  try {
    if (id) await actualizarPeriodo(id, payload);
    else await crearPeriodo(payload);
    window.location.href = 'periodos.html';
  } catch (error) {
    mensaje.textContent = error.message;
    mensaje.style.display = 'block';
  }
});
cargar().catch((error) => { mensaje.textContent = error.message; mensaje.style.display = 'block'; });
