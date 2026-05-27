'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';

type Claim = {
  claim_id: number;
  submitted_club_name: string;
  submitted_role: string | null;
  contact_info: string;
  claim_note: string | null;
  proof_images: string | null;
  status: string;
  admin_note: string | null;
  nickname: string;
  email: string;
  target_club_name: string | null;
  created_club_name: string | null;
  team_name_raw: string | null;
  result_count: number | null;
  event_count: number | null;
  created_at: string;
};

function parseImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function AdminClubClaimsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Claim[]>([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/admin/club-claims?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setItems(res.ok ? data.items || [] : []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      const params = new URLSearchParams({ status });
      const res = await fetch(`/api/admin/club-claims?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (active) {
        setItems(res.ok ? data.items || [] : []);
        setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [status, token]);

  async function patch(id: number, action: string) {
    const adminNote = window.prompt(action === 'reject' ? '驳回原因' : '审核备注（可空）') || '';
    const res = await fetch(`/api/admin/club-claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, admin_note: adminNote }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? '处理完成' : data.error || '处理失败');
    await load();
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2E2118]">俱乐部认领审核</h1>
          <p className="mt-2 text-sm text-[#8A8078]">用户提交后不直接修改俱乐部，管理员通过后才绑定队伍别名和负责人。</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#E3D6C6] bg-white px-3 text-sm">
            {['pending', 'reviewing', 'approved', 'rejected', 'all'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索俱乐部/用户" className="h-10 rounded-lg border border-[#E3D6C6] bg-white px-3 text-sm" />
          <button onClick={load} className="h-10 rounded-lg bg-[#7A5530] px-4 text-sm font-semibold text-white">查询</button>
        </div>
      </div>
      {message && <div className="mb-4 rounded-lg bg-[#F2E8D9] px-4 py-3 text-sm text-[#6B4B2E]">{message}</div>}
      <div className="grid gap-4">
        {loading ? <div className="text-sm text-[#8A8078]">加载中...</div> : items.map((item) => {
          const images = parseImages(item.proof_images);
          return (
            <div key={item.claim_id} className="rounded-2xl border border-[#E2D5C5] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#F2E8D9] px-3 py-1 text-xs text-[#7A6145]">{item.status}</span>
                    {item.team_name_raw && <span className="rounded-full bg-[#EEF3E8] px-3 py-1 text-xs text-[#516B47]">队伍：{item.team_name_raw}</span>}
                    {(item.result_count || item.event_count) && <span className="text-xs text-[#8A8078]">{Number(item.result_count || 0)} 条成绩 / {Number(item.event_count || 0)} 场赛事</span>}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-[#2E2118]">{item.submitted_club_name}</h2>
                  <p className="mt-1 text-sm text-[#655D56]">提交人：{item.nickname} / {item.email}；身份：{item.submitted_role || '未填写'}</p>
                  <p className="mt-1 text-sm text-[#655D56]">联系方式：{item.contact_info}</p>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[#8A8078]">{item.claim_note || '无补充说明'}</p>
                  <p className="mt-2 text-xs text-[#A29589]">目标俱乐部：{item.target_club_name || item.created_club_name || '审核通过时创建或绑定'}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.status !== 'approved' && item.status !== 'rejected' && (
                    <>
                      <button onClick={() => patch(item.claim_id, 'approve')} className="rounded-lg bg-[#356B32] px-4 py-2 text-sm font-semibold text-white">通过</button>
                      <button onClick={() => patch(item.claim_id, 'reviewing')} className="rounded-lg border border-[#D8C8B6] px-4 py-2 text-sm text-[#6B4B2E]">审核中</button>
                      <button onClick={() => patch(item.claim_id, 'reject')} className="rounded-lg bg-[#B3261E] px-4 py-2 text-sm font-semibold text-white">驳回</button>
                    </>
                  )}
                </div>
              </div>
              {images.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {images.map((image) => <a key={image} href={image} target="_blank" className="block h-20 w-20 overflow-hidden rounded-lg border border-[#E2D5C5]" rel="noreferrer"><img src={image} alt="" className="h-full w-full object-cover" /></a>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
