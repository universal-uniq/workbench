/* Тема и акцент применяются до первой отрисовки, чтобы не было вспышки. */
(() => {
  const root = document.documentElement;

  try {
    root.dataset.theme = localStorage.getItem('polka-theme') === 'light' ? 'light' : 'dark';
  } catch (_) {
    root.dataset.theme = 'dark';
  }

  try {
    const accent = localStorage.getItem('polka-accent');
    if (/^#[0-9a-f]{6}$/i.test(accent || '')) {
      root.style.setProperty('--accent', accent);
    }
  } catch (_) { /* localStorage может быть недоступен */ }
})();
