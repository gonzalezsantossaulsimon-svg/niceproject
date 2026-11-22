const API_URL = 'http://localhost:3000/api';

async function procesarRespuestaApi(response, mensajePredeterminado) {
  const texto = await response.text();
  let resultado = null;

  try {
    resultado = texto ? JSON.parse(texto) : null;
  } catch {}

  if (!response.ok) {
    throw new Error(resultado?.error || mensajePredeterminado);
  }

  return resultado;
}

async function solicitarCatalogo(ruta, metodo, data, mensajePredeterminado) {
  const opciones = { method: metodo };

  if (data !== undefined) {
    opciones.headers = { 'Content-Type': 'application/json' };
    opciones.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_URL}${ruta}`, opciones);
  return procesarRespuestaApi(response, mensajePredeterminado);
}

// -------- CATÁLOGOS ACADÉMICOS --------
export async function getMaterias() {
  return solicitarCatalogo('/materias', 'GET', undefined, 'Error al obtener las materias');
}

export async function getPeriodos() {
  return solicitarCatalogo('/periodos', 'GET', undefined, 'Error al obtener los periodos');
}
export async function crearPeriodo(data) {
  return solicitarCatalogo('/periodos', 'POST', data, 'Error al crear el periodo');
}
export async function actualizarPeriodo(id, data) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar el periodo');
}
export async function getConflictosPeriodo(id) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/conflictos`, 'GET', undefined, 'Error al obtener conflictos');
}
export async function getPlanificacionPeriodo(id) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/planificacion`, 'GET', undefined, 'Error al obtener la planificación');
}
export async function getNecesidadesPeriodo(id) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/necesidades-planificacion`, 'GET', undefined, 'Error al obtener necesidades');
}
export async function crearNecesidadPeriodo(id, data) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/necesidades-planificacion`, 'POST', data, 'Error al crear la necesidad');
}
export async function actualizarNecesidad(id, data) {
  return solicitarCatalogo(`/necesidades-planificacion/${encodeURIComponent(id)}`, 'PUT', data, 'Error al modificar la necesidad');
}
export async function eliminarNecesidad(id) {
  return solicitarCatalogo(`/necesidades-planificacion/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar la necesidad');
}
export async function generarPropuestas(id, data) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/propuestas-planificacion`, 'POST', data, 'Error al generar propuestas');
}
export async function aplicarPropuesta(id, data) {
  return solicitarCatalogo(`/periodos/${encodeURIComponent(id)}/aplicar-propuesta`, 'POST', data, 'Error al aplicar la propuesta');
}
export async function getPatronesMateria(materiaId, horarioBaseId) {
  return solicitarCatalogo(`/materias/${encodeURIComponent(materiaId)}/patrones-horarios?horarioBaseId=${encodeURIComponent(horarioBaseId)}`, 'GET', undefined, 'Error al generar el horario');
}
export async function getProfesoresRecomendados(materiaId, periodoId, horarioIds) {
  const ids = horarioIds.map((id) => encodeURIComponent(id)).join(',');
  return solicitarCatalogo(`/materias/${encodeURIComponent(materiaId)}/profesores-recomendados?periodoId=${encodeURIComponent(periodoId)}&horarioIds=${ids}`, 'GET', undefined, 'Error al obtener profesores');
}
export async function getSalonesDisponibles(materiaId, grupoId, horarioIds) {
  const ids = horarioIds.map((id) => encodeURIComponent(id)).join(',');
  return solicitarCatalogo(`/salones/disponibles?materiaId=${encodeURIComponent(materiaId)}&grupoId=${encodeURIComponent(grupoId)}&horarioIds=${ids}`, 'GET', undefined, 'Error al obtener salones');
}
export async function actualizarCalificacionesProfesor(id, calificaciones) {
  return solicitarCatalogo(`/profesores/${encodeURIComponent(id)}/calificaciones`, 'PUT', { calificaciones }, 'Error al actualizar calificaciones');
}
export async function eliminarCalificacionProfesor(id, materiaId) {
  return solicitarCatalogo(`/profesores/${encodeURIComponent(id)}/calificaciones/${encodeURIComponent(materiaId)}`, 'DELETE', undefined, 'Error al eliminar la relación profesor-materia');
}
export async function actualizarDisponibilidadProfesor(id, disponibilidad) {
  return solicitarCatalogo(`/profesores/${encodeURIComponent(id)}/disponibilidad`, 'PUT', { disponibilidad }, 'Error al actualizar disponibilidad');
}

export async function getMateria(id) {
  return solicitarCatalogo(`/materias/${encodeURIComponent(id)}`, 'GET', undefined, 'Error al obtener la materia');
}

export async function crearMateria(data) {
  return solicitarCatalogo('/materias', 'POST', data, 'Error al crear la materia');
}

export async function actualizarMateria(id, data) {
  return solicitarCatalogo(`/materias/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar la materia');
}

