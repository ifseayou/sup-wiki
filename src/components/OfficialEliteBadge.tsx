import Tooltip from '@/components/Tooltip';

type EliteEventStatus = 'formal' | 'reserve';

const COPY: Record<EliteEventStatus, { label: string; tip: string; className: string }> = {
  formal: {
    label: '官方精英',
    tip: '体育总局水上中心公示的中国桨板精英赛事正式运动员名单，作为精英类赛事报名资格审核依据。',
    className: 'border-[#D9A441] bg-[#FFF3C4] text-[#8A570D] shadow-[0_4px_12px_rgba(167,107,20,0.16)]',
  },
  reserve: {
    label: '官方精英(补)',
    tip: '中国桨板精英赛事候补运动员名单，正式名单成员优先。',
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
  const title = groupList.length ? `${config.tip}\n组别：${groupList.join('、')}` : config.tip;

  return (
    <span
      className={`hidden shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black md:inline-flex ${config.className}`}
      title={title}
      aria-label={config.label}
    >
      <span aria-hidden="true">★</span>
      <Tooltip tip={title}>{config.label}</Tooltip>
    </span>
  );
}
