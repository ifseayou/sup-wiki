'use client';

import { useState } from 'react';

/**
 * 交互式桨板肌群发力图。
 * 底图：Wikimedia Commons 公共域人体剪影（Human_body_silhouette.svg），已转存 OSS。
 * 叠加层：SVG 色块标记肌群位置，半透明 multiply 混合，让剪影轮廓透过。
 * 前视 / 后视两个视图共用同一张剪影，用不同色块分别讲解正面与背面的 5 个肌群。
 */

const SILHOUETTE_URL =
  'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776671104617-silhouette.svg';

interface MuscleHotspot {
  id: string;
  name: string;
  alias: string;
  color: string;
  hoverColor: string;
  path: string;
  action: string;
  timing: string;
  tip: string;
  training: string;
}

// 剪影 viewBox 0 0 970 2200；通过渲染的 PNG 目测定位肌群坐标
const ANTERIOR: MuscleHotspot[] = [
  {
    id: 'chest_front_delt',
    name: '胸肌 + 三角肌前束',
    alias: 'Pectoralis major / Anterior deltoid',
    color: '#D4A574', hoverColor: '#B8823F',
    path: 'M 220 470 C 235 460 280 450 330 450 L 640 450 C 690 450 735 460 750 470 L 735 720 C 650 760 540 770 485 770 C 430 770 320 760 235 720 Z',
    action: '提桨入水，把桨送到板前方最远端。',
    timing: '划水周期的**起始阶段**——抓水前的前伸发力。',
    tip: '前伸不够远 = 每一桨的有效拉距被浪费。',
    training: '俯卧撑 / 弹力带前平举 / 双杠臂屈伸',
  },
  {
    id: 'core_anterior',
    name: '核心（腹肌 + 腹斜肌）',
    alias: 'Rectus abdominis / Obliques',
    color: '#C49A6C', hoverColor: '#9A7042',
    path: 'M 300 780 C 360 790 420 795 485 795 C 550 795 610 790 670 780 L 645 1100 C 590 1120 540 1125 485 1125 C 430 1125 380 1120 325 1100 Z',
    action: '**躯干稳定 + 旋转**，把肩部发力通过脊柱传到脚底。',
    timing: '整个划水周期**持续收紧**（等长收缩），不能松。',
    tip: '划不到 10 分钟腰就酸 = 核心代偿不足，不是腰不行。',
    training: '平板支撑 / 侧平板 / 死虫 / 农夫行走',
  },
  {
    id: 'quadriceps',
    name: '股四头肌',
    alias: 'Quadriceps (大腿前)',
    color: '#96A886', hoverColor: '#6F8563',
    path:
      'M 340 1260 C 365 1255 440 1255 470 1265 L 450 1670 C 415 1685 375 1685 355 1670 Z ' +
      'M 500 1265 C 530 1255 605 1255 630 1260 L 615 1670 C 595 1685 555 1685 520 1670 Z',
    action: '站姿支撑 + **半蹲前倾推桨**的发力支点。',
    timing: '推桨发力阶段——臀腿联动把力送上躯干。',
    tip: '膝盖全程紧绷 = 没用臀吸震，几公里就抖腿。',
    training: '高脚杯深蹲 / 保加利亚分腿蹲 / 箭步蹲',
  },
  {
    id: 'forearm_front',
    name: '前臂屈肌 / 握力',
    alias: 'Flexor digitorum / Flexor carpi',
    color: '#B5A3C7', hoverColor: '#8D76A5',
    path:
      'M 80 1030 C 110 1015 180 1010 220 1025 L 240 1320 C 220 1340 160 1340 120 1320 Z ' +
      'M 750 1025 C 790 1010 860 1015 890 1030 L 850 1320 C 810 1340 750 1340 730 1320 Z',
    action: '**持桨 + 控制桨叶角度**，长距离赛的隐形短板。',
    timing: '全程——但要轻握，不是死握。',
    tip: '划半小时抓不住桨 = 握力储备不足，不是手废了。',
    training: '握力器 / 悬吊挂杠 / 毛巾拧水',
  },
  {
    id: 'calf_front',
    name: '小腿',
    alias: 'Gastrocnemius / Tibialis anterior',
    color: '#A8BF9A', hoverColor: '#7E9770',
    path:
      'M 340 1740 C 360 1730 435 1730 460 1745 L 440 2100 C 415 2115 375 2115 355 2100 Z ' +
      'M 510 1745 C 535 1730 610 1730 630 1740 L 615 2100 C 595 2115 555 2115 530 2100 Z',
    action: '**脚踝微调 + 重心转移吸震**，应对水面起伏。',
    timing: '涌浪 / 侧风 / 过航船尾流时。',
    tip: '站得笔直 = 小腿没参与平衡，一个浪就倒。',
    training: '提踵（双脚 / 单脚） / 跳绳 / 平衡板',
  },
];

