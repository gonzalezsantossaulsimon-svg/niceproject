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
      ultimoGrado: p.doctorado ? 'Doctorado'
                 : p.maestria ? 'Maestría'
                 : 'Licenciatura',
      academiaId: p.academiaId,
      materias: p.materias
    }));
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

// GET - uno por id
app.get('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const profe = db.profesores.find(p => p.id === Number(req.params.id));
    if (!profe) return res.status(404).json({ error: 'Profesor no encontrado' });
    res.json(profe);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

// POST - crear
app.post('/api/profesores', async (req, res) => {
  try {
    const db = await leerDB();
    const nuevo = req.body;

    // Validación mínima
    if (!nuevo.nombre || !nuevo.numeroEmpleado) {
      return res.status(400).json({ error: 'nombre y numeroEmpleado son obligatorios' });
    }

    // Validación: no repetir numeroEmpleado
    if (db.profesores.some(p => p.numeroEmpleado === nuevo.numeroEmpleado)) {
      return res.status(400).json({ error: 'Ya existe un profesor con ese numeroEmpleado' });
    }

    // Autogenerar id
    const maxId = db.profesores.reduce((m, p) => Math.max(m, p.id), 0);
    nuevo.id = maxId + 1;

    // Asegurar array materias
    if (!Array.isArray(nuevo.materias)) nuevo.materias = [];

    db.profesores.push(nuevo);
    await escribirDB(db);

    res.status(201).json(nuevo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el profesor' });
  }
});

// PUT - actualizar
app.put('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);
    const idx = db.profesores.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Profesor no encontrado' });

    // Mantener el id
    const actualizado = { ...db.profesores[idx], ...req.body, id };

    // Validar numeroEmpleado no choque con otro
    if (db.profesores.some((p, i) => i !== idx && p.numeroEmpleado === actualizado.numeroEmpleado)) {
      return res.status(400).json({ error: 'numeroEmpleado ya está en uso' });
    }

    db.profesores[idx] = actualizado;
    await escribirDB(db);

    res.json(actualizado);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el profesor' });
  }
});

// DELETE - eliminar
app.delete('/api/profesores/:id', async (req, res) => {
  try {
    const db = await leerDB();
    const id = Number(req.params.id);
    const idx = db.profesores.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Profesor no encontrado' });

    const eliminado = db.profesores.splice(idx, 1)[0];

    // También quitar de integrantes de su academia
    db.academias.forEach(a => {
      a.integrantes = a.integrantes.filter(i => i !== id);
    });

    await escribirDB(db);
    res.json({ mensaje: 'Profesor eliminado', profesor: eliminado });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el profesor' });
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
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

app.get('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();
    const acad = db.academias.find(a => a.clave === req.params.clave);
    if (!acad) return res.status(404).json({ error: 'Academia no encontrada' });

    // Ampliamos con los datos de los integrantes
    const integrantes = db.profesores.filter(p => acad.integrantes.includes(p.id));

    res.json({ ...acad, integrantesData: integrantes });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer los datos' });
  }
});

// POST - crear academia
app.post('/api/academias', async (req, res) => {
  try {
    const db = await leerDB();
    const nueva = req.body;

    if (!nueva.clave || !nueva.nombre) {
      return res.status(400).json({ error: 'clave y nombre son obligatorios' });
    }
    if (nueva.clave.length > 10) {
      return res.status(400).json({ error: 'La clave debe tener máximo 10 caracteres' });
    }
    if (db.academias.some(a => a.clave === nueva.clave)) {
      return res.status(400).json({ error: 'Ya existe una academia con esa clave' });
    }

    if (!Array.isArray(nueva.integrantes)) nueva.integrantes = [];
    if (!Array.isArray(nueva.materiasAsignadas)) nueva.materiasAsignadas = [];

    db.academias.push(nueva);
    await escribirDB(db);
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la academia' });
  }
});

// PUT - actualizar academia
app.put('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();
    const clave = req.params.clave;
    const idx = db.academias.findIndex(a => a.clave === clave);
    if (idx === -1) return res.status(404).json({ error: 'Academia no encontrada' });

    const actualizada = { ...db.academias[idx], ...req.body, clave };

    if (actualizada.clave.length > 10) {
      return res.status(400).json({ error: 'La clave debe tener máximo 10 caracteres' });
    }

    db.academias[idx] = actualizada;
    await escribirDB(db);
    res.json(actualizada);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar la academia' });
  }
});

// DELETE - eliminar academia
app.delete('/api/academias/:clave', async (req, res) => {
  try {
    const db = await leerDB();
    const clave = req.params.clave;
    const idx = db.academias.findIndex(a => a.clave === clave);
    if (idx === -1) return res.status(404).json({ error: 'Academia no encontrada' });

    const eliminada = db.academias.splice(idx, 1)[0];
    await escribirDB(db);
    res.json({ mensaje: 'Academia eliminada', academia: eliminada });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar la academia' });
  }
});

// =========================================
// REGLA DE NEGOCIO: coincidencia de materias
// =========================================

// Devuelve las materias en las que un profe coincide con su academia
app.get('/api/profesores/:id/coincidencias', async (req, res) => {
  try {
    const db = await leerDB();
    const profe = db.profesores.find(p => p.id === Number(req.params.id));
    if (!profe) return res.status(404).json({ error: 'Profesor no encontrado' });

    const academia = db.academias.find(a => a.clave === profe.academiaId);
    if (!academia) return res.status(404).json({ error: 'El profesor no tiene academia válida' });

    const materiasProfe = profe.materias.map(m => m.nombre);
    const coincidencias = academia.materiasAsignadas.filter(m =>
      materiasProfe.includes(m)
    );

    res.json({
      profesor: profe.nombre + ' ' + profe.apellido,
      academia: academia.nombre,
      coincidencias,
      total: coincidencias.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al calcular coincidencias' });
  }
});

// =========================================
// LOGIN
// =========================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await leerDB();
  const user = db.usuarios.find(
    u => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ id: user.id, username: user.username, nombre: user.nombre });
});

// ---------- ARRANCAR ----------
app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});