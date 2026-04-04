'use client';

import { useState } from 'react';

interface Article {
  article_id: number;
  title: string;
  summary: string | null;
  content: string | null;
}
interface Props { articles: Article[] }

// ── 数据 ──────────────────────────────────────────────────────

const CHINA_TIERS = [
  {
    id: 'national',
    label: '国家最高级',
    labelEn: 'National Elite',
    color: '#5E4A33',
    bg: '#7A6145',
    lightBg: '#F5EFE8',
    items: [
      {
        name: '全国桨板冠军赛',
        tag: '每年举办',
        host: '国家体育总局水上运动管理中心',
        detail: '国内桨板竞技最高荣誉赛事，每年举办一届。设精英组、公开组、大师组及青少年各年龄组（U9/U12/U15/U18）。精英组成绩可计入国家积分排名，是职业运动员晋升全国排名的核心赛事。2024年总决赛在苏州古城河举办，吸引全国573名运动员参赛。',
        highlight: '国内最高荣誉',
      },
      {
        name: '全国桨板锦标赛',
        tag: '每年举办',
        host: '国家体育总局水上运动管理中心',
        detail: '与冠军赛并列的全国性顶级赛事，更注重竞技技术的全面考察，涵盖长距离赛、技术赛等多个项目。2023年在重庆开州汉丰湖举办，汇聚全国300余支赛队近1400名运动员，创参赛人数历史纪录。',
        highlight: '参赛规模最大',
      },
    ],
  },
  {
    id: 'pro',
    label: '职业联赛',
    labelEn: 'Pro Circuit',
    color: '#6B4F30',
    bg: '#A08060',
    lightBg: '#F7F2EC',
    items: [
      {
        name: '中国桨板俱乐部联赛（CPL）',
        tag: '6–8站 / 年',
        host: '中国桨板协会',
        detail: '全年跨度最长、站点最多的大众赛事联赛，每年设6–8个分站，覆盖华东、华南、西南等地区。核心项目为6000米长距离赛和200米竞速赛，设公开组、大师组、卡胡纳组、高校组等多个组别，年参赛人数超过3000人次。年度总决赛通常在秋季举行，2025年总决赛在浙江云和举办。',
        highlight: '站点最多 · 全年巡回',
      },
      {
        name: '中国桨板公开赛',
        tag: '含国际认证',
        host: '地方体育局 / 承办公司',
        detail: '部分站点同时承办亚洲杯赛事，具备国际积分认证资格，是国内赛事对接ICF国际体系的重要窗口。2024年青田站引入ICF认证精英组别，吸引来自多个国家和地区的顶尖运动员参赛，成为国内赛事国际化的标志性节点。',
        highlight: '接轨 ICF 国际积分',
      },
    ],
  },
  {
    id: 'mass',
    label: '大众赛事',
    labelEn: 'Mass Events',
    color: '#7A5F3A',
    bg: '#C4A882',
    lightBg: '#FAF7F2',
    items: [
      {
        name: '全国全民健身大赛·桨板',
        tag: '国家体育总局指导',
        host: '各省体育局承办',
        detail: '2022年起正式纳入全国全民健身大赛赛事体系，面向大众健身群体，报名门槛低、组别设置灵活，是桨板运动走向大众化的重要标志。赛制设计鼓励家庭组合和团队参赛，是推动桨板普及的核心赛事之一。',
        highlight: '大众参与 · 零门槛',
      },
      {
        name: '中国百城桨板公开赛',
        tag: '各地分站',
        host: '各城市体育组织',
        detail: '以城市为单位在全国各地分站举办，辐射范围极广，是大众桨板爱好者最易参与的竞技平台。赛事通常与城市文旅活动结合，兼具竞技与推广功能，是桨板运动城市化推广的核心载体。',
        highlight: '全国覆盖 · 城市巡回',
      },
    ],
  },
  {
    id: 'local',
    label: '省市基层',
    labelEn: 'Regional & Local',
    color: '#5E4A33',
    bg: '#EDE5D8',
    lightBg: '#FEFCF9',
    textColor: '#5E4A33',
    items: [
      {
        name: '省级桨板锦标赛',
        tag: '各省水上协会',
        host: '广东 / 浙江 / 重庆 / 湖北等',
        detail: '全国冠军赛的选拔预备赛道，是省级队伍选拔和运动员积分排名的重要平台。广东、浙江、重庆、湖北等桨板运动强省均有完善的省级赛事体系，部分省级赛事奖励可授予运动员技术等级称号。',
        highlight: '全国冠军赛选拔通道',
      },
      {
        name: '城市公开赛',
        tag: '地方体育局',
        host: '各市体育局 / 社会赛事公司',
        detail: '各地自发举办，形式灵活多样，通常结合当地水域特色和文旅资源，是桨板运动大众推广的核心基层赛事。参赛群体广泛，包含专业运动员、爱好者和青少年，是发现基层运动员的重要途径。',
        highlight: '基层人才发现地',
      },
      {
        name: '嘉年华 / 体验赛',
        tag: '俱乐部 / 品牌活动',
        host: '桨板俱乐部 / 品牌方',
        detail: '以娱乐体验为主，通常由桨板品牌、俱乐部或旅游景区主办，适合零基础爱好者和家庭参与。是桨板运动新用户的重要入口，构成桨板运动最广泛的基层生态，推动运动人口的持续增长。',
        highlight: '新人入门首选',
      },
    ],
  },
];

