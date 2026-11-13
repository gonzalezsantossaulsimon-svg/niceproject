import express from 'express';
import cors from 'cors';
import getDatabase from './database.js';

const app = express();
const PORT = 3000;
const db = getDatabase();
const DIAS_PERMITIDOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_DIAS = Object.fromEntries(DIAS_PERMITIDOS.map((dia, index) => [dia, index + 1]));

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

function normalizeDia(value) {
  const texto = normalizeText(value);
  const diaNormalizado = DIAS_PERMITIDOS.find((dia) => dia.toLowerCase() === texto.toLowerCase());
  return diaNormalizado || '';
}

function normalizeHora(value) {
  const texto = normalizeText(value);

  if (!/^\d{2}:\d{2}$/.test(texto)) {
    return '';
  }

  const [horas, minutos] = texto.split(':').map(Number);

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) {
    return '';
  }

  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) {
    return '';
  }

  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function horaEnMinutos(hora) {
  const [horas, minutos] = normalizeHora(hora).split(':').map(Number);
  return horas * 60 + minutos;
}

function horariosSeSolapan(inicioNuevo, finNuevo, inicioExistente, finExistente) {
  return horaEnMinutos(inicioNuevo) < horaEnMinutos(finExistente)
    && horaEnMinutos(finNuevo) > horaEnMinutos(inicioExistente);
}

function obtenerHorariosSeleccionados(horarioIds) {
  const franjas = [];

  for (const horarioId of horarioIds) {
    const franja = db
      .prepare('SELECT id, dia, horaInicio, horaFin FROM franjas_horarias WHERE id = ?')
      .get(horarioId);

    if (!franja) {
      return null;
    }

    franjas.push(franja);
  }

  return franjas;
}

