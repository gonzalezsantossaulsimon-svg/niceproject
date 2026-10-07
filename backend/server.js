import express from 'express';
import cors from 'cors';
import getDatabase from './database.js';

const app = express();
const PORT = 3000;
const db = getDatabase();

app.use(cors());
app.use(express.json());

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAcademiaClave(value) {
  return normalizeText(value).toUpperCase();
}

function getUltimoGrado(doctorado, maestria) {
  if (doctorado && normalizeText(doctorado) !== '') {
    return 'Doctorado';
  }

  if (maestria && normalizeText(maestria) !== '') {
    return 'Maestría';
  }

  return 'Licenciatura';
}

function buildProfesorPayload(row) {
  const materias = db
    .prepare('SELECT nombre, nivel FROM materias_profesor WHERE profesorId = ? ORDER BY id')
    .all(row.id);

  return {
    ...row,
    perfilPRODEP: Boolean(row.perfilPRODEP),
    materias,
    ultimoGrado: getUltimoGrado(row.doctorado, row.maestria)
  };
}

function buildAcademiaPayload(row) {
  const integrantes = db
    .prepare('SELECT id FROM profesores WHERE academiaId = ? ORDER BY id')
    .pluck()
    .all(row.clave);

  const materiasAsignadas = db
    .prepare('SELECT nombre FROM materias_academia WHERE academiaClave = ? ORDER BY id')
    .pluck()
    .all(row.clave);

  return {
    clave: row.clave,
    nombre: row.nombre,
    descripcion: row.descripcion || '',
    integrantes,
    materiasAsignadas
  };
}

function normalizeProfesorInput(input = {}) {
  return {
    numeroEmpleado: normalizeText(input.numeroEmpleado).toUpperCase(),
    nombre: normalizeText(input.nombre),
    apellido: normalizeText(input.apellido),
    especialidad: normalizeText(input.especialidad),
    licenciatura: normalizeText(input.licenciatura),
    maestria: normalizeText(input.maestria),
    doctorado: normalizeText(input.doctorado),
    sni: normalizeText(input.sni) || 'Ninguno',
    perfilPRODEP: Boolean(input.perfilPRODEP),
    academiaId: normalizeAcademiaClave(input.academiaId),
    materias: Array.isArray(input.materias)
      ? input.materias.map((materia) => ({
          nombre: normalizeText(materia?.nombre),
          nivel: Number(materia?.nivel)
        }))
      : []
  };
}

function validarProfesor(profesor, idActual = null) {
  if (!profesor.numeroEmpleado || !profesor.nombre || !profesor.apellido || !profesor.academiaId) {
    return 'Número de empleado, nombre, apellido y academia son obligatorios';
  }

  if (!/^EMP\d{3}$/.test(profesor.numeroEmpleado)) {
    return 'El número de empleado debe tener el formato EMP seguido de 3 números, por ejemplo EMP001';
  }

  const empleadoDuplicado = db
    .prepare('SELECT id FROM profesores WHERE numeroEmpleado = ? AND id != ?')
    .get(profesor.numeroEmpleado, idActual ?? -1);

  if (empleadoDuplicado) {
    return 'Ya existe un profesor con ese número de empleado';
  }

  const academiaExiste = db
    .prepare('SELECT 1 FROM academias WHERE clave = ?')
    .get(profesor.academiaId);

  if (!academiaExiste) {
    return 'La academia seleccionada no existe';
  }

  if (!Array.isArray(profesor.materias)) {
    return 'Las materias deben enviarse como una lista';
  }

  const nombresMaterias = new Set();

  for (const materia of profesor.materias) {
    const nombre = normalizeText(materia?.nombre);

    if (!nombre) {
      return 'Todas las materias deben tener nombre';
    }

    const nivel = Number(materia?.nivel);

    if (!Number.isInteger(nivel) || nivel < 0 || nivel > 10) {
      return 'El nivel de dominio de cada materia debe ser un número entero entre 0 y 10';
    }

    const nombreNormalizado = nombre.toLowerCase();

    if (nombresMaterias.has(nombreNormalizado)) {
      return 'No se puede repetir la misma materia para un profesor';
    }

    nombresMaterias.add(nombreNormalizado);
  }

  return null;
}

