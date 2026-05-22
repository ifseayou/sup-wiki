'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';

interface ClaimRow {
  claim_id: number;
  status: string;
  athlete_id: number;
  user_id: number;
  nickname: string;
  email: string;
  user_level: string;
  current_name: string;
  current_photo: string | null;
  submitted_name: string | null;
  submitted_avatar_url: string | null;
  submitted_birth_year: number | null;
  submitted_birth_date: string | null;
  submitted_hometown_province: string | null;
  submitted_hometown_city: string | null;
  submitted_living_province: string | null;
  submitted_living_city: string | null;
  submitted_started_sup_year: number | null;
  submitted_intro_short: string | null;
  submitted_intro: string | null;
  event_name: string | null;
  discipline: string | null;
  gender_group: string | null;
  finish_time: string | null;
  submitted_bib_number: string | null;
  verified_bib_number: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  all: '全部',
};

export default function AdminAthleteClaimsPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<ClaimRow[]>([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ status });
    if (search) params.set('search', search);
    fetch(`/api/admin/athlete-claims?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '加载失败');
        setItems(data.items || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token]);

  async function review(claimId: number, action: 'approve' | 'reject') {
    const note = action === 'reject' ? window.prompt('拒绝原因（可选）') || '' : '';
    const res = await fetch(`/api/admin/athlete-claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, reviewer_note: note }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '处理失败');
      return;
    }
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>运动员资料审批</h1>
          <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>优先处理号码牌已校验通过的“这是我，更新资料”提交。</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="搜索运动员 / 用户" style={{ height: 36, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 10px' }} />
          <button onClick={load} style={{ height: 36, border: '1px solid #8B7355', borderRadius: 8, background: '#8B7355', color: '#fff', padding: '0 14px' }}>查询</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['pending', 'approved', 'rejected', 'all'].map((item) => (
          <button key={item} onClick={() => setStatus(item)} style={{ border: '1px solid #D8CDBE', borderRadius: 999, padding: '7px 13px', background: status === item ? '#2A2118' : '#fff', color: status === item ? '#fff' : '#6F5B42' }}>
            {statusLabels[item]}
          </button>
        ))}
      </div>

      {error && <div style={{ marginBottom: 12, border: '1px solid #F2C4C4', background: '#FFF5F5', color: '#9B2C2C', borderRadius: 8, padding: 12 }}>{error}</div>}
      {loading && <div style={{ color: '#8B8580', marginBottom: 12 }}>加载中...</div>}

      <div style={{ display: 'grid', gap: 14 }}>
        {items.map((item) => (
          <section key={item.claim_id} style={{ border: '1px solid #E0D8CC', borderRadius: 12, background: '#FEFCF9', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2A2118' }}>{item.current_name} #{item.athlete_id}</div>
                <div style={{ marginTop: 4, color: '#8B8580', fontSize: 13 }}>提交用户：{item.nickname} / {item.email} / {item.user_level}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ borderRadius: 999, background: item.status === 'pending' ? '#FFF1D6' : '#EEE7DC', color: '#6B4A24', padding: '6px 10px', fontSize: 12 }}>{statusLabels[item.status] || item.status}</span>
                {item.status === 'pending' && (
                  <>
                    <button onClick={() => review(item.claim_id, 'reject')} style={{ border: '1px solid #D9B9B9', borderRadius: 8, background: '#FFF5F5', color: '#9B2C2C', padding: '8px 12px' }}>拒绝</button>
                    <button onClick={() => review(item.claim_id, 'approve')} style={{ border: '1px solid #2F7D52', borderRadius: 8, background: '#2F7D52', color: '#fff', padding: '8px 12px' }}>通过并更新主页</button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ color: '#8B8580', fontSize: 12, marginBottom: 6 }}>头像对比</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[item.current_photo, item.submitted_avatar_url].map((url, index) => (
                    <div key={index} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#EFE7DC', border: '1px solid #E0D8CC' }}>
                      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#4B4238' }}>
                <div><strong>提交姓名：</strong>{item.submitted_name || '-'}</div>
                <div><strong>出生日期：</strong>{item.submitted_birth_date?.slice(0, 10) || item.submitted_birth_year || '-'}</div>
                <div><strong>籍贯：</strong>{[item.submitted_hometown_province, item.submitted_hometown_city].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>现居：</strong>{[item.submitted_living_province, item.submitted_living_city].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>开始桨板：</strong>{item.submitted_started_sup_year || '-'}</div>
                <div><strong>一句话：</strong>{item.submitted_intro_short || '-'}</div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#4B4238' }}>
                <div><strong>校验赛事：</strong>{item.event_name || '-'}</div>
                <div><strong>项目组别：</strong>{[item.discipline, item.gender_group].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>成绩：</strong>{item.finish_time || '-'}</div>
                <div><strong>号码牌：</strong>{item.submitted_bib_number || '-'} / 数据库 {item.verified_bib_number || '-'}</div>
                <div><strong>提交时间：</strong>{item.created_at?.slice(0, 19).replace('T', ' ')}</div>
              </div>
            </div>
            {item.submitted_intro && <div style={{ marginTop: 12, borderTop: '1px solid #EDE5D8', paddingTop: 12, fontSize: 13, color: '#5D5348', lineHeight: 1.7 }}>{item.submitted_intro}</div>}
          </section>
        ))}
        {!loading && items.length === 0 && <div style={{ border: '1px dashed #D8CDBE', borderRadius: 12, padding: 32, textAlign: 'center', color: '#8B8580' }}>暂无提交</div>}
      </div>
    </div>
  );
}
