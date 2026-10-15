// Serves the home page already translated: picks the visitor's language at the edge and rewrites
// "/" to the matching pre-rendered file from scripts/build.mjs (the URL in the browser stays "/").
import { rewrite } from '@vercel/functions';
import { pickLanguage } from './public/languages.js';

export const config = { matcher: ['/', '/index.html'] };

export default function middleware(request) {
  const choice = /(?:^|;\s*)ins-lang=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  const lang = pickLanguage({
    choice,
    acceptLanguage: request.headers.get('accept-language'),
    country: request.headers.get('x-vercel-ip-country'),
  });
  return rewrite(new URL(`/_l/${lang}.html`, request.url));
}
