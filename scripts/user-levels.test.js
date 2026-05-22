/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadUserLevelsModule() {
  const filename = path.resolve(__dirname, '../src/lib/user-levels.ts');
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
  normalizeUserLevel,
  resolveResultQueryLimit,
  DEFAULT_RESULT_QUERY_LIMITS,
} = loadUserLevelsModule();

test('normalizes current and legacy user levels', () => {
  assert.equal(normalizeUserLevel('free'), 'free');
  assert.equal(normalizeUserLevel('vip'), 'vip');
  assert.equal(normalizeUserLevel('svip'), 'svip');
  assert.equal(normalizeUserLevel('admin'), 'admin');
  assert.equal(normalizeUserLevel('blocked'), 'blocked');
  assert.equal(normalizeUserLevel('verified_athlete'), 'vip');
  assert.equal(normalizeUserLevel('trusted'), 'svip');
  assert.equal(normalizeUserLevel('unknown'), 'free');
  assert.equal(normalizeUserLevel(null), 'free');
});

test('resolves default result query limits by level', () => {
  assert.deepEqual(DEFAULT_RESULT_QUERY_LIMITS, {
    free: 5,
    vip: 20,
    svip: 200,
    admin: null,
    blocked: 0,
  });
  assert.deepEqual(resolveResultQueryLimit({ level: 'free' }), { level: 'free', limit: 5 });
  assert.deepEqual(resolveResultQueryLimit({ level: 'vip' }), { level: 'vip', limit: 20 });
  assert.deepEqual(resolveResultQueryLimit({ level: 'svip' }), { level: 'svip', limit: 200 });
});

test('respects custom limit for non-admin levels', () => {
  assert.deepEqual(resolveResultQueryLimit({ level: 'vip', dailyLimit: 8 }), { level: 'vip', limit: 8 });
  assert.deepEqual(resolveResultQueryLimit({ level: 'svip', dailyLimit: -5 }), { level: 'svip', limit: 0 });
  assert.deepEqual(resolveResultQueryLimit({ level: 'free', dailyLimit: 20000 }), { level: 'free', limit: 10000 });
});

test('keeps admin and i_add_u unlimited', () => {
  assert.deepEqual(resolveResultQueryLimit({ level: 'admin', dailyLimit: 1 }), { level: 'admin', limit: null });
  assert.deepEqual(resolveResultQueryLimit({ level: 'free', nickname: 'i_add_u' }), { level: 'admin', limit: null });
  assert.deepEqual(resolveResultQueryLimit({ level: 'vip', email: 'xiehl9527@gmail.com' }), { level: 'admin', limit: null });
  assert.deepEqual(resolveResultQueryLimit({ level: 'svip', openid: 'sh_1' }), { level: 'admin', limit: null });
});

test('blocked status overrides level and identity', () => {
  assert.deepEqual(resolveResultQueryLimit({ level: 'admin', status: 'blocked' }), { level: 'admin', limit: 0 });
  assert.deepEqual(resolveResultQueryLimit({ level: 'blocked', nickname: 'i_add_u' }), { level: 'blocked', limit: 0 });
});
