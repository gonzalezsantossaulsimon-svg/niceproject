# API de NiceProject

Backend REST del sistema académico NiceProject, implementado con Node.js y Express. Los datos del prototipo se leen y guardan en `db.json`. El servidor habilita CORS y recibe cuerpos JSON.

## Ejecución

Desde la carpeta `backend/`:

```bash
npm install
npm start
```

El servidor escucha en `http://localhost:3000`. La ruta `GET /` devuelve un mensaje de estado de la API.

## Rutas

### Profesores

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/profesores` | Lista un resumen de profesores, incluido su último grado, academia y materias. |
| `GET /api/profesores/:id` | Devuelve el registro completo del profesor. |
| `POST /api/profesores` | Crea un profesor y asigna el siguiente ID disponible. |
| `PUT /api/profesores/:id` | Actualiza un profesor existente y sincroniza su pertenencia a academias si cambia de academia. |
| `DELETE /api/profesores/:id` | Elimina el profesor y lo retira de las listas de integrantes de academias. |
| `GET /api/profesores/:id/coincidencias` | Devuelve las materias compartidas por el profesor y su academia. |

Las altas y actualizaciones requieren número de empleado, nombre, apellido y academia existentes. El número debe seguir el formato `EMP` más tres dígitos y ser único. Las materias se reciben como arreglo, no deben repetirse y cada nivel debe ser un entero de 0 a 10. Los IDs no enteros producen `400`; los profesores inexistentes producen `404`.

### Academias

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/academias` | Lista las academias. |
| `GET /api/academias/:clave` | Devuelve una academia e incluye los datos de sus integrantes. |
| `POST /api/academias` | Crea una academia. |
| `PUT /api/academias/:clave` | Actualiza una academia existente. |
| `DELETE /api/academias/:clave` | Elimina una academia si no tiene profesores asignados. |

La clave se normaliza a mayúsculas. Para crear una academia, clave y nombre son obligatorios, la clave admite hasta 10 caracteres y no puede estar duplicada. En las altas y actualizaciones, `integrantes` y `materiasAsignadas` se mantienen como arreglos. No se permite eliminar una academia con profesores asignados (`400`); una clave inexistente devuelve `404`.

### Evaluaciones

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/evaluaciones` | Devuelve todas las evaluaciones registradas. |
| `POST /api/evaluaciones` | Registra una evaluación y responde `201` con el registro creado. |
| `GET /api/profesores/:id/evaluaciones` | Devuelve el profesor, sus evaluaciones, el total y el promedio. Sin evaluaciones, el promedio es `null`; de lo contrario se redondea a dos decimales como máximo. |
| `DELETE /api/evaluaciones/:id` | Elimina una evaluación existente. |

Para registrar una evaluación, `profesorId` debe ser un entero positivo correspondiente a un profesor existente. `calificacion` debe ser numérica y estar entre 0 y 10; se aceptan decimales. `comentario` es opcional, se recorta con `trim()` y puede tener hasta 500 caracteres. El ID se genera como el ID máximo existente más uno y `fecha` se genera en el backend en formato ISO. Los IDs inválidos producen `400`; recursos inexistentes producen `404`.

### Autenticación

| Método y ruta | Descripción |
| --- | --- |
| `POST /api/login` | Recibe `username` y `password` y devuelve los datos públicos de la cuenta si coinciden con un usuario de `db.json`. |

Ambos campos son obligatorios (`400`); las credenciales no válidas responden `401`. El inicio de sesión del prototipo utiliza las cuentas y contraseñas almacenadas en el JSON; no es una solución de autenticación de producción.

## Respuestas de error

Las rutas responden con JSON y un campo `error` cuando ocurre un error de validación, el recurso no existe o falla una operación del servidor. Los errores inesperados se registran en el servidor y responden con estado `500`.