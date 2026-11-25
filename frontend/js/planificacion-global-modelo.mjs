export const CRITERIOS = {
  A: 'Prioriza la calificación académica de las nuevas asignaciones.',
  B: 'Reduce la concentración de carga respecto a la capacidad de los profesores.',
  C: 'Reduce los huecos internos de profesores y grupos.'
};

export function validarComparacion(data, periodoId) {
  if (!data || data.ok !== true || data.modo !== 'ABC' || data.soloLectura !== true || data.aplicable !== false
    || String(data.periodo?.id) !== String(periodoId) || !Array.isArray(data.planes)
    || data.planes.length !== 3 || !Array.isArray(data.conflictosExistentes)) {
    throw new Error('La respuesta de planificación global no es válida.');
  }
  for (const id of Object.keys(CRITERIOS)) {
    const plan = data.planes.find(p => p.id === id);
    if (!plan || !plan.resumen || !plan.metricas || !plan.busqueda || !Array.isArray(plan.asignaciones)
      || !Array.isArray(plan.sinAsignar) || plan.resumen.nuevas !== plan.asignaciones.length
      || plan.resumen.pendientesDespues !== plan.sinAsignar.length) throw new Error(`Respuesta incompleta para el plan ${id}.`);
  }
  return data;
}

// Adaptación exclusivamente visual: no son cursos registrados ni IDs reales.
export function cursosPropuestos(plan, periodoId) {
  return plan.asignaciones.map(({ necesidadId, alternativa: a }) => ({
    id: -Number(necesidadId), necesidadId, periodoId, estado: 'PROPUESTA',
    materiaId: a.materia.id, materia: a.materia, profesorId: a.profesor.id, profesor: a.profesor,
    grupoId: a.grupo.id, grupo: a.grupo, salonId: a.salon.id, salon: a.salon,
    horarios: a.horario.horarios, advertencias: a.advertencias || [], carga: a.carga,
    calificacion: a.calificacion
  }));
}

export function estadoBusqueda(busqueda) {
  return `${busqueda.coberturaOptima ? 'Cobertura óptima demostrada' : 'Mejor cobertura encontrada (no demostrada óptima)'} · ${busqueda.objetivoOptimo ? 'Criterio óptimo demostrado' : 'Criterio no demostrado óptimo'} · ${busqueda.pasos}/${busqueda.limite} pasos${busqueda.limiteAlcanzado ? ' · límite alcanzado' : ''}`;
}

export function indicadores(plan) {
  const r = plan.resumen, m = plan.metricas;
  return [r.nuevas, r.pendientesDespues, r.coberturaProyectada, r.calificacionPromedioNuevas,
    m.cargaRmsPorcentaje, m.cargaMaximaPorcentaje, m.minutosHuecos];
}
