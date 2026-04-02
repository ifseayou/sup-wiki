-- SUP Wiki 种子数据
-- 初始品牌、产品、运动员、博主数据

USE sport_hacker;

-- =====================
-- 品牌数据
-- =====================
INSERT INTO sup_brands (slug, name, name_en, country, website, description, tier) VALUES
('red-paddle-co', 'Red Paddle Co', 'Red Paddle Co', '英国', 'https://redpaddleco.com', 'Red Paddle Co 是全球领先的充气桨板品牌，以其高品质的 MSL 材料和创新设计著称。专注于充气桨板领域，产品覆盖全能、竞速、巡游等多个系列。', 'pro'),
('starboard', 'Starboard', 'Starboard', '泰国', 'https://star-board.com', 'Starboard 是世界顶级水上运动品牌，拥有丰富的硬板和充气板产品线。多次赞助世界冠军级运动员，技术创新能力强。', 'pro'),
('fanatic', 'Fanatic', 'Fanatic', '德国', 'https://www.fanatic.com', 'Fanatic 是德国老牌水上运动品牌，产品线涵盖风帆、桨板、风筝冲浪等。以德国工艺著称，品质稳定可靠。', 'pro'),
('naish', 'Naish', 'Naish', '美国', 'https://www.naish.com', 'Naish 由传奇风筝冲浪手 Robby Naish 创立，是美国知名水上运动品牌。产品覆盖桨板、风筝冲浪、水翼板等。', 'pro'),
('nsp', 'NSP', 'NSP', '美国', 'https://www.nspsurfboards.com', 'NSP (New Surf Project) 专注于冲浪和桨板，以高性价比著称。产品适合从入门到进阶的各类玩家。', 'intermediate'),
('aqua-marina', '乐划', 'Aqua Marina', '中国', 'https://www.aquamarina.com', 'Aqua Marina（乐划）是中国领先的充气水上运动装备品牌，产品远销全球100多个国家。性价比高，适合入门玩家。', 'entry'),
('decathlon', '迪卡侬', 'Decathlon', '法国', 'https://www.decathlon.com', '迪卡侬是全球知名的运动用品零售商，旗下 ITIWIT 品牌提供高性价比的桨板产品，非常适合入门玩家。', 'entry'),
('molokai', 'MOLOKAI', 'MOLOKAI', '中国', 'https://molokai.cn', 'MOLOKAI 是国内新兴的桨板品牌，专注于充气桨板市场，产品设计时尚，性价比高。', 'entry'),
('funwater', 'Funwater', 'Funwater', '中国', NULL, 'Funwater 是中国电商平台上热销的充气桨板品牌，以极高的性价比吸引入门玩家。', 'entry'),
('sic-maui', 'SIC Maui', 'SIC Maui', '美国', 'https://sicmaui.com', 'SIC Maui 源自夏威夷，是专业竞速桨板品牌。产品被众多职业运动员使用，在竞速领域有很高声誉。', 'pro');

-- =====================
-- 产品数据
-- =====================
INSERT INTO sup_products (brand_id, model, type, length_cm, width_cm, thickness_cm, weight_kg, material, max_load_kg, suitable_for, price_min, price_max, description) VALUES
-- Red Paddle Co
(1, 'Ride 10''6"', 'allround', 320, 81, 12, 8.6, 'MSL Fusion', 120, 'beginner', 8999, 9999, 'Red Paddle Co 最畅销的全能板，适合各种水域和技能水平。'),
(1, 'Sport 11''3"', 'touring', 343, 76, 12, 8.5, 'MSL Fusion', 110, 'intermediate', 9499, 10499, '专为长距离巡游设计，更快更高效。'),
(1, 'Elite 14'' x 27"', 'race', 427, 69, 15, 10.5, 'MSL Fusion', 110, 'advanced', 14999, 15999, '专业竞速板，ICF 认证，适合比赛使用。'),

-- Starboard
(2, 'Generation 12''6" x 28"', 'allround', 381, 71, 15, 9.0, 'Deluxe DC', 120, 'intermediate', 7999, 8999, '多功能全能板，适合巡游和轻度竞速。'),
(2, 'Sprint 14'' x 23.5"', 'race', 427, 60, 15, 11.0, 'Carbon', 100, 'advanced', 29999, 32999, '顶级竞速碳纤维硬板，世界冠军选择。'),
(2, 'Zen 10''5" x 32"', 'allround', 320, 81, 15, 8.0, 'Zen Lite', 110, 'beginner', 5999, 6999, '入门级全能板，稳定性好。'),

