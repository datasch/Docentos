import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_USER_STRIKES, nextStrikes } from '../src/lib/moderation.js';

test('nextStrikes: poner un strike y quitarlo por error deja al usuario como estaba', () => {
  assert.equal(nextStrikes(nextStrikes(2, 'add_strike'), 'remove_strike'), 2);
});

test('nextStrikes: quitar nunca baja de 0', () => {
  assert.equal(nextStrikes(0, 'remove_strike'), 0);
  assert.equal(nextStrikes(-3, 'remove_strike'), 0);
});

test('nextStrikes: sumar respeta el máximo y los valores raros', () => {
  assert.equal(nextStrikes(MAX_USER_STRIKES, 'add_strike'), MAX_USER_STRIKES);
  assert.equal(nextStrikes(Number.NaN, 'add_strike'), 1);
  assert.equal(nextStrikes(3.9, 'remove_strike'), 2);
});

test('nextStrikes: reset deja en 0', () => {
  assert.equal(nextStrikes(7, 'reset'), 0);
});
