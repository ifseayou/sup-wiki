'use client';

import EntityManager from '@/components/admin/EntityManager';
import { useAdminAuth } from '../layout';

const categoryOptions = [
  { value: 'event_guide', label: '赛事指南' },
  { value: 'brand_guide', label: '品牌指南' },
  { value: 'general', label: '通用文章' },
];

function ArticleForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">标题 *</label>
          <input className={inp} value={String(data.title || '')} onChange={e => set('title', e.target.value)} placeholder="如：中国桨板赛事体系" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">Slug *</label>
          <input className={inp} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="china-event-system" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">分类</label>
          <select className={inp} value={String(data.category || 'event_guide')} onChange={e => set('category', e.target.value)}>
            {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">排序（数字越小越靠前）</label>
          <input className={inp} type="number" value={String(data.sort_order ?? 0)} onChange={e => set('sort_order', Number(e.target.value))} style={{ maxWidth: 120 }} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">摘要（显示在 Tab 标题下方）</label>
        <textarea className={inp} rows={2} value={String(data.summary || '')} onChange={e => set('summary', e.target.value)} placeholder="一两句话概括文章要点..." />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">
          正文内容（支持 Markdown：## 二级标题、**加粗**、- 列表项、| 表格）
        </label>
        <textarea
          className={`${inp} font-mono`}
          rows={20}
          value={String(data.content || '')}
          onChange={e => set('content', e.target.value)}
          placeholder={'## 一级段落标题\n\n正文内容...\n\n## 第二段落\n\n- 列表项一\n- 列表项二'}
          style={{ fontSize: 12, lineHeight: 1.6 }}
        />
      </div>
    </div>
  );
}

const columns = [
  { key: 'title', label: '标题' },
  { key: 'category', label: '分类', render: (v: unknown) => ({ event_guide: '赛事指南', brand_guide: '品牌指南', general: '通用' }[String(v)] || String(v)) },
  { key: 'sort_order', label: '排序' },
  { key: 'updated_at', label: '更新', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '' },
];

const defaultFormData = {
  article_id: undefined,
  title: '',
  slug: '',
  category: 'event_guide',
  summary: '',
  content: '',
  sort_order: 0,
};

export default function ArticlesAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="文章"
      apiPath="/api/admin/articles"
      columns={columns}
      FormComponent={ArticleForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索标题..."
    />
  );
}
