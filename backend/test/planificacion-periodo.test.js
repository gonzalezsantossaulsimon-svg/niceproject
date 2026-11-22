import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from '../database.js';
import { resumirPlanificacionPeriodo } from '../services/planificacion-periodo.js';
import { generarPropuestasPlanificacion } from '../services/propuestas-planificacion.js';

function fixture(db) {
  db.prepare("INSERT INTO academias (clave,nombre) VALUES ('ACAD','Academia')").run();
  db.prepare("INSERT INTO materias (clave,nombre,horasSemanales) VALUES ('BDD','Bases de Datos',4)").run();
  db.prepare("INSERT INTO materias (clave,nombre,horasSemanales) VALUES ('PROG','Programación',6)").run();
  db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('G-A','Grupo A',25)").run();
  db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('G-B','Grupo B',30)").run();
  db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB-01','Laboratorio 1',40,'LABORATORIO')").run();
  db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB-02','Laboratorio 2',40,'LABORATORIO')").run();
  db.prepare("INSERT INTO periodos_academicos (clave,nombre,estado) VALUES ('2027-1','Periodo', 'BORRADOR')").run();
  db.prepare("INSERT INTO materia_requisitos_salon (materiaId,tipoRequerido,caracteristicas) VALUES ((SELECT id FROM materias WHERE clave='BDD'),'LABORATORIO','[\"COMPUTADORAS\"]')").run();
  for (const salon of db.prepare("SELECT id FROM salones").all()) {
    db.prepare("INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES (?, 'COMPUTADORAS')").run(salon.id);
  }
  db.prepare("INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES ('EMP1','Perry','Santry','ACAD',20)").run();
  db.prepare("INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES ('EMP2','Lind','Hateley','ACAD',20)").run();
  for (const [nombre, calificacion] of [['Perry',10], ['Lind',9]]) {
    db.prepare(`
      INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion)
      SELECT p.id,m.id,? FROM profesores p JOIN materias m ON m.clave='BDD'
      WHERE p.nombre=?
    `).run(calificacion,nombre);
  }
  for (const [dia,inicio,fin] of [
    ['Lunes','07:00','09:00'], ['Miércoles','07:00','09:00'],
    ['Martes','07:00','09:00'], ['Jueves','07:00','09:00'],
    ['Viernes','07:00','09:00'], ['Viernes','08:00','09:00']
  ]) db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run(dia,inicio,fin);
  for (const profesor of db.prepare('SELECT id FROM profesores').all()) {
    for (const franja of db.prepare("SELECT dia,horaInicio,horaFin FROM franjas_horarias").all()) {
      db.prepare('INSERT INTO profesor_disponibilidad (profesorId,dia,horaInicio,horaFin,disponible) VALUES (?,?,?,?,1)')
        .run(profesor.id, franja.dia, franja.horaInicio, franja.horaFin);
    }
  }
}

test('progreso usa solo necesidades activas y OMITIDA no cuenta', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const periodoId = db.prepare('SELECT id FROM periodos_academicos').get().id;
    const bdd = db.prepare("SELECT id FROM materias WHERE clave='BDD'").get().id;
    const prog = db.prepare("SELECT id FROM materias WHERE clave='PROG'").get().id;
    const ga = db.prepare("SELECT id FROM grupos WHERE clave='G-A'").get().id;
    const gb = db.prepare("SELECT id FROM grupos WHERE clave='G-B'").get().id;
    db.prepare("INSERT INTO necesidades_planificacion (periodoId,materiaId,grupoId,estado) VALUES (?,?,?, 'PENDIENTE')").run(periodoId,bdd,ga);
    db.prepare("INSERT INTO necesidades_planificacion (periodoId,materiaId,grupoId,estado) VALUES (?,?,?, 'OMITIDA')").run(periodoId,prog,gb);
    const resumen = resumirPlanificacionPeriodo(db, periodoId);
    assert.equal(resumen.progreso.total, 1);
    assert.equal(resumen.progreso.pendientes, 1);
    assert.equal(resumen.progreso.asignadas, 0);
    assert.equal(resumen.progreso.omitidas, 1);
    assert.equal(resumen.progreso.porcentaje, 0);

    db.prepare("UPDATE necesidades_planificacion SET estado='ASIGNADA', cursoId=NULL WHERE materiaId=?").run(prog);
  } finally { db.close(); }
});

