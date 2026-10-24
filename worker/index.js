import { match, pickLanguage } from '../public/languages.js';
import { handleStats } from './stats.js';

const LEGAL = /^\/(kebijakan-privasi|syarat-ketentuan)\/?(?:index\.html)?$/;
const ARTICLE = /^\/artikel(?:\/([a-z0-9-]+))?\/?(?:index\.html)?$/;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview/i;
const LEGACY_API = new Set(['/api/extract', '/api/download']);

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
};

function secure(response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
}

function languageFor(request, url, allowBotFallback = false) {
  const cookie = /(?:^|;\s*)ins-lang=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  const facebookLocale = (
    url.searchParams.get('fb_locale')
    || request.headers.get('x-facebook-locale')
    || ''
  ).replace('_', '-');
  const choice = match(facebookLocale) || cookie;
  if (allowBotFallback && !choice && BOT.test(request.headers.get('user-agent') || '')) return 'id';
  return pickLanguage({
    choice,
    acceptLanguage: request.headers.get('accept-language'),
    country: request.cf?.country || request.headers.get('cf-ipcountry'),
  });
}

function assetRequest(request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return new Request(assetUrl, request);
}

async function localizedAsset(request, env, url) {
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const language = languageFor(request, url);
    return env.ASSETS.fetch(assetRequest(request, `/_l/${language}`));
  }

  const legal = LEGAL.exec(url.pathname);
  const article = ARTICLE.exec(url.pathname);
  if (!legal && !article) return env.ASSETS.fetch(request);

  const language = languageFor(request, url, true);
  if (language === 'id') return env.ASSETS.fetch(request);
  const pathname = legal
    ? `/_l/${language}/${legal[1]}/index.html`
    : `/_l/${language}/artikel/${article[1] ? `${article[1]}/` : ''}index.html`;
  return env.ASSETS.fetch(assetRequest(request, pathname));
}

async function proxyLegacy(request, env) {
  if (!env.BACKEND_ORIGIN) {
    return Response.json({ error: 'backend_not_configured' }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, env.BACKEND_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', incoming.host);
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  return fetch(new Request(target, init));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'ineedsave.site' || url.hostname === 'www.ineedsave.site') {
      url.protocol = 'https:';
      url.hostname = 'ineedsave.com';
      url.port = '';
      return Response.redirect(url, 308);
    }

    if (url.hostname === 'www.ineedsave.com') {
      url.protocol = 'https:';
      url.hostname = 'ineedsave.com';
      url.port = '';
      return Response.redirect(url, 308);
    }

    let response;
    if (url.pathname === '/api/stats') {
      response = await handleStats(request, env);
    } else if (LEGACY_API.has(url.pathname) || url.pathname.startsWith('/_vercel/')) {
      response = await proxyLegacy(request, env);
    } else {
      response = await localizedAsset(request, env, url);
    }
    return secure(response);
  },
};

export { languageFor, localizedAsset, proxyLegacy, secure };
