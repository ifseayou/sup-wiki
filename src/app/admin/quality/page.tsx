'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';

interface EventQuality {
  event_id: number;
  event_name: string;
  start_date: string | null;
  result_status: string | null;
  result_count: number;
  unmatched_count: number;
  low_conf_count: number;
  norm_coverage: number;
  modules: number;
  multi_first: number;
  no_first: number;
  duplicate_bib: number;
  gender_mismatch: number;
  rank_gap: number;
  issue_score: number;
}

interface GlobalStats {
  total_results: number;
  unmatched_athletes: number;
  low_confidence: number;
  events_with_results: number;
  normalization_coverage: number;
  events_with_issues: number;
  gender_mismatch: number;
  rank_gap_units: number;
}

interface ModuleRow {
  discipline: string;
  gender_group: string;
  board_class: string | null;
  round_label: string | null;
  count: number;
  firsts: number;
  unmatched: number;
  low_conf: number;
  norm_unknown: number;
  multi_first: boolean;
  no_first: boolean;
}

interface ProblemRow {
  result_id: number;
  athlete_name: string;
  discipline: string;
  gender_group: string;
  board_class: string | null;
  round_label: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
  issue_type: 'unmatched' | 'low_conf' | 'multi_first' | 'dup_bib' | 'rank_gap' | 'gender_mismatch';
}

const resultStatusLabels: Record<string, string> = {
  none: '未采集', partial: '部分采集', top10_complete: '前十完成', extended_complete: '扩展完成',
};

const ISSUE_LABEL: Record<string, { text: string; cls: string }> = {
  multi_first: { text: '多第一', cls: 'bg-[#FDE2E2] text-[#B91C1C]' },
  rank_gap: { text: '名次断号', cls: 'bg-[#FDE2E2] text-[#B91C1C]' },
  gender_mismatch: { text: '性别错组', cls: 'bg-[#FDE2E2] text-[#B91C1C]' },
  dup_bib: { text: '重号', cls: 'bg-[#FDE2E2] text-[#B91C1C]' },
  unmatched: { text: '未匹配', cls: 'bg-[#FCE9D6] text-[#C2410C]' },
  low_conf: { text: '低置信', cls: 'bg-[#FCE9D6] text-[#C2410C]' },
};