test('propuestas son de solo lectura, múltiples y ranking determinista', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const periodoId = db.prepare('SELECT id FROM periodos_academicos').get().id;
    const bdd = db.prepare("SELECT id FROM materias WHERE clave='BDD'").get().id;
    const ga = db.prepare("SELECT id FROM grupos WHERE clave='G-A'").get().id;
    const necesidadId = Number(db.prepare(
      "INSERT INTO necesidades_planificacion (periodoId,materiaId,grupoId,estado) VALUES (?, ?, ?, 'PENDIENTE')"
    ).run(periodoId,bdd,ga).lastInsertRowid);
    const cursosAntes = db.prepare('SELECT COUNT(*) n FROM cursos').get().n;
    const necesidadAntes = db.prepare('SELECT * FROM necesidades_planificacion WHERE id=?').get(necesidadId);
    const resultado = generarPropuestasPlanificacion(db, periodoId, necesidadId, 3);
    assert.equal(resultado.ok, true);
    assert.ok(resultado.alternativas.length >= 2);
    assert.ok(resultado.alternativas.length <= 3);
    assert.equal(resultado.alternativas[0].calificacion, 10);
    assert.deepEqual(db.prepare('SELECT * FROM necesidades_planificacion WHERE id=?').get(necesidadId), necesidadAntes);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM cursos').get().n, cursosAntes);

    db.prepare('UPDATE profesor_disponibilidad SET disponible=0 WHERE profesorId=(SELECT id FROM profesores WHERE nombre=?)')
      .run('Perry');
    const filtrado = generarPropuestasPlanificacion(db, periodoId, necesidadId, 3);
    assert.ok(filtrado.alternativas.every((item) => item.profesor.nombre !== 'Perry Santry'));
  } finally { db.close(); }
});

test('una necesidad asignada conserva conflicto como asignada', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const periodoId = db.prepare('SELECT id FROM periodos_academicos').get().id;
    const materiaId = db.prepare("SELECT id FROM materias WHERE clave='BDD'").get().id;
    const grupoId = db.prepare("SELECT id FROM grupos WHERE clave='G-A'").get().id;
    const profesorId = db.prepare("SELECT id FROM profesores WHERE nombre='Perry'").get().id;
    const salonId = db.prepare("SELECT id FROM salones WHERE clave='LAB-01'").get().id;
    const lunes = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Lunes' AND horaInicio='07:00'").get().id;
    const miercoles = db.prepare("SELECT id FROM franjas_horarias WHERE dia='Miércoles' AND horaInicio='07:00'").get().id;
    const cursoId = Number(db.prepare(
      'INSERT INTO cursos (materiaId,profesorId,grupoId,salonId,periodoId) VALUES (?,?,?,?,?)'
    ).run(materiaId,profesorId,grupoId,salonId,periodoId).lastInsertRowid);
    db.prepare('INSERT INTO curso_horarios (cursoId,horarioId) VALUES (?,?)').run(cursoId,lunes);
    db.prepare('INSERT INTO curso_horarios (cursoId,horarioId) VALUES (?,?)').run(cursoId,miercoles);
    db.prepare("INSERT INTO necesidades_planificacion (periodoId,materiaId,grupoId,cursoId,estado) VALUES (?,?,?,?, 'ASIGNADA')")
      .run(periodoId,materiaId,grupoId,cursoId);
    const resumen = resumirPlanificacionPeriodo(db, periodoId);
    assert.equal(resumen.progreso.asignadas, 1);
    assert.equal(resumen.progreso.pendientes, 0);
    assert.equal(resumen.progreso.porcentaje, 100);
  } finally { db.close(); }
});
