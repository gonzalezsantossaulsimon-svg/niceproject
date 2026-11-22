import { getPeriodos, getConflictosPeriodo, actualizarPeriodo } from './api.js';
import { requiereSesion } from './auth.js';

requiereSesion();
const contenedor = document.getElementById('periodos');

async function cargar() {
  const periodos = await getPeriodos();
  contenedor.replaceChildren();
  for (const periodo of periodos) {
    const card = document.createElement('div');
    card.className = 'w3-card w3-white w3-padding w3-margin-bottom';
    const titulo = document.createElement('h2');
    titulo.className = 'w3-medium';
    titulo.textContent = `${periodo.clave} — ${periodo.nombre}`;
    const estado = document.createElement('p');
    estado.textContent = `Estado: ${periodo.estado}`;
    const fechas = document.createElement('p');
    fechas.textContent = `${periodo.fechaInicio || 'Sin inicio'} a ${periodo.fechaFin || 'Sin fin'}`;
    const acciones = document.createElement('div');
    const editar = document.createElement('a');
    editar.href = `periodo-form.html?id=${encodeURIComponent(periodo.id)}`;
    editar.className = 'w3-button w3-indigo w3-round w3-margin-right';
    editar.textContent = 'Editar';
    const conflictos = document.createElement('a');
    conflictos.href = `conflictos.html?periodoId=${encodeURIComponent(periodo.id)}`;
    conflictos.className = 'w3-button w3-orange w3-round w3-margin-right';
    conflictos.textContent = 'Conflictos';
    const validar = document.createElement('button');
    validar.type = 'button';
    validar.className = 'w3-button w3-green w3-round';
    validar.textContent = 'Validar';
    validar.disabled = periodo.estado === 'PUBLICADO' || periodo.estado === 'CERRADO';
    validar.addEventListener('click', async () => {
      try {
        const resumen = await getConflictosPeriodo(periodo.id);
        if (resumen.conflictos.length) throw new Error(`Existen ${resumen.conflictos.length} conflictos bloqueantes.`);
        await actualizarPeriodo(periodo.id, { ...periodo, estado: 'VALIDADO' });
        await cargar();
      } catch (error) { window.alert(error.message); }
    });
    acciones.append(editar, conflictos, validar);
    card.append(titulo, estado, fechas, acciones);
    contenedor.append(card);
  }
}
cargar().catch((error) => { contenedor.textContent = error.message; });
