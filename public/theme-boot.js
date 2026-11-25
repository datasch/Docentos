/*
 * Aplica el modo claro antes del primer pintado.
 *
 * index.html arranca en oscuro (class="dark") y el modo guardado solo se
 * aplicaba cuando el bundle ya se había ejecutado: quien usa modo claro veía
 * primero un fogonazo negro y luego el salto a claro en cada carga.
 *
 * Solo actúa si el modo guardado es claro; el oscuro es el estado por defecto
 * de la página y no necesita cambios. Debe ir como primer hijo de <body> y sin
 * defer, para correr antes de que se pinte #root. Lo sirve el propio servidor,
 * así que entra en script-src 'self'.
 */
(function () {
  try {
    if (localStorage.getItem('docentos_color_mode') !== 'light') return;
    var saved = localStorage.getItem('docentos_color_theme');
    // Igual que themeApplicator: el cian guardado se migra al ámbar.
    var theme = saved === 'violet' || saved === 'emerald' || saved === 'amber' ? saved : 'amber';
    [document.documentElement, document.body].forEach(function (el) {
      el.setAttribute('data-color-mode', 'light');
      el.classList.remove('dark', 'mode-dark', 'theme-cyan', 'theme-violet', 'theme-emerald', 'theme-amber');
      el.classList.add('mode-light', 'theme-' + theme);
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#e4edf3');
  } catch (e) {
    /* Sin almacenamiento local se queda en el modo por defecto. */
  }
})();
