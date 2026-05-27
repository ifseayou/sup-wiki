export type NormalizedDisciplineFamily =
  | 'sprint'
  | 'technical'
  | 'distance'
  | 'marathon'
  | 'team'
  | 'special'
  | 'unknown';

export interface NormalizedDiscipline {
  original: string;
  normalized_key: string;
  family: NormalizedDisciplineFamily;
  distance_min_m: number | null;
  distance_max_m: number | null;
  is_team_event: boolean;
  include_in_athlete_rating: boolean;
  confidence: number;
  reason: string;
}

export type NormalizedGender = 'male' | 'female' | 'mixed' | 'open_unknown';
export type NormalizedAgeBand =
  | 'u9'
  | 'u12'
  | 'u15'
  | 'u16'
  | 'u18'
  | 'youth'
  | 'college'
  | 'open'
  | 'masters'
  | 'kahuna'
  | 'adult_a'
  | 'adult_b'
  | 'unknown';
export type NormalizedCompetitiveTier = 'elite' | 'open' | 'mass' | 'recreational' | 'unknown';
export type NormalizedTeamType = 'individual' | 'dragon_board' | 'relay' | 'family' | 'mixed_double' | 'team' | 'unknown';

export interface NormalizedGroup {
  original: string;
  gender: NormalizedGender;
  age_band: NormalizedAgeBand;
  competitive_tier: NormalizedCompetitiveTier;
  team_type: NormalizedTeamType;
  normalized_group_key: string;
  confidence: number;
  reason: string;
}

function compact(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[（）]/g, (match) => (match === '（' ? '(' : ')'))
    .toLowerCase();
}

function hasAny(text: string, patterns: Array<string | RegExp>) {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') return text.includes(pattern.toLowerCase());
    return pattern.test(text);
  });
}

function distanceKey(distance: number): Pick<NormalizedDiscipline, 'normalized_key' | 'family' | 'distance_min_m' | 'distance_max_m' | 'include_in_athlete_rating' | 'reason'> {
  if (distance <= 250) {
    return {
      normalized_key: 'sprint_200m',
      family: 'sprint',
      distance_min_m: 0,
      distance_max_m: 250,
      include_in_athlete_rating: true,
      reason: 'distance<=250m',
    };
  }
  if (distance < 3000) {
    return {
      normalized_key: 'technical_short',
      family: 'technical',
      distance_min_m: 800,
      distance_max_m: 5000,
      include_in_athlete_rating: true,
      reason: 'short technical distance',
    };
  }
  if (distance < 5000) {
    return {
      normalized_key: 'distance_3km',
      family: 'distance',
      distance_min_m: 3000,
      distance_max_m: 4999,
      include_in_athlete_rating: true,
      reason: '3km distance band',
    };
  }
  if (distance <= 10000) {
    return {
      normalized_key: 'distance_5_10km',
      family: 'distance',
      distance_min_m: 5000,
      distance_max_m: 10000,
      include_in_athlete_rating: true,
      reason: '5-10km distance band',
    };
  }
  if (distance <= 18000) {
    return {
      normalized_key: 'distance_10_18km',
      family: 'distance',
      distance_min_m: 10001,
      distance_max_m: 18000,
      include_in_athlete_rating: true,
      reason: '10-18km distance band',
    };
  }
  return {
    normalized_key: 'marathon_18km_plus',
    family: 'marathon',
    distance_min_m: 18001,
    distance_max_m: null,
    include_in_athlete_rating: true,
    reason: '18km+ distance band',
  };
}

function extractDistanceMeters(text: string) {
  const km = text.match(/(\d+(?:\.\d+)?)\s*k(?:m|公里)?|(\d+(?:\.\d+)?)公里/i);
  if (km) return Math.round(Number(km[1] || km[2]) * 1000);
  const meters = text.match(/(\d{2,4})\s*m|(\d{2,4})米/i);
  if (meters) return Number(meters[1] || meters[2]);
  return null;
}

