#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const roots = ['app', 'pages', 'components', 'src'];
const exts = new Set(['.svg', '.txt', '.md', '.csv', '.geojson', '.json', '.yaml', '.yml']);
const threshold = 80 * 1024; // 80KB

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

async function main() {
  const cwd = process.cwd();
  const candidates = [];
  for (const r of roots) {
    const abs = path.join(cwd, r);
    for await (const file of walk(abs)) {
      const ext = path.extname(file).toLowerCase();
      if (!exts.has(ext)) continue;
      const stat = await fs.stat(file);
      if (stat.size > threshold) {
        candidates.push({ file: path.relative(cwd, file), size: stat.size });
      }
    }
  }
  if (!candidates.length) {
    console.log('No large assets (>80KB) found in app/pages/components/src for', [...exts].join(','));
    return;
  }
  candidates.sort((a, b) => b.size - a.size);
  console.log('Large assets (>80KB) that may inline as strings:');
  for (const { file, size } of candidates) {
    const kb = (size / 1024).toFixed(1).padStart(8, ' ');
    console.log(`${kb} KB\t${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

