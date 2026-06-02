export interface ClaimDiffField {
  key: string;
  label: string;
  before: string | string[] | null;
  after: string | string[] | null;
  change: 'added' | 'changed' | 'removed';
}

type ComparableValue = string | number | string[] | null | undefined;

interface FieldSpec<T extends Record<string, unknown>> {
  key: string;
  label: string;
  current: (row: T) => ComparableValue;
  submitted: (row: T) => ComparableValue;
  previous?: (row: T) => ComparableValue;
}

function normalizeScalar(value: ComparableValue) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return normalizeArray(value);
  const text = String(value).trim();
  return text || null;
}

function normalizeArray(value: string[]) {
  const items = value.map((item) => String(item || '').trim()).filter(Boolean);
  return Array.from(new Set(items)).sort();
}

function sameValue(left: ComparableValue, right: ComparableValue) {
  const a = normalizeScalar(left);
  const b = normalizeScalar(right);
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(Array.isArray(a) ? a : []) === JSON.stringify(Array.isArray(b) ? b : []);
  }
  return a === b;
}

function diffChange(before: ComparableValue, after: ComparableValue): ClaimDiffField['change'] {
  const oldValue = normalizeScalar(before);
  const nextValue = normalizeScalar(after);
  if ((oldValue === null || (Array.isArray(oldValue) && oldValue.length === 0)) && nextValue !== null) return 'added';
  if (nextValue === null || (Array.isArray(nextValue) && nextValue.length === 0)) return 'removed';
  return 'changed';
}

function makeDiff<T extends Record<string, unknown>>(
  row: T,
  fields: FieldSpec<T>[],
  baseline: 'current' | 'previous',
) {
  return fields.flatMap((field) => {
    const before = baseline === 'current' ? field.current(row) : field.previous?.(row);
    const after = field.submitted(row);
    if (sameValue(before, after)) return [];
    return [{
      key: field.key,
      label: field.label,
      before: normalizeScalar(before),
      after: normalizeScalar(after),
      change: diffChange(before, after),
    }];
  });
}

function joinLocation(province: unknown, city: unknown) {
  return [province, city].map((item) => String(item || '').trim()).filter(Boolean).join(' / ') || null;
}

function publicProfile(row: Record<string, unknown>) {
  const source = row.current_public_profile;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, unknown>;
}

export function buildAthleteClaimDiffs(row: Record<string, unknown>) {
  const fields: FieldSpec<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: '姓名',
      current: (item) => item.current_name as ComparableValue,
      submitted: (item) => item.submitted_name as ComparableValue,
      previous: (item) => item.previous_submitted_name as ComparableValue,
    },
    {
      key: 'avatar',
      label: '头像',
      current: (item) => item.current_photo as ComparableValue,
      submitted: (item) => item.submitted_avatar_url as ComparableValue,
      previous: (item) => item.previous_submitted_avatar_url as ComparableValue,
    },
    {
      key: 'birth',
      label: '出生信息',
      current: (item) => publicProfile(item).birth_date as ComparableValue || publicProfile(item).birth_year as ComparableValue,
      submitted: (item) => item.submitted_birth_date as ComparableValue || item.submitted_birth_year as ComparableValue,
      previous: (item) => item.previous_submitted_birth_date as ComparableValue || item.previous_submitted_birth_year as ComparableValue,
    },
    {
      key: 'hometown',
      label: '籍贯',
      current: (item) => joinLocation(publicProfile(item).hometown_province || item.current_province, publicProfile(item).hometown_city || item.current_city),
      submitted: (item) => joinLocation(item.submitted_hometown_province, item.submitted_hometown_city),
      previous: (item) => joinLocation(item.previous_submitted_hometown_province, item.previous_submitted_hometown_city),
    },
    {
      key: 'living',
      label: '现居',
      current: (item) => joinLocation(publicProfile(item).living_province, publicProfile(item).living_city),
      submitted: (item) => joinLocation(item.submitted_living_province, item.submitted_living_city),
      previous: (item) => joinLocation(item.previous_submitted_living_province, item.previous_submitted_living_city),
    },
    {
      key: 'started_sup_year',
      label: '开始桨板',
      current: (item) => publicProfile(item).started_sup_year as ComparableValue,
      submitted: (item) => item.submitted_started_sup_year as ComparableValue,
      previous: (item) => item.previous_submitted_started_sup_year as ComparableValue,
    },
    {
      key: 'intro',
      label: '简介',
      current: (item) => item.current_bio as ComparableValue,
      submitted: (item) => item.submitted_intro as ComparableValue,
      previous: (item) => item.previous_submitted_intro as ComparableValue,
    },
    {
      key: 'sup_photos',
      label: '桨板照片',
      current: (item) => item.current_photo_urls as ComparableValue,
      submitted: (item) => item.submitted_sup_photo_urls as ComparableValue,
      previous: (item) => item.previous_submitted_sup_photo_urls as ComparableValue,
    },
    {
      key: 'bib_number',
      label: '校验号码牌',
      current: (item) => item.verified_bib_number as ComparableValue,
      submitted: (item) => item.submitted_bib_number as ComparableValue,
      previous: (item) => item.previous_submitted_bib_number as ComparableValue,
    },
  ];

  return {
    againstCurrent: makeDiff(row, fields, 'current'),
    againstPreviousSubmission: makeDiff(row, fields, 'previous'),
  };
}
