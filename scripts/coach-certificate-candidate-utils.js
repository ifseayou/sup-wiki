/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require('node:crypto');

const SOURCE_TITLE = '全国桨板教练员信息公示';

function parseChinaDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function maskCertificateNo(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 8) return text;
  return `${text.slice(0, 6)}****${text.slice(-4)}`;
}

function isYouthGroup(group) {
  return /U\s*(?:9|12|15|18)\b|U(?:9|12|15|18)|青少年|少年|儿童|少儿/i.test(String(group || ''));
}

function isMaleGroup(group) {
  const text = String(group || '');
  return /男/.test(text) && !/女/.test(text);
}

function isPersonalChineseName(name) {
  const text = String(name || '').trim();
  return /^[\u4e00-\u9fa5·]{2,8}$/.test(text) && !/(队|俱乐部|协会|大学|学院|公司|中心|学校|代表队|水上运动)/.test(text);
}

function compareCandidates(a, b) {
  if (b.maleScore !== a.maleScore) return b.maleScore - a.maleScore;
  if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
  return String(b.lastResultDate || '').localeCompare(String(a.lastResultDate || ''));
}

function normalizeCertificateRecord(record) {
  const name = String(record.name || record.query_name || record.athlete_name || '').trim();
  const certificateNo = String(record.certificate_no || record.cert_no || record['证书编号'] || '').trim();
  const clubName = String(record.club_name || record.club || record['所属俱乐部'] || '').trim();
  const expiryDate = parseChinaDate(record.expiry_date || record.valid_until || record['证书有效期截止'] || '');
  const sourceUrl = String(record.source_url || record.url || '').trim();
  const sourceTitle = String(record.source_title || SOURCE_TITLE).trim();
  const excerpt = [name, certificateNo, clubName, expiryDate].filter(Boolean).join(' | ');
  return {
    name,
    certificateNo,
    certificateNoMasked: maskCertificateNo(certificateNo),
    clubName,
    expiryDate,
    sourceTitle,
    sourceUrl,
    sourceExcerpt: excerpt,
    rawHash: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex'),
  };
}

module.exports = {
  SOURCE_TITLE,
  compareCandidates,
  isMaleGroup,
  isPersonalChineseName,
  isYouthGroup,
  maskCertificateNo,
  normalizeCertificateRecord,
  parseChinaDate,
};
