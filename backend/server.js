import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ---------- UTILIDADES ----------
async function leerDB() {
  const data = await readFile(DB_PATH, 'utf-8');
  return JSON.parse(data);
}

async function escribirDB(data) {
  await writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- VALIDACIONES ----------
function validarProfesor(profesor, db, idActual = null) {
  if (
    !profesor.numeroEmpleado ||
    !profesor.nombre ||
    !profesor.apellido ||
    !profesor.academiaId
  ) {
    return 'Número de empleado, nombre, apellido y academia son obligatorios';
  }

  const formatoEmpleado = /^EMP\d{3}$/;

  if (!formatoEmpleado.test(profesor.numeroEmpleado)) {
    return 'El número de empleado debe tener el formato EMP seguido de 3 números, por ejemplo EMP001';
  }

  const empleadoDuplicado = db.profesores.some(
    p =>
      p.numeroEmpleado === profesor.numeroEmpleado &&
      p.id !== idActual
  );

  if (empleadoDuplicado) {
    return 'Ya existe un profesor con ese número de empleado';
  }

  const academiaExiste = db.academias.some(
    a => a.clave === profesor.academiaId
  );

  if (!academiaExiste) {
    return 'La academia seleccionada no existe';
  }

  if (!Array.isArray(profesor.materias)) {
    return 'Las materias deben enviarse como una lista';
  }

  const nombresMaterias = new Set();

  for (const materia of profesor.materias) {
    if (!materia.nombre || materia.nombre.trim() === '') {
      return 'Todas las materias deben tener nombre';
    }

    if (
      !Number.isInteger(materia.nivel) ||
      materia.nivel < 0 ||
      materia.nivel > 10
    ) {
      return 'El nivel de dominio de cada materia debe ser un número entero entre 0 y 10';
    }

    const nombreNormalizado = materia.nombre.trim().toLowerCase();

    if (nombresMaterias.has(nombreNormalizado)) {
      return 'No se puede repetir la misma materia para un profesor';
    }

    nombresMaterias.add(nombreNormalizado);
  }

  return null;
}

function normalizarProfesor(profesor) {
  return {
    ...profesor,
    numeroEmpleado: profesor.numeroEmpleado?.trim().toUpperCase(),
    nombre: profesor.nombre?.trim(),
    apellido: profesor.apellido?.trim(),
    especialidad: profesor.especialidad?.trim() || '',
    licenciatura: profesor.licenciatura?.trim() || '',
    maestria: profesor.maestria?.trim() || '',
    doctorado: profesor.doctorado?.trim() || '',
    sni: profesor.sni || 'Ninguno',
    perfilPRODEP: Boolean(profesor.perfilPRODEP),
    academiaId: profesor.academiaId?.trim(),
    materias: Array.isArray(profesor.materias)
      ? profesor.materias.map(m => ({
          nombre: m.nombre?.trim(),
          nivel: Number(m.nivel)
        }))
      : []
  };
}

// ---------- RAIZ ----------
app.get('/', (req, res) => {
  res.send('API Profesores funcionando ✅');
});

// =========================================
// PROFESORES
// =========================================

// GET - lista resumida
app.get('/api/profesores', async (req, res) => {
  try {
    const db = await leerDB();

    const resumen = db.profesores.map(p => ({
      id: p.id,
      numeroEmpleado: p.numeroEmpleado,
      nombre: p.nombre,
      apellido: p.apellido,
      especialidad: p.especialidad,
      ultimoGrado: p.doctorado
        ? 'Doctorado'
        : p.maestria
          ? 'Maestría'
          : 'Licenciatura',
      academiaId: p.academiaId,
      materias: p.materias
    }));

    res.json(resumen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

// GET - uno por id
app.get('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const profe = db.profesores.find(p => p.id === id);

    if (!profe) {
      return res.status(404).json({ error: 'Profesor no encontrado' });
    }

    res.json(profe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

// POST - crear profesor
app.post('/api/profesores', async (req, res) => {
  try {
    const db = await leerDB();

    const nuevo = normalizarProfesor(req.body);

    const errorValidacion = validarProfesor(nuevo, db);

    if (errorValidacion) {
      return res.status(400).json({
        error: errorValidacion
      });
    }

    const maxId = db.profesores.reduce(
      (maximo, profesor) => Math.max(maximo, profesor.id || 0),
      0
    );

    nuevo.id = maxId + 1;

    db.profesores.push(nuevo);

    // Agregar profesor a integrantes de su academia
    const academia = db.academias.find(
      a => a.clave === nuevo.academiaId
    );

    if (academia && !academia.integrantes.includes(nuevo.id)) {
      academia.integrantes.push(nuevo.id);
    }

    await escribirDB(db);

    res.status(201).json(nuevo);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al crear el profesor'
    });
  }
});

// PUT - actualizar profesor
app.put('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'ID inválido'
      });
    }

    const idx = db.profesores.findIndex(
      p => p.id === id
    );

    if (idx === -1) {
      return res.status(404).json({
        error: 'Profesor no encontrado'
      });
    }

    const profesorAnterior = db.profesores[idx];

    const actualizado = normalizarProfesor({
      ...profesorAnterior,
      ...req.body,
      id
    });

    actualizado.id = id;

    const errorValidacion = validarProfesor(
      actualizado,
      db,
      id
    );

    if (errorValidacion) {
      return res.status(400).json({
        error: errorValidacion
      });
    }

    // Si cambió de academia, actualizar integrantes
    if (profesorAnterior.academiaId !== actualizado.academiaId) {
      const academiaAnterior = db.academias.find(
        a => a.clave === profesorAnterior.academiaId
      );

      if (academiaAnterior) {
        academiaAnterior.integrantes =
          academiaAnterior.integrantes.filter(
            integranteId => integranteId !== id
          );
      }

      const nuevaAcademia = db.academias.find(
        a => a.clave === actualizado.academiaId
      );

      if (
        nuevaAcademia &&
        !nuevaAcademia.integrantes.includes(id)
      ) {
        nuevaAcademia.integrantes.push(id);
      }
    }

    db.profesores[idx] = actualizado;

    await escribirDB(db);

    res.json(actualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al actualizar el profesor'
    });
  }
});

