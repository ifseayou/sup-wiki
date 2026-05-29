/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const { inferGenderFromGroup, inferGenderFromVotes } = require('./athlete-gender-utils');

test('infers gender from common result groups', () => {
  assert.equal(inferGenderFromGroup('公开男子组'), 'male');
  assert.equal(inferGenderFromGroup('大师女子组'), 'female');
  assert.equal(inferGenderFromGroup('混合四人龙板'), 'mixed');
  assert.equal(inferGenderFromGroup('公开组'), 'unknown');
});

test('uses strong majority vote for athlete gender', () => {
  assert.deepEqual(inferGenderFromVotes({ male: 8, female: 1, mixed: 0 }), { gender: 'male', confidence: 0.889 });
  assert.deepEqual(inferGenderFromVotes({ male: 2, female: 2, mixed: 0 }), { gender: 'unknown', confidence: 0.5 });
  assert.deepEqual(inferGenderFromVotes({ male: 0, female: 9, mixed: 0 }), { gender: 'female', confidence: 1 });
  assert.deepEqual(inferGenderFromVotes({ male: 1, female: 0, mixed: 9 }), { gender: 'mixed', confidence: 0.9 });
});
