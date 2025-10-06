// tools/rebrand-homaid.ts
import fs from "node:fs";
import path from "node:path";

type RunOptions = {
  dryRun: boolean;
  textOnly?: boolean;
  renameOnly?: boolean;
};

type Change = {
  file: string;
  before: number;
  after: number;
};

const EXCLUDE_DIRS = new Set<string>([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".vercel",
  "coverage",
  "playwright-report",
]);

const BINARY_EXTS = new Set<string>([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".ico",
  ".mp4",
  ".mov",
  ".zip",
]);

const TEXT_EXTS = new Set<string>([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".mdx",
  ".json",
  ".yml",
  ".yaml",
  ".env",
  ".css",
  ".scss",
  ".sass",
  ".mjs",
  ".cjs",
]);

const SELF_PATHS = new Set<string>([
  path.join("tools", "rebrand-homaid.ts").replace(/\\/g, "/"),
  path.join("tools", "rebrand-homaid-old.ts").replace(/\\/g, "/"),
]);

function isEnvFile(filePath: string) {
  const base = path.basename(filePath);
  return base === ".env" || base.startsWith(".env.");
}

function isTextFile(p: string) {
  return isEnvFile(p) || TEXT_EXTS.has(path.extname(p).toLowerCase());
}

function isBinaryFile(p: string) {
  return BINARY_EXTS.has(path.extname(p));
}

function shouldSkipDir(dir: string) {
  const base = path.basename(dir);
  return EXCLUDE_DIRS.has(base);
}

function normalizeRel(p: string) {
  return path.relative(process.cwd(), p).replace(/\\/g, "/");
}

function getReplacements(): Array<[RegExp, string]> {
  const WORD_BOUNDARY = (s: string) => new RegExp(`\\b${s}\\b`, "g");
  return [
    [WORD_BOUNDARY("HANDI"), "HOMAID"],
    [WORD_BOUNDARY("Handi"), "Homaid"],
    [WORD_BOUNDARY("handi"), "homaid"],
  ];
}

function walk(
  dir: string,
  files: string[] = [],
  dirs: string[] = [],
): string[] {
  if (shouldSkipDir(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(p)) continue;
      dirs.push(p);
      walk(p, files, dirs);
    } else {
      if (entry.isFile()) files.push(p);
    }
  }
  return files;
}

function replaceTextContent(content: string) {
  // Order-sensitive, word-safe replacements
  let result = content;
  for (const [re, rep] of getReplacements()) {
    result = result.replace(re, rep);
  }
  return result;
}

function countOccurrences(content: string): number {
  const WORD_BOUNDARY = (s: string) => new RegExp(`\\b${s}\\b`, "g");
  const regs = [
    WORD_BOUNDARY("HANDI"),
    WORD_BOUNDARY("Handi"),
    WORD_BOUNDARY("handi"),
  ];
  let total = 0;
  for (const re of regs) {
    const m = content.match(re);
    total += m ? m.length : 0;
  }
  return total;
}

function countChangedLines(before: string, after: string): number {
  if (before === after) return 0;
  const b = before.split(/\r?\n/);
  const a = after.split(/\r?\n/);
  const len = Math.max(b.length, a.length);
  let changed = 0;
  for (let i = 0; i < len; i++) {
    if (b[i] !== a[i]) changed++;
  }
  return changed;
}

type TextReport = {
  file: string;
  changedLines: number;
};

type RenameReport = {
  from: string;
  to: string;
  collided: boolean;
};

type FileChangeResult = {
  file: string;
  changed: boolean;
  changedLines: number;
  before: number;
  after: number;
};

function planTextChangesWithCounts(files: string[]): { textReports: TextReport[]; changes: Change[] } {
  const textReports: TextReport[] = [];
  const changes: Change[] = [];
  for (const f of files) {
    const rel = normalizeRel(f);
    if (!isTextFile(f)) continue;
    if (SELF_PATHS.has(rel)) continue; // don't rewrite the script itself
    const content = fs.readFileSync(f, "utf8");
    const beforeCount = countOccurrences(content);
    const replaced = replaceTextContent(content);
    if (replaced !== content) {
      const changedLines = countChangedLines(content, replaced);
      if (changedLines > 0) {
        textReports.push({ file: f, changedLines });
        const afterCount = countOccurrences(replaced);
        changes.push({ file: f, before: beforeCount, after: afterCount });
      }
    }
  }
  return { textReports, changes };
}

function applyTextChanges(reports: TextReport[]): FileChangeResult[] {
  const results: FileChangeResult[] = [];
  for (const r of reports) {
    results.push(replaceInTextFile(r.file));
  }
  return results;
}

