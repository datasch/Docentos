// ESLint solo se usa para una cosa: avisar en el editor cuando aparece texto escrito
// a mano en la interfaz (sin pasar por t()). El control de CI es `npm run i18n:lint`.
import tsParser from '@typescript-eslint/parser';
import i18next from 'eslint-plugin-i18next';

export default [
  { ignores: ['dist/**', 'generated/**', 'node_modules/**', 'tests/**', '**/*.d.ts', 'src/i18n/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['warn', { mode: 'jsx-text-only' }],
    },
  },
];
