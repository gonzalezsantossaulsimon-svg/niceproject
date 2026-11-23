import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../database.js';
import { seedApoyoAsignacion } from '../migrations/seed_apoyo_asignacion.js';
import { generarPatronAcademico } from '../services/horario-academico.js';
import { listarSalonesDisponibles } from '../services/disponibilidad-salones.js';
import { recomendarProfesores } from '../services/recomendacion-profesores.js';
import { resumirPeriodo } from '../services/validacion-periodo.js';

function fixture(db) {
  db.prepare("INSERT INTO academias (clave,nombre) VALUES ('ACAD','Academia')").run();
  db.prepare("INSERT INTO materias (clave,nombre,horasSemanales) VALUES ('MAT','Matemáticas',4)").run();
  db.prepare("INSERT INTO materias (clave,nombre,horasSemanales) VALUES ('BDD','Bases de Datos',4)").run();
  db.prepare("INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES ('EMP001','Perry','Santry','ACAD',20)").run();
  db.prepare("INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES ('EMP002','Lind','Hateley','ACAD',20)").run();
  db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('GRP','Grupo A',25)").run();
  db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB','Laboratorio',30,'LABORATORIO')").run();
  db.prepare("INSERT INTO periodos_academicos (clave,nombre,estado) VALUES ('2027-1','Periodo','BORRADOR')").run();
  for (const [dia, inicio, fin] of [
    ['Lunes','07:00','09:00'], ['Miércoles','07:00','09:00'],
    ['Martes','07:00','09:00'], ['Jueves','07:00','09:00'],
    ['Viernes','07:00','09:00'], ['Lunes','09:00','11:00'],
    ['Miércoles','09:00','11:00'], ['Viernes','10:00','11:00'],
    ['Viernes','08:00','09:00'], ['Viernes','12:00','13:00'],
    ['Lunes','11:00','13:00'], ['Miércoles','11:00','13:00']
  ]) db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run(dia,inicio,fin);
}

test('genera patrones 4h, 5h y 6h deterministas', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const mat4 = db.prepare("SELECT id FROM materias WHERE nombre='Matemáticas'").get();
    const lunes = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='07:00'").get();
    const martes = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Martes'").get();
    assert.deepEqual(
      generarPatronAcademico(db, mat4.id, lunes.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Lunes','07:00','09:00'],['Miércoles','07:00','09:00']]
    );
    assert.deepEqual(
      generarPatronAcademico(db, mat4.id, martes.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Martes','07:00','09:00'],['Jueves','07:00','09:00']]
    );
    db.prepare('UPDATE materias SET horasSemanales=5 WHERE nombre=?').run('Matemáticas');
    const lunes9 = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='09:00'").get();
    assert.deepEqual(
      generarPatronAcademico(db, mat4.id, lunes9.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Lunes','09:00','11:00'],['Miércoles','09:00','11:00'],['Viernes','10:00','11:00']]
    );
    const martes9 = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Martes' AND horaInicio='09:00'").get();
    if (!martes9) {
      db.prepare("INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES ('Martes','09:00','11:00')").run();
      db.prepare("INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES ('Jueves','09:00','11:00')").run();
    }
    const martes9Final = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Martes' AND horaInicio='09:00'").get();
    assert.deepEqual(
      generarPatronAcademico(db, mat4.id, martes9Final.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Martes','09:00','11:00'],['Jueves','09:00','11:00'],['Viernes','10:00','11:00']]
    );
    db.prepare('UPDATE materias SET horasSemanales=6 WHERE nombre=?').run('Matemáticas');
    assert.deepEqual(
      generarPatronAcademico(db, mat4.id, lunes.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Lunes','07:00','09:00'],['Miércoles','07:00','09:00'],['Viernes','07:00','09:00']]
    );
    assert.equal(generarPatronAcademico(db, mat4.id, martes.id).ok, false);
  } finally { db.close(); }
});

test('ranking usa calificaciones y disponibilidad', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const bdd = db.prepare("SELECT id FROM materias WHERE nombre='Bases de Datos'").get();
    const perry = db.prepare("SELECT id FROM profesores WHERE nombre='Perry'").get();
    const lind = db.prepare("SELECT id FROM profesores WHERE nombre='Lind'").get();
    db.prepare('INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion) VALUES (?,?,10)').run(perry.id,bdd.id);
    db.prepare('INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion) VALUES (?,?,9)').run(lind.id,bdd.id);
    const periodo = db.prepare("SELECT id FROM periodos_academicos").get();
    const ids = db.prepare("SELECT id FROM franjas_horarias WHERE dia IN ('Lunes','Miércoles') AND horaInicio='07:00'").pluck().all();
    const ranking = recomendarProfesores(db, bdd.id, periodo.id, ids);
    assert.equal(ranking[0].calificacionMateria, 10);
    assert.equal(ranking[1].calificacionMateria, 9);
  } finally { db.close(); }
});

test('ranking conserva el orden descendente 10, 9 y 7', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    db.prepare("INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES ('EMP003','Dav','Dent','ACAD',20)").run();
    const materia = db.prepare("SELECT id FROM materias WHERE nombre='Bases de Datos'").get();
    const periodo = db.prepare("SELECT id FROM periodos_academicos").get();
    const ids = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='07:00'").pluck().all();
    for (const [nombre, calificacion] of [['Perry',10],['Lind',9],['Dav',7]]) {
      const profesor = db.prepare('SELECT id FROM profesores WHERE nombre=?').get(nombre);
      db.prepare('INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion) VALUES (?,?,?)').run(profesor.id,materia.id,calificacion);
    }
    const ranking = recomendarProfesores(db, materia.id, periodo.id, ids);
    assert.deepEqual(ranking.map((item) => item.calificacionMateria), [10,9,7]);
  } finally { db.close(); }
});