function haySolapamientoEntreFranjas(franjas) {
  for (let i = 0; i < franjas.length; i += 1) {
    for (let j = i + 1; j < franjas.length; j += 1) {
      const actual = franjas[i];
      const siguiente = franjas[j];

      if (actual.dia !== siguiente.dia) {
        continue;
      }

      if (horariosSeSolapan(actual.horaInicio, actual.horaFin, siguiente.horaInicio, siguiente.horaFin)) {
        return true;
      }
    }
  }

  return false;
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

function buildHorarioPayload(row) {
  const profesor = db
    .prepare('SELECT nombre, apellido, numeroEmpleado FROM profesores WHERE id = ?')
    .get(row.profesorId);

  return {
    id: Number(row.id),
    profesorId: Number(row.profesorId),
    profesorNombre: profesor ? `${profesor.nombre} ${profesor.apellido}`.trim() : '',
    numeroEmpleado: profesor ? profesor.numeroEmpleado : '',
    materia: row.materia,
    dia: row.dia,
    horaInicio: row.horaInicio,
    horaFin: row.horaFin,
    aula: row.aula,
    grupo: row.grupo || ''
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

function normalizarHorarioInput(input = {}) {
  return {
    profesorId: Number(input.profesorId),
    materia: normalizeText(input.materia),
    dia: normalizeDia(input.dia),
    horaInicio: normalizeHora(input.horaInicio),
    horaFin: normalizeHora(input.horaFin),
    aula: normalizeText(input.aula),
    grupo: normalizeText(input.grupo)
  };
}

function validarHorario(horario, idActual = null) {
  if (!Number.isInteger(horario.profesorId) || horario.profesorId <= 0) {
    return 'El profesor es obligatorio';
  }

  if (!horario.materia) {
    return 'La materia es obligatoria';
  }

  const materiasProfesor = db
    .prepare('SELECT LOWER(nombre) AS nombre FROM materias_profesor WHERE profesorId = ?')
    .pluck()
    .all(horario.profesorId);

  if (!materiasProfesor.includes(horario.materia.toLowerCase())) {
    return 'La materia no pertenece al profesor';
  }

  if (!horario.dia) {
    return 'El día es obligatorio';
  }

  if (!horario.horaInicio || !horario.horaFin) {
    return 'Las horas deben tener el formato HH:MM';
  }

  if (horaEnMinutos(horario.horaInicio) >= horaEnMinutos(horario.horaFin)) {
    return 'La hora de inicio debe ser menor que la de fin';
  }

  if (!horario.aula) {
    return 'El aula es obligatoria';
  }

  const choqueProfesor = db
    .prepare(
      `SELECT id FROM horarios
       WHERE profesorId = ?
         AND dia = ?
         AND id != ?
         AND horaInicio < ?
         AND horaFin > ?`
    )
    .get(horario.profesorId, horario.dia, idActual ?? -1, horario.horaFin, horario.horaInicio);

  if (choqueProfesor) {
    return 'El profesor ya tiene una clase en ese horario';
  }

  const choqueAula = db
    .prepare(
      `SELECT id FROM horarios
       WHERE LOWER(aula) = LOWER(?)
         AND dia = ?
         AND id != ?
         AND horaInicio < ?
         AND horaFin > ?`
    )
    .get(horario.aula, horario.dia, idActual ?? -1, horario.horaFin, horario.horaInicio);

  if (choqueAula) {
    return 'El aula ya está ocupada en ese horario';
  }

  return null;
}

app.get('/', (req, res) => {
  res.send('API Profesores funcionando ✅');
});

function parseCatalogId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizePositiveInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function sendCatalogDatabaseError(res, error, catalog, phase) {
  if (
    error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  ) {
    return sendError(res, 409, catalog.duplicateMessage);
  }

  if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    if (phase === 'save' && catalog.foreignKeySaveMessage) {
      return sendError(res, 400, catalog.foreignKeySaveMessage);
    }

    return sendError(res, 409, catalog.inUseMessage);
  }

  if (error?.code?.startsWith('SQLITE_CONSTRAINT_')) {
    return sendError(res, 400, catalog.invalidMessage);
  }

  console.error(error);
  return sendError(res, 500, catalog.internalErrorMessage);
}

function registerCatalogRoutes(catalog) {
  const collectionPath = `/api/${catalog.path}`;
  const insertSql = `INSERT INTO ${catalog.table} (${catalog.columns.join(', ')}) VALUES (${catalog.columns.map(() => '?').join(', ')})`;
  const updateSql = `UPDATE ${catalog.table} SET ${catalog.columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`;

  app.get(collectionPath, (req, res) => {
    try {
      const records = db
        .prepare(`SELECT * FROM ${catalog.table} ORDER BY ${catalog.orderBy}`)
        .all();

      return res.json(records);
    } catch (error) {
      return sendCatalogDatabaseError(res, error, catalog, 'read');
    }
  });

  app.get(`${collectionPath}/:id`, (req, res) => {
    const id = parseCatalogId(req.params.id);
    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    try {
      const record = db.prepare(`SELECT * FROM ${catalog.table} WHERE id = ?`).get(id);
      if (!record) {
        return sendError(res, 404, `${catalog.label} no encontrado`);
      }

      return res.json(record);
    } catch (error) {
      return sendCatalogDatabaseError(res, error, catalog, 'read');
    }
  });

  app.post(collectionPath, (req, res) => {
    try {
      const record = catalog.normalize(req.body);
      const validationError = catalog.validate(record);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      if (catalog.isDuplicate(record)) {
        return sendError(res, 409, catalog.duplicateMessage);
      }

      const result = db.prepare(insertSql).run(...catalog.columns.map((column) => record[column]));
      const created = db.prepare(`SELECT * FROM ${catalog.table} WHERE id = ?`).get(result.lastInsertRowid);
      return res.status(201).json(created);
    } catch (error) {
      return sendCatalogDatabaseError(res, error, catalog, 'save');
    }
  });

  app.put(`${collectionPath}/:id`, (req, res) => {
    const id = parseCatalogId(req.params.id);
    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    try {
      const current = db.prepare(`SELECT id FROM ${catalog.table} WHERE id = ?`).get(id);
      if (!current) {
        return sendError(res, 404, `${catalog.label} no encontrado`);
      }

      const record = catalog.normalize(req.body);
      const validationError = catalog.validate(record);
      if (validationError) {
        return sendError(res, 400, validationError);
      }

      if (catalog.isDuplicate(record, id)) {
        return sendError(res, 409, catalog.duplicateMessage);
      }

      db.prepare(updateSql).run(...catalog.columns.map((column) => record[column]), id);
      const updated = db.prepare(`SELECT * FROM ${catalog.table} WHERE id = ?`).get(id);
      return res.json(updated);
    } catch (error) {
      return sendCatalogDatabaseError(res, error, catalog, 'save');
    }
  });

  app.delete(`${collectionPath}/:id`, (req, res) => {
    const id = parseCatalogId(req.params.id);
    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    try {
      const current = db.prepare(`SELECT id FROM ${catalog.table} WHERE id = ?`).get(id);
      if (!current) {
        return sendError(res, 404, `${catalog.label} no encontrado`);
      }

      if (catalog.isInUse(id)) {
        return sendError(res, 409, catalog.inUseMessage);
      }

      db.prepare(`DELETE FROM ${catalog.table} WHERE id = ?`).run(id);
      return res.json({ mensaje: `${catalog.label} eliminado correctamente` });
    } catch (error) {
      return sendCatalogDatabaseError(res, error, catalog, 'delete');
    }
  });
}

registerCatalogRoutes({
  path: 'materias',
  table: 'materias',
  label: 'Materia',
  orderBy: 'clave, id',
  columns: ['clave', 'nombre', 'academiaClave'],
  duplicateMessage: 'La materia ya existe',
  inUseMessage: 'La materia está siendo utilizada por un curso',
  invalidMessage: 'Los datos de la materia no son válidos',
  internalErrorMessage: 'Error al procesar la materia',
  foreignKeySaveMessage: 'La academia seleccionada no existe',
  normalize: (input = {}) => ({
    clave: normalizeText(input?.clave).toUpperCase(),
    nombre: normalizeText(input?.nombre),
    academiaClave: input?.academiaClave == null
      ? null
      : typeof input.academiaClave === 'string'
        ? normalizeText(input.academiaClave).toUpperCase() || null
        : null,
    academiaClaveInvalida: input?.academiaClave != null && typeof input.academiaClave !== 'string'
  }),
  validate: (record) => {
    if (!record.clave || !record.nombre) {
      return 'Clave y nombre son obligatorios';
    }

    if (record.academiaClaveInvalida) {
      return 'La clave de academia debe ser texto';
    }

    if (
      record.academiaClave
      && !db.prepare('SELECT 1 FROM academias WHERE clave = ?').get(record.academiaClave)
    ) {
      return 'La academia seleccionada no existe';
    }

    return null;
  },
  isDuplicate: (record, id = -1) => {
    if (db.prepare('SELECT 1 FROM materias WHERE clave = ? AND id != ?').get(record.clave, id)) {
      return true;
    }

    return db.prepare('SELECT id, nombre FROM materias WHERE id != ?').all(id)
      .some((materia) => materia.nombre.toLowerCase() === record.nombre.toLowerCase());
  },
  isInUse: (id) => Boolean(db.prepare('SELECT 1 FROM cursos WHERE materiaId = ?').get(id))
});

registerCatalogRoutes({
  path: 'salones',
  table: 'salones',
  label: 'Salón',
  orderBy: 'clave, id',
  columns: ['clave', 'nombre', 'capacidad'],
  duplicateMessage: 'El salón ya existe',
  inUseMessage: 'El salón está siendo utilizado por un curso',
  invalidMessage: 'Los datos del salón no son válidos',
  internalErrorMessage: 'Error al procesar el salón',
  normalize: (input = {}) => ({
    clave: normalizeText(input?.clave).toUpperCase(),
    nombre: normalizeText(input?.nombre),
    capacidad: normalizePositiveInteger(input?.capacidad)
  }),
  validate: (record) => {
    if (!record.clave || !record.nombre) {
      return 'Clave y nombre son obligatorios';
    }

    if (record.capacidad === null || record.capacidad <= 0) {
      return 'La capacidad debe ser un entero mayor a 0';
    }

    return null;
  },
  isDuplicate: (record, id = -1) => {
    if (db.prepare('SELECT 1 FROM salones WHERE clave = ? AND id != ?').get(record.clave, id)) {
      return true;
    }

    return db.prepare('SELECT id, nombre FROM salones WHERE id != ?').all(id)
      .some((salon) => salon.nombre.toLowerCase() === record.nombre.toLowerCase());
  },
  isInUse: (id) => Boolean(db.prepare('SELECT 1 FROM cursos WHERE salonId = ?').get(id))
});

registerCatalogRoutes({
  path: 'grupos',
  table: 'grupos',
  label: 'Grupo',
  orderBy: 'clave, id',
  columns: ['clave', 'nombre', 'cantidadAlumnos'],
  duplicateMessage: 'El grupo ya existe',
  inUseMessage: 'El grupo está siendo utilizado por un curso',
  invalidMessage: 'Los datos del grupo no son válidos',
  internalErrorMessage: 'Error al procesar el grupo',
  normalize: (input = {}) => ({
    clave: normalizeText(input?.clave).toUpperCase(),
    nombre: normalizeText(input?.nombre),
    cantidadAlumnos: normalizePositiveInteger(input?.cantidadAlumnos)
  }),
  validate: (record) => {
    if (!record.clave || !record.nombre) {
      return 'Clave y nombre son obligatorios';
    }

    if (record.cantidadAlumnos === null || record.cantidadAlumnos <= 0) {
      return 'La cantidad de alumnos debe ser un entero mayor a 0';
    }

    return null;
  },
  isDuplicate: (record, id = -1) => Boolean(
    db.prepare('SELECT 1 FROM grupos WHERE clave = ? AND id != ?').get(record.clave, id)
  ),
  isInUse: (id) => Boolean(db.prepare('SELECT 1 FROM cursos WHERE grupoId = ?').get(id))
});

registerCatalogRoutes({
  path: 'franjas-horarias',
  table: 'franjas_horarias',
  label: 'Franja horaria',
  orderBy: 'dia, horaInicio, horaFin, id',
  columns: ['dia', 'horaInicio', 'horaFin'],
  duplicateMessage: 'La franja horaria ya existe',
  inUseMessage: 'La franja horaria está siendo utilizada por un curso',
  invalidMessage: 'Los datos de la franja horaria no son válidos',
  internalErrorMessage: 'Error al procesar la franja horaria',
  normalize: (input = {}) => ({
    dia: normalizeDia(input?.dia),
    horaInicio: normalizeHora(input?.horaInicio),
    horaFin: normalizeHora(input?.horaFin)
  }),
  validate: (record) => {
    if (!record.dia) {
      return 'El día debe ser uno de los días permitidos';
    }

    if (!record.horaInicio || !record.horaFin) {
      return 'Las horas deben tener el formato HH:MM válido';
    }

    if (horaEnMinutos(record.horaInicio) >= horaEnMinutos(record.horaFin)) {
      return 'La hora de inicio debe ser menor que la hora de fin';
    }

    return null;
  },
  isDuplicate: (record, id = -1) => Boolean(
    db.prepare(
      'SELECT 1 FROM franjas_horarias WHERE dia = ? AND horaInicio = ? AND horaFin = ? AND id != ?'
    ).get(record.dia, record.horaInicio, record.horaFin, id)
  ),
  isInUse: (id) => Boolean(db.prepare('SELECT 1 FROM curso_horarios WHERE horarioId = ?').get(id))
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

app.get('/api/horarios', (req, res) => {
  try {
    const profesorIdQuery = req.query?.profesorId;
    const diaQuery = req.query?.dia;

    let profesorId = null;
    if (profesorIdQuery !== undefined && profesorIdQuery !== null && profesorIdQuery !== '') {
      profesorId = Number(profesorIdQuery);
      if (!Number.isInteger(profesorId) || profesorId <= 0) {
        return sendError(res, 400, 'El ID del profesor es inválido');
      }

      const profesor = db.prepare('SELECT 1 FROM profesores WHERE id = ?').get(profesorId);
      if (!profesor) {
        return sendError(res, 404, 'El profesor no existe');
      }
    }

    const dia = normalizeDia(diaQuery);
    if (diaQuery !== undefined && diaQuery !== null && diaQuery !== '' && !dia) {
      return sendError(res, 400, 'El día indicado no es válido');
    }

    let query = `
      SELECT h.*
      FROM horarios h
      LEFT JOIN profesores p ON p.id = h.profesorId
      WHERE 1 = 1
    `;
    const params = [];

    if (profesorId !== null) {
      query += ' AND h.profesorId = ?';
      params.push(profesorId);
    }

    if (dia) {
      query += ' AND h.dia = ?';
      params.push(dia);
    }

    query += `
      ORDER BY CASE h.dia
        WHEN 'Lunes' THEN 1
        WHEN 'Martes' THEN 2
        WHEN 'Miércoles' THEN 3
        WHEN 'Jueves' THEN 4
        WHEN 'Viernes' THEN 5
        WHEN 'Sábado' THEN 6
        ELSE 7
      END ASC,
      h.horaInicio ASC,
      p.nombre ASC,
      p.apellido ASC
    `;

    const horarios = db.prepare(query).all(...params);
    return res.json(horarios.map((horario) => buildHorarioPayload(horario)));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al obtener los horarios');
  }
});

app.get('/api/horarios/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID de horario inválido');
    }

    const horario = db
      .prepare('SELECT * FROM horarios WHERE id = ?')
      .get(id);

    if (!horario) {
      return sendError(res, 404, 'Horario no encontrado');
    }

    return res.json(buildHorarioPayload(horario));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al leer el horario');
  }
});

