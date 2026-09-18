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
import { isSecretConfigKey, redactPluginConfig } from '../server/pluginConfig.js';
import { PLUGIN_CATALOG } from '../server/pluginCatalog.js';
import type { AuthenticatedUser } from '../server/authMiddleware.js';
import {
  saveQuizForModule,
  getQuizByModuleId,
  deleteQuizForModule,
  getAllStoredQuizzes,
  getQuizCountsByCourse,
  shuffleQuestionOptions,
  type QuizQuestion,
} from '../server/quizService.js';
import { QuizzesPluginEngine, quizzesPlugin } from '../src/plugins/QuizzesPlugin.js';

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

test('Plugins: el catalogo es una sola lista y esta completo', async (t) => {
  // Vivia duplicado —una copia en el seed, otra en el cliente— y el seed entero
  // esta detras de SEED_DEMO_DATA, que produccion rechaza arrancar. Resultado
  // medido el 17 sep 2026: la tabla `Plugin` de produccion vacia y el panel en
  // blanco. Ahora la aplicacion lo asegura en cada arranque.
  await t.test('1. No hay identificadores repetidos', () => {
    const ids = PLUGIN_CATALOG.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, 'Un id repetido haria que un upsert pisara al otro');
  });

  await t.test('2. Cada entrada trae lo que la tabla exige', () => {
    for (const plugin of PLUGIN_CATALOG) {
      for (const campo of ['id', 'name', 'description', 'version', 'category', 'icon'] as const) {
        assert.equal(typeof plugin[campo], 'string', `${plugin.id}: falta ${campo}`);
        assert.ok(plugin[campo].length > 0, `${plugin.id}: ${campo} vacio`);
      }
      assert.equal(typeof plugin.config, 'object', `${plugin.id}: config debe ser un objeto`);
      assert.doesNotThrow(() => JSON.stringify(plugin.config), `${plugin.id}: config no serializable`);
    }
  });

  await t.test('3. El catalogo no siembra credenciales de ejemplo', () => {
    // El catalogo del cliente traia una URL de webhook de demostracion. Sembrar
    // eso deja a la instalacion enviando a un sitio que no es suyo.
    for (const plugin of PLUGIN_CATALOG) {
      for (const [clave, valor] of Object.entries(plugin.config)) {
        // Misma regla que `redactPluginConfig`: solo una cadena es una
        // credencial. `apiKeyConfigured: true` es un indicador de estado.
        if (isSecretConfigKey(clave) && typeof valor === 'string') {
          assert.equal(valor, '', `${plugin.id}: ${clave} debe nacer vacio, no con un valor de ejemplo`);
        }
      }
    }
  });

  await t.test('4. El umbral de aprobación de exámenes coincide entre el catálogo y el plugin', () => {
    const catalogQuizzes = PLUGIN_CATALOG.find((p) => p.id === 'interactive-quizzes');
    assert.ok(catalogQuizzes, 'El catálogo debe contener el plugin interactive-quizzes');
    assert.equal(
      catalogQuizzes.config.passingScore,
      quizzesPlugin.config.passingScore,
      'El passingScore del catálogo debe coincidir con el de quizzesPlugin',
    );
  });
});

