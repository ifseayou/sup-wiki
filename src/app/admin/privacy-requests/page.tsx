'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

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
};

export default function PrivacyRequestsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<PrivacyRequest[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const query = status ? `?status=${status}` : '';
    fetch(`/api/admin/privacy-requests${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '加载失败');
        setItems(data.items || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  async function handleAction(id: number, action: string) {
    const note = window.prompt('处理备注（可选）') || '';
    const res = await fetch(`/api/admin/privacy-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, note }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || '处理失败');
      return;
    }
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>隐私请求管理</h1>
          <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>处理认领、更正、隐藏、匿名化和删除前台展示申请。</p>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 36, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 10px' }}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <div style={{ marginBottom: 12, color: '#9B2C2C' }}>{error}</div>}
      <div style={{ marginBottom: 12, color: '#8B8580', fontSize: 13 }}>{loading ? '加载中...' : `共 ${items.length} 条请求`}</div>
      <div style={{ display: 'grid', gap: 14 }}>
        {items.map(item => (
          <div key={item.id} style={{ background: '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 800, color: '#2A2118' }}>{typeLabels[item.request_type] || item.request_type} · {statusLabels[item.status] || item.status}</div>
                <div style={{ marginTop: 5, color: '#8B8580', fontSize: 13 }}>
                  {item.athlete_name || '未关联运动员'} {item.event_name ? `· ${item.event_name}` : ''} · {item.target_type} #{item.target_id}
                </div>
              </div>
              <div style={{ color: '#8B8580', fontSize: 13 }}>{String(item.created_at || '').slice(0, 19).replace('T', ' ')}</div>
            </div>
            <p style={{ margin: '14px 0 0', color: '#3D3226', lineHeight: 1.65 }}>{item.description}</p>
            {item.contact && <p style={{ margin: '8px 0 0', color: '#8B7355' }}><b>联系方式：</b>{item.contact}</p>}
            {item.proof_images?.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                {item.proof_images.map(url => <a key={url} href={url} target="_blank" style={{ width: 92, height: 92, borderRadius: 10, background: `url(${url}) center / cover`, border: '1px solid #E0D8CC' }} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button onClick={() => handleAction(item.id, 'approve_hide_athlete')}>通过并隐藏主页</button>
              <button onClick={() => handleAction(item.id, 'approve_anonymize_name')}>通过并匿名姓名</button>
              <button onClick={() => handleAction(item.id, 'approve_delete_frontend')}>通过并删除前台展示</button>
              <button onClick={() => handleAction(item.id, 'approve_correction')}>通过并更正信息</button>
              <button onClick={() => handleAction(item.id, 'needs_more_info')}>要求补充材料</button>
              <button onClick={() => handleAction(item.id, 'reject')}>驳回</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
