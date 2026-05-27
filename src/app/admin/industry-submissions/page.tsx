'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/app/admin/layout';

interface Submission {
  submission_id: number;
  submission_type: 'professional' | 'club';
  name: string;
  roles: string[];
  club_name: string | null;
  contact_info: string | null;
  location_note: string | null;
  profile_images: string[];
  club_photos: string[];
  certificate_images: string[];
  license_images: string[];
  ocr_status: string;
  ocr_text: string | null;
  ocr_result_json: string | null;
  status: string;
  admin_note: string | null;
  created_club_id: number | null;
  created_professional_id: number | null;
  nickname: string | null;
  email: string | null;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  coach: '教练员',
  referee: '裁判员',
  club_owner: '俱乐部负责人',
};

const statusLabels: Record<string, string> = {
  pending: '待审核',
  reviewing: '处理中',
  approved: '已通过',
  rejected: '已驳回',
};

function ImageStrip({ images }: { images: string[] }) {
  if (images.length === 0) return <span style={{ color: '#9B9289' }}>暂无图片</span>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {images.map((url, index) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: 84, height: 84, borderRadius: 14, overflow: 'hidden', border: '1px solid #E3D6C6', background: '#F2E8DB' }}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </a>
      ))}
    </div>
  );
}

export default function AdminIndustrySubmissionsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      params.set('pageSize', '50');
      const res = await fetch(`/api/admin/industry-submissions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取入驻提交失败');
      setItems(data.items || []);
      setNotes(Object.fromEntries((data.items || []).map((item: Submission) => [item.submission_id, item.admin_note || ''])));
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取入驻提交失败');
    } finally {
      setLoading(false);
    }
  }, [token, search, type, status]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleAction(item: Submission, action: 'reviewing' | 'reject' | 'approve') {
    if (action === 'approve' && !window.confirm('确认审核通过并生成正式记录？')) return;
    try {
      const res = await fetch(`/api/admin/industry-submissions/${item.submission_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, admin_note: notes[item.submission_id] || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }

  return (
    <main style={{ padding: 36, color: '#2E2118' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0 }}>入驻审核</h1>
          <p style={{ marginTop: 8, color: '#8A8078' }}>审核教练员、裁判员、俱乐部负责人和俱乐部提交的图片资料，通过后生成正式记录。</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名 / 俱乐部 / 用户" style={{ width: 240, height: 44, border: '1px solid #D8C8B6', borderRadius: 12, padding: '0 14px', background: '#FEFCF9' }} />
          <select value={type} onChange={(event) => setType(event.target.value)} style={{ height: 44, border: '1px solid #D8C8B6', borderRadius: 12, padding: '0 12px', background: '#FEFCF9' }}>
            <option value="">全部类型</option>
            <option value="professional">专业人员</option>
            <option value="club">俱乐部</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ height: 44, border: '1px solid #D8C8B6', borderRadius: 12, padding: '0 12px', background: '#FEFCF9' }}>
            <option value="">全部状态</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={loadItems} style={{ height: 44, border: 0, borderRadius: 12, padding: '0 20px', background: '#7A5530', color: '#fff', fontWeight: 600 }}>查询</button>
        </div>
      </div>

      {error && <div style={{ border: '1px solid #F2B8B5', background: '#FFF2F1', color: '#B3261E', borderRadius: 14, padding: 14, marginBottom: 18 }}>{error}</div>}
      {loading ? (
        <div style={{ padding: 40, color: '#8A8078' }}>加载中…</div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {items.map((item) => {
            const allImages = [...item.profile_images, ...item.club_photos, ...item.certificate_images, ...item.license_images];
            return (
              <section key={item.submission_id} style={{ border: '1px solid #E0D4C6', borderRadius: 22, background: '#FEFCF9', boxShadow: '0 18px 42px rgba(73,48,25,0.07)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 320px', gap: 24, padding: 24 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{item.name} #{item.submission_id}</h2>
                      <span style={{ borderRadius: 999, padding: '6px 12px', background: item.submission_type === 'club' ? '#EAF2E4' : '#F4E8D8', color: '#705238', fontSize: 13 }}>{item.submission_type === 'club' ? '俱乐部' : '专业人员'}</span>
                      <span style={{ borderRadius: 999, padding: '6px 12px', background: '#F2F0ED', color: '#6C6259', fontSize: 13 }}>{statusLabels[item.status] || item.status}</span>
                    </div>
                    <div style={{ marginTop: 14, lineHeight: 1.9, color: '#655D56' }}>
                      <div>提交用户：{item.nickname || '-'} / {item.email || '-'}</div>
                      {item.roles?.length > 0 && <div>身份：{item.roles.map((role) => roleLabels[role] || role).join('、')}</div>}
                      {item.club_name && <div>所属俱乐部：{item.club_name}</div>}
                      {item.location_note && <div>城市/地址：{item.location_note}</div>}
                      {item.contact_info && <div>审核联系方式：{item.contact_info}</div>}
                      <div>提交时间：{item.created_at?.slice(0, 19).replace('T', ' ')}</div>
                      {item.created_club_id && <div>生成俱乐部：<Link href={`/admin/clubs?search=${encodeURIComponent(item.name)}`}>#{item.created_club_id}</Link></div>}
                      {item.created_professional_id && <div>生成专业人员：<Link href={`/admin/professionals?search=${encodeURIComponent(item.name)}`}>#{item.created_professional_id}</Link></div>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>提交图片</div>
                    <ImageStrip images={allImages} />
                    <div style={{ marginTop: 16, fontWeight: 700 }}>OCR 辅助识别</div>
                    <div style={{ marginTop: 8, maxHeight: 120, overflow: 'auto', borderRadius: 14, background: '#F7F1E8', padding: 12, color: '#655D56', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {item.ocr_text || (item.ocr_status === 'not_configured' ? '未配置 OCR，按人工审核处理。' : '暂无可识别文本。')}
                    </div>
                  </div>
                  <div>
                    <textarea
                      value={notes[item.submission_id] || ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.submission_id]: event.target.value }))}
                      placeholder="管理员备注"
                      style={{ width: '100%', height: 120, border: '1px solid #D8C8B6', borderRadius: 14, padding: 12, background: '#FFFDF9', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                      <button onClick={() => handleAction(item, 'reviewing')} disabled={item.status === 'approved'} style={{ border: '1px solid #D8C8B6', borderRadius: 12, background: '#FFFDF9', padding: '10px 14px', color: '#7A5530' }}>标记处理中</button>
                      <button onClick={() => handleAction(item, 'approve')} disabled={item.status === 'approved'} style={{ border: 0, borderRadius: 12, background: '#2F7D4B', padding: '10px 14px', color: '#fff', fontWeight: 700 }}>通过并生成</button>
                      <button onClick={() => handleAction(item, 'reject')} disabled={item.status === 'approved'} style={{ border: '1px solid #FFD2D2', borderRadius: 12, background: '#FFF4F4', padding: '10px 14px', color: '#D14343' }}>驳回</button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
          {items.length === 0 && <div style={{ border: '1px dashed #D8C8B6', borderRadius: 20, padding: 48, textAlign: 'center', color: '#8A8078' }}>暂无入驻提交。</div>}
        </div>
      )}
    </main>
  );
}
