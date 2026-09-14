/**
 * Navegacion del alumno dentro de un curso.
 *
 * Fija los comportamientos que faltaban: avanzar y retroceder entre lecciones
 * cruzando el salto de modulo, retomar por la primera clase pendiente en lugar
 * de volver siempre a la primera, y contar el progreso de ESTE curso y no el de
 * todos —con varios cursos el porcentaje se disparaba y el diploma se daba por
 * ganado antes de tiempo—.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countCompleted,
  findResumePosition,
  flattenLessons,
  indexOfLesson,
  isModuleOpen,
  moduleLockStates,
  stepLesson,
} from '../src/lib/courseNavigation.js';
import {
  resolveLandingCta,
  shouldShowTestimonials,
  visibleCourses,
} from '../src/components/LandingPage.js';
import { DEFAULT_AVATAR, avatarSrc } from '../src/lib/avatar.js';
import { certificateForCourse, switchableCourses } from '../src/components/CourseViewer.js';
import type { CertificateRecord, Course } from '../src/types.js';

/** Curso de tres módulos: 2 + 1 + 2 lecciones. */
function sampleCourse(): Course {
  const video = (id: string, title: string) => ({ id, title, order: 1 }) as any;
  return {
    id: 'curso-ingles',
    title: 'Inglés',
    modules: [
      { id: 'm1', title: 'Módulo 1', order: 1, videos: [video('v1', 'Fundamentos'), video('v2', 'Saludos')] },
      { id: 'm2', title: 'Módulo 2', order: 2, videos: [video('v3', 'Presente simple')] },
      { id: 'm3', title: 'Módulo 3', order: 3, videos: [video('v4', 'Pasado'), video('v5', 'Futuro')] },
    ],
  } as unknown as Course;
}

test('Curso: la lista plana de lecciones respeta el orden del temario', async (t) => {
  await t.test('1. Se recorren los módulos en orden y se numeran de corrido', () => {
    const lessons = flattenLessons(sampleCourse());
    assert.equal(lessons.length, 5);
    assert.deepEqual(lessons.map((lesson) => lesson.videoId), ['v1', 'v2', 'v3', 'v4', 'v5']);
    assert.deepEqual(lessons.map((lesson) => lesson.number), [1, 2, 3, 4, 5]);
    assert.deepEqual(lessons[2], {
      moduleIndex: 1,
      videoIndex: 0,
      videoId: 'v3',
      title: 'Presente simple',
      moduleTitle: 'Módulo 2',
      number: 3,
    });
  });

  await t.test('2. Un curso vacío o ausente no revienta la vista', () => {
    assert.deepEqual(flattenLessons(null), []);
    assert.deepEqual(flattenLessons({ modules: [] } as any), []);
    assert.equal(indexOfLesson([], { moduleIndex: 0, videoIndex: 0 }), -1);
  });
});

test('Curso: anterior y siguiente cruzan el salto de módulo', async (t) => {
  const course = sampleCourse();

  await t.test('1. La última lección de un módulo enlaza con la primera del siguiente', () => {
    assert.deepEqual(stepLesson(course, { moduleIndex: 0, videoIndex: 1 }, 1), {
      moduleIndex: 1,
      videoIndex: 0,
    });
    assert.deepEqual(stepLesson(course, { moduleIndex: 1, videoIndex: 0 }, -1), {
      moduleIndex: 0,
      videoIndex: 1,
    });
  });

  await t.test('2. En los extremos no hay a dónde ir, y eso apaga el botón', () => {
    assert.equal(stepLesson(course, { moduleIndex: 0, videoIndex: 0 }, -1), null);
    assert.equal(stepLesson(course, { moduleIndex: 2, videoIndex: 1 }, 1), null);
  });

  await t.test('3. Una posición inexistente no propone ningún salto', () => {
    assert.equal(stepLesson(course, { moduleIndex: 9, videoIndex: 9 }, 1), null);
  });
});

test('Curso: se retoma por donde se quedó', async (t) => {
  const course = sampleCourse();

  await t.test('1. Sin progreso se empieza por la primera lección', () => {
    assert.deepEqual(findResumePosition(course, {}), { moduleIndex: 0, videoIndex: 0 });
  });

  await t.test('2. Con las dos primeras vistas se abre la tercera, en el módulo 2', () => {
    assert.deepEqual(findResumePosition(course, { v1: true, v2: true }), {
      moduleIndex: 1,
      videoIndex: 0,
    });
  });

  await t.test('3. Un hueco en medio manda a la lección pendiente, no a la última vista', () => {
    assert.deepEqual(findResumePosition(course, { v1: true, v2: true, v4: true, v5: true }), {
      moduleIndex: 1,
      videoIndex: 0,
    });
  });

  await t.test('4. Con el curso terminado se vuelve al principio para repasar', () => {
    const todo = { v1: true, v2: true, v3: true, v4: true, v5: true };
    assert.deepEqual(findResumePosition(course, todo), { moduleIndex: 0, videoIndex: 0 });
  });

  await t.test('5. Un curso sin lecciones no propone posición alguna', () => {
    assert.equal(findResumePosition({ modules: [] } as any, {}), null);
  });
});

