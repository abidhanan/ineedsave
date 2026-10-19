// Articles: renders /artikel/<slug>/ pages, the /artikel/ index, the cards for the home page
// carousel, sitemap.xml and robots.txt from content/articles/*.json (Indonesian originals) and
// content/articles-i18n/<code>/ (translations). Indonesian pages are written to public/artikel/,
// every other language to public/_l/<code>/artikel/; middleware.js serves the visitor's language.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BY_CODE, LANGS, RTL, SCRIPT_FONT, ogLocaleTags } from '../public/languages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://ineedsave.com';
const SOCIALS = ['https://github.com/abidhanan', 'https://www.instagram.com/ahawi_channel', 'https://youtube.com/@ahawichannel', 'https://x.com/ahawi_channel'];
const ICONS = JSON.parse(readFileSync(join(root, 'scripts/brand-icons.json'), 'utf8'));
const ALLOWED_TAGS = new Set(['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'div']);

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');
const dateLabel = (iso, code) => {
  const date = new Date(`${iso}T08:00:00+07:00`);
  try { return date.toLocaleDateString(code, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; }
};
const isoTime = (iso) => `${iso}T08:00:00+07:00`;
const words = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

const CALENDAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const LINK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
const brandIcon = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

/** All articles, newest first, with their bodies checked against the allowed markup. */
export function loadArticles() {
  const dir = join(root, 'content/articles');
  const list = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const a = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (`${a.slug}.json` !== f) throw new Error(`${f}: slug mismatch`);
    for (const [, tag] of a.body.matchAll(/<\/?([a-z0-9]+)/gi)) {
      if (!ALLOWED_TAGS.has(tag.toLowerCase())) throw new Error(`${f}: tag <${tag}> not allowed`);
    }
    for (const [, href] of a.body.matchAll(/href="([^"]*)"/g)) {
      if (href !== '/' && !/^\/artikel\/[a-z0-9-]+\/$/.test(href)) throw new Error(`${f}: unexpected link ${href}`);
    }
    return { ...a, minutes: Math.max(1, Math.round(words(a.body) / 200)) };
  });
  return list.sort((x, y) => y.date.localeCompare(x.date));
}

/** One article card (home carousel, /artikel/ index, "Artikel Lainnya"). */
export function card(a, readMore, heading = 'h3') {
  return `<article class="article-card" data-categories="${escapeAttr(categoryKeys(a).join('|'))}">
          <a class="article-link" href="/artikel/${a.slug}/">
            <div class="article-thumb"><img src="/artikel/img/${a.slug}.webp" alt="${escapeAttr(a.title)}" width="1200" height="630" loading="lazy" decoding="async"></div>
            <div class="article-body">
              <div class="article-tags">${a.tags.map((t) => `<span>${escapeText(t)}</span>`).join('')}</div>
              <${heading} class="article-title">${escapeText(a.title)}</${heading}>
              <p class="article-excerpt">${escapeText(a.description)}</p>
              <div class="article-meta">${CALENDAR}<time datetime="${isoTime(a.date)}">${dateLabel(a.date, a.lang)}</time></div>
              <span class="article-more">${readMore}${ARROW}</span>
            </div>
          </a>
        </article>`;
}

