export function listarSalonesDisponibles(db, materiaId, grupoId, horarioIds, cursoIdActual = null, periodoId = null) {
  const materia = db.prepare('SELECT id, horasSemanales FROM materias WHERE id = ?').get(materiaId);
  const grupo = db.prepare('SELECT id, cantidadAlumnos FROM grupos WHERE id = ?').get(grupoId);
  if (!materia || !grupo) return [];

  const requisitos = db.prepare(
    'SELECT tipoRequerido, caracteristicas FROM materia_requisitos_salon WHERE materiaId = ?'
  ).get(materiaId);
  let requeridas = [];
  try { requeridas = JSON.parse(requisitos?.caracteristicas || '[]'); } catch { requeridas = []; }

  const franjas = db.prepare(
    `SELECT id, dia, horaInicio, horaFin FROM franjas_horarias
     WHERE id IN (${horarioIds.map(() => '?').join(',')})`
  ).all(...horarioIds);

  return db.prepare('SELECT * FROM salones ORDER BY clave').all().map((salon) => {
    const caracteristicas = db.prepare(
      'SELECT caracteristica FROM caracteristicas_salones WHERE salonId = ?'
    ).pluck().all(salon.id);
    const bloqueos = [];
    if (Number(salon.capacidad) < Number(grupo.cantidadAlumnos)) bloqueos.push('Capacidad insuficiente');
    if (requisitos?.tipoRequerido && salon.tipo !== requisitos.tipoRequerido) bloqueos.push('Tipo incompatible');
    for (const caracteristica of requeridas) {
      if (!caracteristicas.includes(caracteristica)) bloqueos.push(`Falta ${caracteristica}`);
    }
    for (const franja of franjas) {
      const ocupado = db.prepare(`
        SELECT 1 FROM cursos c
        JOIN curso_horarios ch ON ch.cursoId = c.id
        JOIN franjas_horarias fh ON fh.id = ch.horarioId
        WHERE c.salonId = ? AND c.id != ? AND fh.dia = ?
          AND fh.horaInicio < ? AND fh.horaFin > ?
          AND (? IS NULL OR c.periodoId = ?)
      `).get(salon.id, cursoIdActual ?? -1, franja.dia, franja.horaFin, franja.horaInicio, periodoId, periodoId);
      if (ocupado) bloqueos.push(`Ocupado el ${franja.dia} ${franja.horaInicio}–${franja.horaFin}`);
      const disponible = db.prepare(`
        SELECT disponible FROM salon_disponibilidad
        WHERE salonId = ? AND dia = ? AND horaInicio = ? AND horaFin = ?
      `).get(salon.id, franja.dia, franja.horaInicio, franja.horaFin);
      if (disponible && Number(disponible.disponible) === 0) bloqueos.push(`No disponible el ${franja.dia}`);
    }
    return {
      ...salon,
      caracteristicas,
      compatible: bloqueos.length === 0,
      bloqueos
    };
  }).filter((salon) => salon.compatible);
}
