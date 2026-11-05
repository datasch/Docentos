import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { config } = await import('../server/config.js');

test('Compartir: vista previa pública y clases protegidas', async t => {
  const course = await prisma.course.create({ data: { title: 'Curso para compartir <prueba>', description: 'Descripción pública', published: true, price: 25, coverImage: '/logo.avif' } });
  const module = await prisma.module.create({ data: { courseId: course.id, title: 'Modulo privado', order: 1 } });
  const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: 'Clase privada', driveFileId: `private-${course.id}`, embedUrl: 'https://drive.google.com/file/d/privado/preview', duration: '10:00', order: 1 } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { await new Promise<void>(r => server.close(() => r())); await prisma.course.delete({ where: { id: course.id } }); await prisma.$disconnect(); });
  await t.test('WhatsApp recibe la presentación del curso, sin URLs de videos ni módulos privados', async () => {
    const res = await fetch(`${base}/courses/${course.id}`, { headers: { 'User-Agent': 'WhatsApp/2.0', Host: 'dominio-ajeno.example' } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /og:title/);assert.match(html, /Curso para compartir &lt;prueba&gt;/);
    assert.ok(html.includes(`${config.APP_URL}/courses/${course.id}`));
    assert.doesNotMatch(html, /dominio-ajeno|Modulo privado|Clase privada|drive.google.com|private-/);
  });
  await t.test('El enlace no cambia permisos ni expone las clases a visitantes', async () => {
    const res = await fetch(`${base}/api/courses/${course.id}`);const data = await res.json();
    assert.equal(data.hasAccess, false);assert.deepEqual(data.course.modules, []);
    assert.equal((await fetch(`${base}/api/content/videos/${video.id}`)).status, 403);
    assert.equal(await prisma.courseEnrollment.count({ where: { courseId: course.id } }), 0);
  });
  await t.test('Un curso retirado o inexistente no produce una vista previa pública', async () => {
    await prisma.course.update({ where: { id: course.id }, data: { published: false } });
    for (const id of [course.id, 'inexistente']) {
      const res = await fetch(`${base}/courses/${id}`, { headers: { 'User-Agent': 'facebookexternalhit' } });
      assert.equal(res.status, 404);assert.doesNotMatch(await res.text(), /Curso para compartir/);
    }
  });
});
