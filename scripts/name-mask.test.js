/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filename = path.resolve(__dirname, '../src/lib/name-mask.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(output, filename);
  return mod.exports;
}

const { hiddenAthleteName, maskAthleteName } = loadModule();

test('masks Chinese athlete names by keeping surname and final character', () => {
  assert.equal(maskAthleteName('王飞雄'), '王*雄');
  assert.equal(maskAthleteName('王飞'), '王*');
  assert.equal(maskAthleteName('欧阳娜娜'), '欧*娜');
});

test('uses hidden fallback for empty, already hidden, or non-Chinese names', () => {
  assert.equal(hiddenAthleteName(), '隐藏');
  assert.equal(maskAthleteName(''), '隐藏');
  assert.equal(maskAthleteName('已隐藏选手'), '隐藏');
  assert.equal(maskAthleteName('Connor Baxter'), '隐藏');
});
