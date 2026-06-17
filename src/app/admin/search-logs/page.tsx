'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

type SearchLog = {
  id: number;
  user_id: number | null;
  email: string;
  nickname: string;
  entry: string;
  keyword: string;
  detail: { path?: string; query?: Record<string, unknown>; detail?: Record<string, unknown> };
  result_count: number;
  duration_ms: number | null;
  ip: string;
  user_agent: string;
  created_at: string;
  created_at_display: string;
};

const entryLabels: Record<string, string> = {
  sup_search: 'SUP 搜索',
  race_results: '成绩查询',
  annual_points: '积分查询',
};

async function readJsonSafely(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`接口返回非 JSON 内容（HTTP ${res.status}）`);
  }
}

export default function SearchLogsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<SearchLog[]>([]);
  const [keyword, setKeyword] = useState('');
  const [user, setUser] = useState('');
  const [entry, setEntry] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '30' });
    if (keyword) params.set('keyword', keyword);
    if (user) params.set('user', user);
    if (entry) params.set('entry', entry);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return params.toString();
  }, [end, entry, keyword, page, start, user]);

  function load() {
    setLoading(true);
    setError('');
    fetch(`/api/admin/search-logs?${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const data = await readJsonSafely(res);
        if (!res.ok) throw new Error(data.error || '加载失败');
        setItems(data.items || []);
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token]);

  function resetFilters() {
    setKeyword('');
    setUser('');
    setEntry('');
    setStart('');
    setEnd('');
    setPage(1);
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-brown-800">关键词搜索日志</h1>
          <p className="mt-1 text-sm text-warm-gray-500">只记录用户主动输入关键词后的成绩、积分和 SUP 搜索。</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-2xl border border-cream-200 bg-cream-50 p-4 md:grid-cols-3 xl:grid-cols-6">
        <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }} placeholder="关键词" className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm" />
        <input value={user} onChange={e => { setUser(e.target.value); setPage(1); }} placeholder="用户邮箱 / 昵称 / ID" className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm" />
        <select value={entry} onChange={e => { setEntry(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm">
          <option value="">全部入口</option>
          {Object.entries(entryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" value={start} onChange={e => { setStart(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm" />
        <input type="date" value={end} onChange={e => { setEnd(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm" />
        <button onClick={resetFilters} className="h-10 rounded-lg border border-cream-300 bg-white px-3 text-sm text-brown-700">重置</button>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-3 text-sm text-warm-gray-500">{loading ? '加载中...' : `共 ${total} 条记录`}</div>

      <div className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-cream-100 text-brown-700">
            <tr>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">入口</th>
              <th className="px-4 py-3">关键词</th>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">结果</th>
              <th className="px-4 py-3">明细</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-cream-100 align-top">
                <td className="px-4 py-3 text-warm-gray-500">{item.created_at_display || item.created_at}</td>
                <td className="px-4 py-3 font-medium text-brown-700">{entryLabels[item.entry] || item.entry}</td>
                <td className="px-4 py-3 font-semibold text-brown-800">{item.keyword}</td>
                <td className="px-4 py-3 text-warm-gray-600">
                  {item.email ? (
                    <a href={`/admin/users?search=${encodeURIComponent(item.email)}`} className="font-medium text-brown-700 hover:underline">{item.email}</a>
                  ) : item.nickname || (item.user_id ? `#${item.user_id}` : '未登录')}
                  {item.email && item.nickname ? <div className="mt-1 text-xs text-warm-gray-400">{item.nickname}</div> : null}
                </td>
                <td className="px-4 py-3 text-brown-700">{item.result_count} 条{item.duration_ms !== null ? ` · ${item.duration_ms}ms` : ''}</td>
                <td className="px-4 py-3 text-xs text-warm-gray-500">
                  <div>{item.detail?.path || ''}</div>
                  <div className="mt-1 max-w-[420px] break-all">{JSON.stringify(item.detail?.query || {})}</div>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-warm-gray-400">暂无搜索日志</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">上一页</button>
        <span className="text-warm-gray-500">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-cream-300 px-3 py-2 disabled:opacity-40">下一页</button>
      </div>
    </div>
  );
}
