'use client';

import { useState } from 'react';

interface Article { article_id: number; title: string; summary: string | null; content: string | null }
interface Props { articles: Article[] }

// ── 数据 ──────────────────────────────────────────────────────

const CHINA_TIERS = [
  {
    id: 'national',
    label: '国家最高级',
    labelEn: 'National Elite',
    bg: '#7A6145',
    lightBg: '#F5EFE8',
    items: [
      {
        name: '全国桨板冠军赛',
        tag: '每年举办',
        host: '国家体育总局水上运动管理中心',
        highlight: '国内最高荣誉',
        detail: '国内桨板竞技最高荣誉赛事，每年举办一届。设精英组、公开组、大师组及青少年各年龄组——U9（9岁以下）、U12（12岁以下）、U15（15岁以下）、U18（18岁以下）。精英组成绩可计入国家积分排名，是职业运动员晋升全国排名的核心赛事。2024年总决赛在苏州古城河举办，吸引全国573名运动员参赛。',
      },
      {
        name: '全国桨板锦标赛',
        tag: '每年举办',
        host: '国家体育总局水上运动管理中心',
        highlight: '参赛规模最大',
        detail: '与冠军赛并列的全国性顶级赛事，涵盖长距离赛、技术赛等多个项目，更注重竞技技术的全面考察。2023年在重庆开州汉丰湖举办，汇聚全国300余支赛队近1400名运动员，创下参赛人数历史纪录。',
      },
    ],
  },
  {
    id: 'pro',
    label: '职业联赛',
    labelEn: 'Pro Circuit',
    bg: '#A08060',
    lightBg: '#F7F2EC',
    items: [
      {
        name: '中国桨板俱乐部联赛（CPL）',
        nameEn: 'China Paddle League',
        tag: '6–8站 / 年',
        host: '中国桨板协会',
        highlight: '站点最多 · 全年巡回',
        detail: '全年跨度最长、站点最多的大众赛事联赛，每年设 6–8 个分站，覆盖华东、华南、西南等地区。核心项目为 6000 米长距离赛和 200 米竞速赛，设公开组、大师组、卡胡纳组（大体型选手）、高校组等，年参赛人次超过 3000。年度总决赛通常在秋季举行，2025年总决赛在浙江云和举办。',
      },
      {
        name: '中国桨板公开赛',
        tag: '含国际认证',
        host: '地方体育局 / 承办公司',
        highlight: '接轨 ICF（国际皮划艇联合会）积分',
        detail: '部分站点同时承办亚洲杯赛事，具备国际积分认证资格，是国内赛事对接 ICF 国际体系的重要窗口。2024 年青田站引入 ICF 认证精英组别，吸引来自多个国家的顶尖运动员参赛，是国内赛事国际化的标志性节点。',
      },
    ],
  },
  {
    id: 'mass',
    label: '大众赛事',
    labelEn: 'Mass Events',
    bg: '#C4A882',
    lightBg: '#FAF7F2',
    items: [
      {
        name: '全国全民健身大赛·桨板',
        tag: '国家体育总局指导',
        host: '各省体育局承办',
        highlight: '大众参与 · 零门槛',
        detail: '2022 年起正式纳入全国全民健身大赛体系，面向大众健身群体，报名门槛低、组别设置灵活，赛制鼓励家庭组合和团队参赛。是桨板运动走向大众化的重要政策标志，也是推动桨板普及的核心赛事之一。',
      },
      {
        name: '中国百城桨板公开赛',
        tag: '各地分站',
        host: '各城市体育组织',
        highlight: '全国覆盖 · 城市巡回',
        detail: '以城市为单位在全国各地分站举办，辐射范围极广，通常与城市文旅活动结合，兼具竞技与推广功能。是大众桨板爱好者最易参与的竞技平台，也是桨板运动城市化推广的核心载体。',
      },
    ],
  },
  {
    id: 'local',
    label: '省市基层',
    labelEn: 'Regional & Local',
    bg: '#B8A898',
    lightBg: '#FEFCF9',
    items: [
      {
        name: '省级桨板锦标赛',
        tag: '各省水上协会',
        host: '广东 / 浙江 / 重庆 / 湖北等',
        highlight: '冠军赛选拔通道',
        detail: '全国冠军赛的选拔预备赛道，是省级队伍选拔和运动员积分排名的重要平台。广东、浙江、重庆、湖北等桨板运动强省均有完善的省级赛事体系，部分省级赛事可授予运动员"国家二级运动员"技术等级称号。',
      },
      {
        name: '城市公开赛',
        tag: '地方体育局',
        host: '各市体育局 / 赛事公司',
        highlight: '基层人才发现地',
        detail: '各地自发举办，形式灵活，通常结合当地水域特色和文旅资源。参赛群体广泛，包含专业运动员、爱好者和青少年，既是日常训练成果的检验场，也是发现基层运动员的重要途径。',
      },
      {
        name: '嘉年华 / 体验赛',
        tag: '俱乐部 / 品牌活动',
        host: '桨板俱乐部 / 品牌方',
        highlight: '新人入门首选',
        detail: '以娱乐体验为主，由桨板品牌、俱乐部或旅游景区主办，适合零基础爱好者和家庭参与，无需专业装备和技术基础。是桨板运动新用户的重要入口，构成桨板运动最广泛的基层生态。',
      },
    ],
  },
];

