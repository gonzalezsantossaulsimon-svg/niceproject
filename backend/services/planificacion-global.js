import { enumerarAlternativasPlanificacion } from './propuestas-planificacion.js';
import { resumirPeriodo } from './validacion-periodo.js';
import { UMBRAL_CARGA_CERCANA } from './recomendacion-profesores.js';
import { buscarAsignacionesGlobales, solapan, sesiones, cruza, LIMITE_PREDETERMINADO, MAX_NECESIDADES } from './busqueda-global.js';

import { PLANES, medirPlan, valorPlan } from './criterios-planes.js';

export function generarPlanificacionGlobal(db, periodoId, { limite = LIMITE_PREDETERMINADO, modo = 'COBERTURA' } = {}) {
  if (!['COBERTURA', 'ABC'].includes(modo)) return { ok: false, error: 'MODO_INVALIDO', mensaje: 'Modo no valido.' };
  const periodo = db.prepare('SELECT * FROM periodos_academicos WHERE id = ?').get(periodoId);
  if (!periodo) return { ok: false, error: 'PERIODO_NO_EXISTE', mensaje: 'El periodo no existe.' };
  if (!['BORRADOR', 'VALIDADO'].includes(periodo.estado)) {
    return { ok: false, error: 'PERIODO_NO_PLANIFICABLE', mensaje: 'Solo se simulan periodos en BORRADOR o VALIDADO.' };
  }
  const necesidades = db.prepare(`
    SELECT n.*, m.clave AS materiaClave, m.nombre AS materiaNombre, m.horasSemanales,
      g.clave AS grupoClave, g.nombre AS grupoNombre
    FROM necesidades_planificacion n JOIN materias m ON m.id=n.materiaId
    JOIN grupos g ON g.id=n.grupoId WHERE n.periodoId=? ORDER BY n.id
  `).all(periodoId);
  const pendientes = necesidades.filter(n => n.estado === 'PENDIENTE');
  if (pendientes.length > MAX_NECESIDADES || !Number.isSafeInteger(limite) || limite < 1 || limite > 100000) {
    return { ok: false, error: 'LIMITE_BUSQUEDA', mensaje: 'Máximo 200 necesidades y límite entre 1 y 100000 pasos.' };
  }
  const cursos = db.prepare('SELECT * FROM cursos WHERE periodoId=?').all(periodoId);
  const ocupacion = db.prepare(`
    SELECT c.profesorId, c.grupoId, c.salonId, f.dia, f.horaInicio, f.horaFin
    FROM cursos c JOIN curso_horarios ch ON ch.cursoId=c.id
    JOIN franjas_horarias f ON f.id=ch.horarioId WHERE c.periodoId=?
  `).all(periodoId);
  // Una indisponibilidad explícita también bloquea una sesión que se solape parcialmente.
  const profesoresNo = db.prepare('SELECT * FROM profesor_disponibilidad WHERE disponible=0').all();
  const salonesNo = db.prepare('SELECT * FROM salon_disponibilidad WHERE disponible=0').all();
  const entradas = pendientes.map(n => {
    const necesidad = { id: n.id, materia: { id: n.materiaId, clave: n.materiaClave, nombre: n.materiaNombre, horasSemanales: n.horasSemanales }, grupo: { id: n.grupoId, clave: n.grupoClave, nombre: n.grupoNombre } };
    if (cursos.some(c => c.materiaId === n.materiaId && c.grupoId === n.grupoId)) {
      return { necesidad, alternativas: [], motivo: 'Ya existe un curso para esta materia y grupo; revisar su vínculo con la necesidad.' };
    }
    const resultado = enumerarAlternativasPlanificacion(db, periodoId, n.id, { aislarSalonesPorPeriodo: true });
    const iniciales = resultado.alternativas || [];
    const alternativas = iniciales.filter(a => {
      const franjas = sesiones(a);
      return !cruza(franjas, ocupacion) && !franjas.some(f =>
        profesoresNo.some(b => b.profesorId === f.profesorId && solapan(f, b)) ||
        salonesNo.some(b => b.salonId === f.salonId && solapan(f, b)));
    });
    return { necesidad, alternativas, motivo: alternativas.length ? null : iniciales.length
      ? 'Las alternativas se solapan con ocupación existente o indisponibilidad explícita.'
      : 'No se encontró un patrón con profesor calificado, carga y salón compatibles; revisar catálogos y disponibilidad.' };
  });
  const resultado = buscarAsignacionesGlobales(entradas, ocupacion, limite);
  const conflictosExistentes = resumirPeriodo(db, periodoId).conflictos;
  if (modo === 'ABC') {
    const profesores = db.prepare(`
      SELECT p.id, p.maxHorasSemanales AS maximo, COALESCE(SUM(m.horasSemanales),0) AS actual
      FROM profesores p LEFT JOIN cursos c ON c.profesorId=p.id AND c.periodoId=?
      LEFT JOIN materias m ON m.id=c.materiaId GROUP BY p.id ORDER BY p.id
    `).all(periodoId);
    const planes = PLANES.map(plan => {
      const optimizado = buscarAsignacionesGlobales(entradas, ocupacion, limite, {
        inicial: resultado.asignaciones,
        evaluar: asignaciones => valorPlan(plan.id, medirPlan(asignaciones, profesores, ocupacion))
      });
      // La prueba de cobertura de la busqueda inicial sigue siendo valida.
      optimizado.busqueda.coberturaOptima ||= resultado.busqueda.coberturaOptima;
      const metricas = medirPlan(optimizado.asignaciones, profesores, ocupacion);
      return { ...plan, ...formatear(optimizado), metricas };
    });
    return { ok: true, periodo, soloLectura: true, aplicable: false, modo, planes,
      busquedaCobertura: resultado.busqueda, conflictosExistentes };
  }
  return formatear(resultado);

  function formatear(resultado) {
    const ids = new Set(resultado.asignaciones.map(a => a.necesidadId));
    const extras = new Map();
    for (const a of resultado.asignaciones) {
      const id = a.alternativa.profesor.id;
      extras.set(id, (extras.get(id) || 0) + a.horas);
    }
    const asignaciones = resultado.asignaciones.map(item => {
      const a = item.alternativa;
      const total = a.carga.actual + extras.get(a.profesor.id);
      const advertencias = [...new Set([...a.advertencias, ...(total >= a.carga.maxima * UMBRAL_CARGA_CERCANA ? ['Carga final cercana al máximo'] : [])])];
      return { ...item, alternativa: { ...a, advertencias, carga: { ...a.carga, resultante: total, porcentajeResultante: Math.round(total / a.carga.maxima * 100) } } };
    });
    const sinAsignar = entradas.filter(e => !ids.has(e.necesidad.id)).map(e => ({
      necesidad: e.necesidad, alternativasEvaluables: e.alternativas.length,
      motivo: e.motivo || (resultado.busqueda.limiteAlcanzado
        ? 'Sin asignar en la mejor combinación encontrada antes del límite de búsqueda.'
        : 'No cabe en la combinación de máxima cobertura encontrada sin incumplir restricciones.')
    }));
    const asignadasAntes = necesidades.filter(n => n.estado === 'ASIGNADA').length;
    const total = asignadasAntes + pendientes.length;
    return {
      ok: true, periodo, soloLectura: true, aplicable: false,
      asignaciones, sinAsignar, busqueda: resultado.busqueda,
      conflictosExistentes,
      resumen: {
        necesidadesActivas: total, asignadasAntes, pendientesAntes: pendientes.length,
        omitidas: necesidades.length - total, nuevas: asignaciones.length, pendientesDespues: sinAsignar.length,
        coberturaProyectada: total ? Math.round((asignadasAntes + asignaciones.length) / total * 100) : 0,
        calificacionPromedioNuevas: asignaciones.length ? Number((asignaciones.reduce((s, a) => s + a.alternativa.calificacion, 0) / asignaciones.length).toFixed(2)) : null
      }
    };
  }
}