/** Cards for the home page carousel; "Read more" follows the page language via data-i18n. */
export function homeCards(articles) {
  return articles.map((a) => card(a, '<span data-i18n="articles.readMore">Read more</span>')).join('\n        ');
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const i18nDir = join(root, 'content/articles-i18n');

/** The articles in one language: the Indonesian originals with the translated text laid over them.
 *  An article without a translation yet falls back to English, then to Indonesian. */
export function localizedArticles(articles, code) {
  if (code === 'id') return articles.map((a) => ({ ...a, lang: 'id' }));
  return articles.map((a) => {
    for (const lang of [code, 'en']) {
      const path = join(i18nDir, lang, `${a.slug}.json`);
      if (!existsSync(path)) continue;
      const t = readJson(path);
      return {
        ...a,
        lang,
        title: t.title,
        description: t.description,
        tags: t.tags,
        body: t.body,
        photo: a.photo && { ...a.photo, caption: t.photoCaption },
        photo2: a.photo2 && { ...a.photo2, caption: t.photo2Caption },
        source: a,
      };
    }
    return { ...a, lang: 'id' };
  });
}

/** Interface strings for the article pages (content/articles-i18n/<code>/_ui.json). */
function uiStrings(code) {
  for (const lang of [code, 'en', 'id']) {
    const path = join(i18nDir, lang, '_ui.json');
    if (existsSync(path)) return readJson(path);
  }
  throw new Error('content/articles-i18n/id/_ui.json is missing');
}

function analyticsTags() {
  const ga4 = process.env.GA4_ID?.trim() || null;
  const clarity = process.env.CLARITY_ID?.trim() || null;
  const config = ga4 || clarity ? `<script>window.INS_ANALYTICS=${JSON.stringify({ ga4, clarity })};</script>\n  ` : '';
  return `${config}<script src="/analytics.js" defer></script>
  <script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
  <script src="/_vercel/insights/script.js" defer></script>`;
}

function scriptFontTags(code) {
  const family = SCRIPT_FONT[BY_CODE[code.toLowerCase()]?.script];
  if (!family) return '';
  const css = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;700&display=swap`;
  return `
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${css}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${css}"></noscript>`;
}

function head({ code, title, pageTitle = `${title} - I Need Save`, description, url, image, imageAlt, type = 'website', extraMeta = '', jsonLd }) {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeText(pageTitle)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <link rel="canonical" href="${url}">
  <link rel="alternate" type="application/rss+xml" title="I Need Save Articles" href="/feed.xml">
  <link rel="alternate" type="application/feed+json" title="I Need Save Articles" href="/feed.json">
  <meta name="theme-color" content="#0A0A0A">
  <meta name="color-scheme" content="dark">
  <meta property="og:site_name" content="I Need Save">
  ${ogLocaleTags(code)}
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}">
  ${extraMeta}<meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}">
  <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
  <link rel="preload" href="/fonts/noto-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/style.css">${scriptFontTags(code)}
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>`;
}

function pageHeader(strings, ui) {
  return `<header class="header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="I Need Save">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>
        </span>
        <span class="brand-name">I Need Save</span>
      </a>
      <nav class="nav" aria-label="${escapeAttr(strings['nav.label'])}">
        <a href="/">${escapeText(strings['nav.downloader'])}</a>
        <a href="/#cara">${escapeText(strings['nav.how'])}</a>
        <a href="/#platform">${escapeText(strings['nav.platforms'])}</a>
        <a href="/#faq">${escapeText(strings['nav.faq'])}</a>
        <a href="/#artikel" aria-current="page">${escapeText(strings['articles.title'])}</a>
      </nav>
      <a class="btn btn-primary header-cta" href="/">${escapeText(ui.tryNow)}</a>
    </div>
  </header>`;
}

/** Views, likes and shares on the left; buttons for each network and "copy link" on the right. */
function statsBar(a, url, ui) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(a.title);
  const items = [
    ['WhatsApp', `https://wa.me/?text=${t}%20${u}`, 'whatsapp'],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`, 'facebook'],
    ['X', `https://twitter.com/intent/tweet?url=${u}&text=${t}`, 'x'],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, 'linkedin'],
    ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`, 'telegram'],
  ];
  return `<div class="post-stats" data-slug="${a.slug}" data-url="${url}" data-title="${escapeAttr(a.title)}">
          <div class="stats-left">
            <span class="stat" title="${escapeAttr(ui.views)}">${EYE}<span class="stat-count" data-views>0</span><span class="sr-only">${escapeText(ui.viewsSr)}</span></span>
            <button class="stat stat-button" type="button" data-like aria-pressed="false" aria-label="${escapeAttr(ui.like)}">${HEART}<span class="stat-count" data-likes>0</span></button>
            <button class="stat stat-button" type="button" data-share aria-label="${escapeAttr(ui.share)}">${SHARE}<span class="stat-count" data-shares>0</span></button>
          </div>
          <div class="socials share-links">
            ${items.map(([label, href, icon]) => `<a class="social" href="${href}" target="_blank" rel="noopener" data-share-link aria-label="${escapeAttr(ui.shareVia.replace('{name}', label))}">${brandIcon(icon)}</a>`).join('\n            ')}
            <button class="social" type="button" data-copy aria-label="${escapeAttr(ui.copyLink)}">${LINK}</button>
          </div>
        </div>`;
}

function shell({ code, headHtml, strings, ui, footer, main }) {
  const family = SCRIPT_FONT[BY_CODE[code.toLowerCase()]?.script];
  const t = { copied: ui.copied, copyPrompt: ui.copyPrompt };
  return `<!doctype html>
<html lang="${code}" dir="${RTL.has(code) ? 'rtl' : 'ltr'}"${family ? ` style="--font-script: &quot;${family}&quot;"` : ''}>
${headHtml}
<body>
  <a class="skip" href="#main">${escapeText(strings.skip)}</a>
  ${pageHeader(strings, ui)}

  <main id="main" tabindex="-1" class="article-page pattern-dots">