app.post('/api/horarios', (req, res) => {
  try {
    const nuevo = normalizarHorarioInput(req.body);

    if (!Number.isInteger(nuevo.profesorId) || nuevo.profesorId <= 0) {
      return sendError(res, 400, 'El profesor es obligatorio');
    }

    const profesor = db
      .prepare('SELECT 1 FROM profesores WHERE id = ?')
      .get(nuevo.profesorId);

    if (!profesor) {
      return sendError(res, 404, 'El profesor no existe');
    }

    const errorValidacion = validarHorario(nuevo);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    const result = db.prepare(
      'INSERT INTO horarios (profesorId, materia, dia, horaInicio, horaFin, aula, grupo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      nuevo.profesorId,
      nuevo.materia,
      nuevo.dia,
      nuevo.horaInicio,
      nuevo.horaFin,
      nuevo.aula,
      nuevo.grupo
    );

    const horarioCreado = db
      .prepare('SELECT * FROM horarios WHERE id = ?')
      .get(Number(result.lastInsertRowid));

    return res.status(201).json(buildHorarioPayload(horarioCreado));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al crear el horario');
  }
});

app.put('/api/horarios/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID de horario inválido');
    }

    const existente = db
      .prepare('SELECT * FROM horarios WHERE id = ?')
      .get(id);

    if (!existente) {
      return sendError(res, 404, 'Horario no encontrado');
    }

    const actualizado = normalizarHorarioInput({
      ...existente,
      ...req.body,
      profesorId: req.body?.profesorId ?? existente.profesorId
    });

    if (!Number.isInteger(actualizado.profesorId) || actualizado.profesorId <= 0) {
      return sendError(res, 400, 'El profesor es obligatorio');
    }

    const profesor = db
      .prepare('SELECT 1 FROM profesores WHERE id = ?')
      .get(actualizado.profesorId);

    if (!profesor) {
      return sendError(res, 404, 'El profesor no existe');
    }

    const errorValidacion = validarHorario(actualizado, id);

    if (errorValidacion) {
      return sendError(res, 400, errorValidacion);
    }

    db.prepare(
      `UPDATE horarios
       SET profesorId = ?, materia = ?, dia = ?, horaInicio = ?, horaFin = ?, aula = ?, grupo = ?
       WHERE id = ?`
    ).run(
      actualizado.profesorId,
      actualizado.materia,
      actualizado.dia,
      actualizado.horaInicio,
      actualizado.horaFin,
      actualizado.aula,
      actualizado.grupo,
      id
    );

    const horarioActualizado = db
      .prepare('SELECT * FROM horarios WHERE id = ?')
      .get(id);

    return res.json(buildHorarioPayload(horarioActualizado));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al actualizar el horario');
  }
});

