'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';

type Alias = {
  alias_id: number;
  team_name_raw: string;
  normalized_name: string;
  match_status: string;
  result_count: number;
  event_count: number;
  athlete_count: number;
  club_id: number | null;
  club_name: string | null;
  admin_note: string | null;
  updated_at: string;
};

export default function AdminClubTeamAliasesPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Alias[]>([]);
  const [status, setStatus] = useState('unmatched');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/admin/club-team-aliases?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setItems(res.ok ? data.items || [] : []);
  }

  useEffect(() => {
    let active = true;
    async function run() {
      const params = new URLSearchParams({ status });
      const res = await fetch(`/api/admin/club-team-aliases?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (active) setItems(res.ok ? data.items || [] : []);
    }
    run();
    return () => { active = false; };
  }, [status, token]);

  async function patch(alias: Alias, action: string) {
    const body: Record<string, unknown> = { action };
    if (action === 'bind') {
      const clubId = window.prompt('输入要绑定的 club_id');
      if (!clubId) return;
      body.club_id = Number(clubId);
    }
    if (action === 'create_club') {
      const clubName = window.prompt('新俱乐部名称', alias.team_name_raw);
      if (!clubName) return;
      body.club_name = clubName;
    }
    body.admin_note = window.prompt('备注（可空）') || '';
    const res = await fetch(`/api/admin/club-team-aliases/${alias.alias_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? '处理完成' : data.error || '处理失败');
    await load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2E2118]">成绩队伍映射</h1>
          <p className="mt-2 text-sm text-[#8A8078]">成绩册里的“队伍”会进入待认领池。只在确认后才绑定正式俱乐部。</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#E3D6C6] bg-white px-3 text-sm">
            {['unmatched', 'candidate', 'confirmed', 'ignored', 'rejected', 'all'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索队伍/俱乐部" className="h-10 rounded-lg border border-[#E3D6C6] bg-white px-3 text-sm" />
          <button onClick={load} className="h-10 rounded-lg bg-[#7A5530] px-4 text-sm font-semibold text-white">查询</button>
        </div>
      </div>
      {message && <div className="mb-4 rounded-lg bg-[#F2E8D9] px-4 py-3 text-sm text-[#6B4B2E]">{message}</div>}
      <div className="overflow-hidden rounded-2xl border border-[#E2D5C5] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F7F1E8] text-[#6B4B2E]">
            <tr>
              <th className="px-4 py-3">队伍名</th>
              <th className="px-4 py-3">成绩</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">绑定俱乐部</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8DDCE]">
            {items.map((item) => (
              <tr key={item.alias_id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[#2E2118]">{item.team_name_raw}</div>
                  <div className="mt-1 text-xs text-[#A29589]">{item.normalized_name}</div>
                </td>
                <td className="px-4 py-3 text-[#655D56]">{item.result_count} 条 / {item.event_count} 场 / {item.athlete_count} 人</td>
                <td className="px-4 py-3"><span className="rounded-full bg-[#F2E8D9] px-3 py-1 text-xs text-[#7A6145]">{item.match_status}</span></td>
                <td className="px-4 py-3 text-[#655D56]">{item.club_name || '未绑定'}{item.club_id ? ` #${item.club_id}` : ''}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => patch(item, 'bind')} className="rounded-lg border border-[#D8C8B6] px-3 py-1.5 text-xs text-[#6B4B2E]">绑定</button>
                    <button onClick={() => patch(item, 'create_club')} className="rounded-lg bg-[#7A5530] px-3 py-1.5 text-xs text-white">建俱乐部</button>
                    <button onClick={() => patch(item, 'ignore')} className="rounded-lg border border-[#D8C8B6] px-3 py-1.5 text-xs text-[#8A8078]">忽略</button>
                    <button onClick={() => patch(item, 'reject')} className="rounded-lg border border-[#E3B2A6] px-3 py-1.5 text-xs text-[#B3261E]">驳回</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8A8078]">暂无队伍别名</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
