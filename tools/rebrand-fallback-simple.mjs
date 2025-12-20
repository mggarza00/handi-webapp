#!/usr/bin/env node
/*
  Simple fallback rebrand replacer (no path/ID guards)
  Reads files from env var FILES (newline-separated) and applies global replacements:
    HANDI->HANDI, Handi->Handi, handi->handi
    HANDEE->HANDI, Handee->Handi, handee->handi

  NOTE: Prefer tools/rebrand-to-handi.mjs for safe replacements that avoid domains/IDs.
*/
import fs from 'node:fs';

const filesEnv = process.env.FILES || '';
if (!filesEnv.trim()) {
  console.error('FILES env var is empty. Provide a newline-separated list.');
  process.exit(2);
}

const files = filesEnv.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const pairs = [
  [/HANDI/g, 'HANDI'],
  [/Handi/g, 'Handi'],
  [/handi/g, 'handi'],
  [/HANDEE/g, 'HANDI'],
  [/Handee/g, 'Handi'],
  [/handee/g, 'handi'],
];

let changed = 0;
for (const f of files) {
  try {
    const t = fs.readFileSync(f, 'utf8');
    let u = t;
    for (const [re, to] of pairs) u = u.replace(re, to);
    if (u !== t) {
      fs.writeFileSync(f, u, 'utf8');
      changed++;
    }
  } catch {}
}

console.log(`Replaced branding in ${changed} files.`);
