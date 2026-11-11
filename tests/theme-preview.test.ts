import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlatformTheme } from '../src/lib/themeApplicator.js';

class ClassList {
  private values = new Set<string>();

  add(...names: string[]) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names: string[]) {
    names.forEach((name) => this.values.delete(name));
  }
}

function installDom() {
  const storage = new Map<string, string>();
  const listeners: Event[] = [];
  const documentMock = {
    documentElement: {
      style: { setProperty() {} },
      classList: new ClassList(),
      setAttribute() {},
    },
    body: {
      classList: new ClassList(),
      setAttribute() {},
    },
  };
  const windowMock = {
    dispatchEvent(event: Event) {
      listeners.push(event);
    },
  };

  Object.assign(globalThis, {
    document: documentMock,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    window: windowMock,
    CustomEvent: class CustomEvent {
      constructor(public type: string, public init?: unknown) {}
    },
  });

  return { storage, listeners };
}

test('la previsualización de tema no persiste cambios antes de guardar', () => {
  const { storage } = installDom();
  storage.set('docentos_color_theme', 'cyan');
  storage.set('docentos_density', 'compact');
  storage.set('docentos_color_mode', 'dark');

  applyPlatformTheme('amber', 'comfortable', 'light', { persist: false });

  assert.equal(storage.get('docentos_color_theme'), 'cyan');
  assert.equal(storage.get('docentos_density'), 'compact');
  assert.equal(storage.get('docentos_color_mode'), 'dark');
});
