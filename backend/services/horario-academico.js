export const PATRON_4H_LM = 'PATRON_4H_LMV_MIERCOLES';
export const PATRON_4H_MJ = 'PATRON_4H_MARTES_JUEVES';
export const PATRON_5H_LMV = 'PATRON_5H_LUNES_MIERCOLES_VIERNES';
export const PATRON_5H_MJV = 'PATRON_5H_MARTES_JUEVES_VIERNES';
export const PATRON_6H_LMV = 'PATRON_6H_LUNES_MIERCOLES_VIERNES';

export function generarPatronAcademico(db, materiaId, horarioBaseId) {
  const materia = db.prepare('SELECT id, nombre, horasSemanales FROM materias WHERE id = ?').get(materiaId);
  const base = db.prepare('SELECT id, dia, horaInicio, horaFin FROM franjas_horarias WHERE id = ?').get(horarioBaseId);
  if (!materia || !base) return { ok: false, error: 'Materia o horario base no existen.' };
  if (![4, 5, 6].includes(Number(materia.horasSemanales))) {
    return { ok: false, error: 'La materia debe tener 4, 5 o 6 horas semanales.' };
  }

  const inicio = base.horaInicio;
  const fin = base.horaFin;
  let patron;
  if (materia.horasSemanales === 4) {
    if (base.dia === 'Lunes') patron = { nombre: PATRON_4H_LM, dias: ['Lunes', 'Miércoles'], viernes: null };
    else if (base.dia === 'Martes') patron = { nombre: PATRON_4H_MJ, dias: ['Martes', 'Jueves'], viernes: null };
    else return { ok: false, error: 'Para una materia de 4 horas, el horario base debe ser lunes o martes.' };
  } else if (materia.horasSemanales === 5) {
    if (base.dia === 'Lunes') patron = { nombre: PATRON_5H_LMV, dias: ['Lunes', 'Miércoles', 'Viernes'], viernes: true };
    else if (base.dia === 'Martes') patron = { nombre: PATRON_5H_MJV, dias: ['Martes', 'Jueves', 'Viernes'], viernes: true };
    else return { ok: false, error: 'Para una materia de 5 horas, el horario base debe ser lunes o martes.' };
  } else {
    if (base.dia !== 'Lunes') return { ok: false, error: 'Para una materia de 6 horas, el horario base debe ser lunes.' };
    patron = { nombre: PATRON_6H_LMV, dias: ['Lunes', 'Miércoles', 'Viernes'], viernes: null };
  }

  const horarioIds = [];
  const horarios = [];
  for (const dia of patron.dias) {
    let inicioFranja = inicio;
    let finFranja = fin;
    if (patron.viernes && dia === 'Viernes') {
      const inicioMin = Number(inicio.split(':')[0]) * 60 + Number(inicio.split(':')[1]);
      const inicioUnica = inicioMin + 60;
      inicioFranja = `${String(Math.floor(inicioUnica / 60)).padStart(2, '0')}:${String(inicioUnica % 60).padStart(2, '0')}`;
      finFranja = `${String(Math.floor((inicioUnica + 60) / 60)).padStart(2, '0')}:${String((inicioUnica + 60) % 60).padStart(2, '0')}`;
    }
    const franja = db.prepare(
      'SELECT id, dia, horaInicio, horaFin FROM franjas_horarias WHERE dia = ? AND horaInicio = ? AND horaFin = ?'
    ).get(dia, inicioFranja, finFranja);
    if (!franja) return { ok: false, error: `Falta la franja ${dia} ${inicioFranja}–${finFranja}.` };
    horarioIds.push(franja.id);
    horarios.push(franja);
  }
  return { ok: true, patron: patron.nombre, horasSemanales: Number(materia.horasSemanales), horarioIds, horarios };
}
