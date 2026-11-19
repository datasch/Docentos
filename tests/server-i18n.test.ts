import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRequestLanguage,
  getLocalizedMessage,
  sendApiError,
  SERVER_LANGUAGES,
  DEFAULT_SERVER_LANGUAGE,
} from '../server/serverI18n.js';

test('serverI18n: resolución de idioma por defecto', () => {
  assert.equal(resolveRequestLanguage(), DEFAULT_SERVER_LANGUAGE);
  assert.equal(resolveRequestLanguage({}), DEFAULT_SERVER_LANGUAGE);
  assert.equal(resolveRequestLanguage({ query: {} }), DEFAULT_SERVER_LANGUAGE);
  assert.equal(resolveRequestLanguage({ query: { lang: 'de' } }), DEFAULT_SERVER_LANGUAGE);
});

test('serverI18n: resolución de idioma por query param ?lang=', () => {
  assert.equal(resolveRequestLanguage({ query: { lang: 'en' } }), 'en');
  assert.equal(resolveRequestLanguage({ query: { lang: 'PT' } }), 'pt');
  assert.equal(resolveRequestLanguage({ query: { lang: 'fr-FR' } }), 'fr');
  assert.equal(resolveRequestLanguage({ query: { lang: 'it' } }), 'it');
  assert.equal(resolveRequestLanguage({ query: { lang: 'es' } }), 'es');
});

test('serverI18n: resolución de idioma por cabecera Accept-Language', () => {
  assert.equal(
    resolveRequestLanguage({ headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' } }),
    'fr',
  );
  assert.equal(
    resolveRequestLanguage({ headers: { 'accept-language': 'pt-BR,pt;q=0.9' } }),
    'pt',
  );
  assert.equal(
    resolveRequestLanguage({ headers: { 'accept-language': 'en-US,en;q=0.5' } }),
    'en',
  );
  assert.equal(
    resolveRequestLanguage({ headers: { 'accept-language': 'it-IT,it;q=0.8' } }),
    'it',
  );
  assert.equal(
    resolveRequestLanguage({ headers: { 'accept-language': 'ja-JP,zh-CN' } }),
    DEFAULT_SERVER_LANGUAGE,
  );
});

test('serverI18n: query param tiene prioridad sobre Accept-Language', () => {
  assert.equal(
    resolveRequestLanguage({
      query: { lang: 'pt' },
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    }),
    'pt',
  );
});

test('serverI18n: getLocalizedMessage devuelve el idioma correcto y fallback', () => {
  assert.equal(
    getLocalizedMessage('AUTH_REQUIRED', 'en', 'Debes iniciar sesión para continuar.'),
    'You must log in to continue.',
  );
  assert.equal(
    getLocalizedMessage('AUTH_REQUIRED', 'pt', 'Debes iniciar sesión para continuar.'),
    'Você deve iniciar sessão para continuar.',
  );
  assert.equal(
    getLocalizedMessage('AUTH_REQUIRED', 'fr', 'Debes iniciar sesión para continuar.'),
    'Vous devez vous connecter pour continuer.',
  );
  assert.equal(
    getLocalizedMessage('AUTH_REQUIRED', 'it', 'Debes iniciar sesión para continuar.'),
    "Devi effettuare l'accesso per continuare.",
  );
  assert.equal(
    getLocalizedMessage('AUTH_REQUIRED', 'es', 'Debes iniciar sesión para continuar.'),
    'Debes iniciar sesión para continuar.',
  );

  // Código inexistente cae al fallback
  assert.equal(
    getLocalizedMessage('NON_EXISTENT_CODE', 'en', 'Mensaje por defecto'),
    'Mensaje por defecto',
  );
});

test('serverI18n: sendApiError emite respuesta JSON con error localizado y código', () => {
  let capturedStatus = 0;
  let capturedJson: any = null;

  const mockRes: any = {
    status(code: number) {
      capturedStatus = code;
      return this;
    },
    json(body: any) {
      capturedJson = body;
      return this;
    },
  };

  const mockReq: any = { query: { lang: 'en' } };

  sendApiError(mockRes, mockReq, 401, 'AUTH_REQUIRED', 'Debes iniciar sesión para continuar.');

  assert.equal(capturedStatus, 401);
  assert.deepEqual(capturedJson, {
    error: 'You must log in to continue.',
    code: 'AUTH_REQUIRED',
  });
});
