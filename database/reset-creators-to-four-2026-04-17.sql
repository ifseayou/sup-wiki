DELETE FROM sup_creators;

INSERT INTO sup_creators (
  nickname,
  avatar,
  bio,
  platform,
  follower_tier,
  content_style,
  region,
  profile_url,
  status
) VALUES
(
  '大力桨板',
  '/creator-import/dali.png',
  '专注站立式桨板教学与基础动作分享的内容创作者，内容以入门技巧、器材认知和日常划行训练为主，适合新手建立稳定的 SUP 基础。',
  'bilibili',
  '1k-10k',
  'tutorial',
  'domestic',
  'https://space.bilibili.com/487021384',
  'published'
),
(
  '黑猫BC',
  '/creator-import/heimao-bc.png',
  '长期分享桨板日常、装备体验和水域出行内容的中文桨板博主，风格直接，兼具玩家视角与户外生活方式表达。',
  'bilibili',
  '1k-10k',
  'vlog',
  'domestic',
  NULL,
  'published'
),
(
  'Bill桨真的',
  '/creator-import/bill-jiangzhende.png',
  '以真实下水体验、训练片段和划行交流内容为主的桨板博主，内容偏实战型，适合关注水上体验与技术交流的读者。',
  'bilibili',
  '1k-10k',
  'vlog',
  'domestic',
  NULL,
  'published'
),
(
  '郑浩',
  'https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/athletes/1775294279999-xzsa0v.png',
  '中国桨板竞速运动员，同时收录为桨板内容观察对象。公开资料显示，他长期参加全国桨板锦标赛、冠军赛及 CPL 等赛事，是国内公开组具有代表性的竞速选手。',
  'douyin',
  '1k-10k',
  'vlog',
  'domestic',
  NULL,
  'published'
);
