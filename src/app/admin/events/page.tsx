'use client';

import EntityManager from '@/components/admin/EntityManager';
import Link from 'next/link';
import { useAdminAuth } from '../layout';
import {
  EVENT_RESULT_STATUS_OPTIONS,
  EVENT_SOURCE_SCOPE_OPTIONS,
  EVENT_STAR_OPTIONS,
  getEventResultStatusLabel,
  getEventStarBadgeStyle,
  getScoreForStarLevel,
} from '@/lib/event-stars';
import {
  formatSourceLinksForTextarea,
  parseSourceLinksTextarea,
} from '@/lib/event-results';

function EventForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const sourceLinksText = formatSourceLinksForTextarea(data.result_source_links);
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
      <div className="rounded-xl border border-cream-200 bg-cream-100/60 p-4">
        <h3 className="mb-3 text-sm font-medium text-brown-700">赛事评级与结果档案</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">赛事星级</label>
            <select
              className={inp}
              value={String(data.star_level || '')}
              onChange={(e) => {
                const starLevel = e.target.value;
                set('star_level', starLevel || null);
                set('score_coefficient', starLevel ? getScoreForStarLevel(starLevel) : null);
              }}
            >
              <option value="">未评级</option>
              {EVENT_STAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">积分系数</label>
            <input
              className={inp}
              value={String(data.score_coefficient || '')}
              onChange={e => set('score_coefficient', e.target.value || null)}
              placeholder="例如 4.5"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">赛事来源范围</label>
            <select className={inp} value={String(data.source_scope || '')} onChange={e => set('source_scope', e.target.value || null)}>
              <option value="">未设置</option>
              {EVENT_SOURCE_SCOPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">结果采集状态</label>
            <select className={inp} value={String(data.result_status || 'none')} onChange={e => set('result_status', e.target.value)}>
              {EVENT_RESULT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">结果来源说明</label>
          <textarea className={inp} rows={3} value={String(data.result_source_note || '')} onChange={e => set('result_source_note', e.target.value)} placeholder="官方成绩单 / 媒体稿 / 直播截图等说明" />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">结果来源链接</label>
          <textarea
            className={inp}
            rows={3}
            value={sourceLinksText}
            onChange={e => set('result_source_links', parseSourceLinksTextarea(e.target.value))}
            placeholder="每行一个：标题 | https://..."
          />
        </div>
      </div>
    </div>
  );
}

const columns = [
  { key: 'name', label: '赛事名称' },
  {
    key: 'star_level',
    label: '星级',
    render: (v: unknown, row: Record<string, unknown>) => {
      const value = String(v || '');
      if (!value) return <span className="text-warm-gray-400">未评级</span>;
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getEventStarBadgeStyle(value)}`}>
          {value}
          {row.score_coefficient ? ` / ${row.score_coefficient}` : ''}
        </span>
      );
    },
  },
  { key: 'event_type', label: '类型', render: (v: unknown) => ({'race':'竞速','festival':'嘉年华','training':'训练营','exhibition':'展览'}[String(v)] || String(v)) },
  { key: 'province', label: '省份' },
  { key: 'start_date', label: '开始日期', render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString('zh-CN') : '—' },
  { key: 'event_status', label: '赛事状态', render: (v: unknown) => ({'upcoming':'即将','ongoing':'进行中','completed':'已结束','cancelled':'已取消'}[String(v)] || String(v)) },
  { key: 'result_status', label: '结果档案', render: (v: unknown) => getEventResultStatusLabel(String(v || 'none')) },
  { key: 'results_count', label: '成绩数', render: (v: unknown) => String(v || 0) },
  { key: 'linked_athletes_count', label: '关联运动员', render: (v: unknown) => String(v || 0) },
  {
    key: 'results_manage',
    label: '成绩管理',
    render: (_v: unknown, row: Record<string, unknown>) => (
      <Link href={`/admin/events/${row.event_id}/results`} className="text-xs text-brown-500 hover:text-brown-700">
        进入成绩页
      </Link>
    ),
  },
];
const defaultFormData = {
  event_id: undefined,
  name: '',
  name_en: '',
  slug: '',
  event_type: 'race',
  event_status: 'upcoming',
  province: '',
  city: '',
  venue: '',
  start_date: '',
  end_date: '',
  registration_deadline: '',
  organizer: '',
  description: '',
  requirements: '',
  website: '',
  registration_url: '',
  contact_info: '',
  price_range: '',
  star_level: '',
  score_coefficient: '',
  source_scope: '',
  result_status: 'none',
  result_source_note: '',
  result_source_links: [],
};

const additionalFilters = [
  {
    key: 'star_level',
    placeholder: '全部星级',
    options: EVENT_STAR_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
  },
  {
    key: 'result_status',
    placeholder: '全部结果档案',
    options: EVENT_RESULT_STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
  },
  {
    key: 'event_status',
    placeholder: '全部赛事状态',
    options: [
      { label: '即将开始', value: 'upcoming' },
      { label: '进行中', value: 'ongoing' },
      { label: '已结束', value: 'completed' },
      { label: '已取消', value: 'cancelled' },
    ],
  },
  {
    key: 'year',
    placeholder: '全部年份',
    options: ['2026', '2025', '2024', '2023'].map((year) => ({ label: year, value: year })),
  },
];

export default function EventsAdminPage() {
  const { token } = useAdminAuth();
  return (
    <EntityManager
      entityName="赛事"
      apiPath="/api/admin/events"
      columns={columns}
      FormComponent={EventForm}
      defaultFormData={defaultFormData}
      token={token}
      searchPlaceholder="搜索赛事名称 / 城市 / 主办方..."
      additionalFilters={additionalFilters}
    />
  );
}
