/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const test = require('node:test');
const ts = require('typescript');

function loadNormalizationModule() {
  const filename = path.resolve(__dirname, '../src/lib/result-normalization.ts');
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

const { normalizeResultDiscipline, normalizeResultGroup } = loadNormalizationModule();

test('normalizes sprint aliases to sprint_200m', () => {
  for (const value of ['200米', '200M冲刺赛', '200米短距离赛', '200米竞速赛', '直道竞速']) {
    const normalized = normalizeResultDiscipline(value);
    assert.equal(normalized.normalized_key, 'sprint_200m');
    assert.equal(normalized.family, 'sprint');
    assert.equal(normalized.include_in_athlete_rating, true);
  }
});

test('normalizes technical aliases to technical_short', () => {
  for (const value of ['1公里技术赛', '1km技术赛', '800米技巧赛', '1.5KM充气板技巧赛', '绕标赛', '四象八牛挑战赛', 'ITT圈速挑战赛']) {
    const normalized = normalizeResultDiscipline(value);
    assert.equal(normalized.normalized_key, 'technical_short');
    assert.equal(normalized.family, 'technical');
    assert.equal(normalized.include_in_athlete_rating, true);
  }
});

test('normalizes distance bands from discipline text', () => {
  assert.equal(normalizeResultDiscipline('3公里').normalized_key, 'distance_3km');
  assert.equal(normalizeResultDiscipline('6km长距离赛').normalized_key, 'distance_5_10km');
  assert.equal(normalizeResultDiscipline('10公里耐力赛').normalized_key, 'distance_5_10km');
  assert.equal(normalizeResultDiscipline('12KM长距离赛').normalized_key, 'distance_10_18km');
  assert.equal(normalizeResultDiscipline('16公里').normalized_key, 'distance_10_18km');
  assert.equal(normalizeResultDiscipline('33公里').normalized_key, 'marathon_18km_plus');
});

test('keeps team and special events out of athlete rating', () => {
  for (const value of ['龙板赛', '200米龙板家庭三人赛', '团体接力赛', '丝缆 四桨龙板赛']) {
    const normalized = normalizeResultDiscipline(value);
    assert.equal(normalized.family, 'team');
    assert.equal(normalized.is_team_event, true);
    assert.equal(normalized.include_in_athlete_rating, false);
  }
  assert.equal(normalizeResultDiscipline('BoardBattle 全能战士').include_in_athlete_rating, false);
  assert.equal(normalizeResultDiscipline('南浔国际桨板公开赛自由式桨板').include_in_athlete_rating, false);
});

test('normalizes common individual gender groups', () => {
  assert.deepEqual(
    pickGroup(normalizeResultGroup('公开组男子')),
    { gender: 'male', age_band: 'open', competitive_tier: 'open', team_type: 'individual' },
  );
  assert.deepEqual(
    pickGroup(normalizeResultGroup('公开女子组')),
    { gender: 'female', age_band: 'open', competitive_tier: 'open', team_type: 'individual' },
  );
  assert.equal(normalizeResultGroup('大师男子组').age_band, 'masters');
  assert.equal(normalizeResultGroup('卡胡纳组女子').age_band, 'kahuna');
  assert.equal(normalizeResultGroup('U12男子组').age_band, 'u12');
  assert.equal(normalizeResultGroup('男子成年组（A组）').age_band, 'adult_a');
  assert.equal(normalizeResultGroup('高校组女子').age_band, 'college');
});

test('normalizes team group types', () => {
  assert.equal(normalizeResultGroup('龙板组').team_type, 'dragon_board');
  assert.equal(normalizeResultGroup('混合四人龙板').team_type, 'dragon_board');
  assert.equal(normalizeResultGroup('家庭组三人龙板').team_type, 'family');
  assert.equal(normalizeResultGroup('接力组').team_type, 'relay');
  assert.equal(normalizeResultGroup('混合双人桨板组').team_type, 'mixed_double');
});

function pickGroup(value) {
  return {
    gender: value.gender,
    age_band: value.age_band,
    competitive_tier: value.competitive_tier,
    team_type: value.team_type,
  };
}
