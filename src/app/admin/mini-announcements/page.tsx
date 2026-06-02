'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

type Announcement = {
  id: number;
  title: string;
  ticker: string;
  detail: string;
  status: string;
  sort_order: number;
  updated_at: string;
};

const emptyForm = { id: 0, title: '', ticker: '', detail: '', status: 'draft', sort_order: 0 };

export default function MiniAnnouncementsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/admin/mini-announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setItems(data.items || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(status = form.status) {
    const method = form.id ? 'PATCH' : 'POST';
    const url = form.id ? `/api/admin/mini-announcements/${form.id}` : '/api/admin/mini-announcements';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || '保存失败');
      return;
    }
    setForm(emptyForm);
    load();
  }

  async function remove(id: number) {
    if (!confirm('确认删除这条公告？')) return;
    await fetch(`/api/admin/mini-announcements/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>首页公告</h1>
        <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>同一时间仅一条发布公告生效，会显示在小程序 SUP 首页顶部跑马灯。</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ background: '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 14, padding: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 18, color: '#2A2118' }}>{form.id ? '编辑公告' : '新建公告'}</h2>
          <label style={labelStyle}>标题</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} placeholder="例如：成绩查询规则更新" />
          <label style={labelStyle}>跑马灯文字</label>
          <input value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })} style={inputStyle} placeholder="留空默认使用标题" />
          <label style={labelStyle}>详情内容</label>
          <textarea
            value={form.detail}
            onChange={e => setForm({ ...form, detail: e.target.value })}
            style={{ ...inputStyle, height: 180, paddingTop: 10, lineHeight: 1.6 }}
            placeholder={'每行一段，或用 1. 2. 3. 分段；小程序公告详情和分享图会按段落排版。'}
          />
          <label style={labelStyle}>排序</label>
          <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} style={inputStyle} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => save('draft')} style={buttonGhost}>保存草稿</button>
            <button onClick={() => save('published')} style={buttonPrimary}>发布生效</button>
            {form.id ? <button onClick={() => setForm(emptyForm)} style={buttonGhost}>取消</button> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ color: '#8B8580', fontSize: 13 }}>{loading ? '加载中...' : `共 ${items.length} 条公告`}</div>
          {items.map(item => (
            <div key={item.id} style={{ background: item.status === 'published' ? '#F0F8F5' : '#FEFCF9', border: '1px solid #E0D8CC', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#2A2118' }}>{item.title}</div>
                  <div style={{ marginTop: 5, color: '#8B8580', fontSize: 13 }}>{item.status === 'published' ? '已发布' : item.status} · 排序 {item.sort_order}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setForm({ id: item.id, title: item.title, ticker: item.ticker, detail: item.detail, status: item.status, sort_order: item.sort_order })} style={buttonGhost}>编辑</button>
                  <button onClick={() => remove(item.id)} style={buttonGhost}>删除</button>
                </div>
              </div>
              {item.ticker && <p style={{ margin: '10px 0 0', color: '#6F5B42' }}>{item.ticker}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', margin: '12px 0 6px', color: '#6F5B42', fontSize: 13, fontWeight: 700 };
const inputStyle = { width: '100%', height: 38, boxSizing: 'border-box' as const, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 10px', background: '#fff' };
const buttonPrimary = { height: 36, border: 0, borderRadius: 8, padding: '0 14px', background: '#8B7355', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const buttonGhost = { height: 36, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 14px', background: '#fff', color: '#6F5B42', fontWeight: 700, cursor: 'pointer' };