// DELETE - eliminar profesor
app.delete('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'ID inválido'
      });
    }

    const idx = db.profesores.findIndex(
      p => p.id === id
    );

    if (idx === -1) {
      return res.status(404).json({
        error: 'Profesor no encontrado'
      });
    }

    const eliminado = db.profesores.splice(idx, 1)[0];

    db.academias.forEach(a => {
      a.integrantes = a.integrantes.filter(
        integranteId => integranteId !== id
      );
    });

    await escribirDB(db);

    res.json({
      mensaje: 'Profesor eliminado correctamente',
      profesor: eliminado
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al eliminar el profesor'
    });
  }
});

// =========================================
// ACADEMIAS
// =========================================

app.get('/api/academias', async (req, res) => {
  try {
    const db = await leerDB();
    res.json(db.academias);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al leer los datos'
    });
  }
});

app.get('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();

    const clave = req.params.clave.trim().toUpperCase();

    const acad = db.academias.find(
      a => a.clave === clave
    );

    if (!acad) {
      return res.status(404).json({
        error: 'Academia no encontrada'
      });
    }

    const integrantes = db.profesores.filter(
      p => acad.integrantes.includes(p.id)
    );

    res.json({
      ...acad,
      integrantesData: integrantes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al leer los datos'
    });
  }
});