export function normalizeResultDiscipline(
  discipline: string,
  boardClass?: string | null,
  roundLabel?: string | null,
): NormalizedDiscipline {
  const original = String(discipline || '').trim();
  const text = compact(`${discipline || ''}${boardClass || ''}${roundLabel || ''}`);

  const base = {
    original,
    distance_min_m: null,
    distance_max_m: null,
    is_team_event: false,
    include_in_athlete_rating: false,
    confidence: 0,
  };

  if (!text) {
    return { ...base, normalized_key: 'unknown', family: 'unknown', reason: 'empty discipline' };
  }

  if (hasAny(text, ['龙板', '四桨', '团队', '团体', '家庭', '接力', '混合双人'])) {
    let normalizedKey = 'team_dragon_board';
    if (text.includes('接力')) normalizedKey = 'team_relay';
    if (text.includes('家庭')) normalizedKey = 'team_family';
    if (text.includes('混合双人')) normalizedKey = 'team_mixed_double';
    return {
      ...base,
      normalized_key: normalizedKey,
      family: 'team',
      is_team_event: true,
      confidence: 0.98,
      reason: 'team event keyword',
    };
  }

  if (hasAny(text, ['自由式', '全能战士', 'boardbattle'])) {
    return {
      ...base,
      normalized_key: text.includes('自由式') ? 'special_freestyle' : 'special_omnium',
      family: 'special',
      confidence: 0.98,
      reason: 'special score event',
    };
  }

  if (hasAny(text, ['趴板'])) {
    return {
      ...base,
      normalized_key: 'special_prone_paddle',
      family: 'special',
      confidence: 0.95,
      reason: 'non-SUP prone paddle event',
    };
  }

  if (hasAny(text, ['技巧', '技术', '绕标', '四象八牛', 'itt', '圈速'])) {
    return {
      ...base,
      normalized_key: 'technical_short',
      family: 'technical',
      distance_min_m: 800,
      distance_max_m: 5000,
      include_in_athlete_rating: true,
      confidence: 0.92,
      reason: 'technical keyword',
    };
  }

  if (hasAny(text, ['冲刺', '短距离', '竞速', '直道'])) {
    const distance = extractDistanceMeters(text);
    return {
      ...base,
      normalized_key: distance && distance > 250 ? distanceKey(distance).normalized_key : 'sprint_200m',
      family: distance && distance > 250 ? distanceKey(distance).family : 'sprint',
      distance_min_m: distance && distance > 250 ? distanceKey(distance).distance_min_m : 0,
      distance_max_m: distance && distance > 250 ? distanceKey(distance).distance_max_m : 250,
      include_in_athlete_rating: true,
      confidence: 0.9,
      reason: 'sprint/race keyword',
    };
  }

  if (hasAny(text, ['长程', '长距离', '耐力', '马拉松'])) {
    const distance = extractDistanceMeters(text);
    if (distance) {
      const mapped = distanceKey(distance);
      return { ...base, ...mapped, is_team_event: false, confidence: 0.94 };
    }
    return {
      ...base,
      normalized_key: 'distance_10_18km',
      family: 'distance',
      distance_min_m: 5000,
      distance_max_m: 35000,
      include_in_athlete_rating: true,
      confidence: 0.66,
      reason: 'distance keyword without exact distance',
    };
  }

  const distance = extractDistanceMeters(text);
  if (distance) {
    const mapped = distanceKey(distance);
    return { ...base, ...mapped, is_team_event: false, confidence: 0.88 };
  }

  return { ...base, normalized_key: 'unknown', family: 'unknown', reason: 'no matching rule' };
}

function normalizeGender(text: string): { gender: NormalizedGender; confidence: number; reason: string } {
  if (hasAny(text, ['混合', '无差别'])) return { gender: 'mixed', confidence: 0.9, reason: 'mixed keyword' };
  if (text.includes('男子') || text.includes('男')) return { gender: 'male', confidence: 0.95, reason: 'male keyword' };
  if (text.includes('女子') || text.includes('女')) return { gender: 'female', confidence: 0.95, reason: 'female keyword' };
  return { gender: 'open_unknown', confidence: 0.45, reason: 'gender unknown' };
}

