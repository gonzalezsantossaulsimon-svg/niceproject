const MIGRATION_NAME = 'seed_apoyo_asignacion_v1';

const HORAS_MATERIAS = new Map([
  ['Redes', 6], ['Sistemas Operativos', 5], ['Programación', 6],
  ['Matemáticas', 5], ['Inteligencia Artificial', 4],
  ['Seguridad Informática', 4], ['Bases de Datos', 4], ['Desarrollo Web', 6]
]);

export function seedApoyoAsignacion(db) {
  return db.transaction(() => {
    const aplicada = db.prepare('SELECT 1 FROM migrations WHERE nombre = ?').get(MIGRATION_NAME);
    if (aplicada) return { aplicada: false };

    for (const [nombre, horas] of HORAS_MATERIAS) {
      db.prepare('UPDATE materias SET horasSemanales = ? WHERE LOWER(nombre) = LOWER(?)').run(horas, nombre);
    }

    db.prepare(`
      INSERT OR IGNORE INTO periodos_academicos (clave, nombre, fechaInicio, fechaFin, estado)
      VALUES ('2027-1', 'Enero-Junio 2027', '2027-01-11', '2027-06-25', 'BORRADOR')
    `).run();
    db.prepare(`
      INSERT OR IGNORE INTO periodos_academicos (clave, nombre, fechaInicio, fechaFin, estado)
      VALUES ('2027-2', 'Agosto-Diciembre 2027', '2027-08-16', '2027-12-17', 'BORRADOR')
    `).run();
    const periodo = db.prepare("SELECT id FROM periodos_academicos WHERE clave='2027-1'").get();

    const necesidadesDemo = [
      ['Bases de Datos', 'GRP-01', 'PENDIENTE'],
      ['Programación', 'GRP-02', 'PENDIENTE'],
      ['Seguridad Informática', 'GRP-03', 'OMITIDA']
    ];
    for (const [nombreMateria, claveGrupo, estado] of necesidadesDemo) {
      const materia = db.prepare('SELECT id FROM materias WHERE LOWER(nombre)=LOWER(?)').get(nombreMateria);
      const grupo = db.prepare('SELECT id FROM grupos WHERE clave=?').get(claveGrupo);
      if (materia && grupo) {
        db.prepare(`
          INSERT OR IGNORE INTO necesidades_planificacion
            (periodoId, materiaId, grupoId, cursoId, estado)
          VALUES (?, ?, ?, NULL, ?)
        `).run(periodo.id, materia.id, grupo.id, estado);
      }
    }

    db.prepare('UPDATE cursos SET periodoId = ? WHERE periodoId IS NULL').run(periodo.id);

    db.prepare("UPDATE profesores SET maxHorasSemanales = 20").run();
    db.prepare("UPDATE salones SET tipo='AULA'").run();
    db.prepare("UPDATE salones SET tipo='LABORATORIO' WHERE LOWER(clave) LIKE 'lab-%'").run();
    db.prepare("UPDATE salones SET tipo='AUDITORIO' WHERE LOWER(clave)='aud-01'").run();

    const labUno = db.prepare("SELECT id FROM salones WHERE clave='LAB-01'").get();
    const labDos = db.prepare("SELECT id FROM salones WHERE clave='LAB-02'").get();
    if (labUno) for (const c of ['COMPUTADORAS', 'INTERNET', 'RED_LOCAL']) {
      db.prepare('INSERT OR IGNORE INTO caracteristicas_salones (salonId, caracteristica) VALUES (?, ?)').run(labUno.id, c);
    }
    if (labDos) for (const c of ['COMPUTADORAS', 'INTERNET', 'PROYECTOR', 'RED_LOCAL']) {
      db.prepare('INSERT OR IGNORE INTO caracteristicas_salones (salonId, caracteristica) VALUES (?, ?)').run(labDos.id, c);
    }
    const aulaUno = db.prepare("SELECT id FROM salones WHERE clave='A-101'").get();
    if (aulaUno) db.prepare('INSERT OR IGNORE INTO caracteristicas_salones (salonId, caracteristica) VALUES (?, ?)').run(aulaUno.id, 'PROYECTOR');

    const baseDatos = db.prepare("SELECT id FROM materias WHERE LOWER(nombre)=LOWER('Bases de Datos')").get();
    if (baseDatos) db.prepare(`
      INSERT OR IGNORE INTO materia_requisitos_salon (materiaId, tipoRequerido, caracteristicas)
      VALUES (?, 'LABORATORIO', '["COMPUTADORAS","INTERNET"]')
    `).run(baseDatos.id);
    const red = db.prepare("SELECT id FROM materias WHERE LOWER(nombre)=LOWER('Redes')").get();
    if (red) db.prepare(`
      INSERT OR IGNORE INTO materia_requisitos_salon (materiaId, tipoRequerido, caracteristicas)
      VALUES (?, 'LABORATORIO', '["COMPUTADORAS","RED_LOCAL"]')
    `).run(red.id);
    for (const nombre of ['Matemáticas', 'Inteligencia Artificial', 'Seguridad Informática', 'Desarrollo Web', 'Sistemas Operativos', 'Programación']) {
      const materia = db.prepare('SELECT id FROM materias WHERE LOWER(nombre)=LOWER(?)').get(nombre);
      if (materia) db.prepare(`
        INSERT OR IGNORE INTO materia_requisitos_salon (materiaId, tipoRequerido, caracteristicas)
        VALUES (?, 'AULA', '[]')
      `).run(materia.id);
    }

    if (baseDatos) {
      const sustitutos = new Map([['Perry Santry', 10], ['Lind Hateley', 9], ['Dav Dent', 7]]);
      for (const [nombreCompleto, calificacion] of sustitutos) {
        const profesor = db.prepare(
          "SELECT id FROM profesores WHERE LOWER(TRIM(nombre || ' ' || apellido)) = LOWER(?)"
        ).get(nombreCompleto);
        if (profesor) db.prepare(`
          INSERT OR IGNORE INTO profesor_materia_calificaciones (profesorId, materiaId, calificacion)
          VALUES (?, ?, ?)
        `).run(profesor.id, baseDatos.id, calificacion);
      }
    }

    const legacyNiveles = db.prepare(`
      SELECT mp.profesorId, m.id AS materiaId, mp.nivel
      FROM materias_profesor mp
      JOIN materias m ON LOWER(m.nombre)=LOWER(mp.nombre)
    `).all();
    for (const fila of legacyNiveles) {
      db.prepare(`
        INSERT OR IGNORE INTO profesor_materia_calificaciones (profesorId, materiaId, calificacion)
        VALUES (?, ?, ?)
      `).run(fila.profesorId, fila.materiaId, fila.nivel);
    }

    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']) {
      for (const [inicio, fin] of [['07:00', '09:00'], ['09:00', '11:00'], ['11:00', '13:00']]) {
        db.prepare('INSERT OR IGNORE INTO franjas_horarias (dia, horaInicio, horaFin) VALUES (?, ?, ?)').run(dia, inicio, fin);
        if (dia === 'Viernes') {
          for (const hora of [['08:00', '09:00'], ['10:00', '11:00'], ['12:00', '13:00']]) {
            db.prepare(
              'INSERT OR IGNORE INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)'
            ).run('Viernes', hora[0], hora[1]);
          }
        }
      }
    }

    const profesores = db.prepare('SELECT id FROM profesores').all();
    for (const profesor of profesores) {
      for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']) {
        for (const franja of db.prepare('SELECT horaInicio, horaFin FROM franjas_horarias WHERE dia=?').all(dia)) {
          const disponible = dia === 'Viernes' && franja.horaInicio === '08:00' ? 0 : 1;
          const stmt = db.prepare(
            'INSERT OR IGNORE INTO profesor_disponibilidad (profesorId,dia,horaInicio,horaFin,disponible) VALUES (?,?,?,?,?)'
          );
          stmt.run(profesor.id, dia, franja.horaInicio, franja.horaFin, disponible);
        }
      }
    }

    db.prepare("INSERT OR IGNORE INTO migrations (nombre, executed_at) VALUES (?, datetime('now'))").run(MIGRATION_NAME);
    return { aplicada: true };
  })();
}