export async function eliminarMateria(id) {
  return solicitarCatalogo(`/materias/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar la materia');
}

export async function getSalones() {
  return solicitarCatalogo('/salones', 'GET', undefined, 'Error al obtener los salones');
}

export async function getSalon(id) {
  return solicitarCatalogo(`/salones/${encodeURIComponent(id)}`, 'GET', undefined, 'Error al obtener el salón');
}

export async function crearSalon(data) {
  return solicitarCatalogo('/salones', 'POST', data, 'Error al crear el salón');
}

export async function actualizarSalon(id, data) {
  return solicitarCatalogo(`/salones/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar el salón');
}

export async function eliminarSalon(id) {
  return solicitarCatalogo(`/salones/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar el salón');
}

export async function getGrupos() {
  return solicitarCatalogo('/grupos', 'GET', undefined, 'Error al obtener los grupos');
}

export async function getGrupo(id) {
  return solicitarCatalogo(`/grupos/${encodeURIComponent(id)}`, 'GET', undefined, 'Error al obtener el grupo');
}

export async function crearGrupo(data) {
  return solicitarCatalogo('/grupos', 'POST', data, 'Error al crear el grupo');
}

export async function actualizarGrupo(id, data) {
  return solicitarCatalogo(`/grupos/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar el grupo');
}

export async function eliminarGrupo(id) {
  return solicitarCatalogo(`/grupos/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar el grupo');
}

export async function getFranjasHorarias() {
  return solicitarCatalogo('/franjas-horarias', 'GET', undefined, 'Error al obtener los horarios disponibles');
}

export async function getFranjaHoraria(id) {
  return solicitarCatalogo(`/franjas-horarias/${encodeURIComponent(id)}`, 'GET', undefined, 'Error al obtener el horario disponible');
}

export async function crearFranjaHoraria(data) {
  return solicitarCatalogo('/franjas-horarias', 'POST', data, 'Error al crear el horario disponible');
}

export async function actualizarFranjaHoraria(id, data) {
  return solicitarCatalogo(`/franjas-horarias/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar el horario disponible');
}

export async function eliminarFranjaHoraria(id) {
  return solicitarCatalogo(`/franjas-horarias/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar el horario disponible');
}

// -------- CURSOS --------
export async function getCursos() {
  return solicitarCatalogo('/cursos', 'GET', undefined, 'Error al obtener los cursos');
}

export async function getCurso(id) {
  return solicitarCatalogo(`/cursos/${encodeURIComponent(id)}`, 'GET', undefined, 'Error al obtener el curso');
}

export async function crearCurso(data) {
  return solicitarCatalogo('/cursos', 'POST', data, 'Error al crear el curso');
}

export async function actualizarCurso(id, data) {
  return solicitarCatalogo(`/cursos/${encodeURIComponent(id)}`, 'PUT', data, 'Error al actualizar el curso');
}

export async function eliminarCurso(id) {
  return solicitarCatalogo(`/cursos/${encodeURIComponent(id)}`, 'DELETE', undefined, 'Error al eliminar el curso');
}

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
  return procesarRespuestaApi(response, mensajePredeterminado);
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