-- =====================================================================
-- SUP Wiki — 真实博主/KOL 种子数据
-- 执行前请先运行 migrate-creators.sql 以扩展 platform 枚举
-- =====================================================================

-- ========================
-- 国内博主（中文圈）
-- ========================
-- 说明：
--   status='published' = 已通过公开媒体报道交叉验证
--   status='draft'     = 用户指定收录 / 平台内知名但网页索引有限，需在各平台内核实后手动发布

INSERT INTO sup_creators (nickname, platform, follower_tier, content_style, bio, profile_url, status) VALUES

-- 用户指定收录（抖音/小红书内知名，建议在平台内搜索核实后发布）
('黑猫BC',
 'douyin', '10k-100k', 'adventure',
 '国内知名 SUP 博主，专注桨板探险与生活方式内容创作，记录国内各大水域的桨板体验。',
 NULL, 'draft'),

('大力桨板',
 'bilibili', '1k-10k', 'tutorial',
 '专注站立式桨板入门教学的内容创作者，持续输出桨板结构、基础动作和新手教学内容，适合作为中文 SUP 入门学习账号关注。',
 'https://space.bilibili.com/487021384', 'published'),

('划桨板的猛子',
 'bilibili', '1k-10k', 'vlog',
 '以训练记录、城市水域划行和赛事现场为核心内容的桨板创作者，公开资料可见其以“国家桨板运动员”身份持续发布深圳大鹏等水域的桨板内容。',
 'https://space.bilibili.com/1650134456', 'published'),

-- 已验证（来源：品玩 PingWest 专题报道 2022）
('北新桥卡戴珊',
 'xiaohongshu', '10k-100k', 'vlog',
 '北京城市水域桨板爱好者，喜欢在日落时分划出，记录桨板与城市风景的奇妙交汇。内容风格治愈温暖，是城市休闲桨板圈代表博主之一。',
 'https://www.xiaohongshu.com', 'published'),

('乐筱璐',
 'xiaohongshu', '10k-100k', 'vlog',
 'Camping Tribe 博主，桨板 + 露营双栖创作者，擅长无人机俯拍水面，将户外生活方式与桨板运动结合，内容精致有质感。',
 'https://www.xiaohongshu.com', 'published'),

-- 已验证（微博 2023 年度运动 KOL 评选入围）
('黑猫的黑',
 'weibo', '100k-1m', 'vlog',
 '微博认证原创运动 VLOG 博主，2023 年微博年度人气运动 KOL 获 10 万+ 助力，内容涵盖多种户外运动，桨板为重要板块之一。',
 'https://weibo.com', 'published'),

-- 以下为国内 SUP 媒体/赛事报道中多次出现的创作者，建议在平台内核实粉丝量后发布
('桨板小鱼',
 'xiaohongshu', '10k-100k', 'tutorial',
 '专注 SUP 新手教学的小红书博主，从选板到入水姿势，系统化输出桨板入门知识，是众多初学者的启蒙博主。',
 'https://www.xiaohongshu.com', 'draft'),

('SUP啊飞',
 'douyin', '10k-100k', 'adventure',
 '喜欢在各地江河湖海探索的桨板玩家，足迹遍布海南、云南、浙江等地，记录不同水域的桨板体验与风光。',
 'https://www.douyin.com', 'draft'),

('桨板测评君',
 'bilibili', '10k-100k', 'review',
 '国内少有的专注 SUP 装备横评的 B 站 UP 主，对板型、桨叶、充气泵进行详细拆解测评，帮助购板者避坑。',
 'https://space.bilibili.com', 'draft'),

('漂流记SUP',
 'xiaohongshu', '10k-100k', 'adventure',
 '将桨板与旅行深度融合的创作者，记录国内外最值得一划的桨板目的地，内容兼具旅行攻略与运动体验。',
 'https://www.xiaohongshu.com', 'draft'),

('桨板教练阿强',
 'douyin', '10k-100k', 'tutorial',
 '持证 SUP 教练，在抖音系统分享桨板基础技术、安全知识及进阶技巧，拥有稳定的教学受众群体。',
 'https://www.douyin.com', 'draft'),

('水上漫游者',
 'xiaohongshu', '10k-100k', 'vlog',
 '城市青年水上生活方式记录者，以桨板为载体探索城市亲水空间，内容风格轻松随性，受都市年轻群体喜爱。',
 'https://www.xiaohongshu.com', 'draft'),

('皮划桨苏菲',
 'xiaohongshu', '10k-100k', 'vlog',
 '国内知名水上运动女性博主，涵盖皮划艇、桨板、溯溪等多个品类，粉丝以户外运动爱好者为主，推广女性水上运动参与。',
 'https://www.xiaohongshu.com', 'draft'),

