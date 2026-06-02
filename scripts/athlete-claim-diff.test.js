/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filename = path.resolve(__dirname, '../src/lib/athlete-claim-diff.ts');
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

const { buildAthleteClaimDiffs } = loadModule();

test('builds diffs against current athlete profile and previous submission', () => {
  const diffs = buildAthleteClaimDiffs({
    current_name: '张三',
    submitted_name: '张帅',
    previous_submitted_name: '张三',
    current_photo: 'old.jpg',
    submitted_avatar_url: 'new.jpg',
    previous_submitted_avatar_url: 'new.jpg',
    current_public_profile: {
      hometown_province: '浙江省',
      hometown_city: '杭州市',
      living_province: '上海市',
      living_city: '上海市',
      intro_short: '旧介绍',
    },
    submitted_hometown_province: '浙江省',
    submitted_hometown_city: '宁波市',
    previous_submitted_hometown_province: '浙江省',
    previous_submitted_hometown_city: '杭州市',
    submitted_living_province: '上海市',
    submitted_living_city: '上海市',
    previous_submitted_living_province: '上海市',
    previous_submitted_living_city: '上海市',
    submitted_intro_short: '新介绍',
    previous_submitted_intro_short: '新介绍',
  });

  assert.deepEqual(diffs.againstCurrent.map((item) => item.key), ['name', 'avatar', 'hometown', 'intro_short']);
  assert.deepEqual(diffs.againstPreviousSubmission.map((item) => item.key), ['name', 'hometown']);
});

test('exposes intro_short as a separate one-line diff', () => {
  const diffs = buildAthleteClaimDiffs({
    current_public_profile: { intro_short: '旧一句话' },
    submitted_intro_short: '新一句话',
    previous_submitted_intro_short: '旧一句话',
    current_bio: '旧简介',
    submitted_intro: '新简介',
    previous_submitted_intro: '旧简介',
  });

  assert.equal(diffs.againstCurrent.some((item) => item.key === 'intro_short' && item.label === '一句话介绍'), true);
  assert.deepEqual(diffs.againstCurrent.map((item) => item.key), ['intro_short', 'intro']);
});

test('normalizes photo url arrays before comparing', () => {
  const diffs = buildAthleteClaimDiffs({
    current_photo_urls: ['b.jpg', 'a.jpg', 'a.jpg'],
    submitted_sup_photo_urls: ['a.jpg', 'b.jpg'],
    previous_submitted_sup_photo_urls: ['a.jpg'],
  });

  assert.equal(diffs.againstCurrent.some((item) => item.key === 'sup_photos'), false);
  assert.equal(diffs.againstPreviousSubmission.find((item) => item.key === 'sup_photos').change, 'changed');
});
