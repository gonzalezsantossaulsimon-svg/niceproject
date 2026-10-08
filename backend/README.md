# API de NiceProject

Backend REST del sistema académico NiceProject, implementado con Node.js y Express. La aplicación usa SQLite como almacenamiento principal y conserva `db.json` como respaldo inicial y fuente de migración.

## Ejecución

Desde la carpeta `backend/`:

```bash
npm install
npm run migrate
npm start
```

El servidor escucha en `http://localhost:3000`. La ruta `GET /` devuelve un mensaje de estado de la API.

## Base de datos y migración

El archivo principal es `backend/niceproject.db`. Se inicializa desde `database.js` y se crea la estructura con SQL ejecutado al arrancar el backend. Este archivo no se versiona en Git: cada instalación genera su propia base. `db.json` se conserva como fuente de los datos iniciales para la migración.

La migración inicial desde el prototipo JSON se realiza con:

```bash
npm run migrate
```

Este comando lee `db.json`, importa los datos en SQLite y guarda un registro en la tabla `migrations` para que la importación sea idempotente y no duplique registros si se vuelve a ejecutar.

## Tablas principales

- `usuarios`: cuenta de acceso del prototipo.
- `academias`: academias con clave única.
- `profesores`: información de profesores con FK a academias.
- `materias_profesor`: materias propias de cada profesor y su nivel.
- `materias_academia`: materias asignadas a cada academia.
- `evaluaciones`: calificaciones y comentarios registradas para profesores.
- `horarios`: materia, día, intervalo de horas, aula, grupo y profesor.
- `migrations`: registro que hace idempotente la importación inicial desde JSON.

Se usan foreign keys y restricciones para mantener integridad y evitar datos inconsistentes.

## Rutas

### Profesores

- `GET /api/profesores`
- `GET /api/profesores/:id`
- `POST /api/profesores`
- `PUT /api/profesores/:id`
- `DELETE /api/profesores/:id`
- `GET /api/profesores/:id/coincidencias`

Las altas y actualizaciones requieren número de empleado, nombre, apellido y academia existentes. El formato del empleado debe ser `EMP` seguido de tres dígitos. Las materias se reciben como arreglo, no deben repetirse y cada nivel debe ser un entero entre 0 y 10.

### Academias

- `GET /api/academias`
- `GET /api/academias/:clave`
- `POST /api/academias`
- `PUT /api/academias/:clave`
- `DELETE /api/academias/:clave`

La clave se normaliza a mayúsculas. Para crear una academia, clave y nombre son obligatorios; la clave admite hasta 10 caracteres y no puede estar duplicada. La pertenencia de profesores se deduce desde `profesores.academiaId` y no se duplica físicamente.

### Evaluaciones

- `GET /api/evaluaciones`
- `POST /api/evaluaciones`
- `GET /api/profesores/:id/evaluaciones`
- `DELETE /api/evaluaciones/:id`

La calificación acepta decimales entre 0 y 10; el comentario se recorta y queda limitado a 500 caracteres. `fecha` se genera en el backend con `new Date().toISOString()`.

### Horarios

- `GET /api/horarios`
- `GET /api/horarios/:id`
- `POST /api/horarios`
- `PUT /api/horarios/:id`
- `DELETE /api/horarios/:id`

El frontend incluye `horarios.html` para consultar horarios y `horario-form.html` para crearlos y editarlos.

### Autenticación

- `POST /api/login`

Recibe `username` y `password`; valida contra la tabla `usuarios` y responde con los datos públicos del usuario en caso de éxito.

## Notas y compatibilidad

- El frontend sigue consumiendo la misma API sin cambios funcionales.
- `db.json` se conserva como respaldo del prototipo anterior y como fuente inicial para la migración.
- La verificación de password se mantiene sin hashing por compatibilidad con el prototipo actual, como una limitación deliberada del demo.