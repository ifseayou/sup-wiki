-- SUP Wiki — 学习文档：SUP 赛制入门
-- 表：sup_learn_articles（见 migrate-learn.sql）

SET NAMES utf8mb4;

DELETE FROM sup_learn_articles WHERE slug = 'sup-race-formats-distance-technical-sprint';

INSERT INTO sup_learn_articles (title, slug, category, summary, content, difficulty, sort_order, status) VALUES
(
  'SUP 赛制入门：Distance、Technical、Sprint 有什么区别',
  'sup-race-formats-distance-technical-sprint',
  'race',
  'Distance、Technical、Sprint 是 SUP / 桨板比赛中最常见的三类赛制。本文用长距离、技术绕标和短距离冲刺三个维度讲清它们分别考验什么能力，以及如何对应训练目标。',
  '## 先记住一句话

在 SUP / 桨板比赛里，**Distance、Technical、Sprint** 通常代表三种不同赛制：

- **Distance**：长距离耐力赛
- **Technical**：技术赛 / 技术绕标赛
- **Sprint**：短距离冲刺赛

它们不是同一种能力的简单距离差异，而是分别考验耐力、控板综合能力和爆发速度。

## 1. Distance：长距离赛

**Distance = 长距离耐力赛。**

它的特点是距离更长，主要考验：

- 体能耐力
- 配速能力
- 航线判断
- 风浪、水流适应能力
- 长时间稳定划行技术

常见距离包括：

- 3 公里
- 6 公里
- 10 公里
- 12 公里
- 15 公里以上

如果你关注的是 **6 公里长距离**，它就属于 Distance 类赛事。

简单理解：**Distance 看的是“谁能稳定、持续、高效地划完全程”。**

## 2. Technical：技术赛 / 技术绕标赛

**Technical = 技术赛，通常是绕浮标的综合比赛。**

它不是单纯直线划，而是会设置多个浮标、转弯点，有时还包括冲浪区、上下板、沙滩起跑等元素。

Technical 主要考验：

- 起航爆发
- 绕标转弯技术
- 控板能力
- 加速减速能力
- 对抗中的路线选择
- 风浪环境下的稳定性

Technical 比赛经常会看到选手：

- 快速冲刺起步
- 绕浮标转向
- 板尾下压转弯
- 多人卡位
- 冲刺终点

简单理解：**Technical 看的是“综合能力”，不仅要快，还要会转弯、会控板、会处理复杂赛道。**

## 3. Sprint：短距离冲刺赛

**Sprint = 短距离竞速赛。**

这类比赛一般距离很短，核心是爆发力和最高速度。

常见距离包括：

- 100 米
- 200 米
- 250 米
- 500 米

国内外桨板赛事里，**200 米竞速** 很常见，就属于 Sprint。

Sprint 主要考验：

- 起步爆发
- 高频划桨
- 最大功率输出
- 短时间乳酸耐受
- 直线稳定性
- 冲刺节奏

简单理解：**Sprint 看的是“短时间谁最快”。**

## 三者区别可以这样记

| 类型 | 中文理解 | 核心能力 | 类比 |
|------|----------|----------|------|
| Distance | 长距离赛 | 耐力、配速、稳定性 | 马拉松 / 中长跑 |
| Technical | 技术赛 | 控板、转弯、对抗、综合能力 | 障碍赛 / 绕标赛 |
| Sprint | 冲刺赛 | 爆发力、最高速度 | 100 米 / 200 米短跑 |

## 对训练目标的启发

如果你的目标是 **6 公里 36 分钟**，主要对应的是 **Distance 能力**。训练重点应该放在：

- 稳定巡航速度
- 长时间技术不变形
- 配速和心率控制
- 风浪、水流中的效率

但如果你想参加更完整的桨板赛事，Technical 和 Sprint 也需要练：

- **Technical** 补控板能力、绕标能力和复杂赛道处理能力
- **Sprint** 补起步爆发、最高速度和短时间功率输出

## 小结

SUP 比赛里的 Distance、Technical、Sprint 分别代表三种不同能力模型：

- Distance：稳定、持续、高效
- Technical：会转、会控、会处理变化
- Sprint：短时间爆发和最高速度

理解这三类赛制后，再看成绩册、报名项目和年度积分分项时，就能更清楚自己适合什么项目，也知道下一阶段训练该补哪一块。',
  'beginner',
  12,
  'published'
);

SELECT article_id, title, slug, category, difficulty, status
FROM sup_learn_articles
WHERE slug = 'sup-race-formats-distance-technical-sprint';