function replaceInTextFile(file: string): FileChangeResult {
  const src = fs.readFileSync(file, "utf8");
  let out = src;
  let hitsBefore = 0;
  for (const [rx, to] of getReplacements()) {
    const matches = out.match(rx);
    if (matches) hitsBefore += matches.length;
    out = out.replace(rx, to);
  }
  if (out !== src) {
    const changedLines = countChangedLines(src, out);
    fs.writeFileSync(file, out, "utf8");
    const hitsAfter = hitsBefore; // number of replacements equals total matches seen
    return { file, changed: true, changedLines, before: hitsBefore, after: hitsAfter };
  }
  return { file, changed: false, changedLines: 0, before: hitsBefore, after: hitsBefore };
}

function replaceHandiPreserveCase(s: string): string {
  return s.replace(/handi/gi, (m) => {
    if (m === m.toUpperCase()) return "HOMAID"; // HANDI
    if (m === m.toLowerCase()) return "homaid"; // handi
    // Title-case or mixed: prefer Title Case mapping
    const isTitle = m[0] === m[0].toUpperCase() && m.slice(1) === m.slice(1).toLowerCase();
    return isTitle ? "Homaid" : "homaid";
  });
}

function planRenames(files: string[], dirs: string[]): RenameReport[] {
  const renames: RenameReport[] = [];

  // Directories: deepest first to avoid path conflicts
  const sortedDirs = [...dirs].sort((a, b) => b.length - a.length);
  for (const d of sortedDirs) {
    const base = path.basename(d);
    const rel = normalizeRel(d);
    if (SELF_PATHS.has(rel)) continue; // never rename the script directory file
    if (/handi/i.test(base)) {
      const newBase = replaceHandiPreserveCase(base);
      const to = path.join(path.dirname(d), newBase);
      let finalTo = to;
      let collided = false;
      if (fs.existsSync(finalTo)) {
        // If destination equals source (no-op), skip
        if (path.resolve(finalTo) === path.resolve(d)) continue;
        collided = true;
        finalTo = ensureNoCollision(finalTo);
      }
      renames.push({ from: d, to: finalTo, collided });
    }
  }

  // Files: include all files (including images) — but we do NOT edit binary contents.
  for (const f of files) {
    const base = path.basename(f);
    const rel = normalizeRel(f);
    if (SELF_PATHS.has(rel)) continue; // never rename the script file(s)
    if (/handi/i.test(base)) {
      const newBase = replaceHandiPreserveCase(base);
      const to = path.join(path.dirname(f), newBase);
      let finalTo = to;
      let collided = false;
      if (fs.existsSync(finalTo)) {
        if (path.resolve(finalTo) === path.resolve(f)) continue;
        collided = true;
        finalTo = ensureNoCollision(finalTo);
      }
      renames.push({ from: f, to: finalTo, collided });
    }
  }

  return renames;
}

function ensureNoCollision(dest: string): string {
  const dir = path.dirname(dest);
  const base = path.basename(dest);
  const ext = path.extname(base);
  const name = base.slice(0, base.length - ext.length);
  let i = 0;
  let candidate = path.join(dir, `${name}-old${ext}`);
  while (fs.existsSync(candidate)) {
    i++;
    candidate = path.join(dir, `${name}-old-${i}${ext}`);
  }
  return candidate;
}

