import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import Database from 'better-sqlite3';
import test from 'node:test';
import { createDatabase } from '../database.js';
import { seedDemoCatalogos } from '../migrations/seed_demo_catalogos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BACKEND_DIR, '..');

function crearFixture(db) {
  const insertarAcademia = db.prepare(
    'INSERT INTO academias (clave, nombre, descripcion) VALUES (?, ?, ?)'
  );
  const insertarProfesor = db.prepare(`
    INSERT INTO profesores (numeroEmpleado, nombre, apellido, academiaId)
    VALUES (?, ?, ?, ?)
  `);
  const insertarMateria = db.prepare(
    'INSERT INTO materias (clave, nombre, academiaClave) VALUES (?, ?, ?)'
  );

  for (let indice = 1; indice <= 4; indice += 1) {
    const clave = `ACAD0${indice}`;
    insertarAcademia.run(clave, `Academia ${indice}`, '');
  }

  for (let indice = 1; indice <= 16; indice += 1) {
    const academia = `ACAD0${((indice - 1) % 4) + 1}`;
    insertarProfesor.run(`EMP${String(indice).padStart(3, '0')}`, `Nombre ${indice}`, 'Prueba', academia);
  }

  for (let indice = 1; indice <= 8; indice += 1) {
    insertarMateria.run(`MAT-${String(indice).padStart(3, '0')}`, `Materia ${indice}`, null);
  }
}

function obtenerConteos(db) {
  return {
    cursos: db.prepare('SELECT COUNT(*) AS n FROM cursos').get().n,
    materias: db.prepare('SELECT COUNT(*) AS n FROM materias').get().n,
    profesores: db.prepare('SELECT COUNT(*) AS n FROM profesores').get().n,
    academias: db.prepare('SELECT COUNT(*) AS n FROM academias').get().n,
    grupos: db.prepare('SELECT COUNT(*) AS n FROM grupos').get().n,
    salones: db.prepare('SELECT COUNT(*) AS n FROM salones').get().n,
    franjas: db.prepare('SELECT COUNT(*) AS n FROM franjas_horarias').get().n
  };
}

test('siembra 5 grupos, 6 salones y 15 franjas sin duplicar ni alterar claves existentes', () => {
  const db = createDatabase(':memory:');

  try {
    crearFixture(db);
    db.prepare(
      'INSERT INTO grupos (clave, nombre, cantidadAlumnos) VALUES (?, ?, ?)'
    ).run('GRP-01', 'Grupo existente', 20);
    db.prepare(
      'INSERT INTO salones (clave, nombre, capacidad) VALUES (?, ?, ?)'
    ).run('A-101', 'Aula existente', 24);
    db.prepare(
      'INSERT INTO franjas_horarias (dia, horaInicio, horaFin) VALUES (?, ?, ?)'
    ).run('Lunes', '07:00', '09:00');

    seedDemoCatalogos(db);
    seedDemoCatalogos(db);

    assert.deepEqual(obtenerConteos(db), {
      cursos: 0,
      materias: 8,
      profesores: 16,
      academias: 4,
      grupos: 5,
      salones: 6,
      franjas: 15
    });
    assert.deepEqual(
      db.prepare('SELECT nombre, cantidadAlumnos FROM grupos WHERE clave = ?').get('GRP-01'),
      { nombre: 'Grupo existente', cantidadAlumnos: 20 }
    );
    assert.deepEqual(
      db.prepare('SELECT nombre, capacidad FROM salones WHERE clave = ?').get('A-101'),
      { nombre: 'Aula existente', capacidad: 24 }
    );
    assert.equal(
      db.prepare(`
        SELECT COUNT(*) AS n FROM franjas_horarias
        WHERE dia = 'Lunes' AND horaInicio = '07:00' AND horaFin = '09:00'
      `).get().n,
      1
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM migrations WHERE nombre = ?')
        .get('seed_demo_catalogos_v1').n,
      1
    );
  } finally {
    db.close();
  }
});

