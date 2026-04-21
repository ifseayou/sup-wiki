'use client';

/**
 * 桨板构造与选购完全指南（第 5 篇学习文档）主体组件。
 * 功能：
 * - Hero 头部 + 双版本切换（实用教程 / 深度拆解）
 * - 6 个章节（结构 / 材质 / 板型 / 尾鳍 / 脚绳 / 配件）
 * - 末尾交互式选购决策树
 * 所有数据内嵌在本文件，DB 只存元数据。
 */

import React, { useState } from 'react';
import BoardAnatomyDiagram from './BoardAnatomyDiagram';

type Mode = 'tutorial' | 'deep';

// OSS 图片
const DROP_STITCH_URL  = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776702774508-board-drop-stitch.png';
const ACCESSORIES_URL  = 'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/learn-docs/1776702774508-board-accessories.jpg';

/* ============================================================
   章节 1：结构解剖（只渲染交互图，无双版本文本）
   ============================================================ */

function SectionAnatomy() {
  return (
    <SectionShell number="01" title="结构解剖" subtitle="Anatomy" accent="#E67E22">
      <p style={paragraphStyle}>
        以充气板的旗舰产品 <strong>MOLOKAI HERO AIR 14&apos; × 24&quot;</strong> 为例。用鼠标悬停下图上的任意部件，
        信息面板会即时显示它的名称、材质与选购提示。切换顶视 / 侧视 / 底视看到完整 3 面的关键零件。
      </p>
      <BoardAnatomyDiagram />
    </SectionShell>
  );
}

/* ============================================================
   章节 2：材质工艺（Drop-Stitch）
   ============================================================ */

