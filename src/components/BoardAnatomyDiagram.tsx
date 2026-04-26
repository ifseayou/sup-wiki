'use client';

/**
 * 桨板 3 视图交互式解剖图（仿 MuscleDiagram）。
 * 3 视图：顶视 / 侧视 / 底视，各自独立 viewBox 与 hotspot 数据。
 * 支持 ?debug=parts URL 参数，所有 hotspot 半透明可见，便于坐标校准。
 */

import React, { useEffect, useState } from 'react';

const BOARD_ANATOMY_ANCHOR_ID = 'sup-board-anatomy';

interface BoardPart {
  id: string;
  name: string;
  nameEn?: string;
  color: string;
  points: string;              // SVG polygon points；多个区域用 `;` 分隔
  description: string;         // 部件功能（1-2 句）
  material?: string;           // 材质 / 工艺
  tip?: string;                // 使用或选购小贴士
}

interface ViewDef {
  key: 'top' | 'side' | 'bottom';
  label: string;
  url: string;
  w: number;
  h: number;
  parts: BoardPart[];
}

// OSS 上传后的 3 视图底图（MOLOKAI HERO AIR 14'×24" 为例）
const TOP_URL    = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776702774508-board-top.jpg';
const SIDE_URL   = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776702774508-board-side.jpg';
const BOTTOM_URL = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776702774508-board-bottom.jpg';

/**
 * 顶视坐标基于 3731×981 原图，以 display 2576×677 预览乘 1.45 倍反推。
 * 约定：左侧为板尾（含气嘴），右侧为板鼻（含弹力绳货网）。
 * 只定位有"功能/结构"含义的部件，不标注品牌印 / logo。
 */
// 坐标直接基于原图 3731×981 像素级校准：板体左边缘 x=200、右边缘 x=3599。
//   tail       svg_x 205-330    (窄尾尖，不含气嘴)
//   valve      svg_x 335-435    (板尾内的圆形气嘴)
//   back-mpf   svg_x 440-900    (蓝色泪珠形后踏板 / 跪姿垫)
//   carbon     svg_x 985-1100   (仅左侧一条黄色纵向碳纤加强带)
//   center-mpf svg_x 1100-1790  (灰色钻石纹主踏板)
//   bungee     svg_x 1800-2200  (X 形弹力绳 + 4 D 环)
//   nose       svg_x 3400-3580  (板鼻尖，逐渐收窄)
const TOP_PARTS: BoardPart[] = [
  { id: 'tail', name: '板尾', nameEn: 'Tail', color: '#7F8C8D',
    points: '205,420 330,345 330,655 205,605',
    description: '板子最后端，通常略尖便于切水，部分板型平直便于站 T-step。',
    material: 'PVC 包边 + Drop-Stitch 核心',
    tip: '竞速板尾平直；冲浪板削成圆 / 钻石形。' },
  { id: 'valve', name: '气嘴', nameEn: 'Air Valve', color: '#2C3E50',
    points: '340,420 435,395 435,595 340,580',
    description: '充 / 放气的接口，旋压型（H3）最常见。',
    material: '铜阀芯 + PVC 防尘盖',
    tip: '打气前务必确认阀芯在"关闭"位（凸起），不然打不进气还漏气。' },
  { id: 'back-mpf', name: '后踏板（MPF）', nameEn: 'Back Deck Pad', color: '#1ABC9C',
    points: '440,340 900,285 900,730 440,670',
    description: '后脚的落脚区，划行时后脚踩在此处锚定重心。做 T-step / 外轴转时也是后脚的起始位。',
    material: 'EVA 高弹泡棉 + 钻石纹压花',
    tip: '后脚踩板尾时必须有足够摩擦，无贴纹板脚就打滑。' },
  { id: 'carbon', name: '碳纤增强侧条', nameEn: 'Carbon Rail', color: '#F4D03F',
    points: '985,260 1095,250 1100,760 990,755',
    description: '板体一条黄色纵向加强带，大幅提升板身抗扭曲形变能力。',
    material: '碳纤维 + 高加强拉丝',
    tip: '无此加强的低端板遇风浪会明显"扭麻花"，竞速 / 巡航板必配。' },
  { id: 'center-mpf', name: '主踏板（黑色 MPF）', nameEn: 'Main Deck Pad', color: '#16A085',
    points: '1105,240 1790,225 1795,780 1110,770',
    description: '板正中央大块黑色钻石纹踏板，是站立时双脚主要落点，也是所有进阶动作的重心区。',
    material: 'EVA 高弹泡棉 + 钻石纹（10 mm 厚）',
    tip: '8 mm 以上厚度长途不震膝，入门 5 mm 足够。' },
  { id: 'bungee', name: '前部弹力绳货网（含 4 个 D 环）', nameEn: 'Bungee Cargo Net & D-Rings', color: '#3498DB',
    points: '2190,310 2570,340 2570,685 2190,715',
    description: '把干包 / 水壶 / 防晒衣捆在前部的 X 形松紧网绳，四角由 D 环固定。走船巡航必用。',
    material: '高强度尼龙弹力绳 + 4 个注塑 PE D 环',
    tip: '顶牌 D 环可承受 50 kg 拉力不脱；行进中重物应绑在货网中间避免偏重。' },
  { id: 'nose', name: '板鼻', nameEn: 'Nose', color: '#E67E22',
    points: '3340,395 3520,470 3520,545 3340,625',
    description: '板子最前端，破水与迎浪的关键。充气板板鼻微翘 5-8 cm 防止扎水。',
    material: 'PVC 包边 + Drop-Stitch 核心',
    tip: '冲浪板鼻削得更翘、竞速板鼻更尖锐低矮。' },
];

