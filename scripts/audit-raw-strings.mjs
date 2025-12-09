#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const roots = ['app', 'pages', 'components', 'src'];
const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // ignore missing dirs
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function isLikelyClient(content) {
  // Look for 'use client' directive within first ~10 lines
  const head = content.split(/\r?\n/, 10).join('\n');
  return /(^|\n)\s*['\"]use client['\"];?/.test(head);
}

const patterns = [
  { key: '?raw', regex: /\?raw\b/ },
  { key: 'raw-loader', regex: /raw-loader/ },
  { key: 'asset/source', regex: /asset\/source/ },
  { key: 'readFileSync(.., utf8)', regex: /readFileSync\s*\([^)]*(?:['\"])utf-?8(?:['\"]).*\)/i },
];

async function main() {
  const cwd = process.cwd();
  const findings = [];
  for (const r of roots) {
    const abs = path.join(cwd, r);
    for await (const file of walk(abs)) {
      const ext = path.extname(file).toLowerCase();
      if (!codeExts.has(ext)) continue;
      const raw = await fs.readFile(file, 'utf8');
      const client = isLikelyClient(raw);
      const lines = raw.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const p of patterns) {
          if (p.regex.test(line)) {
            findings.push({
              file: path.relative(cwd, file),
              line: i + 1,
              key: p.key,
              client,
              snippet: line.trim().slice(0, 200),
            });
          }
        }
      }
    }
  }
  if (!findings.length) {
    console.log('No raw/string-forcing patterns found in app/pages/components/src');
    return;
  }
  for (const f of findings) {
    const tag = f.client ? '[client]' : '[server/mixed]';
    console.log(`${tag} ${f.file}:${f.line} ${f.key} :: ${f.snippet}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

