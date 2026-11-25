import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeDefinitions = [
  ["get", "/api/periodos"],
  ["post", "/api/periodos"],
  ["put", "/api/periodos/:id"],
  ["get", "/api/periodos/:id/conflictos"],
  ["get", "/api/periodos/:id/necesidades-planificacion"],
  ["post", "/api/periodos/:id/necesidades-planificacion"],
  ["put", "/api/necesidades-planificacion/:id"],
  ["delete", "/api/necesidades-planificacion/:id"],
  ["get", "/api/periodos/:id/planificacion"],
  ["post", "/api/periodos/:id/planificacion-global"],
  ["post", "/api/periodos/:id/propuestas-planificacion"],
  ["post", "/api/periodos/:id/aplicar-propuesta"],
  ["get", "/api/materias/:id/patrones-horarios"],
  ["get", "/api/materias/:id/profesores-recomendados"],
  ["get", "/api/salones/disponibles"],
  ["get", "/api/profesores/:id/calificaciones"],
  ["put", "/api/profesores/:id/calificaciones"],
  ["delete", "/api/profesores/:id/calificaciones/:materiaId"],
  ["get", "/api/profesores/:id/disponibilidad"],
  ["put", "/api/profesores/:id/disponibilidad"],
  ["put", "/api/materias/:id/requisitos"],
  ["put", "/api/salones/:id/caracteristicas"]
];

test('cada ruta nueva se declara exactamente una vez en el scope superior', async () => {
  const server = await readFile(path.join(backendDir, 'server.js'), 'utf8');
  for (const [method, route] of routeDefinitions) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`^app\\.${method}\\('${escaped}'`, 'gm');
    const matches = [...server.matchAll(expression)];
    assert.equal(matches.length, 1, `${method.toUpperCase()} ${route}`);
  }
  assert.doesNotMatch(
    server.slice(
      server.indexOf("app.delete('/api/cursos/:id'"),
      server.indexOf("app.post('/api/login'")
    ),
    /^\s+app\.(?:get|post|put|delete)\(/m
  );
});
