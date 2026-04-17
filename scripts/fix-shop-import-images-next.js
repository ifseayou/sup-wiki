const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const OSS_AK = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_SK = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_BUCKET = process.env.OSS_BUCKET || 'sport-hacker-assets';
const OSS_REGION = process.env.OSS_REGION || 'oss-cn-hangzhou';
const OSS_ENDPOINT = `${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

function ossSign(method, contentType, date, ossKey) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
  const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
  return `OSS ${OSS_AK}:${signature}`;
}

async function uploadFile(localPath, folder) {
  const ext = path.extname(localPath).slice(1).toLowerCase() || 'jpg';
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif' ? 'image/gif' :
    'image/jpeg';

  const ossKey = `sup-wiki/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const date = new Date().toUTCString();
  const authorization = ossSign('PUT', mime, date, ossKey);
  const buffer = fs.readFileSync(localPath);

  const res = await fetch(`https://${OSS_ENDPOINT}/${ossKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': mime,
      'Date': date,
      'Authorization': authorization,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS upload failed for ${localPath}: ${res.status} ${text}`);
  }

  return `https://${OSS_ENDPOINT}/${ossKey}`;
}

function listFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => path.join(dir, name));
}

async function uploadDir(dir, folder) {
  const map = {};
  for (const file of listFiles(dir)) {
    const name = path.basename(file);
    map[name] = await uploadFile(file, folder);
    console.log(`uploaded ${folder}/${name}`);
  }
  return map;
}

async function main() {
  const tmpBase = '/tmp/sup-shop-import';
  const nspMap = await uploadDir(path.join(tmpBase, 'nsp'), 'shop');
  const lightMap = await uploadDir(path.join(tmpBase, 'the-lightcorp'), 'shop');

  const nspImages = [
    nspMap['detail-01-lineup.jpg'],
    nspMap['detail-02-structure.jpg'],
    nspMap['detail-04-ninja-action.jpg'],
    nspMap['detail-06-carolina-action.jpg'],
    nspMap['detail-08-race-fins.jpg'],
    nspMap['detail-09-team.jpg'],
    nspMap['detail-10-brand-intro.jpg'],
  ];
  const nspVariants = [
    { color: `Ninja 14' x 20"`, images: [nspMap['ninja-14x20.jpg'], nspMap['detail-03-ninja-spec.jpg']], extra_note: '竞速款' },
    { color: `Ninja 14' x 21"`, images: [nspMap['ninja-14x21.jpg'], nspMap['detail-03-ninja-spec.jpg']], extra_note: '竞速款' },
    { color: `Carolina 14' x 20.5"`, images: [nspMap['carolina-14x20_5.jpg'], nspMap['detail-05-carolina-spec.jpg']], extra_note: '全能款' },
    { color: `Cheetah 14' x 21"`, images: [nspMap['cheetah-14x21.jpg'], nspMap['detail-07-cheetah-spec.jpg']], extra_note: '海划款' },
  ];

  const lightImages = [
    lightMap['detail-01-cover.jpg'],
    lightMap['detail-02-lineup.jpg'],
    lightMap['detail-03-size.jpg'],
    lightMap['detail-05-performance.jpg'],
    lightMap['detail-06-fin.jpg'],
    lightMap['detail-08-drainage.jpg'],
    lightMap['detail-10-cockpit.jpg'],
    lightMap['detail-11-tail.jpg'],
    lightMap['detail-12-build.jpg'],
    lightMap['detail-13-water.jpg'],
    lightMap['detail-14-lifestyle.jpg'],
    lightMap['detail-15-brand.jpg'],
    lightMap['detail-16-waterlive.jpg'],
  ];
  const lightVariants = [
    { color: `14'0" x 23"`, images: [lightMap['lightcorp-14x23-main.jpg'], lightMap['detail-04-23.jpg']], extra_note: '稳定性更强' },
    { color: `14'0" x 22"`, images: [lightMap['lightcorp-main-lineup.png'], lightMap['detail-07-22.jpg']], extra_note: '均衡设定' },
    { color: `14'0" x 21"`, images: [lightMap['lightcorp-main-lineup.png'], lightMap['detail-09-21.jpg']], extra_note: '更偏竞速' },
  ];

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 4,
  });

  await pool.execute(
    'UPDATE sup_shop_items SET images = ?, variants = ? WHERE slug = ?',
    [JSON.stringify(nspImages), JSON.stringify(nspVariants), 'nsp-pro-carbon-series']
  );
  await pool.execute(
    'UPDATE sup_shop_items SET images = ?, variants = ? WHERE slug = ?',
    [JSON.stringify(lightImages), JSON.stringify(lightVariants), 'the-lightcorp-14-0']
  );
  await pool.end();

  console.log(JSON.stringify({
    nspFirst: nspVariants[0].images[0],
    lightFirst: lightVariants[0].images[0],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
