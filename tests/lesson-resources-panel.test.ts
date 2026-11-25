import test from 'node:test';
import assert from 'node:assert/strict';
import { groupResources } from '../src/components/course/ResourcesPanel.js';
import type { Course } from '../src/types.js';

const resource = (id: string, extra: Record<string, unknown> = {}) => ({ id, courseId: 'c', title: id, kind: 'FILE', source: 'EXTERNAL_URL', order: 1, downloadUrl: `/r/${id}`, ...extra });
const video = (id: string) => ({ id, title: id });

const course = {
  id: 'c',
  resources: [resource('curso')],
  modules: [
    { id: 'm1', videos: [video('l1'), video('l2')], resources: [resource('r-l1', { videoId: 'l1' }), resource('r-m1'), resource('r-l2', { videoId: 'l2' })] },
    { id: 'm2', videos: [video('l3')], resources: [resource('r-l3', { videoId: 'l3' }), resource('r-m2')] },
  ],
} as unknown as Course;

const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

test('cada lección muestra solo sus recursos', () => {
  assert.deepEqual(ids(groupResources(course, 0, 'l2').lesson), ['r-l2']);
  assert.deepEqual(ids(groupResources(course, 1, 'l3').lesson), ['r-l3']);
});

test('el material sin lección sale solo en la primera lección de su módulo, no en todas', () => {
  assert.deepEqual(ids(groupResources(course, 0, 'l1').general), ['r-m1', 'curso']);
  assert.deepEqual(ids(groupResources(course, 0, 'l2').general), []);
  assert.deepEqual(ids(groupResources(course, 1, 'l3').general), ['r-m2'], 'el del curso solo sale en la primera lección del curso');
});

test('sin lección activa no se muestra nada', () => {
  const none = groupResources(course, 0, null);
  assert.deepEqual([ids(none.lesson), ids(none.general)], [[], []]);
});
