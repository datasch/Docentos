import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContract } from '../src/lib/contractMarkdown.js';
import { CONTRACT_LANGUAGES, CONTRACT_TEXTS } from '../server/contractTexts.js';

test('Contrato: el lector separa título, subtítulo y las cuatro cláusulas del original', () => {
  const doc = parseContract(CONTRACT_TEXTS.es.content);
  assert.equal(doc.title, 'Contrato de Servicios Educativos y Tratamiento de Datos');
  assert.equal(doc.subtitle, 'Plataforma DocentOS');
  assert.deepEqual(doc.clauses.map((c) => c.number), ['1', '2', '3', '4']);
  assert.equal(doc.clauses[0].title, 'Objeto y Acceso a la Plataforma');
  assert.deepEqual(doc.intro, []);
});

test('Contrato: las viñetas «Etiqueta: texto» se leen como términos y el resto como párrafos', () => {
  const [objeto, vigencia, datos, propiedad] = parseContract(CONTRACT_TEXTS.es.content).clauses;
  assert.deepEqual(objeto.items.map((i) => i.kind), ['paragraph']);
  assert.deepEqual(vigencia.items.map((i) => [i.kind, i.label]), [['term', 'Fecha de Inicio'], ['term', 'Fecha de Fin de Vigencia']]);
  assert.equal(datos.items.length, 2);
  assert.equal(datos.items[1].label, 'Derechos ARCO');
  assert.match(datos.items[0].text, /24 meses/);
  assert.deepEqual(propiedad.items.map((i) => i.kind), ['paragraph']);
});

test('Contrato: las cinco traducciones se leen con la misma estructura', () => {
  const original = parseContract(CONTRACT_TEXTS.es.content);
  for (const language of CONTRACT_LANGUAGES) {
    const doc = parseContract(CONTRACT_TEXTS[language].content);
    assert.equal(doc.clauses.length, original.clauses.length, `${language}: cláusulas`);
    assert.ok(doc.title.length > 5 && doc.subtitle.includes('DocentOS'), `${language}: título y subtítulo`);
    doc.clauses.forEach((clause, i) => {
      assert.equal(clause.number, original.clauses[i].number, `${language}: número de la cláusula ${i + 1}`);
      assert.deepEqual(
        clause.items.map((item) => item.kind),
        original.clauses[i].items.map((item) => item.kind),
        `${language}: forma de la cláusula ${i + 1}`,
      );
      clause.items.filter((item) => item.kind === 'term').forEach((item) => assert.ok(item.label && item.label.length > 2, `${language}: etiqueta`));
    });
  }
});

test('Contrato: el francés separa la etiqueta aunque lleve espacio antes de los dos puntos', () => {
  const doc = parseContract(CONTRACT_TEXTS.fr.content);
  assert.equal(doc.clauses[1].items[0].label, 'Date de début');
  assert.match(doc.clauses[1].items[0].text, /^À compter/);
});

test('Contrato: una frase con dos puntos en medio no se parte por error', () => {
  const doc = parseContract('### 1. Prueba\n- El plazo se cuenta así: desde la firma, y no antes de ella.');
  assert.equal(doc.clauses[0].items[0].kind, 'term');
  const largo = parseContract('### 1. Prueba\n- Esta es una frase muy larga sin etiqueta corta que termina diciendo algo importante: y sigue más allá.');
  assert.equal(largo.clauses[0].items[0].kind, 'paragraph');
});

test('Contrato: un texto vacío o sin cláusulas no rompe el lector', () => {
  assert.deepEqual(parseContract(''), { title: '', subtitle: '', intro: [], clauses: [] });
  const solo = parseContract('Un párrafo suelto.\n\nOtro más.');
  assert.deepEqual(solo.intro, ['Un párrafo suelto.', 'Otro más.']);
});
