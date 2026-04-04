'use client';

import { useState } from 'react';

interface Article {
  article_id: number;
  title: string;
  summary: string | null;
  content: string | null;
}

interface Props {
  articles: Article[];
}

// ── 静态体系图数据 ──────────────────────────────────────────

const CHINA_TIERS = [
  {
    label: '国家最高级',
    bg: '#7A6145',
    text: '#fff',
    items: [
      { name: '全国桨板冠军赛', tag: '每年举办', note: '国家体育总局水上运动管理中心主办，设精英组、公开组、大师组及青少年组，是国内最高荣誉赛事。' },
    ],
  },
  {
    label: '职业联赛',
    bg: '#A08060',
    text: '#fff',
    items: [
      { name: '中国桨板俱乐部联赛（CPL）', tag: '6–8站 / 年', note: '全年多站巡回，覆盖华东、华南、西南，设 6000 米长距离赛和 200 米竞速赛。' },
      { name: '中国桨板公开赛', tag: '含国际认证', note: '部分站点同时承办亚洲杯，接轨 ICF 国际积分体系。' },
    ],
  },
  {
    label: '大众赛事',
    bg: '#C4A882',
    text: '#fff',
    items: [
      { name: '全国全民健身大赛·桨板项目', tag: '国家体育总局指导', note: '面向大众健身群体，门槛低、参与广，2022 年起正式纳入全民健身大赛体系。' },
      { name: '中国百城桨板公开赛', tag: '各地分站', note: '以城市为单位举办，辐射广泛，是大众运动员入门竞技的重要平台。' },
    ],
  },
  {
    label: '省市基层',
    bg: '#EDE5D8',
    text: '#5E4A33',
    items: [
      { name: '省级桨板锦标赛', tag: '各省水上协会', note: '全国冠军赛的选拔预备赛道，广东、浙江、重庆、湖北等省份体系完善。' },
      { name: '城市公开赛', tag: '地方体育局', note: '各地自发举办，形式灵活，是桨板运动大众推广的核心载体。' },
      { name: '大众嘉年华', tag: '社区活动', note: '以娱乐体验为主，适合初学者和家庭参与，是桨板运动基层生态的重要组成。' },
    ],
  },
];

const INTL_ORGS = [
  {
    org: 'ICF',
    fullName: '国际皮划艇联合会',
    color: '#4A6FA5',
    items: [
      { name: 'ICF 世界桨板锦标赛', tag: '两年一届', note: '竞速项目最高荣誉，设 200 米冲刺、500 米技术赛、长距离赛（12km+）。中国队近年来多次获得奖牌。' },
      { name: 'ICF 洲际锦标赛', tag: '年度', note: '亚洲、欧洲、美洲分区赛，积分计入世界排名。' },
    ],
  },
  {
    org: 'ISA',
    fullName: '国际冲浪协会',
    color: '#2E7D6E',
    items: [
      { name: 'ISA 世界立式桨板锦标赛', tag: '年度', note: '侧重冲浪 SUP 及综合赛项，在海浪环境中进行，对运动员平衡与技巧要求更高。' },
    ],
  },
  {
    org: 'APP',
    fullName: '冒险桨板职业巡回赛',
    color: '#7A4FA5',
    items: [
      { name: 'APP World Tour', tag: '多站巡回', note: '全球规格最高的职业桨板巡回赛，涵盖长距离赛、冲刺赛及海浪赛，Connor Baxter、Michael Booth 等名将常年争冠。' },
    ],
  },
  {
    org: '亚洲',
    fullName: '亚太桨板赛事委员会',
    color: '#C0784A',
    items: [
      { name: '亚洲桨板锦标赛', tag: '年度', note: '亚太国家轮流承办，设精英组与业余组，是亚洲运动员对标国际水平的重要舞台。' },
      { name: '亚洲桨板公开赛', tag: '多站', note: '2025 年分别在浙江青田和四川青神举办，吸引 10+ 国家 845 名运动员参赛。' },
    ],
  },
];

// ── 组件 ──────────────────────────────────────────────────

