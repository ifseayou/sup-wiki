import Tooltip from '@/components/Tooltip';

const TIP = '体育总局水上中心公示的中国桨板精英赛事正式运动员名单，作为精英类赛事报名资格审核依据。';

export default function OfficialEliteBadge({ groups }: { groups?: string[] | string | null }) {
  const groupList = Array.isArray(groups)
    ? groups.filter(Boolean)
    : typeof groups === 'string'
      ? groups.split(/[、,，;]/).map((item) => item.trim()).filter(Boolean)
      : [];
  const title = groupList.length ? `${TIP}\n组别：${groupList.join('、')}` : TIP;

  return (
    <span
      className="hidden shrink-0 items-center gap-1 rounded-full border border-[#D9A441] bg-[#FFF3C4] px-2.5 py-1 text-[11px] font-black text-[#8A570D] shadow-[0_4px_12px_rgba(167,107,20,0.16)] md:inline-flex"
      title={title}
      aria-label="官方精英名单"
    >
      <span aria-hidden="true">★</span>
      <Tooltip tip={title}>官方精英名单</Tooltip>
    </span>
  );
}