function validarAcademia(clave, nombre, materiasAsignadas) {
  if (!clave || !nombre) {
    return 'Clave y nombre son obligatorios';
  }

  if (clave.length > 10) {
    return 'La clave debe tener máximo 10 caracteres';
  }

  if (!Array.isArray(materiasAsignadas)) {
    return 'Las materias asignadas deben enviarse como una lista';
  }

  const materiasVistas = new Set();

  for (const materia of materiasAsignadas) {
    const texto = normalizeText(materia);

    if (!texto) {
      return 'Las materias asignadas no pueden estar vacías';
    }

    const claveNormalizada = texto.toLowerCase();

    if (materiasVistas.has(claveNormalizada)) {
      return 'No se pueden repetir materias asignadas en la misma academia';
    }

    materiasVistas.add(claveNormalizada);
  }

  return null;
}

app.get('/', (req, res) => {
  res.send('API Profesores funcionando ✅');
});

app.get('/api/profesores', (req, res) => {
  try {
    const profesores = db
      .prepare('SELECT * FROM profesores ORDER BY id')
      .all();

    res.json(profesores.map((profesor) => buildProfesorPayload(profesor)));
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Error al leer los datos');
  }
});

app.get('/api/profesores/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido');
    }

    const profesor = db
      .prepare('SELECT * FROM profesores WHERE id = ?')
      .get(id);

    if (!profesor) {
      return sendError(res, 404, 'Profesor no encontrado');
    }

    return res.json(buildProfesorPayload(profesor));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al leer los datos');
  }
});

app.post('/api/profesores', (req, res) => {
  try {
    const nuevo = normalizeProfesorInput(req.body);
    const errorValidacion = validarProfesor(nuevo);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    const tx = db.transaction(() => {
      const insertProfesor = db.prepare(
        `INSERT INTO profesores (
          numeroEmpleado,
          nombre,
          apellido,
          especialidad,
          licenciatura,
          maestria,
          doctorado,
          sni,
          perfilPRODEP,
          academiaId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const result = insertProfesor.run(
        nuevo.numeroEmpleado,
        nuevo.nombre,
        nuevo.apellido,
        nuevo.especialidad,
        nuevo.licenciatura,
        nuevo.maestria,
        nuevo.doctorado,
        nuevo.sni,
        nuevo.perfilPRODEP ? 1 : 0,
        nuevo.academiaId
      );

      const profesorId = Number(result.lastInsertRowid);

      const insertMateria = db.prepare(
        'INSERT INTO materias_profesor (profesorId, nombre, nivel) VALUES (?, ?, ?)'
      );

      for (const materia of nuevo.materias) {
        insertMateria.run(profesorId, materia.nombre, materia.nivel);
      }

      return {
        id: profesorId,
        numeroEmpleado: nuevo.numeroEmpleado,
        nombre: nuevo.nombre,
        apellido: nuevo.apellido,
        especialidad: nuevo.especialidad,
        licenciatura: nuevo.licenciatura,
        maestria: nuevo.maestria,
        doctorado: nuevo.doctorado,
        sni: nuevo.sni,
        perfilPRODEP: nuevo.perfilPRODEP,
        academiaId: nuevo.academiaId,
        materias: nuevo.materias,
        ultimoGrado: getUltimoGrado(nuevo.doctorado, nuevo.maestria)
      };
    });

    const profesorCreado = tx();
    return res.status(201).json(profesorCreado);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al crear el profesor');
  }
});

app.put('/api/profesores/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido');
    }

    const existente = db
      .prepare('SELECT * FROM profesores WHERE id = ?')
      .get(id);

    if (!existente) {
      return sendError(res, 404, 'Profesor no encontrado');
    }

    const actualizado = normalizeProfesorInput({
      ...existente,
      ...req.body,
      id
    });

    actualizado.numeroEmpleado = normalizeText(req.body?.numeroEmpleado || existente.numeroEmpleado).toUpperCase();
    actualizado.nombre = normalizeText(req.body?.nombre || existente.nombre);
    actualizado.apellido = normalizeText(req.body?.apellido || existente.apellido);
    actualizado.academiaId = normalizeAcademiaClave(req.body?.academiaId || existente.academiaId);

    const errorValidacion = validarProfesor(actualizado, id);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE profesores
         SET numeroEmpleado = ?,
             nombre = ?,
             apellido = ?,
             especialidad = ?,
             licenciatura = ?,
             maestria = ?,
             doctorado = ?,
             sni = ?,
             perfilPRODEP = ?,
             academiaId = ?
         WHERE id = ?`
      ).run(
        actualizado.numeroEmpleado,
        actualizado.nombre,
        actualizado.apellido,
        actualizado.especialidad,
        actualizado.licenciatura,
        actualizado.maestria,
        actualizado.doctorado,
        actualizado.sni,
        actualizado.perfilPRODEP ? 1 : 0,
        actualizado.academiaId,
        id
      );

      db.prepare('DELETE FROM materias_profesor WHERE profesorId = ?').run(id);

      const insertMateria = db.prepare(
        'INSERT INTO materias_profesor (profesorId, nombre, nivel) VALUES (?, ?, ?)'
      );

      for (const materia of actualizado.materias) {
        insertMateria.run(id, materia.nombre, materia.nivel);
      }
    });

    tx();

    return res.json({
      ...actualizado,
      id,
      perfilPRODEP: actualizado.perfilPRODEP,
      ultimoGrado: getUltimoGrado(actualizado.doctorado, actualizado.maestria)
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al actualizar el profesor');
  }
});

app.delete('/api/profesores/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido');
    }

    const profesor = db
      .prepare('SELECT * FROM profesores WHERE id = ?')
      .get(id);

    if (!profesor) {
      return sendError(res, 404, 'Profesor no encontrado');
    }

    const eliminado = buildProfesorPayload(profesor);
    db.prepare('DELETE FROM profesores WHERE id = ?').run(id);

    return res.json({
      mensaje: 'Profesor eliminado correctamente',
      profesor: eliminado
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al eliminar el profesor');
  }
});

