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
import {
  MODULE_QUIZZES,
  setModuleQuiz,
  syncModuleQuizzes,
  getModuleQuestions,
  moduleHasQuiz,
  QuizzesPluginEngine,
} from '../src/plugins/QuizzesPlugin.js';

test('Servicio de Quizzes: Persistencia, Validación y Sanitización', async (t) => {
  const testModuleId = `test_mod_${Date.now()}`;

  await t.test('1. Un módulo nuevo no tiene preguntas por defecto', () => {
    const questions = getQuizByModuleId(testModuleId);
    assert.deepEqual(questions, []);
  });

  await t.test('2. Guardar preguntas limpia opciones vacías y asegura índices válidos', () => {
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

    const saved = saveQuizForModule(testModuleId, inputQuestions);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].options.length, 2, 'Las opciones vacías fueron filtradas');
    assert.equal(saved[1].correctIndex, 0, 'El índice fuera de rango se corrigió');
    assert.ok(saved[1].explanation.length > 0, 'Se asignó explicación por defecto');

    // Comprobar lectura
    const retrieved = getQuizByModuleId(testModuleId);
    assert.equal(retrieved.length, 2);
    assert.equal(retrieved[0].text, '¿Qué es DocentOS?');
  });

  await t.test('3. Eliminar preguntas del módulo limpia el registro', () => {
    const deleted = deleteQuizForModule(testModuleId);
    assert.equal(deleted, true);
    assert.deepEqual(getQuizByModuleId(testModuleId), []);
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
