/**
 * "Visto de forma limpia": solo cuenta lo reproducido de verdad.
 *
 * La barra, los +10 s y las teclas numéricas no suman; repetir un tramo no
 * cuenta dos veces y ver a 1.5x o 2x sí cuenta.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NATURAL_STEP,
  WATCH_THRESHOLD,
  addWatchedSegment,
  isCleanlyWatched,
  parseWatchRanges,
  registerPlaybackTick,
  watchedFraction,
  watchedSeconds,
  type WatchRanges,
} from '../src/lib/watchProgress.js';

/** Simula lecturas del reproductor entre `from` y `to` cada `interval` segundos a velocidad `rate`. */
function play(ranges: WatchRanges, from: number, to: number, { interval = 0.5, rate = 1 } = {}) {
  let prev: number | null = from;
  let t = from;
  while (t < to) {
    t = Math.min(to, t + interval * rate);
    ranges = registerPlaybackTick(ranges, prev, t);
    prev = t;
  }
  return { ranges, last: prev };
}

test('addWatchedSegment fusiona tramos que se tocan o se solapan', () => {
  let r: WatchRanges = [];
  r = addWatchedSegment(r, 10, 20);
  r = addWatchedSegment(r, 0, 5);
  r = addWatchedSegment(r, 5, 10);
  assert.deepEqual(r, [[0, 20]]);
  r = addWatchedSegment(r, 30.4, 39.2);
  assert.deepEqual(r, [[0, 20], [30, 40]]);
  r = addWatchedSegment(r, 15, 35);
  assert.deepEqual(r, [[0, 40]]);
});

test('ver de corrido desbloquea al 90%', () => {
  const duration = 600;
  const almost = play([], 0, 530).ranges;
  assert.equal(isCleanlyWatched(almost, duration), false);
  const enough = play([], 0, 541).ranges;
  assert.equal(isCleanlyWatched(enough, duration), true);
  assert.ok(watchedFraction(enough, duration) >= WATCH_THRESHOLD);
});

test('arrastrar la barra hasta el final no cuenta', () => {
  let r: WatchRanges = play([], 0, 5).ranges;
  r = registerPlaybackTick(r, 5, 598);
  r = play(r, 598, 600).ranges;
  assert.ok(watchedSeconds(r) <= 8);
  assert.equal(isCleanlyWatched(r, 600), false);
});

test('saltos de +10 s cada 20 s se quedan por debajo del 90%', () => {
  const duration = 600;
  let r: WatchRanges = [];
  let t = 0;
  while (t < duration) {
    const segment = play(r, t, Math.min(duration, t + 20));
    r = segment.ranges;
    t = Math.min(duration, t + 20);
    // +10 s: un salto, no suma.
    r = registerPlaybackTick(r, t, Math.min(duration, t + 10));
    t = Math.min(duration, t + 10);
  }
  assert.ok(watchedFraction(r, duration) < 0.7);
  assert.equal(isCleanlyWatched(r, duration), false);
});

test('repetir un tramo no cuenta doble', () => {
  let r = play([], 0, 60).ranges;
  r = play(r, 0, 60).ranges;
  r = play(r, 30, 60).ranges;
  assert.equal(watchedSeconds(r), 60);
});

test('ver a 2x cuenta', () => {
  const duration = 300;
  const r = play([], 0, duration, { interval: 1, rate: 2 }).ranges;
  assert.equal(isCleanlyWatched(r, duration), true);
  const fast = play([], 0, duration, { interval: 1, rate: 1.5 }).ranges;
  assert.equal(isCleanlyWatched(fast, duration), true);
});

test('retroceder o pausar no suma', () => {
  let r = play([], 0, 10).ranges;
  r = registerPlaybackTick(r, 10, 10); // pausa
  r = registerPlaybackTick(r, 10, 4); // retroceso
  r = registerPlaybackTick(r, null, 50); // primera lectura sin referencia
  r = registerPlaybackTick(r, 50, 50 + MAX_NATURAL_STEP + 0.1); // salto
  assert.equal(watchedSeconds(r), 10);
});

test('sin duración (Infinity o 0) no hay desbloqueo', () => {
  const r = play([], 0, 100).ranges;
  assert.equal(watchedFraction(r, Infinity), 0);
  assert.equal(watchedFraction(r, 0), 0);
  assert.equal(watchedFraction(r, Number.NaN), 0);
  assert.equal(isCleanlyWatched(r, Infinity), false);
});

test('parseWatchRanges tolera datos corruptos y re-fusiona', () => {
  assert.deepEqual(parseWatchRanges('no es json'), []);
  assert.deepEqual(parseWatchRanges(null), []);
  assert.deepEqual(parseWatchRanges('{"a":1}'), []);
  assert.deepEqual(parseWatchRanges('[[0,10],["x",3],[5,20],[30],[40,35],[50.2,60.1]]'), [[0, 20], [50, 61]]);
});
