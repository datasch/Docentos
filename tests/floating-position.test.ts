import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListeningFloatingButton } from '../src/components/ListeningFloatingButton.js';
import { clampFloatingPoint, floatingAnchor, pointFromAnchor, parseFloatingAnchor } from '../src/lib/floatingPosition.js';

test('Buzón: los movimientos quedan dentro del área visible y sus márgenes', () => {
  const phone = { width: 390, height: 844, buttonWidth: 52, buttonHeight: 52 };
  assert.deepEqual(clampFloatingPoint({ x: -100, y: -100 }, phone), { x: 12, y: 12 });
  assert.deepEqual(clampFloatingPoint({ x: 2000, y: 2000 }, phone), { x: 326, y: 780 });
  const keyboard = { ...phone, height: 300, top: 40, insets: { top: 44, right: 20, bottom: 20, left: 12 } };
  assert.deepEqual(clampFloatingPoint({ x: 2000, y: 0 }, keyboard), { x: 318, y: 84 });
  assert.deepEqual(clampFloatingPoint({ x: NaN, y: Infinity }, phone), { x: 12, y: 12 });
});

test('Buzón: la posición guardada se adapta al móvil y a la rotación', () => {
  const desktop = { width: 1440, height: 900, buttonWidth: 220, buttonHeight: 48 };
  const bottomRight = floatingAnchor({ x: 1208, y: 840 }, desktop);
  assert.deepEqual(bottomRight, { x: 1, y: 1 });
  const phone = { width: 360, height: 640, buttonWidth: 52, buttonHeight: 52 };
  assert.deepEqual(pointFromAnchor(bottomRight, phone), { x: 296, y: 576 });
  assert.deepEqual(pointFromAnchor(bottomRight, { ...phone, width: 640, height: 360 }), { x: 576, y: 296 });
  assert.deepEqual(pointFromAnchor(bottomRight, { width: 24, height: 24, buttonWidth: 52, buttonHeight: 52 }), { x: 12, y: 12 });
});

test('Buzón: el almacenamiento inválido vuelve a la posición predeterminada', () => {
  for (const value of [null, '', '{}', '{', '{"version":2,"x":0.5,"y":0.5}', '{"version":1,"x":-1,"y":0}', '{"version":1,"x":"0.5","y":0}', '{"version":1,"x":1.1,"y":0}']) assert.equal(parseFloatingAnchor(value), null);
  assert.deepEqual(parseFloatingAnchor('{"version":1,"x":0.5,"y":1}'), { x: 0.5, y: 1 });
});

test('Buzón: conserva nombre accesible, aviso de respuestas e instrucciones de teclado', () => {
  const html = renderToStaticMarkup(React.createElement(ListeningFloatingButton, { unreadCount: 3, onClick() {} }));
  assert.match(html, /aria-label="Abrir Buzón de escucha, tienes 3 respuestas pendientes"/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /flechas del teclado/);
  assert.match(html, /tecla Inicio/);
  assert.doesNotMatch(html, /aria-hidden="true"[^>]*>Buzón de escucha/);
});