const INTL_ORGS = [
  {
    id: 'icf', org: 'ICF', fullName: '国际皮划艇联合会', fullNameEn: 'International Canoe Federation', color: '#1A5276', lightBg: '#EBF5FB', founded: '1924', scope: '竞速 · 技术',
    items: [
      { name: 'ICF 世界桨板锦标赛', tag: '两年一届', flag: '🏆', detail: '桨板竞速项目的国际最高荣誉，设 200 米冲刺、500 米技术赛、长距离赛（12 km+）等项目，成绩直接影响 ICF 世界排名。中国队近年来持续取得突破，蒋磊、陈澄灏等运动员多次登上国际领奖台。' },
      { name: 'ICF 洲际锦标赛', tag: '年度', flag: '🌏', detail: '亚洲、欧洲、泛美洲分区举办，积分计入 ICF 世界排名。对中国运动员而言，亚洲区赛事是获取 ICF 积分、争取世锦赛参赛资格的重要通道。' },
    ],
  },
  {
    id: 'isa', org: 'ISA', fullName: '国际冲浪协会', fullNameEn: 'International Surfing Association', color: '#0E6655', lightBg: '#E9F7EF', founded: '1964', scope: '冲浪 · 综合',
    items: [
      { name: 'ISA 世界立式桨板锦标赛', tag: '年度', flag: '🌊', detail: '侧重冲浪 SUP 及海浪环境下的综合赛项，对运动员的平衡感和浪况适应能力要求极高。与 ICF 共同形成国际桨板的两大权威管理体系，代表了桨板运动起源于冲浪文化的一脉。' },
      { name: 'ISA 青少年世界锦标赛', tag: '年度', flag: '⭐', detail: '专为青少年运动员设立，设多个年龄组别（对应 U14/U16/U18 等）。是青少年运动员走向世界舞台的重要跳板，也是各国发掘下一代桨板明星的核心赛事。' },
    ],
  },
  {
    id: 'app', org: 'APP', fullName: '冒险桨板职业巡回赛', fullNameEn: 'Adventure Paddle Professionals', color: '#6C3483', lightBg: '#F4ECF7', founded: '2015', scope: '职业巡回',
    items: [
      { name: 'APP World Tour', tag: '多站全球巡回', flag: '🌍', detail: '全球规格最高的职业桨板巡回赛，每年在夏威夷、法国、英国、摩纳哥等地设多站，涵盖长距离赛、冲刺赛及海浪赛，奖金丰厚。Connor Baxter、Michael Booth、Noic Garioud 等世界名将长年角逐年度总冠军。' },
      { name: 'APP Challenge 精英邀请赛', tag: '邀请制', flag: '🎯', detail: '面向精英运动员的邀请制赛事，赛制紧凑激烈，是 APP 生态中观赏性和话题性最强的比赛，也是顶尖运动员获得曝光度和赞助商青睐的核心舞台。' },
    ],
  },
  {
    id: 'asia', org: 'Asia', fullName: '亚太桨板赛事', fullNameEn: 'Asia Paddle Championship', color: '#B7470A', lightBg: '#FDF2E9', founded: '2018', scope: '亚太区域',
    items: [
      { name: '亚洲桨板锦标赛', tag: '年度', flag: '🏅', detail: '亚太国家和地区轮流承办，设精英组与业余组，是亚洲运动员争夺亚洲冠军头衔的最高舞台。中国、日本、澳大利亚为主要争金大国，近年来中国队竞争力大幅提升。' },
      { name: '亚洲桨板公开赛', tag: '多站', flag: '🌏', detail: '2025 年分别在浙江青田（7月）和四川青神（10月）举办，吸引来自亚洲 10余个国家和地区共 845 名运动员参赛，是目前亚洲参赛规模最大的桨板赛事系列之一。' },
    ],
  },
];

// ── 气泡组件 ──────────────────────────────────────────────

