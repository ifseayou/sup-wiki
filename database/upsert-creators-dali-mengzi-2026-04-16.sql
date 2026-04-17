UPDATE sup_creators
SET
  nickname = '大力桨板',
  avatar = 'https://i1.hdslb.com/bfs/face/dd9db73031d27d5bd2538c468460e2fd8ee78f9f.jpg',
  bio = '专注站立式桨板入门教学的内容创作者，持续输出桨板结构、基础动作和新手教学内容，适合作为中文 SUP 入门学习账号关注。',
  platform = 'bilibili',
  follower_tier = '1k-10k',
  content_style = 'tutorial',
  region = 'domestic',
  profile_url = 'https://space.bilibili.com/487021384',
  status = 'published'
WHERE nickname = '大力桨板';

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
)
SELECT
  '划桨板的猛子',
  'https://i2.hdslb.com/bfs/face/39f4dffcf4c9d95bd6ee5f8d4ba5aeabfe850921.jpg',
  '以训练记录、城市水域划行和赛事现场为核心内容的桨板创作者，公开资料可见其以“国家桨板运动员”身份持续发布深圳大鹏等水域的桨板内容。',
  'bilibili',
  '1k-10k',
  'vlog',
  'domestic',
  'https://space.bilibili.com/1650134456',
  'published'
WHERE NOT EXISTS (
  SELECT 1
  FROM sup_creators
  WHERE nickname = '划桨板的猛子'
);