app.delete('/api/horarios/:id', (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return sendError(res, 400, 'ID de horario inválido');
    }

    const horario = db
      .prepare('SELECT * FROM horarios WHERE id = ?')
      .get(id);

    if (!horario) {
      return sendError(res, 404, 'Horario no encontrado');
    }

    const eliminado = buildHorarioPayload(horario);
    db.prepare('DELETE FROM horarios WHERE id = ?').run(id);

    return res.json({
      mensaje: 'Horario eliminado correctamente',
      horario: eliminado
    });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al eliminar el horario');
  }
});

function buildCursoPayload(curso) {
  const materia = db
    .prepare('SELECT * FROM materias WHERE id = ?')
    .get(curso.materiaId);

  const profesor = db
    .prepare('SELECT id, nombre, apellido, numeroEmpleado FROM profesores WHERE id = ?')
    .get(curso.profesorId);

  const grupo = db
    .prepare('SELECT * FROM grupos WHERE id = ?')
    .get(curso.grupoId);

  const salon = db
    .prepare('SELECT * FROM salones WHERE id = ?')
    .get(curso.salonId);

  const horarios = db
    .prepare(`
      SELECT fh.id, fh.dia, fh.horaInicio, fh.horaFin
      FROM curso_horarios ch
      INNER JOIN franjas_horarias fh ON fh.id = ch.horarioId
      WHERE ch.cursoId = ?
      ORDER BY fh.dia, fh.horaInicio, fh.horaFin, fh.id
    `)
    .all(curso.id);

  return {
    id: Number(curso.id),
    materiaId: Number(curso.materiaId),
    profesorId: Number(curso.profesorId),
    grupoId: Number(curso.grupoId),
    salonId: Number(curso.salonId),
    materia: materia ? { ...materia } : null,
    profesor: profesor ? { ...profesor } : null,
    grupo: grupo ? { ...grupo } : null,
    salon: salon ? { ...salon } : null,
    horarioIds: horarios.map((horario) => Number(horario.id)),
    horarios: horarios.map((horario) => ({
      id: Number(horario.id),
      dia: horario.dia,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin
    }))
  };
}

