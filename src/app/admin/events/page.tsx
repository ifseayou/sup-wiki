'use client';

import EntityManager from '@/components/admin/EntityManager';
import { useAdminAuth } from '../layout';

function EventForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">赛事名称 *</label>
          <input className={inp} value={String(data.name || '')} onChange={e => set('name', e.target.value)} placeholder="如：千岛湖桨板公开赛" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">Slug *</label>
          <input className={inp} value={String(data.slug || '')} onChange={e => set('slug', e.target.value)} placeholder="qiandaohu-sup-2025" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">赛事类型</label>
          <select className={inp} value={String(data.event_type || 'race')} onChange={e => set('event_type', e.target.value)}>
            <option value="race">竞速赛</option>
            <option value="festival">嘉年华</option>
            <option value="training">训练营</option>
            <option value="exhibition">展览赛</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">赛事状态</label>
          <select className={inp} value={String(data.event_status || 'upcoming')} onChange={e => set('event_status', e.target.value)}>
            <option value="upcoming">即将开始</option>
            <option value="ongoing">进行中</option>
            <option value="completed">已结束</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">省份</label>
          <input className={inp} value={String(data.province || '')} onChange={e => set('province', e.target.value)} placeholder="浙江" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">城市</label>
          <input className={inp} value={String(data.city || '')} onChange={e => set('city', e.target.value)} placeholder="杭州" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">报名费</label>
          <input className={inp} value={String(data.price_range || '')} onChange={e => set('price_range', e.target.value)} placeholder="¥200-¥500" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">开始日期</label>
          <input className={inp} type="date" value={String(data.start_date || '')} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">结束日期</label>
          <input className={inp} type="date" value={String(data.end_date || '')} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">报名截止</label>
          <input className={inp} type="date" value={String(data.registration_deadline || '')} onChange={e => set('registration_deadline', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">主办方</label>
        <input className={inp} value={String(data.organizer || '')} onChange={e => set('organizer', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">官网</label>
        <input className={inp} value={String(data.website || '')} onChange={e => set('website', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">报名链接</label>
        <input className={inp} value={String(data.registration_url || '')} onChange={e => set('registration_url', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">赛事介绍</label>
        <textarea className={inp} rows={4} value={String(data.description || '')} onChange={e => set('description', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">参赛要求</label>
        <textarea className={inp} rows={3} value={String(data.requirements || '')} onChange={e => set('requirements', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-warm-gray-400 mb-1">联系方式</label>
        <input className={inp} value={String(data.contact_info || '')} onChange={e => set('contact_info', e.target.value)} />
      </div>
    </div>
  );
}

const columns = [
  { key: 'name', label: '赛事名称' },
  { key: 'event_type', label: '类型', render: (v: unknown) => ({'race':'竞速','festival':'嘉年华','training':'训练营','exhibition':'展览'}[String(v)] || String(v)) },
  { key: 'province', label: '省份' },
  { key: 'start_date', label: '开始日期', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '—' },
  { key: 'event_status', label: '赛事状态', render: (v: unknown) => ({'upcoming':'即将','ongoing':'进行中','completed':'已结束','cancelled':'已取消'}[String(v)] || String(v)) },
];
const defaultFormData = { event_id: undefined, name: '', name_en: '', slug: '', event_type: 'race', event_status: 'upcoming', province: '', city: '', venue: '', start_date: '', end_date: '', registration_deadline: '', organizer: '', description: '', requirements: '', website: '', registration_url: '', contact_info: '', price_range: '' };

export default function EventsAdminPage() {
  const { token } = useAdminAuth();
  return <EntityManager entityName="赛事" apiPath="/api/admin/events" columns={columns} FormComponent={EventForm} defaultFormData={defaultFormData} token={token} searchPlaceholder="搜索赛事名称..." />;
}
