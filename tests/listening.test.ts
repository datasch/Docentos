import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import {
  classifyNps,
  computeNps,
  LISTENING_LIMITS,
  moodSentiment,
} from '../src/lib/listening.js';
import {
  createListeningSchema,
  csvCell,
  latestNpsPerUser,
  summarizeListening,
  toStaffEntry,
  weekStartOf,
  type SummaryRow,
} from '../server/listeningService.js';

// --- Lógica pura -------------------------------------------------------------

test('Buzón: el NPS clasifica en los cortes estándar 6/7 y 8/9', () => {
  assert.equal(classifyNps(0), 'DETRACTOR');
  assert.equal(classifyNps(6), 'DETRACTOR');
  assert.equal(classifyNps(7), 'PASSIVE');
  assert.equal(classifyNps(8), 'PASSIVE');
  assert.equal(classifyNps(9), 'PROMOTER');
  assert.equal(classifyNps(10), 'PROMOTER');
});

test('Buzón: computeNps = %promotores − %detractores, y nulo si nadie respondió', () => {
  assert.deepEqual(computeNps([]), { score: null, promoters: 0, passives: 0, detractors: 0, responses: 0 });
  // 2 promotores, 1 pasivo, 1 detractor → (2-1)/4 = 25
  assert.equal(computeNps([10, 9, 7, 3]).score, 25);
  assert.equal(computeNps([10, 10, 9]).score, 100);
  assert.equal(computeNps([0, 5, 6]).score, -100);
  // Solo pasivos: ni suma ni resta, pero SÍ hay respuestas (0 ≠ sin datos).
  assert.equal(computeNps([7, 8]).score, 0);
});

test('Buzón: las caritas se agrupan en sentimiento 1-2 / 3 / 4-5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(moodSentiment), ['NEGATIVE', 'NEGATIVE', 'NEUTRAL', 'POSITIVE', 'POSITIVE']);
});

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 12));
const row = (over: Partial<SummaryRow>): SummaryRow => ({
  userId: 'u1',
  type: 'SUGGESTION',
  topic: 'CONTENT',
  mood: 3,
  npsScore: null,
  status: 'NEW',
  courseId: null,
  courseTitle: null,
  createdAt: day(1),
  repliedAt: null,
  ...over,
});

test('Buzón: el NPS cuenta a cada persona una vez, con su nota más reciente', () => {
  const rows = [
    row({ userId: 'a', npsScore: 0, createdAt: day(1) }),
    row({ userId: 'a', npsScore: 10, createdAt: day(5) }), // la más reciente de "a"
    row({ userId: 'b', npsScore: 3, createdAt: day(2) }),
    row({ userId: 'c', npsScore: null, createdAt: day(3) }), // sin nota: no cuenta
  ];
  assert.deepEqual(latestNpsPerUser(rows).sort((a, b) => a - b), [3, 10]);
});

test('Buzón: el resumen calcula medias, distribución, pendientes y tiempo de respuesta', () => {
  const rows = [
    row({ userId: 'a', mood: 5, npsScore: 10, topic: 'TEACHING', courseId: 'c1', courseTitle: 'Curso 1', createdAt: day(1) }),
    row({ userId: 'b', mood: 1, npsScore: 2, topic: 'BUG', type: 'COMPLAINT', courseId: 'c1', courseTitle: 'Curso 1', createdAt: day(2),
      status: 'ANSWERED', repliedAt: new Date(day(2).getTime() + 4 * 3_600_000) }),
    row({ userId: 'c', mood: 3, topic: 'BUG', type: 'COMPLAINT', status: 'IN_REVIEW', createdAt: day(10) }),
  ];
  const summary = summarizeListening(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.avgMood, 3);
  assert.deepEqual(summary.moodDistribution, { '1': 1, '2': 0, '3': 1, '4': 0, '5': 1 });
  assert.deepEqual(summary.sentiment, { positive: 1, neutral: 1, negative: 1 });
  assert.equal(summary.pending, 2); // NEW + IN_REVIEW
  assert.equal(summary.answered, 1);
  assert.equal(summary.avgResponseHours, 4);
  assert.equal(summary.nps.score, 0); // 1 promotor, 1 detractor, de 2 respuestas
  assert.equal(summary.nps.distribution[10], 1);
  assert.equal(summary.nps.distribution[2], 1);
  assert.equal(summary.byTopic.find((item) => item.key === 'BUG')?.count, 2);
  assert.equal(summary.byTopic.find((item) => item.key === 'BUG')?.avgMood, 2);
  assert.equal(summary.byCourse.length, 1);
  assert.equal(summary.byCourse[0].title, 'Curso 1');
  assert.equal(summary.weekly.length, 2); // 1-2 sep y 10 sep caen en semanas distintas
});

