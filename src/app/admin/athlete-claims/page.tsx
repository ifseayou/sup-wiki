'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';

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
  submitted_contact: string | null;
  submitted_sup_photo_urls?: string[];
  submitted_photo_urls?: string[];
  diffs?: {
    againstCurrent?: ClaimDiffField[];
    againstPreviousSubmission?: ClaimDiffField[];
  };
  event_name: string | null;
  discipline: string | null;
  gender_group: string | null;
  finish_time: string | null;
  submitted_bib_number: string | null;
  verified_bib_number: string | null;
  created_at: string;
}

interface ClaimDiffField {
  key: string;
  label: string;
  before: string | string[] | null;
  after: string | string[] | null;
  change: 'added' | 'changed' | 'removed';
}

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  all: '全部',
};

const changeLabels: Record<ClaimDiffField['change'], string> = {
  added: '新增',
  changed: '修改',
  removed: '删除',
};

function formatDateOnly(value: string | null) {
  if (!value) return '-';
  const text = String(value);
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSubmittedBirth(item: ClaimRow) {
  if (item.submitted_birth_date) return formatDateOnly(item.submitted_birth_date);
  return item.submitted_birth_year ? `${item.submitted_birth_year}` : '-';
}

function formatDiffValue(key: string, value: string | string[] | null) {
  if (Array.isArray(value)) return value.length ? `${value.length} 张图片` : '-';
  if (key.includes('birth') || key.includes('date')) return formatDateOnly(value);
  return value || '-';
}

function DiffPanel({ title, items }: { title: string; items: ClaimDiffField[] }) {
  return (
    <div style={{ border: '1px solid #EDE5D8', borderRadius: 10, background: '#FFFDF9', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4B4238' }}>{title}</div>
        <span style={{ fontSize: 12, color: '#8B8580' }}>{items.length ? `${items.length} 项变化` : '无变化'}</span>
      </div>
      {items.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((diff) => (
            <div key={`${title}-${diff.key}`} style={{ display: 'grid', gridTemplateColumns: '80px 48px 1fr', gap: 8, alignItems: 'start', fontSize: 12, color: '#5D5348' }}>
              <strong style={{ color: '#2A2118' }}>{diff.label}</strong>
              <span style={{ borderRadius: 999, background: diff.change === 'removed' ? '#FFF5F5' : '#F7F1E8', color: diff.change === 'removed' ? '#9B2C2C' : '#6B4A24', padding: '2px 7px', textAlign: 'center' }}>
                {changeLabels[diff.change]}
              </span>
              <span>
                <span style={{ color: '#9B9288' }}>{formatDiffValue(diff.key, diff.before)}</span>
                <span style={{ margin: '0 6px', color: '#B49B7B' }}>→</span>
                <span style={{ color: '#2A2118' }}>{formatDiffValue(diff.key, diff.after)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#8B8580' }}>这次提交与对比对象没有可见字段差异。</div>
      )}
    </div>
  );
}

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
        const data = await readAdminResponse(res);
        setItems(Array.isArray(data.items) ? data.items as ClaimRow[] : []);
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
    try {
      await readAdminResponse(res);
    } catch (error) {
      alert(error instanceof Error ? error.message : '处理失败');
      return;
    }
    load();
  }

  function preview(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
              <DiffPanel title="相对当前主页" items={item.diffs?.againstCurrent || []} />
              <DiffPanel title="相对上次提交" items={item.diffs?.againstPreviousSubmission || []} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ color: '#8B8580', fontSize: 12, marginBottom: 6 }}>头像资料</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: '当前主页', url: item.current_photo },
                    { label: '用户提交', url: item.submitted_avatar_url },
                  ].map(({ label, url }) => (
                    <div key={label}>
                    <div onClick={() => url && preview(url)} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#EFE7DC', border: '1px solid #E0D8CC', cursor: url ? 'pointer' : 'default' }}>
                      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ marginTop: 4, textAlign: 'center', fontSize: 11, color: '#8B8580' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#4B4238' }}>
                <div><strong>提交姓名：</strong>{item.submitted_name || '-'}</div>
                <div><strong>出生日期：</strong>{formatSubmittedBirth(item)}</div>
                <div><strong>籍贯：</strong>{[item.submitted_hometown_province, item.submitted_hometown_city].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>现居：</strong>{[item.submitted_living_province, item.submitted_living_city].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>一句话：</strong>{item.submitted_intro_short || '-'}</div>
                <div><strong>联系方式：</strong>{item.submitted_contact || '-'}</div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#4B4238' }}>
                <div><strong>校验赛事：</strong>{item.event_name || '-'}</div>
                <div><strong>项目组别：</strong>{[item.discipline, item.gender_group].filter(Boolean).join(' · ') || '-'}</div>
                <div><strong>成绩：</strong>{item.finish_time || '-'}</div>
                <div><strong>号码牌：</strong>{item.submitted_bib_number || '-'} / 数据库 {item.verified_bib_number || '-'}</div>
                <div><strong>提交时间：</strong>{item.created_at?.slice(0, 19).replace('T', ' ')}</div>
              </div>
            </div>
            {(item.submitted_sup_photo_urls || []).length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #EDE5D8', paddingTop: 12 }}>
                <div style={{ color: '#8B8580', fontSize: 12, marginBottom: 8 }}>提交的桨板照片（审核通过后进入运动员更多照片）</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(item.submitted_sup_photo_urls || []).map((url, index) => (
                    <button key={`${url}-${index}`} onClick={() => preview(url)} style={{ width: 120, height: 90, padding: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #E0D8CC', background: '#F7F1E8', cursor: 'pointer' }}>
                      <img src={url} alt={`桨板照片 ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {item.submitted_intro && <div style={{ marginTop: 12, borderTop: '1px solid #EDE5D8', paddingTop: 12, fontSize: 13, color: '#5D5348', lineHeight: 1.7 }}>{item.submitted_intro}</div>}
          </section>
        ))}
        {!loading && items.length === 0 && <div style={{ border: '1px dashed #D8CDBE', borderRadius: 12, padding: 32, textAlign: 'center', color: '#8B8580' }}>暂无提交</div>}
      </div>
    </div>
  );
}
