const API_URL = 'http://localhost:3000/api';

// -------- PROFESORES --------
export async function getProfesores() {
  const r = await fetch(`${API_URL}/profesores`);
  if (!r.ok) throw new Error('Error al obtener profesores');
  return r.json();
}

export async function getProfesor(id) {
  const r = await fetch(`${API_URL}/profesores/${id}`);
  if (!r.ok) throw new Error('Profesor no encontrado');
  return r.json();
}

export async function crearProfesor(data) {
  const r = await fetch(`${API_URL}/profesores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error al crear');
  return r.json();
}

export async function actualizarProfesor(id, data) {
  const r = await fetch(`${API_URL}/profesores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error al actualizar');
  return r.json();
}

export async function eliminarProfesor(id) {
  const r = await fetch(`${API_URL}/profesores/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Error al eliminar');
  return r.json();
}

// -------- ACADEMIAS --------
export async function getAcademias() {
  const r = await fetch(`${API_URL}/academias`);
  if (!r.ok) {
    let resultado;
    try {
      resultado = await r.json();
    } catch {}
    throw new Error(resultado?.error || 'Error al obtener las academias');
  }
  return r.json();
}

export async function getAcademia(clave) {
  const r = await fetch(`${API_URL}/academias/${clave}`);
  if (!r.ok) {
    let resultado;
    try {
      resultado = await r.json();
    } catch {}
    throw new Error(resultado?.error || 'Error al obtener la academia');
  }
  return r.json();
}

export async function crearAcademia(data) {
  const r = await fetch(`${API_URL}/academias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error al crear');
  return r.json();
}

export async function actualizarAcademia(clave, data) {
  const r = await fetch(`${API_URL}/academias/${clave}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!r.ok) {
    throw new Error(
      (await r.json()).error || 'Error al actualizar la academia'
    );
  }

  return r.json();
}

export async function eliminarAcademia(clave) {
  const r = await fetch(`${API_URL}/academias/${clave}`, { method: 'DELETE' });
  return r.json();
}

// -------- LOGIN --------
export async function login(username, password) {
  const r = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!r.ok) throw new Error('Credenciales inválidas');
  return r.json();
}

// -------- HORARIOS --------
function crearQueryString(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') {
      return;
    }
    params.append(clave, String(valor));
  });

  const cadena = params.toString();
  return cadena ? `?${cadena}` : '';
}

export async function getHorarios(filtros = {}) {
  const response = await fetch(`${API_URL}/horarios${crearQueryString(filtros)}`);
  return procesarRespuestaEvaluacion(response, 'Error al obtener los horarios');
}

export async function getHorario(id) {
  const response = await fetch(`${API_URL}/horarios/${encodeURIComponent(id)}`);
  return procesarRespuestaEvaluacion(response, 'Error al obtener el horario');
}

export async function crearHorario(data) {
  const response = await fetch(`${API_URL}/horarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return procesarRespuestaEvaluacion(response, 'Error al crear el horario');
}

export async function actualizarHorario(id, data) {
  const response = await fetch(`${API_URL}/horarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return procesarRespuestaEvaluacion(response, 'Error al actualizar el horario');
}

export async function eliminarHorario(id) {
  const response = await fetch(`${API_URL}/horarios/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return procesarRespuestaEvaluacion(response, 'Error al eliminar el horario');
}

// -------- COINCIDENCIAS --------
export async function getCoincidencias(id) {
  const r = await fetch(`${API_URL}/profesores/${id}/coincidencias`);
  return r.json();
}

// -------- EVALUACIONES --------
async function procesarRespuestaEvaluacion(response, mensajePredeterminado) {
  let resultado;
  try {
    resultado = await response.json();
  } catch {
    throw new Error(mensajePredeterminado);
  }

  if (!response.ok) {
    throw new Error(resultado.error || mensajePredeterminado);
  }

  return resultado;
}

export async function crearEvaluacion(data) {
  const response = await fetch(`${API_URL}/evaluaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return procesarRespuestaEvaluacion(response, 'Error al registrar la evaluación');
}

export async function getEvaluaciones() {
  const response = await fetch(`${API_URL}/evaluaciones`);
  return procesarRespuestaEvaluacion(response, 'Error al obtener las evaluaciones');
}

export async function getEvaluacionesProfesor(id) {
  const response = await fetch(`${API_URL}/profesores/${encodeURIComponent(id)}/evaluaciones`);
  return procesarRespuestaEvaluacion(response, 'Error al obtener las evaluaciones del profesor');
}

export async function eliminarEvaluacion(id) {
  const response = await fetch(`${API_URL}/evaluaciones/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return procesarRespuestaEvaluacion(response, 'Error al eliminar la evaluación');
}