function ChinaDiagram() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {CHINA_TIERS.map((tier, ti) => (
        <div key={ti}>
          {/* 连接箭头（第一层以下才有） */}
          {ti > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 28 }}>
              <div style={{ width: 1, height: 16, background: '#C0B4A4' }} />
              <div style={{ position: 'absolute', fontSize: 10, color: '#C0B4A4', marginTop: 10 }}>▼</div>
            </div>
          )}

          {/* 层级行 */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${tier.bg}22` }}>
            {/* 层级标签 */}
            <div style={{
              background: tier.bg,
              color: tier.text,
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: 11,
              letterSpacing: '0.1em',
              padding: '12px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 32,
              flexShrink: 0,
            }}>
              {tier.label}
            </div>

            {/* 赛事卡片 */}
            <div style={{ display: 'flex', flex: 1, gap: 1, background: '#EDE5D8' }}>
              {tier.items.map((item, ii) => {
                const key = `${ti}-${ii}`;
                const isHovered = hoveredItem === key;
                return (
                  <div
                    key={ii}
                    onMouseEnter={() => setHoveredItem(key)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      flex: 1,
                      background: isHovered ? '#FFF8F0' : '#FAF7F2',
                      padding: '12px 14px',
                      cursor: 'default',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13, color: '#2E2118', marginBottom: 4 }}>{item.name}</div>
                    <span style={{
                      fontSize: 10,
                      background: `${tier.bg}18`,
                      color: tier.bg === '#EDE5D8' ? '#7A6145' : tier.bg,
                      border: `1px solid ${tier.bg}40`,
                      borderRadius: 10,
                      padding: '1px 7px',
                    }}>{item.tag}</span>
                    {isHovered && item.note && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        background: '#2E2118',
                        color: '#FAF7F2',
                        fontSize: 12,
                        lineHeight: 1.6,
                        padding: '10px 12px',
                        borderRadius: 6,
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                      }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 12, textAlign: 'right' }}>
        * 悬停卡片查看详细说明
      </p>
    </div>
  );
}

function IntlDiagram() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {INTL_ORGS.map((org, oi) => (
          <div key={oi} style={{ border: '1px solid #EDE5D8', borderRadius: 8, overflow: 'hidden' }}>
            {/* 机构头部 */}
            <div style={{ background: org.color, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{org.org}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{org.fullName}</span>
              </div>
            </div>

            {/* 赛事列表 */}
            <div style={{ background: '#FAF7F2' }}>
              {org.items.map((item, ii) => {
                const key = `${oi}-${ii}`;
                const isHovered = hoveredItem === key;
                return (
                  <div
                    key={ii}
                    onMouseEnter={() => setHoveredItem(key)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      padding: '10px 14px',
                      borderTop: ii > 0 ? '1px solid #EDE5D8' : 'none',
                      background: isHovered ? '#FFF8F0' : 'transparent',
                      cursor: 'default',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13, color: '#2E2118', marginBottom: 3 }}>{item.name}</div>
                    <span style={{
                      fontSize: 10,
                      background: `${org.color}15`,
                      color: org.color,
                      border: `1px solid ${org.color}30`,
                      borderRadius: 10,
                      padding: '1px 7px',
                    }}>{item.tag}</span>
                    {isHovered && item.note && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        background: '#2E2118',
                        color: '#FAF7F2',
                        fontSize: 12,
                        lineHeight: 1.6,
                        padding: '10px 12px',
                        borderRadius: 6,
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                      }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 12, textAlign: 'right' }}>
        * 悬停卡片查看详细说明
      </p>
    </div>
  );
}

// ── 主组件（可折叠 + Tab 切换） ────────────────────────────

const TABS = [
  { key: 'china', label: '中国赛事体系' },
  { key: 'intl', label: '国际赛事体系' },
];

export default function ArticleGuideTabs({ articles: _ }: Props) {
  const [activeTab, setActiveTab] = useState<'china' | 'intl'>('china');
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: '#FEFCF9',
      border: '1px solid #EDE5D8',
      borderRadius: 12,
      marginBottom: 32,
      overflow: 'visible',
    }}>
      {/* 折叠头部 */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 20px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060' }}>
            赛事指南
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {TABS.map(t => (
              <span
                key={t.key}
                onClick={e => { e.stopPropagation(); setActiveTab(t.key as 'china' | 'intl'); setExpanded(true); }}
                style={{
                  fontSize: 12,
                  color: activeTab === t.key && expanded ? '#7A6145' : '#8A8078',
                  background: activeTab === t.key && expanded ? '#F0EAE0' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === t.key && expanded ? '#C8A87A' : '#EDE5D8',
                  borderRadius: 20,
                  padding: '2px 10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <span style={{
          fontSize: 13,
          color: '#A08060',
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▾</span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ borderTop: '1px solid #EDE5D8' }}>
          {/* Tab 切换栏 */}
          <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #EDE5D8' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as 'china' | 'intl')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid #7A6145' : '2px solid transparent',
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: activeTab === t.key ? 500 : 400,
                  color: activeTab === t.key ? '#2E2118' : '#8A8078',
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 图示内容 */}
          <div style={{ padding: '20px' }}>
            {activeTab === 'china' ? <ChinaDiagram /> : <IntlDiagram />}
          </div>
        </div>
      )}
    </div>
  );
}
