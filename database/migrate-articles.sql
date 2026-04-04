-- migrate-articles.sql: 新增 sup_articles 表（科普文章，用于赛事页顶部 Tab 展示）

CREATE TABLE IF NOT EXISTS sup_articles (
  article_id  INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  slug        VARCHAR(200) NOT NULL UNIQUE,
  category    VARCHAR(50)  NOT NULL DEFAULT 'event_guide',
  summary     TEXT,
  content     LONGTEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  status      ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 初始数据：中国赛事体系
INSERT INTO sup_articles (title, slug, category, summary, content, sort_order, status) VALUES (
  '中国桨板赛事体系',
  'china-event-system',
  'event_guide',
  '全面梳理国内 SUP 桨板竞技赛事的层级结构，涵盖全国冠军赛、俱乐部联赛等核心赛事，帮助你了解如何从地方赛事一步步走向全国舞台。',
  '## 全国桨板冠军赛

全国桨板冠军赛是由**国家体育总局水上运动管理中心**主办的国内最高级别桨板竞技赛事，每年举办一届，设精英组、公开组、大师组及青少年各年龄组。精英组为职业选手角逐舞台，成绩可计入国家积分排名。2024年总决赛在苏州古城河畔举行，吸引全国573名选手参赛。

## 中国桨板俱乐部联赛（CPL）

中国桨板俱乐部联赛（China Paddle League）是国内赛季跨度最长、站点最多的大众赛事联赛，每年设 6–8 个分站赛，覆盖华东、华南、西南等地区，年度总决赛通常在秋季举行。联赛设公开组、大师组、卡胡纳组、高校组等多个组别，6000 米长距离赛和 200 米竞速赛为核心项目，吸引来自全国 20+ 省份的运动员参赛。

## 中国桨板公开赛

中国桨板公开赛由地方体育局或赛事公司承办，通常邀请国内外顶尖运动员参赛，部分站点同时举办亚洲杯赛事，兼具竞技水准与国际交流价值。2024 年青田站引进 ICF 认证精英组别，成为国内赛事对接国际体系的重要窗口。

## 全国全民健身大赛桨板项目

由国家体育总局指导，面向大众健身群体，赛制更加灵活，门槛低、参与广，是众多桨板爱好者的入门竞技平台。桨板项目自 2022 年起正式纳入全国全民健身大赛赛事体系。

## 各省级赛事与地方联赛

各省（自治区、直辖市）体育局或水上运动协会每年组织省级锦标赛，是全国冠军赛的选拔预备赛道。广东、浙江、重庆、湖北等桨板运动强省均有完善的省级赛事体系。此外，各地还有形式多样的城市公开赛、湖库赛等大众活动，构成桨板运动的基层生态。

## 赛事层级一览

| 级别 | 代表赛事 | 主办方 |
|------|----------|--------|
| 国家最高级 | 全国桨板冠军赛 | 国家体育总局水上中心 |
| 职业联赛 | 中国桨板俱乐部联赛（CPL） | 中国桨板协会 |
| 国际认证 | 中国桨板公开赛（含亚洲杯站） | 地方体育局/承办公司 |
| 大众健身 | 全国全民健身大赛桨板项目 | 国家体育总局 |
| 省市基层 | 各省级锦标赛、城市公开赛 | 省级水上运动协会 |',
  0,
  'published'
);

-- 初始数据：国际赛事体系
INSERT INTO sup_articles (title, slug, category, summary, content, sort_order, status) VALUES (
  '国际桨板赛事体系',
  'international-event-system',
  'event_guide',
  '介绍全球主流 SUP 桨板竞技赛事组织与赛事体系，从 ICF 世锦赛到 APP World Tour，帮助你认识国际顶级赛场。',
  '## ICF 世界桨板锦标赛

**国际皮划艇联合会（ICF）** 是 SUP 竞速项目的最高国际管理机构，于 2012 年将桨板正式纳入管辖。ICF 世界桨板锦标赛每两年举办一届，设 200 米冲刺、500 米技术赛、长距离赛（12km+）等项目，是国际桨板竞速领域的最高荣誉。中国国家队在近年 ICF 赛事中持续取得突破，蒋磊、陈澄灏等运动员均曾登上国际领奖台。

## ISA 世界立式桨板与桨泳锦标赛

**国际冲浪协会（ISA）** 主导的世界立式桨板锦标赛更侧重冲浪 SUP 及综合赛项，与 ICF 共同形成国际桨板两大权威体系。ISA 赛事通常在海浪环境中进行，对运动员的平衡与技巧要求更高。

## APP World Tour

**冒险桨板职业巡回赛（Adventure Paddle Professionals World Tour）** 是全球规格最高的职业桨板巡回赛，每年设多个洲际站点，涵盖长距离赛、冲刺赛及海浪赛，顶尖职业选手通过积分竞争年度总冠军。康纳·巴克斯特（Connor Baxter）、迈克尔·布斯（Michael Booth）等世界名将均为 APP 的常胜将军。

## EuroTour 欧洲巡回赛

EuroTour 是欧洲最具影响力的桨板赛事系列，每年夏季在地中海、北海等地举行多站比赛，吸引来自欧洲各国的职业及业余运动员参赛，是欧洲桨板运动发展的核心平台。

## 亚洲桨板锦标赛

亚洲桨板锦标赛（Asia Paddle Championship）近年来逐步走向成熟，中国、日本、澳大利亚等亚太国家轮流承办，设精英组与业余组，是亚洲运动员对标国际水平的重要舞台。2025 年亚洲桨板公开赛在浙江青田和四川青神分别举办，吸引来自亚洲 10+ 国家和地区的 845 名运动员参赛。

## 国际赛事组织一览

| 组织 | 全称 | 核心赛事 |
|------|------|----------|
| ICF | 国际皮划艇联合会 | ICF 世界桨板锦标赛 |
| ISA | 国际冲浪协会 | ISA 世界立式桨板锦标赛 |
| APP | 冒险桨板职业赛 | APP World Tour |
| — | 欧洲桨板联合会 | EuroTour |
| — | 亚太桨板赛事委员会 | 亚洲桨板锦标赛 |',
  1,
  'published'
);