${main}
  </main>

${footer}

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <script>window.INS_T=${JSON.stringify(t).replace(/</g, '\\u003c')};</script>
  <script src="/article.js" defer></script>
  ${analyticsTags()}
</body>
</html>
`;
}

/** Category ids of an article: its tags in the Indonesian original, so they match across languages. */
const categoryKeys = (a) => (a.source || a).tags.map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

/** "All" plus every category on the /artikel/ page, most used first; article.js filters the grid with them. */
function categoryFilter(articles, ui) {
  const found = new Map();
  for (const a of articles) {
    categoryKeys(a).forEach((key, i) => {
      const entry = found.get(key) || { key, label: a.tags[i], count: 0 };
      entry.count += 1;
      found.set(key, entry);
    });
  }
  const chips = [{ key: '', label: ui.allCategories, count: articles.length },
    ...[...found.values()].sort((x, y) => y.count - x.count)];
  return `<div class="category-filter" role="group" aria-label="${escapeAttr(ui.categories)}" data-category-filter>
        ${chips.map((c) => `<button class="category-chip" type="button" data-category="${c.key}" aria-pressed="${c.key ? 'false' : 'true'}">${escapeText(c.label)}</button>`).join('\n        ')}
      </div>`;
}

const readMore = (strings) => `<span>${escapeText(strings['articles.readMore'])}</span>`;

const ORG = {
  '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'I Need Save', url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/apple-touch-icon.png`, width: 180, height: 180 }, sameAs: SOCIALS,
};
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'I Need Save', url: `${SITE}/`, publisher: { '@id': `${SITE}/#organization` } };

/** One row in the "Artikel Populer" sidebar; article.js builds the same markup when reordering. */
function popularItem(a) {
  const stat = (icon, key) => `<span class="mini-stat">${icon}<span data-${key}>0</span></span>`;
  return `<li data-slug="${a.slug}"><a class="popular-item" href="/artikel/${a.slug}/"><img src="/artikel/img/${a.slug}.webp" alt="" width="96" height="50" loading="lazy" decoding="async"><span class="popular-text"><span class="popular-title">${escapeText(a.title)}</span><span class="popular-stats" aria-hidden="true">${stat(EYE, 'views')}${stat(HEART, 'likes')}${stat(SHARE, 'shares')}</span></span></a></li>`;
}

/** A photo with its caption and credit (cover, or the one placed in the middle of the article). */
function figure(photo, src, alt, cls, extra, ui) {
  return `<figure class="${cls}">
          <img src="${src}" alt="${escapeAttr(alt)}" width="1200" height="630"${extra || ''}>
          <figcaption>
            <span class="caption-text">${escapeText(photo.caption || '')}</span>
            <span class="caption-credit">${escapeText(ui.photo)}: <a href="${photo.url}?utm_source=ineedsave&amp;utm_medium=referral" target="_blank" rel="noopener">${escapeText(photo.author)}</a></span>
          </figcaption>
        </figure>`;
}

/** Puts the second photo before the <h2> nearest the middle (never the first one or the FAQ). The
 *  heading is chosen in the Indonesian original; a translation gets it before the same heading. */
function withMidPhoto(a, ui) {
  if (!a.photo2) return a.body;
  const original = a.source || a;
  const all = [...original.body.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)];
  const heads = all.slice(1).filter((m) => !/pertanyaan/i.test(m[1]));
  if (!heads.length) return a.body;
  const middle = original.body.length / 2;
  const chosen = heads.reduce((best, m) => (Math.abs(m.index - middle) < Math.abs(best.index - middle) ? m : best));
  const at = [...a.body.matchAll(/<h2[^>]*>/g)][all.indexOf(chosen)]?.index;
  if (at === undefined) return a.body;
  const fig = figure(a.photo2, `/artikel/img/${a.slug}-2.webp`, a.photo2.caption || a.title, 'post-figure', ' loading="lazy" decoding="async"', ui);
  return `${a.body.slice(0, at)}${fig}\n${a.body.slice(at)}`;
}

