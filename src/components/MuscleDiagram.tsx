'use client';

import { useState } from 'react';

/**
 * 交互式桨板肌群发力图 v3。
 * 底图：写实解剖图，左右切开分别作为背面 / 正面，已上传 OSS。
 * 每视图 9+ 块精细肌肉 polygon hotspot，默认完全透明，hover 时显示彩色高亮 + 描边，
 * 让用户清楚看到"这里是哪块肌肉"以及它在桨板中的发力角色。
 */

const FRONT_IMG_URL =
  'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776673897837-anatomy-front.png';
const BACK_IMG_URL =
  'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776673896503-anatomy-back.png';

// 底图原始像素尺寸（SVG viewBox 与之对齐）
const IMG_W = 905;
const IMG_H = 1784;

interface MuscleHotspot {
  id: string;
  name: string;
  alias: string;
  color: string;       // hover 高亮色
  points: string;      // SVG polygon points（可多条用 ; 分隔对称左右）
  action: string;
  timing: string;
  tip: string;
  training: string;
}

/* =========================================================================
   正面肌群（9 块）
   viewBox 0 0 905 1784
   ========================================================================= */
const ANTERIOR: MuscleHotspot[] = [
  {
    id: 'pectoralis',
    name: '胸大肌',
    alias: 'Pectoralis major',
    color: '#B8823F',
    // 整片胸肌（左右合并）
    points:
      '300,340 445,325 600,340 610,400 580,510 445,525 310,510 290,400',
    action: '**前推桨 + 躯干前倾发力**，给桨叶施加压水力。',
    timing: '抓水到拉桨的过渡阶段——桨叶刚离开水面前的下压。',
    tip: '耸肩 / 含胸 = 胸肌过紧，背阔无法充分发力。下水前开肩拉伸很重要。',
    training: '俯卧撑 / 哑铃卧推 / 飞鸟 / 双杠臂屈伸',
  },
  {
    id: 'deltoid_anterior',
    name: '三角肌前束',
    alias: 'Anterior deltoid',
    color: '#E07A3D',
    points:
      // 左
      '245,290 300,340 295,430 240,405 ;' +
      // 右
      '605,340 660,290 665,405 610,430',
    action: '**提桨入水**——把桨送到板前方最远端。',
    timing: '划水周期的起始阶段。',
    tip: '前伸不够远 = 每一桨的有效拉距被浪费；肩关节活动度决定你能伸多远。',
    training: '弹力带前平举 / 阿诺德推举 / 直立划船',
  },
  {
    id: 'biceps',
    name: '肱二头肌',
    alias: 'Biceps brachii',
    color: '#D4A574',
    points:
      // 左
      '240,420 295,440 290,620 230,605 ;' +
      // 右
      '610,440 665,420 670,605 610,620',
    action: '拉桨的**辅助肌**（不是主力），配合背阔肌屈肘。',
    timing: '拉桨阶段，但**不要作为主发力肌**。',
    tip: '新手最大误区——用二头肌拉桨，半小时手臂就废。**正确是背阔 + 躯干旋转为主，二头只是传递**。',
    training: '弯举 / 引体向上（正握）/ 锤式弯举',
  },
  {
    id: 'forearm_flexor',
    name: '前臂屈肌 / 握力',
    alias: 'Flexor digitorum / Flexor carpi',
    color: '#B5A3C7',
    points:
      // 左
      '195,625 275,620 285,815 205,815 ;' +
      // 右
      '625,620 710,625 700,815 620,815',
    action: '**持桨 + 控制桨叶角度**，长距离赛的隐形短板。',
    timing: '全程——但要轻握而不是死握。',
    tip: '划半小时抓不住桨 = 握力储备不足，不是手废了。',
    training: '握力器 / 悬吊挂杠 / 毛巾拧水',
  },
  {
    id: 'rectus_abdominis',
    name: '腹直肌（六块腹）',
    alias: 'Rectus abdominis',
    color: '#C49A6C',
    points: '380,540 445,532 515,540 522,835 445,850 378,835',
    action: '**躯干前屈 + 核心稳定**，是桨板发力链的主轴。',
    timing: '整个划水周期**持续等长收缩**。',
    tip: '划不到 10 分钟腰酸 = 核心代偿不足，腹肌没绷紧。',
    training: '平板支撑 / 卷腹 / 悬垂举腿',
  },
  {
    id: 'obliques',
    name: '腹斜肌',
    alias: 'External oblique / Internal oblique',
    color: '#C08452',
    points:
      // 左
      '305,570 380,560 385,830 310,800 ;' +
      // 右
      '520,560 595,570 590,800 515,830',
    action: '**躯干旋转**——把左右划桨的力量交替传到躯干。',
    timing: '换边划桨的瞬时扭转，以及转向动作时。',
    tip: '转向靠肩带不靠腰 = 腹斜肌没参与，转桨效率低。',
    training: '俄罗斯转体 / 单臂农夫行走 / 风车动作',
  },
  {
    id: 'quadriceps',
    name: '股四头肌',
    alias: 'Quadriceps femoris',
    color: '#6F8563',
    points:
      // 左
      '330,900 445,895 450,1285 345,1285 ;' +
      // 右
      '460,895 575,900 560,1285 455,1285',
    action: '站姿支撑 + **半蹲前倾推桨**的发力支点。',
    timing: '推桨发力阶段，以及维持站姿时的持续张力。',
    tip: '膝盖全程紧绷 = 没用臀吸震，几公里就抖腿。',
    training: '高脚杯深蹲 / 箭步蹲 / 保加利亚分腿蹲',
  },
  {
    id: 'adductors',
    name: '内收肌群（大腿内）',
    alias: 'Adductors',
    color: '#9A7042',
    points:
      // 左腿内侧长条
      '395,905 440,900 435,1250 405,1250 ;' +
      // 右腿内侧长条
      '465,900 510,905 500,1250 470,1250',
    action: '**窄板平衡 + 腿部并拢稳定**，站窄板时尤为重要。',
    timing: '全程站立（窄板或竞速板尤甚）。',
    tip: '窄板双腿外撇 = 内收肌无力，重心一晃就摔。',
    training: '腿内收机 / 夹球深蹲 / 哥萨克深蹲',
  },
  {
    id: 'tibialis_anterior',
    name: '胫前肌 / 小腿前',
    alias: 'Tibialis anterior / Peroneus',
    color: '#7E9770',
    points:
      // 左
      '355,1365 435,1360 435,1680 355,1670 ;' +
      // 右
      '470,1360 550,1365 555,1670 475,1680',
    action: '**脚踝背屈 + 重心前后调整**，应对水面起伏。',
    timing: '涌浪 / 侧风 / 过航船尾流时。',
    tip: '站得笔直 = 脚踝没参与平衡，一个浪就倒。',
    training: '提踵（双脚 / 单脚） / 脚趾抓毛巾 / 平衡板',
  },
];

