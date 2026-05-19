-- SUP Wiki — initial course + technique data

USE sport_hacker;

INSERT INTO sup_techniques (source_code, name, stage, stage_label, level, category, points, key_points, common_errors, sort_order, status) VALUES
('01','上下水',1,'跪姿基础','beginner','foundation',1,'从岸边或浅水区侧身趴板，双手撑板慢慢爬上，重心落在板中线后再跪起；下板顺序相反。关键是上板前先平衡好桨和自己再做动作。','正面直立上板 → 板头瞬间被压翻。',1,'published'),
('02','跪姿直线',1,'跪姿基础','beginner','paddling',1,'双膝与板宽同宽跪稳，上身直立、核心收紧。桨叶入水尽量贴近板身，左右两桨幅度一致让板走直线。','单边连续划 → 板越划越歪。',2,'published'),
('03','跪姿扫桨转向（前后）',1,'跪姿基础','beginner','turning',1,'想转左就用右手单侧从板头到板尾画大弧；倒转则桨叶在板尾往前扫。核心发力在躯干而非手臂，弧度越大转向越快。','只动手腕、弧度太小 → 转不动。',3,'published'),
('04','跪姿锚点急停',1,'跪姿基础','beginner','braking',1,'桨叶垂直插入板侧水中，下刃全没、桨柄贴在板身上。利用板身与桨叶形成的阻力在 1-2 个船身内停下。','桨插得浅或斜插 → 板继续漂。',4,'published'),
('05','跪姿直线停止',1,'跪姿基础','beginner','braking',1,'左右两侧交替做反向短划直到板速归零，全程保持直线不偏航。','只反划一侧 → 停的时候偏航。',5,'published'),
('06','跪姿倒退',1,'跪姿基础','beginner','paddling',1,'桨叶凹面朝前，从脚边往板头推水；两侧交替节奏对称让板匀速后退。头扭过肩盯着后方防撞。','桨叶方向没反 → 板原地打转。',6,'published'),
('07','站立',2,'站立起步','beginner','balance',1,'双手撑桨横放板上保持三点支撑，一脚踩跪点、另一脚对称踩、缓慢直立，全程视线落在板头前方 3-5 米。','低头看脚 → 失去前庭参照必倒。',7,'published'),
('08','站立划行',2,'站立起步','beginner','paddling',1,'膝盖微屈、髋部略前倾、核心绷紧；桨插前、拉至脚边出水；身体稳而板不稳是正确状态。','直腿僵立 → 板一晃就倒。',8,'published'),
('09','站立扫桨转向（前后）',2,'站立起步','beginner','turning',1,'站姿大弧扫桨比跪姿更依赖上肢与核心联动，扫桨时膝盖跟着躯干微屈缓冲稳定板身。','只用手转向 → 板转不动还失衡。',9,'published'),
('10','站立锚点急停',2,'站立起步','beginner','braking',1,'桨叶垂直插板侧水中，同时屈膝下沉重心抵消惯性前冲，桨柄贴紧板身借阻力。','直立插桨 → 人往前飞。',10,'published'),
('11','划行姿态',3,'站姿控船','beginner','posture',1,'脚尖朝前与板平行、膝盖微屈可吸震、髋中立、核心绷紧、肩胛下沉、目视前方。','驼背 / 锁膝 / 低头。',11,'published'),
('12','划行发力',3,'站姿控船','beginner','paddling',1,'发力主链是核心旋转、肩带、手臂。上桨手压下、下桨手拉后，每一桨要长而深。','只用手臂 → 5 桨就酸。',12,'published'),
('13','站立晃板',3,'站姿控船','beginner','balance',1,'板受侧浪晃动时用脚踝和髋关节微调，而非大幅重心移动，学会在小幅晃动里保持身体中线。','上身乱倾斜 → 越调越晃。',13,'published'),
('14','站立直线停止',3,'站姿控船','beginner','braking',1,'交替做左右短反划直至板停，下半身保持站姿稳定，不靠身体前后倾压板头板尾。','急剧前倾压板 → 板头扎水落水。',14,'published'),
('15','站立倒退',3,'站姿控船','beginner','paddling',1,'桨叶反向推水，从脚边推到板头，头和肩主动朝后观察防撞，两侧交替节奏对称。','只顾往后划不看方向 → 撞岸或撞人。',15,'published'),
('16','主动落水',4,'落水与回板','beginner','safety',1,'察觉即将失衡时主动侧身脱板向侧后方滑落水，手不抓板沿避免扭伤，尽量落在板尾侧远离尾鳍。','直线往前扑 → 砸到板鼻或尾鳍。',16,'published'),
('17','被动落水',4,'落水与回板','beginner','safety',1,'意外摔下时护头护面，脚蜷起避免撞尾鳍；落水后立即浮上来找桨和板的位置。','挺身硬扎入水 → 呛水或磕碰。',17,'published'),
('18','中位上板',4,'落水与回板','beginner','safety',1,'游到板中间握住两侧提手或板沿，双脚蹬水使上半身冲上板面，重心沿板中线趴稳后再跪起。','从板头板尾爬 → 容易翻板或被板打。',18,'published'),
('19','高支撑',5,'支撑与走板','intermediate','support',1,'桨叶以拍水面方式向下支撑，桨柄横贴胸前，通过拍水反作用力把快要翻的板身按回中线。','桨叶入水太深 → 借不到力还扭肩。',19,'published'),
('20','低支撑',5,'支撑与走板','intermediate','support',1,'桨叶贴水面滑动做外扫，桨柄贴在大腿前，适用于轻度失衡的快速修复。','桨叶抬离水面 → 错过修正窗口。',20,'published'),
('21','平行式走板',5,'支撑与走板','intermediate','footwork',1,'双脚平行小幅前后挪动，每次挪 10-15 cm，用脚掌粘着板面而非抬起，重心始终在两脚之间。','大跨步挪动 → 板一晃失衡。',21,'published'),
('22','横移步走板',5,'支撑与走板','intermediate','footwork',1,'侧身朝板头或板尾，一脚横挪一脚跟进，保持两脚始终与板平行，身体不扭转。','转身朝板头走 → 身体扭来扭去必翻。',22,'published'),
('23','板尾外轴转',5,'支撑与走板','intermediate','turning',1,'后脚移到板尾使板尾沉水，板头翘出水面，用桨在板头前方做大弧扫实现快速 180° 调头。','脚没踩到板尾最后 → 板不翘起转不动。',23,'published'),
('24','单边直线划行',5,'支撑与走板','intermediate','paddling',1,'只用单侧划 10 桨以上不偏航，靠 J 形尾扫或入水角度略外开抵消船头偏转。','直接连划不做补正 → 5 桨就偏。',24,'published'),
('25','压桨平移',5,'支撑与走板','intermediate','maneuver',1,'桨叶插入板侧方、桨叶与板身平行，把水横向推向自己让板朝反方向平移，靠岸 / 避障必备。','桨叶朝前 → 变成刹车不是平移。',25,'published'),
('26','前舵转向',6,'高阶转向与救援','advanced','turning',1,'把桨插到板头最前端，一推一拉做 C 形划，利用前端力矩急转弯，绕标赛和窄水道必备。','桨没到板头 → 变成普通扫桨。',26,'published'),
('27','拧身拨桨',6,'高阶转向与救援','advanced','paddling',1,'用躯干大幅度旋转带动桨做 C 形划，借助腰腹力量而不是手臂。','只扭肩不转髋 → 力量传不到桨。',27,'published'),
('28','跨板头转向',6,'高阶转向与救援','advanced','turning',1,'脚主动前移到板头，踩压使板头沉水并以此为支点做 180° 调头，难度比外轴转更高。','重心没压下去 → 板不沉转不动。',28,'published'),
('29','趴板划水',6,'高阶转向与救援','advanced','rescue',1,'趴在板上，双手交替划水，头稍抬保持视野；适用于大风大浪回板或恶劣天气前行。','双手同划 → 方向难控。',29,'published'),
('30','趴板转向',6,'高阶转向与救援','advanced','rescue',1,'趴姿只用单侧手臂连续划水即可转向，胸口顶住板上减少阻力，小幅度持续拨水最有效。','身体扭来扭去 → 划水效率差。',30,'published'),
('31','趴板急停',6,'高阶转向与救援','advanced','rescue',1,'两手同时掌心朝前撑水制动，身体略抬肩增加阻力，几秒内让板停下。','一手先一手后 → 板打转。',31,'published'),
('32','水下翻板',6,'高阶转向与救援','advanced','rescue',1,'落水后板底朝上时，游到板侧抓对侧边缘，脚蹬水 + 手臂发力把板翻回正面。','想从板头板尾翻 → 杠杆太短翻不动。',32,'published'),
('33','翻板救援',6,'高阶转向与救援','advanced','rescue',1,'队友被压板下或体力不支时，从板侧并排抓手帮助翻板并保其上板；自己先稳住自己的板再去救人。','慌乱靠近 → 两板撞击更危险。',33,'published'),
('34','交叉步走板',6,'高阶转向与救援','advanced','footwork',1,'前脚交叉跨到另一脚前方，后脚再跟进，用于快速移动到板头或板尾。','步幅太大 → 板剧烈摇晃。',34,'published'),
('35','不换手倒退',6,'高阶转向与救援','advanced','paddling',1,'保持同侧握桨不换边，用 J 形尾扫 + 反向推水组合让板后退还不偏航，是桨控能力的最高阶体现。','不做尾扫补偿 → 板斜着后退。',35,'published')
ON DUPLICATE KEY UPDATE
name = VALUES(name), stage = VALUES(stage), stage_label = VALUES(stage_label), level = VALUES(level),
category = VALUES(category), points = VALUES(points), key_points = VALUES(key_points),
common_errors = VALUES(common_errors), sort_order = VALUES(sort_order), status = VALUES(status);