function articlePage(a, articles, { code, strings, ui, footer }) {
  const url = `${SITE}/artikel/${a.slug}/`;
  const image = `${SITE}/artikel/img/${a.slug}.jpg`;
  const others = articles.filter((x) => x.slug !== a.slug);
  const related = others.slice(0, 3);
  const popular = others.slice(0, 4); // replaced in the browser by the most-viewed, when stats are on
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG,
      WEBSITE,
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: a.title,
        description: a.description,
        inLanguage: code,
        isPartOf: { '@id': `${SITE}/#website` },
        primaryImageOfPage: { '@id': `${url}#primaryimage` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: { '@id': `${url}#article` },
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: a.title,
        description: a.description,
        image: { '@type': 'ImageObject', '@id': `${url}#primaryimage`, url: image, width: 1200, height: 630 },
        thumbnailUrl: image,
        datePublished: isoTime(a.date),
        dateModified: isoTime(a.date),
        inLanguage: code,
        articleSection: a.tags,
        keywords: a.tags.join(', '),
        wordCount: words(a.body),
        mainEntityOfPage: { '@id': `${url}#webpage` },
        author: { '@id': `${SITE}/#organization` },
        publisher: { '@id': `${SITE}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ui.home, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: strings['articles.title'], item: `${SITE}/artikel/` },
          { '@type': 'ListItem', position: 3, name: a.title, item: url },
        ],
      },
    ],
  };
  const extraMeta = `<meta property="article:published_time" content="${isoTime(a.date)}">
  <meta property="article:modified_time" content="${isoTime(a.date)}">
  <meta property="article:section" content="${escapeAttr(a.tags[0])}">
  ${a.tags.map((t) => `<meta property="article:tag" content="${escapeAttr(t)}">`).join('\n  ')}
  `;
  const main = `    <div class="container post-layout">
      <div class="post-main">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">${escapeText(ui.home)}</a></li>
          <li><a href="/artikel/">${escapeText(strings['articles.title'])}</a></li>
          <li aria-current="page">${escapeText(a.title)}</li>
        </ol>
      </nav>
      <article class="post">
        <header class="post-head">
          <div class="article-tags">${a.tags.map((t) => `<span>${escapeText(t)}</span>`).join('')}</div>
          <h1>${escapeText(a.title)}</h1>
          <p class="post-meta">${CALENDAR}<time datetime="${isoTime(a.date)}">${dateLabel(a.date, a.lang)}</time></p>
        </header>
        ${a.photo ? figure(a.photo, `/artikel/img/${a.slug}.webp`, a.title, 'post-cover', ' fetchpriority="high"', ui) : ''}
        <div class="post-body">
          ${withMidPhoto(a, ui)}
        </div>
        ${statsBar(a, url, ui)}
      </article>
      </div>
      <aside class="popular" aria-labelledby="popular-title">
        <h2 id="popular-title">${escapeText(ui.popular)}</h2>
        <ol class="popular-list" data-popular data-current="${a.slug}">
          ${popular.map(popularItem).join('\n          ')}
        </ol>
      </aside>
    </div>
    <div class="container cta-wrap">
      <aside class="post-cta">
        <p>${escapeText(strings['footer.description'])}</p>
        <a class="btn btn-primary" href="/">${escapeText(ui.tryNow)}</a>
      </aside>
    </div>
    <script>window.INS_ARTICLES=${JSON.stringify(articles.map((x) => ({ slug: x.slug, title: x.title }))).replace(/</g, '\\u003c')};</script>
    <section class="related" aria-labelledby="related-title">
      <div class="container">
        <div class="related-head">
          <h2 id="related-title">${escapeText(ui.more)}</h2>
          <a class="btn btn-outline" href="/artikel/">${escapeText(ui.seeAll)}</a>
        </div>
        <div class="article-grid">
        ${related.map((r) => card(r, readMore(strings))).join('\n        ')}
        </div>
      </div>
    </section>`;
  const headHtml = head({ code, title: a.title, description: a.description, url, image, imageAlt: a.title, type: 'article', extraMeta, jsonLd });
  return shell({ code, headHtml, strings, ui, footer, main });
}

function indexPage(articles, { code, strings, ui, footer }) {
  const url = `${SITE}/artikel/`;
  const title = ui.indexTitle;
  const description = ui.indexDescription;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ORG,
      WEBSITE,
      { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: code, isPartOf: { '@id': `${SITE}/#website` }, mainEntity: { '@id': `${url}#collection` }, breadcrumb: { '@id': `${url}#breadcrumb` } },
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        name: title,
        description,
        url,
        inLanguage: code,
        hasPart: articles.map((a) => ({ '@type': 'Article', headline: a.title, url: `${SITE}/artikel/${a.slug}/` })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ui.home, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: strings['articles.title'], item: url },
        ],
      },
    ],
  };
  const main = `    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">${escapeText(ui.home)}</a></li>
          <li aria-current="page">${escapeText(strings['articles.title'])}</li>
        </ol>
      </nav>
      <header class="list-head">
        <h1>${escapeText(strings['articles.title'])}</h1>
      </header>
      ${categoryFilter(articles, ui)}
      <div class="article-grid">
        ${articles.map((a) => card(a, readMore(strings), 'h2')).join('\n        ')}
      </div>
    </div>`;
  const headHtml = head({ code, title, pageTitle: `${strings['articles.title']} - I Need Save`, description, url, image: `${SITE}/og-image.png?v=4`, imageAlt: 'I Need Save', jsonLd });
  return shell({ code, headHtml, strings, ui, footer, main });
}

