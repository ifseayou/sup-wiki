'use client';

import EntityManager from '@/components/admin/EntityManager';
import ImageUpload from '@/components/admin/ImageUpload';
import { useAdminAuth } from '../layout';

function BrandForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const { token } = useAdminAuth();
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

  return (
    <div className="space-y-4">
      <ImageUpload value={String(data.logo || '')} onChange={url => set('logo', url)} folder="brands" token={token} label="品牌 Logo" />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">品牌名称 *</label>
          <input className={inp} value={String(data.name || '')} onChange={e => set('name', e.target.value)} placeholder="如：Red Paddle Co" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">英文名称</label>
          <input className={inp} value={String(data.name_en || '')} onChange={e => set('name_en', e.target.value)} placeholder="English name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">Slug *（URL 标识）</label>
          <input className={inp} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="red-paddle-co" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">定位</label>
          <select className={inp} value={String(data.tier || 'entry')} onChange={e => set('tier', e.target.value)}>
            <option value="entry">入门级</option>
            <option value="intermediate">进阶级</option>
            <option value="pro">专业级</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">国家</label>
          <input className={inp} value={String(data.country || '')} onChange={e => set('country', e.target.value)} placeholder="英国" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">官网</label>
          <input className={inp} value={String(data.website || '')} onChange={e => set('website', e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">品牌介绍</label>
        <textarea className={inp} rows={4} value={String(data.description || '')} onChange={e => set('description', e.target.value)} placeholder="品牌故事、特点..." />
      </div>
    </div>
  );
}

const columns = [
  { key: 'name', label: '名称' },
  { key: 'name_en', label: '英文名' },
  { key: 'tier', label: '定位', render: (v: unknown) => ({ entry: '入门', intermediate: '进阶', pro: '专业' }[String(v)] || String(v)) },
  { key: 'country', label: '国家' },
  { key: 'updated_at', label: '更新时间', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '' },
];

const defaultFormData = { brand_id: undefined, name: '', name_en: '', slug: '', tier: 'entry', country: '', website: '', logo: '', description: '' };

export default function BrandsAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="品牌"
      apiPath="/api/admin/brands"
      columns={columns}
      FormComponent={BrandForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索品牌名称..."
    />
  );
}