function SectionMaterial({ mode }: { mode: Mode }) {
  return (
    <SectionShell number="02" title="材质工艺" subtitle="Drop-Stitch & PVC" accent="#2980B9">
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 24, alignItems: 'center',
      }} className="board-guide-two-col">
        <figure style={{ margin: 0 }}>
          <img
            src={DROP_STITCH_URL}
            alt="Drop-Stitch 剖面 - 单层 / 双层 / 三层构造"
            style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid #EDE5D8' }}
          />
          <figcaption style={{ fontSize: 11, color: '#A08060', marginTop: 6, textAlign: 'center' }}>
            Drop-Stitch 充气板剖面：单层 / 双层 / 三层构造对比
          </figcaption>
        </figure>

        <div>
          {mode === 'tutorial' ? (
            <>
              <p style={paragraphStyle}>
                一块充满气就能站人的&ldquo;气囊&rdquo;为什么不会鼓成球？秘密是 <strong>Drop-Stitch（拉丝工艺）</strong>——
                上下两层 PVC 之间由**成千上万根涤纶丝线**垂直拉住，把板体固定成扁平形而不是球形。
              </p>
              <p style={paragraphStyle}>
                充到 15-18 PSI 时，拉丝绷紧、整板硬如木头，能承受 120 kg 以上的重量。
                外层贴 1-3 层 PVC 防刮耐磨。<strong>层数越多越硬越贵也越重</strong>，日常用双层即可。
              </p>
            </>
          ) : (
            <>
              <p style={paragraphStyle}>
                <strong>Drop-Stitch 原理</strong>：上下两片机织涤纶基布（1000D+），用 3000-6000 针/m² 的高密度拉丝
                在织机上垂直连接成&ldquo;三明治&rdquo;基胚，拉丝长度决定板厚（5&quot; / 6&quot; / 8&quot;）。基胚两面先涂气密 TPU 胶，
                再热压贴合 0.9-1.1 mm PVC 保护层。
              </p>
              <p style={paragraphStyle}>
                <strong>单层 vs 双层 vs 三层</strong>：
              </p>
              <ul style={listStyle}>
                <li><strong>单层</strong>（入门 / 儿童板）：一层 PVC 厚 0.9 mm，充 12-15 PSI 就软塌，10 kg 左右；</li>
                <li><strong>双层 / Fusion</strong>（主流）：两层 PVC + 粘合剂一体热压，可稳定到 15-18 PSI，12-14 kg；</li>
                <li><strong>三层 / Carbon Rail</strong>（竞速）：三层 PVC + 侧边碳纤强化条，支撑 20 PSI 不形变，18 kg+。</li>
              </ul>
              <p style={paragraphStyle}>
                <strong>品牌工艺差</strong>：顶级品牌（Red Paddle / Starboard / MOLOKAI）用
                <em>MSL（Monocoque Structural Laminate）</em>一体热压工艺，板身形变 &lt; 5%；
                低端品牌用传统&ldquo;人工贴合&rdquo;工艺，使用半年后侧缝起泡、板身变形是常见问题。
              </p>
            </>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

/* ============================================================
   章节 3：板型场景匹配
   ============================================================ */

interface BoardType {
  name: string;
  nameEn: string;
  emoji: string;
  size: string;
  volume: string;
  scene: string;
  audience: string;
  tone: { bg: string; color: string };
}

const BOARD_TYPES: BoardType[] = [
  { name: '全能板', nameEn: 'All-Round',   emoji: '🏖️', size: "10'6\" × 32\"",      volume: '300-330 L', scene: '湖泊 / 近海 / 河口静水',       audience: '新手、家庭、周末玩家', tone: { bg: '#E9F7EF', color: '#0E6655' } },
  { name: '竞速板', nameEn: 'Race',        emoji: '⚡', size: "12'6\" ~ 14' × 24-26\"", volume: '280-370 L', scene: '比赛 / 直线竞速 / 长距离',  audience: '竞技选手、耐力党',     tone: { bg: '#FDF2E9', color: '#B7470A' } },
  { name: '旅行板', nameEn: 'Touring',     emoji: '🎒', size: "11'6\" × 30-32\"",    volume: '310-350 L', scene: '多日巡航 / 载重野营',        audience: 'SUP 露营、远征爱好者', tone: { bg: '#EBF5FB', color: '#1A5276' } },
  { name: '冲浪板', nameEn: 'Surf SUP',    emoji: '🌊', size: "9'-10' × 30-32\"",     volume: '180-240 L', scene: '近岸小浪 / 中浪 / 撞浪',     audience: '冲浪进阶 / 浪区常客',  tone: { bg: '#FDEBD0', color: '#9A6A1E' } },
  { name: '瑜伽板', nameEn: 'Yoga SUP',    emoji: '🧘', size: "10' × 34\"",           volume: '260-300 L', scene: '平水瑜伽 / 休闲放松',         audience: '瑜伽爱好者、女性玩家', tone: { bg: '#F4ECF7', color: '#6C3483' } },
  { name: '白水 / 河流板', nameEn: 'Whitewater', emoji: '🌀', size: "9'-10' × 34\"",   volume: '240-280 L', scene: '激流 / 浅滩 / 小溪',          audience: '河流玩家、激流党',       tone: { bg: '#F0EAE0', color: '#7A6145' } },
];

function SectionBoardTypes({ mode }: { mode: Mode }) {
  return (
    <SectionShell number="03" title="板型场景匹配" subtitle="Board Types" accent="#16A085">
      <p style={paragraphStyle}>
        板型不同尺寸 / 体积 / 壳形差异很大，<strong>错配板型是新手最贵的坑</strong>——在湖上买了冲浪板，风一吹就飘走。
        先定你玩什么，再定买什么。
      </p>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {BOARD_TYPES.map(t => (
          <div key={t.name} style={{
            background: '#FEFCF9', border: `1px solid ${t.tone.bg}`,
            borderRadius: 12, padding: 16, position: 'relative',
            boxShadow: '0 2px 8px rgba(46, 33, 24, 0.03)',
          }}>
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: t.tone.bg, color: t.tone.color,
              fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
              letterSpacing: '0.04em',
            }}>
              {t.nameEn}
            </div>

            <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 6 }}>{t.emoji}</div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#2E2118', margin: '0 0 10px' }}>
              {t.name}
            </h4>

            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <div style={row()}>
                <dt style={dtStyle}>尺寸</dt>
                <dd style={ddStyle}>{t.size}</dd>
              </div>
              <div style={row()}>
                <dt style={dtStyle}>体积</dt>
                <dd style={ddStyle}>{t.volume}</dd>
              </div>
              <div style={row()}>
                <dt style={dtStyle}>场景</dt>
                <dd style={ddStyle}>{t.scene}</dd>
              </div>
              <div style={row()}>
                <dt style={dtStyle}>人群</dt>
                <dd style={ddStyle}>{t.audience}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {mode === 'deep' && (
        <div style={deepNoteStyle}>
          <p style={{ ...paragraphStyle, marginTop: 0 }}>
            <strong>深度：板型差异的本质是&ldquo;长宽厚 / 体积 / 壳形&rdquo;四维度的权衡</strong>。
            长 = 直线速度 + 稳定性（加长）；宽 = 横向稳定性 + 初学友好；
            厚 = 承载力；体积 = 长×宽×厚×系数，直接决定最大载重。
            冲浪板短宽、低体积 → 好转向不稳定；竞速板长窄、尖头 V 底 → 切水快站不稳；
            全能板居中所有维度 → 万金油但不精。
          </p>
          <p style={paragraphStyle}>
            <strong>身体体重对应的建议体积系数</strong>：最低浮力 = 体重（kg）× 1.8 L。
            70 kg 选手下限 126 L，建议选 180-260 L（新手 / 瑜伽）或 280 L+ （全能 / 旅行）。
            竞速选手体积可以低到 140 L 但对平衡要求极高。
          </p>
        </div>
      )}
    </SectionShell>
  );
}

/* ============================================================
   章节 4：尾鳍类型
   ============================================================ */

interface FinType {
  name: string;
  config: string;
  scene: string;
  pro: string;
  con: string;
  suited: string;
  color: string;
}

const FINS: FinType[] = [
  { name: '单中鳍（单鳍制）',   config: '1 × 中鳍（US-Box）',       scene: '平水巡航 / 通勤',            pro: '阻力最小，直线快', con: '转向略迟钝',         suited: '全能板 / 旅行板 / 竞速板', color: '#E67E22' },
  { name: '三鳍（Thruster）',   config: '1 中鳍 + 2 侧鳍',           scene: '冲浪 / 小中浪',              pro: '转向灵活，冲浪稳', con: '直线慢 8-12%',       suited: '冲浪板',                  color: '#C0392B' },
  { name: '2 + 1 混合制',       config: '1 中鳍 + 2 小侧鳍（可拆）', scene: '全能 / 可根据水况切换',      pro: '灵活最强',         con: '多鳍安装慢',         suited: '全能板 / 准冲浪',         color: '#2980B9' },
  { name: '竞速深鳍',            config: '1 × 碳纤深鳍（10-25 cm）', scene: '比赛 / 长距离',              pro: '直线最稳最快',     con: '浅水打底 / 搁鳍',    suited: '竞速板',                  color: '#8E44AD' },
  { name: '河流软鳍 / 弹性鳍',   config: '1 × 软橡胶鳍',              scene: '激流 / 石滩 / 浅溪',         pro: '撞石不坏',         con: '直线易飘',           suited: '白水板',                  color: '#16A085' },
  { name: '快拆式鳍',           config: '免工具单鳍',                 scene: '频繁收板 / 携带',            pro: '30 秒装卸',        con: '强度略弱',           suited: '入门板 / 旅行用',          color: '#D35400' },
];

function SectionFins({ mode }: { mode: Mode }) {
  return (
    <SectionShell number="04" title="尾鳍类型" subtitle="Fin Types" accent="#8E44AD">
      <p style={paragraphStyle}>
        尾鳍是板子的&ldquo;舵&rdquo;——既决定直线稳定又决定转向响应，场景不对鳍就是白换板。
      </p>

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr style={{ background: '#FAF7F2', borderBottom: '2px solid #EDE5D8' }}>
              {['类型', '配置', '场景', '优势', '劣势', '推荐板型'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FINS.map((f, i) => (
              <tr key={f.name} style={{ background: i % 2 ? '#FDF8F0' : '#FEFCF9', borderBottom: '1px solid #F0EAE0' }}>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: f.color, marginRight: 6,
                  }} />
                  <strong style={{ color: '#2E2118' }}>{f.name}</strong>
                </td>
                <td style={tdStyle}>{f.config}</td>
                <td style={tdStyle}>{f.scene}</td>
                <td style={{ ...tdStyle, color: '#0E6655' }}>✓ {f.pro}</td>
                <td style={{ ...tdStyle, color: '#B7470A' }}>✗ {f.con}</td>
                <td style={{ ...tdStyle, color: '#7A6145' }}>{f.suited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode === 'deep' && (
        <div style={deepNoteStyle}>
          <p style={{ ...paragraphStyle, marginTop: 0 }}>
            <strong>鳍盒制式（Fin Box）是先决条件</strong>：
          </p>
          <ul style={listStyle}>
            <li><strong>US-Box / 长方形插槽</strong>：业界 90% 兼容，前后可滑动调鳍位；</li>
            <li><strong>FCS II</strong>：冲浪板专用推入式，卡扣固定，换鳍 5 秒；</li>
            <li><strong>日式插销（Slide-In）</strong>：老旧制式，插入 + 螺丝固定，维修不便；</li>
            <li><strong>一体固定鳍</strong>：低价板常见，磕掉整个板报废。</li>
          </ul>
          <p style={paragraphStyle}>
            <strong>鳍深与场景</strong>：8-10 cm 全能；10-12 cm 旅行 / 长距离；&lt; 7 cm 浅水河流；
            13-25 cm 专业竞速。过深会在进入浅水时磕碰打滑，过浅在风浪中偏航严重。
          </p>
        </div>
      )}
    </SectionShell>
  );
}

/* ============================================================
   章节 5：脚绳类型
   ============================================================ */

interface LeashType {
  name: string;
  length: string;
  scene: string;
  pos: string;
  note: string;
  color: string;
}

const LEASHES: LeashType[] = [
  { name: '直式脚绳',     length: '10 ft（3 m）',    scene: '平水 / 巡航 / SUP 瑜伽', pos: '脚踝',      note: '最常见，入门首选', color: '#2980B9' },
  { name: '盘旋式（Coil）', length: '10-12 ft',        scene: '平水 / 跟桩比赛',        pos: '脚踝',      note: '不拖水、不缠脚，竞技党爱用', color: '#16A085' },
  { name: '腰式脚绳（Waist）', length: '6-8 ft + 腰包',  scene: '激流 / 河流',             pos: '腰部快拆', note: '落水瞬间一拉解脱，白水必备', color: '#C0392B' },
  { name: '小腿绑式（Calf）', length: '10 ft',          scene: '冲浪',                    pos: '小腿',      note: '躲开脚踝缠绳风险',         color: '#E67E22' },
];

function SectionLeashes({ mode }: { mode: Mode }) {
  return (
    <SectionShell number="05" title="脚绳类型" subtitle="Leash Types" accent="#C0392B">
      <p style={paragraphStyle}>
        脚绳（Leash）是落水后连接人和板的唯一生命线。<strong>场景选错可能致命</strong>——
        静水党戴腰式没问题，但激流党戴脚踝绳若脚卡石缝，绳子拖着板顶下来就是死穴。
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {LEASHES.map(l => (
          <div key={l.name} style={{
            background: '#FEFCF9', border: `1px solid #EDE5D8`,
            borderLeft: `4px solid ${l.color}`,
            borderRadius: 10, padding: 14,
          }}>
            <h5 style={{ fontSize: 14, fontWeight: 600, color: '#2E2118', margin: '0 0 8px' }}>{l.name}</h5>
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
              <div style={row()}><dt style={dtStyle}>长度</dt><dd style={ddStyle}>{l.length}</dd></div>
              <div style={row()}><dt style={dtStyle}>场景</dt><dd style={ddStyle}>{l.scene}</dd></div>
              <div style={row()}><dt style={dtStyle}>位置</dt><dd style={ddStyle}>{l.pos}</dd></div>
            </dl>
            <p style={{
              fontSize: 11, color: '#8A8078', margin: '8px 0 0', lineHeight: 1.55,
              background: '#FDF8F0', padding: '6px 8px', borderLeft: '2px solid #C4A882', borderRadius: '0 4px 4px 0',
            }}>
              💡 {l.note}
            </p>
          </div>
        ))}
      </div>

      {mode === 'deep' && (
        <div style={deepNoteStyle}>
          <p style={{ ...paragraphStyle, marginTop: 0 }}>
            <strong>何时必须用&ldquo;快拆&rdquo;脚绳</strong>：所有流动水域（河流 / 激流 / 潮汐急流 / 溯溪）
            都必须用腰式快拆脚绳。理由是：脚踝绳一旦被水下障碍钩住，水流巨大拉力会让你无法够到
            脚踝按下快拆扣，只能靠腰部一拉解脱。
          </p>
          <p style={paragraphStyle}>
            <strong>脚绳断点测试</strong>：新脚绳 PU 芯 &ge; 7 mm 能承受 300 kg 拉力；使用 2 年以上
            老化开裂的绳子 50 kg 一拉就断。每年汛期前检查脚绳扭结、开胶、快拆磁铁是否生锈。
          </p>
        </div>
      )}
    </SectionShell>
  );
}

/* ============================================================
   章节 6：配件解读
   ============================================================ */

interface Accessory {
  name: string;
  icon: string;
  desc: string;
  tip: string;
}

const ACCESSORIES: Accessory[] = [
  { name: '双向气泵（手动）', icon: '💨', desc: '压缩 + 吸气双行程，比传统单向泵省时 40%。', tip: '15 PSI 以上最后 5 PSI 必须靠双向泵压缩推完。' },
  { name: '电动气泵（12V）', icon: '🔋', desc: '充气宝 / 汽车电源供电，5 分钟充到 15 PSI。',   tip: '认准带&ldquo;自动停&rdquo;功能的，防止过压爆气嘴。' },
  { name: '滚轮背包', icon: '🎒', desc: '双肩背 + 拖行两用，收板后推着走不压肩。',       tip: '内衬透气网避免板子回家闷发霉。' },
  { name: '修复包 / 补胎片', icon: '🛠️', desc: 'PVC 贴片 + 专用胶 + 刮刀，处理小破口。',   tip: '出行必带，河边 / 海边撞到枝桠分分钟破皮。' },
  { name: '鳍盒钥匙 / 螺栓', icon: '🔑', desc: 'US-Box 鳍盒专用六角螺栓 + 固定螺母。',       tip: '备件极容易丢，多买 2 套放背包侧兜。' },
  { name: '桨 / Paddle', icon: '🏄', desc: '铝合金入门 / 玻纤全能 / 全碳纤竞速 三档。',     tip: '全碳纤桨单把 600 g，铝合金 900 g，长途累 300%。' },
  { name: '防水手机包', icon: '📱', desc: 'IPX8 气密袋，套脖挂胸前。',                     tip: '下水前吹进去气测试 10 分钟不漏。' },
  { name: '速干毛巾 / 救生衣', icon: '🦺', desc: '海岸与开阔水域法规要求穿救生衣。',         tip: '瘦身款 PFD 不影响划桨动作。' },
];

function SectionAccessories({ mode }: { mode: Mode }) {
  return (
    <SectionShell number="06" title="配件解读" subtitle="Accessories" accent="#7A6145">
      <p style={paragraphStyle}>
        板 + 桨 + 脚绳 + 气泵 + 背包是 5 件套标配，其余都按场景加。
      </p>

      <figure style={{ margin: '0 0 16px' }}>
        <img
          src={ACCESSORIES_URL}
          alt="桨板标配配件 - 滚轮背包 / 通用尾鳍 / 双向气泵 / TPU 脚绳"
          style={{ width: '100%', height: 'auto', borderRadius: 10, border: '1px solid #EDE5D8' }}
        />
        <figcaption style={{ fontSize: 11, color: '#A08060', marginTop: 6, textAlign: 'center' }}>
          常见配件：背包 / 通用尾鳍 / 双向气泵 / TPU 脚绳
        </figcaption>
      </figure>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {ACCESSORIES.map(a => (
          <div key={a.name} style={{
            background: '#FEFCF9', border: '1px solid #EDE5D8', borderRadius: 10,
            padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#F5EDE4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>{a.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h5 style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', margin: '0 0 4px' }}>{a.name}</h5>
              <p style={{ fontSize: 11, color: '#655D56', margin: '0 0 5px', lineHeight: 1.55 }}>{a.desc}</p>
              <p style={{ fontSize: 11, color: '#A08060', margin: 0, lineHeight: 1.55 }}>💡 {a.tip}</p>
            </div>
          </div>
        ))}
      </div>

      {mode === 'deep' && (
        <div style={deepNoteStyle}>
          <p style={{ ...paragraphStyle, marginTop: 0 }}>
            <strong>气泵进阶选择</strong>：手动双向泵约 200-400 元，寿命 2-3 年；
            电动泵 12V 约 500-1200 元，内置锂电池款便携但功率小（仅支持 6" 板）；
            车载 12V 款功率大但需连车电瓶。竞赛场地常见&ldquo;车载 12V + 大功率气泵&rdquo;组合 3 分钟充到位。
          </p>
          <p style={paragraphStyle}>
            <strong>桨的材质</strong>：入门铝合金 200-400 元 900 g，冷硬易手汗滑；
            玻纤 500-900 元 700 g，韧性好，全能之选；全碳纤 1000-2500 元 500-600 g，
            长途不累，但撞石会&ldquo;脆断&rdquo;而非弯曲。建议全能玩家选玻纤三段可调款。
          </p>
        </div>
      )}
    </SectionShell>
  );
}

/* ============================================================
   选购决策树
   ============================================================ */

type Scenario = 'flat' | 'surf' | 'tour' | 'race';
type Weight = 'light' | 'mid' | 'heavy';
type Space = 'small' | 'car' | 'big';
type Budget = 'low' | 'mid' | 'high';

interface Recipe {
  board: string;
  size: string;
  fin: string;
  leash: string;
  pump: string;
  note: string;
}

function computeRecommendation(
  scenario: Scenario,
  weight: Weight,
  space: Space,
  budget: Budget,
): Recipe {
  let board = '全能板'; let size = "10'6\" × 32\""; let fin = '单中鳍 8 cm';
  let leash = '直式 10 ft 脚踝'; let pump = '手动双向气泵'; let note = '';

  // 场景决定板型
  if (scenario === 'surf') { board = '冲浪板'; size = "9'6\" × 31\""; fin = '三鳍 Thruster'; leash = '小腿绑式 10 ft'; }
  else if (scenario === 'tour') { board = '旅行板'; size = "11'6\" × 30\""; fin = '单中鳍 10 cm'; leash = '盘旋式 10 ft'; }
  else if (scenario === 'race')  { board = '竞速板'; size = "12'6\" × 26\""; fin = '竞速深鳍 15 cm'; leash = '盘旋式 10 ft'; }
  else { /* flat */ board = '全能板'; size = "10'6\" × 32\""; fin = '单中鳍 8 cm'; leash = '直式 10 ft'; }

  // 体重补偿（宽度与体积）
  if (weight === 'heavy') { size = size.replace(/32"/, '34"').replace(/30"/, '32"'); note += '体重大于 80 kg 建议板宽 +2\" 避免下水即沉。'; }
  if (weight === 'light' && scenario === 'surf') { size = "9' × 30\""; }

  // 存放空间
  if (space === 'small')  note += ' 阳台存放必选充气板，硬板放不下。';
  if (space === 'big')    note += ' 有车库或家中大空间可考虑硬板长期体验更好。';

  // 预算决定气泵 + 辅材等级
  if (budget === 'high')      pump = '电动气泵 12V + 手动备用';
  else if (budget === 'low')  { pump = '入门单向气泵'; note += ' 预算低先省气泵钱，板子别省。'; }

  if (!note) note = '配置均衡，入门 / 进阶都合适。';

  return { board, size, fin, leash, pump, note: note.trim() };
}

function DecisionTree() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [weight, setWeight] = useState<Weight | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);

  const complete = !!(scenario && weight && space && budget);
  const rec = complete ? computeRecommendation(scenario!, weight!, space!, budget!) : null;

  function reset() { setScenario(null); setWeight(null); setSpace(null); setBudget(null); }

  return (
    <section style={{
      background: 'linear-gradient(180deg, #FDF7EE 0%, #F5EDE4 100%)',
      border: '1px solid #EDE5D8', borderRadius: 16,
      padding: '28px 24px', marginTop: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: '#2E2118', margin: 0 }}>
          🎯 选购决策树
        </h2>
        {complete && (
          <button onClick={reset} style={{
            background: 'transparent', color: '#7A6145', border: '1px solid #C4A882',
            padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
          }}>重置</button>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#655D56', margin: '0 0 20px', lineHeight: 1.7 }}>
        回答 4 个问题，获得 <strong>板型 / 尺寸 / 尾鳍 / 脚绳 / 气泵</strong> 的定制推荐组合。
      </p>

      <Question
        label="1. 你主要在哪种水域玩？"
        options={[
          { key: 'flat',  label: '🏞️ 平水（湖 / 河口 / 水库）' },
          { key: 'surf',  label: '🌊 近岸冲浪（中小浪）' },
          { key: 'tour',  label: '🎒 巡航 / 长距离多日' },
          { key: 'race',  label: '⚡ 竞速 / 比赛' },
        ]}
        value={scenario} setValue={v => setScenario(v as Scenario)}
      />

      <Question
        label="2. 你的体重是？"
        options={[
          { key: 'light',  label: '< 60 kg' },
          { key: 'mid',    label: '60 - 80 kg' },
          { key: 'heavy',  label: '> 80 kg' },
        ]}
        value={weight} setValue={v => setWeight(v as Weight)}
      />

      <Question
        label="3. 你的存放空间是？"
        options={[
          { key: 'small', label: '🏠 阳台 / 小户型' },
          { key: 'car',   label: '🚗 主要存放在车上 / 车库' },
          { key: 'big',   label: '🏡 家中有大空间' },
        ]}
        value={space} setValue={v => setSpace(v as Space)}
      />

      <Question
        label="4. 整套预算？"
        options={[
          { key: 'low',  label: '< 3000 元' },
          { key: 'mid',  label: '3000 - 6000 元' },
          { key: 'high', label: '> 6000 元' },
        ]}
        value={budget} setValue={v => setBudget(v as Budget)}
      />

      {rec && (
        <div style={{
          marginTop: 24, background: '#FEFCF9', border: '2px solid #C4A882',
          borderRadius: 14, padding: '20px 24px',
          animation: 'board-panel-fade 0.3s ease-out',
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: '#2E2118', margin: '0 0 16px' }}>
            ✨ 给你的推荐组合
          </h3>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { k: '板型',   v: rec.board, color: '#0E6655' },
              { k: '尺寸',   v: rec.size,  color: '#B7470A' },
              { k: '尾鳍',   v: rec.fin,   color: '#8E44AD' },
              { k: '脚绳',   v: rec.leash, color: '#C0392B' },
              { k: '气泵',   v: rec.pump,  color: '#7A6145' },
            ].map(r => (
              <div key={r.k} style={{ background: '#FAF7F2', borderRadius: 10, padding: '10px 12px' }}>
                <dt style={{ fontSize: 10, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
                  {r.k}
                </dt>
                <dd style={{ fontSize: 14, fontWeight: 600, color: r.color, margin: 0 }}>{r.v}</dd>
              </div>
            ))}
          </dl>
          <p style={{
            fontSize: 12, color: '#3D3730', margin: '14px 0 0', lineHeight: 1.7,
            background: '#FDF8F0', padding: '10px 12px', borderLeft: '3px solid #C4A882', borderRadius: '0 6px 6px 0',
          }}>
            💡 {rec.note}
          </p>
        </div>
      )}
    </section>
  );
}

function Question<T extends string>({
  label, options, value, setValue,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T | null;
  setValue: (v: T) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#2E2118', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setValue(o.key)}
              style={{
                padding: '8px 14px', fontSize: 12,
                background: active ? '#2E2118' : '#FEFCF9',
                color: active ? '#FDF7EE' : '#655D56',
                border: active ? '1px solid #2E2118' : '1px solid #EDE5D8',
                borderRadius: 10, cursor: 'pointer',
                transition: 'all 0.15s',
                fontWeight: active ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Hero 头部 + 深度切换 + 主组件
   ============================================================ */

export default function BoardAnatomyGuide() {
  const [mode, setMode] = useState<Mode>('tutorial');

  return (
    <div>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #EDE5D8 0%, #FDF7EE 50%, #F5EDE4 100%)',
        borderRadius: 20, padding: '36px 32px', marginBottom: 32,
        border: '1px solid #EDE5D8',
        boxShadow: '0 4px 20px rgba(46, 33, 24, 0.06)',
      }}>
        <div style={{ fontSize: 11, color: '#A08060', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 500 }}>
          Board Anatomy & Buyer&apos;s Guide · 桨板教科书
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 42px)',
          fontWeight: 500, color: '#2E2118', lineHeight: 1.2, margin: '0 0 14px',
        }}>
          桨板构造与选购完全指南
        </h1>
        <p style={{ fontSize: 15, color: '#655D56', lineHeight: 1.85, margin: '0 0 20px', maxWidth: 720 }}>
          以旗舰级 <strong>MOLOKAI HERO AIR 14&apos; × 24&quot;</strong> 为例，
          从 <strong>Drop-Stitch 结构</strong>到 <strong>6 大板型 / 6 类尾鳍 / 4 类脚绳 / 6 类配件</strong>，
          配<strong>交互式 3 视图解剖图</strong>与<strong>双深度可切换</strong>讲解，
          最后给出基于你身高 / 场景 / 预算的选购决策树。
        </p>

        {/* 双深度切换 */}
        <div style={{
          display: 'inline-flex', background: '#FEFCF9', borderRadius: 12, padding: 4,
          border: '1px solid #EDE5D8', gap: 2,
          boxShadow: '0 1px 3px rgba(46,33,24,0.06)',
        }}>
          {[
            { key: 'tutorial' as Mode, label: '⭐ 实用教程',  desc: '150-250 字 / 章' },
            { key: 'deep'     as Mode, label: '🔬 深度拆解', desc: '+ 工艺 / 选型决策' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setMode(opt.key)}
              style={{
                padding: '10px 18px',
                background: mode === opt.key ? '#2E2118' : 'transparent',
                color: mode === opt.key ? '#FDF7EE' : '#655D56',
                border: 'none', borderRadius: 9, cursor: 'pointer',
                fontSize: 13, fontWeight: mode === opt.key ? 600 : 400,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                lineHeight: 1.2, transition: 'all 0.15s',
              }}
            >
              <span>{opt.label}</span>
              <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 6 个章节 */}
      <SectionAnatomy />
      <SectionMaterial mode={mode} />
      <SectionBoardTypes mode={mode} />
      <SectionFins mode={mode} />
      <SectionLeashes mode={mode} />
      <SectionAccessories mode={mode} />

      {/* 选购决策树 */}
      <DecisionTree />

      <style>{`
        @keyframes board-panel-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .board-guide-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   共用样式 / 小组件
   ============================================================ */

function SectionShell({
  number, title, subtitle, accent, children,
}: {
  number: string;
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 14,
        marginBottom: 20, paddingBottom: 10,
        borderBottom: `2px solid ${accent}20`,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 400,
          color: accent, lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {number}
        </div>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500,
            color: '#2E2118', margin: 0, lineHeight: 1.2,
          }}>
            {title}
          </h2>
          <div style={{ fontSize: 11, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2, fontWeight: 500 }}>
            {subtitle}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 14, color: '#3D3730', lineHeight: 1.8, margin: '0 0 12px',
};

const listStyle: React.CSSProperties = {
  fontSize: 14, color: '#3D3730', lineHeight: 1.75,
  paddingLeft: 22, margin: '0 0 12px',
};

const deepNoteStyle: React.CSSProperties = {
  marginTop: 18, padding: '14px 18px',
  background: '#FAF7F2', border: '1px dashed #D4C4B0', borderRadius: 10,
};

const dtStyle: React.CSSProperties = {
  color: '#A08060', fontSize: 11, letterSpacing: '0.04em',
  minWidth: 44, flexShrink: 0,
};

const ddStyle: React.CSSProperties = {
  margin: 0, color: '#3D3730',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px',
  color: '#7A6145', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'top',
  color: '#3D3730', lineHeight: 1.6,
};

function row(): React.CSSProperties {
  return { display: 'flex', gap: 8 };
}
