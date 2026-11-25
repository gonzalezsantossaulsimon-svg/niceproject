export const LIMITE_PREDETERMINADO = 20000;
export const MAX_NECESIDADES = 200;
const recursos = ['profesorId', 'grupoId', 'salonId'];

export function solapan(a, b) {
  return a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
}

export function sesiones(alternativa) {
  return alternativa.horario.horarios.map(h => ({
    ...h, profesorId: alternativa.profesor.id,
    grupoId: alternativa.grupo.id, salonId: alternativa.salon.id
  }));
}

export function cruza(nuevas, ocupadas) {
  return nuevas.some(a => ocupadas.some(b =>
    recursos.some(r => a[r] === b[r]) && solapan(a, b)));
}

// Búsqueda de cobertura. No modifica los candidatos ni la base de datos.
// Las alternativas vienen ordenadas por las preferencias del recomendador individual.
export function buscarAsignacionesGlobales(entradas, ocupacionInicial = [], limite = LIMITE_PREDETERMINADO, { evaluar = null, inicial = [] } = {}) {
  if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100000) {
    throw new RangeError('El límite debe estar entre 1 y 100000.');
  }
  if (entradas.length > MAX_NECESIDADES) throw new RangeError('Máximo 200 necesidades por búsqueda.');
  const orden = entradas.map(e => ({ ...e, opciones: e.alternativas.map(a => ({ a, sesiones: sesiones(a) })) }))
    .filter(e => e.opciones.length)
    .sort((a, b) => a.opciones.length - b.opciones.length || a.necesidad.id - b.necesidad.id);
  const ocupadas = [...ocupacionInicial];
  const cargas = new Map();
  const elegidas = [];
  let mejor = evaluar ? [...inicial] : [];
  let mejorValor = evaluar ? evaluar(mejor) : null;
  function supera(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }
  let pasos = 0;
  let limiteAlcanzado = false;

  function consumirPaso() {
    if (pasos >= limite) { limiteAlcanzado = true; return false; }
    pasos++;
    return true;
  }
  function explorar(i) {
    if (elegidas.length >= mejor.length) {
      const valor = evaluar ? evaluar(elegidas) : null;
      if (elegidas.length > mejor.length || (evaluar && supera(valor, mejorValor))) {
        mejor = [...elegidas];
        mejorValor = valor;
      }
    }
    if ((!evaluar && mejor.length === orden.length) || i === orden.length || limiteAlcanzado) return;
    const posible = elegidas.length + orden.length - i;
    if (posible < mejor.length || (!evaluar && posible === mejor.length)) return;
    const entrada = orden[i];
    const horas = entrada.necesidad.materia.horasSemanales;
    for (const opcion of entrada.opciones) {
      if (!consumirPaso()) return;
      const a = opcion.a;
      const id = a.profesor.id;
      const extra = cargas.get(id) || 0;
      if (a.carga.actual + extra + horas > a.carga.maxima || cruza(opcion.sesiones, ocupadas)) continue;
      cargas.set(id, extra + horas);
      ocupadas.push(...opcion.sesiones);
      elegidas.push({ necesidadId: entrada.necesidad.id, alternativa: a, horas });
      explorar(i + 1);
      elegidas.pop();
      ocupadas.length -= opcion.sesiones.length;
      cargas.set(id, extra);
      if ((!evaluar && mejor.length === orden.length) || limiteAlcanzado) return;
    }
    // Omitir temporalmente también es una rama: nunca se fuerza una asignación inválida.
    if (consumirPaso()) explorar(i + 1);
  }
  explorar(0);

  return {
    asignaciones: mejor.sort((a, b) => a.necesidadId - b.necesidadId),
    busqueda: { pasos, limite, limiteAlcanzado, coberturaOptima: !limiteAlcanzado || mejor.length === orden.length,
      ...(evaluar ? { objetivoOptimo: !limiteAlcanzado } : {}) }
  };
}