// POST - crear academia
app.post('/api/academias', async (req, res) => {
  try {
    const db = await leerDB();

    const nueva = {
      ...req.body,
      clave: req.body.clave?.trim().toUpperCase(),
      nombre: req.body.nombre?.trim()
    };

    if (!nueva.clave || !nueva.nombre) {
      return res.status(400).json({
        error: 'Clave y nombre son obligatorios'
      });
    }

    if (nueva.clave.length > 10) {
      return res.status(400).json({
        error: 'La clave debe tener máximo 10 caracteres'
      });
    }

    if (
      db.academias.some(
        a => a.clave === nueva.clave
      )
    ) {
      return res.status(400).json({
        error: 'Ya existe una academia con esa clave'
      });
    }

    if (!Array.isArray(nueva.integrantes)) {
      nueva.integrantes = [];
    }

    if (!Array.isArray(nueva.materiasAsignadas)) {
      nueva.materiasAsignadas = [];
    }

    db.academias.push(nueva);

    await escribirDB(db);

    res.status(201).json(nueva);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al crear la academia'
    });
  }
});

// PUT - actualizar academia
app.put('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();

    const clave = req.params.clave
      .trim()
      .toUpperCase();

    const idx = db.academias.findIndex(
      a => a.clave === clave
    );

    if (idx === -1) {
      return res.status(404).json({
        error: 'Academia no encontrada'
      });
    }

    const actualizada = {
      ...db.academias[idx],
      ...req.body,
      clave
    };

    if (
      !actualizada.nombre ||
      actualizada.nombre.trim() === ''
    ) {
      return res.status(400).json({
        error: 'El nombre de la academia es obligatorio'
      });
    }

    if (actualizada.clave.length > 10) {
      return res.status(400).json({
        error: 'La clave debe tener máximo 10 caracteres'
      });
    }

    if (!Array.isArray(actualizada.integrantes)) {
      actualizada.integrantes = [];
    }

    if (!Array.isArray(actualizada.materiasAsignadas)) {
      actualizada.materiasAsignadas = [];
    }

    db.academias[idx] = actualizada;

    await escribirDB(db);

    res.json(actualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al actualizar la academia'
    });
  }
});

// DELETE - eliminar academia
app.delete('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();

    const clave = req.params.clave
      .trim()
      .toUpperCase();

    const idx = db.academias.findIndex(
      a => a.clave === clave
    );

    if (idx === -1) {
      return res.status(404).json({
        error: 'Academia no encontrada'
      });
    }

    const tieneProfesores = db.profesores.some(
      p => p.academiaId === clave
    );

    if (tieneProfesores) {
      return res.status(400).json({
        error: 'No se puede eliminar una academia que tiene profesores asignados'
      });
    }

    const eliminada = db.academias.splice(idx, 1)[0];

    await escribirDB(db);

    res.json({
      mensaje: 'Academia eliminada correctamente',
      academia: eliminada
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al eliminar la academia'
    });
  }
});

// =========================================
// REGLA DE NEGOCIO: coincidencia de materias
// =========================================

app.get('/api/profesores/:id/coincidencias', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: 'ID inválido'
      });
    }

    const profe = db.profesores.find(
      p => p.id === id
    );

    if (!profe) {
      return res.status(404).json({
        error: 'Profesor no encontrado'
      });
    }

    const academia = db.academias.find(
      a => a.clave === profe.academiaId
    );

    if (!academia) {
      return res.status(404).json({
        error: 'El profesor no tiene una academia válida'
      });
    }

    const materiasProfe = profe.materias.map(
      m => m.nombre.toLowerCase()
    );

    const coincidencias =
      academia.materiasAsignadas.filter(
        materia =>
          materiasProfe.includes(
            materia.toLowerCase()
          )
      );

    res.json({
      profesor: `${profe.nombre} ${profe.apellido}`,
      academia: academia.nombre,
      coincidencias,
      total: coincidencias.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al calcular coincidencias'
    });
  }
});

// =========================================
// LOGIN
// =========================================

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Usuario y contraseña son obligatorios'
      });
    }

    const db = await leerDB();

    const user = db.usuarios.find(
      u =>
        u.username === username &&
        u.password === password
    );

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error al iniciar sesión'
    });
  }
});

// ---------- ARRANCAR ----------
app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});