test('Curso: el progreso cuenta solo las lecciones de este curso', async (t) => {
  const course = sampleCourse();

  await t.test('1. Las lecciones completadas en otros cursos no suman aquí', () => {
    const progreso = { v1: true, 'otro-curso-v1': true, 'otro-curso-v2': true };
    assert.equal(
      countCompleted(course, progreso),
      1,
      'Contar todo el progreso del usuario disparaba el porcentaje por encima del 100%',
    );
  });

  await t.test('2. Una lección marcada como no completada no cuenta', () => {
    assert.equal(countCompleted(course, { v1: true, v2: false }), 1);
  });

  await t.test('3. Curso entero completado da el total exacto', () => {
    assert.equal(countCompleted(course, { v1: true, v2: true, v3: true, v4: true, v5: true }), 5);
  });
});

test('Curso: el diploma que se enseña es el de este curso', async (t) => {
  const certificate = (courseId: string, code: string) =>
    ({
      id: `cert-${courseId}`,
      verificationCode: code,
      courseId,
      courseTitle: courseId,
      recipientName: 'Carlos Mendoza',
      completionPercent: 100,
      issuedAt: '2026-09-01T00:00:00.000Z',
    }) as CertificateRecord;

  await t.test('1. El diploma del curso abierto se muestra', () => {
    const own = certificate('curso-ingles', 'DOC-AAA');
    assert.equal(certificateForCourse(own, 'curso-ingles'), own);
  });

  await t.test('2. El de otro curso no se cuela en la pantalla', () => {
    // Terminar un curso abría la tarjeta «Curso completado» en todos los
    // demás, con el título del curso abierto y el código del terminado.
    const otro = certificate('curso-mentoria', 'DOC-0F81948B86F94940');
    assert.equal(certificateForCourse(otro, 'curso-ingles'), null);
  });

  await t.test('3. Sin diploma no se inventa ninguno', () => {
    assert.equal(certificateForCourse(null, 'curso-ingles'), null);
    assert.equal(certificateForCourse(undefined, 'curso-ingles'), null);
  });
});

test('Portada: los botones del encabezado llevan a algún sitio', async (t) => {
  await t.test('1. Las rutas de la aplicación se traducen a su sección', () => {
    assert.equal(
      resolveLandingCta('#courses', '#cursos'),
      '#cursos',
      'La configuración guardada apuntaba a #courses, que no existe en la portada',
    );
    assert.equal(resolveLandingCta('/courses', '#cursos'), '#cursos');
    // Los planes estan ocultos en la portada: sus anclas caen al catalogo.
    assert.equal(resolveLandingCta('#vip', '#planes'), '#cursos');
    assert.equal(resolveLandingCta('/vip', '#planes'), '#cursos');
    // Los testimonios volvieron: su ancla lleva otra vez a su seccion.
    assert.equal(resolveLandingCta('#testimonios', '#cursos'), '#testimonios');
  });

  await t.test('2. Un ancla propia de la portada se respeta', () => {
    assert.equal(resolveLandingCta('#beneficios', '#cursos'), '#beneficios');
  });

  await t.test('3. Un enlace externo se deja intacto', () => {
    assert.equal(resolveLandingCta('https://ejemplo.com/inscripcion', '#cursos'), 'https://ejemplo.com/inscripcion');
  });

  await t.test('4. Un destino vacío o desconocido cae al catálogo, no a la nada', () => {
    assert.equal(resolveLandingCta('', '#cursos'), '#cursos');
    assert.equal(resolveLandingCta(undefined, '#cursos'), '#cursos');
    assert.equal(resolveLandingCta('ruta-inventada', '#cursos'), '#cursos');
  });
});

test('Curso: la progresión secuencial cierra los módulos que aún no tocan', async (t) => {
  const sequential = () => ({ ...sampleCourse(), sequentialUnlock: true }) as Course;

  await t.test('1. Sin la opción activa el temario se ve entero', () => {
    const states = moduleLockStates(sampleCourse(), {});
    assert.deepEqual(states.map((state) => state.unlocked), [true, true, true]);
  });

  await t.test('2. Con la opción activa solo abre el primer módulo', () => {
    const states = moduleLockStates(sequential(), {});
    assert.deepEqual(states.map((state) => state.unlocked), [true, false, false]);
    assert.deepEqual(states.map((state) => state.reason), [null, 'progress', 'progress']);
  });

  await t.test('3. Terminar el módulo 1 abre el 2, y no el 3', () => {
    const states = moduleLockStates(sequential(), { v1: true, v2: true });
    assert.deepEqual(states.map((state) => state.unlocked), [true, true, false]);
  });

  await t.test('4. Una lección suelta del módulo 2 no adelanta el módulo 3', () => {
    const states = moduleLockStates(sequential(), { v1: true, v2: true, v4: true });
    assert.deepEqual(states.map((state) => state.unlocked), [true, true, false]);
  });

  await t.test('5. Con todo lo anterior visto se abre el último módulo', () => {
    const states = moduleLockStates(sequential(), { v1: true, v2: true, v3: true });
    assert.deepEqual(states.map((state) => state.unlocked), [true, true, true]);
  });

  await t.test('6. El examen pendiente cierra el módulo aunque las clases estén vistas', () => {
    const states = moduleLockStates(sequential(), { v1: true, v2: true }, (index) => index !== 1);
    assert.equal(states[1].unlocked, false);
    assert.equal(states[1].reason, 'quiz');
  });

  await t.test('7. El primer módulo nunca se cierra: el curso ha de poder empezar', () => {
    const states = moduleLockStates(sequential(), {}, () => false);
    assert.equal(states[0].unlocked, true);
    assert.equal(isModuleOpen(states, 0), true);
  });

  await t.test('8. Un curso vacío no produce candados, y un índice fuera de rango se da por abierto', () => {
    assert.deepEqual(moduleLockStates(null, {}), []);
    assert.equal(isModuleOpen([], 3), true);
  });
});

