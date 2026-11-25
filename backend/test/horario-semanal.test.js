import assert from 'node:assert/strict';
import test from 'node:test';
import { cursosDelPeriodo, sesionesDe, limitesSemana, distribuirCarriles, estadosDe, minutos } from '../../frontend/js/horario-semanal-modelo.mjs';

const curso = (id, periodoId, profesorId, horarios, grupoId = 1, salonId = 1) => ({ id, periodoId, profesorId, grupoId, salonId, horarios });
const h = (dia, horaInicio, horaFin) => ({ dia, horaInicio, horaFin });

test('horario visual aísla periodos y filtra por identificador de recurso', () => {
  const lista = [curso(1,1,3,[],2,4), curso(2,1,5,[],3,6), curso(3,2,3,[],2,4), curso(4,null,3,[],2,4)];
  assert.deepEqual(cursosDelPeriodo(lista,'1').map(c=>c.id), [1,2]);
  for (const [campo,id] of [['profesorId','3'],['grupoId','2'],['salonId','4']]) assert.deepEqual(cursosDelPeriodo(lista,'1',campo,id).map(c=>c.id),[1]);
  assert.equal(cursosDelPeriodo(lista,'1','profesorId','999').length,0);
});
test('horario visual conserva viernes de una hora y bloques de tarde', () => {
  const datos = sesionesDe([curso(1,1,1,[h('Lunes','17:00','19:00'),h('Miércoles','17:00','19:00'),h('Viernes','18:00','19:00')])]);
  assert.deepEqual(datos.sesiones.map(s=>s.fin-s.inicio), [120,120,60]);
  const limites = limitesSemana(datos.sesiones);
  assert.equal(limites.inicio,420); assert.equal(limites.fin,1140); assert.equal(limites.dias.length,5);
});
test('horario visual separa intervalos simultáneos y reutiliza carriles contiguos', () => {
  const { sesiones } = sesionesDe([curso(1,1,1,[h('Viernes','17:00','19:00')]),curso(2,1,2,[h('Viernes','18:00','19:00')]),curso(3,1,3,[h('Viernes','19:00','20:00')])]);
  const r = distribuirCarriles(sesiones);
  assert.deepEqual(r.map(s=>[s.carril,s.carriles]), [[0,2],[1,2],[0,1]]);
});
test('horario visual distingue datos inválidos y expande límites para franjas adicionales', () => {
  const r = sesionesDe([curso(1,1,1,[h('Sábado','06:30','20:30'),h('Lunes','19:00','17:00'),h('Lunes','xx','19:00')]),curso(2,1,2,[])]);
  assert.equal(r.invalidas.length,2); assert.equal(r.sinHorario.length,1); assert.equal(r.sesiones.length,1);
  const limites = limitesSemana(r.sesiones); assert.equal(limites.inicio,360); assert.equal(limites.fin,1260); assert.equal(limites.dias.length,6);
  assert.ok(Number.isNaN(minutos('24:00')));
});
test('horario visual usa conflictos y advertencias del backend con prioridad bloqueante', () => {
  const estados = estadosDe({ detalleAdvertencias:[{cursoId:1,motivo:'Carga'},{cursoId:2,motivo:'Carga'}], conflictos:[{cursoId:1,motivo:'Profesor ocupado'}] });
  assert.equal(estados.get('1').tipo,'conflicto'); assert.equal(estados.get('2').tipo,'advertencia'); assert.equal(estados.has('3'),false);
});
