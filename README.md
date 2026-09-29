# NiceProject — Sistema de Gestión y Evaluación Docente

Proyecto académico para la materia de Desarrollo Rápido de Aplicaciones.

## Descripción

Sistema web académico para administrar profesores y academias, consultar coincidencias entre materias y academias, y registrar evaluaciones docentes con calificaciones de 0 a 10.

## Funcionalidades actuales

- Inicio de sesión de demostración.
- Dashboard con estadísticas reales de profesores, academias, coincidencias y evaluaciones.
- Gestión de profesores: crear, editar, consultar y eliminar.
- Búsqueda de profesores, filtro por academia y ordenamiento.
- Gestión de academias: crear, editar, consultar y eliminar.
- Consulta de coincidencias entre las materias de cada profesor y su academia.
- Evaluaciones docentes con calificaciones de 0 a 10 y comentarios opcionales.
- Consulta del promedio de evaluación por profesor y listado general de evaluaciones.
- Validaciones en el frontend y backend para los datos principales.

## Tecnologías

- HTML5.
- JavaScript ES Modules.
- W3CSS.
- Node.js y Express.
- CORS.
- JSON como almacenamiento del prototipo (`backend/db.json`).
- Git y GitHub para control de versiones.

## Estructura del proyecto

```text
niceproject/
├── backend/
│   ├── db.json
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

Se requiere Node.js y npm. Desde la raíz del proyecto, entra al backend, instala las dependencias e inicia el servidor:

```bash
cd backend
npm install
npm start
```

La API queda disponible en `http://localhost:3000`. Mantén el servidor activo y abre `frontend/` mediante Live Server desde Visual Studio Code.

## Credenciales de demostración

- Usuario: `admin`
- Contraseña: `admin123`

Son credenciales únicamente para el prototipo académico. No deben utilizarse como mecanismo de autenticación para un sistema de producción.

## Equipo

- Saul Simon Gonzalez Santos — líder.
- Alessandro Farid Vazquez Cortes.
- Kevin Alejandro Blanco Mendoza.
- Gerson David Dzuc Chable.

## Estado

Proyecto académico en desarrollo.