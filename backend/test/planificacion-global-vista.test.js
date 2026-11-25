import test from 'node:test';
import assert from 'node:assert/strict';
import { validarComparacion, cursosPropuestos, cursosRegistrados, cursosPorOrigen, horarioVisible, estadoBusqueda, indicadores } from '../../frontend/js/planificacion-global-modelo.mjs';
import { sesionesDe, distribuirCarriles } from '../../frontend/js/horario-semanal-modelo.mjs';

function fixture() {
  const plan = id => ({ id, resumen:{nuevas:1,pendientesDespues:0,coberturaProyectada:100,calificacionPromedioNuevas:9}, metricas:{cargaRmsPorcentaje:40,cargaMaximaPorcentaje:50,minutosHuecos:60}, busqueda:{coberturaOptima:true,objetivoOptimo:false,pasos:20,limite:20,limiteAlcanzado:true}, sinAsignar:[], asignaciones:[{necesidadId:1,alternativa:{materia:{id:1},profesor:{id:2},grupo:{id:3},salon:{id:4},horario:{horarios:[{dia:'Viernes',horaInicio:'18:00',horaFin:'19:00'}]},calificacion:9,carga:{resultante:5,maxima:10}}}] });
  return {ok:true,modo:'ABC',soloLectura:true,aplicable:false,periodo:{id:2},conflictosExistentes:[],planes:['A','B','C'].map(plan)};
}
test('vista global acepta tres planes de solo lectura del periodo correcto',()=>{
  const r=fixture(); assert.equal(validarComparacion(r,'2'),r);
  assert.throws(()=>validarComparacion(r,3)); assert.throws(()=>validarComparacion({...r,aplicable:true},2));
  assert.throws(()=>validarComparacion({...r,planes:[r.planes[0],r.planes[0],r.planes[2]]},2));
});
test('vista global adapta propuestas sin mutar ni confundir IDs de cursos reales',()=>{
  const r=fixture(), antes=structuredClone(r), cursos=cursosPropuestos(r.planes[0],2);
  assert.equal(cursos[0].id,-1); assert.equal(cursos[0].estado,'PROPUESTA'); assert.equal(cursos[0].profesorId,2);
  const s=sesionesDe(cursos).sesiones; assert.equal(s[0].fin-s[0].inicio,60); assert.equal(distribuirCarriles(s)[0].carril,0);
  assert.deepEqual(r,antes);
});
test('vista global conserva incertidumbre de búsqueda y no inventa indicadores',()=>{
  const p=fixture().planes[0]; assert.match(estadoBusqueda(p.busqueda),/Criterio no demostrado óptimo/); assert.match(estadoBusqueda(p.busqueda),/límite alcanzado/);
  assert.deepEqual(indicadores(p),[1,0,100,9,40,50,60]); p.resumen.calificacionPromedioNuevas=null; assert.equal(indicadores(p)[3],null);
});

function registrado(id, periodoId = 2) {
  return { id, periodoId, profesorId: 5, grupoId: 3, salonId: 6,
    horarios: [{ id: 40, dia: 'Viernes', horaInicio: '17:00', horaFin: '19:00' }] };
}

test('el consolidado identifica curso y necesidad por origen y aísla el periodo, incluso con folios iguales', () => {
  const lista = [registrado(1), registrado(2, 3), registrado(3, null)];
  const antes = structuredClone(lista);
  const existentes = cursosRegistrados(lista, '2');
  const [propuesta] = cursosPropuestos(fixture().planes[0], 2);
  assert.deepEqual(existentes.map(c => c.claveVisual), ['curso:1']);
  assert.equal(propuesta.claveVisual, 'propuesta:2:A:1');
  assert.equal(propuesta.necesidadId, existentes[0].id);
  assert.deepEqual(lista, antes);
});

test('origen y recurso filtran juntos los cursos y las sesiones válidas de cada fuente', () => {
  const reales = cursosRegistrados([registrado(1), { ...registrado(2), horarios: [] }], 2);
  const cursos = [...reales, ...cursosPropuestos(fixture().planes[0], 2)];
  const todos = cursosPorOrigen(cursos, 'todos');
  const vista = horarioVisible(todos, 'grupoId', '3');
  assert.deepEqual(vista.conteos, { existente: { cursos: 2, sesiones: 1 }, propuesto: { cursos: 1, sesiones: 1 } });
  assert.deepEqual(vista.sinHorario.map(c => c.id), [2]);
  for (const [origen, campo, id, esperados] of [
    ['existente', 'profesorId', '5', [1]], ['propuesto', 'salonId', '4', [-1]],
    ['todos', 'salonId', '6', [1]], ['propuesto', 'profesorId', '5', []],
    ['todos', 'grupoId', '99', []]
  ]) {
    const r = horarioVisible(cursosPorOrigen(cursos, origen), campo, id);
    assert.deepEqual(r.sesiones.map(s => s.curso.id), esperados);
  }
});

test('el viernes conserva una y dos horas en carriles distintos con IDs de franja diferentes', () => {
  const cursos = [...cursosRegistrados([registrado(1)], 2), ...cursosPropuestos(fixture().planes[0], 2)];
  cursos[1].horarios[0].id = 41;
  const carriles = distribuirCarriles(horarioVisible(cursos).sesiones);
  assert.deepEqual(carriles.map(s => s.horario.id), [40, 41]);
  assert.deepEqual(carriles.map(s => [s.curso.origen, s.fin - s.inicio, s.carril, s.carriles]),
    [['existente', 120, 0, 2], ['propuesto', 60, 1, 2]]);
});

test('una alternativa con periodo ajeno invalida la comparación recibida', () => {
  const r = fixture();
  r.planes[1].periodo = { id: 3 };
  assert.throws(() => validarComparacion(r, 2), /plan B/);
});

test('cambiar de A a B y C conserva el curso y reemplaza las sesiones y la clave de la propuesta', () => {
  const { planes } = fixture();
  const existentes = cursosRegistrados([registrado(1)], 2);
  for (const [i, plan] of planes.entries()) {
    const dia = ['Lunes', 'Miércoles', 'Viernes'][i];
    plan.asignaciones[0].alternativa.horario.horarios[0].dia = dia;
    const { sesiones } = horarioVisible([...existentes, ...cursosPropuestos(plan, 2)]);
    assert.deepEqual(sesiones.map(s => [s.curso.claveVisual, s.dia]),
      [['curso:1', 'Viernes'], [`propuesta:2:${plan.id}:1`, dia]]);
  }
});

test('el calendario distingue una lista vacía, una franja inválida y una respuesta de cursos fallida', () => {
  const vacio = horarioVisible(cursosRegistrados([], 2));
  assert.deepEqual(vacio.conteos, { existente: { cursos: 0, sesiones: 0 }, propuesto: { cursos: 0, sesiones: 0 } });
  const r = horarioVisible(cursosRegistrados([{ ...registrado(1), horarios: [{ dia: 'Viernes', horaInicio: 'xx', horaFin: '19:00' }] }], 2));
  assert.equal(r.conteos.existente.cursos, 1);
  assert.equal(r.invalidas.length, 1);
  assert.equal(r.sesiones.length, 0);
  for (const datos of [null, { error: 'Error de lectura' }, [{}], [{ ...registrado(1), horarios: null }]]) {
    assert.throws(() => cursosRegistrados(datos, 2), /respuesta|incompletos/);
  }
});
