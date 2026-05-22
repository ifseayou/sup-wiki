/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadPaceModule() {
  const filename = path.resolve(__dirname, '../src/lib/result-pace.ts');
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

const { getResultPaceDisplay } = loadPaceModule();

test('formats 7km result pace from seconds', () => {
  assert.equal(getResultPaceDisplay({
    discipline: '7公里',
    gender_group: '男子精英组',
    time_seconds: 3588.83,
    finish_time: '0:59:48.83',
    result_status_code: null,
  }).pace_display, '8:33/km');
});

test('formats 33km result pace from seconds', () => {
  assert.equal(getResultPaceDisplay({
    discipline: '33公里',
    gender_group: '勇士组（公开组） 男子 · 决赛',
    time_seconds: 13868,
    finish_time: '03:51:08',
    result_status_code: null,
  }).pace_display, '7:00/km');
});

test('does not show pace for short distance or abnormal finish', () => {
  assert.equal(getResultPaceDisplay({
    discipline: '200米',
    gender_group: '男子公开组',
    time_seconds: 68,
    finish_time: '01:08',
    result_status_code: null,
  }).pace_display, '-');
  assert.equal(getResultPaceDisplay({
    discipline: '7公里',
    gender_group: '男子精英组',
    time_seconds: 3588.83,
    finish_time: 'DNF',
    result_status_code: null,
  }).pace_display, '-');
});
