import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarAsignacionesGlobales } from '../services/busqueda-global.js';

function opcion(p, g, s, inicio = '17:00', fin = '19:00', max = 20, actual = 0, dia = 'Viernes') {
  return { profesor: { id: p }, grupo: { id: g }, salon: { id: s }, carga: { actual, maxima: max }, horario: { horarios: [{ dia, horaInicio: inicio, horaFin: fin }] } };
}
function necesidad(id, alternativas, horas = 4) {
  return { necesidad: { id, materia: { horasSemanales: horas } }, alternativas };
}

test('global retrocede y usa opciones posteriores a las tres primeras para maximizar cobertura', () => {
  const entradas = [
    necesidad(1, [opcion(1,1,1),opcion(2,1,2),opcion(3,1,3),opcion(4,1,4)]),
    necesidad(2, [opcion(1,2,1),opcion(2,2,2),opcion(3,2,3),opcion(1,2,2)]),
    necesidad(3, [opcion(1,3,1),opcion(2,3,2),opcion(3,3,3),opcion(2,3,3)]),
    necesidad(4, [opcion(1,4,1),opcion(2,4,2),opcion(3,4,3),opcion(3,4,1)])
  ];
  const copia = structuredClone(entradas);
  const r = buscarAsignacionesGlobales(entradas);
  assert.equal(r.asignaciones.length, 4);
  assert.equal(r.asignaciones[0].alternativa.profesor.id, 4);
  assert.equal(r.busqueda.coberturaOptima, true);
  assert.deepEqual(entradas, copia);
  assert.deepEqual(buscarAsignacionesGlobales(entradas), r);
});

test('global bloquea solapes parciales por cada recurso, no por ID de franja', () => {
  const fija = { profesorId: 1, grupoId: 2, salonId: 3, dia: 'Viernes', horaInicio: '17:00', horaFin: '19:00' };
  for (const a of [opcion(1,5,5,'18:00','19:00'),opcion(5,2,5,'18:00','19:00'),opcion(5,5,3,'18:00','19:00')]) {
    assert.equal(buscarAsignacionesGlobales([necesidad(1,[a])],[fija]).asignaciones.length,0);
  }
  assert.equal(buscarAsignacionesGlobales([necesidad(1,[opcion(1,2,3,'15:00','17:00')])],[fija]).asignaciones.length,1);
  assert.equal(buscarAsignacionesGlobales([necesidad(1,[opcion(5,5,5)])],[fija]).asignaciones.length,1);
});

test('global respeta carga acumulada aun cuando no hay solapes de horario', () => {
  const entradas = [necesidad(1,[opcion(1,1,1,'07:00','09:00',10,2)],5), necesidad(2,[opcion(1,2,2,'09:00','11:00',10,2)],5)];
  const r = buscarAsignacionesGlobales(entradas);
  assert.equal(r.asignaciones.length,1);
  assert.equal(r.busqueda.coberturaOptima,true);
});

test('global declara búsqueda incompleta al alcanzar el presupuesto', () => {
  const entradas = [necesidad(1,[opcion(1,1,1)]),necesidad(2,[opcion(2,2,2)])];
  const r = buscarAsignacionesGlobales(entradas,[],1);
  assert.equal(r.asignaciones.length,1);
  assert.equal(r.busqueda.limiteAlcanzado,true);
  assert.equal(r.busqueda.coberturaOptima,false);
  assert.equal(r.busqueda.pasos,1);
});

test('global maneja ausencia de necesidades u opciones', () => {
  const r = buscarAsignacionesGlobales([necesidad(1,[])]);
  assert.deepEqual(r.asignaciones,[]);
  assert.equal(r.busqueda.coberturaOptima,true);
  assert.throws(() => buscarAsignacionesGlobales([],[],0),RangeError);
});
