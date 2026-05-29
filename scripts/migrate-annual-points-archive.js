#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = process.env[key] || value;
  }
}

async function hasColumn(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function hasIndex(conn, table, index) {
  const [rows] = await conn.execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [table, index]
  );
  return rows.length > 0;
}

async function addColumn(conn, table, column, ddl) {
  if (!(await hasColumn(conn, table, column))) {
    await conn.query(ddl);
    console.log(`added column ${table}.${column}`);
  }
}

async function addIndex(conn, table, index, ddl) {
  if (!(await hasIndex(conn, table, index))) {
    await conn.query(ddl);
    console.log(`added index ${table}.${index}`);
  }
}

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sport_hacker',
  });

  try {
    await addColumn(
      conn,
      'sup_annual_point_standings',
      'team_name',
      'ALTER TABLE sup_annual_point_standings ADD COLUMN team_name VARCHAR(160) NULL AFTER athlete_name_snapshot'
    );
    await addColumn(
      conn,
      'sup_annual_point_standings',
      'team_name_normalized',
      'ALTER TABLE sup_annual_point_standings ADD COLUMN team_name_normalized VARCHAR(160) NULL AFTER team_name'
    );
    await addIndex(
      conn,
      'sup_annual_point_standings',
      'idx_annual_points_year',
      'ALTER TABLE sup_annual_point_standings ADD INDEX idx_annual_points_year (year)'
    );
    await addIndex(
      conn,
      'sup_annual_point_standings',
      'idx_annual_points_team',
      'ALTER TABLE sup_annual_point_standings ADD INDEX idx_annual_points_team (team_name_normalized)'
    );
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sup_annual_club_point_standings (
        standing_id BIGINT PRIMARY KEY AUTO_INCREMENT,
        source_id BIGINT NOT NULL,
        year INT NOT NULL,
        rank_position INT NULL,
        club_id INT NULL,
        club_name_snapshot VARCHAR(160) NOT NULL,
        club_name_normalized VARCHAR(160) NULL,
        total_points DECIMAL(12,3) NULL,
        source_record_id VARCHAR(100) NOT NULL,
        raw_json JSON NULL,
        match_status ENUM('unmatched','candidate','confirmed','conflict') DEFAULT 'unmatched',
        match_confidence DECIMAL(4,3) DEFAULT 0.500,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_annual_club_points_record (source_id, source_record_id),
        INDEX idx_annual_club_points_year_rank (year, rank_position),
        INDEX idx_annual_club_points_name (club_name_snapshot),
        INDEX idx_annual_club_points_club (club_id),
        INDEX idx_annual_club_points_match (match_status),
        CONSTRAINT fk_annual_club_points_source FOREIGN KEY (source_id) REFERENCES sup_annual_point_sources(source_id) ON DELETE CASCADE,
        CONSTRAINT fk_annual_club_points_club FOREIGN KEY (club_id) REFERENCES sup_clubs(club_id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('annual points archive migration completed');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