function obtenerCursoConflictData(cursoId, profesorId, grupoId, salonId, horarioIds) {
  const conflictoProfesor = db
    .prepare(`
      SELECT c.id, fh.dia, fh.horaInicio, fh.horaFin
      FROM cursos c
      INNER JOIN curso_horarios ch ON ch.cursoId = c.id
      INNER JOIN franjas_horarias fh ON fh.id = ch.horarioId
      WHERE c.profesorId = ? AND c.id != ?
    `)
    .all(profesorId, cursoId ?? -1);

  const conflictoSalon = db
    .prepare(`
      SELECT c.id, fh.dia, fh.horaInicio, fh.horaFin
      FROM cursos c
      INNER JOIN curso_horarios ch ON ch.cursoId = c.id
      INNER JOIN franjas_horarias fh ON fh.id = ch.horarioId
      WHERE c.salonId = ? AND c.id != ?
    `)
    .all(salonId, cursoId ?? -1);

  const conflictoGrupo = db
    .prepare(`
      SELECT c.id, fh.dia, fh.horaInicio, fh.horaFin
      FROM cursos c
      INNER JOIN curso_horarios ch ON ch.cursoId = c.id
      INNER JOIN franjas_horarias fh ON fh.id = ch.horarioId
      WHERE c.grupoId = ? AND c.id != ?
    `)
    .all(grupoId, cursoId ?? -1);

  const franjasCurso = obtenerHorariosSeleccionados(horarioIds);

  if (!franjasCurso) {
    return {
      conflictoProfesor,
      conflictoSalon,
      conflictoGrupo,
      conflictoFranja: false
    };
  }

  const conflictoFranja = haySolapamientoEntreFranjas(franjasCurso);

  return {
    conflictoProfesor,
    conflictoSalon,
    conflictoGrupo,
    conflictoFranja
  };
}