-- Aqua Marina
(6, 'Fusion 10''10"', 'allround', 330, 81, 15, 9.5, 'Drop Stitch', 150, 'beginner', 1999, 2499, '入门级全能板，稳定性好，适合初学者。'),
(6, 'Beast 10''6"', 'allround', 320, 81, 15, 10.0, 'Drop Stitch', 140, 'beginner', 2299, 2799, '加宽设计，更稳定，适合体重较大的玩家。'),
(6, 'Race 12''6"', 'race', 381, 71, 15, 9.0, 'Drop Stitch', 120, 'intermediate', 2999, 3499, '入门级竞速板，性价比高。'),

-- 迪卡侬
(7, 'ITIWIT X100 10''', 'allround', 305, 76, 15, 9.0, 'Drop Stitch', 130, 'beginner', 999, 1299, '迪卡侬入门款，价格亲民。'),
(7, 'ITIWIT X500 13''', 'touring', 396, 71, 15, 10.0, 'Drop Stitch', 130, 'intermediate', 2499, 2999, '巡游板，适合长距离划行。');

-- =====================
-- 运动员数据
-- =====================
INSERT INTO sup_athletes (name, name_en, nationality, discipline, icf_ranking, bio, achievements, social_links) VALUES
('Michael Booth', 'Michael Booth', '澳大利亚', 'race', 1, 'Michael Booth 是澳大利亚顶级桨板运动员，多次获得世界冠军。', '[{"year": 2023, "event": "ICF SUP World Championships", "result": "金牌"}, {"year": 2022, "event": "APP World Tour", "result": "总冠军"}]', '{"instagram": "https://instagram.com/michaelboothsup"}'),
('Connor Baxter', 'Connor Baxter', '美国', 'race', 2, 'Connor Baxter 来自夏威夷，是桨板界的传奇人物，技术全面。', '[{"year": 2022, "event": "Molokai 2 Oahu", "result": "冠军"}, {"year": 2021, "event": "ICF SUP World Championships", "result": "银牌"}]', '{"instagram": "https://instagram.com/connnorbaxter", "youtube": "https://youtube.com/connorbaxter"}'),
('Sonni Hönscheid', 'Sonni Hönscheid', '德国', 'distance', 3, 'Sonni Hönscheid 是德国女子桨板运动员，专攻长距离项目。', '[{"year": 2023, "event": "ICF SUP World Championships", "result": "女子金牌"}]', '{"instagram": "https://instagram.com/sonnihonscheid"}'),
('Seychelle Hattingh', 'Seychelle Hattingh', '南非', 'race', 5, 'Seychelle Hattingh 是南非女子桨板新星，近年成绩突飞猛进。', '[{"year": 2023, "event": "Euro Tour", "result": "总冠军"}]', NULL),
('Bruno Hasulyo', 'Bruno Hasulyo', '匈牙利', 'race', 8, 'Bruno Hasulyo 和他的兄弟 Daniel 是匈牙利桨板双子星。', '[{"year": 2022, "event": "European Championships", "result": "金牌"}]', '{"instagram": "https://instagram.com/brunohasulyo"}');

-- =====================
-- 博主/KOL 数据
-- =====================
INSERT INTO sup_creators (nickname, platform, follower_tier, content_style, bio, profile_url) VALUES
('桨板老王', 'douyin', '100k-1m', 'tutorial', '专业桨板教练，分享桨板技巧和安全知识。10年桨板经验。', 'https://www.douyin.com/user/xxx'),
('SUP小美', 'xiaohongshu', '10k-100k', 'vlog', '分享桨板生活和旅行，带你发现国内最美的桨板地点。', 'https://www.xiaohongshu.com/user/xxx'),
('水上飞人', 'bilibili', '10k-100k', 'review', '专注桨板装备测评，买板前看我的视频不踩坑！', 'https://space.bilibili.com/xxx'),
('Paddle with Lucy', 'youtube', '100k-1m', 'tutorial', '国际桨板教练，双语教学，适合华人和外国人学习。', 'https://www.youtube.com/@paddlewithlucy'),
('极限探险家', 'douyin', '10k-100k', 'adventure', '带着桨板去冒险，记录极限水域的探索。', 'https://www.douyin.com/user/xxx');
