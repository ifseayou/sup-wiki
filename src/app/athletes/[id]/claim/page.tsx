'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  public_profile?: {
    birth_date?: string | null;
    birth_year?: number | string | null;
    hometown?: { province?: string | null; city?: string | null };
    living?: { province?: string | null; city?: string | null };
    submitted_contact?: string | null;
    contact?: string | null;
    intro?: string | null;
    intro_short?: string | null;
    started_sup_year?: number | string | null;
    sup_photos?: string[];
    photos?: string[];
    data_license_agreed?: boolean;
    living_province?: string | null;
    living_city?: string | null;
    hometown_province?: string | null;
    hometown_city?: string | null;
  };
}

export default function AthleteClaimPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, loading } = useUser();
  const athleteId = Number(params.id);
  const [athlete, setAthlete] = useState<AthleteOption | null>(null);
  const [results, setResults] = useState<ClaimOption[]>([]);
  const [claimMode, setClaimMode] = useState<'claim' | 'update'>('claim');
  const [form, setForm] = useState({
    submitted_name: '',
    submitted_avatar_url: '',
    submitted_birth_date: '',
    submitted_hometown_province: '',
    submitted_hometown_city: '',
    submitted_living_province: '',
    submitted_living_city: '',
    submitted_started_sup_year: '',
    submitted_intro: '',
    submitted_contact: '',
    submitted_sup_photo_urls: [] as string[],
    data_license_agreed: false,
    result_id: '',
    submitted_bib_number: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitErrorTarget, setSubmitErrorTarget] = useState<'profile' | 'verification' | 'submit'>('submit');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const verificationRef = useRef<HTMLDivElement | null>(null);
  const submitRef = useRef<HTMLDivElement | null>(null);
  const completeness = useMemo(() => {
    const checks = [
      form.submitted_avatar_url,
      form.submitted_name,
      form.submitted_birth_date,
      form.submitted_hometown_province && form.submitted_hometown_city,
      form.submitted_living_province && form.submitted_living_city,
      form.result_id,
      form.submitted_bib_number,
      form.data_license_agreed,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

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
        setClaimMode(data.claim_mode === 'update' || data.is_owner ? 'update' : 'claim');
        const profile = data.athlete?.public_profile || {};
        const birthDate = String(profile.birth_date || '').slice(0, 10);
        const hometown = profile.hometown || {};
        const living = profile.living || {};
        setForm((prev) => ({
          ...prev,
          submitted_name: data.athlete?.name || '',
          submitted_avatar_url: data.athlete?.photo || '',
          submitted_birth_date: birthDate,
          submitted_hometown_province: profile.hometown_province || hometown.province || '',
          submitted_hometown_city: profile.hometown_city || hometown.city || '',
          submitted_living_province: profile.living_province || living.province || '',
          submitted_living_city: profile.living_city || living.city || '',
          submitted_started_sup_year: profile.started_sup_year ? String(profile.started_sup_year) : '',
          submitted_intro: String(profile.intro || profile.intro_short || ''),
          submitted_contact: String(profile.contact || profile.submitted_contact || ''),
          submitted_sup_photo_urls: Array.isArray(profile.sup_photos) ? profile.sup_photos : Array.isArray(profile.photos) ? profile.photos : [],
          data_license_agreed: Boolean(profile.data_license_agreed),
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
    setSubmitError('');
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function showSubmitError(message: string, target: 'profile' | 'verification' | 'submit' = 'submit') {
    setSubmitError(message);
    setSubmitErrorTarget(target);
    const element = target === 'verification' ? verificationRef.current : submitRef.current;
    window.setTimeout(() => element?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }

  async function uploadClaimImage(file: File, onUploaded: (url: string) => void) {
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
      if (!res.ok) throw new Error(json.error || '图片上传失败');
      onUploaded(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError('');
    setSubmitError('');
    if (!form.submitted_avatar_url) {
      showSubmitError('请先上传本人清晰人脸头像', 'profile');
      return;
    }
    if (!form.submitted_hometown_province || !form.submitted_hometown_city) {
      showSubmitError('请选择籍贯', 'profile');
      return;
    }
    if (!form.submitted_living_province || !form.submitted_living_city) {
      showSubmitError('请选择现居省份和城市', 'profile');
      return;
    }
    if (!form.submitted_birth_date) {
      showSubmitError('请填写出生年月日', 'profile');
      return;
    }
    if (!form.result_id || !form.submitted_bib_number) {
      showSubmitError('请选择最近比赛，并补全该场号码牌', 'verification');
      return;
    }
    if (!form.data_license_agreed) {
      showSubmitError('请先阅读并同意运动员数据许可协议', 'verification');
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
          submitted_birth_year: form.submitted_birth_date.slice(0, 4),
          submitted_started_sup_year: form.submitted_started_sup_year ? Number(form.submitted_started_sup_year) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setMessage('资料已提交，管理员审核通过后会更新到运动员主页。');
      router.replace(`/athletes/${athleteId}?claim=submitted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      showSubmitError(message, /号码牌|最近比赛|成绩|校验/.test(message) ? 'verification' : 'submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-warm-gray-400">正在检查登录状态...</div>;
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:py-10">
      <nav className="mb-7 flex items-center gap-2 text-sm text-warm-gray-400">
        <Link href="/" className="text-warm-gray-400 no-underline hover:text-brown-600">首页</Link>
        <span>/</span>
        <Link href="/athletes" className="text-warm-gray-400 no-underline hover:text-brown-600">运动员</Link>
        <span>/</span>
        <Link href={`/athletes/${athleteId}`} className="text-warm-gray-400 no-underline hover:text-brown-600">{athlete?.name || '详情'}</Link>
        <span>/ 更新资料</span>
      </nav>

      <div className="mx-auto mb-8 flex max-w-3xl items-center justify-between gap-3 text-xs font-semibold text-warm-gray-300 sm:text-sm">
        {['选择比赛校验', '填写个人资料', '提交审核'].map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-3 last:flex-none">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${index === 0 ? 'bg-brown-600 text-white' : 'bg-warm-gray-300/60 text-white'}`}>
              {index + 1}
            </span>
            <span className={index === 0 ? 'text-brown-800' : ''}>{label}</span>
            {index < 2 && <span className="hidden h-px flex-1 border-t border-dashed border-cream-300 sm:block" />}
          </div>
        ))}
      </div>

      <section className="mb-6 rounded-xl border border-cream-300 bg-[radial-gradient(circle_at_top_right,#F5E7D4,transparent_34%),#FEFCF9] p-6 shadow-[0_18px_55px_rgba(68,51,35,0.07)] sm:p-8">
        <div className="text-xs uppercase tracking-[0.22em] text-brown-400">Athlete Claim</div>
        <h1 className="mt-3 font-[var(--font-display)] text-4xl font-medium leading-tight text-brown-800 sm:text-5xl">{claimMode === 'update' ? '更新资料' : '我是本人，认领该运动员'}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-warm-gray-500">
          {claimMode === 'update'
            ? '你可以更新头像、照片和个人资料。提交后管理员审核通过，运动员主页会同步更新。'
            : '请用最近比赛成绩完成身份校验，并提交本人头像、姓名、年龄和现居训练城市。号码牌只用于后台审核，不会在公开成绩页展示。'}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cream-300 bg-cream-50 px-4 py-2 text-xs font-medium text-brown-600">
          <span className="grid size-6 place-items-center rounded-full bg-[#F0E7D8]">盾</span>
          我们重视隐私，校验信息仅管理员可见。
        </div>
      </section>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <form onSubmit={submit} className="rounded-xl border border-cream-300 bg-white/90 shadow-[0_16px_46px_rgba(68,51,35,0.06)]">
          <div className="border-b border-cream-200 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-cream-100 text-brown-500">人</span>
              <div>
                <h2 className="font-semibold text-brown-800">A. 基本信息 <span className="text-xs font-normal text-red-500">* 为必填项</span></h2>
                <p className="mt-1 text-xs text-warm-gray-400">只填写你现在生活和训练的城市。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-7">
            <label className="block text-sm font-medium text-warm-gray-700">
              姓名 <span className="text-red-500">*</span>
              <input required value={form.submitted_name} onChange={(e) => update('submitted_name', e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
            </label>
            <label className="block text-sm font-medium text-warm-gray-700">
              出生年月日 <span className="text-red-500">*</span>
              <input required type="date" value={form.submitted_birth_date} onChange={(e) => update('submitted_birth_date', e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
            </label>
            <div className="sm:col-span-2">
              <div className="mb-2 text-sm font-medium text-warm-gray-700">籍贯 <span className="text-red-500">*</span></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <RegionSelect
                  idPrefix="athlete-claim-hometown"
                  province={form.submitted_hometown_province}
                  city={form.submitted_hometown_city}
                  provinceLabel="籍贯省份"
                  cityLabel="籍贯城市"
                  onChange={(value) => setForm((prev) => ({
                    ...prev,
                    submitted_hometown_province: value.province,
                    submitted_hometown_city: value.city,
                  }))}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-2 text-sm font-medium text-warm-gray-700">现居城市 <span className="text-red-500">*</span></div>
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
              <p className="mt-2 text-xs text-warm-gray-400">请选择你平时玩水、训练或生活的城市。</p>
            </div>
            <label className="block text-sm font-medium text-warm-gray-700">
              开始玩桨板年份
              <input type="number" min="1990" max={new Date().getFullYear()} value={form.submitted_started_sup_year} onChange={(e) => update('submitted_started_sup_year', e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
            </label>
            <label className="block text-sm font-medium text-warm-gray-700">
              联系方式
              <input value={form.submitted_contact} onChange={(e) => update('submitted_contact', e.target.value)} placeholder="微信号或手机号，仅管理员审核可见" className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
            </label>
            <label className="block text-sm font-medium text-warm-gray-700 sm:col-span-2">
              个人简介
              <textarea value={form.submitted_intro} onChange={(e) => update('submitted_intro', e.target.value)} rows={4} maxLength={1000} placeholder="介绍你的桨板经历、训练地点或代表队信息" className="mt-2 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 py-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
            </label>
          </div>

          <div className="border-y border-cream-200 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-cream-100 text-brown-500">图</span>
              <div>
                <h2 className="font-semibold text-brown-800">B. 头像上传 <span className="text-xs font-normal text-red-500">*</span></h2>
                <p className="mt-1 text-xs text-warm-gray-400">已有头像会自动加载；如需更新，请上传本人清晰人脸头像。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-[160px_1fr] sm:px-7">
            <div className="rounded-xl border border-cream-300 bg-cream-100 p-2 shadow-inner">
              {form.submitted_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.submitted_avatar_url} alt="头像预览" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#EFE4D6] text-sm text-warm-gray-400">头像预览</div>
              )}
            </div>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-6 text-center text-sm font-medium text-brown-600 transition hover:border-brown-400">
              <span className="mb-2 grid size-10 place-items-center rounded-full bg-white text-xl shadow-sm">+</span>
              <span>点击上传或拖拽本人头像到此处</span>
              <span className="mt-2 text-xs font-normal text-warm-gray-400">{uploading ? '上传中...' : '建议使用正面清晰照片，支持 JPG、PNG、WebP。'}</span>
              <input required={!form.submitted_avatar_url} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadClaimImage(file, (url) => update('submitted_avatar_url', url)); }} className="sr-only" />
            </label>
          </div>

          <div className="border-y border-cream-200 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-cream-100 text-brown-500">板</span>
              <div>
                <h2 className="font-semibold text-brown-800">C. 桨板照片</h2>
                <p className="mt-1 text-xs text-warm-gray-400">历史照片会自动加载；不满意的旧照片可以移除，审核后按本页照片列表更新主页。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-3 sm:px-7">
            {form.submitted_sup_photo_urls.map((url, index) => (
              <div key={url} className="relative overflow-hidden rounded-xl border border-cream-300 bg-cream-100 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`桨板照片 ${index + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, submitted_sup_photo_urls: prev.submitted_sup_photo_urls.filter((item) => item !== url) }))} className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-brown-700 shadow">移除</button>
              </div>
            ))}
            {form.submitted_sup_photo_urls.length < 9 && (
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-6 text-center text-sm font-medium text-brown-600 transition hover:border-brown-400">
                <span className="mb-2 grid size-10 place-items-center rounded-full bg-white text-xl shadow-sm">+</span>
                <span>上传桨板照片</span>
                <span className="mt-2 text-xs font-normal text-warm-gray-400">{uploading ? '上传中...' : 'JPG、PNG、WebP，最多 9 张。'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadClaimImage(file, (url) => setForm((prev) => ({ ...prev, submitted_sup_photo_urls: Array.from(new Set([...prev.submitted_sup_photo_urls, url])).slice(0, 9) })));
                }} className="sr-only" />
              </label>
            )}
          </div>

          <div ref={verificationRef} className="border-y border-cream-200 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-cream-100 text-brown-500">盾</span>
              <div>
                <h2 className="font-semibold text-brown-800">D. 赛事校验</h2>
                <p className="mt-1 text-xs text-warm-gray-400">从最近成绩中选一场，补全该场号码牌。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:px-7">
            {submitError && submitErrorTarget === 'verification' && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            )}
            <label className="block text-sm font-medium text-warm-gray-700">
              最近比赛校验 <span className="text-red-500">*</span>
              <select required value={form.result_id} onChange={(e) => {
                const next = results.find((item) => String(item.result_id) === e.target.value);
                setForm((prev) => ({ ...prev, result_id: e.target.value, submitted_bib_number: next?.bib_prefix || '' }));
              }} className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15">
                {results.map((item) => (
                  <option key={item.result_id} value={item.result_id}>
                    {item.event_name} / {item.discipline || '项目'} / {item.finish_time || '成绩'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-warm-gray-700">
              补全该场号码牌 <span className="text-red-500">*</span>
              <input required value={form.submitted_bib_number} onChange={(e) => update('submitted_bib_number', e.target.value.toUpperCase())} placeholder={selectedResult?.bib_prefix ? `已填前两位：${selectedResult.bib_prefix}` : '请输入号码牌'} className="mt-2 h-11 w-full rounded-lg border border-cream-300 bg-cream-50 px-3 text-brown-800 outline-none transition focus:border-brown-500 focus:ring-2 focus:ring-brown-500/15" />
              <span className="mt-2 block text-xs text-warm-gray-400">请输入你在该场比赛中的号码牌。</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-warm-gray-700">
              <input type="checkbox" checked={form.data_license_agreed} onChange={(e) => setForm((prev) => ({ ...prev, data_license_agreed: e.target.checked }))} className="mt-1" />
              <span>我确认以上信息为本人提交，并同意平台将审核通过的运动员资料用于 SUP Wiki 运动员主页展示。</span>
            </label>
          </div>

          <div ref={submitRef} className="border-t border-cream-200 bg-cream-50/70 px-5 py-4">
            {submitError && submitErrorTarget !== 'verification' && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href={`/athletes/${athleteId}`} className="inline-flex h-11 items-center justify-center rounded-lg border border-cream-300 bg-white px-8 text-sm font-medium text-warm-gray-600 no-underline">返回</Link>
            <button disabled={submitting || results.length === 0} className="inline-flex h-11 items-center justify-center rounded-lg bg-brown-700 px-8 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(94,74,51,0.22)] transition hover:bg-brown-800 disabled:opacity-50">
              {submitting ? '提交中...' : claimMode === 'update' ? '提交更新审核' : '提交审核'}
            </button>
            </div>
          </div>
        </form>

        <aside className="space-y-5">
          <div className="rounded-xl border border-cream-300 bg-cream-50 p-5 shadow-[0_14px_40px_rgba(68,51,35,0.05)]">
            <div className="text-xs font-semibold text-warm-gray-400">当前认领对象</div>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border border-cream-300 bg-white text-brown-500">人</span>
              <div className="text-xl font-semibold text-brown-800">{athlete?.name || '运动员'}</div>
            </div>
          </div>
          <div className="rounded-xl border border-cream-300 bg-cream-50 p-5">
            <h3 className="text-sm font-semibold text-brown-800">字段说明</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="font-medium text-green-700">公开展示字段</div>
                <p className="mt-1 text-xs leading-5 text-warm-gray-400">头像、姓名、现居训练城市和桨板照片会在审核后进入运动员主页。</p>
              </div>
              <div>
                <div className="font-medium text-brown-600">不公开校验字段</div>
                <p className="mt-1 text-xs leading-5 text-warm-gray-400">号码牌仅用于确认身份，管理员审核可见。</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-cream-300 bg-cream-50 p-5">
            <h3 className="text-sm font-semibold text-brown-800">审核流程</h3>
            <div className="mt-5 flex items-center justify-between text-center text-xs text-brown-700">
              <span>提交</span>
              <span className="h-px flex-1 bg-cream-300 mx-3" />
              <span>审核中</span>
              <span className="h-px flex-1 bg-cream-300 mx-3" />
              <span>发布</span>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-warm-gray-400">
                <span>资料完整度</span>
                <span className="font-semibold text-brown-600">{completeness}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-brown-500 transition-all" style={{ width: `${completeness}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-cream-300 bg-[linear-gradient(135deg,#FEFCF9,#F5EDE4)] p-5 text-xs leading-6 text-warm-gray-500">
            <div className="mb-2 font-semibold text-brown-800">小贴士</div>
            信息越准确，管理员越容易通过审核。头像建议使用近期正面照。
          </div>
        </aside>
      </div>
    </main>
  );
}
