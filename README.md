# NiceProject — Sistema de Gestión y Evaluación Docente

Proyecto académico para la materia de Desarrollo Rápido de Aplicaciones.

## Descripción

Sistema web académico para administrar profesores, academias, coincidencias entre materias y evaluaciones docentes con calificaciones de 0 a 10.

## Cambios de almacenamiento

Antes el prototipo usaba `backend/db.json` como almacenamiento activo. Ahora el sistema usa SQLite como almacenamiento principal.

- `backend/db.json` sigue existiendo como respaldo, fuente de migración y datos iniciales.
- El almacenamiento activo es `backend/niceproject.db`.
- La base usa `better-sqlite3` con claves foráneas activadas.
- La recreación del contenido de la base puede hacerse ejecutando `npm run migrate`.

## Tecnologías

- HTML5
- JavaScript ES Modules
- W3CSS
- Node.js y Express
- CORS
- SQLite con `better-sqlite3`
- Git y GitHub

## Estructura del proyecto

```text
niceproject/
├── backend/
│   ├── database.js
│   ├── db.json
│   ├── migrate-json-to-sqlite.js
│   ├── niceproject.db
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   └── server.js
├── frontend/
│   ├── js/
│   │   ├── api.js
│   │   └── auth.js
│   ├── academia-detalle.html
│   ├── academia-form.html
│   ├── academias.html
│   ├── dashboard.html
│   ├── evaluacion-form.html
│   ├── evaluaciones-profesor.html
│   ├── evaluaciones.html
│   ├── login.html
│   ├── profesor-form.html
│   └── profesores.html
└── README.md
```

## Ejecución

Se requiere Node.js y npm. Desde la carpeta `backend/` ejecuta:

```bash
cd backend
npm install
npm run migrate
npm start
```

La API queda disponible en `http://localhost:3000` y el frontend debe seguir consumiendo la misma API sin cambios funcionales.

## Base de datos SQLite

La base `backend/niceproject.db` contiene estas tablas principales:

- `usuarios`: credenciales del prototipo y datos básicos del usuario administrador.
- `academias`: datos de cada academia y clave única.
- `profesores`: información del personal académico y su relación con una academia.
- `materias_profesor`: materias por profesor con nivel 0 a 10.
- `materias_academia`: materias asignadas por academia.
- `evaluaciones`: calificaciones y comentarios asociados a cada profesor.

Se usan relaciones con `FOREIGN KEY` y restricciones para mantener integridad referencial.

## Credenciales de demostración

- Usuario: `admin`
- Contraseña: `admin123`

Estas credenciales se mantienen por compatibilidad con el prototipo. La migración no aplica hashing ni seguridad avanzada, ya que el objetivo del sistema es mantener el comportamiento actual del demo.

## Equipo

- Saul Simon Gonzalez Santos
- Alessandro Farid Vazquez Cortes
- Kevin Alejandro Blanco Mendoza
- Gerson David Dzuc Chable

## Estado

Proyecto académico en desarrollo con almacenamiento SQLite activo.