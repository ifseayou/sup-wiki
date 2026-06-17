'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';
import { formatChinaDateTime } from '@/lib/china-time';

interface AthleteRow {
  athlete_id: number;
  name: string;
  name_en: string;
  nationality: string;
  region: string;
  result_count: number;
  blacklisted: boolean;
  blacklisted_at: string | null;
}

export default function AthleteBlacklistPage() {
  const { token } = useAdminAuth();
  const [list, setList] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AthleteRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const loadList = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/admin/athlete-blacklist', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => readAdminResponse(res))
      .then((data) => setList((data.items as AthleteRow[]) || []))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(() => { loadList(); }, [loadList]);

  async function doSearch() {
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/athlete-blacklist?search=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await readAdminResponse(res);
      setSearchResults((data.items as AthleteRow[]) || []);
    } catch (e) { setMsg((e as Error).message); } finally { setSearching(false); }
  }

  async function add(id: number) {
    setBusyId(id); setMsg('');
    try {
      const res = await fetch('/api/admin/athlete-blacklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ athlete_id: id }),
      });
      await readAdminResponse(res);
      setMsg('已加入黑名单（查成绩/查积分将查不到，赛事排行匿名且不可进入）');
      setSearchResults((prev) => prev.map((r) => (r.athlete_id === id ? { ...r, blacklisted: true } : r)));
      loadList();
    } catch (e) { setMsg('加入失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  async function remove(id: number) {
    if (!confirm('确认将该运动员移出黑名单？移出后公开页将恢复显示姓名。')) return;
    setBusyId(id); setMsg('');
    try {
      const res = await fetch('/api/admin/athlete-blacklist', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ athlete_id: id }),
      });
      await readAdminResponse(res);
      setMsg('已移出黑名单');
      setSearchResults((prev) => prev.map((r) => (r.athlete_id === id ? { ...r, blacklisted: false } : r)));
      loadList();
    } catch (e) { setMsg('移出失败：' + (e as Error).message); } finally { setBusyId(null); }
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-brown-800 mb-1">隐私黑名单</h1>
      <p className="text-sm text-warm-gray-500 mb-4 leading-relaxed">加入黑名单的运动员将被<strong>彻底隐藏存在感</strong>：<br/>· <strong>查成绩 / 查积分</strong>按其姓名搜索 → 直接<strong>查不到</strong>（如同系统无此人记录，不返回任何遮蔽行或暗示）；<br/>· <strong>赛事名次排行 / 积分榜</strong> → 保留名次但显示「已隐藏选手」，<strong>无法进入详情、头像不可点击</strong>；<br/>· <strong>运动员资料库与详情页</strong> → 搜不到、直接打开链接返回「内容不存在」。<br/>后台仍可见其全部真实数据；该状态不会被运动员本人认领/恢复操作解除。</p>
      {msg && <div className="mb-3 text-sm text-brown-700 bg-cream-100 rounded px-3 py-2">{msg}</div>}

      {/* 搜索添加 */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4 mb-6">
        <div className="text-sm font-medium text-brown-700 mb-2">按姓名搜索运动员并加入黑名单</div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
            placeholder="输入运动员姓名，如 王璐"
            className="flex-1 px-3 py-2 border border-cream-300 rounded-lg text-sm outline-none focus:border-brown-400"
          />
          <button onClick={doSearch} disabled={searching} className="px-4 py-2 rounded-lg bg-brown-600 text-white text-sm disabled:opacity-50">{searching ? '搜索中…' : '搜索'}</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 divide-y divide-cream-100">
            {searchResults.map((a) => (
              <div key={a.athlete_id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-brown-800">{a.name}</span>
                  {a.name_en && <span className="text-warm-gray-400 ml-2">{a.name_en}</span>}
                  <span className="text-warm-gray-400 ml-2">#{a.athlete_id} · {a.nationality || '—'}{a.region ? ' · ' + a.region : ''} · {a.result_count} 条成绩</span>
                </div>
                {a.blacklisted ? (
                  <span className="text-xs text-red-500">已在黑名单</span>
                ) : (
                  <button onClick={() => add(a.athlete_id)} disabled={busyId === a.athlete_id} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs disabled:opacity-50">加入黑名单</button>
                )}
              </div>
            ))}
          </div>
        )}
        {!searching && search && searchResults.length === 0 && <div className="mt-3 text-sm text-warm-gray-400">未找到匹配运动员</div>}
      </div>

      {/* 当前黑名单 */}
      <div className="rounded-2xl border border-cream-200 bg-white p-4">
        <div className="text-sm font-medium text-brown-700 mb-2">当前黑名单（{list.length}）</div>
        {loading && <div className="text-sm text-warm-gray-400">加载中…</div>}
        {!loading && list.length === 0 && <div className="text-sm text-warm-gray-400">暂无黑名单成员</div>}
        <div className="divide-y divide-cream-100">
          {list.map((a) => (
            <div key={a.athlete_id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="font-medium text-brown-800">{a.name}</span>
                <span className="text-warm-gray-400 ml-2">#{a.athlete_id} · {a.nationality || '—'}{a.region ? ' · ' + a.region : ''} · {a.result_count} 条成绩</span>
                {a.blacklisted_at && <span className="text-warm-gray-300 ml-2">加入于 {formatChinaDateTime(a.blacklisted_at)}</span>}
              </div>
              <button onClick={() => remove(a.athlete_id)} disabled={busyId === a.athlete_id} className="px-3 py-1.5 rounded-lg border border-cream-300 text-brown-700 text-xs disabled:opacity-50">移出</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
