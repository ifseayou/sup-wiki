/* eslint-disable @typescript-eslint/no-require-imports */

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTimeToSeconds } = require('./lib/result-time');

test('parses normal minute and hour race times', () => {
  assert.equal(parseTimeToSeconds('27:22.65'), 1642.65);
  assert.equal(parseTimeToSeconds('01:53:40'), 6820);
  assert.equal(parseTimeToSeconds('04:09:50'), 14990);
  assert.equal(parseTimeToSeconds('00:20:09.76'), 1209.76);
});

test('parses MM:SS:centiseconds when the first segment cannot be hours', () => {
  assert.equal(parseTimeToSeconds('37:38:21'), 2258.21);
  assert.equal(parseTimeToSeconds('20:40:87'), 1240.87);
});
