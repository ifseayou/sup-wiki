#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 赛点坐标批量地理编码：对缺经纬度的赛事，按「场馆/地点 + 省市」调高德 geocode 回填 venue_lat/venue_lng。
 * 口径与 src/lib/geocode.ts 一致（buildGeocodeAddress + restapi.amap.com/v3/geocode/geo）。
 * 缺 AMAP_WEB_KEY / 解析失败 / 低置信(无 geocodes) 一律跳过，绝不写错坐标。
 * 用法：node scripts/geocode-events.js [--apply] [--all] [--limit N]
 *   默认 dry-run，只打印「赛事→地址→坐标」；--apply 落库。
 *   默认只处理 venue_lat/lng 为空的赛事；--all 重新编码全部（覆盖已有坐标）。
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const num = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? Number(process.argv[i + 1]) : null; };
const LIMIT = num('--limit');

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

// 与 src/lib/geocode.ts buildGeocodeAddress 同口径
function buildGeocodeAddress(parts) {
  const head = [parts.venue, parts.location].map((v) => String(v || '').trim()).filter(Boolean)[0] || '';
  const region = [parts.province, parts.city].map((v) => String(v || '').trim()).filter(Boolean).join('');
  if (!head) return region;
  return head.includes(region) || !region ? head : `${region}${head}`;
}

async function geocodeAddress(key, parts) {
  const address = buildGeocodeAddress(parts);
  if (!key || !address) return null;
  try {
    const url = new URL('https://restapi.amap.com/v3/geocode/geo');
    url.searchParams.set('key', key);
    url.searchParams.set('address', address);
    const city = String(parts.city || parts.province || '').trim();
    if (city) url.searchParams.set('city', city);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.geocodes) || !data.geocodes.length) return null;
    const loc = String(data.geocodes[0].location || '');
    const [lngStr, latStr] = loc.split(',');
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, formatted: String(data.geocodes[0].formatted_address || address), address };
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = loadEnv();
  const key = env.AMAP_WEB_KEY || '';
  if (!key) {
    console.error('缺少 AMAP_WEB_KEY（在 .env.local 配置），无法地理编码。');
    process.exit(1);
  }
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost', port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || '', database: env.MYSQL_DATABASE || 'sport_hacker',
  });
  try {
    const cond = ALL ? '1=1' : '(venue_lat IS NULL OR venue_lng IS NULL)';
    const [rows] = await conn.execute(
      `SELECT event_id, name, venue, location, province, city, venue_lat, venue_lng
       FROM sup_events WHERE ${cond} ORDER BY event_id ASC${LIMIT ? ` LIMIT ${LIMIT}` : ''}`
    );
    console.log(`待处理赛事 ${rows.length} 个（${ALL ? '全部重编码' : '仅缺坐标'}）${APPLY ? '' : ' [DRY-RUN]'}`);
    let ok = 0, skip = 0;
    for (const r of rows) {
      const geo = await geocodeAddress(key, { venue: r.venue, location: r.location, province: r.province, city: r.city });
      if (!geo) {
        skip++;
        console.log(`  [skip] #${r.event_id} ${r.name} ← 地址「${buildGeocodeAddress(r)}」无法解析`);
        await sleep(120);
        continue;
      }
      ok++;
      console.log(`  [ ok ] #${r.event_id} ${r.name}\n         地址「${geo.address}」→ ${geo.lat},${geo.lng}（${geo.formatted}）`);
      if (APPLY) {
        await conn.execute('UPDATE sup_events SET venue_lat=?, venue_lng=? WHERE event_id=?', [geo.lat, geo.lng, r.event_id]);
      }
      await sleep(120); // 控制高德 QPS
    }
    console.log(`\n${APPLY ? '已写入' : 'DRY-RUN'}：成功 ${ok}，跳过(需人工) ${skip}`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
