'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/app/admin/layout';
import { readAdminResponse } from '@/lib/admin-api-client';

interface ResultRow {
  result_id: number;
  athlete_name_snapshot: string;
  event_name: string;
  discipline: string;
  gender_group: string;
  board_class: string | null;
  rank_position: number | null;
  finish_time: string | null;
  result_status_code: string | null;
}

interface BatchRow {
  batch_id: string;
  operation: string;
  created_at: string;
  row_count: number;
  rolled_back: boolean;
  from_ids: string;
  to_ids: string;
}

const operationLabels: Record<string, string> = {
  merge: '合并',
  transfer: '全量迁移',
  split: '拆分迁移',
};

function fmt(value: string) {
  if (!value) return '-';
  const m = String(value).match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  return m ? m[0].replace('T', ' ') : String(value);
}

export default function AthleteTransferPage() {
  const { token } = useAdminAuth();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [note, setNote] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadBatches = useCallback(async () => {
    const q = fromId ? `?athlete_id=${Number(fromId)}` : '';
    const res = await fetch(`/api/admin/athletes/merge-rollback${q}`, { headers: authHeaders });
    const data = await readAdminResponse(res) as { items?: BatchRow[] };
    if (data?.items) setBatches(data.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, token]);

  useEffect(() => { if (token) loadBatches(); }, [token, loadBatches]);

  const loadResults = async () => {
    if (!Number(fromId)) { setMsg({ kind: 'err', text: '请先填写源运动员 ID' }); return; }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/results?athlete_id=${Number(fromId)}&pageSize=100`, { headers: authHeaders });
      const data = await readAdminResponse(res) as { items?: ResultRow[] };
      setResults(data?.items || []);
      setSelected(new Set());
      if (!data?.items?.length) setMsg({ kind: 'err', text: '该运动员暂无成绩' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '加载失败' });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doTransfer = async (resultIds: number[] | null) => {
    const from = Number(fromId);
    const to = Number(toId);
    if (!from || !to) { setMsg({ kind: 'err', text: '请填写源与目标运动员 ID' }); return; }
    if (from === to) { setMsg({ kind: 'err', text: '源与目标不能相同' }); return; }
    const label = resultIds ? `拆分迁移 ${resultIds.length} 条成绩` : '全量迁移该运动员所有成绩/积分/认领';
    if (!window.confirm(`确认${label}：从 ${from} → ${to}？`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/athletes/transfer-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ from_athlete_id: from, to_athlete_id: to, result_ids: resultIds, note: note || null }),
      });
      const data = await readAdminResponse(res) as { batch_id: string; moved: unknown };
      setMsg({ kind: 'ok', text: `成功（batch ${data.batch_id}）：${JSON.stringify(data.moved)}` });
      setSelected(new Set());
      await loadResults();
      await loadBatches();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '迁移失败' });
    } finally {
      setLoading(false);
    }
  };

  const doRollback = async (batchId: string) => {
    if (!window.confirm(`确认回滚批次 ${batchId}？将还原该批次所有 athlete_id 变更。`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/athletes/merge-rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await readAdminResponse(res) as { restored: number; recreatedAthletes: number };
      setMsg({ kind: 'ok', text: `已回滚：还原 ${data.restored} 行，重建档案 ${data.recreatedAthletes}` });
      await loadBatches();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '回滚失败' });
    } finally {
      setLoading(false);
    }
  };

  const box: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#fff' };
  const input: React.CSSProperties = { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, marginRight: 8 };
  const btn: React.CSSProperties = { padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', marginRight: 8 };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>成绩迁移 / 拆分 / 回滚</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
        跨档案迁移成绩与积分（不删档案），或仅迁移所选成绩实现拆分；每次操作生成可回滚的批次。误合并/误迁移可在下方按批次一键回滚。
      </p>

      {msg && (
        <div style={{ ...box, background: msg.kind === 'ok' ? '#ecfdf5' : '#fef2f2', color: msg.kind === 'ok' ? '#065f46' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      <div style={box}>
        <div style={{ marginBottom: 12 }}>
          <label>源运动员 ID（from）：</label>
          <input style={input} value={fromId} onChange={(e) => setFromId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="如 3608" />
          <label>目标运动员 ID（to）：</label>
          <input style={input} value={toId} onChange={(e) => setToId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="如 13" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>备注：</label>
          <input style={{ ...input, width: 360 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选，记入审计日志" />
        </div>
        <button style={{ ...btn, background: '#2563eb', color: '#fff' }} disabled={loading} onClick={loadResults}>加载源运动员成绩</button>
        <button style={{ ...btn, background: '#dc2626', color: '#fff' }} disabled={loading} onClick={() => doTransfer(null)}>全量迁移 from → to</button>
        <button style={{ ...btn, background: '#d97706', color: '#fff' }} disabled={loading || selected.size === 0} onClick={() => doTransfer(Array.from(selected))}>
          拆分迁移所选（{selected.size}）→ to
        </button>
      </div>

      {results.length > 0 && (
        <div style={box}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            源运动员成绩（{results.length}，勾选用于拆分迁移）
            <button style={{ ...btn, background: '#f3f4f6', marginLeft: 12 }} onClick={() => setSelected(new Set(results.map((r) => r.result_id)))}>全选</button>
            <button style={{ ...btn, background: '#f3f4f6' }} onClick={() => setSelected(new Set())}>清空</button>
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 6 }}>选</th>
                  <th style={{ padding: 6 }}>赛事</th>
                  <th style={{ padding: 6 }}>项目</th>
                  <th style={{ padding: 6 }}>组别</th>
                  <th style={{ padding: 6 }}>名次</th>
                  <th style={{ padding: 6 }}>成绩</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.result_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 6 }}><input type="checkbox" checked={selected.has(r.result_id)} onChange={() => toggle(r.result_id)} /></td>
                    <td style={{ padding: 6 }}>{r.event_name}</td>
                    <td style={{ padding: 6 }}>{r.discipline}{r.board_class ? ` / ${r.board_class}` : ''}</td>
                    <td style={{ padding: 6 }}>{r.gender_group}</td>
                    <td style={{ padding: 6 }}>{r.result_status_code || r.rank_position || '-'}</td>
                    <td style={{ padding: 6 }}>{r.finish_time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={box}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          操作批次（{fromId ? `与运动员 ${fromId} 相关` : '全部'}）
          <button style={{ ...btn, background: '#f3f4f6', marginLeft: 12 }} onClick={loadBatches}>刷新</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: 6 }}>批次</th>
              <th style={{ padding: 6 }}>类型</th>
              <th style={{ padding: 6 }}>时间</th>
              <th style={{ padding: 6 }}>行数</th>
              <th style={{ padding: 6 }}>from→to</th>
              <th style={{ padding: 6 }}>状态</th>
              <th style={{ padding: 6 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.batch_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 6, fontFamily: 'monospace', fontSize: 12 }}>{b.batch_id}</td>
                <td style={{ padding: 6 }}>{operationLabels[b.operation] || b.operation}</td>
                <td style={{ padding: 6 }}>{fmt(b.created_at)}</td>
                <td style={{ padding: 6 }}>{b.row_count}</td>
                <td style={{ padding: 6 }}>{b.from_ids} → {b.to_ids}</td>
                <td style={{ padding: 6 }}>{b.rolled_back ? <span style={{ color: '#9ca3af' }}>已回滚</span> : <span style={{ color: '#059669' }}>生效中</span>}</td>
                <td style={{ padding: 6 }}>
                  {!b.rolled_back && (
                    <button style={{ ...btn, background: '#dc2626', color: '#fff', marginRight: 0 }} disabled={loading} onClick={() => doRollback(b.batch_id)}>回滚</button>
                  )}
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 12, color: '#9ca3af' }}>暂无批次记录</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
