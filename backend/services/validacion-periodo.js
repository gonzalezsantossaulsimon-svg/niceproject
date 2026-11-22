import { UMBRAL_CARGA_CERCANA } from './recomendacion-profesores.js';

function solapan(aInicio, aFin, bInicio, bFin) {
  return aInicio < bFin && aFin > bInicio;
}

export function validarCursoAcademico(db, curso, cursoIdActual = null) {
  const materia = db.prepare('SELECT * FROM materias WHERE id = ?').get(curso.materiaId);
  const profesor = db.prepare('SELECT * FROM profesores WHERE id = ?').get(curso.profesorId);
  const grupo = db.prepare('SELECT * FROM grupos WHERE id = ?').get(curso.grupoId);
  const salon = db.prepare('SELECT * FROM salones WHERE id = ?').get(curso.salonId);
  const bloqueos = [];
  if (!materia || !profesor || !grupo || !salon) return { compatible: false, bloqueos: ['Datos del curso incompletos'] };

  if (Number(salon.capacidad) < Number(grupo.cantidadAlumnos)) bloqueos.push('Capacidad insuficiente');
  const requisitos = db.prepare('SELECT tipoRequerido, caracteristicas FROM materia_requisitos_salon WHERE materiaId = ?').get(materia.id);
  if (requisitos?.tipoRequerido && salon.tipo !== requisitos.tipoRequerido) bloqueos.push('Tipo de salón incompatible');
  let requeridas = [];
  try { requeridas = JSON.parse(requisitos?.caracteristicas || '[]'); } catch {}
  const caracteristicas = db.prepare('SELECT caracteristica FROM caracteristicas_salones WHERE salonId = ?').pluck().all(salon.id);
  if (requeridas.some((item) => !caracteristicas.includes(item))) bloqueos.push('El salón no tiene las características requeridas');

  const franjas = db.prepare(
    `SELECT fh.* FROM curso_horarios ch JOIN franjas_horarias fh ON fh.id = ch.horarioId
     WHERE ch.cursoId = ?`
  ).all(cursoIdActual ?? -1);
  const carga = db.prepare(`
    SELECT COALESCE(SUM(m.horasSemanales), 0) carga
    FROM cursos c JOIN materias m ON m.id = c.materiaId
    WHERE c.profesorId = ? AND c.periodoId = ? AND c.id != ?
  `).get(profesor.id, curso.periodoId, cursoIdActual ?? -1).carga;
  if (Number(carga) + Number(materia.horasSemanales) > Number(profesor.maxHorasSemanales)) bloqueos.push('SUPERA CARGA');

  for (const franja of franjas) {
    const disponibilidad = db.prepare(`
      SELECT disponible FROM profesor_disponibilidad
      WHERE profesorId=? AND dia=? AND horaInicio=? AND horaFin=?
    `).get(profesor.id, franja.dia, franja.horaInicio, franja.horaFin);
    if (disponibilidad && !Number(disponibilidad.disponible)) bloqueos.push(`Profesor no disponible el ${franja.dia}`);

    const otros = db.prepare(`
      SELECT c.id, c.profesorId, c.grupoId, c.salonId, fh.dia, fh.horaInicio, fh.horaFin
      FROM cursos c JOIN curso_horarios ch ON ch.cursoId=c.id
      JOIN franjas_horarias fh ON fh.id=ch.horarioId
      WHERE c.periodoId=? AND c.id!=?
    `).all(curso.periodoId, cursoIdActual ?? -1);
    for (const otro of otros) {
      if (otro.dia !== franja.dia || !solapan(franja.horaInicio, franja.horaFin, otro.horaInicio, otro.horaFin)) continue;
      if (otro.profesorId === profesor.id) bloqueos.push(`Profesor ocupado el ${otro.dia} ${otro.horaInicio}–${otro.horaFin}`);
      if (otro.grupoId === grupo.id) bloqueos.push(`Grupo ocupado el ${otro.dia} ${otro.horaInicio}–${otro.horaFin}`);
      if (otro.salonId === salon.id) bloqueos.push(`Salón ocupado el ${otro.dia} ${otro.horaInicio}–${otro.horaFin}`);
    }
  }
  return { compatible: bloqueos.length === 0, bloqueos: [...new Set(bloqueos)] };
}

export function resumirPeriodo(db, periodoId) {
  const periodo = db.prepare('SELECT * FROM periodos_academicos WHERE id = ?').get(periodoId);
  if (!periodo) return null;
  const cursos = db.prepare('SELECT * FROM cursos WHERE periodoId = ?').all(periodoId);
  let validos = 0;
  const advertencias = [];
  const conflictos = [];
  for (const curso of cursos) {
    const validacion = validarCursoAcademico(db, curso, curso.id);
    const detalle = db.prepare(`
      SELECT m.clave AS materiaClave, m.nombre AS materiaNombre,
        g.clave AS grupoClave, g.nombre AS grupoNombre,
        p.nombre || ' ' || p.apellido AS profesorNombre,
        p.maxHorasSemanales,
        (SELECT COALESCE(SUM(m2.horasSemanales),0)
         FROM cursos c2 JOIN materias m2 ON m2.id=c2.materiaId
         WHERE c2.profesorId=c.profesorId AND c2.periodoId=c.periodoId) AS cargaActual
      FROM cursos c JOIN materias m ON m.id=c.materiaId
      JOIN grupos g ON g.id=c.grupoId JOIN profesores p ON p.id=c.profesorId
      WHERE c.id=?
    `).get(curso.id);
    if (validacion.compatible) validos += 1;
    if (validacion.bloqueos.length) {
      conflictos.push({
        cursoId: curso.id,
        materia: `${detalle.materiaClave} — ${detalle.materiaNombre}`,
        grupo: `${detalle.grupoClave} — ${detalle.grupoNombre}`,
        tipo: 'BLOQUEANTE',
        motivo: validacion.bloqueos.join('; '),
        bloqueos: validacion.bloqueos
      });
    } else if (detalle.maxHorasSemanales > 0 && detalle.cargaActual >= detalle.maxHorasSemanales * UMBRAL_CARGA_CERCANA) {
      advertencias.push({
        cursoId: curso.id,
        materia: `${detalle.materiaClave} — ${detalle.materiaNombre}`,
        grupo: `${detalle.grupoClave} — ${detalle.grupoNombre}`,
        tipo: 'ADVERTENCIA',
        motivo: `Profesor ${detalle.profesorNombre} con ${detalle.cargaActual}/${detalle.maxHorasSemanales} h de carga`
      });
    }
  }
  return {
    periodo,
    cursosTotales: cursos.length,
    cursosValidos: validos,
    advertencias: advertencias.length,
    detalleAdvertencias: advertencias,
    conflictos
  };
}