test('cinco horas usa correctamente viernes 08, 10 y 12 según el bloque base', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const materia = db.prepare("SELECT id FROM materias WHERE nombre='Matemáticas'").get();
    db.prepare('UPDATE materias SET horasSemanales=5 WHERE id=?').run(materia.id);
    for (const [dia, inicio, fin] of [
      ['Lunes','07:00','09:00'], ['Miércoles','07:00','09:00'],
      ['Lunes','11:00','13:00'], ['Miércoles','11:00','13:00'],
      ['Viernes','08:00','09:00'], ['Viernes','12:00','13:00']
    ]) {
      if (!db.prepare('SELECT 1 FROM franjas_horarias WHERE dia=? AND horaInicio=? AND horaFin=?').get(dia,inicio,fin)) {
        db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run(dia,inicio,fin);
      }
    }
    const lunes7 = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='07:00'").get();
    const lunes11 = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='11:00'").get();
    assert.deepEqual(
      generarPatronAcademico(db, materia.id, lunes7.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Lunes','07:00','09:00'],['Miércoles','07:00','09:00'],['Viernes','08:00','09:00']]
    );
    assert.deepEqual(
      generarPatronAcademico(db, materia.id, lunes11.id).horarios.map((x) => [x.dia,x.horaInicio,x.horaFin]),
      [['Lunes','11:00','13:00'],['Miércoles','11:00','13:00'],['Viernes','12:00','13:00']]
    );
  } finally { db.close(); }
});

test('laboratorio compatible aparece disponible y aula se rechaza', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const bdd = db.prepare("SELECT id FROM materias WHERE nombre='Bases de Datos'").get();
    const grupo = db.prepare("SELECT id FROM grupos").get();
    db.prepare("INSERT INTO materia_requisitos_salon (materiaId,tipoRequerido,caracteristicas) VALUES (?, 'LABORATORIO', '[\"COMPUTADORAS\",\"INTERNET\"]')").run(bdd.id);
    db.prepare("INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES ((SELECT id FROM salones),'COMPUTADORAS')").run();
    db.prepare("INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES ((SELECT id FROM salones),'INTERNET')").run();
    const lunes = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='07:00'").get();
    const miercoles = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Miércoles' AND horaInicio='07:00'").get();
    const disponibles = listarSalonesDisponibles(db, bdd.id, grupo.id, [lunes.id,miercoles.id]);
    assert.equal(disponibles.length, 1);
    assert.equal(disponibles[0].tipo, 'LABORATORIO');
  } finally { db.close(); }
});

