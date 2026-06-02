/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeName,
  dedupeRosterRows,
  groupRosterByName,
  mergeRosterEntries,
} = require('./import-official-elite-athletes');

test('normalizeName removes whitespace and normalizes full width characters', () => {
  assert.equal(normalizeName(' 叶　贵 桐 '), '叶贵桐');
});

test('dedupeRosterRows deduplicates aggregate and detail sheet rows by name and group', () => {
  const rows = dedupeRosterRows([
    { sheet: '精英-公开组', name: '叶贵桐', group: '精英-男子公开组', note: '2025年男子公开组积分1' },
    { sheet: '精英-男子公开组', name: '叶贵桐', group: '精英-男子公开组', note: '' },
    { sheet: '精英-男子青少年组', name: '徐俊', group: '精英-男子青少年组', note: '2025年男子U18组积分2' },
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find((row) => row.name === '叶贵桐'), {
    sheet: '精英-公开组、精英-男子公开组',
    name: '叶贵桐',
    group: '精英-男子公开组',
    note: '2025年男子公开组积分1',
    status: 'formal',
    sourceTitle: '',
  });
});

test('groupRosterByName preserves multi-group official memberships', () => {
  const grouped = groupRosterByName([
    { name: '徐俊', group: '精英-男子公开组', note: '公开组积分', sheet: 'A' },
    { name: '徐俊', group: '精英-男子青少年组', note: '青少年积分', sheet: 'B' },
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].name, '徐俊');
  assert.equal(grouped[0].status, 'formal');
  assert.deepEqual(grouped[0].groups, ['精英-男子公开组', '精英-男子青少年组']);
  assert.deepEqual(grouped[0].notes, ['公开组积分', '青少年积分']);
});

test('groupRosterByName preserves reserve status and ranking notes', () => {
  const grouped = groupRosterByName([
    { name: '蒋冬梅', group: '精英-女子公开组', note: '女子公开组17', sheet: '汇总', status: 'reserve', sourceTitle: '候补名单' },
    { name: '蒋冬梅', group: '精英-女子40+组', note: '女子40+组3', sheet: '精英-女子40+组', status: 'reserve', sourceTitle: '候补名单' },
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].status, 'reserve');
  assert.equal(grouped[0].sourceTitle, '候补名单');
  assert.deepEqual(grouped[0].groups, ['精英-女子40+组', '精英-女子公开组']);
  assert.deepEqual(grouped[0].notes, ['女子40+组3', '女子公开组17']);
});

test('mergeRosterEntries lets formal roster override reserve roster by normalized name', () => {
  const reserve = groupRosterByName([
    { name: '王 飞雄', group: '精英-男子公开组', note: '男子公开组18', sheet: '候补', status: 'reserve', sourceTitle: '候补名单' },
  ]);
  const formal = groupRosterByName([
    { name: '王飞雄', group: '精英-男子公开组', note: '男子公开组积分1', sheet: '正式', status: 'formal', sourceTitle: '正式名单' },
  ]);

  const merged = mergeRosterEntries(formal, reserve);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, '王飞雄');
  assert.equal(merged[0].status, 'formal');
  assert.deepEqual(merged[0].notes, ['男子公开组积分1']);
});