function validarCursoPayload(payload, cursoIdActual = null) {
  const materiaId = normalizePositiveInteger(payload?.materiaId);
  const profesorId = normalizePositiveInteger(payload?.profesorId);
  const grupoId = normalizePositiveInteger(payload?.grupoId);
  const salonId = normalizePositiveInteger(payload?.salonId);

  if (!Number.isInteger(materiaId) || materiaId <= 0) {
    return 'El campo materiaId es obligatorio';
  }

  if (!db.prepare('SELECT 1 FROM materias WHERE id = ?').get(materiaId)) {
    return 'La materia seleccionada no existe';
  }

  if (!Number.isInteger(profesorId) || profesorId <= 0) {
    return 'El campo profesorId es obligatorio';
  }

  if (!db.prepare('SELECT 1 FROM profesores WHERE id = ?').get(profesorId)) {
    return 'El profesor seleccionado no existe';
  }

  if (!Number.isInteger(grupoId) || grupoId <= 0) {
    return 'El campo grupoId es obligatorio';
  }

  if (!db.prepare('SELECT 1 FROM grupos WHERE id = ?').get(grupoId)) {
    return 'El grupo seleccionado no existe';
  }

  if (!Number.isInteger(salonId) || salonId <= 0) {
    return 'El campo salonId es obligatorio';
  }

  if (!db.prepare('SELECT 1 FROM salones WHERE id = ?').get(salonId)) {
    return 'El salón seleccionado no existe';
  }

  if (!Array.isArray(payload?.horarioIds) || payload.horarioIds.length === 0) {
    return 'Debe seleccionar al menos una franja horaria';
  }

  const horarioIds = [];
  const idsVistos = new Set();

  for (const rawHorarioId of payload.horarioIds) {
    const horarioId = normalizePositiveInteger(rawHorarioId);

    if (!Number.isInteger(horarioId) || horarioId <= 0) {
      return 'Todos los horarios deben ser IDs válidos';
    }

    if (idsVistos.has(horarioId)) {
      return 'No se pueden repetir horarios en el mismo curso';
    }

    idsVistos.add(horarioId);
    horarioIds.push(horarioId);
  }

  const franjasCurso = obtenerHorariosSeleccionados(horarioIds);
  if (!franjasCurso || franjasCurso.length !== horarioIds.length) {
    return 'Una o varias franjas horarias no existen';
  }

  if (haySolapamientoEntreFranjas(franjasCurso)) {
    return 'Las franjas seleccionadas para el curso no pueden solaparse entre sí';
  }

  const grupo = db
    .prepare('SELECT cantidadAlumnos FROM grupos WHERE id = ?')
    .get(grupoId);

  const salon = db
    .prepare('SELECT capacidad FROM salones WHERE id = ?')
    .get(salonId);

  if (salon.capacidad < grupo.cantidadAlumnos) {
    return `El salón seleccionado tiene capacidad para ${salon.capacidad} alumnos y el grupo tiene ${grupo.cantidadAlumnos}.`;
  }

  const { conflictoProfesor, conflictoSalon, conflictoGrupo } = obtenerCursoConflictData(
    cursoIdActual,
    profesorId,
    grupoId,
    salonId,
    horarioIds
  );

  for (const franja of conflictoProfesor) {
    if (franjasCurso.some((nuevaFranja) => nuevaFranja.dia === franja.dia
      && horariosSeSolapan(nuevaFranja.horaInicio, nuevaFranja.horaFin, franja.horaInicio, franja.horaFin))) {
      return 'El profesor ya tiene otro curso asignado en ese horario.';
    }
  }

  for (const franja of conflictoSalon) {
    if (franjasCurso.some((nuevaFranja) => nuevaFranja.dia === franja.dia
      && horariosSeSolapan(nuevaFranja.horaInicio, nuevaFranja.horaFin, franja.horaInicio, franja.horaFin))) {
      return 'El salón ya está ocupado por otro curso en ese horario.';
    }
  }

  for (const franja of conflictoGrupo) {
    if (franjasCurso.some((nuevaFranja) => nuevaFranja.dia === franja.dia
      && horariosSeSolapan(nuevaFranja.horaInicio, nuevaFranja.horaFin, franja.horaInicio, franja.horaFin))) {
      return 'El grupo ya tiene otro curso asignado en ese horario.';
    }
  }

  return null;
}

