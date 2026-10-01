import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import { safeExternalUrl } from '../src/lib/safeUrl.js';
import { parseVideoSource } from '../src/lib/videoParser.js';
import { allowSeoJsonLd } from '../server/csp.js';
import { renderSeoLandingHtml } from '../server/seo.js';

const databaseUrl = process.env.DATABASE_URL!;
const encryptionKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
const childEnv = { ...process.env, DATABASE_URL: databaseUrl, DOTENV_CONFIG_PATH: '.codex-tmp/noenv', DOCENTOS_ENCRYPTION_KEY: encryptionKey, DOCENTOS_SKIP_LISTEN: '1', SEED_DEMO_DATA: 'false' };

test('D2: staging exige secretos y rechaza exposición de recuperación', () => {
  for (const [key, value] of [['DOCENTOS_ENCRYPTION_KEY', ''], ['PASSWORD_RESET_EXPOSE_TOKEN', 'true'], ['SEED_DEMO_DATA', 'true'], ['STRIPE_SECRET_KEY', 'sk_test_example']]) {
    const env = { ...childEnv, DOCENTOS_ENV: 'staging', PASSWORD_RESET_EXPOSE_TOKEN: 'false', SEED_DEMO_DATA: 'false', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: 'whsec_test', [key]: value };
    if (key === 'STRIPE_SECRET_KEY') env.STRIPE_WEBHOOK_SECRET = '';
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', "import('./server/config.ts').then(() => process.exit(0)).catch(() => process.exit(2))"], { cwd: process.cwd(), env, encoding: 'utf8' });
    assert.equal(result.status, 2, `${key} debe fallar en staging`);
  }
});

test('D2: CSP HTTP en report y enforce, con valores por defecto seguros', () => {
  for (const mode of ['report', 'enforce'] as const) for (const explicit of [true, false]) {
    const env: NodeJS.ProcessEnv = { ...childEnv, DOCENTOS_ENV: mode === 'report' ? 'development' : 'staging' };
    if (explicit) env.CSP_MODE = mode;
    else env.CSP_MODE = '';
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'tests/csp-probe.ts', mode], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    });
    const line = output.split('\n').find((item) => item.startsWith('CSP_PROBE:'));
    assert.ok(line);
    const probe = JSON.parse(line.slice('CSP_PROBE:'.length));
    assert.equal(probe.status, 200);
    assert.match(probe.csp, /script-src 'self'/);
    assert.doesNotMatch(probe.csp.match(/script-src[^;]*/)?.[0] || '', /unsafe-inline/);
    assert.match(probe.csp, /fonts.googleapis.com/);
    assert.match(probe.csp, /frame-src[^;]*youtube-nocookie\.com/);
    assert.match(probe.csp, /frame-src[^;]*drive\.google\.com/);
    assert.match(probe.csp, /frame-src[^;]*meet\.jit\.si/);
    assert.equal(probe.opposite, null);
  }
});

test('D2: el JSON-LD prerenderizado recibe un hash de script concreto', () => {
  const html = renderSeoLandingHtml({
    landing: { heroTitle: 'Curso', heroSubtitle: 'Prueba', heroMediaUrl: '', footerText: 'Pie' },
    courses: [],
    baseUrl: 'https://example.invalid',
  });
  const policy = allowSeoJsonLd("default-src 'self';script-src 'self';object-src 'none'", html);
  assert.match(policy, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(policy, /unsafe-inline/);
});

test('D2: staging no procesa webhooks sin firma ni permite pagos simulados', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', 'tests/payment-probe.ts'], {
    cwd: process.cwd(),
    env: { ...childEnv, DOCENTOS_ENV: 'staging', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '' },
    encoding: 'utf8',
  });
  const line = output.split('\n').find((item) => item.startsWith('PAYMENT_PROBE:'));
  assert.ok(line);
  assert.deepEqual(JSON.parse(line.slice('PAYMENT_PROBE:'.length)), { webhookRejected: true, simulationRejected: true });
});

