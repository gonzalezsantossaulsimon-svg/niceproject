import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../database.js';
import { generarPlanificacionGlobal } from '../services/planificacion-global.js';
import { generarPropuestasPlanificacion } from '../services/propuestas-planificacion.js';

function fixture(db) {
  db.exec(`
    INSERT INTO academias (clave,nombre) VALUES ('ACAD','Academia');
    INSERT INTO materias (id,clave,nombre,horasSemanales) VALUES (1,'M1','Materia 1',5),(2,'M2','Materia 2',6),(3,'M3','Materia 3',4);
    INSERT INTO grupos (id,clave,nombre,cantidadAlumnos) VALUES (1,'G1','Grupo 1',20),(2,'G2','Grupo 2',20),(3,'G3','Grupo 3',20);
    INSERT INTO salones (id,clave,nombre,capacidad,tipo) VALUES (1,'S1','Salon 1',30,'LABORATORIO'),(2,'S2','Salon 2',30,'LABORATORIO');
    INSERT INTO profesores (id,numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES (1,'P1','Profesor','Uno','ACAD',10),(2,'P2','Profesor','Dos','ACAD',10);
    INSERT INTO periodos_academicos (id,clave,nombre,estado) VALUES (1,'2027-1','Periodo 1','BORRADOR'),(2,'2027-2','Periodo 2','BORRADOR');
    INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion) VALUES (1,1,10),(2,1,9),(1,2,10),(2,2,9);
    INSERT INTO materia_requisitos_salon (materiaId,tipoRequerido,caracteristicas) VALUES (1,'LABORATORIO','["COMPUTADORAS"]'),(2,'LABORATORIO','["COMPUTADORAS"]');
    INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES (1,'COMPUTADORAS'),(2,'COMPUTADORAS');
    INSERT INTO necesidades_planificacion (id,periodoId,materiaId,grupoId,estado) VALUES (1,1,1,1,'PENDIENTE'),(2,1,2,2,'PENDIENTE'),(3,1,3,3,'OMITIDA');
  `);
  for (const dia of ['Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes']) {
    db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run(dia,'17:00','19:00');
  }
  db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run('Viernes','18:00','19:00');
}
function curso(db, periodo, materia, profesor, grupo, salon) {
  const id = Number(db.prepare('INSERT INTO cursos (periodoId,materiaId,profesorId,grupoId,salonId) VALUES (?,?,?,?,?)').run(periodo,materia,profesor,grupo,salon).lastInsertRowid);
  const franjas = db.prepare("SELECT id FROM franjas_horarias WHERE dia IN ('Lunes','Miércoles','Viernes') AND horaInicio='17:00'").all();
  for (const f of franjas) db.prepare('INSERT INTO curso_horarios (cursoId,horarioId) VALUES (?,?)').run(id,f.id);
  return id;
}

test('plan global conserva patrones, periodo, carga y base sin escrituras', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    curso(db,2,2,1,2,1);
    const antes = db.prepare('SELECT total_changes() AS n').get().n;
    const resultado = generarPlanificacionGlobal(db,1);
    assert.equal(resultado.ok,true);
    assert.equal(resultado.soloLectura,true);
    assert.equal(resultado.aplicable,false);
    assert.equal(resultado.resumen.nuevas,2);
    assert.equal(resultado.resumen.omitidas,1);
    assert.equal(resultado.resumen.coberturaProyectada,100);
    const [cinco,seis] = resultado.asignaciones;
    assert.notEqual(cinco.alternativa.profesor.id,seis.alternativa.profesor.id);
    assert.notEqual(cinco.alternativa.salon.id,seis.alternativa.salon.id);
    assert.equal(cinco.alternativa.horario.horarios.find(h => h.dia==='Viernes').horaInicio,'18:00');
    assert.equal(seis.alternativa.horario.horarios.find(h => h.dia==='Viernes').horaInicio,'17:00');
    assert.equal(db.prepare('SELECT total_changes() AS n').get().n,antes);
    assert.deepEqual(generarPlanificacionGlobal(db,1),resultado);
    assert.ok(generarPropuestasPlanificacion(db,1,1,100).alternativas.length <= 3);
  } finally { db.close(); }
});

