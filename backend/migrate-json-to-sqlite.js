import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import getDatabase from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'niceproject.db');
const SOURCE_PATH = path.join(__dirname, 'db.json');
const MIGRATION_NAME = 'initial_json_import';

function parseBoolean(value) {
  return value ? 1 : 0;
}

async function runMigration() {
  const db = getDatabase();
  const alreadyExecuted = db
    .prepare('SELECT 1 FROM migrations WHERE nombre = ?')
    .get(MIGRATION_NAME);

  if (alreadyExecuted) {
    console.log(`La migración '${MIGRATION_NAME}' ya fue ejecutada. No es necesario repetirla.`);
    return;
  }

  const raw = await readFile(SOURCE_PATH, 'utf-8');
  const data = JSON.parse(raw);

  const transaction = db.transaction(() => {
    const insertUsuario = db.prepare(
      'INSERT INTO usuarios (id, username, password, nombre) VALUES (?, ?, ?, ?)'
    );

    for (const usuario of data.usuarios || []) {
      insertUsuario.run(
        usuario.id,
        usuario.username,
        usuario.password,
        usuario.nombre || ''
      );
    }

    const insertAcademia = db.prepare(
      'INSERT INTO academias (clave, nombre, descripcion) VALUES (?, ?, ?)'
    );

    for (const academia of data.academias || []) {
      insertAcademia.run(
        academia.clave,
        academia.nombre,
        academia.descripcion || ''
      );

      const insertMateriaAcademia = db.prepare(
        'INSERT INTO materias_academia (academiaClave, nombre) VALUES (?, ?)'
      );

      for (const materia of academia.materiasAsignadas || []) {
        insertMateriaAcademia.run(academia.clave, materia);
      }
    }

    const insertProfesor = db.prepare(
      `INSERT INTO profesores (
        id,
        numeroEmpleado,
        nombre,
        apellido,
        especialidad,
        licenciatura,
        maestria,
        doctorado,
        sni,
        perfilPRODEP,
        academiaId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMateriaProfesor = db.prepare(
      'INSERT INTO materias_profesor (profesorId, nombre, nivel) VALUES (?, ?, ?)'
    );

    for (const profesor of data.profesores || []) {
      insertProfesor.run(
        profesor.id,
        profesor.numeroEmpleado,
        profesor.nombre,
        profesor.apellido,
        profesor.especialidad || '',
        profesor.licenciatura || '',
        profesor.maestria || '',
        profesor.doctorado || '',
        profesor.sni || 'Ninguno',
        parseBoolean(profesor.perfilPRODEP),
        profesor.academiaId
      );

      for (const materia of profesor.materias || []) {
        insertMateriaProfesor.run(profesor.id, materia.nombre, Number(materia.nivel));
      }
    }

    const insertEvaluacion = db.prepare(
      'INSERT INTO evaluaciones (id, profesorId, calificacion, comentario, fecha) VALUES (?, ?, ?, ?, ?)'
    );

    for (const evaluacion of data.evaluaciones || []) {
      insertEvaluacion.run(
        evaluacion.id,
        evaluacion.profesorId,
        Number(evaluacion.calificacion),
        evaluacion.comentario || '',
        evaluacion.fecha || new Date().toISOString()
      );
    }

    db.prepare(
      "INSERT INTO migrations (nombre, executed_at) VALUES (?, datetime('now'))"
    ).run(MIGRATION_NAME);
  });

  transaction();

  console.log(`Migración completada: '${MIGRATION_NAME}'.`);
  console.log(`Base SQLite creada en: ${DB_PATH}`);
}

runMigration().catch((error) => {
  console.error('Error al migrar db.json a SQLite:', error);
  process.exitCode = 1;
});