app.get('/api/cursos', (req, res) => {
  try {
    const cursos = db
      .prepare('SELECT * FROM cursos ORDER BY id')
      .all();

    return res.json(cursos.map((curso) => buildCursoPayload(curso)));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al obtener los cursos');
  }
});

app.get('/api/cursos/:id', (req, res) => {
  try {
    const id = parseCatalogId(req.params.id);

    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(id);

    if (!curso) {
      return sendError(res, 404, 'Curso no encontrado');
    }

    return res.json(buildCursoPayload(curso));
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Error al obtener el curso');
  }
});

app.post('/api/cursos', (req, res) => {
  try {
    const validacion = validarCursoPayload(req.body);

    if (validacion) {
      return sendError(res, 400, validacion);
    }

    const { materiaId, profesorId, grupoId, salonId, horarioIds } = req.body;

    const tx = db.transaction(() => {
      const result = db.prepare(
        'INSERT INTO cursos (materiaId, profesorId, grupoId, salonId) VALUES (?, ?, ?, ?)'
      ).run(materiaId, profesorId, grupoId, salonId);

      const cursoId = Number(result.lastInsertRowid);

      const insertCursoHorario = db.prepare(
        'INSERT INTO curso_horarios (cursoId, horarioId) VALUES (?, ?)'
      );

      for (const horarioId of horarioIds) {
        insertCursoHorario.run(cursoId, horarioId);
      }

      return cursoId;
    });

    const cursoId = tx();
    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(cursoId);

    return res.status(201).json(buildCursoPayload(curso));
  } catch (error) {
    console.error(error);

    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return sendError(res, 400, 'La relación del curso contiene datos inválidos');
    }

    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return sendError(res, 409, 'La relación del curso ya existe');
    }

    return sendError(res, 500, 'Error al crear el curso');
  }
});

