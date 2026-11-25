export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function minutos(hora) {
  if (typeof hora !== 'string' || !/^\d{2}:\d{2}$/.test(hora)) return NaN;
  const [h, m] = hora.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : NaN;
}

export function horaTexto(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function cursosDelPeriodo(cursos, periodoId, campo = '', entidadId = '') {
  return cursos.filter(c => c.periodoId != null && String(c.periodoId) === String(periodoId)
    && (!campo || !entidadId || String(c[campo]) === String(entidadId)));
}

export function sesionesDe(cursos) {
  const sesiones = [], sinHorario = [], invalidas = [];
  for (const curso of cursos) {
    if (!curso.horarios?.length) sinHorario.push(curso);
    for (const horario of curso.horarios || []) {
      const inicio = minutos(horario.horaInicio), fin = minutos(horario.horaFin);
      if (!DIAS.includes(horario.dia) || !Number.isFinite(inicio) || !Number.isFinite(fin) || inicio >= fin) {
        invalidas.push({ curso, horario });
      } else {
        sesiones.push({ curso, horario, inicio, fin, dia: horario.dia });
      }
    }
  }
  return { sesiones, sinHorario, invalidas };
}

export function limitesSemana(sesiones) {
  const inicio = Math.floor(Math.min(420, ...sesiones.map(s => s.inicio)) / 60) * 60;
  const fin = Math.ceil(Math.max(1140, ...sesiones.map(s => s.fin)) / 60) * 60;
  return { inicio, fin, dias: DIAS.slice(0, sesiones.some(s => s.dia === 'Sábado') ? 6 : 5) };
}

// La concurrencia visual no es un conflicto académico. Cada intervalo simultáneo
// recibe un carril distinto; los conflictos provienen únicamente de la API.
export function distribuirCarriles(sesiones) {
  const ordenadas = [...sesiones].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin || a.curso.id - b.curso.id);
  const resultado = [];
  let grupo = [], finales = [], maxFin = -1;
  function cerrar() {
    resultado.push(...grupo.map(s => ({ ...s, carriles: finales.length })));
    grupo = []; finales = []; maxFin = -1;
  }
  for (const s of ordenadas) {
    if (grupo.length && s.inicio >= maxFin) cerrar();
    let carril = finales.findIndex(fin => fin <= s.inicio);
    if (carril === -1) carril = finales.length;
    finales[carril] = s.fin;
    maxFin = Math.max(maxFin, s.fin);
    grupo.push({ ...s, carril });
  }
  if (grupo.length) cerrar();
  return resultado;
}

export function estadosDe(resumen) {
  const estados = new Map();
  for (const aviso of resumen?.detalleAdvertencias || []) estados.set(String(aviso.cursoId), { tipo: 'advertencia', motivo: aviso.motivo });
  for (const conflicto of resumen?.conflictos || []) estados.set(String(conflicto.cursoId), { tipo: 'conflicto', motivo: conflicto.motivo });
  return estados;
}