const POSTERIOR: MuscleHotspot[] = [
  {
    id: 'traps_rear_delt',
    name: '斜方肌 + 三角肌后束',
    alias: 'Trapezius / Posterior deltoid',
    color: '#D4A574', hoverColor: '#B8823F',
    path: 'M 220 470 C 235 460 280 450 330 450 L 640 450 C 690 450 735 460 750 470 L 735 680 C 650 700 540 710 485 710 C 430 710 320 700 235 680 Z',
    action: '**拔桨出水**——把桨叶迅速抽离水面不拖水。',
    timing: '划水周期的**收尾阶段**。',
    tip: '耸肩代偿 = 斜方上束过劳，肩胛没下沉。',
    training: '弹力带面拉 / 俯身飞鸟 / YTW 训练',
  },
  {
    id: 'lats',
    name: '背阔肌（桨板主发力肌）',
    alias: 'Latissimus dorsi',
    color: '#8B6F4E', hoverColor: '#5A4530',
    path: 'M 260 690 C 320 700 400 710 485 710 C 570 710 650 700 710 690 L 650 980 C 600 995 540 1000 485 1000 C 430 1000 370 995 320 980 Z',
    action: '**拉桨发力主力**——像做引体向上。',
    timing: '入水后到拉到脚边的主拉距阶段。',
    tip: '新手用二头肌拉桨 = 半小时手臂废。**正确是背阔 + 躯干旋转**。',
    training: '引体向上 / 俯身划船 / 直臂下拉',
  },
  {
    id: 'erector_spinae',
    name: '竖脊肌 / 下背',
    alias: 'Erector spinae / Multifidus',
    color: '#A88660', hoverColor: '#7C5E3D',
    path: 'M 330 990 C 380 1000 430 1005 485 1005 C 540 1005 590 1000 640 990 L 620 1150 C 580 1165 540 1170 485 1170 C 430 1170 390 1165 350 1150 Z',
    action: '**保持脊柱中立**，对抗前倾力矩，防止拱腰。',
    timing: '前倾姿态和涌浪冲击的瞬时反应。',
    tip: '腰酸 ≠ 腰不行，通常是竖脊肌耐力不够。',
    training: '硬拉 / 超人式 / 早安式屈体',
  },
  {
    id: 'glutes',
    name: '臀大肌',
    alias: 'Gluteus maximus',
    color: '#96A886', hoverColor: '#6F8563',
    // 两瓣臀椭圆，模拟"屁股"形状
    path:
      'M 330 1170 C 300 1180 290 1230 320 1280 C 360 1310 440 1310 470 1280 C 490 1250 480 1200 460 1180 C 430 1165 370 1165 330 1170 Z ' +
      'M 510 1180 C 490 1200 480 1250 500 1280 C 530 1310 610 1310 650 1280 C 680 1230 670 1180 640 1170 C 600 1165 540 1165 510 1180 Z',
    action: '**前倾推桨的反作用力支点**——把力从板面反推回躯干。',
    timing: '每一桨的发力链末端；Pivot Turn 重心后压时。',
    tip: '不会用臀 = 膝盖代偿过度，长划膝盖疼。',
    training: '臀桥 / 相扑硬拉 / 髋外展',
  },
  {
    id: 'hamstrings',
    name: '腘绳肌',
    alias: 'Hamstrings (大腿后)',
    color: '#A8BF9A', hoverColor: '#7E9770',
    path:
      'M 340 1320 C 365 1315 440 1315 470 1325 L 450 1680 C 415 1695 375 1695 355 1680 Z ' +
      'M 500 1325 C 530 1315 605 1315 630 1320 L 615 1680 C 595 1695 555 1695 520 1680 Z',
    action: '**跪姿→站姿起身** + 减速吸震 + 髋伸展发力。',
    timing: '起立动作、紧急减速、过涌浪时。',
    tip: '跪站切换腿抖 = 腘绳肌发力与核心不同步。',
    training: '罗马尼亚硬拉 / 俯卧腿弯举 / 臀腿摆',
  },
];

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: '#2E2118', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// 叠加层：同 viewBox 的 SVG，色块半透明 + multiply 混合
function HotspotLayer({
  muscles, activeId, setActiveId,
}: {
  muscles: MuscleHotspot[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  return (
    <svg
      viewBox="0 0 970 2200"
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {muscles.map(m => (
        <path
          key={m.id}
          d={m.path}
          fill={activeId === m.id ? m.hoverColor : m.color}
          fillOpacity={activeId === m.id ? 0.78 : 0.5}
          stroke={activeId === m.id ? '#2E2118' : 'transparent'}
          strokeWidth={activeId === m.id ? 4 : 0}
          style={{
            mixBlendMode: 'multiply',
            cursor: 'pointer',
            transition: 'fill 0.2s, fill-opacity 0.2s, stroke 0.2s, stroke-width 0.2s',
          }}
          onMouseEnter={() => setActiveId(m.id)}
          onClick={() => setActiveId(m.id)}
        />
      ))}
    </svg>
  );
}

export default function MuscleDiagram() {
  const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
  const [activeId, setActiveId] = useState<string | null>(null);

  const muscles = view === 'anterior' ? ANTERIOR : POSTERIOR;
  const active = muscles.find(m => m.id === activeId) || null;

  function switchView(v: 'anterior' | 'posterior') {
    setView(v);
    setActiveId(null);
  }

  return (
    <div
      style={{
        background: '#FEFCF9',
        border: '1px solid #EDE5D8',
        borderRadius: 16,
        padding: 24,
        marginBottom: 32,
      }}
    >
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F0EAE0',
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: '#2E2118', margin: 0 }}>
            🏄 交互式桨板发力图
          </h3>
          <p style={{ fontSize: 12, color: '#8A8078', margin: '4px 0 0' }}>
            悬停 / 点击人体色块，查看该肌群在桨板运动中的发力作用
          </p>
        </div>

        <div style={{
          display: 'inline-flex', background: '#F5EDE4', borderRadius: 10, padding: 3,
          border: '1px solid #EDE5D8',
        }}>
          {[
            { key: 'anterior', label: '正面（身体前侧肌群）' },
            { key: 'posterior', label: '背面（身体后侧肌群）' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => switchView(t.key as 'anterior' | 'posterior')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: view === t.key ? 600 : 400,
                color: view === t.key ? '#2E2118' : '#8A8078',
                background: view === t.key ? '#FEFCF9' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                boxShadow: view === t.key ? '0 1px 3px rgba(46,33,24,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主体：左图 + 右面板 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 340px) 1fr',
        gap: 28,
        alignItems: 'flex-start',
      }} className="muscle-diagram-grid">
        {/* 图层 */}
        <div
          style={{
            position: 'relative',
            background: 'radial-gradient(circle at 50% 30%, #FDF7EE 0%, #F5EDE4 100%)',
            borderRadius: 12,
            padding: 16,
            aspectRatio: '970/2200',
            width: '100%',
          }}
          onMouseLeave={() => setActiveId(null)}
        >
          {/* 人体剪影底图 */}
          <img
            src={SILHOUETTE_URL}
            alt="人体剪影"
            style={{
              position: 'absolute', inset: 16,
              width: 'calc(100% - 32px)', height: 'calc(100% - 32px)',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            draggable={false}
          />

          {/* 叠加层 — 色块 */}
          <div style={{ position: 'absolute', inset: 16 }}>
            <HotspotLayer muscles={muscles} activeId={activeId} setActiveId={setActiveId} />
          </div>

          {/* 左上角视图提示 */}
          <div style={{
            position: 'absolute', top: 12, left: 16, zIndex: 2,
            fontSize: 10, color: '#A08060', background: 'rgba(254,252,249,0.9)',
            padding: '2px 8px', borderRadius: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {view === 'anterior' ? '正面' : '背面'}
          </div>
        </div>

        {/* 信息面板 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <div
              style={{
                background: '#FAF7F2', border: `2px solid ${active.hoverColor}`,
                borderRadius: 12, padding: '18px 20px',
                animation: 'muscle-panel-fade 0.2s ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                  background: active.hoverColor,
                }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2E2118', margin: 0 }}>
                  {active.name}
                </h4>
              </div>
              <p style={{ fontSize: 11, color: '#A08060', margin: '0 0 16px 22px', letterSpacing: '0.02em' }}>
                {active.alias}
              </p>

              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    桨板动作
                  </dt>
                  <dd style={{ fontSize: 14, color: '#3D3730', margin: 0, lineHeight: 1.7 }}>
                    <RichText text={active.action} />
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    发力时机
                  </dt>
                  <dd style={{ fontSize: 14, color: '#3D3730', margin: 0, lineHeight: 1.7 }}>
                    <RichText text={active.timing} />
                  </dd>
                </div>
                <div style={{ background: '#FDF8F0', borderLeft: '3px solid #C4A882', padding: '10px 12px', borderRadius: '0 6px 6px 0' }}>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    💡 新手提示
                  </dt>
                  <dd style={{ fontSize: 13, color: '#3D3730', margin: 0, lineHeight: 1.65 }}>
                    <RichText text={active.tip} />
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    陆上练习
                  </dt>
                  <dd style={{ fontSize: 13, color: '#655D56', margin: 0, lineHeight: 1.65 }}>
                    {active.training}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div style={{
              background: '#FAF7F2', border: '1px dashed #D4C4B0', borderRadius: 12,
              padding: '32px 24px', textAlign: 'center', color: '#8A8078',
            }}>
              <div style={{ fontSize: 34, marginBottom: 10, opacity: 0.6 }}>👆</div>
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.7 }}>
                悬停人体图上的彩色区域<br />
                查看该肌群在桨板运动中的发力说明
              </p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              本视图所有肌群
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {muscles.map(m => (
                <button
                  key={m.id}
                  onMouseEnter={() => setActiveId(m.id)}
                  onClick={() => setActiveId(m.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px',
                    background: activeId === m.id ? m.hoverColor : '#F5EDE4',
                    color: activeId === m.id ? '#fff' : '#655D56',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: activeId === m.id ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: m.hoverColor,
                    border: activeId === m.id ? '1.5px solid #fff' : 'none',
                  }} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 10, color: '#C0B4A4', margin: '14px 0 0', lineHeight: 1.6 }}>
            人体剪影来自 Wikimedia Commons 公共域（<a href="https://commons.wikimedia.org/wiki/File:Human_body_silhouette.svg" target="_blank" rel="noopener noreferrer" style={{ color: '#A08060' }}>原始链接</a>）。色块位置为示意，非严格解剖学映射。
          </p>
        </div>
      </div>

      <style>{`
        @keyframes muscle-panel-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .muscle-diagram-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
