import assert from 'node:assert/strict';
import test from 'node:test';
import { SeleccionCurso } from '../../frontend/js/selector-curso.mjs';

const mejor = { id: 11, compatible: true, calificacionMateria: 9.8 };
const alterno = { id: 12, compatible: true, calificacionMateria: 9.2 };
const ocupado = { id: 13, compatible: false };
const candidatos = [mejor, alterno, ocupado];

test('ofrece las opciones en el orden de la API y solo selecciona por acción explícita', () => {
  const lista = new SeleccionCurso();
  lista.cargar(candidatos);
  assert.deepEqual(lista.visibles, candidatos);
  lista.elegir(ocupado.id);
  assert.equal(lista.actual, undefined);
  lista.cargar([mejor]);
  assert.equal(lista.actual, undefined);
  lista.elegir(mejor.id);
  assert.deepEqual(lista.visibles, [mejor]);
});

test('reabrir, conservar y reemplazar afecta únicamente al selector usado', () => {
  const profesores = new SeleccionCurso();
  const aulas = new SeleccionCurso();
  const aula = { id: 31, compatible: true };
  profesores.cargar(candidatos, mejor.id);
  aulas.cargar([aula], aula.id);
  profesores.abierto = true;
  assert.deepEqual(profesores.visibles, candidatos);
  assert.equal(profesores.actual, mejor);
  profesores.elegir(mejor.id);
  assert.deepEqual(profesores.visibles, [mejor]);
  profesores.abierto = true;
  profesores.elegir(alterno.id);
  assert.deepEqual(profesores.visibles, [alterno]);
  assert.deepEqual(aulas.visibles, [aula]);
});

test('al recalcular suspende la selección y la confirma con los datos más recientes', () => {
  const lista = new SeleccionCurso();
  lista.cargar(candidatos, alterno.id);
  lista.suspender();
  lista.suspender();
  assert.equal(lista.actual, undefined);
  assert.deepEqual(lista.visibles, []);
  const actualizado = { ...alterno, calificacionMateria: 8.7 };
  assert.equal(lista.cargar([actualizado, mejor]), false);
  assert.deepEqual(lista.visibles, [actualizado]);
});

test('descarta una elección que desaparece o deja de ser compatible aunque regrese después', () => {
  for (const nuevas of [[mejor, ocupado], [mejor, { ...alterno, compatible: false }], []]) {
    const lista = new SeleccionCurso();
    lista.cargar(candidatos, alterno.id);
    assert.equal(lista.cargar(nuevas), true);
    assert.equal(lista.actual, undefined);
    assert.equal(lista.abierto, true);
    assert.deepEqual(lista.visibles, nuevas);
    lista.cargar(candidatos);
    assert.equal(lista.actual, undefined);
  }
});
