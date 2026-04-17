#!/usr/bin/env node

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
const remote = config.server.includes("@")
  ? config.server
  : `root@${config.server}`;

const excludes = [
  ".git",
  ".next",
  "node_modules",
  ".env.local",
  ".DS_Store",
  ".AGENTS.md.swp",
];

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

const rsyncArgs = [
  "-az",
  "--delete",
  ...excludes.flatMap((pattern) => ["--exclude", pattern]),
  `${repoRoot}/`,
  `${remote}:${config.deployPath}/`,
];

const remoteCommand = [
  `cd ${config.deployPath}`,
  "rm -rf .next",
  config.buildCommand,
  `${config.processManager} restart ${service.name}`,
  `${config.processManager} status ${service.name} --no-color`,
].join(" && ");

run("rsync", rsyncArgs);
run("ssh", [remote, remoteCommand]);

console.log(
  dryRun
    ? "\nDry run completed."
    : `\nDeploy completed: ${service.name} -> ${remote}:${config.deployPath}`
);