function normalizeAgeBand(text: string): { age_band: NormalizedAgeBand; confidence: number; reason: string } {
  if (/u9/.test(text)) return { age_band: 'u9', confidence: 0.98, reason: 'U9 keyword' };
  if (/u12/.test(text)) return { age_band: 'u12', confidence: 0.98, reason: 'U12 keyword' };
  if (/u15/.test(text)) return { age_band: 'u15', confidence: 0.98, reason: 'U15 keyword' };
  if (/u16/.test(text)) return { age_band: 'u16', confidence: 0.98, reason: 'U16 keyword' };
  if (/u18/.test(text)) return { age_band: 'u18', confidence: 0.98, reason: 'U18 keyword' };
  if (hasAny(text, ['青少年', '青年'])) return { age_band: 'youth', confidence: 0.82, reason: 'youth keyword' };
  if (hasAny(text, ['高校'])) return { age_band: 'college', confidence: 0.95, reason: 'college keyword' };
  if (hasAny(text, ['卡胡纳'])) return { age_band: 'kahuna', confidence: 0.95, reason: 'kahuna keyword' };
  if (hasAny(text, ['大师'])) return { age_band: 'masters', confidence: 0.95, reason: 'masters keyword' };
  if (hasAny(text, ['成年组(a组)', '成年(a组)', '成年a组'])) return { age_band: 'adult_a', confidence: 0.95, reason: 'adult A group keyword' };
  if (hasAny(text, ['成年组(b组)', '成年(b组)', '成年b组'])) return { age_band: 'adult_b', confidence: 0.95, reason: 'adult B group keyword' };
  if (hasAny(text, ['公开', '大众', '精英'])) return { age_band: 'open', confidence: 0.82, reason: 'open-age keyword' };
  return { age_band: 'unknown', confidence: 0.45, reason: 'age band unknown' };
}

function normalizeTier(text: string): { competitive_tier: NormalizedCompetitiveTier; confidence: number; reason: string } {
  if (hasAny(text, ['精英', '黄金'])) return { competitive_tier: 'elite', confidence: 0.92, reason: 'elite keyword' };
  if (hasAny(text, ['公开', '白银', '青铜'])) return { competitive_tier: 'open', confidence: 0.85, reason: 'open keyword' };
  if (hasAny(text, ['大众'])) return { competitive_tier: 'mass', confidence: 0.9, reason: 'mass keyword' };
  if (hasAny(text, ['勇士'])) return { competitive_tier: 'recreational', confidence: 0.75, reason: 'recreational keyword' };
  return { competitive_tier: 'unknown', confidence: 0.5, reason: 'tier unknown' };
}

function normalizeTeamType(text: string): { team_type: NormalizedTeamType; confidence: number; reason: string } {
  if (hasAny(text, ['家庭'])) return { team_type: 'family', confidence: 0.95, reason: 'family keyword' };
  if (hasAny(text, ['混合双人', '双人'])) return { team_type: 'mixed_double', confidence: 0.9, reason: 'double keyword' };
  if (hasAny(text, ['接力'])) return { team_type: 'relay', confidence: 0.95, reason: 'relay keyword' };
  if (hasAny(text, ['龙板'])) return { team_type: 'dragon_board', confidence: 0.98, reason: 'dragon board keyword' };
  if (hasAny(text, ['团体', '团队', '四人', '三人'])) return { team_type: 'team', confidence: 0.85, reason: 'team keyword' };
  return { team_type: 'individual', confidence: 0.8, reason: 'default individual' };
}

export function normalizeResultGroup(
  genderGroup: string,
  boardClass?: string | null,
  teamName?: string | null,
): NormalizedGroup {
  const original = String(genderGroup || '').trim();
  const text = compact(`${genderGroup || ''}${boardClass || ''}${teamName || ''}`);
  const gender = normalizeGender(text);
  const age = normalizeAgeBand(text);
  const tier = normalizeTier(text);
  const team = normalizeTeamType(text);
  const normalized_group_key = [gender.gender, age.age_band, tier.competitive_tier, team.team_type].join('_');
  const confidence = Math.min(gender.confidence, age.confidence, team.confidence);

  return {
    original,
    gender: gender.gender,
    age_band: age.age_band,
    competitive_tier: tier.competitive_tier,
    team_type: team.team_type,
    normalized_group_key,
    confidence,
    reason: [gender.reason, age.reason, tier.reason, team.reason].join('; '),
  };
}