app.post('/api/evaluaciones', (req, res) => {
  try {
    const rawProfesorId = req.body?.profesorId;
    const profesorId = Number(rawProfesorId);
    const idValido =
      (typeof rawProfesorId === 'number' && Number.isInteger(rawProfesorId)) ||
      (typeof rawProfesorId === 'string' && /^\d+$/.test(rawProfesorId.trim()));

    if (!idValido || !Number.isInteger(profesorId) || profesorId <= 0) {
      return sendError(res, 400, 'El ID del profesor no es válido');
    }

    const profesor = db
      .prepare('SELECT 1 FROM profesores WHERE id = ?')
      .get(profesorId);

    if (!profesor) {
      return sendError(res, 404, 'El profesor no existe');
    }

    const calificacionRaw = req.body?.calificacion;
    const calificacion = Number(calificacionRaw);

    if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 10) {
      return sendError(res, 400, 'La calificación debe estar entre 0 y 10');
    }

    const comentarioRaw = req.body?.comentario ?? '';

    if (typeof comentarioRaw !== 'string') {
      return sendError(res, 400, 'El comentario debe ser texto');
    }

    const comentario = comentarioRaw.trim();

    if (comentario.length > 500) {
      return sendError(res, 400, 'El comentario no puede superar 500 caracteres');
    }

    const evaluacion = {
      id: 0,
      profesorId,
      calificacion,
      comentario,
      fecha: new Date().toISOString()
    };

    const result = db.prepare(
      'INSERT INTO evaluaciones (profesorId, calificacion, comentario, fecha) VALUES (?, ?, ?, ?)'
    ).run(profesorId, calificacion, comentario, evaluacion.fecha);

    evaluacion.id = Number(result.lastInsertRowid);
    return res.status(201).json(evaluacion);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al registrar la evaluación');
  }
});

app.get('/api/evaluaciones', (req, res) => {
  try {
    const evaluaciones = db
      .prepare('SELECT * FROM evaluaciones ORDER BY id')
      .all();

    return res.json(evaluaciones);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al obtener las evaluaciones');
  }
});

