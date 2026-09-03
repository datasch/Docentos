/**
 * Regresiones de seguridad y rendimiento detectadas sobre v0.4.0-beta.1.
 *
 * Cada bloque fija una vulnerabilidad reproducida en la aplicacion en ejecucion:
 * XSS almacenado en la pre-renderizacion para bots, confianza indebida en
 * X-Forwarded-For y elevacion/degradacion de rol desde el panel de mentoria.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/prisma.js';
import { parseTrustProxy } from '../server/config.js';
import {
  escapeHtml,
  isCrawlerUserAgent,
  renderSeoLandingHtml,
  safeHttpUrl,
} from '../server/seo.js';
import {
  canConvertAccountToMentee,
  getCourseAccessDecision,
  getCourseAccessDecisions,
} from '../server/courseAccess.js';
import { buildDriveEmbedUrl, extractDriveFileId } from '../server/driveService.js';
import type { AuthenticatedUser } from '../server/authMiddleware.js';

const TEST_COURSE_ID = 'course-giantucchi-mastery';
const TEST_USER_ID = 'user-public-01';

test('Seguridad: la pre-renderizacion para rastreadores escapa el contenido almacenado', async (t) => {
  await t.test('1. Un guion guardado en la landing no se emite como marcado ejecutable', () => {
    const html = renderSeoLandingHtml({
      landing: {
        heroTitle: '<script>alert(1)</script>',
        heroSubtitle: 'Comillas " y <b>etiquetas</b>',
        heroMediaUrl: 'https://cdn.example.com/portada.png',
        footerText: '<img src=x onerror=alert(2)>',
      },
      courses: [],
      baseUrl: 'https://docentos.example.com',
    });

    assert.ok(!html.includes('<script>alert(1)</script>'), 'El guion no debe emitirse sin escapar');
    assert.ok(!html.includes('<img src=x onerror=alert(2)>'), 'El pie no debe emitir etiquetas');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Debe aparecer escapado');
    assert.ok(!/content="[^"]*<b>/.test(html), 'Los atributos no deben romperse con marcado');
  });

  await t.test('2. El titulo de un curso no puede cerrar el bloque JSON-LD', () => {
    const html = renderSeoLandingHtml({
      landing: {
        heroTitle: 'DocentOS',
        heroSubtitle: 'LMS',
        heroMediaUrl: '',
        footerText: 'pie',
      },
      courses: [
        { title: '</script><script>alert(3)</script>', description: 'Curso', price: 10 },
      ],
      baseUrl: 'https://docentos.example.com',
    });

    assert.ok(!html.includes('</script><script>alert(3)</script>'), 'No debe cerrarse el bloque');
    assert.ok(html.includes('\\u003c/script'), 'El JSON-LD debe neutralizar el caracter "<"');
  });

  await t.test('3. Solo se emiten URLs http(s) en atributos de imagen', () => {
    assert.equal(safeHttpUrl('javascript:alert(1)'), '', 'Descarta esquemas ejecutables');
    assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), '', 'Descarta data:');
    assert.equal(safeHttpUrl('  '), '', 'Descarta valores vacios');
    assert.equal(safeHttpUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');

    const html = renderSeoLandingHtml({
      landing: {
        heroTitle: 'DocentOS',
        heroSubtitle: 'LMS',
        heroMediaUrl: 'javascript:alert(1)',
        footerText: 'pie',
      },
      courses: [],
      baseUrl: 'https://docentos.example.com',
    });
    assert.ok(!html.includes('javascript:'), 'La URL peligrosa no debe llegar al HTML');
    assert.ok(!html.includes('og:image'), 'Sin URL valida no se emite la etiqueta');
  });

  await t.test('4. escapeHtml cubre los cinco caracteres significativos', () => {
    assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '42');
  });

  await t.test('5. La deteccion de rastreadores sigue reconociendo los agentes esperados', () => {
    assert.equal(isCrawlerUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
    assert.equal(isCrawlerUserAgent('GPTBot/1.0'), true);
    assert.equal(isCrawlerUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0'), false);
  });
});

test('Seguridad: X-Forwarded-For solo se respeta con un proxy declarado', async (t) => {
  await t.test('1. El valor por defecto no confia en la cabecera', () => {
    assert.equal(parseTrustProxy('false'), false);
    assert.equal(parseTrustProxy(''), false, 'Sin valor configurado se asume sin proxy');
    assert.equal(parseTrustProxy('0'), false);
  });

  await t.test('2. Un operador puede declarar saltos o direcciones concretas', () => {
    assert.equal(parseTrustProxy('1'), 1, 'Un salto: reverse proxy directo');
    assert.equal(parseTrustProxy('2'), 2);
    assert.deepEqual(parseTrustProxy('10.0.0.1, 10.0.0.2'), ['10.0.0.1', '10.0.0.2']);
    assert.equal(parseTrustProxy('true'), true, 'Permitido, pero advertido al arrancar');
  });
});

test('Seguridad: un mentor no puede cambiar el rol de una cuenta existente', async (t) => {
  await t.test('1. Un mentor no puede convertir cuentas con otro rol en mentee', () => {
    for (const role of ['VIP', 'PUBLIC_USER', 'EXTERNAL'] as const) {
      assert.equal(
        canConvertAccountToMentee('MENTOR', role),
        false,
        `Un mentor no debe degradar una cuenta ${role}`,
      );
    }
  });

  await t.test('2. Un mentor si puede asignar cuentas nuevas o ya mentees', () => {
    assert.equal(canConvertAccountToMentee('MENTOR', null), true, 'Cuenta nueva');
    assert.equal(canConvertAccountToMentee('MENTOR', 'MENTEE'), true, 'Cuenta ya mentee');
  });

  await t.test('3. La conversion sigue disponible para administracion', () => {
    assert.equal(canConvertAccountToMentee('ADMIN', 'VIP'), true);
    assert.equal(canConvertAccountToMentee('ADMIN', 'PUBLIC_USER'), true);
  });
});

test('Acceso a cursos: la resolucion por lotes coincide con la individual', async (t) => {
  const courses = await prisma.course.findMany({
    select: { id: true, published: true, price: true },
  });
  assert.ok(courses.length > 0, 'La base de demostracion debe tener cursos');

  const student = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
  assert.ok(student, 'El usuario de demostracion debe existir');

  const viewers: Array<{ label: string; user: AuthenticatedUser | undefined }> = [
    { label: 'visitante anonimo', user: undefined },
    {
      label: 'estudiante autenticado',
      user: {
        id: student.id,
        email: student.email,
        name: student.name,
        role: student.role as AuthenticatedUser['role'],
      },
    },
    {
      label: 'administrador',
      user: { id: 'admin-check', email: 'admin@docentos.test', name: 'Admin', role: 'ADMIN' },
    },
    {
      label: 'miembro VIP',
      user: { id: student.id, email: student.email, name: student.name, role: 'VIP' },
    },
  ];

  // El rol MENTOR es el unico que consulta tambien las asignaciones donde figura
  // como mentor, asi que la version por lotes debe reproducir esa quinta consulta.
  const mentor = await prisma.user.findFirst({ where: { role: 'MENTOR' } });
  if (mentor) {
    viewers.push({
      label: 'mentor con cartera asignada',
      user: { id: mentor.id, email: mentor.email, name: mentor.name, role: 'MENTOR' },
    });
  }

  for (const viewer of viewers) {
    await t.test(`Decisiones identicas para ${viewer.label}`, async () => {
      const batched = await getCourseAccessDecisions(viewer.user, courses);
      for (const course of courses) {
        const single = await getCourseAccessDecision(viewer.user, course.id);
        assert.deepEqual(
          batched.get(course.id),
          single,
          `El curso ${course.id} debe resolverse igual por lotes y de forma individual`,
        );
      }
    });
  }

  await t.test('Un curso inexistente no aparece en el resultado por lotes', async () => {
    const decisions = await getCourseAccessDecisions(undefined, []);
    assert.equal(decisions.size, 0);

    const single = await getCourseAccessDecision(undefined, 'curso-que-no-existe');
    assert.equal(single.allowed, false);
    assert.equal(single.reason, 'not_authorized');
  });

  await t.test('El catalogo de demostracion mantiene su regla de acceso', async () => {
    const decision = await getCourseAccessDecision(undefined, TEST_COURSE_ID);
    assert.equal(typeof decision.allowed, 'boolean');
    assert.ok(decision.reason.length > 0);
  });
});

test('Videos: el enlace de Google Drive se normaliza antes de guardarse', async (t) => {
  const REAL_ID = '1bg8x7VY5gw1vh16sJ6B89tGlwg208s8H';

  await t.test('1. Se acepta el enlace que ofrece el botón Compartir de Drive', () => {
    // Este es el caso que dejaba el reproductor en negro: al pegar la URL en el
    // campo de ID se construia .../file/d/https://drive.google.com/...
    assert.equal(
      extractDriveFileId(`https://drive.google.com/file/d/${REAL_ID}/view?usp=drive_link`),
      REAL_ID,
    );
    assert.equal(extractDriveFileId(`https://drive.google.com/file/d/${REAL_ID}/preview`), REAL_ID);
    assert.equal(extractDriveFileId(`https://drive.google.com/open?id=${REAL_ID}`), REAL_ID);
    assert.equal(
      extractDriveFileId(`https://drive.google.com/uc?export=download&id=${REAL_ID}`),
      REAL_ID,
    );
    assert.equal(extractDriveFileId(`https://docs.google.com/document/d/${REAL_ID}/edit`), REAL_ID);
  });

  await t.test('2. Un identificador suelto sigue siendo válido', () => {
    assert.equal(extractDriveFileId(REAL_ID), REAL_ID);
    assert.equal(extractDriveFileId(`  ${REAL_ID}  `), REAL_ID);
  });

  await t.test('3. Se rechaza lo que no puede ser un archivo de Drive', () => {
    assert.equal(extractDriveFileId('12'), null, 'Un numero suelto no es un identificador');
    assert.equal(extractDriveFileId(''), null);
    assert.equal(extractDriveFileId('   '), null);
    assert.equal(extractDriveFileId('no es un enlace'), null);
  });

  await t.test('4. El enlace de reproducción se construye a partir del identificador', () => {
    assert.equal(
      buildDriveEmbedUrl(REAL_ID),
      `https://drive.google.com/file/d/${REAL_ID}/preview`,
    );
    assert.ok(
      !buildDriveEmbedUrl(REAL_ID).includes('https://drive.google.com/file/d/https'),
      'Nunca debe anidarse una URL dentro de otra',
    );
  });
});
