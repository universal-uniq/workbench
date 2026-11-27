/* ============================================================
   Верстак — каталог полезных программ
   Читает source.txt и строит каталог на странице.
   ============================================================ */

(() => {
  'use strict';

  const PLATFORM_LABELS = {
    win: 'Windows', mac: 'macOS', linux: 'Linux', web: 'Web',
    android: 'Android', ios: 'iOS', server: 'Сервер', any: 'Любая'
  };

  const LICENSE_LABELS = {
    open: 'Открытый код',
    free: 'Бесплатно',
    freemium: 'Freemium',
    paid: 'Платно',
    guide: 'Гайд'
  };

  const state = {
    items: [],
    categories: [],
    activeCat: 'Все',
    query: '',
    ossOnly: false,
    view: 'programs',
    liquid: false,
    accent: '#a8441f',
    pItems: [],
    pCats: [],
    pCat: 'Все'
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  /* ---------- Утилиты ---------- */

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const HEX = /^#[0-9a-f]{6}$/i;

  // Ссылки и картинки принимаем только с http(s). Иначе javascript: или data:
  // из source.txt попали бы в href/src.
  function httpUrl(value) {
    try {
      const u = new URL(String(value).trim(), location.href);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
    } catch (_) {
      return '';
    }
  }

  function imageUrl(value) {
    try {
      const u = new URL(String(value).trim(), location.href);
      if (u.protocol === 'https:') return u.href;
      if (u.protocol === 'http:' && u.origin === location.origin) return u.href;
    } catch (_) { /* ignore */ }
    return '';
  }

  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function initials(name) {
    const cleaned = String(name)
      .replace(/\(.*?\)/g, ' ')
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function hueOf(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return h;
  }

  /* ---------- Разбор source.txt ---------- */

  function parseSource(text) {
    const items = [];
    const categories = [];
    let cat = 'Разное';

    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const head = line.match(/^\[(.+)\]$/);
      if (head) {
        cat = head[1].trim();
        if (!categories.includes(cat)) categories.push(cat);
        continue;
      }

      const parts = line.split('|').map((s) => s.trim());
      if (parts.length < 5) continue;

      const [name, rawUrl, logo, platforms, license] = parts;
      const desc = parts.slice(5).join(' | ').trim();
      const url = httpUrl(rawUrl);
      if (!name || !url) continue;

      items.push({
        name,
        url,
        logo: logo === '-' ? '-' : imageUrl(logo),
        platforms: platforms.split(',').map((s) => s.trim()).filter(Boolean),
        license: (license || 'free').toLowerCase(),
        desc,
        cat
      });

      if (!categories.includes(cat)) categories.push(cat);
    }

    return { items, categories };
  }

  /* ---------- Логотипы ---------- */

  function logoSrc(item) {
    if (item.logo === '-') return '';
    if (item.logo) return item.logo;

    const gh = item.url.match(/^https?:\/\/github\.com\/([^/?#]+)/i);
    if (gh && !['features', 'sponsors', 'about', 'marketplace'].includes(gh[1].toLowerCase())) {
      return 'https://github.com/' + gh[1] + '.png?size=160';
    }

    try {
      const host = new URL(item.url).hostname.replace(/^www\./, '');
      if (host) return 'https://icons.duckduckgo.com/ip3/' + host + '.ico';
    } catch (_) { /* ignore */ }

    return '';
  }

  function monogramHtml(name) {
    return '<div class="logo mono" style="--h:' + hueOf(name) + '">' + esc(initials(name)) + '</div>';
  }

  function logoHtml(item) {
    const src = logoSrc(item);
    if (!src) return monogramHtml(item.name);
    return '<div class="logo"><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" ' +
      'referrerpolicy="no-referrer" data-name="' + esc(item.name) + '"></div>';
  }

  function logoFail(img) {
    const box = img.closest('.logo');
    if (!box) return;
    const name = img.dataset.name || '?';
    box.classList.add('mono');
    box.style.setProperty('--h', hueOf(name));
    box.textContent = initials(name);
  }

  function promptCardHtml(p) {
    const tags = (p.tags || []).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');

    return '<article class="card p-card" data-prompt="' + esc(p.prompt) + '">' +
      '<div class="card-top">' +
        monogramHtml(p.name) +
        '<div class="card-title">' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<span class="license free">Промпт</span>' +
        '</div>' +
      '</div>' +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '<pre class="prompt-text">' + esc(p.prompt) + '</pre>' +
      '<div class="card-foot">' +
        '<span class="go" aria-hidden="true">⎘</span>' +
        '<button class="copy-btn" type="button">Копировать</button>' +
      '</div>' +
    '</article>';
  }

  /* ---------- Карточка ---------- */

  function cardHtml(item) {
    const lic = LICENSE_LABELS[item.license] ? item.license : 'free';
    const licLabel = LICENSE_LABELS[item.license] || esc(item.license);

    const plats = item.platforms
      .map((p) => '<li>' + esc(PLATFORM_LABELS[p] || p) + '</li>')
      .join('');

    return '<article class="card">' +
      '<a class="card-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer" ' +
        'aria-label="' + esc(item.name) + ' — открыть официальный сайт"></a>' +
      '<div class="card-top">' +
        logoHtml(item) +
        '<div class="card-title">' +
          '<h3>' + esc(item.name) + '</h3>' +
          '<span class="license ' + lic + '">' + licLabel + '</span>' +
        '</div>' +
      '</div>' +
      (item.desc ? '<p class="desc">' + esc(item.desc) + '</p>' : '') +
      '<div class="card-foot">' +
        '<ul class="plats">' + plats + '</ul>' +
        '<span class="go" aria-hidden="true">↗</span>' +
      '</div>' +
    '</article>';
  }

  /* ---------- Фильтр ---------- */

  function matches(item, q, ossOnly) {
    if (ossOnly && item.license !== 'open') return false;
    if (!q) return true;

    const hay = norm([
      item.name,
      item.desc,
      item.cat,
      item.platforms.join(' '),
      item.platforms.map((p) => PLATFORM_LABELS[p] || p).join(' '),
      LICENSE_LABELS[item.license] || ''
    ].join(' '));

    return q.split(/\s+/).every((word) => hay.includes(word));
  }

  function matchesPrompt(item, q) {
    if (!q) return true;
    const hay = norm([
      item.name,
      item.desc,
      item.cat,
      item.tags.join(' ')
    ].join(' '));
    return q.split(/\s+/).every((word) => hay.includes(word));
  }

  /* ---------- Отрисовка ---------- */

  const listEl = $('#list');
  const emptyEl = $('#empty');
  const totalEl = $('#total');
  const catsEl = $('#cats');
  const catsRow = $('#cats-row');
  const toolbarEl = $('#toolbar');
  const mainEl = $('#main');

  // Ошибки загрузки картинок ловим в capture-фазе: событие error не всплывает.
  listEl.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement) logoFail(e.target);
  }, true);

  function groupHtml(cat, items, kind) {
    const body = items.map((i) => (kind === 'program' ? cardHtml(i) : promptCardHtml(i))).join('');
    return '<section class="group">' +
      '<div class="group-head">' +
        '<h2>' + esc(cat) + '</h2>' +
        '<span class="group-count">' + items.length + '</span>' +
        '<span class="group-rule" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="grid">' + body + '</div>' +
    '</section>';
  }

  function aiCatalog() {
    const ps = state.pItems;
    const cats = [];
    for (const i of ps) { if (!cats.includes(i.cat)) cats.push(i.cat); }
    return { items: ps, cats };
  }

  function renderPrograms() {
    const q = norm(state.query.trim());
    const visible = state.items.filter((i) =>
      matches(i, q, state.ossOnly) &&
      (state.activeCat === 'Все' || i.cat === state.activeCat)
    );

    const groups = [];
    const cats = state.activeCat === 'Все'
      ? state.categories
      : [state.activeCat];

    for (const cat of cats) {
      const inCat = visible.filter((i) => i.cat === cat);
      if (inCat.length) groups.push(groupHtml(cat, inCat, 'program'));
    }

    listEl.innerHTML = groups.join('');
    emptyEl.hidden = groups.length > 0;
    listEl.hidden = groups.length === 0;

    const n = visible.length;
    totalEl.textContent = n + ' ' + plural(n, 'программа', 'программы', 'программ');

    updateChipCounts();
  }

  function updateChipCounts() {
    const q = norm(state.query.trim());
    const items = state.view === 'prompts' ? aiCatalog().items : state.items;
    const base = items.filter((i) =>
      state.view === 'prompts' ? matchesPrompt(i, q) : matches(i, q, state.ossOnly)
    );

    for (const chip of catsEl.querySelectorAll('.chip')) {
      const cat = chip.dataset.cat;
      const n = cat === 'Все'
        ? base.length
        : base.filter((i) => i.cat === cat).length;
      const count = chip.querySelector('.chip-count');
      if (count) count.textContent = n;
      const active = state.view === 'prompts' ? state.pCat : state.activeCat;
      chip.setAttribute('aria-pressed', String(cat === active));
    }
  }

  function render() {
    if (state.view === 'prompts') return renderPrompts();
    return renderPrograms();
  }

  function renderPrompts() {
    const { items: ai, cats } = aiCatalog();
    const q = norm(state.query.trim());
    const visible = ai.filter((i) =>
      matchesPrompt(i, q) && (state.pCat === 'Все' || i.cat === state.pCat)
    );

    const groups = [];
    const groupCats = state.pCat === 'Все' ? cats : [state.pCat];

    for (const cat of groupCats) {
      const inCat = visible.filter((i) => i.cat === cat);
      if (inCat.length) groups.push(groupHtml(cat, inCat, 'prompt'));
    }

    listEl.innerHTML = groups.join('');
    emptyEl.hidden = groups.length > 0;
    listEl.hidden = groups.length === 0;

    const n = visible.length;
    totalEl.textContent = n + ' ' + plural(n, 'промпт', 'промпта', 'промптов');
  }

  function makeChip(cat, count) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.cat = cat;
    btn.setAttribute('aria-pressed', String((state.view === 'prompts' ? state.pCat : state.activeCat) === cat));
    btn.innerHTML = '<span class="chip-label">' + esc(cat) + '</span>' +
      '<span class="chip-count">' + count + '</span>';
    return btn;
  }

  function buildChips() {
    catsEl.textContent = '';
    catsEl.append(makeChip('Все', state.items.length));
    for (const cat of state.categories) {
      catsEl.append(makeChip(cat, state.items.filter((i) => i.cat === cat).length));
    }
    requestAnimationFrame(updateChipFades);
  }

  function buildPromptChips() {
    const cat = aiCatalog();
    catsEl.textContent = '';
    catsEl.append(makeChip('Все', cat.items.length));
    for (const c of cat.cats) {
      catsEl.append(makeChip(c, cat.items.filter((i) => i.cat === c).length));
    }
    requestAnimationFrame(updateChipFades);
  }

  function updateChipFades() {
    const max = catsEl.scrollWidth - catsEl.clientWidth;
    const canPrev = catsEl.scrollLeft > 4;
    const canNext = catsEl.scrollLeft < max - 4;
    catsEl.classList.toggle('fade-l', canPrev);
    catsEl.classList.toggle('fade-r', canNext);
    catsRow.classList.toggle('can-prev', canPrev);
    catsRow.classList.toggle('can-next', canNext);
  }

  function revealChip(chip) {
    if (!chip || catsEl.scrollWidth <= catsEl.clientWidth) return;
    const padLeft = 12;
    const padRight = 60;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left - padLeft < catsEl.scrollLeft) {
      catsEl.scrollTo({ left: Math.max(0, left - padLeft), behavior: 'smooth' });
    } else if (right + padRight > catsEl.scrollLeft + catsEl.clientWidth) {
      catsEl.scrollTo({ left: right + padRight - catsEl.clientWidth, behavior: 'smooth' });
    }
  }

  function syncToolbarOffset() {
    if (!toolbarEl || !mainEl) return;
    mainEl.style.scrollMarginTop = (toolbarEl.offsetHeight + 16) + 'px';
  }

  catsEl.addEventListener('scroll', updateChipFades, { passive: true });
  window.addEventListener('resize', () => { updateChipFades(); syncToolbarOffset(); });

  $('#cats-prev').addEventListener('click', () => {
    catsEl.scrollBy({ left: -Math.max(200, catsEl.clientWidth * 0.7), behavior: 'smooth' });
  });
  $('#cats-next').addEventListener('click', () => {
    catsEl.scrollBy({ left: Math.max(200, catsEl.clientWidth * 0.7), behavior: 'smooth' });
  });

  catsEl.addEventListener('wheel', (e) => {
    if (catsEl.scrollWidth <= catsEl.clientWidth) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    catsEl.scrollLeft += e.deltaY;
  }, { passive: false });

  /* ---------- События ---------- */

  catsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (state.view === 'prompts') state.pCat = chip.dataset.cat;
    else state.activeCat = chip.dataset.cat;
    render();
    revealChip(chip);
    if (window.scrollY > 240) {
      $('#main').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  const qInput = $('#q');
  qInput.addEventListener('input', () => {
    state.query = qInput.value;
    render();
  });

  const ossBtn = $('#oss');
  ossBtn.addEventListener('click', () => {
    state.ossOnly = !state.ossOnly;
    ossBtn.setAttribute('aria-pressed', String(state.ossOnly));
    render();
  });

  $('#reset').addEventListener('click', () => {
    state.query = '';
    state.activeCat = 'Все';
    state.pCat = 'Все';
    state.ossOnly = false;
    qInput.value = '';
    ossBtn.setAttribute('aria-pressed', 'false');
    if (ossWrap) ossWrap.hidden = false;
    render();
    qInput.focus();
  });

  const viewTabs = document.querySelectorAll('#view-tabs .view-tab');
  const ossWrap = document.getElementById('oss-wrap');

  function setView(view) {
    state.view = view;
    for (const btn of viewTabs) {
      btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
    }
    if (state.view === 'prompts') {
      buildPromptChips();
      if (ossWrap) ossWrap.hidden = true;
    } else {
      buildChips();
      if (ossWrap) ossWrap.hidden = false;
    }
    render();
    setQueryPlaceholder();
    if (window.scrollY > 200) {
      $('#main').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  for (const btn of viewTabs) {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    const card = btn.closest('.p-card');
    const text = card ? (card.getAttribute('data-prompt') || '') : '';
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (_) { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) { ok = false; }
    }
    if (ok) {
      btn.textContent = 'Скопировано';
      setTimeout(() => { btn.textContent = 'Копировать'; }, 1600);
    }
  });

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      qInput.focus();
      qInput.select();
    }

    if (e.key === 'Escape' && document.activeElement === qInput) {
      qInput.value = '';
      state.query = '';
      render();
      qInput.blur();
    }
  });

  /* ---------- Тема ---------- */

  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  function storedTheme() {
    try {
      const theme = localStorage.getItem('polka-theme');
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch (_) { return null; }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }

  function applyLiquid(liquid) {
    document.body.classList.toggle('glass', liquid);
    const btn = document.getElementById('glass');
    if (btn) btn.setAttribute('aria-pressed', String(liquid));
  }

  function applyAccent(hex) {
    if (!HEX.test(String(hex))) return;
    root.style.setProperty('--accent', hex);
  }

  applyTheme(storedTheme() || 'dark');

  const storedLiquid = (function () { try { return localStorage.getItem('polka-liquid'); } catch (_) { return null; } })();
  state.liquid = storedLiquid === '1';
  applyLiquid(state.liquid);

  const storedAccent = (function () { try { return localStorage.getItem('polka-accent'); } catch (_) { return null; } })();
  if (HEX.test(storedAccent || '')) state.accent = storedAccent;
  applyAccent(state.accent);

  mq.addEventListener('change', (e) => {
    if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });

  $('#theme').addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('polka-theme', next); } catch (_) { /* ignore */ }
  });

  $('#glass').addEventListener('click', () => {
    state.liquid = !state.liquid;
    applyLiquid(state.liquid);
    try { localStorage.setItem('polka-liquid', state.liquid ? '1' : '0'); } catch (_) { /* ignore */ }
  });

  function syncAccents() {
    for (const btn of document.querySelectorAll('#accents .swatch')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.accent === state.accent));
    }
  }

  function setAccent(hex) {
    if (!HEX.test(String(hex))) return;
    state.accent = hex;
    applyAccent(hex);
    try { localStorage.setItem('polka-accent', hex); } catch (_) { /* ignore */ }
    syncAccents();
  }

  document.querySelectorAll('#accents .swatch').forEach((btn) => {
    btn.addEventListener('click', () => setAccent(btn.dataset.accent));
  });

  const accentCustom = document.getElementById('accent-custom');
  if (accentCustom) accentCustom.addEventListener('input', () => setAccent(accentCustom.value));
  syncAccents();

  /* ---------- Загрузка ---------- */

  function showLoadError() {
    listEl.innerHTML = '<div class="empty">' +
      '<p class="empty-title">Не удалось загрузить source.txt</p>' +
      '<p class="empty-text">Браузер не читает файл, если страница открыта напрямую через file://. ' +
        'Запустите локальный сервер в папке сайта:</p>' +
      '<code class="example">python -m http.server 8000</code>' +
      '<p class="empty-text">и откройте <b>http://localhost:8000</b></p>' +
    '</div>';
    totalEl.textContent = 'Нет данных';
  }

  function parsePrompts(text) {
    const items = [];
    const categories = [];
    let cat = 'Разное';

    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      const head = line.match(/^\[(.+)\]$/);
      if (head) {
        cat = head[1].trim();
        if (!categories.includes(cat)) categories.push(cat);
        continue;
      }

      const parts = line.split('|').map((s) => s.trim());
      if (parts.length < 4) continue;

      const [name, desc, tagsRaw, ...rest] = parts;
      const prompt = rest.join(' | ').trim();
      if (!name || !prompt) continue;

      const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      items.push({ name, desc, prompt, tags, cat });

      if (!categories.includes(cat)) categories.push(cat);
    }

    return { items, categories };
  }

  function setQueryPlaceholder() {
    const el = document.getElementById('q');
    if (!el) return;
    el.placeholder = state.view === 'prompts'
      ? 'Найти промпт, например «ревью кода» или «SEO»'
      : 'Найти программу, например «архиватор» или «VPN»';
  }

  async function boot() {
    let data;
    let pdata;
    try {
      const res = await fetch('source.txt', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = parseSource(await res.text());
    } catch (err) {
      showLoadError();
      return;
    }

    state.items = data.items;
    state.categories = data.categories.filter((cat) =>
      data.items.some((i) => i.cat === cat)
    );

    try {
      const pres = await fetch('source-prompts.txt', { cache: 'no-store' });
      pdata = pres.ok ? parsePrompts(await pres.text()) : { items: [], categories: [] };
    } catch (_) {
      pdata = { items: [], categories: [] };
    }

    state.pItems = pdata.items;
    state.pCats = pdata.categories.filter((cat) =>
      pdata.items.some((i) => i.cat === cat)
    );

    if (!state.items.length) {
      showLoadError();
      return;
    }

    buildChips();
    render();
    syncToolbarOffset();
    setQueryPlaceholder();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncToolbarOffset);
    }

    const n = state.items.length;
    totalEl.textContent = n + ' ' + plural(n, 'программа', 'программы', 'программ');

    const footN = $('#foot-count');
    const footC = $('#foot-cats');
    if (footN) footN.textContent = n;
    if (footC) footC.textContent = state.categories.length;
  }

  boot();
})();
