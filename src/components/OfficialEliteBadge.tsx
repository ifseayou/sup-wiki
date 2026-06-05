import Tooltip from '@/components/Tooltip';

type EliteEventStatus = 'formal' | 'reserve';

// 金=正式(formal)，银=候补(reserve)，统一文案为「精英」，仅以颜色区分。
const COPY: Record<EliteEventStatus, { suffix: string; className: string }> = {
  formal: {
    suffix: '正式运动员',
    className: 'border-[#D9A441] bg-[#FFF3C4] text-[#8A570D] shadow-[0_4px_12px_rgba(167,107,20,0.16)]',
  },
  reserve: {
    suffix: '候补运动员',
    className: 'border-[#B8BDC7] bg-[#F3F5F8] text-[#56606F] shadow-[0_4px_12px_rgba(86,96,111,0.14)]',
  },
};

export default function OfficialEliteBadge({ status = 'formal', groups }: { status?: EliteEventStatus | null; groups?: string[] | string | null }) {
  const config = COPY[status || 'formal'] || COPY.formal;
  const groupList = Array.isArray(groups)
    ? groups.filter(Boolean)
    : typeof groups === 'string'
      ? groups.split(/[、,，;]/).map((item) => item.trim()).filter(Boolean)
      : [];
  const groupPart = groupList.length ? `${groupList.join('、')}-` : '';
  const title = `中国桨板精英赛事-${groupPart}${config.suffix}`;

  return (
    <span
      className={`hidden shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black md:inline-flex ${config.className}`}
      title={title}
      aria-label="精英"
    >
      <span aria-hidden="true">★</span>
      <Tooltip tip={title}>精英</Tooltip>
    </span>
  );
}
