#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  const env = { ...process.env };
  if (!fs.existsSync(envPath)) return env;
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
    env[key] = value;
  }
  return env;
}

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  const env = loadEnv();
  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'sport_hacker',
    multipleStatements: true,
  });
  try {
    if (!(await columnExists(connection, 'sup_event_results', 'result_status_code'))) {
      await connection.execute('ALTER TABLE sup_event_results ADD COLUMN result_status_code VARCHAR(20) NULL AFTER finish_time');
      console.log('added sup_event_results.result_status_code');
    }
    if (!(await columnExists(connection, 'sup_event_results', 'result_status_note'))) {
      await connection.execute('ALTER TABLE sup_event_results ADD COLUMN result_status_note VARCHAR(255) NULL AFTER result_status_code');
      console.log('added sup_event_results.result_status_note');
    }
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sup_event_result_members (
        member_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        result_id BIGINT NOT NULL,
        athlete_id BIGINT NULL,
        member_name VARCHAR(100) NOT NULL,
        member_order INT DEFAULT 0,
        role_label VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_result_member_name (result_id, member_name),
        INDEX idx_result_members_result (result_id),
        INDEX idx_result_members_athlete (athlete_id),
        INDEX idx_result_members_name (member_name),
        CONSTRAINT fk_result_members_result FOREIGN KEY (result_id) REFERENCES sup_event_results(result_id) ON DELETE CASCADE,
        CONSTRAINT fk_result_members_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.execute("UPDATE sup_event_results SET team_name = '个人' WHERE team_name IS NULL OR team_name = ''");
    await connection.execute(`
      UPDATE sup_event_results
      SET result_status_code = UPPER(TRIM(finish_time))
      WHERE result_status_code IS NULL
        AND UPPER(TRIM(finish_time)) IN ('DNS', 'DNF', 'DQ', 'DSQ', 'DNQ', 'OTL')
    `);
    await connection.execute(`
      UPDATE sup_event_results
      SET result_status_note = CASE result_status_code
        WHEN 'DNS' THEN '未出发'
        WHEN 'DNF' THEN '未完赛'
        WHEN 'DQ' THEN '取消成绩'
        WHEN 'DSQ' THEN '取消成绩'
        WHEN 'DNQ' THEN '未晋级'
        WHEN 'OTL' THEN '超过关门时间'
        ELSE result_status_note
      END
      WHERE result_status_code IS NOT NULL
        AND (result_status_note IS NULL OR result_status_note = '')
    `);
    const [summary] = await connection.execute(`
      SELECT
        (SELECT COUNT(*) FROM sup_event_results) AS results_count,
        (SELECT COUNT(*) FROM sup_event_result_members) AS members_count,
        (SELECT COUNT(*) FROM sup_event_results WHERE team_name = '个人') AS personal_team_count,
        (SELECT COUNT(*) FROM sup_event_results WHERE result_status_code IS NOT NULL) AS status_count
    `);
    console.log(JSON.stringify(summary[0], null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
