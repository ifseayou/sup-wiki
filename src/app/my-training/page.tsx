'use client';

import { useEffect, useMemo, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserContext';
import { EMPTY_TRAINING_DRAFT, mergeTrainingDrafts, secondsToDisplay, type TrainingLapDraft, type TrainingSessionDraft } from '@/lib/training-parser';

interface TrainingSummary {
  sessions: number;
  total_distance_km: number;
  total_duration_seconds: number;
  avg_pace_sec_per_km: number | null;
  avg_heart_rate: number | null;
  total_strokes: number;
}

interface TrainingSession extends TrainingSessionDraft {
  session_id: number;
  created_at: string;
  updated_at: string;
}

interface UploadedImage {
  image_id: number;
  image_url: string;
}

const NUMBER_FIELDS: Array<{ key: keyof TrainingSessionDraft; label: string; suffix?: string }> = [
  { key: 'distance_km', label: '距离', suffix: 'km' },
  { key: 'duration_seconds', label: '总时长', suffix: '秒' },
  { key: 'moving_time_seconds', label: '移动时间', suffix: '秒' },
  { key: 'elapsed_time_seconds', label: '全程用时', suffix: '秒' },
  { key: 'avg_pace_sec_per_km', label: '平均配速', suffix: '秒/km' },
  { key: 'avg_moving_pace_sec_per_km', label: '平均移动配速', suffix: '秒/km' },
  { key: 'best_pace_sec_per_km', label: '最佳配速', suffix: '秒/km' },
  { key: 'avg_speed_kmh', label: '平均速度', suffix: 'km/h' },
  { key: 'max_speed_kmh', label: '最大速度', suffix: 'km/h' },
  { key: 'avg_heart_rate', label: '平均心率', suffix: 'bpm' },
  { key: 'max_heart_rate', label: '最大心率', suffix: 'bpm' },
  { key: 'stroke_count', label: '总划水次数' },
  { key: 'avg_stroke_rate', label: '平均划水速率', suffix: '步/分' },
  { key: 'max_stroke_rate', label: '最高划水率', suffix: '步/分' },
  { key: 'avg_stroke_distance_m', label: '平均单次划水距离', suffix: '米' },
  { key: 'training_effect_aerobic', label: '有氧效果' },
  { key: 'training_effect_anaerobic', label: '无氧效果' },
  { key: 'training_load', label: '运动负荷' },
  { key: 'intensity_minutes_moderate', label: '适中强度', suffix: '分钟' },
  { key: 'intensity_minutes_vigorous', label: '高强度', suffix: '分钟' },
  { key: 'body_battery_impact', label: 'Body Battery 影响' },
];

function setDraftValue<K extends keyof TrainingSessionDraft>(
  draft: TrainingSessionDraft,
  key: K,
  value: TrainingSessionDraft[K]
): TrainingSessionDraft {
  return { ...draft, [key]: value };
}

function numInputValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function toNumberOrNull(value: string) {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function statValue(value: number | string | null | undefined, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export default function MyTrainingPage() {
  const { user, token, loading } = useUser();
  const router = useRouter();
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [draft, setDraft] = useState<TrainingSessionDraft>(EMPTY_TRAINING_DRAFT);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [ocrText, setOcrText] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login?redirect=/my-training');
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/training/sessions', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setSessions(data.items || []);
        setSummary(data.summary || null);
      })
      .catch(() => setError('训练记录加载失败'))
      .finally(() => setFetching(false));
  }, [token]);

  const heroStats = useMemo(() => {
    const distance = Number(summary?.total_distance_km || 0).toFixed(1);
    return [
      { label: '训练次数', value: statValue(summary?.sessions || 0), unit: '次' },
      { label: '总距离', value: distance, unit: 'km' },
      { label: '总时长', value: secondsToDisplay(Number(summary?.total_duration_seconds || 0)), unit: '' },
      { label: '均配', value: secondsToDisplay(summary?.avg_pace_sec_per_km || null), unit: '/km' },
    ];
  }, [summary]);

  async function uploadFiles(files: FileList | null) {
    if (!files || !token) return;
    setUploading(true);
    setError('');
    setMessage('');

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/training/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '截图识别失败');
        continue;
      }
      startTransition(() => {
        setUploadedImages(prev => [...prev, data.image]);
        setDraft(prev => mergeTrainingDrafts(prev, data.draft));
        setOcrText(prev => [prev, data.ocr?.text].filter(Boolean).join('\n\n---\n\n'));
      });
      if (data.ocr?.warning) setMessage(data.ocr.warning);
    }

    setUploading(false);
  }

  async function saveSession() {
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    const payload = {
      ...draft,
      image_ids: uploadedImages.map(img => img.image_id),
      raw_ocr_json: { text: ocrText },
      status: 'confirmed',
    };
    const res = await fetch('/api/user/training/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || '保存失败');
      return;
    }
    setMessage('训练记录已保存');
    setDraft(EMPTY_TRAINING_DRAFT);
    setUploadedImages([]);
    setOcrText('');
    const listRes = await fetch('/api/user/training/sessions', { headers: { Authorization: `Bearer ${token}` } });
    const listData = await listRes.json();
    setSessions(listData.items || []);
    setSummary(listData.summary || null);
  }

  function updateLap(index: number, key: keyof TrainingLapDraft, value: string) {
    setDraft(prev => ({
      ...prev,
      laps: prev.laps.map((lap, i) => i === index ? { ...lap, [key]: toNumberOrNull(value) } : lap),
    }));
  }

  function addLap() {
    setDraft(prev => ({
      ...prev,
      laps: [...prev.laps, { lap_no: prev.laps.length + 1, time_seconds: null, distance_km: 1, avg_pace_sec_per_km: null }],
    }));
  }

  if (loading || (!user && !loading)) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#8A8078' }}>加载中...</div>;
  }

  return (
    <main className="training-page">
      <style jsx>{`
        .training-page {
          --ink: #241912;
          --muted: #8b7a68;
          --line: #eadbc8;
          --sand: #f8efe2;
          --paper: #fffaf2;
          --burnt: #b66a2b;
          --deep: #173b3a;
          max-width: 1180px;
          margin: 0 auto;
          padding: 36px 24px 64px;
          color: var(--ink);
        }
        .hero {
          position: relative;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 34px;
          background:
            radial-gradient(circle at 18% 20%, rgba(218, 163, 84, .35), transparent 26%),
            linear-gradient(135deg, #fffaf2 0%, #f3dfc1 54%, #d89b5d 100%);
          box-shadow: 0 24px 80px rgba(79, 45, 15, .12);
        }
        .hero::after {
          content: '';
          position: absolute;
          right: -80px;
          top: -80px;
          width: 280px;
          height: 280px;
          border: 1px solid rgba(36, 25, 18, .16);
          border-radius: 50%;
        }
        .eyebrow {
          font-size: 12px;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: #7d4b21;
          margin-bottom: 10px;
        }
        h1 {
          font-family: var(--font-display);
          font-size: clamp(38px, 6vw, 76px);
          line-height: .92;
          font-weight: 300;
          margin: 0;
          letter-spacing: -.04em;
        }
        .hero p {
          max-width: 560px;
          color: #614938;
          line-height: 1.8;
          margin: 18px 0 0;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 28px;
        }
        .stat {
          border: 1px solid rgba(255,255,255,.55);
          border-radius: 18px;
          background: rgba(255,255,255,.42);
          backdrop-filter: blur(10px);
          padding: 16px;
        }
        .stat strong {
          display: block;
          font-size: 28px;
          line-height: 1;
          margin-bottom: 8px;
        }
        .stat span { color: var(--muted); font-size: 12px; letter-spacing: .08em; }
        .workspace {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 18px;
          margin-top: 22px;
        }
        .panel {
          border: 1px solid var(--line);
          border-radius: 24px;
          background: rgba(255,250,242,.82);
          padding: 22px;
        }
        .upload-zone {
          border: 1px dashed #cda276;
          border-radius: 22px;
          padding: 24px;
          background: linear-gradient(135deg, rgba(23,59,58,.06), rgba(182,106,43,.08));
          text-align: center;
        }
        .upload-zone input { display: none; }
        .upload-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 12px;
          border: none;
          border-radius: 999px;
          background: var(--deep);
          color: white;
          padding: 12px 22px;
          cursor: pointer;
          font-size: 14px;
        }
        .field-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }
        label { font-size: 12px; color: var(--muted); }
        input, textarea {
          width: 100%;
          margin-top: 6px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fffdf8;
          padding: 10px 11px;
          color: var(--ink);
          outline: none;
        }
        input:focus, textarea:focus { border-color: var(--burnt); box-shadow: 0 0 0 3px rgba(182,106,43,.12); }
        .section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 24px;
          margin-bottom: 12px;
          font-family: var(--font-display);
          font-size: 24px;
        }
        .lap-table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 16px;
        }
        .lap-table th, .lap-table td {
          border-bottom: 1px solid var(--line);
          padding: 8px;
          text-align: left;
          font-size: 13px;
        }
        .lap-table input { margin: 0; padding: 8px; }
        .primary {
          border: none;
          border-radius: 14px;
          background: var(--burnt);
          color: #fff;
          padding: 12px 18px;
          cursor: pointer;
        }
        .ghost {
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #fffaf2;
          color: var(--ink);
          padding: 8px 14px;
          cursor: pointer;
        }
        .session {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          background: #fffdf8;
          margin-bottom: 10px;
        }
        .session h3 {
          font-size: 16px;
          margin: 0 0 8px;
        }
        .session-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          color: var(--muted);
          font-size: 13px;
        }
        .notice {
          margin-top: 12px;
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 13px;
        }
        .error { background: #fff1ee; color: #9b2b1d; }
        .ok { background: #eef8f0; color: #23623a; }
        .images {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .images img {
          width: 70px;
          height: 70px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid var(--line);
        }
        @media (max-width: 900px) {
          .workspace { grid-template-columns: 1fr; }
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
          .field-grid { grid-template-columns: 1fr; }
          .hero { padding: 24px; }
        }
      `}</style>

      <section className="hero">
        <div className="eyebrow">Paddle Training Log</div>
        <h1>我的桨板训练数据舱</h1>
        <p>上传 Garmin 训练截图，系统会提取配速、距离、心率、划水次数、计圈明细等关键数据；你确认后保存，后续即可做个人训练趋势分析。</p>
        <div className="stat-grid">
          {heroStats.map(item => (
            <div className="stat" key={item.label}>
              <strong>{item.value}<small style={{ fontSize: 13, marginLeft: 4 }}>{item.unit}</small></strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="upload-zone">
            <div style={{ fontSize: 34, marginBottom: 8 }}>⌁</div>
            <strong>上传 Garmin 训练截图</strong>
            <p style={{ color: '#8b7a68', margin: '8px 0 0', lineHeight: 1.7 }}>支持多张截图：计圈、统计、划水数据可分开上传，系统会合并到同一个草稿。</p>
            <label className="upload-btn">
              {uploading ? '识别中...' : '选择截图'}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e => uploadFiles(e.target.files)} disabled={uploading} />
            </label>
          </div>

          {error && <div className="notice error">{error}</div>}
          {message && <div className="notice ok">{message}</div>}
          {uploadedImages.length > 0 && (
            <div className="images">
              {uploadedImages.map(img => <img src={img.image_url} alt="训练截图" key={img.image_id} />)}
            </div>
          )}

          <div className="section-title">校对训练草稿</div>
          <div className="field-grid">
            <label>
              标题
              <input value={draft.title} onChange={e => setDraft(prev => setDraftValue(prev, 'title', e.target.value))} />
            </label>
            <label>
              训练时间
              <input type="datetime-local" value={draft.started_at || ''} onChange={e => setDraft(prev => setDraftValue(prev, 'started_at', e.target.value || null))} />
            </label>
            {NUMBER_FIELDS.map(field => (
              <label key={field.key}>
                {field.label}{field.suffix ? ` · ${field.suffix}` : ''}
                <input
                  inputMode="decimal"
                  value={numInputValue(draft[field.key])}
                  onChange={e => setDraft(prev => setDraftValue(prev, field.key, toNumberOrNull(e.target.value) as never))}
                />
              </label>
            ))}
          </div>

          <div className="section-title">
            计圈明细
            <button className="ghost" onClick={addLap}>+ 添加圈</button>
          </div>
          <table className="lap-table">
            <thead>
              <tr><th>圈</th><th>时间(秒)</th><th>距离(km)</th><th>均配(秒/km)</th></tr>
            </thead>
            <tbody>
              {draft.laps.length === 0 ? (
                <tr><td colSpan={4} style={{ color: '#8b7a68', padding: 18 }}>暂无计圈数据，可上传计圈截图或手动添加。</td></tr>
              ) : draft.laps.map((lap, index) => (
                <tr key={index}>
                  <td><input value={numInputValue(lap.lap_no)} onChange={e => updateLap(index, 'lap_no', e.target.value)} /></td>
                  <td><input value={numInputValue(lap.time_seconds)} onChange={e => updateLap(index, 'time_seconds', e.target.value)} /></td>
                  <td><input value={numInputValue(lap.distance_km)} onChange={e => updateLap(index, 'distance_km', e.target.value)} /></td>
                  <td><input value={numInputValue(lap.avg_pace_sec_per_km)} onChange={e => updateLap(index, 'avg_pace_sec_per_km', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="primary" onClick={saveSession} disabled={saving}>{saving ? '保存中...' : '确认保存训练记录'}</button>
          </div>
        </div>

        <aside className="panel">
          <div className="section-title" style={{ marginTop: 0 }}>训练记录</div>
          {fetching ? (
            <div style={{ color: '#8b7a68' }}>加载中...</div>
          ) : sessions.length === 0 ? (
            <div style={{ color: '#8b7a68', lineHeight: 1.8 }}>还没有训练记录。上传第一组截图后，这里会形成你的个人桨板训练档案。</div>
          ) : sessions.map(item => (
            <article className="session" key={item.session_id}>
              <h3>{item.title}</h3>
              <div style={{ color: '#8b7a68', fontSize: 12, marginBottom: 10 }}>
                {item.started_at ? String(item.started_at).slice(0, 16).replace('T', ' ') : String(item.created_at).slice(0, 10)}
              </div>
              <div className="session-metrics">
                <span>距离 {statValue(item.distance_km)} km</span>
                <span>时长 {secondsToDisplay(item.duration_seconds)}</span>
                <span>均配 {secondsToDisplay(item.avg_pace_sec_per_km)}/km</span>
                <span>心率 {statValue(item.avg_heart_rate)} bpm</span>
                <span>划水 {statValue(item.stroke_count)} 次</span>
                <span>负荷 {statValue(item.training_load)}</span>
              </div>
            </article>
          ))}
        </aside>
      </section>
    </main>
  );
}
