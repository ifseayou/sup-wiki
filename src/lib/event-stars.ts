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