function Popover({ text, color, onClose }: { text: string; color: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 280,
        background: '#1A1209',
        color: '#FAF7F2',
        fontSize: 12.5,
        lineHeight: 1.75,
        padding: '13px 14px',
        borderRadius: 8,
        zIndex: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        pointerEvents: 'none',
      }}
    >
      {/* 顶部色条 */}
      <div style={{ height: 3, background: color, borderRadius: 2, marginBottom: 9 }} />
      {text}
      {/* 下箭头 */}
      <div style={{
        position: 'absolute',
        bottom: -7,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: '7px solid #1A1209',
      }} />
    </div>
  );
}

// ── 中国体系图 ─────────────────────────────────────────────

function ChinaDiagram() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CHINA_TIERS.map((tier, ti) => (
          <div key={tier.id}>
            {ti > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', height: 18 }}>
                <div style={{ width: 1, height: 12, background: '#C0B4A4', marginTop: 3 }} />
                <span style={{ position: 'absolute', marginTop: 11, fontSize: 8, color: '#C0B4A4' }}>▼</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 8, border: '1px solid #EDE5D8' }}>
              {/* 层级标签 */}
              <div style={{
                background: tier.bg,
                color: '#fff',
                fontSize: 10,
                letterSpacing: '0.06em',
                padding: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minWidth: 44,
                flexShrink: 0,
                borderRadius: '7px 0 0 7px',
              }}>
                <span style={{ writingMode: 'vertical-rl', fontWeight: 600, fontSize: 11 }}>{tier.label}</span>
                <span style={{ writingMode: 'vertical-rl', fontSize: 9, opacity: 0.7 }}>{tier.labelEn}</span>
              </div>

              {/* 卡片区 */}
              <div style={{ display: 'flex', flex: 1, gap: 3, padding: 4, background: tier.lightBg, borderRadius: '0 7px 7px 0' }}>
                {tier.items.map((item, ii) => {
                  const key = `${tier.id}-${ii}`;
                  const isActive = active === key;
                  return (
                    <div
                      key={ii}
                      style={{ flex: 1, position: 'relative' }}
                    >
                      <button
                        onClick={() => setActive(isActive ? null : key)}
                        style={{
                          width: '100%',
                          background: isActive ? tier.bg : '#FEFCF9',
                          border: `1.5px solid ${isActive ? tier.bg : '#E8E0D4'}`,
                          borderRadius: 6,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? '#fff' : '#2E2118', marginBottom: 2, lineHeight: 1.35 }}>
                          {item.name}
                        </div>
                        {(item as typeof item & { nameEn?: string }).nameEn && (
                          <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.7)' : '#8A8078', fontStyle: 'italic', marginBottom: 3 }}>
                            {(item as typeof item & { nameEn?: string }).nameEn}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.7)' : '#A08060', marginBottom: 5 }}>
                          🏛 {item.host}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 10,
                            background: isActive ? 'rgba(255,255,255,0.2)' : `${tier.bg}18`,
                            color: isActive ? '#fff' : tier.bg,
                            border: `1px solid ${isActive ? 'rgba(255,255,255,0.35)' : tier.bg + '35'}`,
                            borderRadius: 10,
                            padding: '1px 7px',
                          }}>{item.tag}</span>
                          <span style={{
                            fontSize: 10,
                            background: isActive ? 'rgba(255,255,255,0.15)' : '#F0EAE0',
                            color: isActive ? '#FFE4B0' : '#7A6145',
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontWeight: 600,
                          }}>✦ {item.highlight}</span>
                        </div>
                      </button>

                      {/* 悬浮气泡 */}
                      {isActive && (
                        <Popover text={item.detail} color={tier.bg} onClose={() => setActive(null)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 8, textAlign: 'right' }}>点击卡片查看详细说明</p>
    </div>
  );
}

// ── 国际体系图 ─────────────────────────────────────────────

function IntlDiagram() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {INTL_ORGS.map((org, oi) => (
          <div key={org.id} style={{ border: '1px solid #EDE5D8', borderRadius: 10 }}>
            {/* 机构头 */}
            <div style={{ background: org.color, padding: '12px 14px', borderRadius: '9px 9px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1 }}>{org.org}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: 500 }}>{org.fullName}</div>
                  {(org as typeof org & { fullNameEn?: string }).fullNameEn && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1, fontStyle: 'italic' }}>
                      {(org as typeof org & { fullNameEn?: string }).fullNameEn}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>成立 {org.founded} 年</div>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>{org.scope}</span>
                </div>
              </div>
            </div>

            {/* 赛事列表 */}
            <div style={{ background: org.lightBg, borderRadius: '0 0 9px 9px' }}>
              {org.items.map((item, ii) => {
                const key = `${org.id}-${ii}`;
                const isActive = active === key;
                return (
                  <div key={ii} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setActive(isActive ? null : key)}
                      style={{
                        width: '100%',
                        display: 'block',
                        padding: '10px 14px',
                        borderTop: ii > 0 ? '1px solid #EDE5D8' : 'none',
                        background: isActive ? org.color : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s',
                        borderRadius: ii === org.items.length - 1 ? '0 0 8px 8px' : 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 14 }}>{item.flag}</span>
                        <span style={{ fontWeight: 600, fontSize: 12, color: isActive ? '#fff' : '#2E2118', lineHeight: 1.3 }}>{item.name}</span>
                      </div>
                      <span style={{
                        fontSize: 10,
                        background: isActive ? 'rgba(255,255,255,0.25)' : `${org.color}18`,
                        color: isActive ? '#fff' : org.color,
                        border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : org.color + '30'}`,
                        borderRadius: 10,
                        padding: '1px 7px',
                      }}>{item.tag}</span>
                    </button>

                    {/* 悬浮气泡 */}
                    {isActive && (
                      <Popover text={item.detail} color={org.color} onClose={() => setActive(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 10, textAlign: 'right' }}>点击卡片查看详细说明</p>
    </div>
  );
}

// ── Markdown 简易渲染 ──────────────────────────────────────

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];
  let inTable = false;

  function flushTable(key: string) {
    if (tableHeader.length === 0) return;
    elements.push(
      <div key={key} style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {tableHeader.map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #D5CBBC', color: '#5A4A3A', fontWeight: 600, background: '#F5EFE8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '7px 12px', borderBottom: '1px solid #EDE5D8', color: '#4A3F35', lineHeight: 1.6 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = [];
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 表格行
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      if (!inTable) {
        tableHeader = cells;
        inTable = true;
        continue;
      }
      // 分隔行
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      tableRows.push(cells);
      continue;
    }

    if (inTable) { flushTable(`table-${i}`); inTable = false; }

    if (!trimmed) { elements.push(<div key={i} style={{ height: 10 }} />); continue; }
    if (trimmed === '---') { elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #EDE5D8', margin: '20px 0' }} />); continue; }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 18, fontWeight: 700, color: '#2E2118', margin: '28px 0 12px', fontFamily: 'var(--font-display)' }}>{trimmed.slice(3)}</h2>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 600, color: '#4A3F35', margin: '20px 0 8px' }}>{trimmed.slice(4)}</h3>);
      continue;
    }
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: '3px solid #C4A882', paddingLeft: 14, margin: '12px 0', color: '#6B5D4F', fontSize: 13, lineHeight: 1.7 }}>
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }
    if (trimmed.startsWith('- ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4, margin: '4px 0', fontSize: 13.5, color: '#3A3028', lineHeight: 1.7 }}>
          <span style={{ color: '#C4A882', flexShrink: 0 }}>•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }
    elements.push(<p key={i} style={{ fontSize: 13.5, color: '#3A3028', lineHeight: 1.8, margin: '6px 0' }}>{renderInline(trimmed)}</p>);
  }

  if (inTable) flushTable('table-end');

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={key++} style={{ fontWeight: 600, color: '#2E2118' }}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ── 主组件 ─────────────────────────────────────────────────

const BUILT_IN_TABS = [
  { key: 'china', label: '中国赛事体系' },
  { key: 'intl', label: '国际赛事体系' },
];

export default function ArticleGuideTabs({ articles }: Props) {
  const [activeTab, setActiveTab] = useState('china');
  const [expanded, setExpanded] = useState(false);

  // 数据库文章作为额外 tab
  const articleTabs = articles
    .filter(a => a.title !== '中国桨板赛事体系' && a.title !== '国际桨板赛事体系')
    .map(a => ({ key: `article-${a.article_id}`, label: a.title, content: a.content }));

  const allTabs = [...BUILT_IN_TABS, ...articleTabs];

  return (
    <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12, marginBottom: 32 }}>
      {/* 折叠头部 */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060' }}>赛事指南</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allTabs.map(t => (
              <span
                key={t.key}
                onClick={e => { e.stopPropagation(); setActiveTab(t.key); setExpanded(true); }}
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
              >{t.label}</span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: '#A08060', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ borderTop: '1px solid #EDE5D8' }}>
          <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #EDE5D8', overflowX: 'auto' }}>
            {allTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid #7A6145' : '2px solid transparent',
                  padding: '10px 16px', fontSize: 13,
                  fontWeight: activeTab === t.key ? 500 : 400,
                  color: activeTab === t.key ? '#2E2118' : '#8A8078',
                  cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
                  whiteSpace: 'nowrap',
                }}
              >{t.label}</button>
            ))}
          </div>
          <div style={{ padding: '20px', overflowX: 'visible' }}>
            {activeTab === 'china' && <ChinaDiagram />}
            {activeTab === 'intl' && <IntlDiagram />}
            {articleTabs.map(t => activeTab === t.key && t.content && (
              <SimpleMarkdown key={t.key} content={t.content} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
