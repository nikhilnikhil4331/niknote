/* NikNote — Sunset Plum theme bootstrap.
   Runs before the app bundle so the first paint already uses the correct
   palette (no flash of the wrong theme). External file so the strict CSP
   (`script-src 'self'`) keeps working without inline scripts. */
(function () {
  try {
    var stored = null;
    try { stored = localStorage.getItem('theme'); } catch (e) {}
    var dark = stored !== 'light';
    var root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    root.dataset.nkTheme = dark ? 'night' : 'daylight';
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#121020' : '#FBF6F4');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
