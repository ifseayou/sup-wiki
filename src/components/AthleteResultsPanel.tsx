'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';
import Tooltip from '@/components/Tooltip';

interface ResultRow {
  result_id: number;
  event_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  board_class: string | null;
  round_label: string | null;
  rank_position: number;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_members: unknown;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  pace_display: string | null;
  results_points_hidden?: boolean;
  privacy_notice?: string | null;
}

interface MemberLike {
  name?: unknown;
  member_name?: unknown;
}

interface AnnualPointRow {
  standing_id: number;
  year: number | string;
  group_name: string | null;
  rank_position: number | string | null;
  team_name: string | null;
  total_points: number | string | null;
  endurance_points: number | string | null;
  sprint_points: number | string | null;
  technical_points: number | string | null;
  source_title: string | null;
  source_url: string | null;
  results_points_hidden?: boolean;
  privacy_notice?: string | null;
}

function parseMembers(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item: MemberLike) => String(item?.name || item?.member_name || '').trim())
      .filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.map((item: MemberLike) => String(item?.name || item?.member_name || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function formatPoint(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function HiddenValue({ tip = '该运动员已选择隐藏成绩&积分' }: { tip?: string | null }) {
  return (
    <Tooltip tip={tip || '该运动员已选择隐藏成绩&积分'} dotted={false}>
      <span className="inline-flex items-center rounded-full border border-[#E1D0B8] bg-[#FFF8ED] px-2.5 py-1 text-xs font-semibold text-[#8A6A45]">隐藏</span>
    </Tooltip>
  );
}

export default function AthleteResultsPanel({ athleteId, athleteName }: { athleteId: number; athleteName: string }) {
  const { token, loading } = useUser();
  const [activeTab, setActiveTab] = useState<'results' | 'points'>('results');
  const [items, setItems] = useState<ResultRow[]>([]);
  const [pointItems, setPointItems] = useState<AnnualPointRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pointTotal, setPointTotal] = useState(0);
  const [previewLocked, setPreviewLocked] = useState(false);
  const [pointPreviewLocked, setPointPreviewLocked] = useState(false);
  const [page, setPage] = useState(1);
  const [pointPage, setPointPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [pointFetching, setPointFetching] = useState(false);
  const [error, setError] = useState('');
  const [pointError, setPointError] = useState('');
  const pageSize = 10;

  const query = useMemo(() => {
    return new URLSearchParams({
      athlete_id: String(athleteId),
      page: String(page),
      pageSize: String(pageSize),
    }).toString();
  }, [athleteId, page]);

  const pointQuery = useMemo(() => {
    return new URLSearchParams({
      type: 'athlete',
      athlete_id: String(athleteId),
      athlete_name: athleteName,
      page: String(pointPage),
      pageSize: String(pageSize),
    }).toString();
  }, [athleteId, athleteName, pointPage]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFetching(true);
      setError('');
      fetch(`/api/results?${query}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '成绩加载失败');
          if (cancelled) return;
          setItems(data.items || []);
          setTotal(Number(data.total || 0));
          setPreviewLocked(Boolean(data.preview_locked));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : '成绩加载失败');
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, query, token]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPointFetching(true);
      setPointError('');
      fetch(`/api/annual-points?${pointQuery}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '积分加载失败');
          if (cancelled) return;
          setPointItems(data.items || []);
          setPointTotal(Number(data.total || 0));
          setPointPreviewLocked(Boolean(data.preview_locked));
        })
        .catch((err) => {
          if (!cancelled) setPointError(err instanceof Error ? err.message : '积分加载失败');
        })
        .finally(() => {
          if (!cancelled) setPointFetching(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, pointQuery, token]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pointTotalPages = Math.max(1, Math.ceil(pointTotal / pageSize));

  return (
    <section className="mb-10 overflow-hidden rounded-xl border border-cream-200 bg-white shadow-[0_18px_50px_rgba(68,51,35,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4 sm:px-7">
        <div className="flex gap-6">
          <button type="button" onClick={() => setActiveTab('results')} className={`border-b-2 pb-3 text-sm font-semibold ${activeTab === 'results' ? 'border-brown-500 text-brown-600' : 'border-transparent text-warm-gray-400 hover:text-brown-600'}`}>成绩档案</button>
          <button type="button" onClick={() => setActiveTab('points')} className={`border-b-2 pb-3 text-sm font-semibold ${activeTab === 'points' ? 'border-brown-500 text-brown-600' : 'border-transparent text-warm-gray-400 hover:text-brown-600'}`}>积分档案</button>
        </div>
        <Link href={activeTab === 'points' ? `/results?tab=points&athlete=${encodeURIComponent(athleteName)}` : `/results?athlete_id=${athleteId}`} className="inline-flex h-9 items-center rounded-lg border border-cream-300 bg-white px-4 text-xs font-semibold text-brown-600 no-underline hover:border-brown-400">
          {activeTab === 'points' ? '进入查积分 →' : '进入查成绩 →'}
        </Link>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-display)] text-3xl font-medium text-brown-800">{activeTab === 'points' ? '积分档案' : '成绩档案'}</h2>
            <p className="mt-1 text-sm text-warm-gray-400">{activeTab === 'points' ? `已收录 ${pointTotal} 条年度积分` : `已收录 ${total} 条成绩`}</p>
          </div>
          {(activeTab === 'points' ? pointFetching : fetching) && <span className="text-xs text-warm-gray-400">加载中...</span>}
        </div>

        {loading && <p className="text-sm text-warm-gray-400">正在检查登录状态...</p>}

        {!loading && activeTab === 'points' && (
          <>
          {pointPreviewLocked && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DFC7A7] bg-[#FFF8EA] px-4 py-3 text-sm text-[#6B4A24]">
              <span>未登录可预览前 3 条，登录后查看完整积分档案。</span>
              <Link href={`/login?redirect=${encodeURIComponent(`/athletes/${athleteId}`)}`} className="font-bold text-brown-700 no-underline">登录查看全部</Link>
            </div>
          )}
          {pointError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pointError}</div>}
          <div className="overflow-x-auto rounded-lg border border-cream-200">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">年份</th>
                  <th className="px-4 py-3 font-medium">组别</th>
                  <th className="px-4 py-3 text-center font-medium">名次</th>
                  <th className="px-4 py-3 text-right font-medium">总积分</th>
                  <th className="px-4 py-3 text-right font-medium">耐力</th>
                  <th className="px-4 py-3 text-right font-medium">竞速</th>
                  <th className="px-4 py-3 text-right font-medium">技巧</th>
                  <th className="px-4 py-3 font-medium">队伍</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {pointItems.map((row) => (
                  <tr key={row.standing_id} className="transition hover:bg-cream-50">
                    <td className="px-4 py-4 font-semibold text-brown-800">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.year}</td>
                    <td className="px-4 py-4 text-warm-gray-600">{row.group_name || '-'}</td>
                    <td className="px-4 py-4 text-center font-bold text-brown-800">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.rank_position || '-'}</td>
                    <td className="px-4 py-4 text-right font-bold text-brown-800">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : formatPoint(row.total_points)}</td>
                    <td className="px-4 py-4 text-right text-warm-gray-600">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : formatPoint(row.endurance_points)}</td>
                    <td className="px-4 py-4 text-right text-warm-gray-600">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : formatPoint(row.sprint_points)}</td>
                    <td className="px-4 py-4 text-right text-warm-gray-600">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : formatPoint(row.technical_points)}</td>
                    <td className="px-4 py-4 text-warm-gray-600">{row.team_name || '个人'}</td>
                    <td className="px-4 py-4 text-warm-gray-600">{row.source_url ? <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brown-700 no-underline hover:text-brown-500">{row.source_title || '原文来源'}</a> : (row.source_title || '-')}</td>
                  </tr>
                ))}
                {!pointFetching && pointItems.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-warm-gray-400">暂无已收录积分</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pointTotalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-warm-gray-400">
              <span>第 {pointPage} / {pointTotalPages} 页</span>
              <div className="flex gap-2">
                <button type="button" disabled={pointPage <= 1 || pointPreviewLocked} onClick={() => setPointPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-warm-gray-600 disabled:opacity-40">上一页</button>
                <button type="button" disabled={pointPage >= pointTotalPages || pointPreviewLocked} onClick={() => setPointPage((v) => Math.min(pointTotalPages, v + 1))} className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-warm-gray-600 disabled:opacity-40">下一页</button>
              </div>
            </div>
          )}
          </>
        )}

        {!loading && activeTab === 'results' && (
          <>
          {previewLocked && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DFC7A7] bg-[#FFF8EA] px-4 py-3 text-sm text-[#6B4A24]">
              <span>未登录可预览前 3 条，登录后查看完整成绩档案。</span>
              <Link href={`/login?redirect=${encodeURIComponent(`/athletes/${athleteId}`)}`} className="font-bold text-brown-700 no-underline">登录查看全部</Link>
            </div>
          )}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="overflow-x-auto rounded-lg border border-cream-200">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">赛事</th>
                  <th className="px-4 py-3 font-medium">项目</th>
                  <th className="px-4 py-3 font-medium">组别</th>
                  <th className="px-4 py-3 text-center font-medium">名次</th>
                  <th className="px-4 py-3 text-right font-medium">成绩</th>
                  <th className="px-4 py-3 text-right font-medium">配速</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200 bg-white">
                {items.map((row) => {
                  const members = parseMembers(row.team_members);
                  return (
                  <tr key={row.result_id} className="transition hover:bg-cream-50">
                    <td className="px-4 py-4 leading-6 text-warm-gray-700">
                      <Link href={`/events/${row.event_id}`} className="font-semibold text-brown-800 no-underline hover:text-brown-500">{row.event_name}</Link>
                      <div className="text-xs text-warm-gray-400">{[row.province, row.city].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-4 text-warm-gray-600">
                      {row.discipline}{row.board_class ? ` / ${row.board_class}` : ''}
                      {members.length > 0 && <div className="mt-1 text-xs text-warm-gray-400">成员：{members.join('、')}</div>}
                    </td>
                    <td className="px-4 py-4 text-warm-gray-600">{row.gender_group}{row.round_label ? ` · ${row.round_label}` : ''}</td>
                    <td className="px-4 py-4 text-center font-bold text-brown-800">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.rank_position >= 9000 ? '—' : row.rank_position}</td>
                    <td className="px-4 py-4 text-right font-bold text-brown-800">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : <ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} />}</td>
                    <td className="px-4 py-4 text-right font-medium text-warm-gray-600">{row.results_points_hidden ? <HiddenValue tip={row.privacy_notice} /> : row.pace_display || '-'}</td>
                  </tr>
                  );
                })}
                {!fetching && items.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-warm-gray-400">暂无已收录成绩</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-warm-gray-400">
              <span>第 {page} / {totalPages} 页</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-warm-gray-600 disabled:opacity-40">上一页</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-warm-gray-600 disabled:opacity-40">下一页</button>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </section>
  );
}
