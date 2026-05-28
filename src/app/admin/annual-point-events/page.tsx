'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface CandidateEvent {
  event_id: number;
  name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
  result_status: string | null;
  results_count: number;
  confidence: number;
  reason: string;
}

interface RadarItem {
  mapping_id: number;
  point_event_name: string;
  star_level: number | null;
  point_rows_count: number;
  athlete_count: number;
  total_point_sum: string | number | null;
  matched_event_id: number | null;
  matched_event_name: string | null;
  matched_event_start_date: string | null;
  matched_event_city: string | null;
  matched_event_province: string | null;
  matched_event_result_status: string | null;
  matched_event_results_count: number;
  candidate_events: CandidateEvent[];
  match_status: string;
  match_confidence: string | number | null;
  match_reason: string | null;
  admin_note: string | null;
  last_analyzed_at: string | null;
}

interface Stats {
  total: number;
  unmatched: number;
  candidate: number;
  confirmed: number;
  ignored: number;
  missing_results: number;
  partial_results: number;
}

const statusLabels: Record<string, string> = {
  unmatched: '疑似缺赛事',
  candidate: '待确认',
  confirmed: '已绑定',
  ignored: '已忽略',
};

const gapOptions = [
  { value: '', label: '全部缺口' },
  { value: 'missing_event', label: '疑似缺赛事' },
  { value: 'needs_confirm', label: '待确认同一赛事' },
  { value: 'missing_results', label: '已有赛事缺成绩' },
  { value: 'partial_results', label: '已有赛事成绩不完整' },
];

function formatNumber(value: string | number | null | undefined) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('zh-CN');
}

function resultLabel(status: string | null | undefined, count: number) {
  if (!count) return '无成绩';
  if (status === 'extended_complete') return `完整 · ${count} 条`;
  if (status === 'top10_complete') return `Top10 · ${count} 条`;
  if (status === 'partial') return `部分 · ${count} 条`;
  return `${count} 条`;
}

