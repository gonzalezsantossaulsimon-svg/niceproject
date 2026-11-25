import { generarPatronAcademico } from './horario-academico.js';
import { recomendarProfesores, UMBRAL_CARGA_CERCANA } from './recomendacion-profesores.js';
import { listarSalonesDisponibles } from './disponibilidad-salones.js';

export function enumerarAlternativasPlanificacion(db, periodoId, necesidadId, { aislarSalonesPorPeriodo = false } = {}) {
  const necesidad = db.prepare(`
    SELECT n.*, m.clave AS materiaClave, m.nombre AS materiaNombre,
      m.horasSemanales, g.clave AS grupoClave, g.nombre AS grupoNombre,
      g.cantidadAlumnos
    FROM necesidades_planificacion n
    JOIN materias m ON m.id = n.materiaId
    JOIN grupos g ON g.id = n.grupoId
    WHERE n.id = ? AND n.periodoId = ?
  `).get(necesidadId, periodoId);
  if (!necesidad) return { ok: false, error: 'NECESIDAD_NO_EXISTE', mensaje: 'La necesidad no existe en este periodo.' };
  if (necesidad.estado !== 'PENDIENTE') {
    return { ok: false, error: 'NECESIDAD_NO_PENDIENTE', mensaje: 'Solo se generan propuestas para necesidades pendientes.' };
  }

  const horas = Number(necesidad.horasSemanales);
  const basesPermitidas = horas === 6 ? ['Lunes'] : ['Lunes', 'Martes'];
  const bases = db.prepare(`
    SELECT id, dia, horaInicio, horaFin
    FROM franjas_horarias
    WHERE dia IN (${basesPermitidas.map(() => '?').join(',')})
      AND CAST(substr(horaFin, 1, 2) AS INTEGER) - CAST(substr(horaInicio, 1, 2) AS INTEGER) = 2
      AND (CAST(substr(horaFin, 4, 2) AS INTEGER) - CAST(substr(horaInicio, 4, 2) AS INTEGER)) = 0
    ORDER BY dia, horaInicio, horaFin, id
  `).all(...basesPermitidas);

  const alternativas = [];
  for (const base of bases) {
    const patron = generarPatronAcademico(db, necesidad.materiaId, base.id);
    if (!patron.ok) continue;
    const profesores = recomendarProfesores(db, necesidad.materiaId, periodoId, patron.horarioIds);
    const salones = listarSalonesDisponibles(db, necesidad.materiaId, necesidad.grupoId, patron.horarioIds, null, aislarSalonesPorPeriodo ? periodoId : null);
    for (const profesor of profesores.filter((item) => item.compatible)) {
      for (const salon of salones) {
        const cargaResultante = Number(profesor.cargaActual) + horas;
        const maximo = Number(profesor.maxHorasSemanales);
        const porcentajeCarga = maximo > 0 ? cargaResultante / maximo : 0;
        const advertencias = [...profesor.advertencias];
        if (porcentajeCarga >= UMBRAL_CARGA_CERCANA && cargaResultante <= maximo) {
          advertencias.push('Carga resultante cercana al máximo');
        }
        alternativas.push({
          materia: { id: necesidad.materiaId, clave: necesidad.materiaClave, nombre: necesidad.materiaNombre },
          grupo: { id: necesidad.grupoId, clave: necesidad.grupoClave, nombre: necesidad.grupoNombre, cantidadAlumnos: necesidad.cantidadAlumnos },
          profesor: {
            id: profesor.id,
            nombre: profesor.nombre,
            numeroEmpleado: profesor.numeroEmpleado,
            calificacionMateria: profesor.calificacionMateria
          },
          calificacion: profesor.calificacionMateria,
          carga: {
            actual: Number(profesor.cargaActual),
            resultante: cargaResultante,
            maxima: maximo,
            porcentajeResultante: maximo > 0 ? Math.round(porcentajeCarga * 100) : 0
          },
          horario: {
            patron: patron.patron,
            horarioIds: patron.horarioIds,
            horarios: patron.horarios
          },
          salon: {
            id: salon.id,
            clave: salon.clave,
            nombre: salon.nombre,
            tipo: salon.tipo,
            capacidad: salon.capacidad,
            caracteristicas: salon.caracteristicas
          },
          razones: [
            `Calificación profesor–materia: ${Number(profesor.calificacionMateria).toFixed(1)}/10`,
            'Disponible en todas las sesiones',
            'Dentro de carga máxima semanal',
            'Sin conflictos detectados',
            salon.tipo === 'LABORATORIO' ? 'Laboratorio compatible' : `Salón ${salon.tipo.toLowerCase()} compatible`,
            `Capacidad suficiente: ${salon.capacidad} lugares para ${necesidad.cantidadAlumnos} alumnos`
          ],
          advertencias,
          bloqueos: []
        });
      }
    }
  }

  alternativas.sort((a, b) =>
    b.calificacion - a.calificacion ||
    (a.carga.porcentajeResultante - b.carga.porcentajeResultante) ||
    (a.advertencias.length - b.advertencias.length) ||
    a.profesor.nombre.localeCompare(b.profesor.nombre, 'es') ||
    a.profesor.id - b.profesor.id ||
    a.salon.clave.localeCompare(b.salon.clave, 'es') ||
    a.salon.id - b.salon.id
  );
  return {
    ok: true,
    necesidad: {
      id: necesidad.id,
      periodoId,
      materia: { id: necesidad.materiaId, clave: necesidad.materiaClave, nombre: necesidad.materiaNombre, horasSemanales: horas },
      grupo: { id: necesidad.grupoId, clave: necesidad.grupoClave, nombre: necesidad.grupoNombre, cantidadAlumnos: necesidad.cantidadAlumnos },
      estado: necesidad.estado
    },
    alternativas
  };
}

export function generarPropuestasPlanificacion(db, periodoId, necesidadId, limite = 3) {
  const resultado = enumerarAlternativasPlanificacion(db, periodoId, necesidadId);
  if (!resultado.ok) return resultado;
  return { ...resultado, alternativas: resultado.alternativas.slice(0, Math.max(1, Math.min(3, Number(limite) || 3))) };
}
