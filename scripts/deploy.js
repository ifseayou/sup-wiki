#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const { readFileSync, rmSync } = require("fs");
const { resolve } = require("path");
const { spawnSync } = require("child_process");

const repoRoot = resolve(__dirname, "..");
const configPath = resolve(repoRoot, ".claude/deploy.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const service = config.services?.[0];
if (!service) {
  console.error("No service configured in .claude/deploy.json");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
// Archive mode is the default: the production server cannot reach GitHub
// reliably (git fetch times out), so we tar + scp from the local Mac instead.
// Pass --git to opt into server-side `git fetch` when the deploy host has a
// working route to the origin.
const archiveMode = !process.argv.includes("--git");
const migrationIndex = process.argv.indexOf("--migration");
const migrationFile = migrationIndex >= 0 ? process.argv[migrationIndex + 1] : "";
const remote = config.server.includes("@")
  ? config.server
  : `root@${config.server}`;

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  if (dryRun) return;

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const commit = capture("git", ["rev-parse", "--short", "HEAD"]);
const branch = config.branch || capture("git", ["branch", "--show-current"]) || "main";
const repoUrl = capture("git", ["remote", "get-url", "origin"]);
const archiveName = `sup-wiki-${commit}.tar`;
const localArchive = `/tmp/${archiveName}`;
const remoteArchive = `/tmp/${archiveName}`;
const remoteReleaseDir = `/tmp/sup-wiki-release-${commit}`;

const healthUrl = `http://127.0.0.1:${service.port}${service.healthPath || "/"}`;
const migrationCommand = migrationFile
  ? `node scripts/run-migration.js ${shellQuote(migrationFile)}`
  : "echo 'No database migration requested'";
const healthCommand = `ok=0; for i in 1 2 3 4 5 6; do status=$(curl -s -o /dev/null -w "%{http_code}" ${shellQuote(healthUrl)} || true); echo "Health ${healthUrl}: $status"; case "$status" in 2*|3*) ok=1; break ;; esac; sleep 3; done; test "$ok" = "1"`;

// Install deps only if package-lock.json hash changed (or node_modules missing).
// Persists the resolved hash to .deploy-lock-hash so subsequent deploys can skip.
// Wrapped in a sub-shell so the inner `;` separators don't mix with the outer
// `&& chain` formed by join(" && ").
const installCommand = `( hash_now=$(sha1sum package-lock.json | awk '{print $1}'); hash_old=$(cat .deploy-lock-hash 2>/dev/null || echo none); if [ "$hash_now" != "$hash_old" ] || [ ! -d node_modules ]; then echo "[deps] lockfile $hash_old -> $hash_now, running npm ci"; npm ci && echo "$hash_now" > .deploy-lock-hash; else echo "[deps] lockfile unchanged ($hash_now), skipping install"; fi )`;

// Clear stale build artefacts but preserve .next/cache (webpack incremental cache).
// Restoring this cache speeds repeat builds 5-10x. Wrapped in a sub-shell so the
// inner `|| true` is contained and doesn't swallow failures from earlier steps.
const cleanBuildCommand = `( test -d .next && find .next -mindepth 1 -maxdepth 1 ! -name cache -exec rm -rf {} + || true )`;

// Give Node a larger heap so Next.js builds don't thrash on the 3.4G server.
const buildCommand = `NODE_OPTIONS='--max-old-space-size=3072' ${config.buildCommand}`;

if (archiveMode) {
  run("tar", [
    "--exclude=.git",
    "--exclude=.env.local",
    "--exclude=.env",
    "--exclude=.next",
    "--exclude=node_modules",
    "--exclude=public/result-books",
    "-cf",
    localArchive,
    ".",
  ]);
  run("scp", [localArchive, `${remote}:${remoteArchive}`]);
}

const gitDeployCommand = [
  "set -e",
  `test -d ${shellQuote(`${config.deployPath}/.git`)}`,
  `cd ${shellQuote(config.deployPath)}`,
  `git fetch --depth=1 origin ${shellQuote(branch)}`,
  `git reset --hard origin/${branch}`,
  installCommand,
  migrationCommand,
  cleanBuildCommand,
  buildCommand,
  `${config.processManager} restart ${service.name}`,
  `${config.processManager} status ${service.name} --no-color`,
  healthCommand,
].join(" && ");

const archiveDeployCommand = [
  "set -e",
  `rm -rf ${shellQuote(remoteReleaseDir)}`,
  `mkdir -p ${shellQuote(remoteReleaseDir)} ${shellQuote(config.deployPath)}`,
  `tar -xf ${shellQuote(remoteArchive)} -C ${shellQuote(remoteReleaseDir)}`,
  `rsync -a --delete --exclude .env.local --exclude node_modules --exclude .next --exclude public/result-books ${shellQuote(`${remoteReleaseDir}/`)} ${shellQuote(`${config.deployPath}/`)}`,
  `cd ${config.deployPath}`,
  installCommand,
  migrationCommand,
  cleanBuildCommand,
  buildCommand,
  `${config.processManager} restart ${service.name}`,
  `${config.processManager} status ${service.name} --no-color`,
  healthCommand,
  `rm -rf ${shellQuote(remoteArchive)} ${shellQuote(remoteReleaseDir)}`,
].join(" && ");

run("ssh", [remote, archiveMode ? archiveDeployCommand : gitDeployCommand]);

if (!dryRun && archiveMode) {
  rmSync(localArchive, { force: true });
}

console.log(
  dryRun
    ? "\nDry run completed."
    : `\nDeploy completed: ${service.name} -> ${remote}:${config.deployPath} @ ${commit} (${archiveMode ? "archive" : "git"})`
);
