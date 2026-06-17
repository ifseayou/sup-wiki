'use client';

import EntityManager from '@/components/admin/EntityManager';
import Link from 'next/link';
import RegionSelect from '@/components/admin/RegionSelect';
import { MultiImageUpload } from '@/components/admin/ImageUpload';
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

function formatDateInput(value: unknown) {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function sourceItems(row: Record<string, unknown>) {
  const names = String(row.source_names || row.primary_source_name || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  const urls = String(row.source_urls || row.primary_source_url || '')
    .split('\n')
    .map((item) => item.trim());
  return names.map((name, index) => ({ name, url: urls[index] || '' }));
}

type EventGuide = {
  summary?: string;
  source?: { title?: string; type?: string; note?: string };
  highlights?: Array<{ label?: string; value?: string; note?: string }>;
  sections?: Array<{ title?: string; items?: string[] }>;
  images?: Array<{ title?: string; url?: string; caption?: string }>;
};

function parseJsonObject(value: unknown): EventGuide {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as EventGuide;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function guideToHighlightText(guide: EventGuide) {
  return (guide.highlights || [])
    .map((item) => [item.label || '', item.value || '', item.note || ''].join(' | ').replace(/\s+\|\s+$/g, ''))
    .join('\n');
}

function guideToSectionText(guide: EventGuide) {
  return (guide.sections || [])
    .flatMap((section) => (section.items || []).map((item) => `${section.title || '说明'} | ${item}`))
    .join('\n');
}

function parseHighlightText(text: string): EventGuide['highlights'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = '', value = '', note = ''] = line.split('|').map((item) => item.trim());
      return { label, value, note };
    })
    .filter((item) => item.label || item.value || item.note);
}

function parseSectionText(text: string): EventGuide['sections'] {
  const grouped = new Map<string, string[]>();
  for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const [title = '说明', ...rest] = line.split('|').map((item) => item.trim());
    const content = rest.join(' | ').trim();
    if (!content) continue;
    grouped.set(title, [...(grouped.get(title) || []), content]);
  }
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }));
}

function guideImageUrls(guide: EventGuide) {
  return (guide.images || []).map((item) => item.url || '').filter(Boolean);
}

function updateEventGuide(
  data: Record<string, unknown>,
  onChange: (d: Record<string, unknown>) => void,
  patch: Partial<EventGuide>
) {
  const current = parseJsonObject(data.event_guide);
  onChange({ ...data, event_guide: { ...current, ...patch } });
}

