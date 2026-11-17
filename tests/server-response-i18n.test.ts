import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { localizeJsonResponses, translateResponseText } from '../server/serverI18n.js';
import { RESPONSE_TRANSLATIONS } from '../server/responseTranslations.js';

function fakeRes() {
  const sent: unknown[] = [];
  const res: any = { json: (body: unknown) => { sent.push(body); return res; } };
  return { res, sent };
}

test('responseTranslations: cada mensaje tiene sus cuatro traducciones no vacías', () => {
  for (const [es, list] of Object.entries(RESPONSE_TRANSLATIONS)) {
    assert.equal(list.length, 4, es);
    for (const text of list) assert.ok(text.trim().length > 0, es);
  }
});

test('translateResponseText: traduce exacto, por patrón y deja intacto lo desconocido', () => {
  assert.equal(translateResponseText('Curso no encontrado', 'en'), 'Course not found');
  assert.equal(translateResponseText('Curso no encontrado', 'es'), 'Curso no encontrado');
  assert.equal(translateResponseText('La opinión no puede pasar de 500 caracteres', 'fr'), "L'avis ne peut pas dépasser 500 caractères");
  assert.equal(translateResponseText('Texto que no existe', 'it'), 'Texto que no existe');
});

test('localizeJsonResponses: traduce error y message según Accept-Language', () => {
  const { res, sent } = fakeRes();
  localizeJsonResponses({ query: {}, headers: { 'accept-language': 'pt' } } as any, res, () => {});
  res.json({ error: 'Usuario no encontrado', code: 'X' });
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
  res.json([1, 2]);
  assert.deepEqual(sent[0], { error: 'Usuário não encontrado', code: 'X' });
  assert.deepEqual(sent[1], { success: true, message: 'Sessão encerrada com sucesso' });
  assert.deepEqual(sent[2], [1, 2]);
});

test('localizeJsonResponses: en español no envuelve la respuesta', () => {
  const { res } = fakeRes();
  const original = res.json;
  localizeJsonResponses({ query: { lang: 'es' }, headers: {} } as any, res, () => {});
  assert.equal(res.json, original);
});

// Misma búsqueda que scripts/i18n-handoff/server_strings.py, para que un mensaje
// nuevo en español sin traducción haga fallar la suite.
const SPANISH = /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|no|un|una|para|con|se|al|en|es|ya|tu|su|debe|debes|pudo|curso|usuario|acceso|inv[aá]lid[oa])\b/i;
const LITERAL = /(?:\b(?:error|message|reason|detail)\s*:\s*|new\s+\w*Error\(\s*(?:\d+\s*,\s*)?)(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;
// Mensajes internos que nunca llegan a una respuesta (arranque, cifrado, descargas, datos guardados).
const INTERNAL = /^Configuracion de DocentOS invalida|^Sin SMTP_HOST|^El valor no viene cifrado|^Sobre cifrado|^Drive no informó|^la descarga|^El secreto TOTP|^Usuario registrado previamente/;

test('todo mensaje en español del servidor está en el diccionario', () => {
  const files = ['server.ts', ...readdirSync('server').filter((f) => f.endsWith('.ts')).map((f) => `server/${f}`)]
    .filter((f) => !/mailer|serverI18n|responseTranslations|logger|contractTexts|seo\.ts/.test(f));
  const found = new Set<string>();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(LITERAL)) {
      const text = m[1] ?? m[2] ?? m[3];
      if (!text || text.length < 4 || (m[3] !== undefined && text.includes('${')) || !SPANISH.test(text)) continue;
      found.add(text.replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
  assert.ok(found.size > 150, `Se esperaban más de 150 mensajes y se encontraron ${found.size}`);
  const missing = [...found].filter((text) => !INTERNAL.test(text) && !RESPONSE_TRANSLATIONS[text]);
  assert.deepEqual(missing, [], 'Añade estos mensajes a server/responseTranslations.ts');
});
