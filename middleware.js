// Serves pages already translated: picks the visitor's language at the edge and rewrites the URL to
// the matching pre-rendered file from scripts/build.mjs (the URL in the browser stays the same).
// "/" -> /_l/<code>.html; "/artikel/..." -> /_l/<code>/artikel/... (Indonesian is served as is), and the
// same for the legal pages ("/kebijakan-privasi/" -> /_l/<code>/kebijakan-privasi/).
import { rewrite } from '@vercel/functions';
import { match, pickLanguage } from './public/languages.js';

export const config = {
  matcher: ['/', '/index.html', '/artikel', '/artikel/((?!img/).*)', '/kebijakan-privasi/:rest*', '/syarat-ketentuan/:rest*'],
};
const LEGAL = /^\/(kebijakan-privasi|syarat-ketentuan)\/?(?:index\.html)?$/;

// Search engines and link previews get the articles in their original language (Indonesian).
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview/i;

export default function middleware(request) {
  const url = new URL(request.url);

  if (url.hostname === 'ineedsave.site' || url.hostname === 'www.ineedsave.site') {
    url.protocol = 'https:';
    url.hostname = 'ineedsave.com';
    url.port = '';
    return Response.redirect(url, 308);
  }

  const cookie = /(?:^|;\s*)ins-lang=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  // Facebook's crawler fetches each language listed in og:locale:alternate as ?fb_locale=ja_JP (or with an
  // X-Facebook-Locale header), so a shared link previews in the language of whoever sees it.
  const fbLocale = (url.searchParams.get('fb_locale') || request.headers.get('x-facebook-locale') || '').replace('_', '-');
  const asked = match(fbLocale);
  const choice = asked || cookie;

  const legal = LEGAL.exec(url.pathname);
  if (url.pathname.startsWith('/artikel') || legal) {
    const page = legal ? null : /^\/artikel(?:\/([a-z0-9-]+))?\/?(?:index\.html)?$/.exec(url.pathname);
    if (!legal && (!page || page[1] === 'img')) return undefined; // images and other files
    const lang = !choice && BOT.test(request.headers.get('user-agent') || '')
      ? 'id'
      : pickLanguage({
        choice,
        acceptLanguage: request.headers.get('accept-language'),
        country: request.headers.get('x-vercel-ip-country'),
      });
    if (lang === 'id') return undefined;
    if (legal) return rewrite(new URL(`/_l/${lang}/${legal[1]}/index.html`, request.url));
    return rewrite(new URL(`/_l/${lang}/artikel/${page[1] ? `${page[1]}/` : ''}index.html`, request.url));
  }

  const lang = pickLanguage({
    choice,
    acceptLanguage: request.headers.get('accept-language'),
    country: request.headers.get('x-vercel-ip-country'),
  });
  return rewrite(new URL(`/_l/${lang}.html`, request.url));
}
