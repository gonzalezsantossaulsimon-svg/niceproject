function solapan(aInicio, aFin, bInicio, bFin) {
  return aInicio < bFin && aFin > bInicio;
}

export function recomendarProfesores(db, materiaId, periodoId, horarioIds, cursoIdActual = null) {
  const materia = db.prepare('SELECT id, nombre FROM materias WHERE id = ?').get(materiaId);
  if (!materia) return [];
  const franjas = db.prepare(
    `SELECT dia, horaInicio, horaFin FROM franjas_horarias
     WHERE id IN (${horarioIds.map(() => '?').join(',')})`
  ).all(...horarioIds);

  return db.prepare(`
    SELECT p.*, pm.calificacion
    FROM profesor_materia_calificaciones pm
    JOIN profesores p ON p.id = pm.profesorId
    WHERE pm.materiaId = ?
    ORDER BY pm.calificacion DESC, p.nombre, p.apellido
  `).all(materiaId).map((profesor) => {
    const bloqueos = [];
    const advertencias = [];
    const cargaActual = periodoId
      ? db.prepare(`
          SELECT COALESCE(SUM(m.horasSemanales), 0) AS carga
          FROM cursos c
          JOIN materias m ON m.id = c.materiaId
          WHERE c.profesorId = ? AND c.periodoId = ? AND c.id != ?
        `).get(profesor.id, periodoId, cursoIdActual ?? -1).carga
      : 0;
    const maximo = Number(profesor.maxHorasSemanales);
    const horasRestantes = maximo - Number(cargaActual);
    if (horasRestantes < Number(db.prepare('SELECT horasSemanales FROM materias WHERE id = ?').get(materiaId).horasSemanales)) {
      bloqueos.push('SUPERA CARGA');
    }

    for (const franja of franjas) {
      const disponibilidad = db.prepare(`
        SELECT disponible FROM profesor_disponibilidad
        WHERE profesorId = ? AND dia = ? AND horaInicio = ? AND horaFin = ?
      `).get(profesor.id, franja.dia, franja.horaInicio, franja.horaFin);
      if (disponibilidad && Number(disponibilidad.disponible) === 0) {
        bloqueos.push(`NO DISPONIBLE el ${franja.dia}`);
      }
      const ocupado = db.prepare(`
        SELECT fh.dia, fh.horaInicio, fh.horaFin
        FROM cursos c
        JOIN curso_horarios ch ON ch.cursoId = c.id
        JOIN franjas_horarias fh ON fh.id = ch.horarioId
        WHERE c.profesorId = ? AND c.id != ? AND c.periodoId = ?
      `).all(profesor.id, cursoIdActual ?? -1, periodoId);
      if (ocupado.some((item) => item.dia === franja.dia
        && solapan(franja.horaInicio, franja.horaFin, item.horaInicio, item.horaFin))) {
        bloqueos.push(`CONFLICTO DE HORARIO el ${franja.dia}`);
      }
    }

    if (maximo > 0 && cargaActual >= maximo * 0.9) {
      advertencias.push('Carga cercana al máximo');
    }
    const razones = [
      `Calificación ${Number(profesor.calificacion).toFixed(1)}/10 en ${materia.nombre}`,
      bloqueos.length === 0 ? 'Disponible en todas las franjas' : 'Presenta restricciones',
      bloqueos.length === 0 ? 'Sin conflictos detectados' : '',
      `${horasRestantes} horas de carga disponibles`
    ].filter(Boolean);
    return {
      id: profesor.id,
      nombre: `${profesor.nombre} ${profesor.apellido}`.trim(),
      numeroEmpleado: profesor.numeroEmpleado,
      calificacionMateria: Number(profesor.calificacion),
      cargaActual: Number(cargaActual),
      maxHorasSemanales: maximo,
      horasRestantes,
      compatible: bloqueos.length === 0,
      clasificacion: bloqueos.length === 0 ? 'RECOMENDADO' : bloqueos[0].startsWith('SUPERA') ? 'SUPERA CARGA'
        : bloqueos.some((item) => item.includes('CONFLICTO')) ? 'CONFLICTO DE HORARIO'
        : bloqueos.some((item) => item.includes('NO DISPONIBLE')) ? 'NO DISPONIBLE' : 'DISPONIBLE',
      razones,
      advertencias,
      bloqueos
    };
  });
}
