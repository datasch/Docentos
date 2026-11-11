import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboardPath = new URL('../src/components/MentorDashboard.tsx', import.meta.url);

test('mentor dashboard uses the redesigned workspace shell and neutral navigation', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(source, /mentor-workspace/);
  assert.match(source, /data-mentor-ui="modern"/);
  assert.match(source, /mentor\.workspaceBadge/);
  assert.match(source, /mentor\.workspaceDescription/);
  assert.match(source, /Operación de mentoría/);
  assert.match(source, /transition-colors cursor-pointer/);
  assert.match(source, /mentor-mentees-panel/);
  assert.match(source, /mentor-qna-panel/);
  assert.match(source, /mentor-quiz-panel/);
  assert.match(source, /mentor-youtube-panel/);
  assert.doesNotMatch(source, /border-purple-500 text-purple-400/);
  assert.doesNotMatch(source, /border-red-500 text-red-400/);
});
