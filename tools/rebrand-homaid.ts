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
  const WORD_BOUNDARY = (s: string) => new RegExp(`\\b${s}\\b`, "g");
  const replacements: Array<[RegExp, string]> = [
    [WORD_BOUNDARY("HANDI"), "HOMAID"],
    [WORD_BOUNDARY("Handi"), "Homaid"],
    [WORD_BOUNDARY("handi"), "homaid"],
  ];
  let result = content;
  for (const [re, rep] of replacements) {
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

function applyTextChanges(reports: TextReport[]) {
  for (const r of reports) {
    const before = fs.readFileSync(r.file, "utf8");
    const after = replaceTextContent(before);
    if (before !== after) {
      fs.writeFileSync(r.file, after, "utf8");
    }
  }
}

function lowerCaseReplaceHandi(name: string): string {
  // Replace any case variant of 'handi' with 'homaid'
  return name.replace(/handi/gi, "homaid");
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
      const newBase = lowerCaseReplaceHandi(base);
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
      const newBase = lowerCaseReplaceHandi(base);
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
  // Apply directory renames first (already ordered deepest-first in planning)
  const dirRenames = renames.filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isDirectory());
  const fileRenames = renames.filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isFile());

  for (const r of dirRenames) {
    fs.renameSync(r.from, r.to);
  }
  for (const r of fileRenames) {
    fs.renameSync(r.from, r.to);
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

  const filesInScope = files.filter((f) => {
    const parts = f.split(path.sep);
    if (parts.some((p) => shouldSkipDir(p))) return false;
    return true;
  });

  // TEXT REPLACEMENTS
  if (!opts.renameOnly) {
    const textFiles = filesInScope.filter((f) => isTextFile(f) && !isBinaryFile(f));
    const { textReports: textPlan, changes } = planTextChangesWithCounts(textFiles);
    if (dryRun) {
      console.log(`# Dry-run: Text replacements`);
      console.log(`Files to change: ${textPlan.length}`);
      for (const r of textPlan) {
        const c = changes.find((x) => x.file === r.file);
        const occ = c ? `, occ ${c.before} -> ${c.after}` : "";
        console.log(` - ${path.relative(root, r.file)} (+${r.changedLines} lines${occ})`);
      }
    } else {
      applyTextChanges(textPlan);
      console.log(`# Applied text replacements to ${textPlan.length} files.`);
    }
  }

  // RENAMES (dirs then files)
  if (!opts.textOnly) {
    const renamePlan = planRenames(
      filesInScope,
      dirs.filter((d) => {
        const parts = d.split(path.sep);
        return !parts.some((p) => shouldSkipDir(p));
      }),
    );

    if (dryRun) {
      console.log(`\n# Dry-run: Renames`);
      const dirPlans = renamePlan.filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isDirectory());
      const filePlans = renamePlan.filter(r => fs.existsSync(r.from) && fs.lstatSync(r.from).isFile());
      console.log(`Directories to rename: ${dirPlans.length}`);
      for (const r of dirPlans) {
        console.log(` - ${path.relative(root, r.from)} -> ${path.relative(root, r.to)}${r.collided ? " (collision: -old)" : ""}`);
      }
      console.log(`Files to rename: ${filePlans.length}`);
      for (const r of filePlans) {
        console.log(` - ${path.relative(root, r.from)} -> ${path.relative(root, r.to)}${r.collided ? " (collision: -old)" : ""}`);
      }
    } else {
      applyRenames(renamePlan);
      console.log(`# Applied ${renamePlan.length} renames.`);
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