const SIDE_PARTS: BoardPart[] = [
  { id: 'tail-rocker', name: '尾翘度', nameEn: 'Tail Rocker', color: '#E67E22',
    points: '180,390 450,410 450,560 180,580',
    description: '板尾的微微上翘曲线，影响转向灵活度。',
    material: 'PVC + Drop-Stitch 核心',
    tip: '尾翘越大越易转向但直线速度掉；竞速板尾几乎水平。' },
  { id: 'fin', name: '尾鳍', nameEn: 'Main Fin', color: '#3498DB',
    points: '220,580 470,590 460,840 260,850',
    description: '板底突出的"舵"，防止板身侧滑、提供直线稳定。',
    material: '玻纤 / 碳纤维 / 软橡胶',
    tip: '鳍深 5-8 cm 全能、10+ cm 竞速、3-5 cm 浅水河流。' },
  { id: 'thickness', name: '板厚', nameEn: 'Thickness', color: '#16A085',
    points: '1000,440 1300,430 1300,530 1000,540',
    description: '板身厚度决定漂浮力（体积 = 长 × 宽 × 厚）。',
    material: 'Drop-Stitch 拉丝长度决定厚度',
    tip: '6" 厚入门全能；5" 瑜伽 / 冲浪；4.7" 河流 whitewater。' },
  { id: 'side-logo', name: '品牌贴', nameEn: 'Brand Label', color: '#9B59B6',
    points: '280,420 800,410 800,510 280,510',
    description: '品牌 / 型号印刷位，辨识度功能。',
    material: 'UV 印刷 / 热转印',
    tip: '二手板认准品牌贴完整度判断使用强度。' },
  { id: 'side-handle', name: '中心提手凸起', nameEn: 'Center Handle Bump', color: '#E74C3C',
    points: '1740,400 1920,390 1930,440 1750,450',
    description: '顶视的中心提手在侧视呈现的黑色凸起。',
    material: '尼龙带 + 泡棉' },
  { id: 'nose-rocker', name: '鼻翘度', nameEn: 'Nose Rocker', color: '#C0392B',
    points: '3380,390 3550,410 3550,560 3380,570',
    description: '板鼻的上翘曲线，决定迎浪与破风能力。',
    material: 'PVC + Drop-Stitch 核心',
    tip: '冲浪板鼻翘明显 > 全能 > 竞速。' },
  { id: 'spec-label', name: '型号标', nameEn: 'Size Spec', color: '#2C3E50',
    points: '2400,410 3250,410 3250,500 2400,500',
    description: '标注板子长 × 宽，买板第一眼要看。',
    tip: '14\' × 24" = 长 14 英尺（约 4.27 m）× 宽 24 寸（约 61 cm）。' },
];

