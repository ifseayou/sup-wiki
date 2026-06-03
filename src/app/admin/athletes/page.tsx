'use client';

/* eslint-disable @next/next/no-img-element */
import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import OfficialEliteBadge from '@/components/OfficialEliteBadge';
import RegionSelect from '@/components/admin/RegionSelect';
import { genderLabel } from '@/lib/athlete-gender';
import { normalizeNationality } from '@/lib/nationality';
import { useAdminAuth } from '../layout';

function AthleteForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const photos = Array.isArray(data.photos) ? (data.photos as string[]) : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <ImageUpload value={String(data.photo || '')} onChange={url => set('photo', url)} folder="athletes" token={token} label="主头像（列表展示用）" />
        <div>
          <MultiImageUpload values={photos} onChange={urls => set('photos', urls)} folder="athletes" token={token} label="更多照片（详情页展示）" max={8} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">姓名 *</label>
          <input className={inp} value={String(data.name || '')} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">英文名</label>
          <input className={inp} value={String(data.name_en || '')} onChange={e => set('name_en', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">国籍</label>
          <input className={inp} value={String(data.nationality || '')} onChange={e => set('nationality', e.target.value)} placeholder="中国" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">性别</label>
          <select className={inp} value={String(data.gender || 'unknown')} onChange={e => onChange({ ...data, gender: e.target.value, gender_source: 'manual', gender_confidence: null })}>
            <option value="unknown">未知</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="mixed">混合/团体</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">运动项目</label>
          <select className={inp} value={String(data.discipline || 'race')} onChange={e => set('discipline', e.target.value)}>
            <option value="race">竞速</option>
            <option value="surf">冲浪</option>
            <option value="distance">长距离</option>
            <option value="technical">技巧</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <RegionSelect
          idPrefix="athlete-origin"
          province={String(data.province || '')}
          city={String(data.city || '')}
          provinceLabel="籍贯省份"
          cityLabel="籍贯城市"
          onChange={(value) => onChange({ ...data, province: value.province, city: value.city })}
        />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">ICF 排名</label>
        <input className={inp} type="number" value={String(data.icf_ranking || '')} onChange={e => set('icf_ranking', e.target.value ? Number(e.target.value) : null)} style={{ maxWidth: 160 }} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">简介</label>
        <textarea className={inp} rows={3} value={String(data.bio || '')} onChange={e => set('bio', e.target.value)} />
      </div>
    </div>
  );
}

function formatLocation(province: unknown, city: unknown) {
  return [province, city].filter(Boolean).join(' / ') || '—';
}

function formatAnnualRank(row: Record<string, unknown>) {
  const rank = Number(row.latest_annual_rank || 0);
  if (!Number.isFinite(rank) || rank <= 0 || rank >= 999999) return '—';
  const year = row.latest_annual_year ? `${row.latest_annual_year}年` : '';
  const group = row.latest_annual_group ? String(row.latest_annual_group) : '';
  const points = row.latest_annual_points ? `${Number(row.latest_annual_points).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}分` : '';
  const meta = [year, group, points].filter(Boolean).join(' · ');
  return (
    <div>
      <div className="font-medium text-brown-700">#{rank}</div>
      {meta && <div className="mt-0.5 max-w-40 truncate text-xs text-warm-gray-400" title={meta}>{meta}</div>}
    </div>
  );
}

