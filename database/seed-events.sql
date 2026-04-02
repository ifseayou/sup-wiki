-- SUP Wiki 赛事种子数据
-- 国内 SUP 桨板赛事

USE sport_hacker;

INSERT INTO sup_events (name, name_en, slug, event_type, location, province, city, venue, start_date, end_date, registration_deadline, organizer, description, requirements, website, registration_url, contact_info, disciplines, price_range, status, event_status) VALUES

-- 1. 千岛湖桨板公开赛
('千岛湖国际桨板公开赛', 'Qiandao Lake International SUP Open', 'qiandaohu-sup-open-2025',
 'race', '浙江省杭州市淳安县千岛湖', '浙江', '杭州', '千岛湖风景区核心区水域',
 '2025-08-15', '2025-08-17', '2025-08-01',
 '中国桨板运动协会 & 淳安县体育局',
 '千岛湖国际桨板公开赛是华东地区规模最大的SUP赛事之一，赛场依托千岛湖得天独厚的自然水域，湖面开阔、水质清澈、风景壮美。赛事吸引来自全国及亚太地区的专业选手和爱好者参与，是一场集竞技、休闲、观光于一体的水上运动盛事。',
 '年龄18周岁以上，具备基本桨板技能，需提交游泳能力证明或现场测试通过。',
 'https://www.qiandaolakesup.com',
 'https://www.qiandaolakesup.com/register',
 '咨询电话：0571-xxxxxxxx',
 '["race", "distance", "technical"]',
 '¥300-¥500',
 'published', 'upcoming'),

-- 2. 海南万宁国际SUP赛
('海南万宁国际SUP冲浪邀请赛', 'Wanning International SUP Surfing Invitational', 'wanning-sup-surf-2025',
 'race', '海南省万宁市日月湾', '海南', '万宁', '日月湾超级海滩',
 '2025-10-20', '2025-10-23', '2025-10-05',
 '中国冲浪协会 & 万宁市人民政府',
 '依托日月湾世界级冲浪条件，本赛事汇聚国内外顶级SUP冲浪高手。赛事包含短程竞速、长距离耐力赛及技术动作三项竞技内容，是国内最具影响力的海浪SUP专项赛事。',
 '需具备一定SUP冲浪基础，国际组参赛者须提供ICF或ISA积分证明。',
 'https://www.wanningsup.com',
 'https://www.wanningsup.com/entry',
 '微信公众号：万宁SUP',
 '["surf", "race"]',
 '¥400-¥800',
 'published', 'upcoming'),

-- 3. 大理洱海桨板马拉松
('大理洱海桨板马拉松', 'Dali Erhai SUP Marathon', 'dali-erhai-sup-marathon-2025',
 'race', '云南省大理白族自治州洱海', '云南', '大理', '洱海公园至双廊水域',
 '2025-09-06', '2025-09-07', '2025-08-20',
 '大理州体育局 & 云南桨板运动推广协会',
 '洱海桨板马拉松全程约25公里，沿苍山洱海绝美风光竞渡。赛事以"绿色环保、保护洱海"为主题，每位参赛者均需完成赛前生态保护培训。设专业组、业余组及家庭亲子组，欢迎不同水平的爱好者报名参与。',
 '专业组要求近一年内有桨板长距离赛事成绩，业余组无特殊限制但须具备基本桨板技能。',
 NULL,
 NULL,
 '联系邮箱：sup@dali-sports.cn',
 '["distance"]',
 '¥250-¥400',
 'published', 'upcoming'),

-- 4. 青岛国际桨板邀请赛
('青岛国际桨板邀请赛', 'Qingdao International SUP Invitational', 'qingdao-sup-invitational-2025',
 'race', '山东省青岛市西海岸新区金沙滩', '山东', '青岛', '金沙滩海水浴场',
 '2025-07-18', '2025-07-20', '2025-07-05',
 '青岛市体育局 & 中国海洋大学',
 '青岛国际桨板邀请赛是北方最具代表性的海上SUP赛事，借助青岛优质的海洋环境和深厚的帆船运动基础，赛事规格逐年提升。本届赛事设竞速、长距离、接力三个项目，并设有青少年组别，致力于推动桨板运动在青少年群体中的普及。',
 '16周岁以上，持有效游泳能力证明，青少年组需家长陪同报名。',
 'https://www.qdsupinvitational.cn',
 'https://www.qdsupinvitational.cn/signup',
 '咨询微信：qdsup2025',
 '["race", "distance", "relay"]',
 '¥200-¥350',
 'published', 'completed'),

-- 5. 西湖桨板嘉年华
('西湖桨板嘉年华暨桨板技术交流赛', 'West Lake SUP Carnival', 'westlake-sup-carnival-2025',
 'festival', '浙江省杭州市西湖风景区', '浙江', '杭州', '西湖白堤-断桥水域',
 '2025-06-07', '2025-06-08', '2025-05-25',
 '杭州市西湖风景名胜区管委会 & 浙江桨板运动协会',
 '西湖桨板嘉年华以"运动西湖，美美与共"为主题，是一场集桨板技术展示、文化体验与休闲娱乐于一体的水上运动节。活动设技术动作展示赛、新手体验区、品牌展览及文创市集，是接触桨板运动的绝佳入门机会。',
 '技术赛组要求具备基本桨板操控能力；体验区开放给零基础人群，赛前有专业教练指导。',
 NULL,
 NULL,
 '联系电话：0571-xxxxxxxx',
 '["technical", "race"]',
 '¥0-¥150（体验免费，比赛收费）',
 'published', 'completed'),

-- 6. 三亚亚龙湾SUP挑战赛
('三亚亚龙湾SUP公开挑战赛', 'Sanya Yalong Bay SUP Open Challenge', 'sanya-yalong-sup-challenge-2026',
 'race', '海南省三亚市亚龙湾', '海南', '三亚', '亚龙湾国家旅游度假区',
 '2026-01-10', '2026-01-12', '2025-12-20',
 '三亚市旅游推广局 & 亚龙湾旅游区管委会',
 '依托亚龙湾热带海洋气候和优质的海水条件，本赛事在冬季为全国桨板爱好者提供一个高品质的比赛和交流平台。赛事设立女子组、男子组和混合接力组，优胜者将获得国际积分推荐资格。',
 '年龄16周岁以上，具备基本桨板技能，持有效健康证明。',
 'https://www.sanyasup.com',
 'https://www.sanyasup.com/register',
 '微信公众号：三亚桨板',
 '["race", "distance", "relay"]',
 '¥350-¥600',
 'published', 'upcoming'),

-- 7. 北京怀柔水库SUP训练营及友谊赛
('北京怀柔水库SUP夏季训练营暨友谊赛', 'Beijing Huairou Reservoir SUP Summer Camp', 'beijing-huairou-sup-camp-2025',
 'training', '北京市怀柔区怀柔水库', '北京', '北京', '怀柔水库南岸训练基地',
 '2025-07-05', '2025-07-07', '2025-06-25',
 '北京水上运动中心 & 怀柔体育局',
 '三天两夜的专业桨板训练营，由国家队教练担任技术指导，包含理论课、技术精进训练和结营友谊赛。课程涵盖桨法优化、转向技巧、体能训练等内容，适合有一定基础希望进阶提高的爱好者。',
 '具备基本桨板技能（可自行直线划行），年龄18周岁以上。',
 NULL,
 NULL,
 '报名微信：bjsupcamp',
 '["race", "technical", "distance"]',
 '¥1200（含食宿及装备）',
 'published', 'completed');
