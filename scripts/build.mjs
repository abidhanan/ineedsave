// Renders templates/index.html once per language into public/_l/<code>.html (and public/index.html
// in English). middleware.js serves the right file for each visitor, so the page shows up already
// translated, without waiting for JavaScript.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, flagSrc, ogLocaleTags } from '../public/languages.js';
import { buildArticles, homeCards, loadArticles, localizedArticles } from './build-articles.mjs';
import { assertNoEmDash } from './check-no-emdash.mjs';
import { writeTextFile } from './write-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://ineedsave.com';
const articles = loadArticles();
const template = readFileSync(join(root, 'templates/index.html'), 'utf8');
const outDir = join(root, 'public/_l');
mkdirSync(outDir, { recursive: true });

buildSync({
  entryPoints: {
    i18n: join(root, 'public/i18n.js'),
    app: join(root, 'public/app.js'),
    article: join(root, 'public/article.js'),
    analytics: join(root, 'public/analytics.js'),
  },
  outdir: join(root, 'public'),
  entryNames: '[name].min',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  logLevel: 'silent',
});
buildSync({
  entryPoints: { style: join(root, 'public/style.css') },
  outdir: join(root, 'public'),
  entryNames: '[name].min',
  bundle: true,
  minify: true,
  external: ['/fonts/*'],
  logLevel: 'silent',
});

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');
const plainText = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function homeStructuredData(code, t) {
  const faq = Array.from({ length: 6 }, (_, index) => ({
    '@type': 'Question',
    name: t(`faq.q${index + 1}`),
    acceptedAnswer: { '@type': 'Answer', text: plainText(t(`faq.a${index + 1}`)) },
  }));
  const steps = Array.from({ length: 3 }, (_, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    name: t(`how.step${index + 1}.title`),
    text: plainText(t(`how.step${index + 1}.text`)),
    url: `${SITE}/#cara`,
  }));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'I Need Save', url: `${SITE}/`,
        logo: { '@type': 'ImageObject', url: `${SITE}/apple-touch-icon.png`, width: 180, height: 180 },
        sameAs: ['https://github.com/abidhanan', 'https://www.instagram.com/ahawi_channel', 'https://youtube.com/@ahawichannel', 'https://x.com/ahawi_channel'],
      },
      {
        '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'I Need Save', alternateName: 'I Need Save Downloader',
        url: `${SITE}/`, description: t('meta.description'), publisher: { '@id': `${SITE}/#organization` }, inLanguage: code,
      },
      {
        '@type': 'WebPage', '@id': `${SITE}/#webpage`, url: `${SITE}/`, name: t('meta.title'),
        description: t('meta.description'), inLanguage: code, isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#app` }, mainEntity: [{ '@id': `${SITE}/#app` }, { '@id': `${SITE}/#howto` }, { '@id': `${SITE}/#faq` }],
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.hero h1', '.hero .lead', '#faq'] },
      },
      {
        '@type': 'WebApplication', '@id': `${SITE}/#app`, name: 'I Need Save', url: `${SITE}/`,
        description: t('meta.description'), applicationCategory: 'MultimediaApplication', operatingSystem: 'Any',
        browserRequirements: 'Requires a modern web browser', isAccessibleForFree: true,
        featureList: [t('hero.title'), t('how.step3.text')],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@id': `${SITE}/#organization` },
      },
      { '@type': 'HowTo', '@id': `${SITE}/#howto`, name: t('how.title'), description: t('hero.lead'), inLanguage: code, totalTime: 'PT1M', step: steps },
      { '@type': 'FAQPage', '@id': `${SITE}/#faq`, inLanguage: code, mainEntity: faq },
    ],
  };
}

function render(code) {
  const lang = BY_CODE[code.toLowerCase()];
  const strings = JSON.parse(readFileSync(join(root, `public/i18n/${code}.json`), 'utf8'));
  const t = (key) => {
    if (!(key in strings)) throw new Error(`${code}: missing key ${key}`);
    return strings[key];
  };
  const family = SCRIPT_FONT[lang.script];
  // The article cards in the carousel are in the page's language too.
  let html = template.replace('<!--ARTICLE_CARDS-->', homeCards(localizedArticles(articles, code)));

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
  html = html.replace(/(<title>)[^<]*(<\/title>)/, `$1${escapeText(t('meta.title'))}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeAttr(t('meta.title'))}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeAttr(t('meta.title'))}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeAttr(t('meta.description'))}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeAttr(t('meta.description'))}$2`);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${JSON.stringify(homeStructuredData(code, t)).replace(/</g, '\\u003c')}</script>`);
  html = html.replace('<!--OG_LOCALE-->', ogLocaleTags(code));
  html = html.replace(/(<button class="lang-button"[^>]*aria-label=")[^"]*(")/, `$1${escapeAttr(`${t('lang.button')}: ${lang.native}`)}$2`);
  html = html.replace('src="/flags/gb.png">', `src="${flagSrc(lang.flag)}">`);
  html = html.replace('<span class="lang-name" id="lang-name">English</span>', `<span class="lang-name" id="lang-name">${escapeText(lang.native)}</span>`);

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
  html = html.replace('<!--ANALYTICS-->', `${analyticsConfig}<script src="/analytics.min.js?v=5" defer></script>`);

  const boot = JSON.stringify({ lang: code, strings }).replace(/</g, '\\u003c');
  html = html.replace('<!--I18N_BOOT-->', `<script>window.I18N_BOOT=${boot};</script>`);
  return html;
}

for (const { code } of LANGS) {
  const html = render(code);
  writeTextFile(join(outDir, `${code}.html`), html);
  if (code === 'en') writeTextFile(join(root, 'public/index.html'), html);
}
console.log(`built ${LANGS.length} language pages`);
console.log(`built ${buildArticles(articles)} articles, sitemap.xml and robots.txt`);
assertNoEmDash();
