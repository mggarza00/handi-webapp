#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...walk(join(dir, ent.name)));
    else if (/\.(ts|tsx)$/i.test(ent.name)) out.push(join(dir, ent.name));
  }
  return out;
}

const root = join(process.cwd(), 'app', 'api', 'messages');
const td = new TextDecoder('utf-8');
const te = new TextEncoder();

for (const file of walk(root)) {
  const buf = readFileSync(file);
  // Strip BOM
  let start = 0;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) start = 3;
  // Decode (replace invalid sequences), normalize EOL to LF
  let text = td.decode(buf.subarray(start));
  text = text.replace(/\r\n?/g, '\n');
  // Remove stray NULs
  text = text.replace(/\u0000+/g, '');
  writeFileSync(file, te.encode(text));
  console.log(`[utf8] normalized ${file}`);
}

