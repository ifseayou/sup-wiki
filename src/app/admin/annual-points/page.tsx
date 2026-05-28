'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface GroupItem {
  code: string;
  label: string;
}

interface PointRow {
  standing_id: number;
  group_code: string;
  group_name: string;
  rank_position: number | null;
  athlete_name_snapshot: string;
  athlete_id: number | null;
  athlete_name: string | null;
  athlete_status: string | null;
  total_points: string | number | null;
  endurance_points: string | number | null;
  sprint_points: string | number | null;
  technical_points: string | number | null;
  base_detail_text: string | null;
  adjustment_detail_text: string | null;
  source_record_id: string;
  match_status: string;
  match_confidence: string | number | null;
  updated_at: string;
}

interface SourceRow {
  sync_status: string;
  total_records: number;
  imported_records: number;
  last_synced_at: string | null;
  error_message: string | null;
}

const matchLabels: Record<string, string> = {
  unmatched: '未匹配',
  candidate: '待确认',
  confirmed: '已确认',
  conflict: '同名冲突',
};

const statusLabels: Record<string, string> = {
  idle: '未同步',
  syncing: '同步中',
  imported: '已入库',
  failed: '失败',
};

function formatPoint(value: string | number | null | undefined) {
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export default function AnnualPointsAdminPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<PointRow[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [source, setSource] = useState<SourceRow | null>(null);
  const [groupCode, setGroupCode] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (groupCode) params.set('group_code', groupCode);
    if (matchStatus) params.set('match_status', matchStatus);
    if (search) params.set('search', search);
    return params.toString();
  }, [groupCode, matchStatus, page, search]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch(`/api/admin/annual-points?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.json());
      setItems(data.items || []);
      setGroups(data.groups || []);
      setSource(data.source || null);
      setTotal(Number(data.total || 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  async function sync(dryRun = false) {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/annual-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group_code: groupCode || undefined, dry_run: dryRun, limit: dryRun ? 10 : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同步失败');
      setMessage(dryRun
        ? `试抓成功：${data.fetched || 0} 条，未写入数据库`
        : `同步完成：抓取 ${data.fetched || 0} 条，入库 ${data.imported || 0} 条`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cream-200 bg-cream-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brown-400">Annual Points</div>
            <h1 className="mt-1 text-2xl font-semibold text-brown-800">2025 年度积分数据</h1>
            <p className="mt-2 text-sm text-warm-gray-500">从金数据公开查询页低频同步，保留原始记录，用于后续运动员年度积分榜和档案集成。</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="text-xs text-warm-gray-400">同步状态</div>
              <div className="mt-1 font-semibold text-brown-800">{statusLabels[source?.sync_status || 'idle'] || source?.sync_status || '未同步'}</div>
            </div>
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="text-xs text-warm-gray-400">已入库</div>
              <div className="mt-1 font-semibold text-brown-800">{source?.total_records || 0}</div>
            </div>
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="text-xs text-warm-gray-400">本页筛选</div>
              <div className="mt-1 font-semibold text-brown-800">{total}</div>
            </div>
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="text-xs text-warm-gray-400">最近同步</div>
              <div className="mt-1 text-sm font-semibold text-brown-800">{shortDate(source?.last_synced_at)}</div>
            </div>
          </div>
        </div>
        {source?.error_message && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{source.error_message}</div>}
      </section>

      <section className="rounded-2xl border border-cream-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">姓名 / 记录 ID</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300" placeholder="搜索运动员姓名" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">组别</span>
            <select value={groupCode} onChange={(e) => { setGroupCode(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300">
              <option value="">全部组别</option>
              {groups.map((group) => <option key={group.code} value={group.code}>{group.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-warm-gray-500">匹配状态</span>
            <select value={matchStatus} onChange={(e) => { setMatchStatus(e.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-sm outline-none focus:border-brown-300">
              <option value="">全部状态</option>
              {Object.entries(matchLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button onClick={() => sync(true)} disabled={syncing} className="h-10 rounded-lg border border-cream-300 px-4 text-sm font-medium text-brown-700 disabled:opacity-50">试抓 10 条</button>
          <button onClick={() => sync(false)} disabled={syncing} className="h-10 rounded-lg bg-brown-600 px-4 text-sm font-medium text-white disabled:opacity-50">{syncing ? '同步中…' : '同步入库'}</button>
        </div>
        {message && <div className="mt-3 rounded-lg bg-cream-100 px-3 py-2 text-sm text-brown-700">{message}</div>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs text-warm-gray-500">
            <tr>
              <th className="px-4 py-3">组别 / 排名</th>
              <th className="px-4 py-3">运动员</th>
              <th className="px-4 py-3 text-right">总积分</th>
              <th className="px-4 py-3 text-right">耐力</th>
              <th className="px-4 py-3 text-right">冲刺</th>
              <th className="px-4 py-3 text-right">技术</th>
              <th className="px-4 py-3">匹配</th>
              <th className="px-4 py-3">积分来源</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.standing_id} className="border-t border-cream-200 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-brown-800">{item.group_name}</div>
                  <div className="text-xs text-warm-gray-400">#{item.rank_position || '—'} · {item.group_code}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-brown-800">{item.athlete_name_snapshot}</div>
                  <div className="text-xs text-warm-gray-400">{item.athlete_id ? `已关联 #${item.athlete_id}` : '未关联运动员档案'}</div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-brown-800">{formatPoint(item.total_points)}</td>
                <td className="px-4 py-3 text-right text-warm-gray-600">{formatPoint(item.endurance_points)}</td>
                <td className="px-4 py-3 text-right text-warm-gray-600">{formatPoint(item.sprint_points)}</td>
                <td className="px-4 py-3 text-right text-warm-gray-600">{formatPoint(item.technical_points)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-cream-100 px-2 py-1 text-xs text-brown-700">{matchLabels[item.match_status] || item.match_status}</span>
                  <div className="mt-1 text-xs text-warm-gray-400">置信度 {formatPoint(item.match_confidence)}</div>
                </td>
                <td className="max-w-md px-4 py-3">
                  <div className="line-clamp-2 text-xs text-warm-gray-600">{item.base_detail_text || '—'}</div>
                  {item.adjustment_detail_text && <div className="mt-1 line-clamp-1 text-xs text-warm-gray-400">修正：{item.adjustment_detail_text}</div>}
                </td>
              </tr>
            ))}
            {!loading && !items.length && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-warm-gray-400">暂无年度积分数据</td></tr>
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