test('npm run migrate siembra los catálogos y las rutas API permiten validar GRP-05', async (t) => {
  const databasePath = path.join(__dirname, `.catalogos-api-${process.pid}.db`);
  const cleanup = async () => {
    await Promise.all(['', '-shm', '-wal'].map((suffix) => (
      rm(`${databasePath}${suffix}`, { force: true })
    )));
  };
  await cleanup();
  t.after(cleanup);

  const migrationEnv = { ...process.env, NICEPROJECT_DB_PATH: databasePath };
  for (let intento = 0; intento < 2; intento += 1) {
    const comandoNpm = process.env.npm_execpath
      ? { command: process.execPath, args: [process.env.npm_execpath, 'run', 'migrate'] }
      : process.platform === 'win32'
        ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm.cmd run migrate'] }
        : { command: 'npm', args: ['run', 'migrate'] };
    const migracion = spawnSync(comandoNpm.command, comandoNpm.args, {
      cwd: BACKEND_DIR,
      env: migrationEnv,
      encoding: 'utf8'
    });
    assert.equal(migracion.status, 0, migracion.stderr || migracion.stdout);
  }

  const puerto = await obtenerPuertoDisponible();
  const servidor = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND_DIR,
    env: { ...migrationEnv, PORT: String(puerto) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let salida = '';
  servidor.stdout.setEncoding('utf8').on('data', (fragmento) => { salida += fragmento; });
  servidor.stderr.setEncoding('utf8').on('data', (fragmento) => { salida += fragmento; });

  try {
    const baseUrl = `http://127.0.0.1:${puerto}`;
    await esperarServidor(servidor, baseUrl, () => salida);
    const get = async (recurso) => {
      const response = await fetch(`${baseUrl}/api/${recurso}`);
      assert.equal(response.status, 200, `GET /api/${recurso}`);
      return response.json();
    };

    const [grupos, salones, franjas, materias, profesores, academias, cursos] = await Promise.all([
      get('grupos'),
      get('salones'),
      get('franjas-horarias'),
      get('materias'),
      get('profesores'),
      get('academias'),
      get('cursos')
    ]);

    assert.equal(grupos.length, 5);
    assert.equal(salones.length, 6);
    assert.equal(franjas.length, 15);
    assert.equal(materias.length, 8);
    assert.equal(profesores.length, 16);
    assert.equal(academias.length, 4);
    assert.equal(cursos.length, 0);

    assert.deepEqual(
      grupos.map(({ clave, nombre, cantidadAlumnos }) => ({ clave, nombre, cantidadAlumnos })),
      [
        { clave: 'GRP-01', nombre: 'Grupo A', cantidadAlumnos: 25 },
        { clave: 'GRP-02', nombre: 'Grupo B', cantidadAlumnos: 30 },
        { clave: 'GRP-03', nombre: 'Grupo C', cantidadAlumnos: 35 },
        { clave: 'GRP-04', nombre: 'Grupo D', cantidadAlumnos: 20 },
        { clave: 'GRP-05', nombre: 'Grupo E', cantidadAlumnos: 40 }
      ]
    );
    assert.deepEqual(
      salones.map(({ clave, nombre, capacidad }) => ({ clave, nombre, capacidad })),
      [
        { clave: 'A-101', nombre: 'Aula 101', capacidad: 30 },
        { clave: 'A-102', nombre: 'Aula 102', capacidad: 35 },
        { clave: 'A-103', nombre: 'Aula 103', capacidad: 40 },
        { clave: 'AUD-01', nombre: 'Aula Magna', capacidad: 60 },
        { clave: 'LAB-01', nombre: 'Laboratorio de Cómputo 1', capacidad: 30 },
        { clave: 'LAB-02', nombre: 'Laboratorio de Cómputo 2', capacidad: 35 }
      ]
    );
    assert.deepEqual(
      franjas
        .map(({ dia, horaInicio, horaFin }) => [dia, horaInicio, horaFin])
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
      ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].flatMap((dia) => [
        [dia, '07:00', '09:00'],
        [dia, '09:00', '11:00'],
        [dia, '11:00', '13:00']
      ]).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    );

    const grupo = grupos.find((item) => item.clave === 'GRP-05');
    const salonInsuficiente = salones.find((item) => item.clave === 'A-101');
    const salonSuficiente = salones.find((item) => item.clave === 'A-103');
    const franja = franjas.find((item) => (
      item.dia === 'Lunes' && item.horaInicio === '07:00' && item.horaFin === '09:00'
    ));
    const materia = materias.find((item) => profesores.some((profesor) => (
      profesor.materias.some((asignada) => asignada.nombre.toLowerCase() === item.nombre.toLowerCase())
    )));
    const profesor = profesores.find((item) => (
      item.materias.some((asignada) => asignada.nombre.toLowerCase() === materia.nombre.toLowerCase())
    ));
    assert.ok(grupo && salonInsuficiente && salonSuficiente && franja && materia && profesor);
    assert.equal(grupo.cantidadAlumnos, 40);
    assert.equal(salonInsuficiente.capacidad, 30);
    assert.equal(salonSuficiente.capacidad, 40);

    const curso = {
      materiaId: materia.id,
      profesorId: profesor.id,
      grupoId: grupo.id,
      salonId: salonInsuficiente.id,
      horarioIds: [franja.id]
    };
    const rechazo = await fetch(`${baseUrl}/api/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(curso)
    });
    assert.equal(rechazo.status, 400);
    assert.match((await rechazo.json()).error, /capacidad para 30 alumnos y el grupo tiene 40/);

    const aceptacion = await fetch(`${baseUrl}/api/cursos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...curso, salonId: salonSuficiente.id })
    });
    assert.equal(aceptacion.status, 201, salida);
    assert.equal((await aceptacion.json()).salon.clave, 'A-103');
    assert.equal((await get('cursos')).length, 1);

    const formulario = await readFile(path.join(PROJECT_DIR, 'frontend', 'curso-form.html'), 'utf8');
    const codigoFormulario = await readFile(
      path.join(PROJECT_DIR, 'frontend', 'js', 'curso-form.js'),
      'utf8'
    );
    assert.match(formulario, /Nuevo curso/);
    assert.match(codigoFormulario, /getGrupos/);
    assert.match(codigoFormulario, /getSalones/);
    assert.match(codigoFormulario, /getFranjasHorarias/);
  } finally {
    servidor.kill();
    await new Promise((resolve) => {
      if (servidor.exitCode !== null) {
        resolve();
      } else {
        servidor.once('exit', resolve);
      }
    });
  }
});

async function obtenerPuertoDisponible() {
  const servidor = net.createServer();
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });
  const { port } = servidor.address();
  await new Promise((resolve, reject) => servidor.close((error) => (
    error ? reject(error) : resolve()
  )));
  return port;
}

async function esperarServidor(servidor, url, obtenerSalida) {
  const limite = Date.now() + 10000;

  while (Date.now() < limite) {
    if (servidor.exitCode !== null) {
      throw new Error(`El servidor terminó antes de iniciar: ${obtenerSalida()}`);
    }

    try {
      const respuesta = await fetch(url);
      if (respuesta.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`El servidor no inició a tiempo: ${obtenerSalida()}`);
}
