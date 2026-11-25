import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarAsignacionesGlobales } from '../services/busqueda-global.js';
import { contarHuecos, medirPlan, valorPlan } from '../services/criterios-planes.js';

function opcion(p, g, inicio, fin, calificacion, actual = 0) {
  return { profesor: { id: p }, grupo: { id: g }, salon: { id: g }, calificacion,
    carga: { actual, maxima: 20 }, horario: { horarios: [{ dia: 'Lunes', horaInicio: inicio, horaFin: fin }] } };
}
const profesores = [{ id: 1, actual: 8, maximo: 20 }, { id: 2, actual: 0, maximo: 20 }];
const ocupacion = [{ profesorId: 1, grupoId: 1, salonId: 9, dia: 'Lunes', horaInicio: '07:00', horaFin: '09:00' }];
const entradas = [{ necesidad: { id: 1, materia: { horasSemanales: 4 } }, alternativas: [
  opcion(1, 1, '15:00', '17:00', 10, 8),
  opcion(2, 1, '13:00', '15:00', 9),
  opcion(1, 1, '09:00', '11:00', 8, 8)
] }];
function elegir(id, limite = 100) {
  const base = buscarAsignacionesGlobales(entradas, ocupacion, limite);
  return buscarAsignacionesGlobales(entradas, ocupacion, limite, { inicial: base.asignaciones,
    evaluar: a => valorPlan(id, medirPlan(a, profesores, ocupacion)) });
}

test('A B C seleccionan alternativas distintas segun criterios medibles', () => {
  const [a,b,c] = ['A','B','C'].map(id => elegir(id));
  assert.deepEqual([a,b,c].map(r => r.asignaciones.length), [1,1,1]);
  assert.deepEqual([a,b,c].map(r => r.asignaciones[0].alternativa.calificacion), [10,9,8]);
  const m = [a,b,c].map(r => medirPlan(r.asignaciones, profesores, ocupacion));
  assert.ok(m[1].cargaRmsPorcentaje < m[0].cargaRmsPorcentaje);
  assert.equal(m[2].minutosHuecos, 0);
  assert.ok(m[0].minutosHuecos > 0);
  assert.ok([a,b,c].every(r => r.busqueda.objetivoOptimo && r.busqueda.coberturaOptima));
});

test('cobertura tiene prioridad incluso ante una calificacion mayor', () => {
  const e = [
    { necesidad: { id: 1, materia: { horasSemanales: 4 } }, alternativas: [opcion(1,1,'07:00','09:00',10), opcion(2,1,'09:00','11:00',1)] },
    { necesidad: { id: 2, materia: { horasSemanales: 4 } }, alternativas: [opcion(1,2,'07:00','09:00',1)] }
  ];
  const r = buscarAsignacionesGlobales(e, [], 100, { evaluar: a => [a.reduce((s, x) => s + x.alternativa.calificacion, 0)] });
  assert.equal(r.asignaciones.length, 2);
  assert.equal(r.asignaciones[0].alternativa.calificacion, 1);
});

test('presupuesto conserva cobertura de partida pero no declara objetivo optimo', () => {
  const r = elegir('C', 1);
  assert.equal(r.asignaciones.length, 1);
  assert.equal(r.busqueda.coberturaOptima, true);
  assert.equal(r.busqueda.objetivoOptimo, false);
  assert.equal(r.busqueda.limiteAlcanzado, true);
  assert.equal(r.busqueda.pasos, 1);
});

test('huecos fusiona intervalos contiguos y solapados y separa dias', () => {
  const f = (inicio, fin, dia = 'Lunes') => ({ profesorId: 1, grupoId: 1, dia, horaInicio: inicio, horaFin: fin });
  assert.equal(contarHuecos([f('07:00','09:00'), f('08:00','10:00'), f('10:00','11:00'), f('12:00','13:00'), f('16:00','18:00','Martes')]), 120);
  assert.equal(contarHuecos([]), 0);
});
