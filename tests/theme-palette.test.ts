import test from 'node:test';
import assert from 'node:assert/strict';
import { getThemePalette, THEME_PALETTES, type ColorTheme } from '../src/lib/themeApplicator.js';

function luminance(hex: string) {
  const linear = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Tema claro: los acentos de todas las paletas mantienen contraste de texto normal', () => {
  for (const theme of Object.keys(THEME_PALETTES) as ColorTheme[]) {
    const palette = getThemePalette(theme, 'light');
    for (const color of [palette.brandCyan, palette.brandBlue, palette.brandPurple]) {
      assert.ok(contrast(color, '#ffffff') >= 4.5, `${theme}: ${color} sobre blanco`);
      assert.ok(contrast(color, '#f1f5f9') >= 4.5, `${theme}: ${color} sobre superficie elevada`);
      assert.ok(contrast('#ffffff', color) >= 4.5, `${theme}: texto blanco sobre relleno`);
    }
    assert.match(palette.gradient, new RegExp(palette.brandCyan));
    assert.deepEqual(getThemePalette(theme, 'dark'), THEME_PALETTES[theme]);
  }
});
