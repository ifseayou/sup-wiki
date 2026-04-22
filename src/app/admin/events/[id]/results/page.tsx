'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '../../../layout';
import {
  EVENT_RESULT_STATUS_OPTIONS,
  getEventResultStatusLabel,
  getEventStarBadgeStyle,
} from '@/lib/event-stars';
import { formatResultsForTextarea, normalizeEventResultsInput } from '@/lib/event-results';

interface AdminEvent {
  event_id: number;
  name: string;
  city?: string | null;
  province?: string | null;
  start_date?: string | null;
  event_status: string;
  star_level?: string | null;
  score_coefficient?: string | null;
  result_status?: string | null;
}

interface AdminEventResultRow {
  result_id: number;
  athlete_id?: number | null;
  athlete_name?: string | null;
  athlete_name_snapshot: string;
  gender_group: string;
  discipline: string;
  round_label?: string | null;
  rank_position: number;
  result_label?: string | null;
  finish_time: string;
  team_name?: string | null;
}

const emptyTemplate = [
  {
    athlete_name: '示例运动员',
    gender_group: '男子公开组',
    discipline: '6km',
    round_label: '决赛',
    rank_position: 1,
    result_label: '冠军',
    finish_time: '38:12.54',
    source_type: 'official',
  },
];

function formatDate(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('zh-CN');
}

export default function EventResultsAdminPage() {
  const params = useParams<{ id: string }>();
  const { token } = useAdminAuth();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [results, setResults] = useState<AdminEventResultRow[]>([]);
  const [jsonText, setJsonText] = useState(JSON.stringify(emptyTemplate, null, 2));
  const [resultStatus, setResultStatus] = useState('none');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [eventRes, resultsRes] = await Promise.all([
        fetch(`/api/admin/events/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/events/${params.id}/results`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const eventData = await eventRes.json();
      const resultsData = await resultsRes.json();

      if (!eventRes.ok) throw new Error(eventData.error || '赛事加载失败');
      if (!resultsRes.ok) throw new Error(resultsData.error || '成绩加载失败');

      setEvent(eventData);
      setResults(resultsData.items || []);
      setJsonText(resultsData.items?.length ? formatResultsForTextarea(resultsData.items) : JSON.stringify(emptyTemplate, null, 2));
      setResultStatus(eventData.result_status || 'none');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id, token]);

  const previewItems = useMemo(() => normalizeEventResultsInput(results), [results]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const parsed = normalizeEventResultsInput(JSON.parse(jsonText));
      const response = await fetch(`/api/admin/events/${params.id}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          results: parsed,
          result_status: resultStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');

      await load();
      setMessage(`已保存 ${parsed.length} 条成绩`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-warm-gray-400">加载中...</div>;
  }

  if (!event) {
    return <div className="p-8 text-red-500">{error || '赛事不存在'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link href="/admin/events" className="text-sm text-warm-gray-400 hover:text-brown-600">
              ← 返回赛事管理
            </Link>
            {event.star_level && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getEventStarBadgeStyle(event.star_level)}`}>
                {event.star_level}
                {event.score_coefficient ? ` / ${event.score_coefficient}` : ''}
              </span>
            )}
            <span className="inline-flex rounded-full bg-cream-200 px-2 py-0.5 text-xs text-brown-600">
              {getEventResultStatusLabel(resultStatus)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-brown-800">{event.name}</h1>
          <p className="mt-1 text-sm text-warm-gray-500">
            {[event.province, event.city].filter(Boolean).join(' / ') || '未设置地点'} · {formatDate(event.start_date)} · {event.event_status}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-brown-500 px-4 py-2 text-sm text-white hover:bg-brown-600 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存成绩'}
        </button>
      </div>

      <div className="rounded-xl border border-cream-200 bg-cream-50 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium text-brown-700">成绩采集工作台</h2>
            <p className="mt-1 text-sm text-warm-gray-500">录入 3 星级及以上赛事前 10 名与耗时。系统会自动为未建档运动员创建草稿档案并关联。</p>
          </div>
          <select
            className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-sm text-warm-gray-700"
            value={resultStatus}
            onChange={(e) => setResultStatus(e.target.value)}
          >
            {EVENT_RESULT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <textarea
          className="min-h-[360px] w-full rounded-xl border border-cream-300 bg-[#fffdfa] px-4 py-3 font-mono text-xs leading-6 text-brown-800 focus:border-brown-500 focus:outline-none"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
        />

        <div className="mt-3 text-xs text-warm-gray-400">
          建议字段：`athlete_name`、`gender_group`、`discipline`、`round_label`、`rank_position`、`result_label`、`finish_time`、`source_type`。
        </div>
      </div>

      {message && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="rounded-xl border border-cream-200 bg-cream-50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-brown-700">当前成绩预览</h2>
          <span className="text-sm text-warm-gray-400">{previewItems.length} 条</span>
        </div>
        {results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-cream-300 bg-white px-4 py-6 text-sm text-warm-gray-400">
            当前赛事还没有成绩记录。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-warm-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">名次</th>
                  <th className="px-4 py-3 text-left">运动员</th>
                  <th className="px-4 py-3 text-left">组别</th>
                  <th className="px-4 py-3 text-left">项目</th>
                  <th className="px-4 py-3 text-left">轮次</th>
                  <th className="px-4 py-3 text-left">耗时</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={`${row.result_id}-${row.rank_position}`} className="border-t border-cream-200">
                    <td className="px-4 py-3 text-brown-700">{row.rank_position}</td>
                    <td className="px-4 py-3 text-brown-800">{row.athlete_name || row.athlete_name_snapshot}</td>
                    <td className="px-4 py-3 text-warm-gray-600">{row.gender_group}</td>
                    <td className="px-4 py-3 text-warm-gray-600">{row.discipline}</td>
                    <td className="px-4 py-3 text-warm-gray-600">{row.round_label || '—'}</td>
                    <td className="px-4 py-3 font-medium text-brown-700">{row.finish_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
