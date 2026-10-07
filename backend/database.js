import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'niceproject.db');

let database;

function initializeDatabase() {
  if (database) {
    return database;
  }

  database = new Database(DB_PATH);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');

  database.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academias (
      clave TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      descripcion TEXT
    );

    CREATE TABLE IF NOT EXISTS profesores (
      id INTEGER PRIMARY KEY,
      numeroEmpleado TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      especialidad TEXT,
      licenciatura TEXT,
      maestria TEXT,
      doctorado TEXT,
      sni TEXT,
      perfilPRODEP INTEGER NOT NULL DEFAULT 0,
      academiaId TEXT NOT NULL,
      FOREIGN KEY (academiaId) REFERENCES academias(clave)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS materias_profesor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesorId INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      nivel INTEGER NOT NULL,
      FOREIGN KEY (profesorId) REFERENCES profesores(id)
        ON DELETE CASCADE,
      CHECK (nivel BETWEEN 0 AND 10)
    );

    CREATE TABLE IF NOT EXISTS materias_academia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academiaClave TEXT NOT NULL,
      nombre TEXT NOT NULL,
      FOREIGN KEY (academiaClave) REFERENCES academias(clave)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesorId INTEGER NOT NULL,
      calificacion REAL NOT NULL,
      comentario TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      FOREIGN KEY (profesorId) REFERENCES profesores(id)
        ON DELETE CASCADE,
      CHECK (calificacion >= 0 AND calificacion <= 10)
    );

    CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profesorId INTEGER NOT NULL,
      materia TEXT NOT NULL,
      dia TEXT NOT NULL,
      horaInicio TEXT NOT NULL,
      horaFin TEXT NOT NULL,
      aula TEXT NOT NULL,
      grupo TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (profesorId) REFERENCES profesores(id)
        ON DELETE CASCADE,
      CHECK (dia IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'))
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_profesor_unique
      ON materias_profesor (profesorId, LOWER(nombre));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_academia_unique
      ON materias_academia (academiaClave, LOWER(nombre));
  `);

  return database;
}

export function getDatabase() {
  return initializeDatabase();
}

export default getDatabase;
