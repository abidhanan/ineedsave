// Checks the translated articles of one or more languages against the Indonesian originals.
// Usage: node scripts/check-translation.mjs <code> [<code> ...]   (prints problems; exit 1 if any)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'content/articles');
const slugs = readdirSync(srcDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const uiSource = JSON.parse(readFileSync(join(root, 'content/articles-i18n/id/_ui.json'), 'utf8'));
// Block tags and links must match the original one for one; <strong>/<em> may move with the word order.
const tags = (html) => [...html.matchAll(/<\/?(?!(?:strong|em)>)([a-z0-9]+)[^>]*>/gi)].map((m) => m[0].replace(/^<(\/?[a-z0-9]+)(?:\s+class="tip")?(?:\s+href="([^"]*)")?\s*>$/i, '<$1 $2>').trim());

let problems = 0;
const fail = (msg) => { problems += 1; console.log(msg); };
for (const code of process.argv.slice(2)) {
  const dir = join(root, 'content/articles-i18n', code);
  const read = (file) => {
    const path = join(dir, file);
    if (!existsSync(path)) { fail(`${code}/${file}: missing`); return null; }
    const raw = readFileSync(path, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) fail(`${code}/${file}: has a BOM`);
    try { return JSON.parse(raw); } catch (e) { fail(`${code}/${file}: invalid JSON (${e.message})`); return null; }
  };
  const ui = read('_ui.json');
  if (ui) {
    for (const k of Object.keys(uiSource)) if (typeof ui[k] !== 'string' || !ui[k].trim()) fail(`${code}/_ui.json: missing "${k}"`);
    if (ui.shareVia && !ui.shareVia.includes('{name}')) fail(`${code}/_ui.json: shareVia must contain {name}`);
  }
  for (const slug of slugs) {
    const src = JSON.parse(readFileSync(join(srcDir, `${slug}.json`), 'utf8'));
    const t = read(`${slug}.json`);
    if (!t) continue;
    const where = `${code}/${slug}.json`;
    if (t.slug !== slug) fail(`${where}: "slug" must be "${slug}"`);
    for (const k of ['title', 'description', 'body', 'photoCaption', 'photo2Caption']) {
      if (typeof t[k] !== 'string' || !t[k].trim()) fail(`${where}: missing "${k}"`);
    }
    if (!Array.isArray(t.tags) || t.tags.length !== src.tags.length) fail(`${where}: "tags" must have ${src.tags.length} items`);
    if (typeof t.body !== 'string') continue;
    const a = tags(src.body);
    const b = tags(t.body);
    if (a.join('') !== b.join('')) {
      const i = a.findIndex((x, n) => x !== b[n]);
      fail(`${where}: HTML structure differs from the Indonesian original at tag #${i + 1}: expected ${a[i]} but found ${b[i] ?? '(end)'} (original has ${a.length} tags, translation has ${b.length})`);
    }
    for (const tag of ['strong', 'em']) {
      const count = (re) => (t.body.match(re) || []).length;
      if (count(new RegExp(`<${tag}>`, 'g')) !== count(new RegExp(`</${tag}>`, 'g'))) fail(`${where}: unbalanced <${tag}>`);
    }
    if (/<[^>]*\sstyle=/.test(t.body)) fail(`${where}: inline styles are not allowed`);
    if ([...t.title].length > 80) fail(`${where}: title is longer than 80 characters`);
  }
}
if (problems) { console.log(`${problems} problem(s)`); process.exit(1); }
console.log('OK');
