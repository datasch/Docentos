import test from 'node:test';
import assert from 'node:assert/strict';
import type { TTSGuide } from '../src/types.js';

const guides = [
  { id: 'a', title: 'Bienvenida', scriptText: 'Empezamos ahora', mentorName: 'Ana', moduleId: 'm1', videoId: 'v1', voiceId: 'es-ES-Carlos' },
  { id: 'b', title: 'Cierre', scriptText: 'Terminamos hoy', mentorName: 'Luis', moduleId: 'm2', videoId: 'v2', voiceId: 'en-US-Elena' },
] as TTSGuide[];

test('filtra las guías TTS por texto y módulo sin alterar la lista original', async () => {
  const { filterTTSGuides } = await import('../src/lib/adminTTSFilter.js');
  assert.deepEqual(filterTTSGuides(guides, 'LECCIÓN UNO', 'ALL', { v1: 'Lección uno', v2: 'Lección dos' }).map((guide) => guide.id), ['a']);
  assert.deepEqual(filterTTSGuides(guides, '', 'm2', {}).map((guide) => guide.id), ['b']);
  assert.deepEqual(guides.map((guide) => guide.id), ['a', 'b']);
});
