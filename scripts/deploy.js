#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const { readFileSync } = require("fs");
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

const branch = config.branch || "main";

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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const healthUrl = `http://127.0.0.1:${service.port}${service.healthPath || "/"}`;
const migrationCommand = migrationFile
  ? `node scripts/run-migration.js ${shellQuote(migrationFile)}`
  : "echo 'No database migration requested'";

const remoteCommand = [
  `cd ${config.deployPath}`,
  "git fetch origin",
  `git reset --hard origin/${branch}`,
  `${config.packageManager || "npm"} install`,
  migrationCommand,
  "rm -rf .next",
  config.buildCommand,
  `${config.processManager} restart ${service.name}`,
  `${config.processManager} status ${service.name} --no-color`,
  `for i in 1 2 3 4 5 6; do status=$(curl -s -o /dev/null -w "%{http_code}" ${shellQuote(healthUrl)} || true); echo "Health ${healthUrl}: $status"; case "$status" in 2*|3*) exit 0 ;; esac; sleep 3; done; exit 1`,
].join(" && ");

run("ssh", [remote, remoteCommand]);

console.log(
  dryRun
    ? "\nDry run completed."
    : `\nDeploy completed: ${service.name} -> ${remote}:${config.deployPath}`
);
