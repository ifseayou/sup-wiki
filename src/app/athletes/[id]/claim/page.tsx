'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/components/UserContext';
import RegionSelect from '@/components/admin/RegionSelect';

interface ClaimOption {
  result_id: number;
  event_name: string;
  start_date: string | null;
  province: string | null;
  city: string | null;
  discipline: string | null;
  gender_group: string | null;
  rank_position: number | null;
  finish_time: string | null;
  bib_prefix: string;
}

interface AthleteOption {
  athlete_id: number;
  name: string;
  photo: string | null;
  province: string | null;
  city: string | null;
  bio: string | null;
}

export default function AthleteClaimPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, loading } = useUser();
  const athleteId = Number(params.id);
  const [athlete, setAthlete] = useState<AthleteOption | null>(null);
  const [results, setResults] = useState<ClaimOption[]>([]);
  const [form, setForm] = useState({
    submitted_name: '',
    submitted_avatar_url: '',
    submitted_age: '',
    submitted_living_province: '',
    submitted_living_city: '',
    result_id: '',
    submitted_bib_number: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!token) router.replace(`/login?redirect=${encodeURIComponent(`/athletes/${athleteId}/claim`)}`);
  }, [athleteId, loading, router, token]);

  useEffect(() => {
    if (!token || !athleteId) return;
    fetch(`/api/user/athlete-claims/options?athlete_id=${athleteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '加载失败');
        setAthlete(data.athlete);
        setResults(data.recent_results || []);
        setForm((prev) => ({
          ...prev,
          submitted_name: data.athlete?.name || '',
          result_id: data.recent_results?.[0]?.result_id ? String(data.recent_results[0].result_id) : '',
          submitted_bib_number: data.recent_results?.[0]?.bib_prefix || '',
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [athleteId, token]);

  const selectedResult = useMemo(
    () => results.find((item) => String(item.result_id) === form.result_id) || null,
    [form.result_id, results]
  );

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadAvatar(file: File) {
    if (!token) return;
    setUploading(true);
    setError('');
    const data = new FormData();
    data.set('file', file);
    try {
      const res = await fetch('/api/user/athlete-claims/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '头像上传失败');
      update('submitted_avatar_url', json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    if (!form.submitted_avatar_url) {
      setError('请先上传本人清晰人脸头像');
      return;
    }
    if (!form.submitted_living_province || !form.submitted_living_city) {
      setError('请选择现居省份和城市');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/user/athlete-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          athlete_id: athleteId,
          submitted_birth_year: form.submitted_age ? String(new Date().getFullYear() - Number(form.submitted_age)) : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setMessage('资料已提交，管理员审核通过后会更新到运动员主页。');
      router.replace(`/athletes/${athleteId}?claim=submitted`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-stone-500">正在检查登录状态...</div>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/athletes" className="text-stone-500 no-underline">运动员</Link>
        <span> / </span>
        <Link href={`/athletes/${athleteId}`} className="text-stone-500 no-underline">{athlete?.name || '详情'}</Link>
        <span> / 更新资料</span>
      </nav>

      <section className="mb-6 rounded-lg border border-[#E3D8C9] bg-[#FEFCF9] p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-[#B39A78]">Athlete Claim</div>
        <h1 className="mt-2 text-2xl font-semibold text-[#2E2118]">这是我，更新资料</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          请选择最近三场比赛中的一场，并补全号码牌。号码牌只用于后台校验，不会在公开成绩页展示。
        </p>
      </section>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <form onSubmit={submit} className="space-y-5 rounded-lg border border-[#E3D8C9] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-stone-700">
            姓名 <span className="text-red-500">*</span>
            <input required value={form.submitted_name} onChange={(e) => update('submitted_name', e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            年龄 <span className="text-red-500">*</span>
            <input required inputMode="numeric" value={form.submitted_age} onChange={(e) => update('submitted_age', e.target.value.replace(/[^\d]/g, '').slice(0, 2))} placeholder="例如 28" className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
          </label>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-stone-700">现居城市 <span className="text-red-500">*</span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RegionSelect
              idPrefix="athlete-claim-living"
              province={form.submitted_living_province}
              city={form.submitted_living_city}
              provinceLabel="现居省份"
              cityLabel="现居城市"
              onChange={(value) => setForm((prev) => ({
                ...prev,
                submitted_living_province: value.province,
                submitted_living_city: value.city,
              }))}
            />
          </div>
          <p className="mt-1 text-xs text-stone-400">请选择你平时玩水、训练或生活的城市。</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="rounded-lg border border-[#E3D8C9] bg-[#FAF6EF] p-3">
            {form.submitted_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.submitted_avatar_url} alt="头像预览" className="aspect-square w-full rounded-md object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-[#EFE4D6] text-sm text-stone-400">头像预览</div>
            )}
          </div>
          <label className="block text-sm font-medium text-stone-700">
            上传本人头像 <span className="text-red-500">*</span>
            <input required={!form.submitted_avatar_url} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAvatar(file); }} className="mt-1 block w-full rounded-md border border-[#D8CDBE] px-3 py-2 text-sm" />
            <span className="mt-2 block text-xs text-stone-400">{uploading ? '上传中...' : '请上传本人清晰人脸头像。支持 JPG、PNG、WebP，审核通过后作为公开头像。'}</span>
          </label>
        </div>

        <label className="block text-sm font-medium text-stone-700">
          最近比赛校验
          <select required value={form.result_id} onChange={(e) => {
            const next = results.find((item) => String(item.result_id) === e.target.value);
            setForm((prev) => ({ ...prev, result_id: e.target.value, submitted_bib_number: next?.bib_prefix || '' }));
          }} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]">
            {results.map((item) => (
              <option key={item.result_id} value={item.result_id}>
                {item.event_name} / {item.discipline || '项目'} / {item.finish_time || '成绩'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          补全该场号码牌 <span className="text-red-500">*</span>
          <input required value={form.submitted_bib_number} onChange={(e) => update('submitted_bib_number', e.target.value.toUpperCase())} placeholder={selectedResult?.bib_prefix ? `已填前两位：${selectedResult.bib_prefix}` : '请输入号码牌'} className="mt-1 h-11 w-full rounded-md border border-[#D8CDBE] px-3 outline-none focus:border-[#8B7355]" />
        </label>

        <div className="flex justify-end gap-3">
          <Link href={`/athletes/${athleteId}`} className="inline-flex h-11 items-center rounded-md border border-[#D8CDBE] px-4 text-sm font-medium text-stone-600 no-underline">返回</Link>
          <button disabled={submitting || results.length === 0} className="h-11 rounded-md bg-[#6B3E1E] px-5 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? '提交中...' : '提交审核'}
          </button>
        </div>
      </form>
    </main>
  );
}
