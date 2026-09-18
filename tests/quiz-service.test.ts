/**
 * Pruebas unitarias para el Servicio de Evaluaciones y Quizzes (`quiz-service.test.ts`)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveQuizForModule,
  getQuizByModuleId,
  deleteQuizForModule,
  getAllStoredQuizzes,
  shuffleQuestionOptions,
  type QuizQuestion,
} from '../server/quizService.js';
import { prisma } from '../server/prisma.js';
import {
  MODULE_QUIZZES,
  setModuleQuiz,
  syncModuleQuizzes,
  getModuleQuestions,
  moduleHasQuiz,
  QuizzesPluginEngine,
} from '../src/plugins/QuizzesPlugin.js';

/**
 * Crea un modulo real y devuelve su identificador.
 *
 * Desde que los examenes viven en PostgreSQL, `ModuleQuiz.moduleId` es una clave
 * foranea contra `Module`: un identificador inventado ya no se puede guardar.
 * Eso es justo lo que se buscaba —un examen no puede quedar colgando de un
 * modulo que no existe—, y obliga a que las pruebas trabajen sobre datos
 * reales en vez de cadenas sueltas.
 */
async function crearModuloDePrueba(etiqueta: string) {
  const curso = await prisma.course.create({
    data: {
      title: `Curso de prueba ${etiqueta}`,
      description: 'Creado por quiz-service.test.ts',
      price: 0,
      coverImage: '',
    },
  });
  const modulo = await prisma.module.create({
    data: { title: `Modulo ${etiqueta}`, order: 1, courseId: curso.id },
  });
  return { moduleId: modulo.id, courseId: curso.id };
}

/** Borrar el curso arrastra modulo y examen por el borrado en cascada. */
async function borrarCursoDePrueba(courseId: string) {
  await prisma.course.deleteMany({ where: { id: courseId } });
}

test('Servicio de Quizzes: Persistencia, Validación y Sanitización', async (t) => {
  const { moduleId: testModuleId, courseId } = await crearModuloDePrueba(`persistencia_${Date.now()}`);

  await t.test('1. Un módulo nuevo no tiene preguntas por defecto', async () => {
    const questions = await getQuizByModuleId(testModuleId);
    assert.deepEqual(questions, []);
  });

  await t.test('2. Guardar preguntas limpia opciones vacías y asegura índices válidos', async () => {
    const inputQuestions: QuizQuestion[] = [
      {
        id: 'q1',
        text: '¿Qué es DocentOS?',
        options: ['Un LMS AI-Native', 'Un navegador web', '', '   '],
        correctIndex: 0,
        explanation: 'Es la plataforma de educación modular.',
      },
      {
        id: 'q2',
        text: '¿Cómo se evalúa?',
        options: ['Con preguntas interactivas', 'Sin preguntas'],
        correctIndex: 5, // Índice fuera de rango debe normalizarse a 0
        explanation: '',
      },
    ];

    const saved = await saveQuizForModule(testModuleId, inputQuestions);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].options.length, 2, 'Las opciones vacías fueron filtradas');
    assert.equal(saved[1].correctIndex, 0, 'El índice fuera de rango se corrigió');
    assert.ok(saved[1].explanation.length > 0, 'Se asignó explicación por defecto');

    // Comprobar lectura
    const retrieved = await getQuizByModuleId(testModuleId);
    assert.equal(retrieved.length, 2);
    assert.equal(retrieved[0].text, '¿Qué es DocentOS?');
  });

  await t.test('3. Eliminar preguntas del módulo limpia el registro', async () => {
    const deleted = await deleteQuizForModule(testModuleId);
    assert.equal(deleted, true);
    assert.deepEqual(await getQuizByModuleId(testModuleId), []);
  });

  await t.test('3b. Un examen no puede colgar de un módulo inexistente', async () => {
    await assert.rejects(
      () =>
        saveQuizForModule('modulo-que-no-existe', [
          { id: 'q', text: 'Pregunta', options: ['A', 'B'], correctIndex: 0, explanation: 'X' },
        ]),
      'La clave foránea debe rechazar el guardado',
    );
  });

  await t.test('4. shuffleQuestionOptions conserva la respuesta correcta y mezcla las opciones', () => {
    const question: QuizQuestion = {
      id: 'q_test_shuffle',
      text: '¿Cuál es la capital de Francia?',
      options: ['París', 'Madrid', 'Roma', 'Berlín'],
      correctIndex: 0,
      explanation: 'París es la capital.',
    };

    const shuffled = shuffleQuestionOptions(question);
    assert.equal(shuffled.options.length, 4);
    assert.equal(shuffled.options[shuffled.correctIndex], 'París', 'El nuevo índice apunta al texto correcto');
  });

  await borrarCursoDePrueba(courseId);
});

