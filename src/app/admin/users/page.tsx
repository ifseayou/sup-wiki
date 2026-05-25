'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { DEFAULT_RESULT_QUERY_LIMITS, USER_LEVEL_LABELS, normalizeUserLevel } from '@/lib/user-levels';

interface UserRow {
  user_id: number;
  nickname: string;
  email: string;
  user_level: string;
  status: string;
  daily_result_query_limit: number | null;
  admin_note: string | null;
  today_result_queries: number;
  owned_athlete_count: number;
  owned_athletes?: {
    athlete_id: number;
    name: string;
    name_en: string | null;
    role: string;
    status: string;
    verified_at: string | null;
  }[];
  claim_count: number;
  created_at: string;
  last_login_at: string | null;
}

const levelOptions = [
  ['free', `${USER_LEVEL_LABELS.free}（默认 ${DEFAULT_RESULT_QUERY_LIMITS.free} 次/天）`],
  ['vip', `${USER_LEVEL_LABELS.vip}（默认 ${DEFAULT_RESULT_QUERY_LIMITS.vip} 次/天）`],
  ['svip', `${USER_LEVEL_LABELS.svip}（默认 ${DEFAULT_RESULT_QUERY_LIMITS.svip} 次/天）`],
  ['admin', `${USER_LEVEL_LABELS.admin}（不限次数）`],
  ['blocked', `${USER_LEVEL_LABELS.blocked}（0 次/天）`],
] as const;

function defaultLimitText(level: string) {
  const normalized = normalizeUserLevel(level);
  const limit = DEFAULT_RESULT_QUERY_LIMITS[normalized];
  return limit === null ? '不限次数' : `默认 ${limit} 次/天`;
}

export default function AdminUsersPage() {
  const { token } = useAdminAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
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
  }, [token]);

  function updateLocal(userId: number, key: keyof UserRow, value: unknown) {
    setItems((prev) => prev.map((item) => item.user_id === userId ? { ...item, [key]: value } : item));
  }

  function updateLevel(userId: number, level: string) {
    setItems((prev) => prev.map((item) => item.user_id === userId
      ? { ...item, user_level: level, daily_result_query_limit: level === 'admin' ? null : item.daily_result_query_limit }
      : item));
  }

  async function save(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        user_level: user.user_level,
        status: user.status,
        daily_result_query_limit: user.daily_result_query_limit,
        admin_note: user.admin_note,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '保存失败');
      return;
    }
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#2A2118' }}>用户管理</h1>
          <p style={{ margin: '6px 0 0', color: '#8B8580', fontSize: 13 }}>
            普通 5 次/天，VIP 20 次/天，SVIP 200 次/天，管理员与 i_add_u 不限次数。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="搜索昵称 / 邮箱" style={{ height: 36, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 10px' }} />
          <button onClick={load} style={{ height: 36, border: '1px solid #8B7355', borderRadius: 8, background: '#8B7355', color: '#fff', padding: '0 14px' }}>查询</button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 12, border: '1px solid #F2C4C4', background: '#FFF5F5', color: '#9B2C2C', borderRadius: 8, padding: 12 }}>{error}</div>}
      {loading && <div style={{ color: '#8B8580', marginBottom: 12 }}>加载中...</div>}

      <div style={{ overflowX: 'auto', border: '1px solid #E0D8CC', borderRadius: 12, background: '#FEFCF9' }}>
        <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#F1E9DE', color: '#6F5B42' }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left' }}>用户</th>
              <th style={{ padding: 12, textAlign: 'left' }}>等级</th>
              <th style={{ padding: 12, textAlign: 'left' }}>状态</th>
              <th style={{ padding: 12, textAlign: 'left' }}>每日查询上限</th>
              <th style={{ padding: 12, textAlign: 'left' }}>今日查询</th>
              <th style={{ padding: 12, textAlign: 'left' }}>绑定运动员 / 提交</th>
              <th style={{ padding: 12, textAlign: 'left' }}>备注</th>
              <th style={{ padding: 12, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.user_id} style={{ borderTop: '1px solid #EDE5D8' }}>
                <td style={{ padding: 12, color: '#2A2118' }}>
                  <div style={{ fontWeight: 700 }}>{user.nickname || `用户 #${user.user_id}`}</div>
                  <div style={{ color: '#8B8580', marginTop: 3 }}>{user.email}</div>
                  <div style={{ color: '#B0A090', marginTop: 3 }}>注册 {user.created_at?.slice(0, 10)}</div>
                </td>
                <td style={{ padding: 12 }}>
                  <select value={normalizeUserLevel(user.user_level)} onChange={(e) => updateLevel(user.user_id, e.target.value)} style={{ height: 34, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 8px' }}>
                    {levelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
                <td style={{ padding: 12 }}>
                  <select value={user.status || 'active'} onChange={(e) => updateLocal(user.user_id, 'status', e.target.value)} style={{ height: 34, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 8px' }}>
                    <option value="active">正常</option>
                    <option value="blocked">封禁</option>
                  </select>
                </td>
                <td style={{ padding: 12 }}>
                  <input
                    value={normalizeUserLevel(user.user_level) === 'admin' ? '不限次数' : (user.daily_result_query_limit ?? '')}
                    onChange={(e) => updateLocal(user.user_id, 'daily_result_query_limit', e.target.value)}
                    disabled={normalizeUserLevel(user.user_level) === 'admin'}
                    placeholder={defaultLimitText(user.user_level)}
                    style={{
                      width: 140,
                      height: 34,
                      border: '1px solid #D8CDBE',
                      borderRadius: 8,
                      padding: '0 8px',
                      background: normalizeUserLevel(user.user_level) === 'admin' ? '#F4EFE8' : '#fff',
                    }}
                  />
                </td>
                <td style={{ padding: 12, color: '#6F5B42', fontWeight: 700 }}>{user.today_result_queries || 0}</td>
                <td style={{ padding: 12, color: '#6F5B42', minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{user.owned_athlete_count || 0} / {user.claim_count || 0}</div>
                  {Array.isArray(user.owned_athletes) && user.owned_athletes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                      {user.owned_athletes.map((athlete) => (
                        <a
                          key={athlete.athlete_id}
                          href={`/athletes/${athlete.athlete_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            width: 'fit-content',
                            maxWidth: 220,
                            color: '#7A4E22',
                            textDecoration: 'none',
                            fontSize: 12,
                            lineHeight: 1.45,
                          }}
                          title={athlete.name_en || athlete.name}
                        >
                          #{athlete.athlete_id} {athlete.name}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#B0A090', fontSize: 12, marginTop: 4 }}>未绑定运动员</div>
                  )}
                </td>
                <td style={{ padding: 12 }}>
                  <input value={user.admin_note || ''} onChange={(e) => updateLocal(user.user_id, 'admin_note', e.target.value)} style={{ width: 220, height: 34, border: '1px solid #D8CDBE', borderRadius: 8, padding: '0 8px' }} />
                </td>
                <td style={{ padding: 12, textAlign: 'right' }}>
                  <button onClick={() => save(user)} style={{ border: '1px solid #2A2118', borderRadius: 8, background: '#2A2118', color: '#fff', padding: '8px 12px' }}>保存</button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 36, textAlign: 'center', color: '#8B8580' }}>暂无用户</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
