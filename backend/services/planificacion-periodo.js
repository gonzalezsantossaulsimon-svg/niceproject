import { resumirPeriodo } from './validacion-periodo.js';
import { UMBRAL_CARGA_CERCANA } from './recomendacion-profesores.js';

export function resumirPlanificacionPeriodo(db, periodoId) {
  const periodo = db.prepare('SELECT * FROM periodos_academicos WHERE id = ?').get(periodoId);
  if (!periodo) return null;

  const necesidades = db.prepare(`
    SELECT n.*, m.clave AS materiaClave, m.nombre AS materiaNombre, m.horasSemanales,
      g.clave AS grupoClave, g.nombre AS grupoNombre, g.cantidadAlumnos
    FROM necesidades_planificacion n
    JOIN materias m ON m.id = n.materiaId
    JOIN grupos g ON g.id = n.grupoId
    WHERE n.periodoId = ?
    ORDER BY m.clave, g.clave, n.id
  `).all(periodoId);

  const activas = necesidades.filter((item) => item.estado !== 'OMITIDA');
  const pendientes = activas.filter((item) => item.estado === 'PENDIENTE');
  const asignadas = activas.filter((item) => item.estado === 'ASIGNADA');
  const omitidas = necesidades.filter((item) => item.estado === 'OMITIDA');
  const porcentaje = activas.length === 0
    ? 0
    : Math.round((asignadas.length / activas.length) * 100);

  const resumenConflictos = resumirPeriodo(db, periodoId);
  const idsConConflicto = new Set(resumenConflictos?.conflictos.map((item) => item.cursoId) || []);
  const necesidadesConflicto = asignadas
    .filter((item) => item.cursoId && idsConConflicto.has(item.cursoId))
    .map((item) => ({
      id: item.id,
      materia: `${item.materiaClave} — ${item.materiaNombre}`,
      grupo: `${item.grupoClave} — ${item.grupoNombre}`,
      cursoId: item.cursoId
    }));

  const profesores = db.prepare(`
    SELECT p.id, p.nombre, p.apellido, p.numeroEmpleado, p.maxHorasSemanales,
      COALESCE(SUM(m.horasSemanales), 0) AS cargaActual
    FROM profesores p
    LEFT JOIN cursos c ON c.profesorId = p.id AND c.periodoId = ?
    LEFT JOIN materias m ON m.id = c.materiaId
    GROUP BY p.id
    ORDER BY p.nombre, p.apellido, p.id
  `).all(periodoId).map((profesor) => {
    const cargaActual = Number(profesor.cargaActual);
    const maximo = Number(profesor.maxHorasSemanales);
    const porcentajeCarga = maximo > 0 ? cargaActual / maximo : 0;
    return {
      id: profesor.id,
      nombre: `${profesor.nombre} ${profesor.apellido}`.trim(),
      numeroEmpleado: profesor.numeroEmpleado,
      cargaActual,
      maximo,
      porcentaje: Math.round(porcentajeCarga * 100),
      horasRestantes: Math.max(0, maximo - cargaActual),
      clasificacion: cargaActual > maximo ? 'MAXIMO_SUPERADO'
        : porcentajeCarga >= UMBRAL_CARGA_CERCANA ? 'CERCA_DEL_MAXIMO'
        : 'NORMAL'
    };
  });

  const salones = db.prepare(`
    SELECT s.id, s.clave, s.nombre, s.tipo, s.capacidad,
      COUNT(DISTINCT c.id) AS cursosAsignados,
      COUNT(DISTINCT ch.horarioId) AS bloquesOcupados
    FROM salones s
    LEFT JOIN cursos c ON c.salonId = s.id AND c.periodoId = ?
    LEFT JOIN curso_horarios ch ON ch.cursoId = c.id
    GROUP BY s.id
    ORDER BY s.clave
  `).all(periodoId).map((salon) => ({
    id: salon.id,
    clave: salon.clave,
    nombre: salon.nombre,
    tipo: salon.tipo,
    capacidad: salon.capacidad,
    cursosAsignados: Number(salon.cursosAsignados),
    bloquesOcupados: Number(salon.bloquesOcupados)
  }));

  return {
    periodo,
    progreso: {
      porcentaje,
      total: activas.length,
      asignadas: asignadas.length,
      pendientes: pendientes.length,
      omitidas: omitidas.length
    },
    necesidades,
    necesidadesConflicto,
    profesores,
    profesoresCercaCargaMaxima: profesores.filter((item) =>
      item.clasificacion === 'CERCA_DEL_MAXIMO' || item.clasificacion === 'MAXIMO_SUPERADO'
    ).length,
    salones,
    conflictos: resumenConflictos?.conflictos || []
  };
}