INSERT INTO sup_courses (slug, title, subtitle, summary, description, cover_image, images, venue, schedule_note, equipment_note, board_note, duration_minutes, price_display, price_options, sort_order, status) VALUES
('sup-experience','桨板体验','零基础轻松下水','提供划水器材，人来即可。重在体验，穿好救生衣之后，在指定区域内划水即可。','适合第一次接触桨板的朋友，用最轻松的方式完成安全穿戴、上下板、指定区域内划水体验。','/quiz-images/correct-stance.svg',JSON_ARRAY('/quiz-images/correct-stance.svg','/quiz-images/pfd-types.svg'),'中流击水桨板俱乐部（余杭塘河-梦想小镇段）','课程时间和教练自行约定','提供划水器材，人来即可','充气休闲板',60,'128元/1小时/人；218元/2小时/人',JSON_ARRAY(JSON_OBJECT('label','1小时体验','price',128,'duration','1小时/人'),JSON_OBJECT('label','2小时体验','price',218,'duration','2小时/人')),1,'published'),
('sup-beginner','桨板入门课','从安全到独立划行','从桨板技术动作库中选择基础动作教学，建立上下水、站立、直线划行、转向、停止和回板能力。','面向希望真正学会桨板的零基础学员，课程重点是安全基础、身体姿态、划行发力和落水回板。','/quiz-images/paddle-stroke-angle.svg',JSON_ARRAY('/quiz-images/paddle-stroke-angle.svg','/quiz-images/paddle-blade-direction.svg'),'中流击水桨板俱乐部（余杭塘河-梦想小镇段）','课程时间和教练自行约定','提供基础教学器材','教学板',180,'598元/3小时/人',JSON_ARRAY(JSON_OBJECT('label','入门课','price',598,'duration','3小时/人')),2,'published'),
('sup-advanced','桨板进阶课','竞速板技术强化','使用竞速板，从技术动作库中选择非入门课的进阶动作，强化支撑、走板、控板、转向和救援能力。','适合已有基础、希望提升控板能力和复杂场景处理能力的学员。','/quiz-images/board-types-overview.svg',JSON_ARRAY('/quiz-images/board-types-overview.svg','/quiz-images/fin-types.svg'),'中流击水桨板俱乐部（余杭塘河-梦想小镇段）','课程时间和教练自行约定','提供进阶训练所需器材','竞速板',180,'980元/3小时/1人',JSON_ARRAY(JSON_OBJECT('label','进阶课','price',980,'duration','3小时/1人')),3,'published'),
('sup-combo','入门&进阶','完整技术路径','覆盖入门和进阶技术动作，从安全基础一路练到支撑、走板、高阶转向与救援。','适合希望一次性建立完整桨板技术路径的学员，包含入门动作和进阶动作。','/quiz-images/board-types-overview.svg',JSON_ARRAY('/quiz-images/board-types-overview.svg','/quiz-images/correct-stance.svg','/quiz-images/paddle-stroke-angle.svg'),'中流击水桨板俱乐部（余杭塘河-梦想小镇段）','课程时间和教练自行约定','提供完整训练器材','教学板 + 竞速板',360,'1580元/6小时/人',JSON_ARRAY(JSON_OBJECT('label','入门&进阶','price',1580,'duration','6小时/人')),4,'published')
ON DUPLICATE KEY UPDATE
title = VALUES(title), subtitle = VALUES(subtitle), summary = VALUES(summary), description = VALUES(description),
cover_image = COALESCE(sup_courses.cover_image, VALUES(cover_image)), images = COALESCE(sup_courses.images, VALUES(images)),
venue = VALUES(venue), schedule_note = VALUES(schedule_note), equipment_note = VALUES(equipment_note),
board_note = VALUES(board_note), duration_minutes = VALUES(duration_minutes), price_display = VALUES(price_display),
price_options = VALUES(price_options), sort_order = VALUES(sort_order), status = VALUES(status);

DELETE FROM sup_course_techniques
WHERE course_id IN (SELECT course_id FROM sup_courses WHERE slug IN ('sup-beginner','sup-advanced','sup-combo'));

INSERT INTO sup_course_techniques (course_id, technique_id, sort_order)
SELECT c.course_id, t.technique_id, t.sort_order
FROM sup_courses c
JOIN sup_techniques t ON t.source_code BETWEEN '01' AND '18'
WHERE c.slug = 'sup-beginner';

INSERT INTO sup_course_techniques (course_id, technique_id, sort_order)
SELECT c.course_id, t.technique_id, t.sort_order
FROM sup_courses c
JOIN sup_techniques t ON t.source_code BETWEEN '19' AND '35'
WHERE c.slug = 'sup-advanced';

INSERT INTO sup_course_techniques (course_id, technique_id, sort_order)
SELECT c.course_id, t.technique_id, t.sort_order
FROM sup_courses c
JOIN sup_techniques t ON t.source_code BETWEEN '01' AND '35'
WHERE c.slug = 'sup-combo';
