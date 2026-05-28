/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  compareCandidates,
  isPersonalChineseName,
  isYouthGroup,
  maskCertificateNo,
  normalizeCertificateRecord,
  parseChinaDate,
} = require('./coach-certificate-candidate-utils');

test('filters youth groups and non-person names', () => {
  assert.equal(isYouthGroup('U18男子组'), true);
  assert.equal(isYouthGroup('U12女子组'), true);
  assert.equal(isYouthGroup('公开男子组'), false);
  assert.equal(isPersonalChineseName('古小弟'), true);
  assert.equal(isPersonalChineseName('芜湖市冬协长江分会水上运动中心'), false);
});

test('sorts male adult candidates before others', () => {
  const ordered = [
    { name: '女子', maleScore: 0, resultCount: 20, lastResultDate: '2026-01-01' },
    { name: '男子', maleScore: 1, resultCount: 2, lastResultDate: '2025-01-01' },
  ].sort(compareCandidates);
  assert.equal(ordered[0].name, '男子');
});

test('normalizes certificate records from authorized CSV data', () => {
  const normalized = normalizeCertificateRecord({
    name: '谢海龙',
    certificate_no: 'CHNSUP2024CC02151',
    club_name: '杭州秋晴望月科技有限公司',
    expiry_date: '2027.6.30',
  });
  assert.equal(normalized.name, '谢海龙');
  assert.equal(normalized.certificateNo, 'CHNSUP2024CC02151');
  assert.equal(normalized.certificateNoMasked, 'CHNSUP****2151');
  assert.equal(normalized.expiryDate, '2027-06-30');
  assert.ok(normalized.rawHash);
});

test('normalizes certificate dates and masks certificate numbers', () => {
  assert.equal(parseChinaDate('2027年6月30日'), '2027-06-30');
  assert.equal(maskCertificateNo('CHNSUP2024CC02151'), 'CHNSUP****2151');
});
