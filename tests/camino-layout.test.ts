import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_BOTTOM_OFFSET, BASE_STEP_Y, caminoSpacing, estimateLabelHeight } from '../src/experiences/constellation/caminoLayout.js';

test('Camino: con titulos cortos o medios el espaciado base no cambia', () => {
  for (const length of [0, 1, 18, 36, 54]) {
    const { stepY, bottomOffset } = caminoSpacing(length);
    assert.equal(stepY, BASE_STEP_Y);
    // Hasta 3 lineas el margen inferior se mantiene (como mucho 1px de diferencia).
    assert.ok(bottomOffset >= BASE_BOTTOM_OFFSET && bottomOffset <= BASE_BOTTOM_OFFSET + 1);
  }
});

test('Camino: un titulo largo separa mas las islas para que se vea completo', () => {
  const largo = caminoSpacing(120); // 7 lineas
  assert.ok(largo.stepY > BASE_STEP_Y);
  assert.ok(largo.bottomOffset > BASE_BOTTOM_OFFSET);
  // El rotulo cabe entre la roca de una isla y la de la siguiente.
  assert.ok(largo.stepY - 35 - 35 - 8 >= estimateLabelHeight(120));
});

test('Camino: el espaciado crece de forma monotona con la longitud del titulo', () => {
  let previous = 0;
  for (let length = 0; length <= 300; length += 10) {
    const { stepY, bottomOffset } = caminoSpacing(length);
    assert.ok(stepY >= previous);
    assert.ok(bottomOffset >= BASE_BOTTOM_OFFSET);
    previous = stepY;
  }
});

test('Camino: cubre un titulo de 141 caracteres medido en el navegador (rotulo de 123px)', () => {
  const { stepY } = caminoSpacing(141);
  // Rotulo real 123px + roca (35+35) + hueco (8): hace falta al menos 201px entre islas.
  assert.ok(stepY >= 123 + 35 + 35 + 8);
});
