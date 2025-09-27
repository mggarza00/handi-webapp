#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) out.push(...walk(join(dir, name.name)));
    else if (/\.(ts|tsx)$/i.test(name.name)) out.push(join(dir, name.name));
  }
  return out;
}

const root = join(process.cwd(), 'app', 'api', 'messages');
let bad = 0;
const td = new TextDecoder('utf-8', { fatal: true });
for (const file of walk(root)) {
  const buf = readFileSync(file);
  // BOM
  const hasBOM = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const hasNUL = buf.includes(0x00);
  try {
    td.decode(buf);
  } catch {
    console.error(`[utf8] invalid UTF-8: ${file}`);
    bad++;
    continue;
  }
  if (hasBOM) {
    console.error(`[utf8] BOM detected: ${file}`);
    bad++;
  }
  if (hasNUL) {
    console.error(`[utf8] NUL byte detected: ${file}`);
    bad++;
  }
}
if (bad) {
  console.error(`\nFound ${bad} UTF-8 issues.`);
  process.exit(1);
} else {
  console.log('UTF-8 OK');
}

