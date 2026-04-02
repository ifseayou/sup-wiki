'use client';

import EntityManager from '@/components/admin/EntityManager';
import { useAdminAuth } from '../layout';

function ProductForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">型号 *</label>
          <input className={inp} value={String(data.model || '')} onChange={e => set('model', e.target.value)} placeholder="如：Ride 10'8" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">品牌 ID *</label>
          <input className={inp} type="number" value={String(data.brand_id || '')} onChange={e => set('brand_id', Number(e.target.value))} placeholder="品牌 ID" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">类型</label>
          <select className={inp} value={String(data.type || 'allround')} onChange={e => set('type', e.target.value)}>
            <option value="inflatable">充气板</option>
            <option value="hardboard">硬板</option>
            <option value="race">竞速板</option>
            <option value="allround">全能板</option>
            <option value="yoga">瑜伽板</option>
            <option value="touring">巡游板</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">适合人群</label>
          <select className={inp} value={String(data.suitable_for || 'beginner')} onChange={e => set('suitable_for', e.target.value)}>
            <option value="beginner">新手</option>
            <option value="intermediate">进阶</option>
            <option value="advanced">高级</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">长度(cm)</label>
          <input className={inp} type="number" value={String(data.length_cm || '')} onChange={e => set('length_cm', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">宽度(cm)</label>
          <input className={inp} type="number" value={String(data.width_cm || '')} onChange={e => set('width_cm', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">厚度(cm)</label>
          <input className={inp} type="number" value={String(data.thickness_cm || '')} onChange={e => set('thickness_cm', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">重量(kg)</label>
          <input className={inp} type="number" step="0.1" value={String(data.weight_kg || '')} onChange={e => set('weight_kg', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">最低价(¥)</label>
          <input className={inp} type="number" value={String(data.price_min || '')} onChange={e => set('price_min', e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">最高价(¥)</label>
          <input className={inp} type="number" value={String(data.price_max || '')} onChange={e => set('price_max', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">材质</label>
        <input className={inp} value={String(data.material || '')} onChange={e => set('material', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">产品描述</label>
        <textarea className={inp} rows={3} value={String(data.description || '')} onChange={e => set('description', e.target.value)} />
      </div>
    </div>
  );
}

const columns = [
  { key: 'model', label: '型号' },
  { key: 'brand_name', label: '品牌' },
  { key: 'type', label: '类型', render: (v: unknown) => ({'inflatable':'充气','hardboard':'硬板','race':'竞速','allround':'全能','yoga':'瑜伽','touring':'巡游'}[String(v)] || String(v)) },
  { key: 'price_min', label: '价格', render: (v: unknown) => v ? `¥${Number(v).toLocaleString()}` : '—' },
  { key: 'updated_at', label: '更新', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '' },
];
const defaultFormData = { product_id: undefined, brand_id: '', model: '', type: 'allround', suitable_for: 'beginner', length_cm: '', width_cm: '', thickness_cm: '', weight_kg: '', material: '', price_min: '', price_max: '', description: '' };

export default function ProductsAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="产品" apiPath="/api/admin/products" columns={columns} FormComponent={ProductForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索型号..." />;
}
