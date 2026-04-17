const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BUCKET = process.env.OSS_BUCKET;
const REGION = process.env.OSS_REGION;
const ENDPOINT = `https://${BUCKET}.${REGION}.aliyuncs.com`;
const PREFIX = 'sup-wiki/shop/import-20260416';

const client = new OSS({
  region: REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: BUCKET,
});

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

function listFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => path.join(dir, name));
}

async function uploadDir(dir, remoteFolder) {
  const files = listFiles(dir);
  const map = {};

  for (const file of files) {
    const filename = path.basename(file);
    const key = `${PREFIX}/${remoteFolder}/${filename}`;
    const result = await client.put(key, file);
    map[filename] = result.url.replace(/^http:\/\//, 'https://');
    console.log(`uploaded ${remoteFolder}/${filename}`);
  }

  return map;
}

async function main() {
  const nspMap = await uploadDir('/opt/sport-hacker/uploads/nsp', 'nsp');
  const lightMap = await uploadDir('/opt/sport-hacker/uploads/the-lightcorp', 'the-lightcorp');

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
    {
      color: `Ninja 14' x 20"`,
      images: [nspMap['ninja-14x20.jpg'], nspMap['detail-03-ninja-spec.jpg']],
      extra_note: '竞速款',
    },
    {
      color: `Ninja 14' x 21"`,
      images: [nspMap['ninja-14x21.jpg'], nspMap['detail-03-ninja-spec.jpg']],
      extra_note: '竞速款',
    },
    {
      color: `Carolina 14' x 20.5"`,
      images: [nspMap['carolina-14x20_5.jpg'], nspMap['detail-05-carolina-spec.jpg']],
      extra_note: '全能款',
    },
    {
      color: `Cheetah 14' x 21"`,
      images: [nspMap['cheetah-14x21.jpg'], nspMap['detail-07-cheetah-spec.jpg']],
      extra_note: '海划款',
    },
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
    {
      color: `14'0" x 23"`,
      images: [lightMap['lightcorp-14x23-main.jpg'], lightMap['detail-04-23.jpg']],
      extra_note: '稳定性更强',
    },
    {
      color: `14'0" x 22"`,
      images: [lightMap['lightcorp-main-lineup.png'], lightMap['detail-07-22.jpg']],
      extra_note: '均衡设定',
    },
    {
      color: `14'0" x 21"`,
      images: [lightMap['lightcorp-main-lineup.png'], lightMap['detail-09-21.jpg']],
      extra_note: '更偏竞速',
    },
  ];

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
    endpoint: ENDPOINT,
    nspSample: nspVariants[0].images[0],
    lightSample: lightVariants[0].images[0],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
