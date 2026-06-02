'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';
import { formatChinaDateTime } from '@/lib/china-time';

type Feedback = {
  id: number;
  nickname: string;
  bug_text: string;
  feature_text: string;
  rating: number;
  willing_to_share: boolean;
  image_urls: string[];
  status: string;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  new: '新反馈',
  reviewing: '处理中',
  resolved: '已解决',
  ignored: '暂不处理',
};

export default function MiniFeedbackPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Feedback[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const query = status ? `?status=${status}` : '';
    fetch(`/api/admin/mini-feedback${query}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const data = await readAdminResponse(res);
        setItems(Array.isArray(data.items) ? data.items as Feedback[] : []);
      })
      .catch(err => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  async function updateStatus(id: number, nextStatus: string) {
    const res = await fetch(`/api/admin/mini-feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const data = await readAdminResponse(res).catch((error) => ({ error: error instanceof Error ? error.message : '保存失败' }));
      alert(data.error || '保存失败');
      return;
    }
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>用户反馈</h1>
          <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>查看小程序用户提交的 bug、功能期待、评分和截图。</p>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ height: 36, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 10px' }}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <div style={{ marginBottom: 12, color: '#9B2C2C' }}>{error}</div>}
      <div style={{ marginBottom: 12, color: '#8B8580', fontSize: 13 }}>{loading ? '加载中...' : `共 ${items.length} 条反馈`}</div>
      <div style={{ display: 'grid', gap: 14 }}>
        {items.map(item => (
          <div key={item.id} style={{ background: '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#2A2118' }}>{item.nickname || '微信用户'} · {'★'.repeat(item.rating || 0)}{'☆'.repeat(Math.max(0, 5 - (item.rating || 0)))}</div>
                <div style={{ marginTop: 4, color: '#8B8580', fontSize: 13 }}>{formatChinaDateTime(item.created_at) || '-'} · {item.willing_to_share ? '愿意分享' : '暂不分享'}</div>
              </div>
              <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)} style={{ height: 34, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 8px' }}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {item.bug_text && <p style={{ margin: '16px 0 0', color: '#3D3226', lineHeight: 1.65 }}><b>Bug：</b>{item.bug_text}</p>}
            {item.feature_text && <p style={{ margin: '10px 0 0', color: '#3D3226', lineHeight: 1.65 }}><b>期待功能：</b>{item.feature_text}</p>}
            {item.image_urls?.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                {item.image_urls.map(url => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    style={{
                      display: 'block',
                      width: 120,
                      height: 120,
                      borderRadius: 10,
                      border: '1px solid #E0D8CC',
                      backgroundImage: `url(${url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