test('Buzón: un resumen vacío no inventa cifras', () => {
  const summary = summarizeListening([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.avgMood, null);
  assert.equal(summary.nps.score, null);
  assert.equal(summary.avgResponseHours, null);
  assert.deepEqual(summary.weekly, []);
});

test('Buzón: la semana empieza en lunes (UTC)', () => {
  assert.equal(weekStartOf(new Date('2026-09-06T23:59:00Z')), '2026-08-31'); // domingo
  assert.equal(weekStartOf(new Date('2026-09-07T00:00:00Z')), '2026-09-07'); // lunes
});

test('Buzón: el CSV neutraliza fórmulas y escapa comillas', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('hola, mundo'), '"hola, mundo"');
  assert.equal(csvCell('linea1\nlinea2'), '"linea1\nlinea2"');
  assert.equal(csvCell(5), '5');
  assert.equal(csvCell(null), '');
});

test('Buzón: un mensaje anónimo no deja pasar ni nombre, ni correo, ni id de usuario', () => {
  const entry = toStaffEntry({
    id: 'e1', userId: 'secret-user-id', user: { name: 'Ana Pérez', email: 'ana@example.invalid' },
    courseId: null, course: null, type: 'COMPLAINT', topic: 'BUG', mood: 1, npsScore: 2,
    subject: 'Asunto', message: 'Mensaje largo de prueba', anonymous: true, status: 'NEW',
    reply: null, repliedAt: null, replySeenAt: null, createdAt: day(1),
  });
  assert.equal(entry.author, null);
  const serialized = JSON.stringify(entry);
  assert.equal(serialized.includes('Ana'), false);
  assert.equal(serialized.includes('ana@example.invalid'), false);
  assert.equal(serialized.includes('secret-user-id'), false);
});

test('Buzón: la validación rechaza escalas fuera de rango y textos vacíos', () => {
  const valid = { type: 'SUGGESTION', topic: 'CONTENT', mood: 4, subject: 'Asunto', message: 'Un mensaje suficientemente largo' };
  assert.equal(createListeningSchema.safeParse(valid).success, true);
  assert.equal(createListeningSchema.safeParse({ ...valid, mood: 0 }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, mood: 6 }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, mood: 3.5 }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, npsScore: 11 }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, npsScore: -1 }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, npsScore: 0 }).success, true);
  assert.equal(createListeningSchema.safeParse({ ...valid, type: 'SPAM' }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, message: '   corto  ' }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, message: 'x'.repeat(LISTENING_LIMITS.messageMax + 1) }).success, false);
  assert.equal(createListeningSchema.safeParse({ ...valid, subject: '  ' }).success, false);
});

// --- HTTP + base de datos ----------------------------------------------------

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession, hashPassword } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

const suffix = `listen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const userIds: string[] = [];
const courseIds: string[] = [];
const fakeReq = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;

async function makeUser(role: 'ADMIN' | 'MENTOR' | 'PUBLIC_USER', name = 'Prueba Buzón') {
  const created = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${suffix}-${userIds.length}@example.invalid`,
      name,
      role,
      passwordHash: await hashPassword('Clave-Buzon-2026!'),
    },
  });
  userIds.push(created.id);
  const session = await createUserSession(created.id, fakeReq);
  return { ...created, cookie: `${config.SESSION_COOKIE_NAME}=${session.token}` };
}

async function call(path: string, method: string, cookie?: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(raw);
  } catch {
    /* no era JSON (CSV) */
  }
  return { status: res.status, json, raw, headers: res.headers };
}

const valid = {
  type: 'SUGGESTION',
  topic: 'CONTENT',
  mood: 4,
  subject: 'Más ejercicios',
  message: 'Me gustaría tener más ejercicios prácticos en cada módulo.',
  anonymous: false,
};

