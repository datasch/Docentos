import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboardPath = new URL('../src/components/MentorDashboard.tsx', import.meta.url);
const youtubeBuilderPath = new URL('../src/components/YouTubeCourseBuilder.tsx', import.meta.url);

test('mentor dashboard uses the redesigned workspace shell and neutral navigation', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(source, /mentor-workspace/);
  assert.match(source, /data-mentor-ui="modern"/);
  assert.match(source, /transition-colors cursor-pointer/);
  assert.match(source, /mentor-mentees-panel/);
  assert.match(source, /mentor-qna-panel/);
  assert.match(source, /mentor-quiz-panel/);
  // El panel del asistente de YouTube ya no lo envuelve el dashboard: lo lleva el propio componente.
  assert.match(await readFile(youtubeBuilderPath, 'utf8'), /mentor-youtube-panel/);
  assert.doesNotMatch(source, /border-purple-500 text-purple-400/);
  assert.doesNotMatch(source, /border-red-500 text-red-400/);
});