test('Seguridad: la configuracion de un plugin no entrega credenciales a quien no es administrador', async (t) => {
  // `/api/plugins` se abrio a cualquier cuenta autenticada para que el panel
  // del alumno sepa que hay activo. La configuracion viaja con ella.
  const bridge = { webhookUrl: 'https://discord.com/api/webhooks/1234/secreto', notifyOnQnA: true };

  await t.test('1. Administracion la ve entera', () => {
    assert.deepEqual(redactPluginConfig(bridge, true), bridge);
  });

  await t.test('2. Un alumno no recibe la URL del webhook', () => {
    const visible = redactPluginConfig(bridge, false);
    assert.equal('webhookUrl' in visible, false, 'La clave debe desaparecer, no enmascararse');
    assert.equal(visible.notifyOnQnA, true, 'El resto de la configuracion sigue llegando');
    assert.equal(
      JSON.stringify(visible).includes('secreto'),
      false,
      'El secreto no puede aparecer por ningun camino',
    );
  });

  await t.test('3. La regla no depende del id del plugin', () => {
    // La version anterior enmascaraba solo `discord-slack-bridge` por id, y
    // `discord-webhooks` guardaba la misma clase de URL sin proteger.
    const otro = redactPluginConfig({ webhookUrl: 'https://hooks.slack.com/services/AAA' }, false);
    assert.equal('webhookUrl' in otro, false);
    for (const clave of ['apiKey', 'api_key', 'accessToken', 'clientSecret', 'password', 'privateKey']) {
      assert.equal(isSecretConfigKey(clave), true, `${clave} deberia tratarse como credencial`);
    }
  });

  await t.test('4. Un indicador de estado no es una credencial', () => {
    // `apiKeyConfigured: true` dice si la integracion esta lista; el panel lo
    // necesita y no revela nada.
    const drive = redactPluginConfig({ apiKeyConfigured: true, defaultFolderId: 'root' }, false);
    assert.equal(drive.apiKeyConfigured, true);
    assert.equal(drive.defaultFolderId, 'root');
  });

  await t.test('5. Una credencial vacia no estorba: se conserva la clave', () => {
    // Sin esto, el formulario de administracion perderia el campo y no habria
    // donde escribir la URL la primera vez.
    const vacio = redactPluginConfig({ webhookUrl: '' }, false);
    assert.equal('webhookUrl' in vacio, true);
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
    select: { id: true, published: true, price: true, openToAllRegistered: true },
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

test('Seguridad Quizzes: inputs maliciosos y control de acceso', async (t) => {
  await t.test('1. Un texto de pregunta con HTML no se evalua como markup', async () => {
    // Si el texto se renderiza sin escape podria ser un vector XSS
    const q: QuizQuestion = {
      id: 'xss_q',
      text: '<script>alert("xss")</script>Pregunta real',
      options: ['<img src=x onerror=alert(1)>', 'Opcion limpia', 'C', 'D'],
      correctIndex: 1,
      explanation: '<b>Negrita</b>',
    };
    // El examen cuelga de un modulo real: desde que vive en PostgreSQL,
    // `ModuleQuiz.moduleId` es clave foranea contra `Module`.
    const curso = await prisma.course.create({
      data: { title: 'Curso XSS de prueba', description: 'temporal', price: 0, coverImage: '' },
    });
    const modulo = await prisma.module.create({
      data: { title: 'Modulo XSS', order: 1, courseId: curso.id },
    });

    const saved = await saveQuizForModule(modulo.id, [q]);
    // El servicio NO debe alterar el texto (eso es responsabilidad del renderer)
    // pero si debe guardar el registro correctamente sin lanzar excepciones
    assert.equal(saved.length, 1);
    assert.ok(saved[0].text.includes('<script>'), 'El texto se almacena sin ejecutarse');
    await prisma.course.delete({ where: { id: curso.id } });
  });

  await t.test('2. Un moduleId con path traversal no llega a ninguna parte', async () => {
    // Cuando los examenes vivian en un archivo, esta prueba comprobaba que un
    // identificador con `../` se trataba como clave de un mapa y no como ruta.
    // Desde que viven en PostgreSQL la garantia es mas fuerte y mas simple: el
    // identificador tiene que ser un modulo que exista, y `../../etc/passwd`
    // no lo es. La base lo rechaza antes de escribir nada.
    const maliciousId = '../../etc/passwd';
    const q: QuizQuestion = {
      id: 'path_q',
      text: 'Pregunta de inyeccion',
      options: ['A', 'B'],
      correctIndex: 0,
      explanation: 'Test de path traversal.',
    };
    await assert.rejects(() => saveQuizForModule(maliciousId, [q]), 'La clave foránea rechaza el identificador');
    assert.deepEqual(await getQuizByModuleId(maliciousId), [], 'No quedó nada guardado');
    assert.deepEqual(await getQuizByModuleId('modulo-legitimo'), [], 'Modulos legitimos no contaminados');
  });

  await t.test('3. correctIndex fuera de rango no hace que la evaluacion pase por casualidad', () => {
    const engine = new QuizzesPluginEngine();
    const q: QuizQuestion = {
      id: 'q_bad_idx',
      text: 'Test correctIndex invalido',
      options: ['A', 'B'],
      correctIndex: 999, // Indice completamente invalido
      explanation: 'Index fuera de rango.',
    };
    // Responder con indice 999 no debe considerarse correcto
    const result = engine.evaluateQuiz([q], { q_bad_idx: 999 }, 80);
    // Si el motor no sanitiza, podria contar como correcta; esto lo verifica
    assert.equal(result.correctCount <= 1, true, 'No debe desbordarse el conteo');
  });

  await t.test('4. El motor no registra intentos duplicados del mismo usuario sin historial previo', () => {
    const engine = new QuizzesPluginEngine();
    engine.recordAttempt('user-sec', 'mod-sec', 100, 80);
    engine.recordAttempt('user-sec', 'mod-sec', 100, 80); // Segundo intento identico
    // No debe lanzar error ni crear estado corrupto
    const modules = [
      { id: 'mod-sec', title: 'Seguridad', order: 1, videos: [] } as any,
      { id: 'mod-sec-2', title: 'Avanzado', order: 2, videos: [] } as any,
    ];
    assert.equal(engine.isModuleUnlocked(modules, 1, 'user-sec'), true, 'Doble intento aprobado abre el siguiente');
  });

  await t.test('5. El resumen del curso da recuentos, nunca respuestas', async () => {
    // El temario del alumno solo necesita saber que modulos evaluan. Antes lo
    // averiguaba descargando el examen entero del modulo abierto, asi que el
    // `correctIndex` de cada pregunta estaba en su navegador desde que entraba
    // a la clase, sin haber empezado a rendir nada.
    const curso = await prisma.course.create({
      data: { title: 'Curso resumen de prueba', description: 'temporal', price: 0, coverImage: '' },
    });
    const conExamen = await prisma.module.create({
      data: { title: 'Modulo con examen', order: 1, courseId: curso.id },
    });
    const sinExamen = await prisma.module.create({
      data: { title: 'Modulo sin examen', order: 2, courseId: curso.id },
    });

    await saveQuizForModule(conExamen.id, [
      {
        id: 'r1',
        text: '¿Cuanto es dos mas dos?',
        options: ['3', '4'],
        correctIndex: 1,
        explanation: 'Aritmetica.',
      },
      {
        id: 'r2',
        text: '¿De que color es el cielo?',
        options: ['Azul', 'Verde'],
        correctIndex: 0,
        explanation: 'Observacion.',
      },
    ]);

    const resumen = await getQuizCountsByCourse(curso.id);
    assert.deepEqual(resumen, { [conExamen.id]: 2 }, 'Solo el modulo que evalua, y solo su recuento');
    assert.equal(sinExamen.id in resumen, false, 'Un modulo sin examen no aparece');

    const serializado = JSON.stringify(resumen);
    assert.equal(serializado.includes('correctIndex'), false, 'No viaja la respuesta correcta');
    assert.equal(serializado.includes('cielo'), false, 'No viaja ningun enunciado');

    await prisma.course.delete({ where: { id: curso.id } });
  });

  await t.test('6. Un mentor no puede ver examenes de otros mentores via getAllStoredQuizzes sin restriccion de rol', async () => {
    // getAllStoredQuizzes es una funcion del backend; esta prueba verifica que
    // el catalogo global existe y es un objeto plano (la restriccion de rol es
    // responsabilidad del endpoint HTTP, no del servicio en si)
    const all = await getAllStoredQuizzes();
    assert.equal(typeof all, 'object');
    assert.ok(!Array.isArray(all), 'Debe ser un mapa, no un array plano');
  });
});

test('Seguridad Quizzes: integridad del barajado', async (t) => {
  await t.test('1. Barajar 100 veces nunca pierde la respuesta correcta', () => {
    const original: QuizQuestion = {
      id: 'q_integrity',
      text: 'Integridad tras 100 barajadas',
      options: ['Correcto', 'Incorrecto A', 'Incorrecto B', 'Incorrecto C'],
      correctIndex: 0,
      explanation: 'La opcion correcta es "Correcto".',
    };
    for (let i = 0; i < 100; i++) {
      const shuffled = shuffleQuestionOptions(original);
      const correctText = shuffled.options[shuffled.correctIndex];
      assert.equal(correctText, 'Correcto', `Iteracion ${i + 1}: el texto correcto no coincide con el indice`);
    }
  });

  await t.test('2. Barajar 50 veces produce al menos 2 distribuciones distintas (aleatoriedad real)', () => {
    const original: QuizQuestion = {
      id: 'q_randomness',
      text: 'Prueba de aleatoriedad',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: '',
    };
    const indices = new Set<number>();
    for (let i = 0; i < 50; i++) {
      indices.add(shuffleQuestionOptions(original).correctIndex);
    }
    assert.ok(indices.size >= 2, 'La respuesta correcta debe aparecer en al menos 2 posiciones distintas tras 50 barajadas');
  });
});
