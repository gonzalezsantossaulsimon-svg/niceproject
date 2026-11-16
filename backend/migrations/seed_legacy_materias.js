const MIGRATION_NAME = 'seed_legacy_materias';
const CLAVES_MATERIAS_LEGACY = new Map([
  ['Redes', 'RED-101'],
  ['Sistemas Operativos', 'SOP-102'],
  ['Programación', 'PRG-103'],
  ['Matemáticas', 'MAT-104'],
  ['Inteligencia Artificial', 'IAI-105'],
  ['Seguridad Informática', 'SEG-106'],
  ['Bases de Datos', 'BDD-107'],
  ['Desarrollo Web', 'DWE-108']
]);

function normalizarNombre(nombre) {
  return typeof nombre === 'string' ? nombre.trim() : '';
}

export function seedLegacyMaterias(db) {
  const migrar = db.transaction(() => {
    const aplicada = db
      .prepare('SELECT 1 FROM migrations WHERE nombre = ?')
      .get(MIGRATION_NAME);

    if (aplicada) {
      return { aplicada: false, insertadas: 0 };
    }

    const nombresLegacy = db.prepare(`
      SELECT nombre, NULL AS academiaClave FROM materias_profesor
      UNION ALL
      SELECT nombre, academiaClave FROM materias_academia
    `).all();
    const materiasPorNombre = new Map();

    for (const fila of nombresLegacy) {
      const nombre = normalizarNombre(fila.nombre);
      if (!nombre) continue;

      const identidad = nombre.toLowerCase();
      let materia = materiasPorNombre.get(identidad);
      if (!materia) {
        materia = { nombre, academias: new Set() };
        materiasPorNombre.set(identidad, materia);
      } else if (nombre < materia.nombre) {
        materia.nombre = nombre;
      }

      if (typeof fila.academiaClave === 'string' && fila.academiaClave.trim()) {
        materia.academias.add(fila.academiaClave.trim());
      }
    }

    const insertarMateria = db.prepare(
      'INSERT INTO materias (clave, nombre, academiaClave) VALUES (?, ?, ?)'
    );
    const existeNombre = db.prepare(
      'SELECT 1 FROM materias WHERE LOWER(nombre) = LOWER(?)'
    );
    const existeClave = db.prepare(
      'SELECT nombre FROM materias WHERE clave = ?'
    );
    let insertadas = 0;

    const materiasOrdenadas = [...materiasPorNombre.values()]
      .sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0));

    for (const materia of materiasOrdenadas) {
      if (existeNombre.get(materia.nombre)) continue;

      const clave = CLAVES_MATERIAS_LEGACY.get(materia.nombre);
      if (!clave) {
        throw new Error(`No hay una clave configurada para la materia legacy "${materia.nombre}"`);
      }

      const claveExistente = existeClave.get(clave);
      if (claveExistente) {
        throw new Error(`La clave ${clave} ya está asociada a otra materia`);
      }

      const academiaClave = materia.academias.size === 1
        ? [...materia.academias][0]
        : null;
      insertarMateria.run(clave, materia.nombre, academiaClave);
      insertadas += 1;
    }

    db.prepare(
      "INSERT INTO migrations (nombre, executed_at) VALUES (?, datetime('now'))"
    ).run(MIGRATION_NAME);

    return { aplicada: true, insertadas };
  });

  const resultado = migrar();
  if (resultado.aplicada) {
    console.log(`Migración completada: '${MIGRATION_NAME}' (${resultado.insertadas} materias).`);
  } else {
    console.log(`La migración '${MIGRATION_NAME}' ya fue ejecutada. No se agregaron materias.`);
  }
  return resultado;
}
