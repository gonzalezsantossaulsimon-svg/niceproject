const MIGRATION_NAME = 'seed_demo_catalogos_v1';

const GRUPOS = [
  { clave: 'GRP-01', nombre: 'Grupo A', cantidadAlumnos: 25 },
  { clave: 'GRP-02', nombre: 'Grupo B', cantidadAlumnos: 30 },
  { clave: 'GRP-03', nombre: 'Grupo C', cantidadAlumnos: 35 },
  { clave: 'GRP-04', nombre: 'Grupo D', cantidadAlumnos: 20 },
  { clave: 'GRP-05', nombre: 'Grupo E', cantidadAlumnos: 40 }
];

const SALONES = [
  { clave: 'A-101', nombre: 'Aula 101', capacidad: 30 },
  { clave: 'A-102', nombre: 'Aula 102', capacidad: 35 },
  { clave: 'A-103', nombre: 'Aula 103', capacidad: 40 },
  { clave: 'LAB-01', nombre: 'Laboratorio de Cómputo 1', capacidad: 30 },
  { clave: 'LAB-02', nombre: 'Laboratorio de Cómputo 2', capacidad: 35 },
  { clave: 'AUD-01', nombre: 'Aula Magna', capacidad: 60 }
];

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORAS = [
  ['07:00', '09:00'],
  ['09:00', '11:00'],
  ['11:00', '13:00']
];
const FRANJAS_HORARIAS = DIAS.flatMap((dia) => HORAS.map(([horaInicio, horaFin]) => ({
  dia,
  horaInicio,
  horaFin
})));

export function seedDemoCatalogos(db) {
  const sembrar = db.transaction(() => {
    const insertarGrupo = db.prepare(
      'INSERT INTO grupos (clave, nombre, cantidadAlumnos) VALUES (?, ?, ?)'
    );
    const existeGrupo = db.prepare('SELECT 1 FROM grupos WHERE clave = ?');
    let gruposInsertados = 0;

    for (const grupo of GRUPOS) {
      if (existeGrupo.get(grupo.clave)) continue;
      insertarGrupo.run(grupo.clave, grupo.nombre, grupo.cantidadAlumnos);
      gruposInsertados += 1;
    }

    const insertarSalon = db.prepare(
      'INSERT INTO salones (clave, nombre, capacidad) VALUES (?, ?, ?)'
    );
    const existeSalon = db.prepare(
      'SELECT 1 FROM salones WHERE clave = ? OR LOWER(nombre) = LOWER(?)'
    );
    let salonesInsertados = 0;

    for (const salon of SALONES) {
      if (existeSalon.get(salon.clave, salon.nombre)) continue;
      insertarSalon.run(salon.clave, salon.nombre, salon.capacidad);
      salonesInsertados += 1;
    }

    const insertarFranja = db.prepare(
      'INSERT INTO franjas_horarias (dia, horaInicio, horaFin) VALUES (?, ?, ?)'
    );
    const existeFranja = db.prepare(
      'SELECT 1 FROM franjas_horarias WHERE dia = ? AND horaInicio = ? AND horaFin = ?'
    );
    let franjasInsertadas = 0;

    for (const franja of FRANJAS_HORARIAS) {
      if (existeFranja.get(franja.dia, franja.horaInicio, franja.horaFin)) continue;
      insertarFranja.run(franja.dia, franja.horaInicio, franja.horaFin);
      franjasInsertadas += 1;
    }

    db.prepare(
      "INSERT OR IGNORE INTO migrations (nombre, executed_at) VALUES (?, datetime('now'))"
    ).run(MIGRATION_NAME);

    return { gruposInsertados, salonesInsertados, franjasInsertadas };
  });

  return sembrar();
}
