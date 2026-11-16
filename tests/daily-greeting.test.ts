import test from 'node:test';
import assert from 'node:assert/strict';
import { decideGreeting, greetingForThisVisit, limaDateKey, resetGreetingCache } from '../src/lib/dailyGreeting.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

test('Saludo: el dia cambia a medianoche de Peru (UTC-5), no en UTC', () => {
  // 04:59 UTC = 23:59 del dia anterior en Lima; 05:00 UTC = 00:00 en Lima.
  assert.equal(limaDateKey(new Date('2026-11-17T04:59:59Z')), '2026-11-16');
  assert.equal(limaDateKey(new Date('2026-11-17T05:00:00Z')), '2026-11-17');
  // Fin de anio: el cambio de anio tambien sigue la hora de Peru.
  assert.equal(limaDateKey(new Date('2027-01-01T04:59:59Z')), '2026-12-31');
  assert.equal(limaDateKey(new Date('2027-01-01T05:00:00Z')), '2027-01-01');
});

test('Saludo: primera visita del dia da la bienvenida y las siguientes saludan de nuevo', () => {
  const storage = memoryStorage();
  const morning = new Date('2026-11-16T14:00:00Z');
  assert.equal(decideGreeting('u1', morning, storage), 'welcome');
  assert.equal(decideGreeting('u1', new Date('2026-11-16T20:00:00Z'), storage), 'back');
  assert.equal(decideGreeting('u1', new Date('2026-11-17T04:30:00Z'), storage), 'back');
});

test('Saludo: se reinicia al cambiar el dia en Peru', () => {
  const storage = memoryStorage();
  assert.equal(decideGreeting('u1', new Date('2026-11-16T23:00:00Z'), storage), 'welcome');
  assert.equal(decideGreeting('u1', new Date('2026-11-17T04:59:00Z'), storage), 'back');
  assert.equal(decideGreeting('u1', new Date('2026-11-17T05:01:00Z'), storage), 'welcome');
  assert.equal(decideGreeting('u1', new Date('2026-11-17T09:00:00Z'), storage), 'back');
});

test('Saludo: cada usuario lleva su propia cuenta', () => {
  const storage = memoryStorage();
  const now = new Date('2026-11-16T14:00:00Z');
  assert.equal(decideGreeting('u1', now, storage), 'welcome');
  assert.equal(decideGreeting('u2', now, storage), 'welcome');
  assert.equal(decideGreeting('u1', now, storage), 'back');
});

test('Saludo: sin almacenamiento o con almacenamiento roto siempre da la bienvenida', () => {
  const now = new Date('2026-11-16T14:00:00Z');
  assert.equal(decideGreeting('u1', now, null), 'welcome');
  const broken = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.equal(decideGreeting('u1', now, broken), 'welcome');
});

test('Saludo: un dato guardado corrupto no rompe nada', () => {
  const storage = memoryStorage({ 'docentos:greeting:u1': 'basura' });
  assert.equal(decideGreeting('u1', new Date('2026-11-16T14:00:00Z'), storage), 'welcome');
  assert.equal(storage.data['docentos:greeting:u1'], '2026-11-16');
});

test('Saludo: dentro de una misma carga de pagina el resultado no cambia', () => {
  resetGreetingCache();
  // Sin window ni localStorage (entorno de pruebas) siempre es bienvenida, y queda fijado.
  assert.equal(greetingForThisVisit('u1'), 'welcome');
  assert.equal(greetingForThisVisit('u1'), 'welcome');
  resetGreetingCache();
});
