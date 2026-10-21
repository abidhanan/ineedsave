// Checks translated legal pages against the English originals.
// Usage: node scripts/check-legal.mjs <code> [<code> ...]   (prints problems; exit 1 if any)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tags = (html) => [...html.matchAll(/<\/?(?!(?:strong|em)>)([a-z0-9]+)[^>]*>/gi)].map((m) => m[0]);
let problems = 0;
const fail = (msg) => { problems += 1; console.log(msg); };
for (const code of process.argv.slice(2)) {
  const strings = JSON.parse(readFileSync(join(root, `public/i18n/${code}.json`), 'utf8'));
  for (const kind of ['privacy', 'terms']) {
    const file = `content/legal/${kind}.${code}.json`;
    const path = join(root, file);
    if (!existsSync(path)) { fail(`${file}: missing`); continue; }
    const raw = readFileSync(path, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) fail(`${file}: has a BOM`);
    let t;
    try { t = JSON.parse(raw); } catch (e) { fail(`${file}: invalid JSON (${e.message})`); continue; }
    const src = JSON.parse(readFileSync(join(root, `content/legal/${kind}.en.json`), 'utf8'));
    for (const k of ['title', 'description', 'updated', 'body']) if (typeof t[k] !== 'string' || !t[k].trim()) fail(`${file}: missing "${k}"`);
    if (t.title !== strings[`footer.${kind}`]) fail(`${file}: "title" must be exactly ${JSON.stringify(strings[`footer.${kind}`])} (footer.${kind} in public/i18n/${code}.json)`);
    if (typeof t.body !== 'string') continue;
    const a = tags(src.body);
    const b = tags(t.body);
    if (a.join('') !== b.join('')) {
      const i = a.findIndex((x, n) => x !== b[n]);
      fail(`${file}: HTML structure differs from the English original at tag #${i + 1}: expected ${a[i]} but found ${b[i] ?? '(end)'} (original ${a.length} tags, translation ${b.length})`);
    }
    for (const tag of ['strong', 'em']) {
      const count = (re) => (t.body.match(re) || []).length;
      if (count(new RegExp(`<${tag}>`, 'g')) !== count(new RegExp(`</${tag}>`, 'g'))) fail(`${file}: unbalanced <${tag}>`);
    }
  }
}
if (problems) { console.log(`${problems} problem(s)`); process.exit(1); }
console.log('OK');
