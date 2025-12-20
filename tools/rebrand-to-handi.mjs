#!/usr/bin/env node
/*
  tools/rebrand-to-handi.mjs
  Safe, case-aware rebrand:
  - HANDI -> HANDI
  - Handi -> Handi
  - handi -> handi
  - HANDI -> HANDI
  - Handi -> Handi
  - handi -> handi

  Guardrails:
  - Only operates on allowed content extensions
  - Skips matches adjoining '-', '_', '/', '@', '.' to avoid paths, IDs, domains, emails
  - Keeps existing asset paths (Logo-Handi-*.gif, favicon-handi.gif, etc.)
  Usage:
    node tools/rebrand-to-handi.mjs [.tmp/rebrand_hits.pre.txt]
*/
import fs from 'node:fs';
import path from 'node:path';

const allowedExt = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.mdx', '.txt', '.html', '.htm', '.svg',
  '.css', '.scss', '.sass', '.less',
  '.yml', '.yaml', '.sql', '.mts', '.cts'
]);

const patterns = [
  { re: /(?<![\-_/@.])\bHANDI\b(?![\-_/@.])/g, to: 'HANDI' },
  { re: /(?<![\-_/@.])\bHandi\b(?![\-_/@.])/g, to: 'Handi' },
  { re: /(?<![\-_/@.])\bhandi\b(?![\-_/@.])/g, to: 'handi' },
  { re: /(?<![\-_/@.])\bHANDEE\b(?![\-_/@.])/g, to: 'HANDI' },
  { re: /(?<![\-_/@.])\bHandee\b(?![\-_/@.])/g, to: 'Handi' },
  { re: /(?<![\-_/@.])\bhandee\b(?![\-_/@.])/g, to: 'handi' },
];

function shouldProcess(file) {
  const ext = path.extname(file);
  return allowedExt.has(ext);
}

function rebrand(content) {
  let out = content;
  for (const { re, to } of patterns) {
    out = out.replace(re, to);
  }
  return out;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

const inputList = process.argv[2] || path.join('.tmp', 'rebrand_hits.pre.txt');
if (!fs.existsSync(inputList)) {
  console.error(`Input list not found: ${inputList}`);
  process.exit(2);
}

const files = uniq(
  fs
    .readFileSync(inputList, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
);

let changed = 0;
let touched = [];
for (const f of files) {
  if (!shouldProcess(f)) continue;
  let before;
  try {
    before = fs.readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const after = rebrand(before);
  if (after !== before) {
    fs.writeFileSync(f, after, 'utf8');
    changed++;
    touched.push(f);
  }
}

if (!fs.existsSync('.tmp')) fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync(path.join('.tmp', 'rebrand_hits.post.txt'), touched.join('\n'), 'utf8');

console.log(`Rebrand complete. Changed files: ${changed}`);
if (touched.length) {
  console.log('Wrote .tmp/rebrand_hits.post.txt');
}
