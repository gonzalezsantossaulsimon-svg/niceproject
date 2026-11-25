import test from 'node:test';
import assert from 'node:assert/strict';
import { validarComparacion, cursosPropuestos, estadoBusqueda, indicadores } from '../../frontend/js/planificacion-global-modelo.mjs';
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
