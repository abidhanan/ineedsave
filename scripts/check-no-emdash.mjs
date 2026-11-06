import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.txt', '.xml']);
const SCAN_DIRECTORIES = ['content', 'public', 'scripts', 'templates'];

function textFiles(path) {
  const files = [];
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) files.push(...textFiles(child));
    else if (TEXT_EXTENSIONS.has(extname(name).toLowerCase())) files.push(child);
  }
  return files;
}

export function assertNoEmDash() {
  const matches = [];
  for (const directory of SCAN_DIRECTORIES) {
    for (const file of textFiles(join(root, directory))) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.includes('\u2014')) matches.push(`${relative(root, file)}:${index + 1}`);
      });
    }
  }
  if (matches.length) throw new Error(`Em dash is not allowed:\n${matches.join('\n')}`);
  console.log('no em dash found in user-facing text');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) assertNoEmDash();