function EventForm({ data, onChange, token }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; token: string }) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const inp = 'w-full px-3 py-2 border border-cream-300 rounded-lg text-sm focus:ring-2 focus:ring-brown-500 focus:border-brown-500 bg-cream-50 text-brown-800';
  const sourceLinksText = formatSourceLinksForTextarea(data.result_source_links);
  const guide = parseJsonObject(data.event_guide);
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
        <RegionSelect
          idPrefix="event-region"
          province={String(data.province || '')}
          city={String(data.city || '')}
          onChange={(value) => onChange({ ...data, province: value.province, city: value.city })}
        />
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">报名费</label>
          <input className={inp} value={String(data.price_range || '')} onChange={e => set('price_range', e.target.value)} placeholder="¥200-¥500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">具体场馆/水域（venue）</label>
          <input className={inp} value={String(data.venue || '')} onChange={e => set('venue', e.target.value)} placeholder="如 西溪湿地洪园码头" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">详细地点（location）</label>
          <input className={inp} value={String(data.location || '')} onChange={e => set('location', e.target.value)} placeholder="如 杭州市西湖区西溪湿地" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">场馆纬度</label>
          <input className={inp} value={String(data.venue_lat ?? '')} onChange={e => set('venue_lat', e.target.value)} placeholder="留空将按地点自动定位" />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">场馆经度</label>
          <input className={inp} value={String(data.venue_lng ?? '')} onChange={e => set('venue_lng', e.target.value)} placeholder="留空将按地点自动定位" />
        </div>
        <div className="flex items-end pb-1">
          {(data.venue_lat && data.venue_lng) ? (
            <a className="text-xs text-brown-600 underline" target="_blank" rel="noreferrer"
               href={`https://uri.amap.com/marker?position=${data.venue_lng},${data.venue_lat}&name=${encodeURIComponent(String(data.venue || data.name || ''))}`}>在高德查看 ›</a>
          ) : (
            <span className="text-xs text-warm-gray-400">保存后按地点自动定位坐标</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">开始日期</label>
          <input className={inp} type="date" value={formatDateInput(data.start_date)} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">结束日期</label>
          <input className={inp} type="date" value={formatDateInput(data.end_date)} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">报名截止</label>
          <input className={inp} type="date" value={formatDateInput(data.registration_deadline)} onChange={e => set('registration_deadline', e.target.value)} />
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
      <div className="rounded-xl border border-cream-200 bg-white/70 p-4">
        <h3 className="mb-1 text-sm font-medium text-brown-700">参赛指南</h3>
        <p className="mb-4 text-xs leading-5 text-warm-gray-400">
          用于录入选手赛前真正需要的信息，例如领物、起终点、路线图、开幕式、自带器材、交通提醒。酒店住宿等非必要信息不要录入。
        </p>
        <div>
          <label className="block text-xs text-warm-gray-400 mb-1">指南摘要</label>
          <textarea
            className={inp}
            rows={3}
            value={String(guide.summary || '')}
            onChange={(e) => updateEventGuide(data, onChange, { summary: e.target.value })}
            placeholder="这不是成绩册，而是选手赛前须知。请概括选手应该优先关注的内容。"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">资料来源标题</label>
            <input
              className={inp}
              value={String(guide.source?.title || '')}
              onChange={(e) => updateEventGuide(data, onChange, { source: { ...(guide.source || {}), title: e.target.value } })}
              placeholder="选手须知长图 / 官方通知"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-gray-400 mb-1">资料来源说明</label>
            <input
              className={inp}
              value={String(guide.source?.note || '')}
              onChange={(e) => updateEventGuide(data, onChange, { source: { ...(guide.source || {}), note: e.target.value } })}
              placeholder="例如：来自官方发布的选手须知"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">关键信息卡</label>
          <textarea
            className={inp}
            rows={5}
            value={guideToHighlightText(guide)}
            onChange={(e) => updateEventGuide(data, onChange, { highlights: parseHighlightText(e.target.value) })}
            placeholder={'每行一条：标签 | 内容 | 备注\n例如：领物时间 | 2026-06-05 09:00-20:00 | 武林门码头一楼售票大厅'}
          />
        </div>
        <div className="mt-4">
          <label className="block text-xs text-warm-gray-400 mb-1">分模块说明</label>
          <textarea
            className={inp}
            rows={7}
            value={guideToSectionText(guide)}
            onChange={(e) => updateEventGuide(data, onChange, { sections: parseSectionText(e.target.value) })}
            placeholder={'每行一条：模块标题 | 内容\n例如：领物相关 | 本人领取需携带身份证件和免责声明'}
          />
        </div>
        <div className="mt-4">
          <MultiImageUpload
            values={guideImageUrls(guide)}
            onChange={(urls) => updateEventGuide(data, onChange, {
              images: urls.map((url, index) => ({
                title: guide.images?.[index]?.title || `赛事指南图片 ${index + 1}`,
                url,
                caption: guide.images?.[index]?.caption || '',
              })),
            })}
            folder="events"
            module="system"
            token={token}
            label="线路/动线/交通图"
            max={8}
            sortable
          />
          <p className="mt-2 text-xs text-warm-gray-400">上传后如需修改图片标题，可切到 JSON 模式编辑 event_guide.images。</p>
        </div>
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
                // 一次性更新两字段：避免连续两次 set 闭包同一份旧 data，
                // 否则第二次会用未更新的 data 覆盖掉 star_level（导致选星级无效）。
                onChange({
                  ...data,
                  star_level: starLevel || null,
                  score_coefficient: starLevel ? getScoreForStarLevel(starLevel) : null,
                });
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
  {
    key: 'event_guide',
    label: '参赛指南',
    render: (v: unknown) => {
      const guide = parseJsonObject(v);
      const count = (guide.highlights?.length || 0) + (guide.sections?.length || 0) + (guide.images?.filter((item) => item.url)?.length || 0);
      return count > 0 ? <span className="text-xs text-emerald-700">已录入</span> : <span className="text-xs text-warm-gray-400">—</span>;
    },
  },
  {
    key: 'primary_source_url',
    label: '成绩来源',
    render: (v: unknown, row: Record<string, unknown>) => {
      const sourceUrl = String(v || '');
      const sourceName = String(row.primary_source_name || '成绩册');
      const sourceCount = Number(row.source_count || 0);
      if (!sourceCount) return <span className="text-warm-gray-400">—</span>;
      const items = sourceItems(row);
      if (sourceCount > 1) {
        return (
          <details className="group max-w-[240px] text-xs text-warm-gray-600">
            <summary className="cursor-pointer list-none text-brown-600 hover:text-brown-800">
              {sourceCount} 份成绩册
              <span className="ml-1 text-warm-gray-400 group-open:hidden">展开</span>
              <span className="ml-1 hidden text-warm-gray-400 group-open:inline">收起</span>
            </summary>
            <div className="mt-2 space-y-1 rounded-lg border border-cream-200 bg-white p-2 shadow-sm">
              {items.map((item, index) => item.url ? (
                <a key={`${item.name}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="block truncate text-brown-600 hover:text-brown-800" title={item.name}>
                  {index + 1}. {item.name}
                </a>
              ) : (
                <div key={`${item.name}-${index}`} className="truncate text-warm-gray-500" title={item.name}>{index + 1}. {item.name}</div>
              ))}
            </div>
          </details>
        );
      }
      const label = sourceName;
      if (!sourceUrl) return <span className="text-xs text-warm-gray-500">{label}</span>;
      return (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brown-500 hover:text-brown-700">
          {label}
        </a>
      );
    },
  },
  { key: 'results_count', label: '成绩数', sortable: true, render: (v: unknown) => String(v || 0) },
  { key: 'linked_athletes_count', label: '关联运动员', sortable: true, render: (v: unknown) => String(v || 0) },
  {
    key: 'results_manage',
    label: '成绩管理',
    render: (_v: unknown, row: Record<string, unknown>) => (
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={`/admin/events/${row.event_id}/results`} className="text-brown-500 hover:text-brown-700">
          成绩
        </Link>
        <Link href={`/admin/results?event_id=${row.event_id}`} className="text-brown-500 hover:text-brown-700">
          明细
        </Link>
        <Link href="/admin/result-sources" className="text-brown-500 hover:text-brown-700">
          来源
        </Link>
        <Link href="/admin/athlete-identities" className="text-brown-500 hover:text-brown-700">
          匹配
        </Link>
      </div>
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
  location: '',
  venue_lat: '',
  venue_lng: '',
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
  event_guide: {},
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
      enableBulkActions
    />
  );
}
