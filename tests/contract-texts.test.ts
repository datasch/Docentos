import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_CONTRACT_HASH,
  CANONICAL_CONTRACT_LANGUAGE,
  CONTRACT_LANGUAGES,
  CONTRACT_TEXTS,
  getContractTexts,
  resolveContractLanguage,
} from '../server/contractTexts.js';

// SHA-256 del texto original en español tal y como se firmó hasta ahora. Si este test falla,
// alguien cambió el texto original: las firmas ya registradas dejarían de coincidir con el
// documento vigente y habría que publicar una versión nueva del contrato.
const ORIGINAL_SPANISH_HASH = '1a42051cb6162b4e5fc37cd601cb6f9c9031e49dc11384f41bbe53c85a1156d7';

test('Contrato: el sello canónico es el del texto original en español, sin cambios', () => {
  assert.equal(CANONICAL_CONTRACT_LANGUAGE, 'es');
  assert.equal(CANONICAL_CONTRACT_HASH, ORIGINAL_SPANISH_HASH);
});

test('Contrato: hay texto y títulos en los cinco idiomas', () => {
  assert.deepEqual([...CONTRACT_LANGUAGES], ['es', 'en', 'pt', 'fr', 'it']);
  for (const language of CONTRACT_LANGUAGES) {
    const texts = CONTRACT_TEXTS[language];
    assert.ok(texts.publicTitle.length > 10, `${language}: título público`);
    assert.ok(texts.signTitle.length > 10, `${language}: título de firma`);
    assert.ok(texts.content.length > 600, `${language}: cuerpo del contrato`);
  }
});

test('Contrato: todas las traducciones tienen la misma estructura que el original', () => {
  const count = (text: string, pattern: RegExp) => (text.match(pattern) || []).length;
  const original = CONTRACT_TEXTS.es.content;
  for (const language of CONTRACT_LANGUAGES) {
    const content = CONTRACT_TEXTS[language].content;
    assert.equal(count(content, /^# /gm), count(original, /^# /gm), `${language}: título`);
    assert.equal(count(content, /^### \d+\. /gm), 4, `${language}: cuatro cláusulas numeradas`);
    assert.equal(count(content, /^- /gm), count(original, /^- /gm), `${language}: viñetas`);
    assert.equal(count(content, /\*\*[^*]+\*\*/g), count(original, /\*\*[^*]+\*\*/g), `${language}: negritas`);
    // Las cifras que comprometen a las partes no pueden cambiar al traducir.
    assert.match(content, /\b12\b/, `${language}: periodo de acceso de 12 meses`);
    assert.match(content, /\b24\b/, `${language}: retención de 24 meses`);
    assert.match(content, /DocentOS/, `${language}: nombre de la plataforma`);
    assert.match(content, /ARCO/, `${language}: derechos ARCO`);
  }
});

test('Contrato: el idioma solicitado se normaliza y, si no existe, se usa el original', () => {
  assert.equal(resolveContractLanguage('en'), 'en');
  assert.equal(resolveContractLanguage('EN'), 'en');
  assert.equal(resolveContractLanguage('pt-BR'), 'pt');
  assert.equal(resolveContractLanguage(['fr', 'it']), 'fr');
  assert.equal(resolveContractLanguage('de'), 'es');
  assert.equal(resolveContractLanguage(''), 'es');
  assert.equal(resolveContractLanguage(undefined), 'es');
  assert.equal(resolveContractLanguage(42), 'es');
  assert.equal(getContractTexts('it').signTitle, CONTRACT_TEXTS.it.signTitle);
});
