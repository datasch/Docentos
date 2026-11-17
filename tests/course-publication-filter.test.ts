import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCoursesByPublication } from '../src/lib/coursePublication.js';
import { patchCourseCard } from '../src/lib/courseCardUpdate.js';
import type { Course } from '../src/types.js';

const draft = { id: 'draft', published: false } as Course;
const published = { id: 'published', published: true } as Course;
const courses = [draft, published];

test('publication filters select the requested state without changing course order or objects', () => {
  assert.equal(filterCoursesByPublication(courses, 'all'), courses);
  assert.deepEqual(filterCoursesByPublication(courses, 'published'), [published]);
  assert.deepEqual(filterCoursesByPublication(courses, 'draft'), [draft]);
  assert.equal(courses[0], draft);
});

test('publishing a draft moves it between filtered views using the updated course data', () => {
  const updated = patchCourseCard(courses, 'draft', { published: true });
  assert.deepEqual(filterCoursesByPublication(updated, 'draft'), []);
  assert.deepEqual(filterCoursesByPublication(updated, 'published').map(c => c.id), ['draft', 'published']);
  assert.deepEqual(filterCoursesByPublication([], 'published'), []);
});
