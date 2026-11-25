import { sesiones } from './busqueda-global.js';

export const PLANES = [
  { id: 'A', nombre: 'Calidad academica' },
  { id: 'B', nombre: 'Equilibrio de carga' },
  { id: 'C', nombre: 'Flexibilidad horaria' }
];

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Huecos internos por profesor y grupo, por dia; los intervalos contiguos
// y solapados se fusionan. No cuenta el tiempo anterior o posterior a clases.
export function contarHuecos(franjas) {
  const grupos = new Map();
  for (const f of franjas) {
    for (const recurso of ['profesorId', 'grupoId']) {
      const clave = `${recurso}:${f[recurso]}:${f.dia}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push([minutos(f.horaInicio), minutos(f.horaFin)]);
    }
  }
  let huecos = 0;
  for (const intervalos of grupos.values()) {
    intervalos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let fin = intervalos[0][1];
    for (const [inicio, siguienteFin] of intervalos.slice(1)) {
      huecos += Math.max(0, inicio - fin);
      fin = Math.max(fin, siguienteFin);
    }
  }
  return huecos;
}

export function medirPlan(asignaciones, profesores, ocupacion) {
  const extras = new Map();
  let sumaCalificaciones = 0;
  const franjas = [...ocupacion];
  for (const { alternativa: a, horas } of asignaciones) {
    extras.set(a.profesor.id, (extras.get(a.profesor.id) || 0) + horas);
    sumaCalificaciones += Number(a.calificacion);
    franjas.push(...sesiones(a));
  }
  const ratios = profesores.filter(p => p.maximo > 0)
    .map(p => (p.actual + (extras.get(p.id) || 0)) / p.maximo);
  const cargaCuadratica = ratios.length ? ratios.reduce((s, r) => s + r * r, 0) / ratios.length : 0;
  return {
    sumaCalificaciones,
    cargaCuadratica,
    cargaRmsPorcentaje: Math.sqrt(cargaCuadratica) * 100,
    cargaMaximaPorcentaje: Math.max(0, ...ratios) * 100,
    minutosHuecos: contarHuecos(franjas)
  };
}

export function valorPlan(id, metricas) {
  const { sumaCalificaciones: q, cargaCuadratica: c, minutosHuecos: h } = metricas;
  // Comparacion lexicografica, no un puntaje ponderado opaco. La cobertura
  // se compara antes de estos criterios en el motor de busqueda.
  if (id === 'A') return [q, -c, -h];
  if (id === 'B') return [-c, q, -h];
  if (id === 'C') return [-h, q, -c];
  throw new RangeError('Plan desconocido');
}
