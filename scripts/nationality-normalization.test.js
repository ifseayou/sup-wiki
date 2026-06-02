/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadNationalityModule() {
  const filename = path.resolve(__dirname, '../src/lib/nationality.ts');
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

const {
  getNationalityAliases,
  nationalityMatchesSearch,
  normalizeNationality,
} = loadNationalityModule();

test('normalizes common Chinese and ICF nationality aliases to Chinese labels', () => {
  assert.equal(normalizeNationality('CHN'), '中国');
  assert.equal(normalizeNationality('China'), '中国');
  assert.equal(normalizeNationality('USA'), '美国');
  assert.equal(normalizeNationality('JPN'), '日本');
  assert.equal(normalizeNationality('KOR'), '韩国');
  assert.equal(normalizeNationality('HKG'), '中国香港');
  assert.equal(normalizeNationality('TPE'), '中国台北');
  assert.equal(normalizeNationality('ROU'), '罗马尼亚');
  assert.equal(normalizeNationality('AIN'), '中立个人运动员');
});

test('keeps unknown nationality values but treats empty placeholders as null', () => {
  assert.equal(normalizeNationality('火星'), '火星');
  assert.equal(normalizeNationality(''), null);
  assert.equal(normalizeNationality('-'), null);
  assert.equal(normalizeNationality('null'), null);
});

test('returns aliases for database transition filters', () => {
  const aliases = getNationalityAliases('中国');
  assert.ok(aliases.includes('中国'));
  assert.ok(aliases.includes('CHN'));
  assert.ok(aliases.includes('CHINA'));
});

test('matches searchable filters across raw code and Chinese label', () => {
  assert.equal(nationalityMatchesSearch('中国', 'CHN'), true);
  assert.equal(nationalityMatchesSearch('USA', '美国'), true);
  assert.equal(nationalityMatchesSearch('JPN', '日'), true);
  assert.equal(nationalityMatchesSearch('韩国', 'USA'), false);
});
