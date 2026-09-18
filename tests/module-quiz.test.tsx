/**
 * Examenes por modulo.
 *
 * Estas pruebas fijan dos reglas que se rompieron en produccion: un modulo sin
 * preguntas no muestra examen —antes caia a un cuestionario de ejemplo sobre el
 * propio DocentOS, que aparecia dentro de un curso de ingles— y tampoco bloquea
 * al siguiente, porque exigir un examen inexistente dejaba el temario cerrado
 * sin forma de abrirlo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModuleQuizCard } from '../src/components/ModuleQuizCard.js';
import {
  MODULE_QUIZZES,
  SAMPLE_QUIZ,
  QuizzesPluginEngine,
  getModuleQuestions,
  moduleHasQuiz,
} from '../src/plugins/QuizzesPlugin.js';
import type { Module } from '../src/types.js';

function moduleOf(id: string, title: string): Module {
  return { id, title, order: 1, videos: [] } as unknown as Module;
}

/** Registra preguntas para un modulo durante una prueba y las retira despues. */
function withQuiz(moduleId: string, run: () => void): void {
  MODULE_QUIZZES[moduleId] = SAMPLE_QUIZ;
  try {
    run();
  } finally {
    delete MODULE_QUIZZES[moduleId];
  }
}

test('Exámenes: solo los módulos con preguntas muestran examen', async (t) => {
  await t.test('1. El banco no asigna preguntas a ningún módulo real', () => {
    assert.deepEqual(MODULE_QUIZZES, {}, 'Sin modelo de datos, el banco debe estar vacío');
    assert.deepEqual(getModuleQuestions('cualquier-uuid'), []);
    assert.equal(moduleHasQuiz('cualquier-uuid'), false);
  });

  await t.test('2. Un módulo sin preguntas no dibuja nada', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModuleQuizCard, { module: moduleOf('uuid-ingles-1', 'Módulo 1') }),
    );
    assert.equal(html, '', 'Ni cabecera, ni temporizador, ni "Examen de Validación"');
  });

  await t.test('3. Con preguntas, el examen se anuncia con el título de su módulo', () => {
    withQuiz('uuid-ingles-1', () => {
      const html = renderToStaticMarkup(
        React.createElement(ModuleQuizCard, { module: moduleOf('uuid-ingles-1', 'Módulo 1') }),
      );
      assert.match(html, /Examen de validación/);
      assert.match(html, /Módulo 1/, 'La portada nombra el módulo que se va a evaluar');
      assert.match(html, /Comenzar examen/);
    });
  });

  await t.test('4. La portada no enseña las preguntas ni arranca el reloj', () => {
    // El examen se montaba bajo el vídeo con el cronómetro ya corriendo: a los
    // cinco minutos de clase se entregaba solo, en blanco, gastando un intento.
    withQuiz('uuid-ingles-1', () => {
      const html = renderToStaticMarkup(
        React.createElement(ModuleQuizCard, { module: moduleOf('uuid-ingles-1', 'Módulo 1') }),
      );
      assert.equal(html.includes('arquitectura modular'), false, 'Los enunciados esperan a «Comenzar»');
      assert.equal(/\d{2}:\d{2}/.test(html), false, 'Sin cuenta atrás antes de empezar');
    });
  });

  await t.test('5. Como escenario, un módulo sin examen no deja la pantalla vacía', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModuleQuizCard, {
        module: moduleOf('uuid-sin-examen', 'Módulo 9'),
        onExit: () => {},
      }),
    );
    assert.match(html, /todavía no tiene examen|Cargando el examen/);
    assert.match(html, /Volver a la clase/, 'Siempre hay salida de vuelta al vídeo');
  });

  await t.test('6. Las preguntas de ejemplo no se cuelan en ningún módulo', () => {
    const html = renderToStaticMarkup(
      React.createElement(ModuleQuizCard, { module: moduleOf('otro-uuid', 'Ingles') }),
    );
    assert.equal(html.includes('arquitectura modular'), false);
  });
});

test('Exámenes: un módulo sin examen no puede bloquear al siguiente', async (t) => {
  const modules = [
    moduleOf('m-1', 'Fundamentos'),
    moduleOf('m-2', 'Intermedio'),
    moduleOf('m-3', 'Avanzado'),
  ];

  await t.test('1. Sin exámenes definidos, todo el temario está accesible', () => {
    const engine = new QuizzesPluginEngine();
    for (let index = 0; index < modules.length; index++) {
      assert.equal(
        engine.isModuleUnlocked(modules, index, 'user-1'),
        true,
        `El módulo ${index + 1} no puede quedar bloqueado por un examen que no existe`,
      );
    }
  });

  await t.test('2. Con examen y sin aprobarlo, el siguiente sigue bloqueado', () => {
    withQuiz('m-1', () => {
      const engine = new QuizzesPluginEngine();
      assert.equal(engine.isModuleUnlocked(modules, 0, 'user-1'), true, 'El primero siempre abierto');
      assert.equal(engine.isModuleUnlocked(modules, 1, 'user-1'), false);
    });
  });

  await t.test('3. Al aprobar, el siguiente se abre', () => {
    withQuiz('m-1', () => {
      const engine = new QuizzesPluginEngine();
      engine.recordAttempt('user-1', 'm-1', 100, 80);
      assert.equal(engine.isModuleUnlocked(modules, 1, 'user-1'), true);
      assert.equal(engine.isModuleUnlocked(modules, 2, 'user-1'), true, 'El módulo 2 no tiene examen');
    });
  });

  await t.test('4. Suspender no abre nada', () => {
    withQuiz('m-1', () => {
      const engine = new QuizzesPluginEngine();
      engine.recordAttempt('user-1', 'm-1', 40, 80);
      assert.equal(engine.isModuleUnlocked(modules, 1, 'user-1'), false);
    });
  });

  await t.test('5. Con el plugin desactivado nada se bloquea', () => {
    withQuiz('m-1', () => {
      const engine = new QuizzesPluginEngine();
      assert.equal(engine.isModuleUnlocked(modules, 2, 'user-1', 80, false), true);
    });
  });
});