function renderAthleteName(_value: unknown, row: Record<string, unknown>) {
  const name = String(row.name || '未命名运动员');
  const nameEn = String(row.name_en || '').trim();
  const photo = String(row.photo || '').trim();
  const showEliteBadge = row.elite_event_status === 'formal' || row.elite_event_status === 'reserve';
  const eliteGroups = Array.isArray(row.elite_event_groups) ? row.elite_event_groups as string[] : [];
  return (
    <div className="flex min-w-48 items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E8DDCF] bg-[#F4EFE7] text-sm font-semibold text-[#7A6245]">
        {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[#2E3D38]">{name}</span>
          {showEliteBadge && <OfficialEliteBadge status={row.elite_event_status as 'formal' | 'reserve'} groups={eliteGroups} />}
        </div>
        <div className="mt-0.5 truncate text-xs text-[#9A9085]">
          #{String(row.athlete_id || '—')}{nameEn ? ` · ${nameEn}` : ''}
        </div>
      </div>
    </div>
  );
}

function renderGender(value: unknown, row: Record<string, unknown>) {
  const inferred = row.gender_source === 'result_inferred';
  return (
    <span className="inline-flex rounded-full bg-[#F3ECE2] px-2.5 py-1 text-xs font-medium text-[#705B42]">
      {genderLabel(value)}{inferred ? ' · 推断' : ''}
    </span>
  );
}

function privacyLabel(value: unknown) {
  const mode = String(value || 'public');
  if (mode !== 'public') return { text: '隐藏主页', cls: 'bg-amber-50 text-amber-700 ring-amber-100' };
  return { text: '展示主页', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
}

function resultPrivacyLabel(value: unknown) {
  const hidden = Number(value || 0) > 0;
  return hidden
    ? { text: '隐藏成绩&积分', cls: 'bg-amber-50 text-amber-700 ring-amber-100' }
    : { text: '公开成绩与积分', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
}

function buildColumns(token: string) {
  async function setPrivacy(row: Record<string, unknown>, requestType: 'hide_athlete' | 'restore_frontend' | 'hide_results_points' | 'restore_results_points') {
    const athleteId = Number(row.athlete_id || 0);
    if (!athleteId) return;
    const res = await fetch('/api/admin/athletes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set_privacy', athlete_id: athleteId, request_type: requestType }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || '隐私设置失败');
      return;
    }
    window.location.reload();
  }

  return [
  { key: 'name', label: '运动员', render: renderAthleteName },
  { key: 'gender', label: '性别', render: renderGender },
  { key: 'nationality', label: '国籍', sortable: true, render: (v: unknown) => normalizeNationality(v) || '—' },
  { key: 'province', label: '籍贯', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.province, row.city) },
  { key: 'living_city', label: '现居城市', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.living_province, row.living_city) },
  { key: 'latest_annual_rank', label: '国内年度排名', sortable: true, render: (_v: unknown, row: Record<string, unknown>) => formatAnnualRank(row) },
  { key: 'is_claimed', label: '认领', render: (v: unknown) => Number(v) > 0 ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已认领</span> : <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-warm-gray-400">未认领</span> },
  { key: 'discipline', label: '项目', render: (v: unknown) => ({'race':'竞速','surf':'冲浪','distance':'长距离','technical':'技巧'}[String(v)] || String(v)) },
  {
    key: 'privacy_mode',
    label: '隐私',
    render: (v: unknown, row: Record<string, unknown>) => {
      const current = String(v || 'public');
      const profileHidden = current !== 'public';
      const profile = privacyLabel(current);
      const resultsHidden = Number(row.results_points_hidden || 0) > 0;
      const results = resultPrivacyLabel(row.results_points_hidden);
      return (
        <div className="min-w-48 space-y-3">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${profile.cls}`}>{profile.text}</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={profileHidden}
                onClick={() => setPrivacy(row, 'hide_athlete')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                隐藏主页
              </button>
              <button
                type="button"
                disabled={!profileHidden}
                onClick={() => setPrivacy(row, 'restore_frontend')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                展示主页
              </button>
            </div>
          </div>
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${results.cls}`}>{results.text}</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={resultsHidden}
                onClick={() => setPrivacy(row, 'hide_results_points')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                隐藏成绩&积分
              </button>
              <button
                type="button"
                disabled={!resultsHidden}
                onClick={() => setPrivacy(row, 'restore_results_points')}
                className="rounded-md border border-[#E4D8C8] bg-white px-2 py-1 text-[11px] text-[#5E554D] hover:border-[#0F5C52] hover:text-[#0F5C52] disabled:cursor-not-allowed disabled:opacity-40"
              >
                公开成绩与积分
              </button>
            </div>
          </div>
        </div>
      );
    },
  },
  ];
}
const defaultFormData = { athlete_id: undefined, name: '', name_en: '', gender: 'unknown', gender_source: 'manual', gender_confidence: null, nationality: '', province: '', city: '', photo: '', photos: [], bio: '', discipline: 'race', icf_ranking: '', achievements: [], social_links: {} };

const athleteFilters = [
  {
    key: 'gender',
    placeholder: '全部性别',
    options: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' },
      { value: 'mixed', label: '混合/团体' },
      { value: 'unknown', label: '未知' },
    ],
  },
  { key: 'nationality', placeholder: '筛选国籍', type: 'search' as const, endpoint: '/api/admin/athletes/filter-options?type=nationality', options: [] },
  { key: 'city', placeholder: '筛选城市', type: 'search' as const, endpoint: '/api/admin/athletes/filter-options?type=city', options: [] },
  {
    key: 'rankBucket',
    placeholder: '全部排名',
    options: [
      { value: 'top10', label: '前 10' },
      { value: 'top50', label: '前 50' },
      { value: 'top100', label: '前 100' },
      { value: 'ranked', label: '有排名' },
      { value: 'unranked', label: '无排名' },
    ],
  },
];

export default function AthletesAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="运动员" apiPath="/api/admin/athletes" columns={buildColumns(token)} FormComponent={AthleteForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索姓名 / 英文名 / 国籍..." additionalFilters={athleteFilters} enableBulkActions />;
}
