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
const archiveName = `sup-wiki-${commit}.tar`;
const localArchive = `/tmp/${archiveName}`;
const remoteArchive = `/tmp/${archiveName}`;
const remoteReleaseDir = `/tmp/sup-wiki-release-${commit}`;

const healthUrl = `http://127.0.0.1:${service.port}${service.healthPath || "/"}`;
const migrationCommand = migrationFile
  ? `node scripts/run-migration.js ${shellQuote(migrationFile)}`
  : "echo 'No database migration requested'";
const healthCommand = `ok=0; for i in 1 2 3 4 5 6; do status=$(curl -s -o /dev/null -w "%{http_code}" ${shellQuote(healthUrl)} || true); echo "Health ${healthUrl}: $status"; case "$status" in 2*|3*) ok=1; break ;; esac; sleep 3; done; test "$ok" = "1"`;

run("git", ["archive", "HEAD", "-o", localArchive]);
run("scp", [localArchive, `${remote}:${remoteArchive}`]);

const remoteCommand = [
  "set -e",
  `rm -rf ${shellQuote(remoteReleaseDir)}`,
  `mkdir -p ${shellQuote(remoteReleaseDir)} ${shellQuote(config.deployPath)}`,
  `tar -xf ${shellQuote(remoteArchive)} -C ${shellQuote(remoteReleaseDir)}`,
  `rsync -a --delete --exclude .env.local --exclude node_modules --exclude .next ${shellQuote(`${remoteReleaseDir}/`)} ${shellQuote(`${config.deployPath}/`)}`,
  `cd ${config.deployPath}`,
  `${config.packageManager || "npm"} install`,
  migrationCommand,
  "rm -rf .next",
  config.buildCommand,
  `${config.processManager} restart ${service.name}`,
  `${config.processManager} status ${service.name} --no-color`,
  healthCommand,
  `rm -rf ${shellQuote(remoteArchive)} ${shellQuote(remoteReleaseDir)}`,
].join(" && ");

run("ssh", [remote, remoteCommand]);

if (!dryRun) {
  rmSync(localArchive, { force: true });
}

console.log(
  dryRun
    ? "\nDry run completed."
    : `\nDeploy completed: ${service.name} -> ${remote}:${config.deployPath} @ ${commit}`
);