/* =========================================================================
   背面肌群（9 块）
   ========================================================================= */
const POSTERIOR: MuscleHotspot[] = [
  {
    id: 'trapezius',
    name: '斜方肌',
    alias: 'Trapezius',
    color: '#B8823F',
    points: '330,275 435,265 580,275 600,470 440,490 310,470',
    action: '**颈 + 肩胛骨稳定**，保持桨时不耸肩。',
    timing: '整个划水周期，尤其是拔桨瞬间。',
    tip: '耸肩代偿 = 斜方上束过劳，几桨后脖子就紧。',
    training: '弹力带面拉 / YTW 训练 / 俯身耸肩',
  },
  {
    id: 'deltoid_posterior',
    name: '三角肌后束',
    alias: 'Posterior deltoid',
    color: '#E07A3D',
    points:
      // 左
      '250,300 335,290 330,405 250,415 ;' +
      // 右
      '575,290 660,300 665,415 585,405',
    action: '**拔桨出水**——把桨叶迅速抽离水面不拖水。',
    timing: '划水周期的收尾阶段。',
    tip: '拔桨拖水 = 三角肌后束 + 肩胛没协同，节奏被拖慢。',
    training: '俯身飞鸟 / 弹力带外展 / 俯身绳索面拉',
  },
  {
    id: 'latissimus',
    name: '背阔肌（桨板主发力肌）',
    alias: 'Latissimus dorsi',
    color: '#5A4530',
    points:
      // 整片 V 形
      '335,470 445,480 580,470 570,700 490,810 405,810 320,700',
    action: '**拉桨发力主力** —— 像做引体向上。',
    timing: '入水后到拉到脚边的主拉距阶段。',
    tip: '新手用二头肌拉桨 = 半小时手臂废。**正确是背阔 + 躯干旋转**。',
    training: '引体向上 / 俯身划船 / 直臂下拉',
  },
  {
    id: 'triceps',
    name: '肱三头肌',
    alias: 'Triceps brachii',
    color: '#A88660',
    points:
      // 左
      '240,420 320,425 315,620 230,610 ;' +
      // 右
      '585,425 665,420 670,610 590,620',
    action: '**推桨下压 + 肘关节伸展**，配合胸肌完成压水动作。',
    timing: '拉桨到发力末端。',
    tip: '肘部全程屈曲 = 三头没参与，桨力只能靠手臂拉。',
    training: '窄距俯卧撑 / 绳索下压 / 仰卧臂屈伸',
  },
  {
    id: 'forearm_extensor',
    name: '前臂伸肌',
    alias: 'Extensor digitorum',
    color: '#B5A3C7',
    points:
      // 左
      '195,625 275,620 285,815 205,815 ;' +
      // 右
      '625,620 710,625 700,815 620,815',
    action: '**腕背伸 + 握桨稳定**，与屈肌对抗平衡。',
    timing: '全程——控制桨柄角度。',
    tip: '长划手腕酸 = 屈伸肌失衡，腕关节过度代偿。',
    training: '反向腕弯举 / 抓握训练 / 手指外展',
  },
  {
    id: 'erector_spinae',
    name: '竖脊肌 / 下背',
    alias: 'Erector spinae',
    color: '#7C5E3D',
    points:
      // 沿脊柱两侧
      '420,300 490,300 500,820 410,820',
    action: '**保持脊柱中立**，对抗前倾力矩，防止拱腰。',
    timing: '前倾姿态和涌浪冲击的瞬时反应。',
    tip: '腰酸 ≠ 腰不行，通常是竖脊肌耐力不够。',
    training: '硬拉 / 超人式 / 早安式屈体',
  },
  {
    id: 'gluteus',
    name: '臀大肌',
    alias: 'Gluteus maximus',
    color: '#6F8563',
    points:
      // 左半臀
      '335,790 450,770 460,985 350,990 ;' +
      // 右半臀
      '460,770 570,790 555,990 460,985',
    action: '**前倾推桨反作用力支点**——把力从板面反推回躯干。',
    timing: '每一桨发力链末端；Pivot Turn 重心后压时。',
    tip: '不会用臀 = 膝盖代偿过度，长划膝盖疼。',
    training: '臀桥 / 相扑硬拉 / 髋外展 / 单腿臀推',
  },
  {
    id: 'hamstrings',
    name: '腘绳肌',
    alias: 'Hamstrings',
    color: '#96A886',
    points:
      // 左
      '340,995 450,990 450,1290 345,1285 ;' +
      // 右
      '455,990 565,995 560,1285 455,1290',
    action: '**跪姿→站姿起身** + 减速吸震 + 髋伸展发力。',
    timing: '起立动作、紧急减速、过涌浪时。',
    tip: '跪站切换腿抖 = 腘绳肌发力与核心不同步。',
    training: '罗马尼亚硬拉 / 俯卧腿弯举 / 单腿硬拉',
  },
  {
    id: 'calf',
    name: '腓肠肌（小腿后）',
    alias: 'Gastrocnemius / Soleus',
    color: '#A8BF9A',
    points:
      // 左
      '345,1360 435,1355 435,1680 355,1670 ;' +
      // 右
      '470,1355 555,1360 550,1670 475,1680',
    action: '**站姿吸震 + 脚踝跖屈发力**，应对板子晃动。',
    timing: '涌浪 / 风浪 / 硬板站姿保持。',
    tip: '长划小腿抽筋 = 腓肠肌耐力不足 + 脱水。',
    training: '提踵（站姿 / 坐姿） / 跳绳 / 单脚提踵',
  },
];