const BOTTOM_PARTS: BoardPart[] = [
  { id: 'fin-box', name: '中鳍盒（US-Box）', nameEn: 'US-Box Fin Slot', color: '#3498DB',
    points: '380,455 590,450 590,535 380,540',
    description: '单鳍插槽，业内通用 US-Box 标准，兼容绝大多数品牌尾鳍。',
    material: '强化塑料螺栓固定槽',
    tip: '买尾鳍先看鳍盒制式：US-Box 通用 / FCS 冲浪 / 日式插销。' },
  { id: 'hull', name: '壳形', nameEn: 'Hull Profile', color: '#16A085',
    points: '1100,245 2800,235 3340,385 3520,465 3520,515 3340,635 2800,740 1100,755',
    description: '板底整体形状（平底 / V 底 / 独木舟底），影响速度与稳定性。',
    material: 'PVC 底层',
    tip: '平底稳而慢（全能）；V 底切水快（竞速）；独木舟底兼顾。' },
];

const VIEWS: Record<'top' | 'side' | 'bottom', ViewDef> = {
  top:    { key: 'top',    label: '顶视（甲板）', url: TOP_URL,    w: 3731, h: 981, parts: TOP_PARTS },
  side:   { key: 'side',   label: '侧视（轮廓）', url: SIDE_URL,   w: 3731, h: 981, parts: SIDE_PARTS },
  bottom: { key: 'bottom', label: '底视（船壳）', url: BOTTOM_URL, w: 3731, h: 981, parts: BOTTOM_PARTS },
};

/* ============================================================
   画布：底图 + SVG hotspot 叠加
   ============================================================ */