test('D2: las URLs externas y el iframe pegado no aceptan esquemas ejecutables', async () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('http://example.com'), '');
  assert.equal(safeExternalUrl('http://example.com', true), 'http://example.com/');
  assert.equal(parseVideoSource('<iframe src="javascript:alert(1)"></iframe>').embedUrl, '');
  assert.equal(parseVideoSource('data:text/html,evil').embedUrl, '');
  // La clase llega como ruta propia (courseAccess.playbackUrl): debe reproducirse.
  assert.equal(parseVideoSource('/api/content/videos/abc123').embedUrl, '/api/content/videos/abc123');
  assert.equal(parseVideoSource('//evil.example/video').embedUrl, '');
  assert.equal(parseVideoSource('/\\evil.example/video').embedUrl, '');
  const { redactRequestUrl } = await import('../server/logger.js');
  assert.equal(redactRequestUrl('/?resetToken=abc123secreto&Code=xyz&ok=1'), '/?resetToken=[REDACTADO]&Code=[REDACTADO]&ok=1');
});

test('D2: petición real oculta token, valida origen y rechaza URLs peligrosas al guardar', async () => {
  process.env.DOCENTOS_SKIP_LISTEN = '1';
  const { app } = await import('../server.js');
  const { prisma } = await import('../server/prisma.js');
  const { createUserSession } = await import('../server/authService.js');
  const { config } = await import('../server/config.js');
  const admin = await prisma.user.create({ data: { email: `d2-${Date.now()}@example.invalid`, name: 'D2', role: 'ADMIN' } });
  const course = await prisma.course.create({ data: { title: 'D2 seguridad', description: 'Prueba', price: 0, coverImage: '' } });
  const module = await prisma.module.create({ data: { title: 'Módulo', order: 1, courseId: course.id } });
  const { token } = await createUserSession(admin.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const logs: string[] = [];
  const priorLog = console.log;
  const priorWarn = console.warn;
  console.log = (...args) => { logs.push(args.join(' ')); };
  console.warn = (...args) => { logs.push(args.join(' ')); };
  try {
    await fetch(`${base}/?resetToken=abc123secreto`);
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(logs.some((line) => line.includes('resetToken=[REDACTADO]')));
    assert.equal(logs.some((line) => line.includes('abc123secreto')), false);

    const alien = await fetch(`${base}/api/admin/landing-config?x=/api/payments/webhook`, { method: 'POST', headers: { Origin: 'https://alien.example' } });
    assert.equal(alien.status, 403);
    const webhook = await fetch(`${base}/api/payments/webhook`, { method: 'POST', headers: { Origin: 'https://alien.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.notEqual(webhook.status, 403);

    const headers = { Cookie: `${config.SESSION_COOKIE_NAME}=${token}`, 'Content-Type': 'application/json' };
    const putLanding = (body: unknown) => fetch(`${base}/api/admin/landing-config`, { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal((await putLanding({ githubUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await putLanding({ heroMediaUrl: 'data:text/html,evil' })).status, 400);
    assert.equal((await putLanding({ bannerLinkUrl: 'javascript:alert(1)' })).status, 400);
    const resource = await fetch(`${base}/api/admin/courses/${course.id}/resources`, { method: 'POST', headers, body: JSON.stringify({ title: 'Peligroso', privateUrl: 'javascript:alert(1)' }) });
    assert.equal(resource.status, 400);
    const saved = await prisma.courseResource.create({ data: { courseId: course.id, title: 'Legado inseguro', privateUrl: 'javascript:alert(1)' } });
    const redirect = await fetch(`${base}/api/content/resources/${saved.id}`, { headers, redirect: 'manual' });
    assert.equal(redirect.status, 400);
    const update = await fetch(`${base}/api/admin/courses/${course.id}/resources/${saved.id}`, { method: 'PUT', headers, body: JSON.stringify({ privateUrl: 'javascript:alert(1)' }) });
    assert.equal(update.status, 400);
    const video = await fetch(`${base}/api/admin/modules/${module.id}/videos`, { method: 'POST', headers, body: JSON.stringify({ title: 'Peligroso', embedUrl: 'javascript:alert(1)' }) });
    assert.equal(video.status, 400);
    const legacyVideo = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: 'Legado inseguro', driveFileId: 'd2-legacy', embedUrl: 'javascript:alert(1)', order: 1 } });
    const playback = await fetch(`${base}/api/content/videos/${legacyVideo.id}`, { headers, redirect: 'manual' });
    assert.equal(playback.status, 400);
  } finally {
    console.log = priorLog;
    console.warn = priorWarn;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  }
});