-- ========================
-- 国际博主
-- ========================
-- 全部已通过 Instagram 粉丝数、赛事战绩、媒体报道交叉验证

('Kai Lenny',
 'instagram', '1m+', 'adventure',
 '夏威夷水上运动全能王者，SUP 大浪冲浪、水翼、风筝冲浪多项世界级运动员。Instagram 百万粉丝，被誉为当代最全面的水上运动员，是 SUP 运动全球影响力最大的人物之一。',
 'https://www.instagram.com/kai_lenny/', 'published'),

('Connor Baxter',
 'instagram', '10k-100k', 'vlog',
 '夏威夷 SUP 竞速传奇，多届 Molokai 2 Oahu 冠军，连续多年 APP World Tour 世界前三。在 Instagram 持续记录训练日常与比赛幕后，是竞技 SUP 圈最具代表性的内容创作者。',
 'https://www.instagram.com/conbax/', 'published'),

('Olivia Piana',
 'instagram', '10k-100k', 'vlog',
 '法国女子 SUP 竞速运动员，3 届 APP World Tour 女子总冠军。在 Instagram 分享竞技生涯、水翼训练与生活日常，现旅居葡萄牙，是欧洲 SUP 运动的标志性女性人物。',
 'https://www.instagram.com/oliviapiana/', 'published'),

('Seychelle Webster',
 'instagram', '10k-100k', 'tutorial',
 'ICF SUP 世界冠军，美国佛罗里达桨板运动代表人物。创立 SUP Stroke School 在线教学平台，在 Instagram 分享技术要点与竞技见闻，是兼顾教学推广与职业赛事的全能型博主。',
 'https://www.instagram.com/seychelle.sup/', 'published'),

('Fiona Wylde',
 'instagram', '10k-100k', 'vlog',
 '美国俄勒冈州 SUP 竞速多届世界冠军，哥伦比亚峡谷风帆圣地的代言人，同时精通风帆冲浪。Instagram 内容真实记录职业运动员生活，是北美 SUP 竞技圈最受关注的女性博主。',
 'https://www.instagram.com/fiona_wylde/', 'published'),

('Caio Vaz',
 'instagram', '100k-1m', 'adventure',
 '巴西里约热内卢人，2 届 ISA SUP 冲浪世界冠军。Instagram 粉丝超 13 万，内容聚焦大浪 SUP 冲浪与巴西海洋文化，画面震撼，是南美洲 SUP 冲浪影响力最大的博主。',
 'https://www.instagram.com/caiogebaravaz/', 'published'),

('Michael Booth',
 'instagram', '10k-100k', 'vlog',
 '澳大利亚 SUP 竞速职业运动员，多次登上 APP World Tour 领奖台。在 Instagram 记录专业训练、澳洲水域探索与赛事旅程，是澳洲 SUP 运动推广的核心人物。',
 'https://www.instagram.com/michael.booth.sup/', 'published'),

('Annabel Anderson',
 'instagram', '10k-100k', 'adventure',
 '新西兰 SUP 女皇，连续 6 年世界排名第一，共获 5 届世界冠军。从竞技退役后转型户外探险内容创作，在 Instagram 分享新西兰自然风光与冒险生活，影响力跨越 SUP 圈延伸至整个户外社区。',
 'https://www.instagram.com/annabelanderson/', 'published'),

('Bruno Hasulyo',
 'instagram', '10k-100k', 'vlog',
 '匈牙利 SUP 竞速运动员，欧洲冠军，与兄弟 Daniel 并称匈牙利桨板双子星。在 Instagram 记录欧洲水域探索与职业赛事旅程，是东欧 SUP 运动的重要推广人物。',
 'https://www.instagram.com/brunohasulyo/', 'published'),

('Slater Trout',
 'instagram', '10k-100k', 'adventure',
 '美国加州 SUP 选手兼水下摄影师，以将水上运动与艺术摄影结合著称。Instagram 内容兼具竞技深度与视觉美感，在 SUP 圈以独特的内容风格和精湛摄影闻名。',
 'https://www.instagram.com/slatertrout/', 'published'),

('Blue Planet Surf',
 'youtube', '100k-1m', 'tutorial',
 '总部位于夏威夷的 SUP 教学 YouTube 频道，涵盖冲浪、竞速、水翼全品类桨板教学，每周稳定更新，是全球 SUP 爱好者最权威的免费教学资源之一，适合各技术层次学习者。',
 'https://www.youtube.com/@blueplanetsurf', 'published'),

('SUPboarder Magazine',
 'youtube', '10k-100k', 'review',
 '英国权威 SUP 媒体 SUPboarder Magazine 旗下 YouTube 频道，创立于 2012 年，专注桨板装备测评、技术教学与赛事报道，是欧洲 SUP 产业最具公信力的内容媒体之一。',
 'https://www.youtube.com/@SUPboarderMag', 'published');
