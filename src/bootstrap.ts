import { applyRuntimeConfig } from './config/theme';
import { BRAND_CHANGE_EVENT, LOGO_CHANGE_EVENT } from './lib/logoConfig';
import './main.tsx';

function activateAsyncGoogleFonts() {
  if (typeof document === 'undefined') return;
  const fontLink = document.getElementById('google-fonts-css') as HTMLLinkElement | null;
  if (!fontLink) return;
  if (fontLink.sheet) {
    fontLink.media = 'all';
  } else {
    fontLink.addEventListener('load', () => {
      fontLink.media = 'all';
    }, { once: true });
    // Fallback por si el evento load ya ocurrió antes de registrar el listener
    requestAnimationFrame(() => {
      fontLink.media = 'all';
    });
  }
}

async function syncRuntimeConfig() {
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      window.__DOCENTOS_CONFIG__ = Object.freeze(data);
      applyRuntimeConfig(data);
      if (data.appName) {
        window.dispatchEvent(new CustomEvent(BRAND_CHANGE_EVENT, { detail: { brandName: data.appName } }));
      }
      if (data.logoUrl) {
        window.dispatchEvent(new CustomEvent(LOGO_CHANGE_EVENT, { detail: { logoUrl: data.logoUrl } }));
      }
    }
  } catch {
    // La aplicacion conserva valores comunitarios seguros si la API aun no esta disponible.
  }
}

activateAsyncGoogleFonts();
void syncRuntimeConfig();
