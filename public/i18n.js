// Language support in the browser. The page arrives already translated (middleware.js picks the
// language, scripts/build.mjs renders one HTML file per language) with its strings embedded in
// window.I18N_BOOT, so nothing is fetched on load. This file only powers t() for app.js and the
// language picker, which switches the page in place and remembers the choice in a cookie.
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, flagEmoji } from '/languages.js';

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
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}

function updateButton() {
  const lang = BY_CODE[current.toLowerCase()];
  const button = document.getElementById('lang-button');
  button.querySelector('.lang-flag').textContent = flagEmoji(lang.flag);
  button.querySelector('.lang-code').textContent = lang.code.split('-')[0].toUpperCase();
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

// ---------- picker ----------
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

function buildList(list, filter) {
  const q = filter.trim().toLowerCase();
  const items = LANGS.filter((l) => !q || l.native.toLowerCase().includes(q)
    || l.english.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q));
  list.replaceChildren(...items.map((l) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-item';
    btn.lang = l.code;
    btn.dataset.code = l.code;
    if (l.code === current) btn.setAttribute('aria-current', 'true');
    const flag = document.createElement('span');
    flag.className = 'lang-flag';
    flag.setAttribute('aria-hidden', 'true');
    flag.textContent = flagEmoji(l.flag);
    const names = document.createElement('span');
    names.className = 'lang-names';
    const native = document.createElement('span');
    native.className = 'lang-native';
    native.textContent = l.native;
    if (SCRIPT_FONT[l.script]) native.style.fontFamily = `"Noto Sans", "${SCRIPT_FONT[l.script]}", sans-serif`;
    const eng = document.createElement('span');
    eng.className = 'lang-english';
    eng.lang = 'en';
    eng.textContent = l.english;
    names.append(native, eng);
    btn.append(flag, names);
    li.append(btn);
    return li;
  }));
  document.getElementById('lang-empty').hidden = items.length > 0;
}

function setupPicker() {
  const button = document.getElementById('lang-button');
  const dialog = document.getElementById('lang-dialog');
  const search = document.getElementById('lang-search');
  const list = document.getElementById('lang-list');

  button.addEventListener('click', () => {
    loadMenuFonts();
    search.value = '';
    buildList(list, '');
    dialog.showModal();
    const active = list.querySelector('[aria-current]');
    if (active) list.scrollTop = active.offsetTop - list.clientHeight / 2; // scroll the list only, not the page
    if (matchMedia('(hover: hover)').matches) search.focus();
  });
  search.addEventListener('input', () => buildList(list, search.value));
  list.addEventListener('click', (event) => {
    const item = event.target.closest('.lang-item');
    if (!item) return;
    remember(item.dataset.code);
    dialog.close();
    switchTo(item.dataset.code);
  });
  document.getElementById('lang-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
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
