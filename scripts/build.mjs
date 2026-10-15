// Renders templates/index.html once per language into public/_l/<code>.html (and public/index.html
// in English). middleware.js serves the right file for each visitor, so the page shows up already
// translated, without waiting for JavaScript.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, flagEmoji } from '../public/languages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(join(root, 'templates/index.html'), 'utf8');
const outDir = join(root, 'public/_l');
mkdirSync(outDir, { recursive: true });

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

function render(code) {
  const lang = BY_CODE[code.toLowerCase()];
  const strings = JSON.parse(readFileSync(join(root, `public/i18n/${code}.json`), 'utf8'));
  const t = (key) => {
    if (!(key in strings)) throw new Error(`${code}: missing key ${key}`);
    return strings[key];
  };
  const family = SCRIPT_FONT[lang.script];
  let html = template;

  html = html.replace('<html lang="en" dir="ltr">',
    `<html lang="${code}" dir="${RTL.has(code) ? 'rtl' : 'ltr'}"${family ? ` style="--font-script: &quot;${family}&quot;"` : ''}>`);

  // <tag data-i18n="key">text</tag> and <tag data-i18n-html="key">markup</tag>
  html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (_, open, tag, key, __, close) => open + escapeText(t(key)) + close);
  html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n-html="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (_, open, tag, key, __, close) => open + t(key) + close);
  // attributes listed in data-i18n-attr="placeholder:key;aria-label:key"
  html = html.replace(/<[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>/g, (tag, spec) => {
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      tag = tag.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), `$1${escapeAttr(t(key))}$2`);
    }
    return tag;
  });

  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttr(t('meta.description'))}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeAttr(t('meta.description'))}$2`);
  html = html.replace(/(<button class="lang-button"[^>]*aria-label=")[^"]*(")/, `$1${escapeAttr(`${t('lang.button')}: ${lang.native}`)}$2`);
  html = html.replace('<span class="lang-flag" aria-hidden="true">🇺🇸</span>', `<span class="lang-flag" aria-hidden="true">${flagEmoji(lang.flag)}</span>`);
  html = html.replace('<span class="lang-code">EN</span>', `<span class="lang-code">${code.split('-')[0].toUpperCase()}</span>`);

  // Scripts outside Noto Sans's own coverage get their sister font, loaded without blocking the first paint.
  const fontCss = family
    ? `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`
    : null;
  html = html.replace('<!--SCRIPT_FONT-->', fontCss
    ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link rel="stylesheet" href="${fontCss}" media="print" onload="this.media='all'">\n  <noscript><link rel="stylesheet" href="${fontCss}"></noscript>`
    : '');

  // GA4 + Clarity are added only when their IDs are configured (Vercel env vars GA4_ID / CLARITY_ID).
  const analytics = { ga4: process.env.GA4_ID?.trim() || null, clarity: process.env.CLARITY_ID?.trim() || null };
  const analyticsConfig = analytics.ga4 || analytics.clarity
    ? `<script>window.INS_ANALYTICS=${JSON.stringify(analytics).replace(/</g, '\\u003c')};</script>\n  `
    : '';
  html = html.replace('<!--ANALYTICS-->', `${analyticsConfig}<script src="/analytics.js" defer></script>`);

  const boot = JSON.stringify({ lang: code, strings }).replace(/</g, '\\u003c');
  html = html.replace('<!--I18N_BOOT-->', `<script>window.I18N_BOOT=${boot};</script>`);
  return html;
}

for (const { code } of LANGS) {
  const html = render(code);
  writeFileSync(join(outDir, `${code}.html`), html);
  if (code === 'en') writeFileSync(join(root, 'public/index.html'), html);
}
console.log(`built ${LANGS.length} language pages`);
