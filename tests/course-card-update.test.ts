import test from 'node:test';
import assert from 'node:assert/strict';
import { patchCourseCard } from '../src/lib/courseCardUpdate.js';
import type { Course } from '../src/types.js';

const first = { id: 'first', title: 'Primer curso', published: false, openToAllRegistered: false, modules: [] } as Course;
const second = { id: 'second', title: 'Segundo curso', published: true, openToAllRegistered: true, modules: [] } as Course;

test('updating one course preserves list order and the other card identities', () => {
  const before = [first, second];
  const after = patchCourseCard(before, 'first', { published: true });
  assert.deepEqual(after.map(c => c.id), ['first', 'second']);
  assert.equal(after[0].published, true);
  assert.equal(after[0].openToAllRegistered, false);
  assert.equal(after[1], second);
  assert.equal(first.published, false);
});

test('changing member access preserves publication and the existing syllabus', () => {
  const after = patchCourseCard([first, second], 'second', { openToAllRegistered: false });
  assert.equal(after[0], first);
  assert.equal(after[1].openToAllRegistered, false);
  assert.equal(after[1].published, true);
  assert.equal(after[1].modules, second.modules);
});
