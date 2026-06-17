'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';

interface Portrait {
  overview: { total: number; claimed: number; draft: number; has_photo: number; gender_known: number; elite: number };
  gender: { key: string; n: number }[];
  data_quality: { gender_inferred: number; photo_missing: number; published: number };
  nationality: { china: number; foreign: number; unknown: number; foreign_top: { name: string; n: number }[] };
  provinces: { province: string; n: number }[];
  elite_status: { key: string; n: number }[];
  activity: { bucket: string; athletes: number }[];
}
interface Family { family: string; label: string; rows: number; athletes: number; events: number }
interface Group { group_key: string; label: string; rows: number; athletes: number; events: number; variants: number }
interface Cross { genders: { key: string; label: string }[]; families: { key: string; label: string }[]; matrix: number[][] }
interface AnalyticsData {
  athlete_portrait: Portrait;
  group_analysis: { families: Family[]; groups: Group[]; gender_family_cross: Cross };
}
interface DrillAthlete { athlete_id: number; name: string; appearances: number; events: number; best_rank: number | null }

const GENDER_DISPLAY: Record<string, string> = { male: '男子', female: '女子', mixed: '混合', unknown: '未知' };
const ELITE_DISPLAY: Record<string, string> = { none: '普通', formal: '精英正式', reserve: '精英候补' };
const ACTIVITY_ORDER = ['1', '2-5', '6-10', '10+'];

function Bars({ items, accent = '#B79B78' }: { items: { label: string; value: number; sub?: string }[]; accent?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-[#6B5E50]" title={it.label}>{it.label}</span>
          <div className="flex-1 h-5 rounded bg-[#F1E8DA] overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(it.value / max) * 100}%`, background: accent }} />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-[#5E554D]">{it.value.toLocaleString()}{it.sub ? <span className="text-[#A89A88]"> {it.sub}</span> : null}</span>
        </div>
      ))}
      {items.length === 0 && <div className="text-sm text-[#A89A88]">暂无数据</div>}
    </div>
  );
}

