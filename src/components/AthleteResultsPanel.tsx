'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';
import ResultStatusBadge from '@/components/ResultStatusBadge';

interface ResultRow {
  result_id: number;
  event_id: number;
  athlete_id: number | null;
  athlete_name_snapshot: string;
  bib_number: string | null;
  gender_group: string;
  discipline: string;
  board_class: string | null;
  round_label: string | null;
  rank_position: number;
  finish_time: string;
  result_status_code: string | null;
  result_status_note: string | null;
  team_name: string | null;
  team_members: unknown;
  event_name: string;
  start_date: string | null;
  city: string | null;
  province: string | null;
}

interface MemberLike {
  name?: unknown;
  member_name?: unknown;
}

function parseMembers(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item: MemberLike) => String(item?.name || item?.member_name || '').trim())
      .filter(Boolean);
  }
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.map((item: MemberLike) => String(item?.name || item?.member_name || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export default function AthleteResultsPanel({ athleteId }: { athleteId: number }) {
  const { token, loading } = useUser();
  const [items, setItems] = useState<ResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [previewLocked, setPreviewLocked] = useState(false);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 10;

  const query = useMemo(() => {
    return new URLSearchParams({
      athlete_id: String(athleteId),
      page: String(page),
      pageSize: String(pageSize),
    }).toString();
  }, [athleteId, page]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFetching(true);
      setError('');
      fetch(`/api/results?${query}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '成绩加载失败');
          if (cancelled) return;
          setItems(data.items || []);
          setTotal(Number(data.total || 0));
          setPreviewLocked(Boolean(data.preview_locked));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : '成绩加载失败');
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, query, token]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 14, padding: '24px 28px', marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 20, background: '#7A6145', borderRadius: 2 }} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: '#2E2118', margin: 0 }}>成绩档案</h2>
        </div>
        <Link href={`/results?athlete_id=${athleteId}`} style={{ color: '#7A6145', fontSize: 13, textDecoration: 'none' }}>
          进入成绩查询
        </Link>
      </div>

      {loading && <p style={{ fontSize: 14, color: '#8A8078', margin: 0 }}>正在检查登录状态...</p>}

      {!loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#8A8078', fontSize: 13, marginBottom: 14 }}>
            <span>已收录 {total} 条成绩</span>
            {fetching && <span>加载中...</span>}
          </div>
          {previewLocked && (
            <div style={{ border: '1px solid #DFC7A7', background: '#FFF8EA', color: '#6B4A24', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>未登录可预览前 3 条，登录后查看完整成绩档案。</span>
              <Link href={`/login?redirect=${encodeURIComponent(`/athletes/${athleteId}`)}`} style={{ color: '#6B3E1E', fontWeight: 700, textDecoration: 'none' }}>登录查看全部</Link>
            </div>
          )}
          {error && <div style={{ border: '1px solid #F2C4C4', background: '#FFF5F5', color: '#9B2C2C', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ overflowX: 'auto', border: '1px solid #EDE5D8', borderRadius: 10 }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F0E7D8', color: '#655D56' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>赛事</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>项目</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>组别</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 500 }}>名次</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>成绩</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const members = parseMembers(row.team_members);
                  return (
                  <tr key={row.result_id} style={{ borderTop: '1px solid #F0EAE0' }}>
                    <td style={{ padding: '11px 12px', color: '#3D3730', lineHeight: 1.55 }}>
                      <Link href={`/events/${row.event_id}`} style={{ color: '#6F563B', fontWeight: 600, textDecoration: 'none' }}>{row.event_name}</Link>
                      <div style={{ fontSize: 11, color: '#9A9086' }}>{[row.province, row.city].filter(Boolean).join(' · ')} {row.start_date?.slice(0, 10)}</div>
                    </td>
                    <td style={{ padding: '11px 12px', color: '#655D56' }}>
                      {row.discipline}{row.board_class ? ` / ${row.board_class}` : ''}
                      {members.length > 0 && <div style={{ fontSize: 11, color: '#9A9086', marginTop: 3 }}>成员：{members.join('、')}</div>}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#655D56' }}>{row.gender_group}{row.round_label ? ` · ${row.round_label}` : ''}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'center', color: '#2E2118', fontWeight: 700 }}>{row.rank_position >= 9000 ? '—' : row.rank_position}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', color: '#7A6145', fontWeight: 700 }}><ResultStatusBadge finishTime={row.finish_time} statusCode={row.result_status_code} statusNote={row.result_status_note} /></td>
                  </tr>
                  );
                })}
                {!fetching && items.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '28px 12px', textAlign: 'center', color: '#9A9086' }}>暂无已收录成绩</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, color: '#8A8078', fontSize: 13 }}>
              <span>第 {page} / {totalPages} 页</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))} style={{ border: '1px solid #D8CDBE', background: page <= 1 ? '#F6F0E8' : '#FFFCF7', color: '#655D56', borderRadius: 8, padding: '7px 11px', opacity: page <= 1 ? 0.5 : 1 }}>上一页</button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))} style={{ border: '1px solid #D8CDBE', background: page >= totalPages ? '#F6F0E8' : '#FFFCF7', color: '#655D56', borderRadius: 8, padding: '7px 11px', opacity: page >= totalPages ? 0.5 : 1 }}>下一页</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
