#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');

async function createConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sport_hacker',
    charset: 'utf8mb4',
  });
}

async function runIgnoreDuplicate(connection, sql, duplicateCode) {
  try {
    await connection.execute(sql);
    console.log(`applied: ${sql}`);
  } catch (error) {
    if (error && error.code === duplicateCode) {
      console.log(`skipped: ${sql}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const connection = await createConnection();
  try {
    await runIgnoreDuplicate(
      connection,
      "ALTER TABLE sup_athletes ADD COLUMN gender ENUM('male','female','mixed','unknown') NOT NULL DEFAULT 'unknown' AFTER name_en",
      'ER_DUP_FIELDNAME'
    );
    await runIgnoreDuplicate(
      connection,
      "ALTER TABLE sup_athletes ADD COLUMN gender_source ENUM('manual','result_inferred','unknown') NOT NULL DEFAULT 'unknown' AFTER gender",
      'ER_DUP_FIELDNAME'
    );
    await runIgnoreDuplicate(
      connection,
      'ALTER TABLE sup_athletes ADD COLUMN gender_confidence DECIMAL(4,3) NULL AFTER gender_source',
      'ER_DUP_FIELDNAME'
    );
    await runIgnoreDuplicate(
      connection,
      'CREATE INDEX idx_athletes_gender ON sup_athletes (gender, status)',
      'ER_DUP_KEYNAME'
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
