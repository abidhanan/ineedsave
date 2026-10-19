// Language support in the browser. The page arrives already translated (middleware.js picks the
// language, scripts/build.mjs renders one HTML file per language) with its strings embedded in
// window.I18N_BOOT, so nothing is fetched on load. This file only powers t() for app.js and the
// language picker, which switches the page in place and remembers the choice in a cookie.
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, flagSrc } from '/languages.js';

const COOKIE = 'ins-lang';
const boot = window.I18N_BOOT || { lang: 'en', strings: {} };
const cache = { [boot.lang]: Promise.resolve(boot.strings) };
let current = boot.lang;
let strings = boot.strings;

function t(key, vars) {
  let s = strings[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

function remember(code) {
  document.cookie = `${COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function fetchStrings(code) {
  cache[code] ||= fetch(`/i18n/${code}.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  return cache[code];
}

function fontLink(id, family, text) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`
    + (text ? `&text=${encodeURIComponent(text)}` : '');
  document.head.append(link);
}

function translateDom() {
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  // Only first-party strings with <strong> markup go through innerHTML.
  for (const node of document.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(node.dataset.i18nHtml);
  for (const node of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      node.setAttribute(attr.trim(), t(key.trim()));
    }
  }
  document.title = t('meta.title');
  const meta = {
    'meta[name="description"]': t('meta.description'),
    'meta[property="og:title"]': t('meta.title'),
    'meta[property="og:description"]': t('meta.description'),
    'meta[name="twitter:title"]': t('meta.title'),
    'meta[name="twitter:description"]': t('meta.description'),
  };
  for (const [selector, content] of Object.entries(meta)) document.querySelector(selector)?.setAttribute('content', content);
}

function updateButton() {
  const lang = BY_CODE[current.toLowerCase()];
  const button = document.getElementById('lang-button');
  document.getElementById('lang-flag').src = flagSrc(lang.flag);
  document.getElementById('lang-name').textContent = lang.native;
  button.setAttribute('aria-label', `${t('lang.button')}: ${lang.native}`);
}

async function switchTo(code) {
  const lang = BY_CODE[code.toLowerCase()];
  if (!lang) return;
  strings = await fetchStrings(lang.code);
  current = lang.code;
  const root = document.documentElement;
  root.lang = current;
  root.dir = RTL.has(current) ? 'rtl' : 'ltr';
  const family = SCRIPT_FONT[lang.script];
  if (family) fontLink(`font-${lang.script}`, family);
  root.style.setProperty('--font-script', family ? `"${family}"` : '"Noto Sans"');
  translateDom();
  updateButton();
  document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: current } }));
}

// ---------- picker (dropdown under the navbar button) ----------
let menuFontsLoaded = false;
function loadMenuFonts() {
  // Each language's own name needs its script; fetch just those few glyphs per script.
  if (menuFontsLoaded) return;
  menuFontsLoaded = true;
  const byScript = {};
  for (const l of LANGS) if (SCRIPT_FONT[l.script]) byScript[l.script] = (byScript[l.script] || '') + l.native;
  for (const [script, text] of Object.entries(byScript)) {
    fontLink(`font-menu-${script}`, SCRIPT_FONT[script], [...new Set(text)].join(''));
  }
}

function setupPicker() {
  const picker = document.getElementById('lang-picker');
  const button = document.getElementById('lang-button');
  const panel = document.getElementById('lang-panel');
  const search = document.getElementById('lang-search');
  const list = document.getElementById('lang-list');
  const empty = document.getElementById('lang-empty');
  let options = [];
  let active = -1;

  function setActive(index, scroll = true) {
    options[active]?.classList.remove('active');
    active = index;
    const option = options[active];
    if (!option) return;
    option.classList.add('active');
    search.setAttribute('aria-activedescendant', option.id);
    // Scroll only the list: scrollIntoView() would also move the page under the sticky header.
    if (scroll) {
      const box = list.getBoundingClientRect();
      const item = option.getBoundingClientRect();
      if (item.top < box.top) list.scrollTop -= box.top - item.top;
      else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom;
    }
  }

  // Language names in the page's current language too, so "Jepang" finds 日本語 on the Indonesian page.
  function localName(code) {
    try { return new Intl.DisplayNames([current], { type: 'language' }).of(code) || ''; } catch { return ''; }
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const items = LANGS.filter((l) => !q || l.native.toLowerCase().includes(q)
      || l.english.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q)
      || localName(l.code).toLowerCase().includes(q));
    options = items.map((l) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'lang-option';
      option.id = `lang-opt-${l.code}`;
      option.setAttribute('role', 'option');
      option.tabIndex = -1;
      option.dataset.code = l.code;
      option.setAttribute('aria-selected', String(l.code === current));
      const flag = document.createElement('img');
      flag.className = 'flag';
      flag.alt = '';
      flag.width = 20;
      flag.height = 15;
      flag.loading = 'lazy';
      flag.src = flagSrc(l.flag);
      const label = document.createElement('span');
      label.className = 'lang-option-label';
      label.lang = l.code;
      label.textContent = l.native;
      if (SCRIPT_FONT[l.script]) label.style.fontFamily = `"Noto Sans", "${SCRIPT_FONT[l.script]}", sans-serif`;
      option.append(flag, label);
      return option;
    });
    list.replaceChildren(...options);
    empty.hidden = options.length > 0;
    active = -1;
    setActive(q ? 0 : options.findIndex((o) => o.dataset.code === current), false);
  }

  function open() {
    loadMenuFonts();
    search.value = '';
    render();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const selected = options[active];
    if (selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
    if (matchMedia('(hover: hover)').matches) search.focus({ preventScroll: true });
  }

  function close(focusButton = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    // preventScroll: the button sits in the sticky header, so the page must stay where the visitor is.
    if (focusButton) button.focus({ preventScroll: true });
  }

  function choose(code) {
    close(true);
    if (code === current) return;
    remember(code);
    switchTo(code);
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  search.addEventListener('input', render);
  list.addEventListener('click', (event) => {
    const option = event.target.closest('.lang-option');
    if (option) choose(option.dataset.code);
  });
  list.addEventListener('mousemove', (event) => {
    const index = options.indexOf(event.target.closest('.lang-option'));
    if (index >= 0 && index !== active) setActive(index, false);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(active + 1, options.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (event.key === 'Enter' && options[active]) { event.preventDefault(); choose(options[active].dataset.code); }
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(true); });
  document.addEventListener('pointerdown', (event) => { if (!picker.contains(event.target)) close(); });
}

// Choices saved by the previous version of the site lived in localStorage; move them to the cookie.
try {
  const old = localStorage.getItem(COOKIE);
  if (old) {
    localStorage.removeItem(COOKIE);
    localStorage.removeItem('ins-lang-auto');
    if (!document.cookie.includes(`${COOKIE}=`) && BY_CODE[old.toLowerCase()]) {
      remember(old);
      if (old !== current) switchTo(old);
    }
  }
} catch { /* storage disabled */ }

window.i18n = {
  t,
  get lang() { return current; },
  ready: Promise.resolve(),
};
setupPicker();
