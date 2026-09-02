async function bootstrap() {
  try {
    const response = await fetch('/api/runtime-config', { cache: 'no-store' });
    if (response.ok) window.__DOCENTOS_CONFIG__ = Object.freeze(await response.json());
  } catch {
    // La aplicacion conserva valores comunitarios seguros si la API aun no esta disponible.
  }

  await import('./main.tsx');
}

void bootstrap();
