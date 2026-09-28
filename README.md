# NiceProject — Sistema de Gestión de Profesores y Academias

Proyecto desarrollado para la materia de **Desarrollo Rápido de Aplicaciones**.

## 📌 Descripción

NiceProject es un sistema universitario orientado a la gestión de información de profesores y academias.

El sistema permite administrar datos académicos y profesionales de los docentes, así como consultar la relación entre profesores, materias y academias.

Actualmente el proyecto cuenta con una interfaz web y un backend desarrollado con Node.js y Express.

## 🎯 Objetivo

Desarrollar una aplicación que permita gestionar de forma organizada la información de los profesores de una facultad, incluyendo datos como:

- Número de empleado.
- Nombre completo.
- Especialidad.
- Licenciatura.
- Maestría.
- Doctorado.
- Academia.
- Materias impartidas.
- Información académica adicional.

El proyecto también servirá como base para incorporar nuevas funcionalidades durante el desarrollo de la materia.

## 🛠️ Tecnologías utilizadas

- **Backend:** Node.js + Express.
- **Frontend:** HTML + W3.CSS + JavaScript.
- **Datos:** archivo `db.json`.
- **Autenticación:** inicio de sesión simple con `localStorage`.
- **Control de versiones:** Git.
- **Repositorio:** GitHub.
- **Entorno de desarrollo:** Visual Studio Code.

## 📂 Estructura del proyecto

```text
niceproject/
├── backend/
│   ├── db.json
│   ├── package-lock.json
│   ├── package.json
│   ├── README.md
│   └── server.js
│
├── frontend/
│   ├── js/
│   ├── academia-detalle.html
│   ├── academias.html
│   ├── dashboard.html
│   ├── login.html
│   ├── profesor-form.html
│   └── profesores.html
│
├── .gitignore
└── README.md
```

## ✅ Funcionalidades actuales

- Inicio de sesión.
- Consulta de profesores.
- Registro de profesores.
- Edición de información de profesores.
- Consulta de academias.
- Consulta del detalle de una academia.
- Asociación de profesores con materias.
- Comunicación entre frontend y backend mediante API.
- Almacenamiento temporal de datos en `db.json`.

## 👥 Integrantes del equipo

1. Saul Simon Gonzalez Santos
2. Alessandro Farid Vazquez Cortes
3. Kevin Alejandro Blanco Mendoza
4. Gerson David Dzuc Chable

## ▶️ Ejecución del proyecto

Primero se debe entrar a la carpeta del backend:

```bash
cd backend
```

Después instalar las dependencias:

```bash
npm install
```

Para iniciar el servidor:

```bash
npm start
```

El backend se ejecutará en:

```text
http://localhost:3000
```

El frontend puede ejecutarse utilizando **Live Server** desde Visual Studio Code.

## 🌐 Control de versiones

El proyecto utiliza Git y GitHub para el control de versiones y trabajo colaborativo.

Flujo básico de trabajo:

```bash
git pull
git status
git add .
git commit -m "Descripcion del cambio"
git push
```

## 📚 Estado del proyecto

El proyecto se encuentra actualmente en desarrollo.

Durante las siguientes etapas se podrán agregar nuevas funcionalidades, validaciones, mejoras en la interfaz y nuevas reglas del negocio.