/* =========================================================================
   UI 组件
   ========================================================================= */

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

function BodyCanvas({
  view, muscles, activeId, setActiveId,
}: {
  view: 'anterior' | 'posterior';
  muscles: MuscleHotspot[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const imgUrl = view === 'anterior' ? FRONT_IMG_URL : BACK_IMG_URL;

  return (
    <div
      style={{ position: 'relative', width: '100%', aspectRatio: `${IMG_W} / ${IMG_H}` }}
      onMouseLeave={() => setActiveId(null)}
    >
      {/* 底图 */}
      <img
        src={imgUrl}
        alt={view === 'anterior' ? '人体肌肉正面解剖图' : '人体肌肉背面解剖图'}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'contain',
          pointerEvents: 'none', userSelect: 'none',
        }}
        draggable={false}
      />

      {/* hotspot 叠加层 */}
      <svg
        viewBox={`0 0 ${IMG_W} ${IMG_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {muscles.map(m => {
          const isActive = activeId === m.id;
          // points 可能包含 ';' 分隔的多个多边形（用于对称左右肌肉）
          const polys = m.points.split(';').map(s => s.trim()).filter(Boolean);
          return (
            <g key={m.id}>
              {polys.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill={isActive ? m.color : 'transparent'}
                  fillOpacity={isActive ? 0.38 : 0}
                  stroke={isActive ? m.color : 'transparent'}
                  strokeWidth={isActive ? 4 : 0}
                  strokeLinejoin="round"
                  style={{
                    cursor: 'pointer',
                    transition: 'fill 0.18s, fill-opacity 0.18s, stroke 0.18s, stroke-width 0.18s',
                    filter: isActive ? `drop-shadow(0 0 8px ${m.color}60)` : 'none',
                  }}
                  onMouseEnter={() => setActiveId(m.id)}
                  onClick={() => setActiveId(m.id)}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* 角落视图提示 */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        fontSize: 10, color: '#2E2118', background: 'rgba(254,252,249,0.94)',
        padding: '3px 10px', borderRadius: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
        border: '1px solid #EDE5D8', fontWeight: 600,
      }}>
        {view === 'anterior' ? '正面' : '背面'}
      </div>
    </div>
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #F0EAE0',
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: '#2E2118', margin: 0 }}>
            🏄 交互式桨板发力图
          </h3>
          <p style={{ fontSize: 12, color: '#8A8078', margin: '4px 0 0' }}>
            悬停 / 点击人体肌肉，查看该肌群在桨板运动中的发力作用（正面 9 块 / 背面 9 块）
          </p>
        </div>

        <div style={{
          display: 'inline-flex', background: '#F5EDE4', borderRadius: 10, padding: 3,
          border: '1px solid #EDE5D8',
        }}>
          {[
            { key: 'anterior',  label: '正面（前侧肌群）' },
            { key: 'posterior', label: '背面（后侧肌群）' },
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 380px) 1fr',
        gap: 28,
        alignItems: 'flex-start',
      }} className="muscle-diagram-grid">
        <div style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: 12,
          padding: 12,
          border: '1px solid #F0EAE0',
        }}>
          <BodyCanvas
            view={view}
            muscles={muscles}
            activeId={activeId}
            setActiveId={setActiveId}
          />
        </div>

        {/* 信息面板 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {active ? (
            <div
              style={{
                background: '#FAF7F2', border: `2px solid ${active.color}`,
                borderRadius: 12, padding: '18px 20px',
                animation: 'muscle-panel-fade 0.2s ease-out',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{
                  display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                  background: active.color,
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
                悬停解剖图上的肌肉，<br />
                查看它在桨板运动中的发力作用
              </p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              本视图所有肌群（{muscles.length} 块）
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
                    background: activeId === m.id ? m.color : '#F5EDE4',
                    color: activeId === m.id ? '#fff' : '#655D56',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: activeId === m.id ? 500 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: m.color,
                    border: activeId === m.id ? '1.5px solid #fff' : 'none',
                  }} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>
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
