import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import test from 'node:test';
import { seedLegacyMaterias } from '../migrations/seed_legacy_materias.js';

const MATERIAS_ESPERADAS = {
  'Bases de Datos': { clave: 'BDD-107', academiaClave: null },
  'Desarrollo Web': { clave: 'DWE-108', academiaClave: 'ACAD04' },
  'Inteligencia Artificial': { clave: 'IAI-105', academiaClave: 'ACAD03' },
  'Matemáticas': { clave: 'MAT-104', academiaClave: null },
  'Programación': { clave: 'PRG-103', academiaClave: null },
  Redes: { clave: 'RED-101', academiaClave: null },
  'Seguridad Informática': { clave: 'SEG-106', academiaClave: 'ACAD02' },
  'Sistemas Operativos': { clave: 'SOP-102', academiaClave: 'ACAD01' }
};

function crearBasePrueba() {
  const db = new Database(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE academias (clave TEXT PRIMARY KEY);
    CREATE TABLE materias_profesor (
      id INTEGER PRIMARY KEY,
      profesorId INTEGER NOT NULL,
      nombre TEXT NOT NULL
    );
    CREATE TABLE materias_academia (
      id INTEGER PRIMARY KEY,
      academiaClave TEXT NOT NULL REFERENCES academias(clave),
      nombre TEXT NOT NULL
    );
    CREATE TABLE materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      academiaClave TEXT REFERENCES academias(clave)
    );
    CREATE UNIQUE INDEX idx_materias_nombre_unique ON materias (LOWER(nombre));
    CREATE TABLE migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    );
    INSERT INTO academias (clave) VALUES ('ACAD01'), ('ACAD02'), ('ACAD03'), ('ACAD04');
    INSERT INTO materias_profesor (profesorId, nombre) VALUES
      (1, '  Redes  '),
      (2, 'Sistemas Operativos'),
      (3, 'Programación'),
      (4, 'Matemáticas'),
      (5, 'Inteligencia Artificial'),
      (6, 'Seguridad Informática'),
      (7, 'Bases de Datos'),
      (8, 'Desarrollo Web'),
      (9, 'Programación');
    INSERT INTO materias_academia (academiaClave, nombre) VALUES
      ('ACAD01', 'Redes'),
      ('ACAD02', 'Redes'),
      ('ACAD01', 'Sistemas Operativos'),
      ('ACAD01', 'Programación'),
      ('ACAD04', 'Programación'),
      ('ACAD02', 'Matemáticas'),
      ('ACAD03', 'Matemáticas'),
      ('ACAD03', 'Inteligencia Artificial'),
      ('ACAD02', 'Seguridad Informática'),
      ('ACAD03', 'Bases de Datos'),
      ('ACAD04', 'Bases de Datos'),
      ('ACAD04', 'Desarrollo Web');
  `);
  return db;
}

test('siembra las claves normalizadas exactas y es idempotente sin alterar los orígenes', () => {
  const db = crearBasePrueba();
  try {
    const origenAntes = {
      profesores: db.prepare('SELECT * FROM materias_profesor ORDER BY id').all(),
      academias: db.prepare('SELECT * FROM materias_academia ORDER BY id').all()
    };

    const primera = seedLegacyMaterias(db);
    assert.deepEqual(primera, { aplicada: true, insertadas: 8 });

    const materias = db.prepare('SELECT clave, nombre, academiaClave FROM materias').all();
    assert.equal(materias.length, 8);
    assert.deepEqual(
      Object.fromEntries(materias.map(({ nombre, clave, academiaClave }) => (
        [nombre, { clave, academiaClave }]
      ))),
      MATERIAS_ESPERADAS
    );
    assert.equal(
      db.prepare(`
        SELECT COUNT(*) AS n FROM (
          SELECT LOWER(nombre) FROM materias GROUP BY LOWER(nombre) HAVING COUNT(*) > 1
        )
      `).get().n,
      0
    );
    assert.equal(
      db.prepare('SELECT COUNT(DISTINCT clave) AS n FROM materias').get().n,
      8
    );

    const segunda = seedLegacyMaterias(db);
    assert.deepEqual(segunda, { aplicada: false, insertadas: 0 });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM materias').get().n, 8);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM migrations WHERE nombre = ?')
      .get('seed_legacy_materias').n, 1);
    assert.deepEqual(db.prepare('SELECT * FROM materias_profesor ORDER BY id').all(), origenAntes.profesores);
    assert.deepEqual(db.prepare('SELECT * FROM materias_academia ORDER BY id').all(), origenAntes.academias);
  } finally {
    db.close();
  }
});
