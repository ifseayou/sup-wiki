#!/usr/bin/env node

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

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseUrlArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
}

function mergeUrlArrays(existing, incoming) {
  const existingList = Array.isArray(existing)
    ? existing
    : (() => {
        try {
          const parsed = JSON.parse(String(existing || '[]'));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();
  return Array.from(new Set(existingList.concat(incoming).map((item) => String(item || '').trim()).filter(Boolean)));
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
    const [claims] = await conn.execute(`
      SELECT c.claim_id, c.athlete_id, c.submitted_avatar_url, c.submitted_profile_json,
             a.photo, a.photos
      FROM sup_athlete_profile_claims c
      INNER JOIN (
        SELECT athlete_id, MAX(claim_id) AS claim_id
        FROM sup_athlete_profile_claims
        WHERE status = 'approved'
        GROUP BY athlete_id
      ) latest ON latest.claim_id = c.claim_id
      INNER JOIN sup_athletes a ON a.athlete_id = c.athlete_id
      WHERE c.status = 'approved'
    `);

    let updated = 0;
    for (const claim of claims) {
      const profile = parseJsonObject(claim.submitted_profile_json);
      const submittedPhotos = parseUrlArray(profile.sup_photos || profile.photos);
      if (submittedPhotos.length === 0 && !claim.submitted_avatar_url) continue;

      const mergedPhotos = mergeUrlArrays(claim.photos, submittedPhotos);
      const nextPhoto = claim.photo || claim.submitted_avatar_url || null;
      const currentPhotos = mergeUrlArrays(claim.photos, []);
      const shouldUpdatePhotos = JSON.stringify(currentPhotos) !== JSON.stringify(mergedPhotos);
      const shouldUpdatePhoto = !claim.photo && !!nextPhoto;
      if (!shouldUpdatePhotos && !shouldUpdatePhoto) continue;

      await conn.execute(
        'UPDATE sup_athletes SET photo = ?, photos = ? WHERE athlete_id = ?',
        [nextPhoto, JSON.stringify(mergedPhotos), claim.athlete_id]
      );
      updated += 1;
      console.log(`updated athlete ${claim.athlete_id} from claim ${claim.claim_id}: ${mergedPhotos.length} photos`);
    }

    console.log(`Backfill completed. Updated athletes: ${updated}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
