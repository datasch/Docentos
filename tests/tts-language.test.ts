import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTextLanguage, resolveVoiceForText, voiceLanguage } from '../src/lib/ttsLanguage.js';

const EN = 'Hello! Welcome to the lesson. In this class we will explore the key strategies step by step.';
const ES = '¡Hola! Bienvenido a la lección. En esta clase exploraremos las estrategias clave paso a paso.';
const PT = 'Olá! Bem-vindo à lição. Nesta aula vamos explorar as estratégias principais passo a passo.';
const FR = 'Bonjour ! Bienvenue dans la leçon. Dans ce cours nous allons explorer les stratégies clés.';
const IT = 'Ciao! Benvenuto alla lezione. In questa classe esploreremo le strategie chiave passo dopo passo.';

test('detectTextLanguage: reconoce los cinco idiomas de la app', () => {
  assert.equal(detectTextLanguage(EN), 'en');
  assert.equal(detectTextLanguage(ES), 'es');
  assert.equal(detectTextLanguage(PT), 'pt');
  assert.equal(detectTextLanguage(FR), 'fr');
  assert.equal(detectTextLanguage(IT), 'it');
});

test('detectTextLanguage: textos cortos o vacíos no se afirman', () => {
  assert.equal(detectTextLanguage('OK'), null);
  assert.equal(detectTextLanguage('   '), null);
  assert.equal(detectTextLanguage('Hello world'), null);
});

test('resolveVoiceForText: texto en inglés con voz española usa voz inglesa', () => {
  assert.equal(resolveVoiceForText(EN, 'es-ES-Carlos'), 'en-US-Elena');
  assert.equal(voiceLanguage(resolveVoiceForText(FR, 'es-MX-Sofia')), 'fr');
});

test('resolveVoiceForText: respeta la voz elegida si coincide o no se puede saber', () => {
  assert.equal(resolveVoiceForText(EN, 'en-GB-Arthur'), 'en-GB-Arthur');
  assert.equal(resolveVoiceForText(ES, 'es-AR-Mateo'), 'es-AR-Mateo');
  assert.equal(resolveVoiceForText('Hola', 'en-US-Elena'), 'en-US-Elena');
  assert.equal(resolveVoiceForText(EN, undefined), 'en-US-Elena');
});
