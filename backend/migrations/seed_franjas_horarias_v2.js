const MIGRATION_NAME = 'seed_franjas_horarias_v2';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const BLOQUES = [
  ['07:00', '09:00'],
  ['09:00', '11:00'],
  ['11:00', '13:00'],
  ['13:00', '15:00'],
  ['15:00', '17:00'],
  ['17:00', '19:00']
];

const VIERNES_UNA_HORA = [
  ['08:00', '09:00'],
  ['10:00', '11:00'],
  ['12:00', '13:00'],
  ['14:00', '15:00'],
  ['16:00', '17:00'],
  ['18:00', '19:00']
];

export function seedFranjasHorariasV2(db) {
  return db.transaction(() => {
    const aplicada = db
      .prepare('SELECT 1 FROM migrations WHERE nombre = ?')
      .get(MIGRATION_NAME);

    if (aplicada) {
      return {
        aplicada: false,
        franjasInsertadas: 0,
        disponibilidadesInsertadas: 0
      };
    }

    const insertarFranja = db.prepare(`
      INSERT OR IGNORE INTO franjas_horarias
        (dia, horaInicio, horaFin)
      VALUES (?, ?, ?)
    `);

    let franjasInsertadas = 0;

    for (const dia of DIAS) {
      for (const [inicio, fin] of BLOQUES) {
        franjasInsertadas += insertarFranja.run(
          dia,
          inicio,
          fin
        ).changes;
      }
    }

    for (const [inicio, fin] of VIERNES_UNA_HORA) {
      franjasInsertadas += insertarFranja.run(
        'Viernes',
        inicio,
        fin
      ).changes;
    }

    const profesores = db
      .prepare('SELECT id FROM profesores')
      .all();

    const franjas = db.prepare(`
      SELECT dia, horaInicio, horaFin
      FROM franjas_horarias
      WHERE dia IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes')
    `).all();

    const insertarDisponibilidad = db.prepare(`
      INSERT OR IGNORE INTO profesor_disponibilidad
        (profesorId, dia, horaInicio, horaFin, disponible)
      VALUES (?, ?, ?, ?, 1)
    `);

    let disponibilidadesInsertadas = 0;

    for (const profesor of profesores) {
      for (const franja of franjas) {
        disponibilidadesInsertadas += insertarDisponibilidad.run(
          profesor.id,
          franja.dia,
          franja.horaInicio,
          franja.horaFin
        ).changes;
      }
    }

    db.prepare(`
      INSERT INTO migrations (nombre, executed_at)
      VALUES (?, datetime('now'))
    `).run(MIGRATION_NAME);

    return {
      aplicada: true,
      franjasInsertadas,
      disponibilidadesInsertadas
    };
  })();
}