function applyRenames(renames: RenameReport[]) {
  // Apply files first (deepest paths first), then directories (deepest first)
  const fileRenames = renames
    .filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isFile())
    .sort((a, b) => b.from.length - a.from.length);
  const dirRenames = renames
    .filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isDirectory())
    .sort((a, b) => b.from.length - a.from.length);

  for (const { from, to } of fileRenames) {
    const dirTo = path.dirname(to);
    try { fs.mkdirSync(dirTo, { recursive: true }); } catch {}
    if (fs.existsSync(to) && path.resolve(to) !== path.resolve(from)) {
      const alt = ensureNoCollision(to);
      fs.renameSync(from, alt);
      console.warn(`Collision: ${to} exists. Renamed ${from} -> ${alt}`);
    } else {
      fs.renameSync(from, to);
      console.log(`Renamed: ${from} -> ${to}`);
    }
  }
  for (const { from, to } of dirRenames) {
    const dirTo = path.dirname(to);
    try { fs.mkdirSync(dirTo, { recursive: true }); } catch {}
    if (fs.existsSync(to) && path.resolve(to) !== path.resolve(from)) {
      const alt = ensureNoCollision(to);
      fs.renameSync(from, alt);
      console.warn(`Collision: ${to} exists. Renamed ${from} -> ${alt}`);
    } else {
      fs.renameSync(from, to);
      console.log(`Renamed: ${from} -> ${to}`);
    }
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const textOnly = args.has("--text-only");
  const renameOnly = args.has("--rename-only");
  const opts: RunOptions = { dryRun, textOnly, renameOnly };

  const root = process.cwd();
  const files: string[] = [];
  const dirs: string[] = [];
  walk(root, files, dirs);
  const all = files; // convenience alias

  const filesInScope = all.filter((f) => {
    const parts = f.split(path.sep);
    if (parts.some((p) => shouldSkipDir(p))) return false;
    return true;
  });

  // TEXT REPLACEMENTS
  if (!opts.renameOnly) {
    // First, text replacements
    const textPlan: TextReport[] = [];
    const changes: Change[] = [];
    for (const file of all) {
      if (!isTextFile(file) || isBinaryFile(file)) continue;
      const rel = normalizeRel(file);
      if (SELF_PATHS.has(rel)) continue;
      const src = fs.readFileSync(file, "utf8");
      const before = countOccurrences(src);
      const out = replaceTextContent(src);
      if (out !== src) {
        const changedLines = countChangedLines(src, out);
        textPlan.push({ file, changedLines });
        const after = countOccurrences(out);
        changes.push({ file, before, after });
      }
    }
    if (dryRun) {
      console.log(`# Dry-run: Text replacements`);
      console.log(`Files to change: ${textPlan.length}`);
      let totalLines = 0;
      let totalOccBefore = 0;
      let totalOccAfter = 0;
      for (const r of textPlan) {
        const c = changes.find((x) => x.file === r.file);
        const occ = c ? `, occ ${c.before} -> ${c.after}` : "";
        console.log(` - ${path.relative(root, r.file)} (+${r.changedLines} lines${occ})`);
        totalLines += r.changedLines;
        if (c) { totalOccBefore += c.before; totalOccAfter += c.after; }
      }
      console.log(`Total lines changed: +${totalLines}`);
      console.log(`Total occurrences: ${totalOccBefore} -> ${totalOccAfter}`);
    } else {
      // Apply replacements directly per your style
      const results: FileChangeResult[] = [];
      for (const file of all) {
        if (!isTextFile(file) || isBinaryFile(file)) continue;
        const rel = normalizeRel(file);
        if (SELF_PATHS.has(rel)) continue;
        const res = replaceInTextFile(file);
        if (res.changed) results.push(res);
      }
      const totalLines = results.reduce((s, r) => s + (r.changed ? r.changedLines : 0), 0);
      const totalOcc = results.reduce((s, r) => s + (r.changed ? r.before : 0), 0);
      console.log(`# Applied text replacements to ${results.length} files.`);
      console.log(`# Total: +${totalLines} lines, ${totalOcc} replacements`);
      // Report
      const changed = results;
      if (changed.length) {
        console.log(`\nChanged ${changed.length} files:`);
        for (const c of changed) {
          console.log(` - ${c.file} (${c.after} replacements)`);
        }
      }
    }
  }

  // RENAMES (dirs then files)
  if (!opts.textOnly) {
    // Extra scan pass (skip binaries) to plan file-level renames in the requested style
    const scanPairs: Array<{ from: string; to: string }> = [];
    for (const file of all) {
      if (isBinaryFile(file)) continue; // skip binaries here; planRenames handles them if needed
      const base = path.basename(file);
      if (/handi/i.test(base)) {
        const newBase = replaceHandiPreserveCase(base);
        let to = path.join(path.dirname(file), newBase);
        if (fs.existsSync(to) && path.resolve(to) !== path.resolve(file)) {
          to = ensureNoCollision(to);
        }
        if (path.resolve(to) !== path.resolve(file)) {
          scanPairs.push({ from: file, to });
        }
      }
    }

    let renamePlan = planRenames(
      filesInScope,
      dirs.filter((d) => {
        const parts = d.split(path.sep);
        return !parts.some((p) => shouldSkipDir(p));
      }),
    );
    // Merge with scanPairs, dedupe by `from`
    const seen = new Set(renamePlan.map((r) => path.resolve(r.from)));
    for (const p of scanPairs) {
      const key = path.resolve(p.from);
      if (!seen.has(key)) {
        renamePlan.push({ from: p.from, to: p.to, collided: fs.existsSync(p.to) });
        seen.add(key);
      }
    }
    const planPairs: Array<{ from: string; to: string }> = renamePlan.map((r) => ({ from: r.from, to: r.to }));

    if (dryRun) {
      console.log(`\n# Dry-run: Renames`);
      const filePlans = renamePlan
        .filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isFile())
        .sort((a, b) => b.from.length - a.from.length);
      const dirPlans = renamePlan
        .filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isDirectory())
        .sort((a, b) => b.from.length - a.from.length);
      console.log(`Files to rename: ${filePlans.length}`);
      for (const { from, to, collided } of filePlans) {
        console.log(` - ${path.relative(root, from)} -> ${path.relative(root, to)}${collided ? " (collision: -old)" : ""}`);
      }
      console.log(`Directories to rename: ${dirPlans.length}`);
      for (const { from, to, collided } of dirPlans) {
        console.log(` - ${path.relative(root, from)} -> ${path.relative(root, to)}${collided ? " (collision: -old)" : ""}`);
      }
    } else {
      applyRenames(renamePlan);
      const filesApplied = renamePlan.filter(r => fs.existsSync(path.dirname(r.to)) && !fs.existsSync(r.from) && path.extname(r.from) !== '').length;
      const dirsApplied = renamePlan.length - filesApplied;
      console.log(`# Applied ${renamePlan.length} renames (${filesApplied} files + ${dirsApplied} directories).`);
    }
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