const xml = (s) => escapeText(s).replace(/'/g, '&apos;').replace(/"/g, '&quot;');

/** Writes article pages and machine-readable discovery files for search engines and answer engines. */
export function buildArticles(articles) {
  for (const { code } of LANGS) {
    const lang = {
      code,
      strings: readJson(join(root, `public/i18n/${code}.json`)),
      ui: uiStrings(code),
      // The footer is taken from the rendered home page of the same language so both stay identical.
      footer: `  ${readFileSync(join(root, `public/_l/${code}.html`), 'utf8').match(/<footer class="footer">[\s\S]*?<\/footer>/)[0]}`,
    };
    const list = localizedArticles(articles, code);
    const base = code === 'id' ? join(root, 'public/artikel') : join(root, 'public/_l', code, 'artikel');
    for (const a of list) {
      mkdirSync(join(base, a.slug), { recursive: true });
      writeFileSync(join(base, a.slug, 'index.html'), articlePage(a, list, lang));
    }
    writeFileSync(join(base, 'index.html'), indexPage(list, lang));
  }

  const newest = articles[0]?.date || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, lastmod: newest, priority: '1.0' },
    { loc: `${SITE}/artikel/`, lastmod: newest, priority: '0.8' },
    ...articles.map((a) => ({ loc: `${SITE}/artikel/${a.slug}/`, lastmod: a.date, priority: '0.7' })),
  ];
  writeFileSync(join(root, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u, index) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority>${index > 1 ? `<image:image><image:loc>${SITE}/artikel/img/${articles[index - 2].slug}.jpg</image:loc><image:title>${xml(articles[index - 2].title)}</image:title></image:image>` : ''}</url>`).join('\n')}
</urlset>
`);
  writeFileSync(join(root, 'public/robots.txt'), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);
  const feedItems = articles.map((a) => ({
    id: `${SITE}/artikel/${a.slug}/`, url: `${SITE}/artikel/${a.slug}/`, title: a.title,
    summary: a.description, image: `${SITE}/artikel/img/${a.slug}.jpg`, date_published: isoTime(a.date),
    tags: a.tags, language: 'id',
  }));
  writeFileSync(join(root, 'public/feed.json'), `${JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1', title: 'I Need Save Articles', home_page_url: `${SITE}/artikel/`,
    feed_url: `${SITE}/feed.json`, description: 'Panduan mengunduh video, foto, dan audio dari media sosial.', language: 'id', items: feedItems,
  }, null, 2)}\n`);
  writeFileSync(join(root, 'public/feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>I Need Save Articles</title><link>${SITE}/artikel/</link><description>Panduan mengunduh video, foto, dan audio dari media sosial.</description><language>id</language>
${articles.map((a) => `<item><guid isPermaLink="true">${SITE}/artikel/${a.slug}/</guid><title>${xml(a.title)}</title><link>${SITE}/artikel/${a.slug}/</link><description>${xml(a.description)}</description><pubDate>${new Date(isoTime(a.date)).toUTCString()}</pubDate></item>`).join('\n')}
</channel></rss>
`);
  writeFileSync(join(root, 'public/llms.txt'), `# I Need Save

> I Need Save is a free browser-based tool for downloading publicly accessible videos, photos, and audio from supported social platforms. No account or app is required.

## Primary pages

- [Downloader](${SITE}/): Paste a public media URL, choose an available format and quality, then save it to your device.
- [Articles](${SITE}/artikel/): Practical guides, troubleshooting, quality explanations, and responsible-use information.
- [RSS feed](${SITE}/feed.xml): Latest article summaries in RSS 2.0.
- [JSON feed](${SITE}/feed.json): Latest article summaries in JSON Feed 1.1.

## Usage notes

- Private, login-protected, or region-restricted content may not be accessible.
- Files are delivered to the visitor's device and are not retained by I Need Save.
- Visitors should download only content they own or are authorized to save and must respect platform terms and copyright.

## Article guides

${articles.map((a) => `- [${a.title}](${SITE}/artikel/${a.slug}/): ${a.description}`).join('\n')}
`);
  return articles.length;
}