function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] p-5">
      <div className="mb-3">
        <div className="font-semibold text-[#443323]">{title}</div>
        {desc && <div className="text-xs text-[#A89A88] mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export default function AthleteAnalyticsPage() {
  const { token } = useAdminAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<{ key: string; label: string; items: DrillAthlete[]; total: number; page: number; totalPages: number } | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/athlete-analytics', { headers: authHeaders });
      const d = await readAdminResponse(res) as unknown as AnalyticsData;
      setData(d);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  const openGroupDrill = async (g: Group, page = 1) => {
    if (drill?.key === g.group_key && page === drill.page) { setDrill(null); return; }
    const res = await fetch(`/api/admin/athlete-analytics?group_key=${encodeURIComponent(g.group_key)}&page=${page}&pageSize=30`, { headers: authHeaders });
    const d = await readAdminResponse(res) as { items?: DrillAthlete[]; total?: number; totalPages?: number };
    setDrill({ key: g.group_key, label: g.label, items: d.items || [], total: d.total || 0, page, totalPages: d.totalPages || 1 });
  };

  const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#7D6B58] whitespace-nowrap';
  const td = 'px-4 py-3 text-[#5E554D]';

  if (!data) return <div className="p-6 text-[#8A8078]">{loading ? '加载中…' : '加载失败'}</div>;

  const p = data.athlete_portrait;
  const ga = data.group_analysis;
  const cards = [
    { num: p.overview.total.toLocaleString(), label: '在库运动员(已发布)' },
    { num: `${p.overview.total ? Math.round((p.overview.claimed / p.overview.total) * 100) : 0}%`, label: `已认领率(${p.overview.claimed})` },
    { num: p.overview.draft.toLocaleString(), label: '草稿档案' },
    { num: `${p.overview.total ? Math.round((p.overview.has_photo / p.overview.total) * 100) : 0}%`, label: '有头像率' },
    { num: `${p.overview.total ? Math.round((p.overview.gender_known / p.overview.total) * 100) : 0}%`, label: '性别已知率' },
    { num: p.overview.elite.toLocaleString(), label: '精英运动员' },
  ];

  return (
    <div className="p-6 max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#2E2118] mb-1">运动员分析</h1>
        <p className="text-sm text-[#8A8078]">基于标准化成绩与运动员档案，从运动员画像与组别两个视角看清整体情况。</p>
      </div>

      {/* 概览卡片 */}
      <div className="flex flex-wrap gap-3">
        {cards.map((c) => (
          <div key={c.label} className="min-w-[150px] flex-1 rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] px-5 py-4">
            <div className="text-2xl font-bold text-[#443323]">{c.num}</div>
            <div className="text-xs text-[#8A8078] mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 运动员画像 */}
      <h2 className="text-base font-bold text-[#5A4632] border-l-4 border-[#C8A879] pl-2">运动员画像</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="性别分布" desc="已发布运动员">
          <Bars items={p.gender.map((g) => ({ label: GENDER_DISPLAY[g.key] || g.key, value: g.n }))} />
        </Panel>
        <Panel title="精英状态" desc="正式 / 候补 / 普通">
          <Bars items={p.elite_status.map((e) => ({ label: ELITE_DISPLAY[e.key] || e.key, value: e.n }))} accent="#C8893B" />
        </Panel>
        <Panel title="国籍分布" desc="按归一国籍">
          <Bars items={[
            { label: '中国', value: p.nationality.china },
            ...p.nationality.foreign_top.map((f) => ({ label: f.name, value: f.n })),
            ...(p.nationality.unknown ? [{ label: '未知', value: p.nationality.unknown }] : []),
          ]} accent="#9C8466" />
        </Panel>
        <Panel title="地域分布" desc="Top 省份（已填写）">
          <Bars items={p.provinces.map((pr) => ({ label: pr.province, value: pr.n }))} />
        </Panel>
        <Panel title="参赛活跃度" desc="按个人成绩条数分段，区分一次性与核心选手">
          <Bars items={ACTIVITY_ORDER.map((b) => ({ label: `${b} 次`, value: p.activity.find((a) => a.bucket === b)?.athletes || 0 }))} accent="#7FA06A" />
        </Panel>
        <Panel title="数据质量" desc="需补全的脏数据">
          <Bars items={[
            { label: '性别靠推断', value: p.data_quality.gender_inferred, sub: '条' },
            { label: '缺头像', value: p.data_quality.photo_missing, sub: '人' },
          ]} accent="#C2410C" />
          <div className="text-xs text-[#A89A88] mt-2">基数：已发布 {p.data_quality.published.toLocaleString()} 人</div>
        </Panel>
      </div>

      {/* 组别分析 */}
      <h2 className="text-base font-bold text-[#5A4632] border-l-4 border-[#C8A879] pl-2">组别分析</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="项目族分布" desc="按标准化项目族的成绩人次">
          <Bars items={ga.families.map((f) => ({ label: f.label, value: f.rows, sub: `${f.athletes}人` }))} />
        </Panel>
        <Panel title="性别 × 项目族" desc="各性别在项目族的成绩人次">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EFE4D5] text-xs text-[#7D6B58]">
                  <th className="px-2 py-2 text-left">性别\项目族</th>
                  {ga.gender_family_cross.families.map((f) => <th key={f.key} className="px-2 py-2 text-right">{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ga.gender_family_cross.genders.map((g, gi) => (
                  <tr key={g.key} className="border-b border-[#F4ECDF]">
                    <td className="px-2 py-2 text-[#6B5E50]">{g.label}</td>
                    {ga.gender_family_cross.families.map((f, fi) => (
                      <td key={f.key} className="px-2 py-2 text-right tabular-nums text-[#5E554D]">{(ga.gender_family_cross.matrix[gi]?.[fi] || 0).toLocaleString()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* 标准化组别表 + 下钻 */}
      <div className="overflow-hidden rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9]">
        <div className="px-5 py-3 border-b border-[#EFE4D5]">
          <div className="font-semibold text-[#443323]">标准化组别分布</div>
          <div className="text-xs text-[#A89A88] mt-0.5">同义写法已归并；可点「运动员」下钻该组名单。variant=合并的原始写法数</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#E7DCCA] bg-[#F2E9DC]">
                <th className={th}>组别</th>
                <th className={th}>成绩人次</th>
                <th className={th}>运动员</th>
                <th className={th}>赛事</th>
                <th className={th}>写法数</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE4D5]">
              {ga.groups.map((g) => (
                <Fragment key={g.group_key}>
                  <tr className="transition-colors hover:bg-[#F8F4ED]">
                    <td className={td}>{g.label}{g.variants > 1 && <span className="ml-1 text-xs text-[#A89A88]">+{g.variants - 1}写法</span>}</td>
                    <td className={td}>{g.rows.toLocaleString()}</td>
                    <td className={td}>{g.athletes.toLocaleString()}</td>
                    <td className={td}>{g.events}</td>
                    <td className={td}>{g.variants}</td>
                    <td className={td}>
                      <button className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-[#6B5E50] transition-colors hover:bg-[#F8F4ED]" onClick={() => openGroupDrill(g)}>
                        {drill?.key === g.group_key ? '收起' : '运动员'}
                      </button>
                    </td>
                  </tr>
                  {drill?.key === g.group_key && (
                    <tr>
                      <td className="bg-[#FBF7F0] px-5 py-4" colSpan={6}>
                        <div className="font-semibold text-[#5E554D] mb-2">「{drill.label}」运动员（共 {drill.total} 人，第 {drill.page}/{drill.totalPages} 页）</div>
                        <div className="overflow-x-auto rounded-xl border border-[#EDE2D2] bg-white">
                          <table className="w-full min-w-[480px] text-xs">
                            <thead>
                              <tr className="border-b border-[#EDE2D2] bg-[#F7F0E4] text-[#7D6B58]">
                                <th className="px-3 py-2 text-left">运动员</th>
                                <th className="px-3 py-2 text-right">参赛次数</th>
                                <th className="px-3 py-2 text-right">赛事数</th>
                                <th className="px-3 py-2 text-right">最好名次</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1E8DA]">
                              {drill.items.map((a) => (
                                <tr key={a.athlete_id}>
                                  <td className="px-3 py-2 text-[#5E554D]">{a.name || `#${a.athlete_id}`}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{a.appearances}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{a.events}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{a.best_rank ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {drill.totalPages > 1 && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-[#8A8078]">
                            <button className="rounded border border-[#D8CCBA] bg-white px-2 py-1 disabled:opacity-40" disabled={drill.page <= 1}
                              onClick={() => openGroupDrill(g, drill.page - 1)}>上一页</button>
                            <button className="rounded border border-[#D8CCBA] bg-white px-2 py-1 disabled:opacity-40" disabled={drill.page >= drill.totalPages}
                              onClick={() => openGroupDrill(g, drill.page + 1)}>下一页</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
