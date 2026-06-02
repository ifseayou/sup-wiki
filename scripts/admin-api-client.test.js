/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filename = path.resolve(__dirname, '../src/lib/admin-api-client.ts');
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

const { readAdminResponse } = loadModule();

test('readAdminResponse returns parsed JSON for successful responses', async () => {
  const response = new Response(JSON.stringify({ items: [{ id: 1 }], total: 1 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await readAdminResponse(response);
  assert.deepEqual(data, { items: [{ id: 1 }], total: 1 });
});

test('readAdminResponse surfaces upstream detail errors', async () => {
  const response = new Response(JSON.stringify({ detail: 'Bad Request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(() => readAdminResponse(response), /Bad Request/);
});

test('readAdminResponse surfaces non JSON error bodies', async () => {
  const response = new Response('gateway failed', { status: 502 });
  await assert.rejects(() => readAdminResponse(response), /gateway failed/);
});

