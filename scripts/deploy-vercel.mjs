#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const projectJsonPath = path.join(root, '.vercel', 'project.json');

function fail(msg) {
  console.error(`\n[deploy-vercel] ERROR: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (res.status !== 0) {
    fail(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
  }
  return res;
}

function runCapture(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'pipe', shell: true, encoding: 'utf8', ...opts });
  if (res.status !== 0) {
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    fail(`${cmd} ${args.join(' ')} failed with code ${res.status}`);
  }
  return res.stdout || '';
}

async function main() {
  const token = process.env.VERCEL_TOKEN || '';

  if (!existsSync(projectJsonPath)) {
    fail('Missing .vercel/project.json (project not linked). Run "npx vercel link" once locally and commit the link file, or provide --project and --scope flags.');
  }

  let projectMeta = {};
  try {
    projectMeta = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
  } catch {}
  const orgId = projectMeta?.orgId;
  const projectName = projectMeta?.projectName || 'handi-webapp';

  const domain = process.env.DEPLOY_DOMAIN || 'handi.mx';
  const skipBuild = process.env.SKIP_BUILD === '1' || process.env.VERCEL_PREBUILT === '1';

  console.log(`\n[deploy-vercel] Project: ${projectName} (${orgId || 'no-scope'})`);
  console.log(`[deploy-vercel] Domain target: ${domain}`);

  if (!skipBuild) {
    console.log('\n[deploy-vercel] Installing deps (npm ci) ...');
    run('npm', ['ci']);

    console.log('\n[deploy-vercel] Building (npm run build) ...');
    run('npm', ['run', 'build']);
  } else {
    console.log('\n[deploy-vercel] Skipping local build (using --prebuilt).');
  }

  // Ensure envs are pulled locally (no-op if already present)
  console.log('\n[deploy-vercel] Syncing env (vercel pull --environment=production) ...');
  {
    const args = ['-y', 'vercel@latest', 'pull', '--yes', '--environment=production'];
    if (token) args.push(`--token=${token}`);
    run('npx', args);
  }

  // Deploy production, prefer prebuilt if we just built locally
  const deployArgs = ['-y', 'vercel@latest', 'deploy', '--prod', '--yes'];
  if (!skipBuild) {
    deployArgs.splice(3, 0, '--prebuilt');
  }
  if (orgId) {
    deployArgs.push(`--scope=${orgId}`);
  }
  if (token) {
    deployArgs.push(`--token=${token}`);
  }

  console.log('\n[deploy-vercel] Deploying to production ...');
  const out = runCapture('npx', deployArgs);
  const urlMatch = [...out.matchAll(/https?:\/\/[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,63}\b[^\s)\]]*/g)].map(m => m[0]);
  const deployUrl = urlMatch[urlMatch.length - 1] || '';
  if (!deployUrl) {
    console.log(out);
    fail('Could not detect deployment URL from Vercel output.');
  }
  console.log(`[deploy-vercel] Deployed: ${deployUrl}`);

  // Try to alias to the domain
  if (process.env.SKIP_ALIAS === '1') {
    console.log('[deploy-vercel] SKIP_ALIAS=1 set; not updating domain alias.');
    console.log(`[deploy-vercel] You can run: npx vercel alias set ${deployUrl} ${domain} --token=${token}`);
    return;
  }

  console.log(`\n[deploy-vercel] Assigning alias ${domain} -> ${deployUrl} ...`);
  const aliasArgs = ['-y', 'vercel@latest', 'alias', 'set', deployUrl, domain];
  if (orgId) aliasArgs.push(`--scope=${orgId}`);
  if (token) aliasArgs.push(`--token=${token}`);
  try {
    run('npx', aliasArgs);
  } catch (e) {
    console.error('\n[deploy-vercel] Alias failed. Ensure the domain is added to the project.');
    console.error(`Try: npx vercel domains add ${domain}${orgId ? ` --scope=${orgId}` : ''}${token ? ` --token=${token}` : ''}`);
    throw e;
  }

  console.log('\n[deploy-vercel] ✅ Production updated.');
  console.log(`[deploy-vercel] Live URL: https://${domain}`);
}

main().catch((err) => fail(err?.message || String(err)));
