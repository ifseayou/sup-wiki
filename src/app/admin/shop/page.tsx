'use client';

import { useState, useEffect } from 'react';
import EntityManager from '@/components/admin/EntityManager';
import { MultiImageUpload } from '@/components/admin/ImageUpload';
import { useAdminAuth } from '../layout';

interface BrandOption { brand_id: number; name: string; }

function ShopItemForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

  const images = Array.isArray(data.images) ? (data.images as string[]) : [];
  const variants = Array.isArray(data.variants) ? (data.variants as Array<{ color: string; images: string[]; extra_note?: string }>) : [];
  const videos = Array.isArray(data.videos) ? (data.videos as Array<{ title: string; url: string }>) : [];
  const highlights = Array.isArray(data.highlights) ? (data.highlights as string[]) : [];

  const [brands, setBrands] = useState<BrandOption[]>([]);
  useEffect(() => {
    fetch('/api/admin/brands?pageSize=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setBrands(d.items || [])).catch(() => {});
  }, [token]);

  function addVideo() {
    set('videos', [...videos, { title: '', url: '' }]);
  }
  function updateVideo(i: number, field: 'title' | 'url', val: string) {
    const next = [...videos];
    next[i] = { ...next[i], [field]: val };
    set('videos', next);
  }
  function removeVideo(i: number) {
    set('videos', videos.filter((_, idx) => idx !== i));
  }

  function addHighlight() {
    set('highlights', [...highlights, '']);
  }
  function updateHighlight(i: number, val: string) {
    const next = [...highlights];
    next[i] = val;
    set('highlights', next);
  }
  function removeHighlight(i: number) {
    set('highlights', highlights.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {/* 基础信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">商品名称 *</label>
          <input className={inp} value={String(data.name || '')} onChange={e => set('name', e.target.value)} placeholder="如：维特拉 竞速系列 14尺" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">URL Slug *</label>
          <input className={inp} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="如：vetra-race-14" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">副标题（卖点一句话）</label>
        <input className={inp} value={String(data.subtitle || '')} onChange={e => set('subtitle', e.target.value)} placeholder="如：专业竞速，追风逐浪" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分类 *</label>
          <select className={inp} value={String(data.category || 'board')} onChange={e => set('category', e.target.value)}>
            <option value="board">桨板</option>
            <option value="paddle">桨</option>
            <option value="life_jacket">救生衣</option>
            <option value="accessory">周边配件</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">板型（仅桨板）</label>
          <select className={inp} value={String(data.board_type || '')} onChange={e => set('board_type', e.target.value || null)} disabled={data.category !== 'board'}>
            <option value="">—</option>
            <option value="race">竞速板</option>
            <option value="allround">全能板</option>
            <option value="touring">巡游板</option>
            <option value="yoga">瑜伽板</option>
            <option value="inflatable">充气板</option>
          </select>
        </div>
      </div>

      {/* 品牌关联 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">关联品牌</label>
          <select className={inp} value={String(data.brand_id || '')} onChange={e => set('brand_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— 不关联 —</option>
            {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">库存状态</label>
          <select className={inp} value={String(data.stock_status || 'in_stock')} onChange={e => set('stock_status', e.target.value)}>
            <option value="in_stock">现货</option>
            <option value="low_stock">库存紧张</option>
            <option value="pre_order">可预定</option>
            <option value="sold_out">暂时售罄</option>
          </select>
        </div>
      </div>

      {/* 价格 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">成本价/拿货价（¥）</label>
          <input className={inp} type="number" value={String(data.cost_price || '')} onChange={e => set('cost_price', e.target.value ? Number(e.target.value) : null)} placeholder="代理拿货价（仅内部可见）" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">市场价（¥）</label>
          <input className={inp} type="number" value={String(data.market_price || '')} onChange={e => set('market_price', e.target.value ? Number(e.target.value) : null)} placeholder="原价/建议零售价" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">到手价（¥）</label>
          <input className={inp} type="number" value={String(data.discount_price || '')} onChange={e => set('discount_price', e.target.value ? Number(e.target.value) : null)} placeholder="实际售价" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">毛利润（自动计算）</label>
          <div className={`${inp} flex items-center`} style={{ background: '#F5F1EB', cursor: 'default' }}>
            {(() => {
              const cost = Number(data.cost_price) || 0;
              const sell = Number(data.discount_price) || Number(data.market_price) || 0;
              if (!cost || !sell) return <span className="text-warm-gray-400">—</span>;
              const profit = sell - cost;
              const margin = ((profit / sell) * 100).toFixed(1);
              return <span style={{ color: profit > 0 ? '#276749' : '#9B2C2C', fontWeight: 600 }}>¥{profit.toLocaleString()} ({margin}%)</span>;
            })()}
          </div>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">排序权重</label>
          <input className={inp} type="number" value={String(data.sort_order || 0)} onChange={e => set('sort_order', Number(e.target.value))} />
        </div>
      </div>

      {/* 卖点 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-warm-gray-400">产品亮点</label>
          <button type="button" onClick={addHighlight} className="text-xs text-brown-500 hover:text-brown-700">+ 添加</button>
        </div>
        {highlights.map((h, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input className={inp} value={h} onChange={e => updateHighlight(i, e.target.value)} placeholder={`亮点 ${i + 1}`} />
            <button type="button" onClick={() => removeHighlight(i)} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
          </div>
        ))}
      </div>

      {/* 详细描述 */}
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">产品详情</label>
        <textarea className={inp} rows={4} value={String(data.description || '')} onChange={e => set('description', e.target.value)} placeholder="详细产品说明，支持换行" />
      </div>

      {/* 规格变体（SKU） */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#8A8078', fontWeight: 600 }}>规格变体（SKU）</label>
          <button
            type="button"
            onClick={() => set('variants', [...variants, { color: '', images: [], extra_note: '' }])}
            className="text-xs text-brown-500 hover:text-brown-700"
          >
            + 添加规格
          </button>
        </div>
        {variants.length === 0 && (
          <p className="text-xs text-warm-gray-400 mb-2">暂无规格变体，此商品仅展示下方「商品详情图」</p>
        )}
        {variants.map((v, i) => (
          <div key={i} style={{ border: '1px solid #EDE5D8', borderRadius: 10, padding: '12px 14px', marginBottom: 12, background: '#FEFCF9' }}>
            {/* 规格名称行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#A08060', marginBottom: 4 }}>规格名称（如：绿色、14×22×4.5、标准版）</div>
                <input
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 13, color: '#2E2118', background: '#FAF7F2', boxSizing: 'border-box' }}
                  value={v.color}
                  onChange={e => {
                    const next = [...variants];
                    next[i] = { ...next[i], color: e.target.value };
                    set('variants', next);
                  }}
                  placeholder="输入规格名称"
                />
              </div>
              <button
                type="button"
                onClick={() => set('variants', variants.filter((_, idx) => idx !== i))}
                style={{ color: '#E74C3C', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, flexShrink: 0, padding: '0 4px' }}
              >
                删除
              </button>
            </div>
            {/* 备注行（折叠可选） */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#A08060', marginBottom: 4 }}>备注（选填，如：限量、预定）</div>
              <input
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #EDE5D8', borderRadius: 8, fontSize: 12, color: '#655D56', background: '#FAF7F2', boxSizing: 'border-box' }}
                value={v.extra_note || ''}
                onChange={e => {
                  const next = [...variants];
                  next[i] = { ...next[i], extra_note: e.target.value };
                  set('variants', next);
                }}
                placeholder="备注信息（选填）"
              />
            </div>
            <MultiImageUpload
              values={Array.isArray(v.images) ? v.images : []}
              onChange={urls => {
                const next = [...variants];
                next[i] = { ...next[i], images: urls };
                set('variants', next);
              }}
              folder="shop"
              token={token}
              label="规格图片"
              sortable
            />
          </div>
        ))}
      </div>

      {/* 商品公共图片（详情介绍图，所有颜色共用） */}
      <MultiImageUpload
        values={images}
        onChange={urls => set('images', urls)}
        folder="shop"
        token={token}
        label="商品详情图（所有颜色共用，可拖拽排序）"
        sortable
      />

      {/* 视频 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-warm-gray-400">视频讲解（外链 URL）</label>
          <button type="button" onClick={addVideo} className="text-xs text-brown-500 hover:text-brown-700">+ 添加视频</button>
        </div>
        {videos.map((v, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className={`${inp} col-span-2`} value={v.title} onChange={e => updateVideo(i, 'title', e.target.value)} placeholder="视频标题" />
            <input className={`${inp} col-span-2`} value={v.url} onChange={e => updateVideo(i, 'url', e.target.value)} placeholder="视频链接 URL" />
            <button type="button" onClick={() => removeVideo(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const columns = [
  { key: 'name', label: '商品名称' },
  { key: 'brand_name', label: '品牌', render: (v: unknown) => v ? String(v) : '—' },
  { key: 'category', label: '分类', render: (v: unknown) => ({ board: '桨板', paddle: '桨', life_jacket: '救生衣', accessory: '配件' }[String(v)] || String(v)) },
  { key: 'cost_price', label: '成本价', render: (v: unknown) => v ? `¥${Number(v).toLocaleString()}` : '—' },
  { key: 'discount_price', label: '到手价', render: (v: unknown, row: Record<string, unknown>) => {
    const sell = Number(v) || 0;
    const cost = Number(row.cost_price) || 0;
    if (!sell) return '—';
    if (!cost) return `¥${sell.toLocaleString()}`;
    const profit = sell - cost;
    const margin = ((profit / sell) * 100).toFixed(0);
    return `¥${sell.toLocaleString()} (+${margin}%)`;
  }},
  { key: 'stock_status', label: '库存', render: (v: unknown) => ({ in_stock: '现货', low_stock: '少量', pre_order: '预定', sold_out: '售罄' }[String(v)] || String(v)) },
  { key: 'updated_at', label: '更新', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '' },
];

const defaultFormData = {
  shop_item_id: undefined,
  category: 'board',
  board_type: '',
  brand_id: '',
  name: '',
  slug: '',
  subtitle: '',
  description: '',
  highlights: [],
  cost_price: '',
  market_price: '',
  discount_price: '',
  stock_status: 'in_stock',
  images: [],
  variants: [],
  videos: [],
  sort_order: 0,
};

export default function ShopAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="商城商品"
      apiPath="/api/admin/shop-items"
      columns={columns}
      FormComponent={ShopItemForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索商品名称..."
    />
  );
}
