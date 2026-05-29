'use client';

/* eslint-disable @next/next/no-img-element */
import EntityManager from '@/components/admin/EntityManager';
import ImageUpload, { MultiImageUpload } from '@/components/admin/ImageUpload';
import RegionSelect from '@/components/admin/RegionSelect';
import { genderLabel } from '@/lib/athlete-gender';
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
  return (
    <div className="flex min-w-48 items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E8DDCF] bg-[#F4EFE7] text-sm font-semibold text-[#7A6245]">
        {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1)}
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-[#2E3D38]">{name}</div>
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

const columns = [
  { key: 'name', label: '运动员', render: renderAthleteName },
  { key: 'gender', label: '性别', render: renderGender },
  { key: 'province', label: '籍贯', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.province, row.city) },
  { key: 'living_city', label: '现居城市', render: (_v: unknown, row: Record<string, unknown>) => formatLocation(row.living_province, row.living_city) },
  { key: 'latest_annual_rank', label: '国内年度排名', render: (_v: unknown, row: Record<string, unknown>) => formatAnnualRank(row) },
  { key: 'is_claimed', label: '认领', render: (v: unknown) => Number(v) > 0 ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">已认领</span> : <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs text-warm-gray-400">未认领</span> },
  { key: 'discipline', label: '项目', render: (v: unknown) => ({'race':'竞速','surf':'冲浪','distance':'长距离','technical':'技巧'}[String(v)] || String(v)) },
];
const defaultFormData = { athlete_id: undefined, name: '', name_en: '', gender: 'unknown', gender_source: 'manual', gender_confidence: null, nationality: '', province: '', city: '', photo: '', photos: [], bio: '', discipline: 'race', icf_ranking: '', achievements: [], social_links: {} };

export default function AthletesAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="运动员" apiPath="/api/admin/athletes" columns={columns} FormComponent={AthleteForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索姓名 / 英文名..." enableBulkActions />;
}
