/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadClubTeamModule() {
  const filename = path.resolve(__dirname, '../src/lib/club-team-normalization.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const { cleanClubTeamName, isClaimableClubTeamName, normalizeClubTeamName, slugifyClubName } = loadClubTeamModule();

test('normalizes visible club team names conservatively', () => {
  assert.equal(cleanClubTeamName(' 上海 远香湖（金钥匙）桨板俱乐部 '), '上海 远香湖(金钥匙)桨板俱乐部');
  assert.equal(normalizeClubTeamName('上海 远香湖（金钥匙）桨板俱乐部'), '上海远香湖(金钥匙)桨板俱乐部');
  assert.equal(normalizeClubTeamName('自由动力·江阴水上运动俱乐部'), '自由动力江阴水上运动俱乐部');
});

test('filters personal or empty team names from club claim pool', () => {
  for (const value of ['', ' ', '-', '个人', '无队伍', '个人参赛', '未知']) {
    assert.equal(isClaimableClubTeamName(value), false);
  }
  assert.equal(isClaimableClubTeamName('武汉在路上俱乐部'), true);
});

test('generates stable ascii slugs when possible and safe fallback for chinese names', () => {
  assert.equal(slugifyClubName('SUP Lake Club'), 'sup-lake-club');
  assert.equal(slugifyClubName('武汉在路上俱乐部', 18), 'club-18');
});
