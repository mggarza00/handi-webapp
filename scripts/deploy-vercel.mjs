#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const projectJsonPath = path.join(root, ".vercel", "project.json");
const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);
const withInstall = hasFlag("--with-install");
const prodFlag = hasFlag("--prod");
const previewFlag = hasFlag("--preview");

if (prodFlag && previewFlag) {
  console.error("[deploy-vercel] ERROR: Use either --prod or --preview, not both.");
  process.exit(1);
}

const deployMode = prodFlag ? "prod" : previewFlag ? "preview" : "prod";
const token = process.env.VERCEL_TOKEN || "";
const domain = process.env.DEPLOY_DOMAIN || "handi.mx";
const skipBuild = process.env.SKIP_BUILD === "1" || process.env.VERCEL_PREBUILT === "1";
const skipAlias = process.env.SKIP_ALIAS === "1";

const log = (msg = "") => console.log(`[deploy-vercel] ${msg}`);
const warn = (msg = "") => console.warn(`[deploy-vercel] WARNING: ${msg}`);
const fail = (msg = "", error = null) => {
  console.error(`[deploy-vercel] ERROR: ${msg}`);
  if (error) console.error(error.message || error);
  process.exitCode = 1;
  throw error || new Error(msg);
};

function run(command, commandArgs = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    if (options.capture) {
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`${command} ${commandArgs.join(" ")} failed with code ${code}\n${stderr}`));
        } else {
          resolve(stdout.trim());
        }
      });
    } else {
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`${command} ${commandArgs.join(" ")} failed with code ${code}`));
        } else {
          resolve();
        }
      });
    }

    child.on("error", (error) => {
      reject(error);
    });
  });
}

function runSync(command, commandArgs = []) {
  return spawnSync(command, commandArgs, {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

function readProjectMeta() {
  if (!existsSync(projectJsonPath)) {
    fail("Missing .vercel/project.json. Run 'npx vercel link' first.");
  }
  try {
    return JSON.parse(readFileSync(projectJsonPath, "utf8"));
  } catch (error) {
    fail(`Unable to parse ${projectJsonPath}`, error);
  }
}

function detectPackageManager() {
  const envPreference = (process.env.PACKAGE_MANAGER || "").trim();
  const candidates = [envPreference, "pnpm", "npm", "yarn"].filter(Boolean);

  const lockHints = [
    { manager: "pnpm", lock: "pnpm-lock.yaml" },
    { manager: "npm", lock: "package-lock.json" },
    { manager: "yarn", lock: "yarn.lock" },
  ];

  if (!envPreference) {
    for (const hint of lockHints) {
      if (existsSync(path.join(root, hint.lock))) {
        candidates.unshift(hint.manager);
        break;
      }
    }
  }

  for (const manager of candidates) {
    if (!manager) continue;
    const result = runSync(manager, ["--version"]);
    if (result.status === 0) return manager;
  }

  return "pnpm";
}

function getPmCommands(pm) {
  if (pm === "pnpm") {
    return {
      install: ["install", "--no-frozen-lockfile"],
      runScript: (script) => ["run", script],
    };
  }
  if (pm === "yarn") {
    return {
      install: ["install", "--check-files"],
      runScript: (script) => [script],
    };
  }
  return {
    install: ["install", "--no-audit", "--no-fund"],
    runScript: (script) => ["run", script],
  };
}

function extractDeploymentUrl(output) {
  const matches = [...output.matchAll(/https?:\/\/[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,63}\b[^\s)\]]*/g)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

function isPermError(error) {
  const text = `${error?.message || ""}`.toUpperCase();
  return text.includes("EPERM");
}

async function installDependencies(pm, commands) {
  if (!withInstall) {
    log("--with-install not provided -> skipping dependency install");
    return;
  }

  log("Installing dependencies (non-destructive)...");
  try {
    await run(pm, commands.install);
    log("Dependencies ready");
  } catch (error) {
    if (isPermError(error)) {
      warn("Permission issue during install (EPERM). Continuing with existing node_modules.");
    } else {
      fail("Dependency installation failed", error);
    }
  }
}

async function buildProject(pm, commands) {
  if (skipBuild) {
    log("Skipping local build (prebuilt artifacts).");
    return;
  }

  log("Building app...");
  try {
    await run(pm, commands.runScript("build"));
    log("Build OK");
  } catch (error) {
    fail("Build failed", error);
  }
}

async function pullEnvironment(environment) {
  log(`Pulling env vars for ${environment}...`);
  const pullArgs = ["-y", "vercel@latest", "pull", "--yes", `--environment=${environment}`];
  if (token) pullArgs.push(`--token=${token}`);
  await run("npx", pullArgs);
}

async function deploy(environment, orgId) {
  const deployArgs = ["-y", "vercel@latest", "deploy", "--yes"];
  if (environment === "prod") deployArgs.push("--prod");
  if (!skipBuild) deployArgs.splice(3, 0, "--prebuilt");
  if (orgId) deployArgs.push(`--scope=${orgId}`);
  if (token) deployArgs.push(`--token=${token}`);

  log(`Deploying to Vercel (${environment})...`);
  const output = await run("npx", deployArgs, { capture: true });
  const deployUrl = extractDeploymentUrl(output || "");
  if (!deployUrl) {
    console.log(output);
    fail("Could not determine deployment URL from Vercel output.");
  }
  log(`Deploy complete: ${deployUrl}`);
  return deployUrl;
}

async function setAlias(deployUrl, orgId) {
  if (skipAlias) {
    log("SKIP_ALIAS=1 set -> alias not updated.");
    log(`Preview/Prod URL: ${deployUrl}`);
    return;
  }

  const aliasArgs = ["-y", "vercel@latest", "alias", "set", deployUrl, domain];
  if (orgId) aliasArgs.push(`--scope=${orgId}`);
  if (token) aliasArgs.push(`--token=${token}`);

  log(`Assigning alias ${domain} -> ${deployUrl} ...`);
  try {
    await run("npx", aliasArgs);
    log("Alias updated");
  } catch (error) {
    warn("Failed to update alias. Ensure the domain exists in the project.");
    warn(`Run manually: npx vercel alias set ${deployUrl} ${domain}`);
    fail("Alias assignment failed", error);
  }
}

async function main() {
  try {
    const projectMeta = readProjectMeta();
    const orgId = projectMeta?.orgId || "";
    const projectName = projectMeta?.projectName || "handi-webapp";

    const packageManager = detectPackageManager();
    const pmCommands = getPmCommands(packageManager);

    log(`Project: ${projectName} (${orgId || "no-scope"})`);
    log(`Mode: ${deployMode}`);
    log(`Domain: ${domain}`);
    log(`Package manager: ${packageManager}`);

    await installDependencies(packageManager, pmCommands);
    await buildProject(packageManager, pmCommands);

    const envTarget = deployMode === "prod" ? "production" : "preview";
    await pullEnvironment(envTarget);

    const deployUrl = await deploy(deployMode === "prod" ? "prod" : "preview", orgId);

    if (deployMode === "prod") {
      await setAlias(deployUrl, orgId);
      log("Production deployment complete.");
      log(`Live URL: https://${domain}`);
    } else {
      log("Preview deployment complete.");
      log(`Preview URL: ${deployUrl}`);
    }
  } catch (error) {
    fail(error.message || String(error));
  }
}

main();