app.get('/api/profesores/:id/evaluaciones', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID de profesor inválido');
    }

    const profesor = db
      .prepare('SELECT id, numeroEmpleado, nombre, apellido FROM profesores WHERE id = ?')
      .get(id);

    if (!profesor) {
      return sendError(res, 404, 'Profesor no encontrado');
    }

    const evaluaciones = db
      .prepare('SELECT * FROM evaluaciones WHERE profesorId = ? ORDER BY id')
      .all(id);

    const totalEvaluaciones = evaluaciones.length;
    const promedio =
      totalEvaluaciones === 0
        ? null
        : Number(
            (
              evaluaciones.reduce(
                (suma, evaluacion) => suma + Number(evaluacion.calificacion),
                0
              ) / totalEvaluaciones
            ).toFixed(2)
          );

    return res.json({
      profesor: {
        id: profesor.id,
        numeroEmpleado: profesor.numeroEmpleado,
        nombre: profesor.nombre,
        apellido: profesor.apellido
      },
      evaluaciones,
      totalEvaluaciones,
      promedio
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al obtener las evaluaciones del profesor');
  }
});

app.delete('/api/evaluaciones/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID de evaluación inválido');
    }

    const evaluacion = db
      .prepare('SELECT * FROM evaluaciones WHERE id = ?')
      .get(id);

    if (!evaluacion) {
      return sendError(res, 404, 'Evaluación no encontrada');
    }

    db.prepare('DELETE FROM evaluaciones WHERE id = ?').run(id);

    return res.json({
      mensaje: 'Evaluación eliminada correctamente',
      evaluacion
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al eliminar la evaluación');
  }
});

app.get('/api/academias', (req, res) => {
  try {
    const academias = db
      .prepare('SELECT * FROM academias ORDER BY clave')
      .all();

    return res.json(academias.map((academia) => buildAcademiaPayload(academia)));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al leer los datos');
  }
});

app.get('/api/academias/:clave', (req, res) => {
  try {
    const clave = normalizeAcademiaClave(req.params.clave);

    const academia = db
      .prepare('SELECT * FROM academias WHERE clave = ?')
      .get(clave);

    if (!academia) {
      return sendError(res, 404, 'Academia no encontrada');
    }

    const integrantes = db
      .prepare('SELECT * FROM profesores WHERE academiaId = ? ORDER BY id')
      .all(clave);

    const payload = {
      ...academia,
      descripcion: academia.descripcion || '',
      integrantes: integrantes.map((profesor) => profesor.id),
      integrantesData: integrantes,
      materiasAsignadas: db
        .prepare('SELECT nombre FROM materias_academia WHERE academiaClave = ? ORDER BY id')
        .pluck()
        .all(clave)
    };

    return res.json(payload);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al leer los datos');
  }
});