test('seed de apoyo es idempotente', () => {
  const db = createDatabase(':memory:');
  try {
    seedApoyoAsignacion(db);
    seedApoyoAsignacion(db);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM migrations WHERE nombre='seed_apoyo_asignacion_v1'").get().n, 1);
  } finally { db.close(); }
});

test('resume advertencias de carga con curso, materia y grupo', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const profesorId = db.prepare("SELECT id FROM profesores WHERE nombre='Perry'").get().id;
    const grupoId = db.prepare('SELECT id FROM grupos').get().id;
    const salonId = db.prepare('SELECT id FROM salones').get().id;
    const periodoId = db.prepare('SELECT id FROM periodos_academicos').get().id;
    const franjas = db.prepare(
      "SELECT id FROM franjas_horarias WHERE dia IN ('Lunes','Martes','Miércoles') AND horaInicio='07:00' ORDER BY id"
    ).pluck().all();

    for (let index = 0; index < 3; index += 1) {
      const materiaId = Number(db.prepare(
        'INSERT INTO materias (clave,nombre,horasSemanales) VALUES (?,?,6)'
      ).run(`LOAD-${index}`,`Materia ${index}`).lastInsertRowid);
      const cursoId = Number(db.prepare(
        'INSERT INTO cursos (materiaId,profesorId,grupoId,salonId,periodoId) VALUES (?,?,?,?,?)'
      ).run(materiaId,profesorId,grupoId,salonId,periodoId).lastInsertRowid);
      db.prepare('INSERT INTO curso_horarios (cursoId,horarioId) VALUES (?,?)').run(cursoId,franjas[index]);
    }

    const resumen = resumirPeriodo(db,periodoId);
    assert.equal(resumen.detalleAdvertencias.length,3);
    for (const advertencia of resumen.detalleAdvertencias) {
      assert.equal(advertencia.tipo,'ADVERTENCIA');
      assert.match(advertencia.motivo,/18\/20 h de carga/);
      assert.match(advertencia.materia,/Materia/);
      assert.match(advertencia.grupo,/Grupo A/);
      assert.ok(advertencia.cursoId);
    }
  } finally { db.close(); }
});

test('cinco horas admite bloque 17 a 19 con viernes 18 a 19', () => {
  const db = createDatabase(':memory:');

  try {
    fixture(db);

    const materia = db.prepare(
      "SELECT id FROM materias WHERE nombre='Matemáticas'"
    ).get();

    db.prepare(
      'UPDATE materias SET horasSemanales=5 WHERE id=?'
    ).run(materia.id);

    for (const [dia, inicio, fin] of [
      ['Lunes', '17:00', '19:00'],
      ['Miércoles', '17:00', '19:00'],
      ['Viernes', '18:00', '19:00']
    ]) {
      db.prepare(`
        INSERT OR IGNORE INTO franjas_horarias
          (dia, horaInicio, horaFin)
        VALUES (?, ?, ?)
      `).run(dia, inicio, fin);
    }

    const lunes17 = db.prepare(`
      SELECT id
      FROM franjas_horarias
      WHERE dia='Lunes'
        AND horaInicio='17:00'
        AND horaFin='19:00'
    `).get();

    const resultado = generarPatronAcademico(
      db,
      materia.id,
      lunes17.id
    );

    assert.equal(resultado.ok, true);

    assert.deepEqual(
      resultado.horarios.map(
        (item) => [item.dia, item.horaInicio, item.horaFin]
      ),
      [
        ['Lunes', '17:00', '19:00'],
        ['Miércoles', '17:00', '19:00'],
        ['Viernes', '18:00', '19:00']
      ]
    );
  } finally {
    db.close();
  }
});
