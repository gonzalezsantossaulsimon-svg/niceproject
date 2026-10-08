# NiceProject — Sistema de Gestión y Evaluación Docente

Proyecto académico para la materia de Desarrollo Rápido de Aplicaciones.

## Descripción

Sistema web académico para gestionar profesores, academias y materias, consultar coincidencias entre materias, registrar evaluaciones docentes con calificaciones de 0 a 10 y administrar horarios. Incluye un dashboard para consultar la información del sistema.

## Tecnologías y componentes

- Backend: Node.js y Express.
- Base de datos: SQLite mediante `better-sqlite3`, con claves foráneas activadas.
- Frontend: HTML, JavaScript y W3CSS.
- `frontend-server.js` sirve los archivos del frontend en `http://localhost:5500`.
- `backend/database.js` inicializa el esquema de SQLite.
- `backend/migrate-json-to-sqlite.js` importa los datos iniciales de JSON a SQLite.
- `INICIAR_NICEPROJECT.bat` instala dependencias si hacen falta, ejecuta la migración y arranca backend y frontend.

## Estructura del proyecto

```text
niceproject/
├── INICIAR_NICEPROJECT.bat
├── frontend-server.js
├── backend/
│   ├── database.js
│   ├── db.json
│   ├── migrate-json-to-sqlite.js
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   └── server.js
├── frontend/
│   ├── js/
│   │   ├── api.js
│   │   └── auth.js
│   ├── horarios.html
│   ├── horario-form.html
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

## Almacenamiento e instalación

`backend/niceproject.db` **no se versiona en Git**. Cada instalación genera su propia base SQLite al ejecutarse la migración inicial. El archivo `backend/db.json` se conserva en el repositorio como fuente de los datos iniciales para esa migración; no es el almacenamiento activo.

Para iniciar fácilmente el proyecto en Windows, ejecuta `INICIAR_NICEPROJECT.bat` desde la raíz del repositorio. El archivo instala las dependencias del backend si no están instaladas, ejecuta `npm run migrate` desde `backend/` y, si todo termina correctamente, arranca backend y frontend y abre el navegador. La migración es idempotente, por lo que el iniciador puede ejecutarse cada vez sin borrar la base de datos existente.

## Ejecución

Se requiere Node.js y npm. Como alternativa al iniciador, desde la carpeta `backend/` ejecuta:

```bash
cd backend
npm install
npm run migrate
npm start
```

La API queda disponible en `http://localhost:3000` y `frontend-server.js` sirve el frontend en `http://localhost:5500/login.html`.

## Base de datos SQLite

El esquema SQLite contiene las siguientes tablas:

- `usuarios`: credenciales y datos básicos de acceso.
- `academias`: datos de cada academia y clave única.
- `profesores`: información del personal académico y su relación con una academia.
- `materias_profesor`: materias por profesor con nivel de 0 a 10.
- `materias_academia`: materias asignadas por academia.
- `evaluaciones`: calificaciones y comentarios asociados a cada profesor.
- `horarios`: materia, día, horas, aula, grupo y profesor.
- `migrations`: registro de migraciones ejecutadas para evitar importar dos veces los datos iniciales.

Se usan relaciones con `FOREIGN KEY` y restricciones para mantener integridad referencial.

## Funcionalidades

- Gestión de profesores y academias.
- Consulta de coincidencias entre las materias de profesores y las asignadas a sus academias.
- Registro y consulta de evaluaciones.
- Administración de horarios desde `horarios.html` y `horario-form.html`.
- Dashboard de resumen del sistema.

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