app.post('/api/academias', (req, res) => {
  try {
    const clave = normalizeAcademiaClave(req.body?.clave);
    const nombre = normalizeText(req.body?.nombre);
    const descripcion = normalizeText(req.body?.descripcion);
    const materiasAsignadas = Array.isArray(req.body?.materiasAsignadas)
      ? req.body.materiasAsignadas.map((materia) => normalizeText(materia))
      : [];

    const errorValidacion = validarAcademia(clave, nombre, materiasAsignadas);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    const academiaDuplicada = db
      .prepare('SELECT 1 FROM academias WHERE clave = ?')
      .get(clave);

    if (academiaDuplicada) {
      return sendError(res, 400, 'Ya existe una academia con esa clave');
    }

    const tx = db.transaction(() => {
      db.prepare('INSERT INTO academias (clave, nombre, descripcion) VALUES (?, ?, ?)').run(
        clave,
        nombre,
        descripcion
      );

      const insertMateria = db.prepare(
        'INSERT INTO materias_academia (academiaClave, nombre) VALUES (?, ?)'
      );

      for (const materia of materiasAsignadas) {
        insertMateria.run(clave, materia);
      }
    });

    tx();

    return res.status(201).json({
      clave,
      nombre,
      descripcion,
      integrantes: [],
      materiasAsignadas
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al crear la academia');
  }
});

app.put('/api/academias/:clave', (req, res) => {
  try {
    const claveActual = normalizeAcademiaClave(req.params.clave);
    const academiaExistente = db
      .prepare('SELECT * FROM academias WHERE clave = ?')
      .get(claveActual);

    if (!academiaExistente) {
      return sendError(res, 404, 'Academia no encontrada');
    }

    const clave = normalizeAcademiaClave(req.body?.clave || claveActual);
    const nombre = normalizeText(req.body?.nombre || academiaExistente.nombre);
    const descripcion = normalizeText(req.body?.descripcion ?? academiaExistente.descripcion ?? '');
    const materiasAsignadas = Array.isArray(req.body?.materiasAsignadas)
      ? req.body.materiasAsignadas.map((materia) => normalizeText(materia))
      : [];

    const errorValidacion = validarAcademia(clave, nombre, materiasAsignadas);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    const otraAcademia = db
      .prepare('SELECT 1 FROM academias WHERE clave = ? AND clave != ?')
      .get(clave, claveActual);

    if (otraAcademia) {
      return sendError(res, 400, 'Ya existe una academia con esa clave');
    }

    const tx = db.transaction(() => {
      if (clave !== claveActual) {
        db.prepare('UPDATE academias SET clave = ? WHERE clave = ?').run(clave, claveActual);
      }

      db.prepare('UPDATE academias SET nombre = ?, descripcion = ? WHERE clave = ?').run(
        nombre,
        descripcion,
        clave
      );

      db.prepare('DELETE FROM materias_academia WHERE academiaClave = ?').run(clave);

      const insertMateria = db.prepare(
        'INSERT INTO materias_academia (academiaClave, nombre) VALUES (?, ?)'
      );

      for (const materia of materiasAsignadas) {
        insertMateria.run(clave, materia);
      }
    });

    tx();

    return res.json({
      clave,
      nombre,
      descripcion,
      integrantes: db
        .prepare('SELECT id FROM profesores WHERE academiaId = ? ORDER BY id')
        .pluck()
        .all(clave),
      materiasAsignadas
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al actualizar la academia');
  }
});

app.delete('/api/academias/:clave', (req, res) => {
  try {
    const clave = normalizeAcademiaClave(req.params.clave);

    const academia = db
      .prepare('SELECT * FROM academias WHERE clave = ?')
      .get(clave);

    if (!academia) {
      return sendError(res, 404, 'Academia no encontrada');
    }

    const tieneProfesores = db
      .prepare('SELECT COUNT(*) as total FROM profesores WHERE academiaId = ?')
      .get(clave).total > 0;

    if (tieneProfesores) {
      return sendError(res, 400, 'No se puede eliminar una academia que tiene profesores asignados');
    }

    db.prepare('DELETE FROM academias WHERE clave = ?').run(clave);

    return res.json({
      mensaje: 'Academia eliminada correctamente',
      academia
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al eliminar la academia');
  }
});

app.get('/api/profesores/:id/coincidencias', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido');
    }

    const profesor = db
      .prepare('SELECT * FROM profesores WHERE id = ?')
      .get(id);

    if (!profesor) {
      return sendError(res, 404, 'Profesor no encontrado');
    }

    const academia = db
      .prepare('SELECT * FROM academias WHERE clave = ?')
      .get(profesor.academiaId);

    if (!academia) {
      return sendError(res, 404, 'El profesor no tiene una academia válida');
    }

    const materiasProfesor = db
      .prepare('SELECT LOWER(nombre) as nombre FROM materias_profesor WHERE profesorId = ?')
      .pluck()
      .all(id);

    const materiasAcademia = db
      .prepare('SELECT LOWER(nombre) as nombre FROM materias_academia WHERE academiaClave = ?')
      .pluck()
      .all(profesor.academiaId);

    const coincidencias = materiasAcademia.filter((materia) => materiasProfesor.includes(materia));

    return res.json({
      profesor: `${profesor.nombre} ${profesor.apellido}`,
      academia: academia.nombre,
      coincidencias,
      total: coincidencias.length
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al calcular coincidencias');
  }
});

app.post('/api/login', (req, res) => {
  try {
    const username = normalizeText(req.body?.username);
    const password = normalizeText(req.body?.password);

    if (!username || !password) {
      return sendError(res, 400, 'Usuario y contraseña son obligatorios');
    }

    const usuario = db
      .prepare('SELECT id, username, nombre FROM usuarios WHERE username = ? AND password = ?')
      .get(username, password);

    if (!usuario) {
      return sendError(res, 401, 'Credenciales inválidas');
    }

    return res.json({
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al iniciar sesión');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});