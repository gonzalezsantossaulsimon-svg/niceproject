export function guardarSesion(usuario) {
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function obtenerSesion() {
  const u = localStorage.getItem('usuario');
  return u ? JSON.parse(u) : null;
}

export function cerrarSesion() {
  localStorage.removeItem('usuario');
}

export function requiereSesion() {
  const u = obtenerSesion();
  if (!u) {
    window.location.href = 'login.html';
  }
  return u;
}