test('Plugin Frontend Quizzes: Sincronización y Evaluación', async (t) => {
  const modId = 'frontend-test-mod';
  const sampleQuestions: QuizQuestion[] = [
    {
      id: 'fq1',
      text: '¿Pregunta 1?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      explanation: 'La respuesta correcta es B.',
    },
    {
      id: 'fq2',
      text: '¿Pregunta 2?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      explanation: 'La respuesta correcta es C.',
    },
  ];

  await t.test('1. setModuleQuiz actualiza MODULE_QUIZZES', () => {
    setModuleQuiz(modId, sampleQuestions);
    assert.equal(moduleHasQuiz(modId), true);
    assert.equal(getModuleQuestions(modId).length, 2);
  });

  await t.test('2. QuizzesPluginEngine evalúa respuestas correctamente', () => {
    const engine = new QuizzesPluginEngine();
    
    // Respuestas 100% correctas
    const resAllCorrect = engine.evaluateQuiz(sampleQuestions, { fq1: 1, fq2: 2 }, 80);
    assert.equal(resAllCorrect.passed, true);
    assert.equal(resAllCorrect.scorePercentage, 100);
    assert.equal(resAllCorrect.correctCount, 2);

    // 1 de 2 correctas (50%) -> reprobado si passingScore = 80
    const resHalf = engine.evaluateQuiz(sampleQuestions, { fq1: 1, fq2: 0 }, 80);
    assert.equal(resHalf.passed, false);
    assert.equal(resHalf.scorePercentage, 50);
    assert.equal(resHalf.correctCount, 1);
  });

  await t.test('3. syncModuleQuizzes reemplaza el mapa en caliente', () => {
    syncModuleQuizzes({
      'mod-otro': [sampleQuestions[0]],
    });
    assert.equal(moduleHasQuiz(modId), false);
    assert.equal(moduleHasQuiz('mod-otro'), true);
  });
});

test('Quizzes: generacion de preguntas - sanitizacion y robustez', async (t) => {
  await t.test('1. shuffleQuestionOptions con 1 sola opcion no rompe el indice', () => {
    const q: QuizQuestion = {
      id: 'q_single',
      text: 'Pregunta unica',
      options: ['Solo esta opcion'],
      correctIndex: 0,
      explanation: 'Explicacion.',
    };
    const shuffled = shuffleQuestionOptions(q);
    assert.equal(shuffled.correctIndex, 0);
    assert.equal(shuffled.options[0], 'Solo esta opcion');
  });

  await t.test('2. shuffleQuestionOptions no muta el objeto original', () => {
    const original: QuizQuestion = {
      id: 'q_mutation',
      text: 'Prueba inmutabilidad',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Debe ser inmutable.',
    };
    const clone = { ...original, options: [...original.options] };
    shuffleQuestionOptions(original);
    assert.deepEqual(original, clone, 'El objeto original no debe ser mutado');
  });

  await t.test('3. saveQuizForModule rechaza preguntas con texto vacio', async () => {
    const { moduleId: modId, courseId: cursoTemporal } = await crearModuloDePrueba(`vacio_${Date.now()}`);
    const badQuestions: QuizQuestion[] = [
      { id: 'empty_text', text: '   ', options: ['A', 'B'], correctIndex: 0, explanation: 'X' },
      { id: 'valid', text: 'Pregunta valida', options: ['A', 'B'], correctIndex: 0, explanation: 'X' },
    ];
    const saved = await saveQuizForModule(modId, badQuestions);
    // Solo la pregunta valida debe guardarse
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, 'valid');
    await borrarCursoDePrueba(cursoTemporal);
  });

  await t.test('4. saveQuizForModule limita las opciones a un maximo de 4', async () => {
    const { moduleId: modId, courseId: cursoTemporal } = await crearModuloDePrueba(`maximo_${Date.now()}`);
    const q: QuizQuestion = {
      id: 'q_overflow',
      text: 'Opciones desbordadas',
      options: ['A', 'B', 'C', 'D', 'E', 'F'],
      correctIndex: 0,
      explanation: 'Solo debe haber 4.',
    };
    const saved = await saveQuizForModule(modId, [q]);
    assert.ok(saved[0].options.length <= 4, 'No debe haber mas de 4 opciones');
    await borrarCursoDePrueba(cursoTemporal);
  });

  await t.test('5. getAllStoredQuizzes retorna objeto, nunca null ni undefined', () => {
    const all = getAllStoredQuizzes();
    assert.ok(all !== null && all !== undefined, 'Nunca debe retornar null/undefined');
    assert.equal(typeof all, 'object');
  });
});

test('Quizzes: evaluacion con casos extremos', async (t) => {
  await t.test('1. Evaluar con 0 preguntas retorna 0% y no lanza error', () => {
    const engine = new QuizzesPluginEngine();
    const result = engine.evaluateQuiz([], {}, 80);
    assert.equal(result.scorePercentage, 0);
    assert.equal(result.passed, false);
    assert.equal(result.correctCount, 0);
  });

  await t.test('2. Respuestas con claves inexistentes se cuentan como incorrectas', () => {
    const questions: QuizQuestion[] = [
      { id: 'q1', text: 'Test', options: ['A', 'B'], correctIndex: 0, explanation: '' },
    ];
    const engine = new QuizzesPluginEngine();
    // La clave 'q_inexistente' no existe en las preguntas
    const result = engine.evaluateQuiz(questions, { q_inexistente: 0 }, 80);
    assert.equal(result.correctCount, 0);
    assert.equal(result.passed, false);
  });

  await t.test('3. Puntaje de aprobado = 100 solo pasa con todo correcto', () => {
    const questions: QuizQuestion[] = [
      { id: 'q1', text: 'P1', options: ['A', 'B'], correctIndex: 0, explanation: '' },
      { id: 'q2', text: 'P2', options: ['A', 'B'], correctIndex: 1, explanation: '' },
    ];
    const engine = new QuizzesPluginEngine();
    const fail = engine.evaluateQuiz(questions, { q1: 0, q2: 0 }, 100);
    assert.equal(fail.passed, false);
    const pass = engine.evaluateQuiz(questions, { q1: 0, q2: 1 }, 100);
    assert.equal(pass.passed, true);
  });
});