export default function QualityDashboardPage() {
  const { token } = useAdminAuth();
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [events, setEvents] = useState<EventQuality[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<{ eventId: number; modules: ModuleRow[]; dups: { bib_number: string; count: number }[]; problems: ProblemRow[] } | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quality?page=${page}&pageSize=20`, { headers: authHeaders });
      const data = await readAdminResponse(res) as { global?: GlobalStats; items?: EventQuality[]; total?: number; totalPages?: number };
      if (data.global) setGlobal(data.global);
      setEvents(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPageInput(String(page));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  const openDrill = async (eventId: number) => {
    if (drill?.eventId === eventId) { setDrill(null); return; }
    const res = await fetch(`/api/admin/quality?event_id=${eventId}`, { headers: authHeaders });
    const data = await readAdminResponse(res) as { modules?: ModuleRow[]; duplicate_bibs?: { bib_number: string; count: number }[]; problem_results?: ProblemRow[] };
    setDrill({ eventId, modules: data.modules || [], dups: data.duplicate_bibs || [], problems: data.problem_results || [] });
  };

  const jumpToPage = () => {
    const n = Math.max(1, Math.min(totalPages, Number(pageInput) || 1));
    setPage(n);
  };

  const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#7D6B58] whitespace-nowrap';
  const td = 'px-4 py-3 text-[#5E554D]';
  const btn = 'rounded-lg border border-[#D8CCBA] bg-white px-3 py-1.5 text-sm text-[#6B5E50] transition-colors hover:bg-[#F8F4ED] disabled:opacity-40';
  const badge = (n: number, cls: string) => n > 0 ? <span className={`font-semibold ${cls}`}>{n}</span> : <span className="text-[#C9BCA8]">0</span>;

  return (
    <div className="p-6 max-w-[1200px]">
      <h1 className="text-xl font-bold text-[#2E2118] mb-1">成绩质量仪表盘</h1>
      <p className="text-sm text-[#8A8078] mb-5">跨赛事数据可信度核查：未匹配运动员、决赛多第一/缺第一、名次断号(1224规则，允许并列)、性别错组(疑同名身份合并)、号码牌重复、标准化覆盖率、低置信成绩。预赛/复赛分组按 heats 处理不误报。按问题数降序排列，可下钻到具体成绩行直达编辑。</p>

      {global && (
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { num: global.total_results.toLocaleString(), label: '成绩总数', color: 'text-[#443323]' },
            { num: global.events_with_results, label: '有成绩赛事', color: 'text-[#443323]' },
            { num: global.events_with_issues, label: '存在问题的赛事', color: global.events_with_issues ? 'text-[#B91C1C]' : 'text-[#15803D]' },
            { num: `${global.normalization_coverage}%`, label: '标准化覆盖率', color: 'text-[#7A6145]' },
            { num: global.unmatched_athletes.toLocaleString(), label: '未匹配运动员行', color: global.unmatched_athletes ? 'text-[#C2410C]' : 'text-[#15803D]' },
            { num: (global.rank_gap_units ?? 0).toLocaleString(), label: '决赛名次断号单元', color: global.rank_gap_units ? 'text-[#B91C1C]' : 'text-[#15803D]' },
            { num: (global.gender_mismatch ?? 0).toLocaleString(), label: '性别错组(疑同名合并)', color: global.gender_mismatch ? 'text-[#B91C1C]' : 'text-[#15803D]' },
            { num: global.low_confidence.toLocaleString(), label: '低置信成绩(<0.6)', color: 'text-[#C2410C]' },
          ].map((c) => (
            <div key={c.label} className="min-w-[150px] rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9] px-5 py-4">
              <div className={`text-2xl font-bold ${c.color}`}>{c.num}</div>
              <div className="text-xs text-[#8A8078] mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E4D8C8] bg-[#FFFDF9]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-[#E7DCCA] bg-[#F2E9DC]">
                <th className={th}>赛事</th>
                <th className={th}>日期</th>
                <th className={th}>采集</th>
                <th className={th}>成绩数</th>
                <th className={th}>标准化</th>
                <th className={th}>未匹配</th>
                <th className={th}>多第一</th>
                <th className={th}>缺第一</th>
                <th className={th}>名次断号</th>
                <th className={th}>性别错组</th>
                <th className={th}>重号</th>
                <th className={th}>低置信</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE4D5]">
              {events.map((e) => (
                <Fragment key={e.event_id}>
                  <tr className="transition-colors hover:bg-[#F8F4ED]">
                    <td className={td}>{e.event_name}</td>
                    <td className={td}>{e.start_date || '-'}</td>
                    <td className={td}>{resultStatusLabels[e.result_status || ''] || e.result_status || '-'}</td>
                    <td className={td}>{e.result_count}</td>
                    <td className={td}><span className={e.norm_coverage < 70 ? 'text-[#C2410C]' : 'text-[#15803D]'}>{e.norm_coverage}%</span></td>
                    <td className={td}>{badge(e.unmatched_count, 'text-[#C2410C]')}</td>
                    <td className={td}>{badge(e.multi_first, 'text-[#B91C1C]')}</td>
                    <td className={td}>{badge(e.no_first, 'text-[#B91C1C]')}</td>
                    <td className={td}>{badge(e.rank_gap, 'text-[#B91C1C]')}</td>
                    <td className={td}>{badge(e.gender_mismatch, 'text-[#B91C1C]')}</td>
                    <td className={td}>{badge(e.duplicate_bib, 'text-[#B91C1C]')}</td>
                    <td className={td}>{badge(e.low_conf_count, 'text-[#C2410C]')}</td>
                    <td className={td}><button className={btn} onClick={() => openDrill(e.event_id)}>{drill?.eventId === e.event_id ? '收起' : '下钻'}</button></td>
                  </tr>
                  {drill?.eventId === e.event_id && (
                    <tr>
                      <td className="bg-[#FBF7F0] px-4 py-4" colSpan={13}>
                        <div className="font-semibold text-[#5E554D] mb-2">模块明细</div>
                        <div className="overflow-x-auto rounded-xl border border-[#EDE2D2] bg-white">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="border-b border-[#EDE2D2] bg-[#F7F0E4]">
                                <th className={th}>项目</th><th className={th}>组别</th><th className={th}>板型</th><th className={th}>轮次</th><th className={th}>人数</th><th className={th}>第一名</th><th className={th}>未匹配</th><th className={th}>低置信</th><th className={th}>标记</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1E8DA]">
                              {drill.modules.map((m, i) => (
                                <tr key={i}>
                                  <td className={td}>{m.discipline}</td>
                                  <td className={td}>{m.gender_group}</td>
                                  <td className={td}>{m.board_class || '-'}</td>
                                  <td className={td}>{m.round_label || '-'}</td>
                                  <td className={td}>{m.count}</td>
                                  <td className={td}>{m.firsts}</td>
                                  <td className={td}>{badge(m.unmatched, 'text-[#C2410C]')}</td>
                                  <td className={td}>{badge(m.low_conf, 'text-[#C2410C]')}</td>
                                  <td className={td}>{m.multi_first ? <span className="text-[#B91C1C]">多第一</span> : m.no_first ? <span className="text-[#B91C1C]">缺第一</span> : <span className="text-[#15803D]">✓</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {drill.dups.length > 0 && (
                          <div className="mt-2 text-[#B91C1C]">重复号码牌：{drill.dups.map((d) => `${d.bib_number}×${d.count}`).join('，')}</div>
                        )}

                        {/* 问题成绩行明细：点「编辑」直达成绩编辑弹框 */}
                        {drill.problems.length > 0 && (
                          <div className="mt-4">
                            <div className="font-semibold text-[#5E554D] mb-2">问题成绩行（{drill.problems.length}，点「编辑」直达修改）</div>
                            <div className="overflow-x-auto rounded-xl border border-[#EDE2D2] bg-white">
                              <table className="w-full min-w-[760px] text-xs">
                                <thead>
                                  <tr className="border-b border-[#EDE2D2] bg-[#F7F0E4] text-[#7D6B58]">
                                    <th className="px-3 py-2 text-left">问题</th>
                                    <th className="px-3 py-2 text-left">运动员</th>
                                    <th className="px-3 py-2 text-left">项目</th>
                                    <th className="px-3 py-2 text-left">组别</th>
                                    <th className="px-3 py-2 text-left">轮次</th>
                                    <th className="px-3 py-2 text-right">名次</th>
                                    <th className="px-3 py-2 text-left">成绩</th>
                                    <th className="px-3 py-2 text-right">操作</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F1E8DA]">
                                  {drill.problems.map((p, i) => (
                                    <tr key={`${p.result_id}-${p.issue_type}-${i}`}>
                                      <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${ISSUE_LABEL[p.issue_type]?.cls || ''}`}>{ISSUE_LABEL[p.issue_type]?.text || p.issue_type}</span></td>
                                      <td className="px-3 py-2 text-[#5E554D]">{p.athlete_name || <span className="text-[#C2410C]">（未匹配）</span>}</td>
                                      <td className="px-3 py-2 text-[#5E554D]">{p.discipline}{p.board_class ? ` / ${p.board_class}` : ''}</td>
                                      <td className="px-3 py-2 text-[#5E554D]">{p.gender_group}</td>
                                      <td className="px-3 py-2 text-[#5E554D]">{p.round_label || '-'}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{p.result_status_code || p.rank_position || '-'}</td>
                                      <td className="px-3 py-2 text-[#5E554D]">{p.finish_time || '-'}</td>
                                      <td className="px-3 py-2 text-right">
                                        <a className="rounded-lg border border-[#D8CCBA] bg-white px-3 py-1 text-[#6B5E50] hover:bg-[#F8F4ED]" target="_blank" rel="noreferrer"
                                           href={`/admin/results?event_id=${e.event_id}&result_id=${p.result_id}`}>编辑</a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {events.length === 0 && !loading && (
                <tr><td className={td} colSpan={13}>暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#8A8078]">
        <span>共 {total} 个赛事，第 {page} / {totalPages} 页</span>
        <button className={btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <span className="flex items-center gap-2">跳至
          <input className="h-9 w-16 rounded-lg border border-[#D8CCBA] bg-white px-2 text-center text-[#443323] outline-none focus:border-[#B79B78]"
            inputMode="numeric" value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') jumpToPage(); }} />页
        </span>
        <button className={btn} onClick={jumpToPage}>确定</button>
        <button className={btn} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
      </div>
    </div>
  );
}
