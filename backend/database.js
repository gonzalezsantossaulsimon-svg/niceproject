import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.NICEPROJECT_DB_PATH || path.join(__dirname, 'niceproject.db');

let database;

export function createDatabase(databasePath = DB_PATH) {
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      academiaClave TEXT,
      FOREIGN KEY (academiaClave) REFERENCES academias(clave)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS salones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      capacidad INTEGER NOT NULL CHECK (capacidad > 0)
    );

    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      cantidadAlumnos INTEGER NOT NULL CHECK (cantidadAlumnos > 0)
    );

    CREATE TABLE IF NOT EXISTS franjas_horarias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dia TEXT NOT NULL
        CHECK (dia IN ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado')),
      horaInicio TEXT NOT NULL,
      horaFin TEXT NOT NULL,
      UNIQUE (dia, horaInicio, horaFin)
    );

    CREATE TABLE IF NOT EXISTS cursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materiaId INTEGER NOT NULL,
      profesorId INTEGER NOT NULL,
      grupoId INTEGER NOT NULL,
      salonId INTEGER NOT NULL,
      FOREIGN KEY (materiaId) REFERENCES materias(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (profesorId) REFERENCES profesores(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (grupoId) REFERENCES grupos(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      FOREIGN KEY (salonId) REFERENCES salones(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS curso_horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cursoId INTEGER NOT NULL,
      horarioId INTEGER NOT NULL,
      FOREIGN KEY (cursoId) REFERENCES cursos(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (horarioId) REFERENCES franjas_horarias(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
      UNIQUE (cursoId, horarioId)
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_nombre_unique
      ON materias (LOWER(nombre));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_salones_nombre_unique
      ON salones (LOWER(nombre));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_profesor_unique
      ON materias_profesor (profesorId, LOWER(nombre));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_materias_academia_unique
      ON materias_academia (academiaClave, LOWER(nombre));
  `);

  return db;
}

export function getDatabase() {
  if (!database) {
    database = createDatabase();
  }

  return database;
}

export default getDatabase;
