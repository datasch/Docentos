/**
 * Notificaciones en tiempo real: formato SSE, a quién se avisa de una pregunta
 * y cómo se reparten los eventos entre las pestañas abiertas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NotificationHub,
  formatSseEvent,
  previewText,
  selectQuestionRecipients,
  toNotificationRecord,
} from '../server/notificationService.js';
import { unseenNotifications, upsertNotification } from '../src/lib/useNotifications.js';
import { relativeTime } from '../src/components/notifications/NotificationBell.js';

function fakeStream() {
  const chunks: string[] = [];
  let ended = false;
  return {
    chunks,
    get ended() {
      return ended;
    },
    write(chunk: string) {
      if (ended) throw new Error('closed');
      chunks.push(chunk);
      return true;
    },
    end() {
      ended = true;
    },
  };
}

test('formatSseEvent produce un evento SSE válido en una sola línea de datos', () => {
  const chunk = formatSseEvent('notification', { title: 'Hola\nmundo' }, 'n1');
  assert.equal(chunk, 'id: n1\nevent: notification\ndata: {"title":"Hola\\nmundo"}\n\n');
  assert.equal(formatSseEvent('ready', { unreadCount: 2 }), 'event: ready\ndata: {"unreadCount":2}\n\n');
});

test('previewText compacta espacios y recorta textos largos', () => {
  assert.equal(previewText('  hola \n\n  mundo  '), 'hola mundo');
  const long = previewText('a'.repeat(400), 20);
  assert.equal(long.length, 20);
  assert.ok(long.endsWith('…'));
});

test('selectQuestionRecipients: mentores asignados al curso y administradores activos', () => {
  const recipients = selectQuestionRecipients({
    courseMentors: [
      { id: 'mentor-a', role: 'MENTOR', isActive: true },
      { id: 'mentor-inactivo', role: 'MENTOR', isActive: false },
      { id: 'ex-mentor', role: 'MENTEE', isActive: true },
      { id: 'admin-1', role: 'ADMIN', isActive: true },
    ],
    admins: [
      { id: 'admin-1', isActive: true },
      { id: 'admin-2', isActive: true },
      { id: 'admin-inactivo', isActive: false },
    ],
    authorId: 'alumno',
  });
  assert.deepEqual(recipients.sort(), ['admin-1', 'admin-2', 'mentor-a']);
});

test('selectQuestionRecipients no avisa al propio autor', () => {
  const recipients = selectQuestionRecipients({
    courseMentors: [{ id: 'mentor-a', role: 'MENTOR', isActive: true }],
    admins: [{ id: 'admin-1', isActive: true }],
    authorId: 'admin-1',
  });
  assert.deepEqual(recipients, ['mentor-a']);
});

test('NotificationHub reparte a todas las pestañas del usuario y solo a él', () => {
  const hub = new NotificationHub(3);
  const a1 = fakeStream();
  const a2 = fakeStream();
  const b1 = fakeStream();
  hub.add('a', a1);
  hub.add('a', a2);
  hub.add('b', b1);
  assert.equal(hub.publish('a', 'notification', { x: 1 }, 'id1'), 2);
  assert.equal(a1.chunks.length, 1);
  assert.equal(a2.chunks.length, 1);
  assert.equal(b1.chunks.length, 0);
  assert.equal(hub.publish('nadie', 'notification', {}), 0);
});

test('NotificationHub limita las pestañas por usuario y libera al cerrar', () => {
  const hub = new NotificationHub(2);
  const s1 = fakeStream();
  const s2 = fakeStream();
  assert.equal(hub.add('a', s1), true);
  assert.equal(hub.add('a', s2), true);
  assert.equal(hub.canAccept('a'), false);
  assert.equal(hub.add('a', fakeStream()), false);
  hub.remove('a', s1);
  assert.equal(hub.canAccept('a'), true);
  assert.equal(hub.count('a'), 1);
});

test('NotificationHub descarta una pestaña rota sin frenar a las demás', () => {
  const hub = new NotificationHub(5);
  const ok = fakeStream();
  const broken = fakeStream();
  broken.end();
  hub.add('a', broken);
  hub.add('a', ok);
  assert.equal(hub.publish('a', 'notification', {}), 1);
  assert.equal(hub.count('a'), 1);
});

test('NotificationHub cierra las pestañas de una sesión al cerrar sesión', () => {
  const hub = new NotificationHub(5);
  const s1 = fakeStream();
  const s2 = fakeStream();
  const other = fakeStream();
  hub.add('a', s1, 'sesion-1');
  hub.add('a', s2, 'sesion-2');
  hub.add('b', other, 'sesion-1');
  assert.equal(hub.closeSession('sesion-1'), 2);
  assert.equal(s1.ended, true);
  assert.equal(other.ended, true);
  assert.equal(s2.ended, false);
  assert.equal(hub.count(), 1);
});

test('toNotificationRecord tolera datos corruptos', () => {
  const record = toNotificationRecord({
    id: 'n1',
    type: 'qna.question',
    title: 't',
    body: 'b',
    dataJson: 'no es json',
    readAt: null,
    createdAt: new Date('2026-11-12T10:00:00Z'),
  });
  assert.deepEqual(record.data, {});
  assert.equal(record.readAt, null);
  assert.equal(record.createdAt, '2026-11-12T10:00:00.000Z');
});

test('cliente: la lista no duplica avisos y detecta los no vistos', () => {
  const n = (id: string) => ({ id, type: 'qna.question' as const, title: id, body: '', data: {}, readAt: null, createdAt: '2026-11-12T10:00:00Z' });
  let list = upsertNotification([], n('1'));
  list = upsertNotification(list, n('2'));
  list = upsertNotification(list, n('1'));
  assert.deepEqual(list.map((x) => x.id), ['1', '2']);
  assert.equal(upsertNotification(list, n('3'), 2).length, 2);
  assert.deepEqual(unseenNotifications(new Set(['1']), [n('1'), n('2')]).map((x) => x.id), ['2']);
});

test('cliente: tiempo relativo legible', () => {
  const now = new Date('2026-11-12T12:00:00Z').getTime();
  assert.equal(relativeTime('2026-11-12T11:59:30Z', now), 'ahora');
  assert.equal(relativeTime('2026-11-12T11:55:00Z', now), 'hace 5 min');
  assert.equal(relativeTime('2026-11-12T09:00:00Z', now), 'hace 3 h');
  assert.equal(relativeTime('2026-11-11T11:00:00Z', now), 'ayer');
});