const INTL_ORGS = [
  {
    id: 'icf',
    org: 'ICF',
    fullName: '国际皮划艇联合会',
    color: '#1A5276',
    lightBg: '#EBF5FB',
    founded: '1924年',
    scope: '竞速 · 技术',
    items: [
      {
        name: 'ICF 世界桨板锦标赛',
        tag: '两年一届',
        detail: '桨板竞速项目的国际最高荣誉，设200米冲刺、500米技术赛、长距离赛（12km+）等项目。由ICF主导的标准化计时和规则体系，成绩直接影响世界排名。中国队近年来持续取得突破，蒋磊、陈澄灏等运动员多次登上国际领奖台。',
        flag: '🏆',
      },
      {
        name: 'ICF 洲际锦标赛',
        tag: '年度',
        detail: '亚洲、欧洲、泛美洲分区举办，成绩计入ICF世界排名积分，是世锦赛的重要积分赛事。对于中国运动员而言，亚洲区赛事是获取ICF积分、参加世锦赛资格认定的重要通道。',
        flag: '🌏',
      },
    ],
  },
  {
    id: 'isa',
    org: 'ISA',
    fullName: '国际冲浪协会',
    color: '#0E6655',
    lightBg: '#E9F7EF',
    founded: '1964年',
    scope: '冲浪 · 综合',
    items: [
      {
        name: 'ISA 世界立式桨板锦标赛',
        tag: '年度',
        detail: '由ISA主办，侧重冲浪SUP及海浪环境下的综合赛项，对运动员的平衡感和浪况适应能力要求极高。与ICF共同形成国际桨板的两大权威管理体系，代表了桨板运动起源于冲浪文化的一脉。',
        flag: '🌊',
      },
      {
        name: 'ISA 青少年世界锦标赛',
        tag: '年度',
        detail: '专为青少年运动员设立，设多个年龄组别，是青少年运动员走向世界舞台的重要跳板，也是各国发掘下一代桨板明星的核心赛事。',
        flag: '⭐',
      },
    ],
  },
  {
    id: 'app',
    org: 'APP',
    fullName: '冒险桨板职业巡回赛',
    color: '#6C3483',
    lightBg: '#F4ECF7',
    founded: '2015年',
    scope: '职业巡回',
    items: [
      {
        name: 'APP World Tour',
        tag: '多站全球巡回',
        detail: '全球规格最高的职业桨板巡回赛，每年在夏威夷、法国、英国、摩纳哥等地设多个分站，涵盖长距离赛、冲刺赛及海浪赛。世界顶尖职业选手Connor Baxter、Michael Booth、Noic Garioud等长年角逐年度总冠军。赛事奖金丰厚，是职业运动员商业价值最高的舞台。',
        flag: '🌍',
      },
      {
        name: 'APP Challenge 精英邀请赛',
        tag: '邀请制',
        detail: '面向精英运动员的邀请赛系列，以高强度、高对抗的比赛格式吸引全球顶尖运动员参与，是APP生态中最具观赏性和话题性的赛事。',
        flag: '🎯',
      },
    ],
  },
  {
    id: 'asia',
    org: 'Asia',
    fullName: '亚太桨板赛事',
    color: '#B7470A',
    lightBg: '#FDF2E9',
    founded: '2018年',
    scope: '亚太区域',
    items: [
      {
        name: '亚洲桨板锦标赛',
        tag: '年度',
        detail: '亚太国家和地区轮流承办，设精英组与业余组，是亚洲运动员对标国际水平、争夺亚洲冠军头衔的最高舞台。中国、日本、澳大利亚为主要争金大国，近年来中国队竞争力大幅提升。',
        flag: '🏅',
      },
      {
        name: '亚洲桨板公开赛',
        tag: '多站',
        detail: '2025年分别在浙江青田（7月）和四川青神（10月）举办，吸引来自亚洲10余个国家和地区共845名运动员参赛，是目前亚洲参赛规模最大的桨板赛事系列之一，也是中国承办国际赛事能力的重要体现。',
        flag: '🌏',
      },
    ],
  },
];