test('Portada: la sección de testimonios se pinta solo cuando hay algo que enseñar', async (t) => {
  await t.test('1. Con opiniones publicadas se ve, haya sesión o no', () => {
    assert.equal(shouldShowTestimonials(3, false), true);
    assert.equal(shouldShowTestimonials(3, true), true);
  });

  await t.test('2. Sin ninguna publicada, quien tiene sesión la ve para poder escribir la primera', () => {
    assert.equal(shouldShowTestimonials(0, true), true);
  });

  await t.test('3. A un visitante de una instalación recién montada no se le enseña el hueco vacío', () => {
    assert.equal(
      shouldShowTestimonials(0, false),
      false,
      'Un titular sin testimonios debajo hace que la portada parezca rota',
    );
  });
});

test('Portada: con sesión se ven los cursos propios, no el escaparate', async (t) => {
  const catalogo = [
    { id: 'c1', hasAccess: true },
    { id: 'c2', hasAccess: false },
    { id: 'c3' },
  ];

  await t.test('1. Sin sesión se enseña el catálogo entero: es lo que invita a registrarse', () => {
    assert.equal(visibleCourses(catalogo, false).length, 3);
  });

  await t.test('2. Con sesión solo quedan los cursos con acceso', () => {
    assert.deepEqual(
      visibleCourses(catalogo, true).map((c) => c.id),
      ['c1'],
      'Entrar y seguir viendo cursos ajenos con candado convierte la portada en un anuncio',
    );
  });

  await t.test('3. Un curso sin el dato de acceso no se cuela', () => {
    assert.equal(visibleCourses([{ id: 'c3' } as (typeof catalogo)[number]], true).length, 0);
  });

  await t.test('4. Quien no tiene ningún curso ve la lista vacía, no el catálogo', () => {
    assert.deepEqual(visibleCourses([{ id: 'c2', hasAccess: false }] as typeof catalogo, true), []);
  });
});

test('Perfil: quien no sube foto sale con el logo de la escuela', async (t) => {
  await t.test('1. Sin foto se usa el logo', () => {
    assert.equal(avatarSrc(undefined), DEFAULT_AVATAR);
    assert.equal(avatarSrc(null), DEFAULT_AVATAR);
    assert.equal(avatarSrc('   '), DEFAULT_AVATAR);
  });

  await t.test('2. Los retratos de archivo que quedaron en la base también', () => {
    // Las instalaciones anteriores sembraron caras de banco de imágenes: hacían
    // pensar que detrás de esa ficha había una persona concreta.
    assert.equal(
      avatarSrc('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
      DEFAULT_AVATAR,
    );
    assert.equal(
      avatarSrc('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
      DEFAULT_AVATAR,
    );
  });

  await t.test('3. Una foto de verdad no se toca', () => {
    const propia = 'https://cdn.giantucchi.com/avatars/ricky.jpg';
    assert.equal(avatarSrc(propia), propia);
  });
});

test('Curso: el selector de la cabecera solo ofrece los cursos propios', async (t) => {
  const catalogo = [
    { id: 'abierto', hasAccess: true },
    { id: 'ajeno', hasAccess: false },
    { id: 'otro-mio', hasAccess: true },
  ];

  await t.test('1. Un curso sin acceso no se ofrece', () => {
    assert.deepEqual(
      switchableCourses(catalogo, 'abierto').map((c) => c.id),
      ['abierto', 'otro-mio'],
      'Elegirlo llevaba a una pantalla bloqueada: el desplegable prometía una navegación que no existía',
    );
  });

  await t.test('2. El curso abierto se mantiene aunque no se tenga acceso', () => {
    // Se llega a él desde la portada para verlo por fuera; quitarlo de su propio
    // selector dejaría la cabecera sin nombre.
    assert.deepEqual(
      switchableCourses(catalogo, 'ajeno').map((c) => c.id),
      ['abierto', 'ajeno', 'otro-mio'],
    );
  });

  await t.test('3. Con un solo curso propio no hay nada entre lo que saltar', () => {
    const solo = switchableCourses([{ id: 'mio', hasAccess: true }, { id: 'ajeno' }], 'mio');
    assert.equal(solo.length, 1, 'Con una sola opción la cabecera pinta el título, no un desplegable');
  });
});
