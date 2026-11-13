/**
 * Al pulsar «Tu consulta fue respondida» se abre el curso y la lección donde se
 * hizo la pregunta, no el último curso que estaba abierto.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// sessionStorage mínimo para Node.
const store = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

const { LESSON_FOCUS_STORAGE_KEY, readLessonFocus } = await import('../src/lib/useNotifications.js');

test('solo el curso de la respuesta recoge la lección pendiente', () => {
  store.set(LESSON_FOCUS_STORAGE_KEY, JSON.stringify({ courseId: 'curso-n8n', videoId: 'leccion-3' }));
  // Otro curso (el último que estaba abierto) no la toma ni la borra.
  assert.equal(readLessonFocus('curso-ciberseguridad'), null);
  assert.ok(store.has(LESSON_FOCUS_STORAGE_KEY));
  // El curso correcto la recibe y la consume: no se vuelve a abrir sola.
  assert.deepEqual(readLessonFocus('curso-n8n'), { courseId: 'curso-n8n', videoId: 'leccion-3' });
  assert.equal(store.has(LESSON_FOCUS_STORAGE_KEY), false);
  assert.equal(readLessonFocus('curso-n8n'), null);
});

test('se puede consultar sin consumir, y tolera datos corruptos', () => {
  store.set(LESSON_FOCUS_STORAGE_KEY, JSON.stringify({ courseId: 'c1', videoId: 'v1' }));
  assert.deepEqual(readLessonFocus('c1', false), { courseId: 'c1', videoId: 'v1' });
  assert.ok(store.has(LESSON_FOCUS_STORAGE_KEY));
  store.set(LESSON_FOCUS_STORAGE_KEY, 'no es json');
  assert.equal(readLessonFocus('c1'), null);
});
