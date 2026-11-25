import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import test from 'node:test';
import { createDatabase } from '../database.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('HTTP smoke, CRUD curso, restricciones duras y publicación en DB aislada', async (t) => {
  const dbPath = path.join(backendDir, `.assignment-e2e-${process.pid}.db`);
  const cleanup = async () => Promise.all(['', '-shm', '-wal'].map((suffix) => rm(`${dbPath}${suffix}`, { force: true })));
  await cleanup();

  const db = createDatabase(dbPath);
  db.prepare("INSERT INTO usuarios (username,password,nombre) VALUES ('admin','admin123','Administrador')").run();
  db.prepare("INSERT INTO academias (clave,nombre) VALUES ('ACAD','Academia demo')").run();
  const matterId = Number(db.prepare("INSERT INTO materias (clave,nombre,horasSemanales) VALUES ('BDD-107','Bases de Datos',4)").run().lastInsertRowid);
  const professors = [
    ['EMP012','Perry','Santry',20,10],
    ['EMP013','Lind','Hateley',20,9],
    ['EMP014','Dav','Dent',20,7]
  ];
  const profIds = professors.map(([employee,name,surname,max]) => Number(
    db.prepare('INSERT INTO profesores (numeroEmpleado,nombre,apellido,academiaId,maxHorasSemanales) VALUES (?,?,?,?,?)')
      .run(employee,name,surname,'ACAD',max).lastInsertRowid
  ));
  for (let i=0;i<profIds.length;i+=1) {
    db.prepare('INSERT INTO profesor_materia_calificaciones (profesorId,materiaId,calificacion) VALUES (?,?,?)')
      .run(profIds[i],matterId,professors[i][4]);
  }
  const groupIds = [
    Number(db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('G-A','Grupo A',25)").run().lastInsertRowid),
    Number(db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('G-B','Grupo B',25)").run().lastInsertRowid),
    Number(db.prepare("INSERT INTO grupos (clave,nombre,cantidadAlumnos) VALUES ('G-C','Grupo C',50)").run().lastInsertRowid)
  ];
  const roomIds = [
    Number(db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB-01','Lab 1',40,'LABORATORIO')").run().lastInsertRowid),
    Number(db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB-02','Lab 2',40,'LABORATORIO')").run().lastInsertRowid),
    Number(db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('A-101','Aula 101',40,'AULA')").run().lastInsertRowid),
    Number(db.prepare("INSERT INTO salones (clave,nombre,capacidad,tipo) VALUES ('LAB-03','Lab 3',40,'LABORATORIO')").run().lastInsertRowid)
  ];
  for (const id of [roomIds[0],roomIds[3]]) {
    db.prepare('INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES (?,?)').run(id,'COMPUTADORAS');
  }
  for (const id of [roomIds[0],roomIds[3]]) {
    db.prepare("INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES (?,'INTERNET')").run(id);
  }
  db.prepare("INSERT INTO caracteristicas_salones (salonId,caracteristica) VALUES (?,'COMPUTADORAS')").run(roomIds[2]);
  db.prepare("INSERT INTO materia_requisitos_salon (materiaId,tipoRequerido,caracteristicas) VALUES (?,'LABORATORIO','[\"COMPUTADORAS\",\"INTERNET\"]')").run(matterId);
  const periodId = Number(db.prepare("INSERT INTO periodos_academicos (clave,nombre,estado) VALUES ('2027-1','Enero-Junio 2027','BORRADOR')").run().lastInsertRowid);
  const slots = {};
  for (const [key,day,start,end] of [
    ['monday','Lunes','07:00','09:00'],
    ['wednesday','Miércoles','07:00','09:00'],
    ['tuesday','Martes','07:00','09:00'],
    ['thursday','Jueves','07:00','09:00']
  ]) {
    slots[key] = Number(db.prepare('INSERT INTO franjas_horarias (dia,horaInicio,horaFin) VALUES (?,?,?)').run(day,start,end).lastInsertRowid);
  }
  for (const profId of profIds) {
    for (const key of Object.keys(slots)) {
      const { dia: day, horaInicio: start, horaFin: end } = db.prepare(
        'SELECT dia,horaInicio,horaFin FROM franjas_horarias WHERE id=?'
      ).get(slots[key]);
      db.prepare('INSERT INTO profesor_disponibilidad (profesorId,dia,horaInicio,horaFin,disponible) VALUES (?,?,?,?,1)')
        .run(profId,day,start,end);
    }
  }
  db.close();

  const port = await freePort();
  const server = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(port), NICEPROJECT_DB_PATH: dbPath },
    stdio: ['ignore','pipe','pipe']
  });
  let output = '';
  server.stdout.setEncoding('utf8').on('data', (data) => { output += data; });
  server.stderr.setEncoding('utf8').on('data', (data) => { output += data; });
  t.after(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      if (process.platform === 'win32') {
        execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',`Stop-Process -Id ${server.pid} -Force`], { stdio: 'ignore' });
      } else {
        server.kill('SIGKILL');
      }
      await exited;
    }
    await cleanup();
  });

  const base = `http://127.0.0.1:${port}/api`;
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(`${base}/periodos`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve,100));
  }
  async function request(method, route, body) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type':'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data };
  }
  const paths = [
    ['POST','/login',{ username:'admin',password:'admin123' }],
    ['GET','/periodos'],
    ['GET','/materias'],
    ['GET','/profesores'],
    ['GET','/grupos'],
    ['GET','/salones'],
    ['GET','/franjas-horarias'],
    ['GET','/cursos']
  ];
  for (const [method,route,body] of paths) {
    const response = await request(method,route,body);
    assert.equal(response.status,200,`${method} ${route}: ${JSON.stringify(response.data)}`);
  }

  const monday = await request('GET',`/materias/${matterId}/patrones-horarios?horarioBaseId=${slots.monday}`);
  assert.equal(monday.status,200);
  const ids = monday.data.horarioIds;
  const recs = await request('GET',`/materias/${matterId}/profesores-recomendados?periodoId=${periodId}&horarioIds=${ids.join(',')}`);
  assert.equal(recs.status,200);
  assert.deepEqual(recs.data.map((item) => item.calificacionMateria),[10,9,7]);
  const rooms = await request('GET',`/salones/disponibles?materiaId=${matterId}&grupoId=${groupIds[0]}&horarioIds=${ids.join(',')}`);
  assert.equal(rooms.status,200);
  assert.deepEqual(rooms.data.map((item) => item.id),[roomIds[0],roomIds[3]]);
  assert.equal((await request('GET',`/periodos/${periodId}/conflictos`)).status,200);
  assert.equal((await request('GET',`/profesores/${profIds[0]}/calificaciones`)).status,200);
  assert.equal((await request('GET',`/profesores/${profIds[0]}/disponibilidad`)).status,200);
  const necesidadCreada = await request('POST',`/periodos/${periodId}/necesidades-planificacion`,{
    materiaId:matterId,
    grupoId:groupIds[0]
  });
  assert.equal(necesidadCreada.status,201,JSON.stringify(necesidadCreada.data));
  assert.equal(necesidadCreada.data.estado,'PENDIENTE');
  assert.equal((await request('POST',`/periodos/${periodId}/necesidades-planificacion`,{
    materiaId:matterId,
    grupoId:groupIds[0]
  })).status,409,'duplicated need');
  const necesidadEditada = await request('PUT',`/necesidades-planificacion/${necesidadCreada.data.id}`,{
    materiaId:matterId,
    grupoId:groupIds[0],
    estado:'OMITIDA'
  });
  assert.equal(necesidadEditada.status,200);
  assert.equal(necesidadEditada.data.estado,'OMITIDA');
  const omitidaResumen = await request('GET',`/periodos/${periodId}/planificacion`);
  assert.equal(omitidaResumen.status,200);
  assert.ok(omitidaResumen.data.progreso.omitidas >= 1);
  assert.equal((await request('PUT',`/necesidades-planificacion/${necesidadCreada.data.id}`,{
    estado:'PENDIENTE'
  })).status,200,'restore pending');
  const necesidadEliminar = await request('POST',`/periodos/${periodId}/necesidades-planificacion`,{
    materiaId:matterId,
    grupoId:groupIds[1]
  });
  assert.equal(necesidadEliminar.status,201);
  assert.equal((await request('DELETE',`/necesidades-planificacion/${necesidadEliminar.data.id}`)).status,200);
  // Simulación global por HTTP: comprobar respuesta y ausencia de escrituras.
  const rutaGlobal = `/periodos/${periodId}/planificacion-global`;
  const antesCursos = await request('GET','/cursos');
  const antesNecesidades = await request('GET',`/periodos/${periodId}/necesidades-planificacion`);
  const global = await request('POST',rutaGlobal,{});
  assert.equal(global.status,200,JSON.stringify(global.data));
  assert.equal(global.data.ok,true);
  assert.equal(global.data.soloLectura,true);
  assert.equal(global.data.aplicable,false);
  assert.equal(global.data.resumen.nuevas,1);
  assert.equal(global.data.asignaciones[0].necesidadId,necesidadCreada.data.id);
  assert.equal(global.data.busqueda.coberturaOptima,true);
  assert.deepEqual((await request('POST',rutaGlobal,{})).data,global.data);
  assert.equal((await request('POST',rutaGlobal,{limite:1})).status,200);
  for (const limite of [0,-1,1.5,100001,'20',null]) {
    assert.equal((await request('POST',rutaGlobal,{limite})).status,400);
  }
  const abc = await request('POST',rutaGlobal,{modo:'ABC'});
  assert.equal(abc.status,200,JSON.stringify(abc.data));
  assert.deepEqual(abc.data.planes.map(p => p.id), ['A','B','C']);
  assert.ok(abc.data.planes.every(p => p.resumen.nuevas===1 && p.aplicable===false));
  assert.ok(abc.data.planes.every(p => Number.isFinite(p.metricas.cargaRmsPorcentaje)));
  assert.equal((await request('POST',rutaGlobal,{modo:'D'})).status,400);
  assert.equal((await request('POST',rutaGlobal,{modo:'ABC',aplicar:true})).status,400);
  assert.equal((await request('POST',rutaGlobal,{aplicar:true})).status,400);
  assert.equal((await request('POST','/periodos/abc/planificacion-global',{})).status,400);
  assert.equal((await request('POST','/periodos/99999999/planificacion-global',{})).status,404);
  assert.deepEqual(await request('GET','/cursos'),antesCursos);
  assert.deepEqual(await request('GET',`/periodos/${periodId}/necesidades-planificacion`),antesNecesidades);
  const necesidadAsignada = await request('POST',`/periodos/${periodId}/aplicar-propuesta`,{
    necesidadId:necesidadCreada.data.id,
    profesorId:profIds[0],
    salonId:roomIds[0],
    horarioIds:ids
  });
  assert.equal(necesidadAsignada.status,201,JSON.stringify(necesidadAsignada.data));
  const asignadaResumen = await request('GET',`/periodos/${periodId}/planificacion`);
  assert.equal(asignadaResumen.status,200);
  assert.ok(asignadaResumen.data.progreso.asignadas >= 1);
  assert.equal((await request('DELETE',`/necesidades-planificacion/${necesidadCreada.data.id}`)).status,409,
    'assigned need cannot be deleted');
  assert.equal((await request('DELETE',`/cursos/${necesidadAsignada.data.curso.id}`)).status,200,
    'resolve assigned need by deleting associated course');
  assert.equal((await request('DELETE',`/necesidades-planificacion/${necesidadCreada.data.id}`)).status,200,
    'pending need can be deleted after resolving course');

  const scoreEdit = await request('PUT',`/profesores/${profIds[0]}/calificaciones`,{
    calificaciones:[{materiaId: matterId,calificacion:8}]
  });
  assert.equal(scoreEdit.status,200,JSON.stringify(scoreEdit.data));
  const reordered = await request('GET',`/materias/${matterId}/profesores-recomendados?periodoId=${periodId}&horarioIds=${ids.join(',')}`);
  assert.deepEqual(reordered.data.map((item) => item.calificacionMateria),[9,8,7]);
  await request('PUT',`/profesores/${profIds[0]}/calificaciones`,{calificaciones:[{materiaId: matterId,calificacion:10}]});

  const coursePayload = {
    periodoId:periodId,materiaId: matterId,profesorId:profIds[0],grupoId:groupIds[0],salonId:roomIds[0],horarioIds:ids
  };
  const created = await request('POST','/cursos',coursePayload);
  assert.equal(created.status,201,JSON.stringify(created.data));
  const courseId = created.data.id;
  const readCourse = await request('GET',`/cursos/${courseId}`);
  assert.equal(readCourse.status,200);
  for (const key of ['periodo','materia','profesor','grupo','salon']) assert.ok(readCourse.data[key],key);
  assert.equal(readCourse.data.periodo.id,periodId);
  assert.deepEqual(readCourse.data.horarioIds,ids);
  assert.equal((await request('PUT',`/cursos/${courseId}`,coursePayload)).status,200);
  assert.equal((await request('DELETE',`/cursos/${courseId}`)).status,200);
  const dbAfterDelete = createDatabase(dbPath);
  assert.equal(dbAfterDelete.prepare('SELECT COUNT(*) n FROM cursos WHERE id=?').get(courseId).n,0);
  assert.equal(dbAfterDelete.prepare('SELECT COUNT(*) n FROM curso_horarios WHERE cursoId=?').get(courseId).n,0);
  dbAfterDelete.close();

  async function create(payload) { return request('POST','/cursos',payload); }
  const baseline = await create(coursePayload);
  assert.equal(baseline.status,201);
  const baselineId = baseline.data.id;
  const candidate = (patch = {}) => ({ ...coursePayload, profesorId:profIds[1],grupoId:groupIds[1],salonId:roomIds[3],...patch });
  const unavailable = await request('PUT',`/profesores/${profIds[1]}/disponibilidad`,{
    disponibilidad:[
      {dia:'Lunes',horaInicio:'07:00',horaFin:'09:00',disponible:false},
      {dia:'Miércoles',horaInicio:'07:00',horaFin:'09:00',disponible:true}
    ]
  });
  assert.equal(unavailable.status,200);
  assert.equal((await create(candidate())).status,400,'teacher unavailable');
  await request('PUT',`/profesores/${profIds[1]}/disponibilidad`,{
    disponibilidad:Object.entries(slots).map(([key,id])=>{
      const {dia,horaInicio,horaFin}=dbSlot(dbPath,id);
      return {dia,horaInicio,horaFin,disponible:true};
    })
  });
  assert.equal((await create(candidate({profesorId:profIds[0]}))).status,400,'teacher conflict');
  assert.equal((await create(candidate({grupoId:groupIds[0]}))).status,400,'group conflict');
  assert.equal((await create(candidate({salonId:roomIds[0]}))).status,400,'room conflict');
  assert.equal((await create(candidate({grupoId:groupIds[2]}))).status,400,'capacity insufficient');
  assert.equal((await create(candidate({salonId:roomIds[2]}))).status,400,'room type incompatible');
  assert.equal((await create(candidate({salonId:roomIds[1]}))).status,400,'required feature missing');
  assert.equal((await create(candidate({horarioIds:[slots.monday,slots.tuesday]}))).status,400,'invalid pattern');

  const loadBase = await create({
    ...coursePayload,profesorId:profIds[2],grupoId:groupIds[1],salonId:roomIds[3]
  });
  assert.equal(loadBase.status,201,JSON.stringify(loadBase.data));
  const mutable = createDatabase(dbPath);
  mutable.prepare('UPDATE profesores SET maxHorasSemanales=4 WHERE id=?').run(profIds[2]);
  mutable.close();
  assert.equal((await create({ ...coursePayload,profesorId:profIds[2],grupoId:groupIds[1],salonId:roomIds[3],horarioIds:[slots.tuesday,slots.thursday] })).status,400,'max load');

  const periodConflict = await request('PUT',`/profesores/${profIds[0]}/disponibilidad`,{
    disponibilidad:[
      {dia:'Lunes',horaInicio:'07:00',horaFin:'09:00',disponible:false},
      {dia:'Miércoles',horaInicio:'07:00',horaFin:'09:00',disponible:true}
    ]
  });
  assert.equal(periodConflict.status,200);
  const validTransition = await request('PUT',`/periodos/${periodId}`,{estado:'VALIDADO'});
  assert.equal(validTransition.status,409);
  assert.equal((await request('PUT',`/periodos/${periodId}`,{estado:'PUBLICADO'})).status,409);
  const newPeriod = await request('POST','/periodos',{clave:'2027-2',nombre:'Periodo sin cursos'});
  assert.equal(newPeriod.status,201);
  assert.equal((await request('PUT',`/periodos/${newPeriod.data.id}`,{estado:'VALIDADO'})).status,200);
  const rutaGlobalNuevo = `/periodos/${newPeriod.data.id}/planificacion-global`;
  const simulacionValidada = await request('POST',rutaGlobalNuevo,{});
  assert.equal(simulacionValidada.status,200);
  assert.equal(simulacionValidada.data.asignaciones.length,0);
  assert.equal(simulacionValidada.data.aplicable,false);
  assert.equal((await request('PUT',`/periodos/${newPeriod.data.id}`,{estado:'PUBLICADO'})).status,200);
  assert.equal((await request('POST',rutaGlobalNuevo,{})).status,409);
  assert.equal((await request('POST',`/periodos/${newPeriod.data.id}/necesidades-planificacion`,{
    materiaId:matterId,
    grupoId:groupIds[0]
  })).status,409,'needs cannot be created in published period');
  assert.equal((await request('PUT',`/periodos/${newPeriod.data.id}`,{estado:'CERRADO'})).status,200);
  assert.equal((await request('GET',`/periodos/${newPeriod.data.id}/planificacion`)).status,200);

  const conflicts = await request('GET',`/periodos/${periodId}/conflictos`);
  assert.equal(conflicts.status,200);
  assert.ok(conflicts.data.conflictos.some((item) =>
    item.cursoId && item.materia && item.grupo && item.tipo === 'BLOQUEANTE' && item.motivo
  ));
  await request('DELETE',`/cursos/${baselineId}`);
  await request('DELETE',`/cursos/${loadBase.data.id}`);
  const removedRelation = await request('DELETE',`/profesores/${profIds[2]}/calificaciones/${matterId}`);
  assert.equal(removedRelation.status,200);
  assert.equal((await request('GET',`/profesores/${profIds[2]}/calificaciones`)).data.length,0);
  const createdRelation = await request('PUT',`/profesores/${profIds[2]}/calificaciones`,{
    calificaciones:[{materiaId: matterId,calificacion:6}]
  });
  assert.equal(createdRelation.status,200);
  assert.deepEqual((await request('GET',`/profesores/${profIds[2]}/calificaciones`)).data.map((item) => item.calificacion),[6]);
  assert.equal((await request('DELETE',`/profesores/${profIds[2]}/calificaciones/${matterId}`)).status,200);
  assert.equal((await request('GET',`/profesores/${profIds[2]}/calificaciones`)).data.length,0);
  assert.equal((await request('GET',`/profesores/${profIds[2]}`)).status,200);
  assert.equal((await request('GET',`/materias/${matterId}`)).status,200);
});

function dbSlot(databasePath,id) {
  const db = createDatabase(databasePath);
  const row = db.prepare('SELECT dia,horaInicio,horaFin FROM franjas_horarias WHERE id=?').get(id);
  db.close();
  return row;
}
