#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration.sql>');
  process.exit(1);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = process.env[key] || value;
  }
}

function stripMysqlClientCommands(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*(USE|DELIMITER)\b/i.test(line))
    .join('\n')
    .replace(/CREATE PROCEDURE[\s\S]*?END\s*\$\$/gi, '')
    .replace(/DROP PROCEDURE IF EXISTS add_col_if_missing\s*\$\$/gi, '')
    .replace(/CALL add_col_if_missing\('([^']+)',\s*'([^']+)',\s*"([^"]+)"\);/g, (_, table, column, ddl) => (
      `SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}');\n`
      + `SET @ddl = IF(@column_exists = 0, '${ddl.replace(/'/g, "''")}', 'SELECT 1');\n`
      + 'PREPARE stmt FROM @ddl;\nEXECUTE stmt;\nDEALLOCATE PREPARE stmt;'
    ))
    .replace(/\$\$/g, ';');
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  loadEnv(path.join(repoRoot, '.env.local'));

  const absoluteFile = path.resolve(repoRoot, migrationFile);
  const sql = stripMysqlClientCommands(fs.readFileSync(absoluteFile, 'utf8'));
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sport_hacker',
  });

  try {
    for (const statement of statements) {
      await conn.query(statement);
    }
    console.log(`Migration completed: ${migrationFile}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
