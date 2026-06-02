'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';
import { formatChinaDateTime } from '@/lib/china-time';

type PrivacyRequest = {
  id: number;
  request_type: string;
  target_type: string;
  target_id: number;
  athlete_name: string;
  event_name: string;
  description: string;
  contact: string;
  proof_images: string[];
  status: string;
  handler_note: string;
  created_at: string;
};

type PrivacyAction = {
  action: string;
  label: string;
  tone: 'primary' | 'neutral' | 'danger';
  confirm?: string;
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  needs_more_info: '需补充材料',
  completed: '已完成',
  approved: '已通过',
  rejected: '已拒绝',
};

const typeLabels: Record<string, string> = {
  claim: '认领',
  correction: '更正',
  hide_athlete: '隐藏主页',
  anonymize_name: '姓名匿名化',
  delete_frontend: '删除前台展示',
  restore_frontend: '恢复前台展示',
};

const statusTone: Record<string, string> = {
  pending: 'border-amber-100 bg-amber-50 text-amber-700',
  processing: 'border-blue-100 bg-blue-50 text-blue-700',
  needs_more_info: 'border-orange-100 bg-orange-50 text-orange-700',
  completed: 'border-green-100 bg-green-50 text-green-700',
  approved: 'border-green-100 bg-green-50 text-green-700',
  rejected: 'border-red-100 bg-red-50 text-red-600',
};

function formatDate(value: string) {
  if (!value) return '-';
  return formatChinaDateTime(value) || '-';
}

function actionsFor(item: PrivacyRequest): PrivacyAction[] {
  const primaryByType: Record<string, PrivacyAction> = {
    hide_athlete: { action: 'approve_hide_athlete', label: '通过并隐藏主页', tone: 'primary' },
    anonymize_name: { action: 'approve_anonymize_name', label: '通过并匿名姓名', tone: 'primary', confirm: '确认将该运动员姓名匿名化？' },
    delete_frontend: { action: 'approve_delete_frontend', label: '通过并删除前台展示', tone: 'danger', confirm: '确认删除该条前台展示？后台数据会保留。' },
    restore_frontend: { action: 'approve_restore_frontend', label: '通过并恢复展示', tone: 'primary', confirm: '确认恢复该资料的前台展示？' },
    correction: { action: 'approve_correction', label: '通过更正', tone: 'primary' },
    claim: { action: 'approve_correction', label: '通过处理', tone: 'primary' },
  };
  return [
    primaryByType[item.request_type] || { action: 'approve_correction', label: '通过处理', tone: 'primary' },
    { action: 'processing', label: '标记处理中', tone: 'neutral' },
    { action: 'needs_more_info', label: '要求补充材料', tone: 'neutral' },
    { action: 'reject', label: '驳回', tone: 'danger', confirm: '确认驳回这条请求？' },
  ];
}

function buttonClass(tone: PrivacyAction['tone']) {
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-600 hover:border-red-300';
  if (tone === 'primary') return 'border-[#7B4A24] bg-[#7B4A24] text-white hover:bg-[#633B1B]';
  return 'border-[#D8CDBE] bg-white text-[#6F5B42] hover:border-[#8B7355]';
}

export default function PrivacyRequestsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<PrivacyRequest[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState<{ item: PrivacyRequest; action: PrivacyAction } | null>(null);
  const [note, setNote] = useState('');

  const statusOptions = useMemo(() => Object.entries(statusLabels), []);

  function load() {
    setLoading(true);
    setError('');
    const query = status ? `?status=${status}` : '';
    fetch(`/api/admin/privacy-requests${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => readAdminResponse(res))
      .then((data) => setItems(Array.isArray(data.items) ? data.items as PrivacyRequest[] : []))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  function openAction(item: PrivacyRequest, action: PrivacyAction) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setActive({ item, action });
    setNote('');
  }

  async function submitAction() {
    if (!active) return;
    const res = await fetch(`/api/admin/privacy-requests/${active.item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: active.action.action, note }),
    });
    try {
      await readAdminResponse(res);
      setActive(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '处理失败');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2A2118]">隐私请求管理</h1>
          <p className="mt-1 text-sm text-[#8B8580]">处理认领、更正、隐藏、匿名化和删除前台展示申请。</p>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#D8CDBE] bg-white px-3 text-sm text-[#3D3226]">
          <option value="">全部状态</option>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div className="mb-4 text-sm text-[#8B8580]">{loading ? '加载中...' : `共 ${items.length} 条请求`}</div>

      <div className="grid gap-4">
        {items.map((item) => (
          <section key={item.id} className="rounded-2xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-[#2A2118]">{typeLabels[item.request_type] || item.request_type}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone[item.status] || 'border-[#E0D8CC] bg-white text-[#8B8580]'}`}>{statusLabels[item.status] || item.status}</span>
                  <span className="rounded-full bg-[#F4EFE7] px-2.5 py-1 text-xs text-[#7A6245]">{item.target_type} #{item.target_id}</span>
                </div>
                <div className="mt-2 text-sm text-[#8B8580]">
                  {[item.athlete_name || '未关联运动员', item.event_name].filter(Boolean).join(' · ')} · {formatDate(item.created_at)}
                </div>
                {item.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#3D3226]">{item.description}</p>}
                {item.contact && <div className="mt-3 rounded-xl bg-[#F7F1E8] px-3 py-2 text-sm text-[#6F5B42]"><b>联系方式：</b>{item.contact}</div>}
                {item.handler_note && <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[#8B8580]"><b>处理备注：</b>{item.handler_note}</div>}
                {item.proof_images?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {item.proof_images.map((url) => (
                      <a key={url} href={url} target="_blank" className="block h-24 w-24 overflow-hidden rounded-xl border border-[#E0D8CC] bg-[#EFE7DC]">
                        <img src={url} alt="证明图片" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex w-full flex-wrap gap-2 lg:w-56 lg:justify-end">
                {actionsFor(item).map((action) => (
                  <button key={action.action} onClick={() => openAction(item, action)} className={`rounded-lg border px-3 py-2 text-sm ${buttonClass(action.tone)}`}>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ))}
        {!loading && items.length === 0 && <div className="rounded-xl border border-dashed border-[#D8CDBE] py-12 text-center text-sm text-[#8B8580]">暂无请求</div>}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E0D8CC] bg-[#FEFCF9] p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#2A2118]">{active.action.label}</h2>
            <p className="mt-1 text-sm text-[#8B8580]">{typeLabels[active.item.request_type] || active.item.request_type} · {active.item.athlete_name || '未关联运动员'}</p>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} placeholder="处理备注（建议填写，便于追溯）" className="mt-4 w-full rounded-xl border border-[#D8CDBE] bg-white px-3 py-2 text-sm text-[#3D3226] outline-none focus:border-[#8B7355]" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setActive(null)} className="rounded-lg border border-[#D8CDBE] bg-white px-4 py-2 text-sm text-[#6F5B42]">取消</button>
              <button onClick={submitAction} className={`rounded-lg border px-4 py-2 text-sm ${buttonClass(active.action.tone)}`}>确认处理</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