export default function AnnualPointEventsAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<RadarItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState('');
  const [gap, setGap] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    if (status) params.set('status', status);
    if (gap) params.set('gap', gap);
    if (search) params.set('search', search);
    return params.toString();
  }, [gap, page, search, status]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch(`/api/admin/annual-point-events?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json());
      setItems(data.items || []);
      setStats(data.stats || null);
      setTotal(Number(data.total || 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  async function post(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/annual-point-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setMessage(successMessage.replace('{count}', String(data.analyzed || '')));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  function confirmManual(item: RadarItem) {
    const fallback = item.matched_event_id || item.candidate_events[0]?.event_id || '';
    const value = window.prompt('请输入要绑定的站内赛事 ID', String(fallback));
    if (!value) return;
    post({ action: 'confirm', mapping_id: item.mapping_id, event_id: Number(value) }, '已确认绑定');
  }

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brown-400">Event Radar</div>
            <h1 className="mt-1 text-2xl font-semibold text-brown-800">年度积分赛事雷达</h1>
            <p className="mt-2 max-w-3xl text-sm text-warm-gray-500">
              从年度积分明细反向识别赛事来源，先生成候选映射，再由管理员确认，避免把名称不同的已有赛事误判为缺失。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="积分赛事" value={stats?.total || 0} />
            <StatCard label="待确认" value={stats?.candidate || 0} />
            <StatCard label="疑似缺赛事" value={stats?.unmatched || 0} />
            <StatCard label="已有赛事缺成绩" value={(stats?.missing_results || 0) + (stats?.partial_results || 0)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.9fr_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">赛事名 / 映射 ID</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300" placeholder="搜索积分赛事或站内赛事" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">映射状态</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300">
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">缺口类型</span>
            <select value={gap} onChange={(e) => { setGap(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300">
              {gapOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button onClick={() => post({ action: 'analyze' }, '分析完成：{count} 个积分赛事')} disabled={busy} className="h-10 rounded-lg bg-brown-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            {busy ? '处理中…' : '重新分析'}
          </button>
        </div>
        {message && <div className="mt-3 rounded-lg bg-cream-100 px-3 py-2 text-sm text-brown-700">{message}</div>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">积分赛事</th>
              <th className="px-4 py-3">影响</th>
              <th className="px-4 py-3">候选 / 已绑定赛事</th>
              <th className="px-4 py-3">成绩状态</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const best = item.candidate_events[0];
              const confirmed = item.match_status === 'confirmed';
              return (
                <tr key={item.mapping_id} className="border-t border-cream-200 align-top">
                  <td className="max-w-md px-4 py-3">
                    <div className="font-semibold text-brown-800">{item.point_event_name}</div>
                    <div className="mt-1 text-xs text-warm-gray-400">映射 #{item.mapping_id} · 最近分析 {shortDate(item.last_analyzed_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-brown-800">{item.star_level ? `${item.star_level} 星` : '未标星'}</div>
                    <div className="mt-1 text-xs text-warm-gray-500">{item.athlete_count} 人 · {item.point_rows_count} 条积分</div>
                    <div className="mt-1 text-xs text-warm-gray-400">贡献 {formatNumber(item.total_point_sum)} 分</div>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    {item.matched_event_id ? (
                      <>
                        <div className="font-medium text-brown-800">#{item.matched_event_id} {item.matched_event_name}</div>
                        <div className="mt-1 text-xs text-warm-gray-400">{item.matched_event_start_date || ''} {item.matched_event_city || item.matched_event_province || ''}</div>
                      </>
                    ) : best ? (
                      <>
                        <div className="font-medium text-brown-800">#{best.event_id} {best.name}</div>
                        <div className="mt-1 text-xs text-warm-gray-400">候选置信度 {formatNumber(best.confidence)} · {best.reason}</div>
                      </>
                    ) : (
                      <div className="text-warm-gray-400">暂无候选，优先按缺赛事处理</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className={item.matched_event_results_count ? 'font-medium text-brown-700' : 'font-medium text-red-700'}>
                      {resultLabel(item.matched_event_result_status, Number(item.matched_event_results_count || 0))}
                    </div>
                    {confirmed && Number(item.matched_event_results_count || 0) === 0 && <div className="mt-1 text-xs text-red-500">已有赛事但缺成绩册</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-cream-100 px-2 py-1 text-xs text-brown-700">{statusLabels[item.match_status] || item.match_status}</span>
                    <div className="mt-1 text-xs text-warm-gray-400">置信度 {formatNumber(item.match_confidence)}</div>
                    {item.admin_note && <div className="mt-1 text-xs text-warm-gray-400">{item.admin_note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => confirmManual(item)} disabled={busy} className="rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-medium text-brown-700 disabled:opacity-50">确认/改绑</button>
                      {!confirmed && best && <button onClick={() => post({ action: 'confirm', mapping_id: item.mapping_id, event_id: best.event_id }, '已确认候选赛事')} disabled={busy} className="rounded-lg bg-brown-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">确认候选</button>}
                      {item.match_status !== 'ignored' && <button onClick={() => post({ action: 'ignore', mapping_id: item.mapping_id }, '已忽略')} disabled={busy} className="text-xs text-warm-gray-400 disabled:opacity-50">忽略</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && !items.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-warm-gray-400">暂无积分赛事映射，点击“重新分析”生成。</td></tr>
            )}
          </tbody>
        </table>
        {loading && <div className="border-t border-cream-200 py-4 text-center text-sm text-warm-gray-400">加载中...</div>}
        <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3 text-sm text-warm-gray-500">
          <span>第 {page} / {totalPages} 页，共 {total} 条</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded-lg border border-cream-300 px-3 py-1 disabled:opacity-40">上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className="rounded-lg border border-cream-300 px-3 py-1 disabled:opacity-40">下一页</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
      <div className="text-xs text-warm-gray-400">{label}</div>
      <div className="mt-1 font-semibold text-brown-800">{Number(value || 0).toLocaleString('zh-CN')}</div>
    </div>
  );
}
