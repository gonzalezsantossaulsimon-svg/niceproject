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
  return r.json();
}

export async function getAcademia(clave) {
  const r = await fetch(`${API_URL}/academias/${clave}`);
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

// -------- COINCIDENCIAS --------
export async function getCoincidencias(id) {
  const r = await fetch(`${API_URL}/profesores/${id}/coincidencias`);
  return r.json();
}