test('plan global respeta ocupación real de grupo y no duplica cursos existentes', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    curso(db,1,2,1,2,1);
    curso(db,1,3,2,1,2);
    const r = generarPlanificacionGlobal(db,1);
    assert.equal(r.resumen.nuevas,0);
    assert.equal(r.sinAsignar.length,2);
    assert.match(r.sinAsignar.find(x => x.necesidad.id===2).motivo,/Ya existe un curso/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cursos').get().n,2);
  } finally { db.close(); }
});

test('plan global respeta indisponibilidad parcial y requisitos de salón', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    db.exec(`INSERT INTO profesor_disponibilidad (profesorId,dia,horaInicio,horaFin,disponible) VALUES (1,'Viernes','18:00','19:00',0);
      INSERT INTO salon_disponibilidad (salonId,dia,horaInicio,horaFin,disponible) VALUES (1,'Viernes','18:00','19:00',0);
      UPDATE necesidades_planificacion SET estado='OMITIDA' WHERE id=1;`);
    const valido = generarPlanificacionGlobal(db,1);
    assert.equal(valido.resumen.nuevas,1);
    assert.equal(valido.asignaciones[0].alternativa.profesor.id,2);
    assert.equal(valido.asignaciones[0].alternativa.salon.id,2);
    db.exec('DELETE FROM caracteristicas_salones WHERE salonId=2');
    const r = generarPlanificacionGlobal(db,1);
    assert.equal(r.resumen.nuevas,0);
    assert.equal(r.sinAsignar.length,1);
  } finally { db.close(); }
});

test('plan global permite simular VALIDADO pero rechaza PUBLICADO y periodo inexistente', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    db.exec("UPDATE periodos_academicos SET estado='VALIDADO' WHERE id=1");
    assert.equal(generarPlanificacionGlobal(db,1).ok,true);
    db.exec("UPDATE periodos_academicos SET estado='PUBLICADO' WHERE id=1");
    assert.equal(generarPlanificacionGlobal(db,1).error,'PERIODO_NO_PLANIFICABLE');
    assert.equal(generarPlanificacionGlobal(db,99).error,'PERIODO_NO_EXISTE');
  } finally { db.close(); }
});

test('ABC conserva cobertura, restricciones, indicadores y solo lectura', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const antes = db.prepare('SELECT total_changes() AS n').get().n;
    const r = generarPlanificacionGlobal(db, 1, { modo: 'ABC' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.planes.map(p => p.id), ['A','B','C']);
    assert.equal(r.soloLectura, true);
    assert.equal(r.aplicable, false);
    for (const p of r.planes) {
      assert.equal(p.resumen.nuevas, 2);
      assert.equal(p.resumen.coberturaProyectada, 100);
      assert.equal(p.resumen.omitidas, 1);
      assert.equal(p.sinAsignar.length, 0);
      assert.notEqual(p.asignaciones[0].alternativa.profesor.id, p.asignaciones[1].alternativa.profesor.id);
      assert.notEqual(p.asignaciones[0].alternativa.salon.id, p.asignaciones[1].alternativa.salon.id);
      assert.ok(p.metricas.cargaMaximaPorcentaje <= 100);
      assert.ok(Number.isFinite(p.metricas.cargaRmsPorcentaje));
      assert.ok(p.metricas.minutosHuecos >= 0);
    }
    assert.equal(db.prepare('SELECT total_changes() AS n').get().n, antes);
    assert.deepEqual(generarPlanificacionGlobal(db, 1, { modo: 'ABC' }), r);
  } finally { db.close(); }
});

test('ABC no promete optimizacion con presupuesto minimo y valida modo', () => {
  const db = createDatabase(':memory:');
  try {
    fixture(db);
    const r = generarPlanificacionGlobal(db, 1, { modo: 'ABC', limite: 1 });
    assert.ok(r.planes.every(p => !p.busqueda.objetivoOptimo && p.busqueda.pasos <= 1));
    assert.ok(r.planes.every(p => p.resumen.nuevas >= 1));
    assert.equal(generarPlanificacionGlobal(db, 1, { modo: 'D' }).error, 'MODO_INVALIDO');
    db.exec("UPDATE periodos_academicos SET estado='PUBLICADO' WHERE id=1");
    assert.equal(generarPlanificacionGlobal(db, 1, { modo: 'ABC' }).error, 'PERIODO_NO_PLANIFICABLE');
  } finally { db.close(); }
});
