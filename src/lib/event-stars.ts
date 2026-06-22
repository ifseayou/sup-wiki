export const EVENT_STAR_OPTIONS = [
  { value: '五星+', label: '五星+', score: '5.5' },
  { value: '五星', label: '五星', score: '5' },
  { value: '四星+', label: '四星+', score: '4.5' },
  { value: '四星', label: '四星', score: '4' },
  { value: '三星+', label: '三星+', score: '3.5' },
  { value: '三星', label: '三星', score: '3' },
  { value: '二星', label: '二星', score: '2' },
  { value: '一星', label: '一星', score: '1' },
  { value: '无星', label: '无星', score: '0.5' },
] as const;

export type EventStarLevel = (typeof EVENT_STAR_OPTIONS)[number]['value'];

export const EVENT_RESULT_STATUS_OPTIONS = [
  { value: 'none', label: '未采集' },
  { value: 'partial', label: '部分采集' },
  { value: 'top10_complete', label: '前十完成' },
  { value: 'extended_complete', label: '扩展完成' },
] as const;

export type EventResultCollectionStatus = (typeof EVENT_RESULT_STATUS_OPTIONS)[number]['value'];

export const EVENT_SOURCE_SCOPE_OPTIONS = [
  '全球',
  '亚洲',
  '国内外',
  '全国',
  '省市及周边区域',
  '本省市',
  '本地市',
  '本区县',
  '本乡镇',
  '俱乐部/品牌',
] as const;

export function getScoreForStarLevel(starLevel?: string | null) {
  return EVENT_STAR_OPTIONS.find((option) => option.value === starLevel)?.score ?? null;
}

/**
 * 等级赛事：与「赛事人员来源(source_scope)」1:1（参考 ArticleGuideTabs CHINA_RULE_ROWS）。
 * 全球→世界级, 亚洲→亚洲级, 国内外→国际级, 全国→国家级, 省市及周边→大区类, 本省市→省级,
 * 本地市→地市级, 本区县→区县级, 本乡镇→乡镇级/其它, 俱乐部/品牌→其它。
 */
export const EVENT_GRADE_BY_SCOPE: Record<string, string> = {
  '全球': '世界级',
  '亚洲': '亚洲级',
  '国内外': '国际级',
  '全国': '国家级',
  '省市及周边区域': '大区类',
  '本省市': '省级',
  '本地市': '地市级',
  '本区县': '区县级',
  '本乡镇': '乡镇级/其它',
  '俱乐部/品牌': '其它',
};

/**
 * 星级兜底推断等级（source_scope 为空时）。五星无法区分亚洲级/国际级，默认国际级。
 */
const EVENT_GRADE_BY_STAR: Record<string, string> = {
  '五星+': '世界级',
  '五星': '国际级',
  '四星+': '国家级',
  '四星': '国家级',
  '三星+': '大区类',
  '三星': '省级',
  '二星': '地市级',
  '一星': '区县级',
  '无星': '乡镇级/其它',
};

/**
 * 赛事等级标签：优先按 source_scope，缺失时按星级兜底，皆无则「未分级」。
 */
export function eventGradeLabel(sourceScope?: string | null, starLevel?: string | null): string {
  const scope = String(sourceScope || '').trim();
  if (scope && EVENT_GRADE_BY_SCOPE[scope]) return EVENT_GRADE_BY_SCOPE[scope];
  const star = String(starLevel || '').trim();
  if (star && EVENT_GRADE_BY_STAR[star]) return EVENT_GRADE_BY_STAR[star];
  return '未分级';
}

/**
 * 赛事等级选项（后台主控下拉）：等级 → 来源范围 + 星级（与 event-guide 表一一对应）。
 * 积分系数由 getScoreForStarLevel(star) 推导，国家级默认四星+，可在星级处手动微调四星/4.0。
 */
export const EVENT_GRADE_OPTIONS = [
  { grade: '世界级', source_scope: '全球', star: '五星+' },
  { grade: '亚洲级', source_scope: '亚洲', star: '五星' },
  { grade: '国际级', source_scope: '国内外', star: '五星' },
  { grade: '国家级', source_scope: '全国', star: '四星+' },
  { grade: '大区类', source_scope: '省市及周边区域', star: '三星+' },
  { grade: '省级', source_scope: '本省市', star: '三星' },
  { grade: '地市级', source_scope: '本地市', star: '二星' },
  { grade: '区县级', source_scope: '本区县', star: '一星' },
  { grade: '乡镇级/其它', source_scope: '本乡镇', star: '无星' },
] as const;

export function eventGradePreset(grade?: string | null) {
  return EVENT_GRADE_OPTIONS.find((option) => option.grade === grade) || null;
}

export function getEventStarBadgeStyle(starLevel?: string | null) {
  switch (starLevel) {
    case '五星+':
      return 'bg-[#F9E7B7] text-[#7C5A14] border-[#E3C56D]';
    case '五星':
      return 'bg-[#F6E7C8] text-[#7D5930] border-[#DEBE8D]';
    case '四星+':
      return 'bg-[#E9E5F7] text-[#57468A] border-[#C9BFE6]';
    case '四星':
      return 'bg-[#E5EEF5] text-[#3A5974] border-[#C4D7E8]';
    case '三星+':
      return 'bg-[#E6F1EA] text-[#3F6B4E] border-[#BDD7C5]';
    case '三星':
      return 'bg-[#EEF0E8] text-[#5F6750] border-[#D6DCC8]';
    case '二星':
      return 'bg-[#F1EEE8] text-[#6C6254] border-[#D8D0C2]';
    case '一星':
      return 'bg-[#F6F1EA] text-[#7A6B58] border-[#E2D8C9]';
    case '无星':
      return 'bg-[#F7F5F2] text-[#8A8078] border-[#E5DED5]';
    default:
      return 'bg-[#F5F1EB] text-[#8A8078] border-[#E0D8CC]';
  }
}

export function getEventResultStatusLabel(status?: string | null) {
  return EVENT_RESULT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? '未采集';
}
