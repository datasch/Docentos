import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { lockBodyScroll, unlockBodyScroll, _resetScrollLockForTesting } from '../src/lib/useBodyScrollLock';

describe('Gestor de Bloqueo de Scroll (Body Scroll Lock)', () => {
  let mockBody: any;
  let mockDocElem: any;

  beforeEach(() => {
    _resetScrollLockForTesting();
    mockBody = {
      style: {
        overflow: '',
        paddingRight: '',
        overscrollBehavior: '',
      },
    };
    mockDocElem = {
      clientWidth: 1000,
      style: {
        overflow: '',
        overscrollBehavior: '',
      },
    };

    // Configurar objetos globales simulados para el entorno de test
    (global as any).document = {
      body: mockBody,
      documentElement: mockDocElem,
    };
    (global as any).window = {
      innerWidth: 1015, // Simula barra de 15px
    };
  });

  it('1. Bloquea el scroll y calcula la compensación de padding-right para evitar layout shift', () => {
    mockBody.style.overflow = 'auto';
    mockBody.style.paddingRight = '0px';

    lockBodyScroll();

    assert.equal(mockBody.style.overflow, 'hidden');
    assert.equal(mockDocElem.style.overflow, 'hidden');
    assert.equal(mockBody.style.paddingRight, '15px'); // 1015 - 1000 = 15px
  });

  it('2. Soporta múltiples modales anidados con conteo de referencia sin desbloqueo prematuro', () => {
    mockBody.style.overflow = 'visible';

    // Se abre Modal 1
    lockBodyScroll();
    assert.equal(mockBody.style.overflow, 'hidden');

    // Se abre Modal 2 encima
    lockBodyScroll();
    assert.equal(mockBody.style.overflow, 'hidden');

    // Se cierra Modal 2: el scroll debe PERMANECER bloqueado porque Modal 1 sigue abierto
    unlockBodyScroll();
    assert.equal(mockBody.style.overflow, 'hidden');

    // Se cierra Modal 1: ahora sí se restablece el estilo original
    unlockBodyScroll();
    assert.equal(mockBody.style.overflow, 'visible');
    assert.equal(mockDocElem.style.overflow, '');
  });

  it('3. Restablece correctamente el paddingRight original al cerrar el último diálogo', () => {
    mockBody.style.overflow = 'scroll';
    mockBody.style.paddingRight = '8px';

    lockBodyScroll();
    assert.equal(mockBody.style.paddingRight, '15px');

    unlockBodyScroll();
    assert.equal(mockBody.style.overflow, 'scroll');
    assert.equal(mockBody.style.paddingRight, '8px');
  });
});