test('Buzón: envío, respuesta del equipo, anonimato, permisos, CSV y límite diario', async (t) => {
  const admin = await makeUser('ADMIN');
  const mentor = await makeUser('MENTOR');
  const student = await makeUser('PUBLIC_USER', 'Estudiante Visible');
  const other = await makeUser('PUBLIC_USER', 'Otra Persona');
  const course = await prisma.course.create({
    data: { title: `Curso ${suffix}`, description: 'Prueba', price: 0, coverImage: '/logo.avif', published: false },
  });
  courseIds.push(course.id);

  t.after(async () => {
    await prisma.listeningEntry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  await t.test('sin sesión no se puede escribir ni leer nada', async () => {
    assert.equal((await call('/api/listening', 'POST', undefined, valid)).status, 401);
    assert.equal((await call('/api/listening/mine', 'GET')).status, 401);
    assert.equal((await call('/api/admin/listening', 'GET')).status, 401);
  });

  await t.test('rechaza escalas inválidas con 400 y un mensaje legible', async () => {
    const badMood = await call('/api/listening', 'POST', student.cookie, { ...valid, mood: 9 });
    assert.equal(badMood.status, 400);
    assert.ok(typeof badMood.json.error === 'string' && badMood.json.error.length > 0);
    assert.equal((await call('/api/listening', 'POST', student.cookie, { ...valid, npsScore: 11 })).status, 400);
    assert.equal((await call('/api/listening', 'POST', student.cookie, { ...valid, message: 'corto' })).status, 400);
    assert.equal((await call('/api/listening', 'POST', student.cookie, { ...valid, courseId: 'no-existe' })).status, 400);
  });

  await t.test('la base también protege las escalas (CHECK) aunque se salte la API', async () => {
    await assert.rejects(
      prisma.listeningEntry.create({
        data: { userId: student.id, type: 'SUGGESTION', topic: 'OTHER', mood: 9, subject: 'x', message: 'y' },
      }),
    );
    await assert.rejects(
      prisma.listeningEntry.create({
        data: { userId: student.id, type: 'SUGGESTION', topic: 'OTHER', mood: 3, npsScore: 11, subject: 'x', message: 'y' },
      }),
    );
  });

  let publicId = '';
  let anonymousId = '';

  await t.test('un envío válido se guarda y la persona lo ve en «mis aportes»', async () => {
    const sent = await call('/api/listening', 'POST', student.cookie, { ...valid, npsScore: 9, courseId: course.id });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.entry.status, 'NEW');
    publicId = sent.json.entry.id;

    const mine = await call('/api/listening/mine', 'GET', student.cookie);
    assert.equal(mine.json.entries.length, 1);
    assert.equal(mine.json.entries[0].courseTitle, course.title);
    assert.equal(mine.json.unreadReplies, 0);

    // Cada quien ve solo lo suyo.
    assert.equal((await call('/api/listening/mine', 'GET', other.cookie)).json.entries.length, 0);
  });

  await t.test('el panel es solo de administración', async () => {
    assert.equal((await call('/api/admin/listening', 'GET', student.cookie)).status, 403);
    assert.equal((await call('/api/admin/listening', 'GET', mentor.cookie)).status, 403);
    assert.equal((await call('/api/admin/listening/export', 'GET', mentor.cookie)).status, 403);
    assert.equal((await call(`/api/admin/listening/${publicId}`, 'PATCH', student.cookie, { reply: 'hola' })).status, 403);
  });

  await t.test('un mensaje anónimo llega al equipo sin identidad, pero la persona lo sigue viendo', async () => {
    const sent = await call('/api/listening', 'POST', other.cookie, {
      ...valid, type: 'COMPLAINT', topic: 'BUG', mood: 1, npsScore: 2, subject: 'Falla', message: 'La plataforma se cierra sola.', anonymous: true,
    });
    assert.equal(sent.status, 201);
    anonymousId = sent.json.entry.id;

    const panel = await call('/api/admin/listening?days=0', 'GET', admin.cookie);
    assert.equal(panel.status, 200);
    const seen = panel.json.entries.find((item: any) => item.id === anonymousId);
    assert.ok(seen);
    assert.equal(seen.author, null);
    assert.equal(panel.raw.includes('Otra Persona'), false);
    assert.equal(panel.raw.includes(other.email), false);
    assert.equal(panel.raw.includes(other.id), false);

    const visible = panel.json.entries.find((item: any) => item.id === publicId);
    assert.equal(visible.author.name, 'Estudiante Visible');

    assert.equal((await call('/api/listening/mine', 'GET', other.cookie)).json.entries[0].anonymous, true);
  });

  await t.test('el resumen sale en números', async () => {
    const { json } = await call(`/api/admin/listening?days=0&courseId=${course.id}`, 'GET', admin.cookie);
    assert.equal(json.summary.total, 1);
    assert.equal(json.summary.avgMood, 4);
    assert.equal(json.summary.nps.score, 100); // un promotor
    const all = (await call('/api/admin/listening?days=0', 'GET', admin.cookie)).json;
    assert.ok(all.summary.total >= 2);
    // filtrar la lista por estado no vacía el resumen del periodo
    const filtered = (await call('/api/admin/listening?days=0&status=CLOSED', 'GET', admin.cookie)).json;
    assert.equal(filtered.entries.length, 0);
    assert.ok(filtered.summary.total >= 2);
    assert.equal((await call('/api/admin/listening?days=abc', 'GET', admin.cookie)).status, 400);
  });

  await t.test('el NPS cuenta una vez por persona aunque escriba varias veces', async () => {
    const repeat = await makeUser('PUBLIC_USER', 'Insistente');
    await prisma.listeningEntry.create({
      data: { userId: repeat.id, type: 'COMPLAINT', topic: 'OTHER', mood: 1, npsScore: 0, subject: 'Antes', message: 'Mensaje antiguo de prueba', createdAt: new Date(Date.now() - 86_400_000) },
    });
    await call('/api/listening', 'POST', repeat.cookie, { ...valid, npsScore: 10, mood: 5 });
    const rows = await prisma.listeningEntry.findMany({ where: { userId: repeat.id } });
    assert.equal(rows.length, 2);
    assert.deepEqual(latestNpsPerUser(rows.map((item) => ({ ...item, courseTitle: null }))), [10]);
  });

  await t.test('responder cambia el estado, avisa a la persona y se marca como leído', async () => {
    const reply = await call(`/api/admin/listening/${publicId}`, 'PATCH', admin.cookie, { reply: 'Gracias, lo añadimos este mes.' });
    assert.equal(reply.status, 200);
    assert.equal(reply.json.entry.status, 'ANSWERED');
    assert.equal(reply.json.entry.repliedBy, admin.name);

    const before = await call('/api/listening/mine', 'GET', student.cookie);
    assert.equal(before.json.unreadReplies, 1);
    assert.equal(before.json.entries[0].unreadReply, true);
    assert.equal(before.json.entries[0].reply, 'Gracias, lo añadimos este mes.');

    assert.equal((await call('/api/listening/mine/seen', 'POST', student.cookie)).status, 200);
    assert.equal((await call('/api/listening/mine', 'GET', student.cookie)).json.unreadReplies, 0);

    // Cambiar solo el estado no toca la respuesta.
    const closed = await call(`/api/admin/listening/${publicId}`, 'PATCH', admin.cookie, { status: 'CLOSED' });
    assert.equal(closed.json.entry.status, 'CLOSED');
    assert.equal(closed.json.entry.reply, 'Gracias, lo añadimos este mes.');

    assert.equal((await call(`/api/admin/listening/${publicId}`, 'PATCH', admin.cookie, {})).status, 400);
    assert.equal((await call('/api/admin/listening/no-existe', 'PATCH', admin.cookie, { status: 'CLOSED' })).status, 404);
  });

  await t.test('el CSV sale con BOM, sin identidad anónima y neutraliza fórmulas', async () => {
    await call('/api/listening', 'POST', student.cookie, {
      ...valid, subject: 'Inyección', message: '=HYPERLINK("http://evil.invalid","clic")',
    });
    const csv = await call('/api/admin/listening/export?days=0', 'GET', admin.cookie);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    assert.match(csv.headers.get('content-disposition') || '', /attachment; filename="buzon-escucha-/);
    // `text()` descarta el BOM al decodificar: se mira en los bytes reales.
    const bytes = new Uint8Array(
      await (await fetch(`${base}/api/admin/listening/export?days=0`, { headers: { cookie: admin.cookie } })).arrayBuffer(),
    );
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.ok(csv.raw.includes(`'=HYPERLINK`));
    assert.equal(csv.raw.includes('Otra Persona'), false);
    assert.equal(csv.raw.includes(other.email), false);
    assert.match(csv.raw.split('\r\n')[0], /carita_1_a_5,sentimiento,nps_0_a_10/);
  });

  await t.test('el límite diario frena el relleno', async () => {
    const spammer = await makeUser('PUBLIC_USER', 'Spammer');
    await prisma.listeningEntry.createMany({
      data: Array.from({ length: LISTENING_LIMITS.perDay }, (_, index) => ({
        userId: spammer.id, type: 'SUGGESTION' as const, topic: 'OTHER' as const, mood: 3,
        subject: `Relleno ${index}`, message: 'Mensaje de relleno para la prueba',
      })),
    });
    const blocked = await call('/api/listening', 'POST', spammer.cookie, valid);
    assert.equal(blocked.status, 429);
    assert.equal((await call('/api/listening', 'POST', student.cookie, valid)).status, 201);
  });

  await t.test('borrar un curso no borra los mensajes, solo desvincula', async () => {
    const temp = await prisma.course.create({
      data: { title: `Temp ${suffix}`, description: 'x', price: 0, coverImage: '/logo.avif', published: false },
    });
    const sent = await call('/api/listening', 'POST', other.cookie, { ...valid, courseId: temp.id });
    assert.equal(sent.status, 201);
    await prisma.course.delete({ where: { id: temp.id } });
    const kept = await prisma.listeningEntry.findUnique({ where: { id: sent.json.entry.id } });
    assert.ok(kept);
    assert.equal(kept.courseId, null);
  });
});