app.put('/api/cursos/:id', (req, res) => {
  try {
    const id = parseCatalogId(req.params.id);

    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    const existente = db.prepare('SELECT * FROM cursos WHERE id = ?').get(id);
    if (!existente) {
      return sendError(res, 404, 'Curso no encontrado');
    }

    const validacion = validarCursoPayload(req.body, id);
    if (validacion) {
      return sendError(res, 400, validacion);
    }

    const { materiaId, profesorId, grupoId, salonId, horarioIds } = req.body;

    const tx = db.transaction(() => {
      db.prepare(
        'UPDATE cursos SET materiaId = ?, profesorId = ?, grupoId = ?, salonId = ? WHERE id = ?'
      ).run(materiaId, profesorId, grupoId, salonId, id);

      db.prepare('DELETE FROM curso_horarios WHERE cursoId = ?').run(id);

      const insertCursoHorario = db.prepare(
        'INSERT INTO curso_horarios (cursoId, horarioId) VALUES (?, ?)'
      );

      for (const horarioId of horarioIds) {
        insertCursoHorario.run(id, horarioId);
      }
    });

    tx();
    const cursoActualizado = db.prepare('SELECT * FROM cursos WHERE id = ?').get(id);

    return res.json(buildCursoPayload(cursoActualizado));
  } catch (error) {
    console.error(error);

    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return sendError(res, 400, 'La relación del curso contiene datos inválidos');
    }

    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return sendError(res, 409, 'La relación del curso ya existe');
    }

    return sendError(res, 500, 'Error al actualizar el curso');
  }
});

app.delete('/api/cursos/:id', (req, res) => {
  try {
    const id = parseCatalogId(req.params.id);

    if (id === null) {
      return sendError(res, 400, 'ID inválido');
    }

    const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(id);
    if (!curso) {
      return sendError(res, 404, 'Curso no encontrado');
    }

    const payload = buildCursoPayload(curso);
    db.prepare('DELETE FROM cursos WHERE id = ?').run(id);

    return res.json({
      mensaje: 'Curso eliminado correctamente',
      curso: payload
    });
  } catch (error) {
    console.error(error);

    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return sendError(res, 409, 'No se puede eliminar el curso porque está asociado a datos relacionados');
    }

    return sendError(res, 500, 'Error al eliminar el curso');
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