'use client';

import EntityManager from '@/components/admin/EntityManager';
import ImageUpload from '@/components/admin/ImageUpload';
import { useAdminAuth } from '../layout';

function AthleteForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const { token } = useAdminAuth();
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  return (
    <div className="space-y-4">
      <ImageUpload value={String(data.photo || '')} onChange={url => set('photo', url)} folder="athletes" token={token} label="运动员照片" />
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
          <label className="block text-xs text-warm-gray-400 mb-1">运动项目</label>
          <select className={inp} value={String(data.discipline || 'race')} onChange={e => set('discipline', e.target.value)}>
            <option value="race">竞速</option>
            <option value="surf">冲浪</option>
            <option value="distance">长距离</option>
            <option value="technical">技巧</option>
          </select>
        </div>
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

const columns = [
  { key: 'name', label: '姓名' },
  { key: 'name_en', label: '英文名' },
  { key: 'nationality', label: '国籍' },
  { key: 'discipline', label: '项目', render: (v: unknown) => ({'race':'竞速','surf':'冲浪','distance':'长距离','technical':'技巧'}[String(v)] || String(v)) },
  { key: 'icf_ranking', label: 'ICF排名', render: (v: unknown) => v ? `#${v}` : '—' },
];
const defaultFormData = { athlete_id: undefined, name: '', name_en: '', nationality: '', photo: '', bio: '', discipline: 'race', icf_ranking: '', achievements: [], social_links: {} };

export default function AthletesAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="运动员" apiPath="/api/admin/athletes" columns={columns} FormComponent={AthleteForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索姓名..." />;
}
