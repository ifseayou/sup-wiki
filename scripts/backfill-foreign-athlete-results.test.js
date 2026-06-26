/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeName, isDomesticNationality, planRelink } = require('./backfill-foreign-athlete-results');

test('normalizeName 去空白并小写（大小写/空格不敏感）', () => {
  assert.equal(normalizeName('Rai TAGUCHI'), 'raitaguchi');
  assert.equal(normalizeName('Rai Taguchi'), 'raitaguchi');
  assert.equal(normalizeName('  rai   taguchi '), 'raitaguchi');
  assert.equal(normalizeName(null), '');
});

test('isDomesticNationality 识别国内（含港澳台）与外籍', () => {
  for (const v of ['中国', 'CHINA', 'CHN', 'CN', '中国香港', 'Hong Kong', '中国台北', 'Chinese Taipei', '中国澳门']) {
    assert.equal(isDomesticNationality(v), true, `${v} 应判国内`);
  }
  for (const v of ['日本', 'JPN', 'Japan', '美国', 'USA', '韩国']) {
    assert.equal(isDomesticNationality(v), false, `${v} 应判外籍`);
  }
  // 空值无法判定，保守视为国内（外籍回填时跳过）
  assert.equal(isDomesticNationality(''), true);
  assert.equal(isDomesticNationality(null), true);
});

test('planRelink 外籍唯一候选回填、域内/多候选/无候选跳过', () => {
  const nullGroups = [
    { norm: 'raitaguchi', sample: 'Rai TAGUCHI', affected: 33 }, // 外籍唯一 -> 回填
    { norm: 'zhangsan', sample: '张三', affected: 5 }, // 国内唯一 -> 默认跳过
    { norm: 'liubo', sample: 'Liu Bo', affected: 2 }, // 多候选 -> 跳过
    { norm: 'ghost', sample: 'Ghost', affected: 1 }, // 无候选 -> 跳过
  ];
  const candidatesByNorm = new Map([
    ['raitaguchi', [{ athlete_id: 36, name: 'Rai Taguchi', nationality: '日本' }]],
    ['zhangsan', [{ athlete_id: 100, name: '张三', nationality: '中国' }]],
    ['liubo', [
      { athlete_id: 200, name: 'Liu Bo', nationality: '中国' },
      { athlete_id: 201, name: 'LIU BO', nationality: '美国' },
    ]],
  ]);

  const { relinks, skipped } = planRelink(nullGroups, candidatesByNorm, { allowDomestic: false });
  assert.equal(relinks.length, 1);
  assert.deepEqual(
    { toId: relinks[0].toId, affected: relinks[0].affected },
    { toId: 36, affected: 33 }
  );
  assert.deepEqual(
    skipped.map((s) => s.reason).sort(),
    ['ambiguous', 'domestic', 'no-candidate']
  );
});

test('planRelink 罗马音快照命中外籍 name_en 候选（荒木珠里/Shuri ARAKI）→ 回填', () => {
  // loadPublishedCandidates 会把 name_en="Shuri Araki" 的外籍档案挂到 norm "shuriaraki"
  const nullGroups = [{ norm: 'shuriaraki', sample: 'Shuri ARAKI', affected: 18 }];
  const candidatesByNorm = new Map([
    ['shuriaraki', [{ athlete_id: 15, name: '荒木珠里', nationality: '日本' }]],
  ]);
  const { relinks, skipped } = planRelink(nullGroups, candidatesByNorm, { allowDomestic: false });
  assert.equal(relinks.length, 1);
  assert.equal(skipped.length, 0);
  assert.deepEqual({ toId: relinks[0].toId, affected: relinks[0].affected }, { toId: 15, affected: 18 });
});

test('planRelink --all 放开国内唯一候选', () => {
  const nullGroups = [{ norm: 'zhangsan', sample: '张三', affected: 5 }];
  const candidatesByNorm = new Map([['zhangsan', [{ athlete_id: 100, name: '张三', nationality: '中国' }]]]);
  const { relinks } = planRelink(nullGroups, candidatesByNorm, { allowDomestic: true });
  assert.equal(relinks.length, 1);
  assert.equal(relinks[0].toId, 100);
});