function BoardCanvas({
  view, activeId, setActiveId, debug,
}: {
  view: ViewDef;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  debug: boolean;
}) {
  return (
    <div
      style={{ position: 'relative', width: '100%', aspectRatio: `${view.w} / ${view.h}` }}
      onMouseLeave={() => setActiveId(null)}
    >
      <img
        src={view.url}
        alt={`桨板 ${view.label} 视图`}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain', pointerEvents: 'none', userSelect: 'none',
        }}
        draggable={false}
      />

      <svg
        viewBox={`0 0 ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {view.parts.map(p => {
          const isActive = activeId === p.id;
          const polys = p.points.split(';').map(s => s.trim()).filter(Boolean);
          const showFill = isActive || debug;
          const fillOpacity = isActive ? 0.55 : debug ? 0.40 : 0;
          const strokeOpacity = isActive ? 1 : debug ? 0.85 : 0;
          const strokeWidth = isActive ? 6 : debug ? 5 : 0;

          return (
            <g key={p.id}>
              {polys.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill={showFill ? p.color : 'transparent'}
                  fillOpacity={fillOpacity}
                  stroke={showFill ? p.color : 'transparent'}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  style={{
                    cursor: 'pointer',
                    transition: 'fill-opacity 0.18s, stroke-opacity 0.18s, stroke-width 0.18s',
                    filter: isActive ? `drop-shadow(0 0 10px ${p.color}60)` : 'none',
                  }}
                  onMouseEnter={() => setActiveId(p.id)}
                  onClick={() => setActiveId(p.id)}
                />
              ))}
              {debug && (() => {
                const first = polys[0];
                if (!first) return null;
                const nums = first.split(/[ ,]+/).map(Number);
                const xs: number[] = [], ys: number[] = [];
                for (let k = 0; k < nums.length; k += 2) {
                  if (!isNaN(nums[k])) xs.push(nums[k]);
                  if (!isNaN(nums[k + 1])) ys.push(nums[k + 1]);
                }
                const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
                const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
                return (
                  <text
                    x={cx} y={cy}
                    fill="#2E2118" fontSize="22"
                    textAnchor="middle" fontWeight="600"
                    pointerEvents="none"
                    style={{ textShadow: '0 0 6px #fff' }}
                  >
                    {p.name}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>

      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        fontSize: 11, color: '#2E2118', background: 'rgba(254,252,249,0.94)',
        padding: '4px 12px', borderRadius: 10, letterSpacing: '0.06em',
        border: '1px solid #EDE5D8', fontWeight: 600,
      }}>
        {view.label}
        {debug && <span style={{ marginLeft: 6, color: '#B7470A' }}>· DEBUG</span>}
      </div>
    </div>
  );
}

/* ============================================================
   主组件
   ============================================================ */

export default function BoardAnatomyDiagram() {
  const [viewKey, setViewKey] = useState<'top' | 'side' | 'bottom'>('top');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('debug') === 'parts') setDebug(true);
    const v = qs.get('boardView') || qs.get('view');
    if (v === 'side' || v === 'bottom' || v === 'top') setViewKey(v);
  }, []);

  const view = VIEWS[viewKey];
  const active = view.parts.find(p => p.id === activeId) || null;

  function switchView(k: 'top' | 'side' | 'bottom') {
    setViewKey(k);
    setActiveId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('boardView', k);
      url.hash = BOARD_ANATOMY_ANCHOR_ID;
      window.history.replaceState(null, '', url);
    }
  }

  return (
    <div id={BOARD_ANATOMY_ANCHOR_ID} style={{
      background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 16,
      padding: 20, marginBottom: 32,
      boxShadow: '0 4px 20px rgba(46, 33, 24, 0.04)',
    }}>
      {/* 头部 - 标题 + 视图切换 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 16, paddingBottom: 14,
        borderBottom: '1px solid #F0EAE0',
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: '#2E2118', margin: 0 }}>
            🏄 桨板 3 视图交互式解剖
          </h3>
          <p style={{ fontSize: 12, color: '#8A8078', margin: '4px 0 0' }}>
            悬停 / 点击各部件，右侧信息面板显示名称、材质与选购提示
          </p>
        </div>

        <div style={{
          display: 'inline-flex', background: '#F5EDE4', borderRadius: 10, padding: 3,
          border: '1px solid #EDE5D8',
        }}>
          {(['top', 'side', 'bottom'] as const).map(k => (
            <button
              key={k}
              onClick={() => switchView(k)}
              style={{
                padding: '6px 14px', fontSize: 12,
                fontWeight: viewKey === k ? 600 : 400,
                color: viewKey === k ? '#2E2118' : '#8A8078',
                background: viewKey === k ? '#FEFCF9' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                boxShadow: viewKey === k ? '0 1px 3px rgba(46,33,24,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {VIEWS[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* 画布 */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #F0EAE0', borderRadius: 12,
        padding: 16, marginBottom: 16,
      }}>
        <BoardCanvas
          view={view}
          activeId={activeId}
          setActiveId={setActiveId}
          debug={debug}
        />
      </div>

      {/* 信息面板 + 部件列表 */}
      <div style={{
        display: 'grid', gap: 16,
        gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)',
      }} className="board-anatomy-panel-grid">
        {active ? (
          <div style={{
            background: '#FAF7F2', border: `2px solid ${active.color}`,
            borderRadius: 12, padding: '16px 18px',
            animation: 'board-panel-fade 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: active.color }} />
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2E2118', margin: 0 }}>
                {active.name}
              </h4>
            </div>
            {active.nameEn && (
              <p style={{ fontSize: 11, color: '#A08060', margin: '0 0 14px 22px', letterSpacing: '0.04em' }}>
                {active.nameEn}
              </p>
            )}

            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <dt style={{ fontSize: 10, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                  功能
                </dt>
                <dd style={{ fontSize: 13, color: '#3D3730', margin: 0, lineHeight: 1.65 }}>
                  {active.description}
                </dd>
              </div>
              {active.material && (
                <div>
                  <dt style={{ fontSize: 10, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    材质
                  </dt>
                  <dd style={{ fontSize: 13, color: '#3D3730', margin: 0, lineHeight: 1.65 }}>
                    {active.material}
                  </dd>
                </div>
              )}
              {active.tip && (
                <div style={{ background: '#FDF8F0', borderLeft: '3px solid #C4A882', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                  <dt style={{ fontSize: 10, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    💡 选购 / 使用提示
                  </dt>
                  <dd style={{ fontSize: 12, color: '#3D3730', margin: 0, lineHeight: 1.6 }}>
                    {active.tip}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ) : (
          <div style={{
            background: '#FAF7F2', border: '1px dashed #D4C4B0', borderRadius: 12,
            padding: '28px 20px', textAlign: 'center', color: '#8A8078',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 30, marginBottom: 8, opacity: 0.6 }}>👆</div>
            <p style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}>
              悬停 / 点击解剖图上的部件，<br />查看它的功能、材质与选购提示
            </p>
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            本视图所有部件（{view.parts.length} 项）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {view.parts.map(p => (
              <button
                key={p.id}
                onMouseEnter={() => setActiveId(p.id)}
                onClick={() => setActiveId(p.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px',
                  background: activeId === p.id ? p.color : '#F5EDE4',
                  color: activeId === p.id ? '#fff' : '#655D56',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: activeId === p.id ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: p.color,
                  border: activeId === p.id ? '1.5px solid #fff' : 'none',
                }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes board-panel-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .board-anatomy-panel-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
