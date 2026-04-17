const mysql = require('mysql2/promise');

async function main() {
  const pool = await mysql.createPool({
    host: '8.217.233.65',
    port: 3306,
    user: 'root',
    password: 'iaddu.cn@9527',
    database: 'sport_hacker',
    charset: 'utf8mb4',
  });

  await pool.query(
    `UPDATE sup_shop_items
     SET subtitle = ?,
         description = ?,
         highlights = JSON_ARRAY(?, ?, ?),
         spec = JSON_OBJECT(?, ?, ?, ?, ?, ?)
     WHERE slug = ?`,
    [
      '集 Carolina、Cheetah、Ninja 三个板型于一体，覆盖竞速、海划与综合训练场景',
      'NSP Pro Carbon 系列面向竞速与高性能训练场景，包含 Carolina、Cheetah、Ninja 三个板型。适合需要平水效率、海况适应和专项竞赛表现的进阶桨手。',
      '包含 Carolina / Cheetah / Ninja 三个板型',
      '覆盖竞速、海划与综合训练需求',
      '适配平水、海划与竞速训练场景',
      '系列',
      'NSP Pro Carbon',
      '可选板型',
      'Ninja / Carolina / Cheetah',
      '可选规格',
      'Ninja 14x20 / Ninja 14x21 / Carolina 14x20.5 / Cheetah 14x21',
      'nsp-pro-carbon-series',
    ]
  );

  await pool.query(
    `UPDATE sup_shop_items
     SET subtitle = ?,
         description = ?,
         highlights = JSON_ARRAY(?, ?, ?),
         spec = JSON_OBJECT(?, ?, ?, ?, ?, ?)
     WHERE slug = ?`,
    [
      '14 尺竞技板，提供 21 / 22 / 23 英寸三档宽度选择',
      `THE LIGHTCORP 14'0" 面向竞技训练和比赛场景，固定板长 14 尺，支持 21、22、23 英寸三种宽度选择。`,
      '14 尺竞技定位',
      '21 / 22 / 23 英寸三档宽度可选',
      '适合专项训练与赛事使用',
      '长度',
      `14'0"`,
      '宽度可选',
      `21" / 22" / 23"`,
      '重量',
      `9.3kg（23"）`,
      'the-lightcorp-14-0',
    ]
  );

  const [rows] = await pool.query(
    `SELECT slug, subtitle FROM sup_shop_items
     WHERE slug IN ('nsp-pro-carbon-series', 'the-lightcorp-14-0')
     ORDER BY slug`
  );

  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