// ── 中国体系图 ─────────────────────────────────────────────

function ChinaDiagram() {
  const [selected, setSelected] = useState<{ tier: number; item: number } | null>(null);

  const selectedItem = selected !== null
    ? CHINA_TIERS[selected.tier].items[selected.item]
    : null;
  const selectedTier = selected !== null ? CHINA_TIERS[selected.tier] : null;

  return (
    <div>
      {/* 金字塔图 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {CHINA_TIERS.map((tier, ti) => {
          const isTextDark = tier.id === 'local';
          return (
            <div key={tier.id}>
              {/* 层级行 */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 8, overflow: 'hidden', border: '1px solid #EDE5D8' }}>
                {/* 左侧层级标签 */}
                <div style={{
                  background: tier.bg,
                  color: isTextDark ? '#5E4A33' : '#fff',
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
                }}>
                  <span style={{ writingMode: 'vertical-rl', fontWeight: 600, fontSize: 11 }}>{tier.label}</span>
                  <span style={{ writingMode: 'vertical-rl', fontSize: 9, opacity: 0.7 }}>{tier.labelEn}</span>
                </div>

                {/* 赛事卡片区 */}
                <div style={{ display: 'flex', flex: 1, gap: 2, padding: 4, background: tier.lightBg }}>
                  {tier.items.map((item, ii) => {
                    const isActive = selected?.tier === ti && selected?.item === ii;
                    return (
                      <button
                        key={ii}
                        onClick={() => setSelected(isActive ? null : { tier: ti, item: ii })}
                        style={{
                          flex: 1,
                          background: isActive ? tier.bg : '#fff',
                          border: `1.5px solid ${isActive ? tier.bg : '#EDE5D8'}`,
                          borderRadius: 6,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: isActive ? '#fff' : '#2E2118', lineHeight: 1.3 }}>
                            {item.name}
                          </span>
                          <span style={{
                            fontSize: 10,
                            background: isActive ? 'rgba(255,255,255,0.25)' : `${tier.bg}18`,
                            color: isActive ? '#fff' : tier.bg === '#EDE5D8' ? '#7A6145' : tier.bg,
                            border: `1px solid ${isActive ? 'rgba(255,255,255,0.4)' : tier.bg + '30'}`,
                            borderRadius: 10,
                            padding: '1px 7px',
                            flexShrink: 0,
                            marginLeft: 6,
                            whiteSpace: 'nowrap',
                          }}>{item.tag}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: isActive ? 'rgba(255,255,255,0.75)' : '#A08060' }}>
                            🏛 {item.host}
                          </span>
                        </div>
                        <div style={{ marginTop: 5 }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: isActive ? '#FFE4B0' : tier.bg,
                            background: isActive ? 'rgba(255,255,255,0.15)' : `${tier.bg}12`,
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}>✦ {item.highlight}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 向下箭头 */}
              {ti < CHINA_TIERS.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 18, position: 'relative' }}>
                  <div style={{ width: 1, height: '100%', background: '#C0B4A4' }} />
                  <span style={{ position: 'absolute', bottom: -2, fontSize: 9, color: '#C0B4A4', lineHeight: 1 }}>▼</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 详情面板 */}
      {selectedItem && selectedTier && (
        <div style={{
          marginTop: 16,
          padding: '16px 18px',
          background: selectedTier.lightBg,
          border: `1.5px solid ${selectedTier.bg}40`,
          borderLeft: `4px solid ${selectedTier.bg}`,
          borderRadius: 8,
          position: 'relative',
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#A08060', lineHeight: 1 }}
          >×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2E2118' }}>{selectedItem.name}</span>
            <span style={{ fontSize: 11, color: selectedTier.bg === '#EDE5D8' ? '#7A6145' : selectedTier.bg, fontWeight: 500 }}>
              {selectedTier.label}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#3D3730', lineHeight: 1.8, margin: 0 }}>{selectedItem.detail}</p>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 10, textAlign: 'right' }}>点击卡片查看详细说明</p>
    </div>
  );
}

// ── 国际体系图 ─────────────────────────────────────────────

function IntlDiagram() {
  const [selected, setSelected] = useState<{ org: number; item: number } | null>(null);

  const selectedItem = selected !== null ? INTL_ORGS[selected.org].items[selected.item] : null;
  const selectedOrg = selected !== null ? INTL_ORGS[selected.org] : null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {INTL_ORGS.map((org, oi) => (
          <div key={org.id} style={{ border: '1px solid #EDE5D8', borderRadius: 10, overflow: 'hidden' }}>
            {/* 机构头 */}
            <div style={{ background: org.color, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {org.org}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{org.fullName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>成立 {org.founded}</div>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>{org.scope}</span>
                </div>
              </div>
            </div>

            {/* 赛事列表 */}
            <div style={{ background: org.lightBg }}>
              {org.items.map((item, ii) => {
                const isActive = selected?.org === oi && selected?.item === ii;
                return (
                  <button
                    key={ii}
                    onClick={() => setSelected(isActive ? null : { org: oi, item: ii })}
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
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 详情面板 */}
      {selectedItem && selectedOrg && (
        <div style={{
          marginTop: 14,
          padding: '16px 18px',
          background: selectedOrg.lightBg,
          border: `1.5px solid ${selectedOrg.color}40`,
          borderLeft: `4px solid ${selectedOrg.color}`,
          borderRadius: 8,
          position: 'relative',
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#A08060', lineHeight: 1 }}
          >×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>{selectedItem.flag}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2E2118' }}>{selectedItem.name}</span>
            <span style={{ fontSize: 11, color: selectedOrg.color, fontWeight: 600 }}>{selectedOrg.org}</span>
          </div>
          <p style={{ fontSize: 13, color: '#3D3730', lineHeight: 1.8, margin: 0 }}>{selectedItem.detail}</p>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#C0B4A4', marginTop: 10, textAlign: 'right' }}>点击卡片查看详细说明</p>
    </div>
  );
}

// ── 主组件 ─────────────────────────────────────────────────

const TABS = [
  { key: 'china', label: '中国赛事体系' },
  { key: 'intl', label: '国际赛事体系' },
];

export default function ArticleGuideTabs({ articles: _ }: Props) {
  const [activeTab, setActiveTab] = useState<'china' | 'intl'>('china');
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 12, marginBottom: 32 }}>
      {/* 折叠头部 */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A08060' }}>赛事指南</span>
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
              >{t.label}</span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: '#A08060', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ borderTop: '1px solid #EDE5D8' }}>
          <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #EDE5D8' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as 'china' | 'intl')}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid #7A6145' : '2px solid transparent',
                  padding: '10px 16px', fontSize: 13,
                  fontWeight: activeTab === t.key ? 500 : 400,
                  color: activeTab === t.key ? '#2E2118' : '#8A8078',
                  cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s', marginBottom: -1,
                }}
              >{t.label}</button>
            ))}
          </div>
          <div style={{ padding: '20px' }}>
            {activeTab === 'china' ? <ChinaDiagram /> : <IntlDiagram />}
          </div>
        </div>
      )}
    </div>
  );
}
