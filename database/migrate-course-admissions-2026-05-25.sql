-- SUP Wiki — course admissions fields

USE sport_hacker;

CALL add_col_if_missing('sup_courses', 'course_type', "ALTER TABLE sup_courses ADD COLUMN course_type VARCHAR(40) DEFAULT 'custom' AFTER board_note");
CALL add_col_if_missing('sup_courses', 'positioning', "ALTER TABLE sup_courses ADD COLUMN positioning VARCHAR(300) NULL AFTER course_type");
CALL add_col_if_missing('sup_courses', 'audience_tags', "ALTER TABLE sup_courses ADD COLUMN audience_tags JSON NULL AFTER positioning");
CALL add_col_if_missing('sup_courses', 'target_audience', "ALTER TABLE sup_courses ADD COLUMN target_audience JSON NULL AFTER audience_tags");
CALL add_col_if_missing('sup_courses', 'consultation_required', "ALTER TABLE sup_courses ADD COLUMN consultation_required JSON NULL AFTER target_audience");
CALL add_col_if_missing('sup_courses', 'learning_outcomes', "ALTER TABLE sup_courses ADD COLUMN learning_outcomes JSON NULL AFTER consultation_required");
CALL add_col_if_missing('sup_courses', 'capacity_note', "ALTER TABLE sup_courses ADD COLUMN capacity_note VARCHAR(200) NULL AFTER learning_outcomes");
CALL add_col_if_missing('sup_courses', 'age_note', "ALTER TABLE sup_courses ADD COLUMN age_note VARCHAR(200) NULL AFTER capacity_note");
CALL add_col_if_missing('sup_courses', 'includes', "ALTER TABLE sup_courses ADD COLUMN includes JSON NULL AFTER age_note");
CALL add_col_if_missing('sup_courses', 'excludes', "ALTER TABLE sup_courses ADD COLUMN excludes JSON NULL AFTER includes");
CALL add_col_if_missing('sup_courses', 'bring_items', "ALTER TABLE sup_courses ADD COLUMN bring_items JSON NULL AFTER excludes");
CALL add_col_if_missing('sup_courses', 'safety_notes', "ALTER TABLE sup_courses ADD COLUMN safety_notes JSON NULL AFTER bring_items");
CALL add_col_if_missing('sup_courses', 'class_flow', "ALTER TABLE sup_courses ADD COLUMN class_flow JSON NULL AFTER safety_notes");
CALL add_col_if_missing('sup_courses', 'change_policy', "ALTER TABLE sup_courses ADD COLUMN change_policy TEXT NULL AFTER class_flow");
CALL add_col_if_missing('sup_courses', 'coach_profile', "ALTER TABLE sup_courses ADD COLUMN coach_profile JSON NULL AFTER change_policy");
CALL add_col_if_missing('sup_courses', 'faq', "ALTER TABLE sup_courses ADD COLUMN faq JSON NULL AFTER coach_profile");
CALL add_col_if_missing('sup_courses', 'enrollment_note', "ALTER TABLE sup_courses ADD COLUMN enrollment_note TEXT NULL AFTER faq");
CALL add_col_if_missing('sup_courses', 'wechat_id', "ALTER TABLE sup_courses ADD COLUMN wechat_id VARCHAR(80) DEFAULT 'i_add_u' AFTER enrollment_note");
CALL add_col_if_missing('sup_courses', 'cta_text', "ALTER TABLE sup_courses ADD COLUMN cta_text VARCHAR(120) DEFAULT '微信咨询课程' AFTER wechat_id");

UPDATE sup_courses SET
  course_type = 'experience',
  positioning = '第一次接触桨板，也能在安全水域轻松完成下水体验。',
  audience_tags = JSON_ARRAY('零基础', '轻体验', '亲子朋友'),
  target_audience = JSON_ARRAY('第一次接触桨板，想先感受水上运动的人', '朋友、情侣、亲子轻松体验', '想拍照打卡，但也希望安全下水的人'),
  consultation_required = JSON_ARRAY('不会游泳或明显怕水的人', '儿童、老人或有特殊身体情况的人', '身高体重特殊，需要提前匹配救生衣和板型的人'),
  learning_outcomes = JSON_ARRAY('正确穿戴救生衣并认识基础器材', '完成上下板和跪姿划行', '掌握简单停止、转向和落水回板意识'),
  capacity_note = '1 对 1 或小班体验，团体需提前沟通人数',
  age_note = '成人、青少年、亲子均可，儿童需监护人陪同并提前沟通',
  includes = JSON_ARRAY('课程教学', '桨板、桨、救生衣等基础器材', '场地使用', '教练现场指导'),
  excludes = JSON_ARRAY('个人交通', '餐饮', '个人保险', '额外装备购买'),
  bring_items = JSON_ARRAY('速干衣物或泳衣', '换洗衣物', '毛巾和拖鞋', '防晒用品', '饮用水'),
  safety_notes = JSON_ARRAY('全程穿戴救生衣', '选择静水、安全上下水区域', '课前确认天气、风力和水流情况', '雷雨、大风、水况异常时延期'),
  class_flow = JSON_ARRAY(
    JSON_OBJECT('title','集合与装备','description','确认身体状况，穿戴救生衣，认识桨板和桨。'),
    JSON_OBJECT('title','岸上讲解','description','学习基本安全规则和上下板方法。'),
    JSON_OBJECT('title','水上体验','description','在指定区域练习跪姿划行、停止和简单转向。'),
    JSON_OBJECT('title','回板与复盘','description','讲解落水回板要点，给出后续学习建议。')
  ),
  change_policy = '如遇雷雨、大风、水流异常、能见度不足等情况，课程延期；个人原因改期请提前沟通。',
  coach_profile = JSON_OBJECT('name','i_add_u','experience','长期参与桨板训练、赛事资料整理与技术学习。','specialties','零基础体验、安全入门、装备选型建议','philosophy','安全第一，循序渐进，让每个人先稳定、再享受。','certificates','如涉及官方等级或证书课程，会单独明确说明。'),
  faq = JSON_ARRAY(
    JSON_OBJECT('question','不会游泳可以参加吗？','answer','可以提前沟通。课程全程穿救生衣，并在安全水域进行，但需要能接受落水。'),
    JSON_OBJECT('question','一定会掉水吗？','answer','桨板是水上运动，落水是正常学习过程，课程会讲解如何安全回到板上。'),
    JSON_OBJECT('question','需要自己带桨板吗？','answer','不需要，课程提供基础教学器材。')
  ),
  enrollment_note = '添加微信 i_add_u，备注：桨板体验课 + 姓名 + 人数 + 希望上课时间',
  wechat_id = 'i_add_u',
  cta_text = '微信预约体验'
WHERE slug = 'sup-experience';

UPDATE sup_courses SET
  course_type = 'beginner',
  positioning = '5 小时从安全下水到独立划行，真正学会而不是只体验一次。',
  audience_tags = JSON_ARRAY('零基础', '系统入门', '独立划行'),
  target_audience = JSON_ARRAY('第一次接触桨板，想系统学习的人', '已经玩过一两次但站不稳、不会转向和回板的人', '亲子家庭、朋友结伴、户外运动爱好者', '以后想买板、参赛或进阶训练的人'),
  consultation_required = JSON_ARRAY('不会游泳、怕水明显的人', '儿童、青少年、老人', '近期有伤病、心肺疾病、术后恢复、孕期等特殊身体情况的人', '体重、身高特殊，需要匹配板型和救生衣尺码的人'),
  learning_outcomes = JSON_ARRAY('正确穿戴救生衣、调整桨长、识别基本安全风险', '独立完成上下水、跪姿划行、站立和直线划行', '掌握基本转向、停止、倒退和靠岸', '落水后能冷静回到板上', '知道什么天气、水域、风向不适合独自下水'),
  capacity_note = '建议 1 对 1 或 2-4 人小班；团体需提前沟通',
  age_note = '成人与青少年适合，儿童亲子需提前确认年龄、身高、体重和游泳情况',
  includes = JSON_ARRAY('课程教学', '桨板、桨、救生衣等基础器材', '场地使用', '教练现场指导', '课后练习建议'),
  excludes = JSON_ARRAY('个人交通', '餐饮', '个人保险，如未包含建议自行购买户外运动意外险', '额外装备购买'),
  bring_items = JSON_ARRAY('速干衣物或泳衣外搭防晒衣', '换洗衣物', '毛巾和拖鞋', '防晒用品', '饮用水'),
  safety_notes = JSON_ARRAY('全程穿戴救生衣', '初学课程选择静水、安全上下水区域', '根据天气、风力、水流情况决定是否下水', '课前讲解落水、回板、停止、避让和求助方法', '雷雨、大风、水流异常、能见度不足时延期', '学员需如实告知身体状况和游泳能力'),
  class_flow = JSON_ARRAY(
    JSON_OBJECT('title','集合签到','description','确认身体状况，穿戴装备。'),
    JSON_OBJECT('title','岸上讲解','description','认识桨板、桨、救生衣、脚绳，学习基本安全规则。'),
    JSON_OBJECT('title','水边练习','description','上下板、跪姿划行、停止、转向。'),
    JSON_OBJECT('title','站立练习','description','站姿、平衡、直线划行。'),
    JSON_OBJECT('title','落水回板','description','主动落水，学习如何安全回到板上。'),
    JSON_OBJECT('title','自由练习与纠错','description','教练针对每个人调整动作。'),
    JSON_OBJECT('title','结束复盘','description','给出下一步练习建议。')
  ),
  change_policy = '预约制上课；如遇雷雨、大风、水况异常等安全风险，课程延期；个人原因改期请提前沟通。',
  coach_profile = JSON_OBJECT('name','i_add_u','experience','长期参与桨板训练、赛事资料整理、技术动作库建设和桨板学习内容整理。','specialties','零基础教学、基础安全训练、装备选购、入门技术纠错','philosophy','安全第一，循序渐进。先让学员敢下水、能回板，再建立稳定划行能力。','certificates','普通兴趣课不承诺官方证书；如开设等级或认证课程会单独说明资质。'),
  faq = JSON_ARRAY(
    JSON_OBJECT('question','不会游泳可以参加吗？','answer','可以提前沟通。课程全程穿救生衣，并在安全水域进行，但需要能接受落水，不能极度怕水。'),
    JSON_OBJECT('question','一节课能学会吗？','answer','体验课主要是安全体验；入门课目标是建立独立划行能力，需要按课程节奏练习。'),
    JSON_OBJECT('question','穿什么衣服？','answer','建议穿速干运动服或泳衣外搭防晒衣，带一套干衣服、毛巾和拖鞋。'),
    JSON_OBJECT('question','下雨还能上课吗？','answer','小雨视情况决定；雷雨、大风、水流异常、能见度差等情况延期。')
  ),
  enrollment_note = '添加微信 i_add_u，备注：桨板入门课 + 姓名 + 人数 + 希望上课时间',
  wechat_id = 'i_add_u',
  cta_text = '微信咨询入门课'
WHERE slug = 'sup-beginner';

UPDATE sup_courses SET
  course_type = 'advanced',
  positioning = '面向已有基础的桨板玩家，强化竞速板适应、支撑、走板和复杂控板。',
  audience_tags = JSON_ARRAY('有基础', '竞速进阶', '控板强化'),
  target_audience = JSON_ARRAY('已经能站立划行的人', '想适应竞速板、提高控板能力的人', '想练支撑、走板、高阶转向和救援基础的人'),
  consultation_required = JSON_ARRAY('无法稳定站立划行的人建议先上入门课', '近期伤病或体能状态不稳定的人', '对竞速板和开放水域风险不了解的人'),
  learning_outcomes = JSON_ARRAY('适应竞速板站姿和基础平衡', '掌握高低支撑、走板和快速转向', '理解风浪、水况下的控板和安全策略', '建立后续专项训练方向'),
  capacity_note = '建议 1 对 1 或 2-3 人小班',
  age_note = '适合已有基础的成人或青少年',
  includes = JSON_ARRAY('进阶技术教学', '竞速板或进阶训练器材', '教练现场纠错', '课后训练建议'),
  excludes = JSON_ARRAY('个人交通', '餐饮', '个人保险', '额外装备购买'),
  bring_items = JSON_ARRAY('速干训练服', '换洗衣物', '防晒用品', '饮用水'),
  safety_notes = JSON_ARRAY('全程穿戴救生衣', '根据天气和风力决定训练内容', '不在不适合的水况中强行训练', '进阶动作以安全可控为前提'),
  class_flow = JSON_ARRAY(
    JSON_OBJECT('title','能力评估','description','确认站立划行、转向、回板等基础能力。'),
    JSON_OBJECT('title','竞速板适应','description','调整站姿、重心和桨频。'),
    JSON_OBJECT('title','支撑与走板','description','练习高低支撑、平行走板、横移走板。'),
    JSON_OBJECT('title','高阶转向','description','练习板尾外轴转、前舵转向等控板动作。'),
    JSON_OBJECT('title','复盘建议','description','给出后续训练重点。')
  ),
  change_policy = '进阶课根据天气、水况和学员能力调整训练内容；不适合下水时延期。',
  coach_profile = JSON_OBJECT('name','i_add_u','experience','长期关注桨板竞速、赛事成绩和技术动作体系。','specialties','竞速板适应、控板、支撑、走板、训练路径建议','philosophy','进阶不是冒险，先把动作做稳，再提升速度。','certificates','如涉及官方等级或证书课程，会单独明确说明。'),
  faq = JSON_ARRAY(
    JSON_OBJECT('question','没有基础可以上进阶课吗？','answer','不建议。进阶课默认你已经能稳定站立划行、完成基本转向和回板。'),
    JSON_OBJECT('question','会用竞速板吗？','answer','课程会根据能力安排竞速板适应训练，但是否使用具体板型以现场安全判断为准。'),
    JSON_OBJECT('question','进阶课会很累吗？','answer','会比体验和入门课更偏训练，但会根据个人体能调整强度。')
  ),
  enrollment_note = '添加微信 i_add_u，备注：桨板进阶课 + 姓名 + 基础情况 + 希望上课时间',
  wechat_id = 'i_add_u',
  cta_text = '微信咨询进阶课'
WHERE slug = 'sup-advanced';

UPDATE sup_courses SET
  course_type = 'combo',
  positioning = '从零基础一路练到进阶控板，建立完整桨板技术路径。',
  audience_tags = JSON_ARRAY('完整路径', '系统训练', '入门到进阶'),
  target_audience = JSON_ARRAY('想一次性系统学习桨板的人', '希望从安全基础练到进阶控板的人', '未来想持续训练、买板或参赛的人'),
  consultation_required = JSON_ARRAY('时间安排不稳定的人需提前确认拆分上课方式', '明显怕水或不会游泳的人需先沟通', '特殊身体情况需提前说明'),
  learning_outcomes = JSON_ARRAY('掌握入门安全、站立划行、转向、停止和回板', '理解进阶支撑、走板和高阶转向', '获得完整技术路径和后续训练建议', '能判断适合自己的板型和训练方向'),
  capacity_note = '建议 1 对 1 或小班，课时可拆分预约',
  age_note = '适合成人和有持续学习意愿的青少年',
  includes = JSON_ARRAY('入门与进阶课程教学', '基础与进阶训练器材', '技术动作纠错', '完整训练路径建议'),
  excludes = JSON_ARRAY('个人交通', '餐饮', '个人保险', '额外装备购买'),
  bring_items = JSON_ARRAY('速干训练服', '换洗衣物', '毛巾和拖鞋', '防晒用品', '饮用水'),
  safety_notes = JSON_ARRAY('全程穿戴救生衣', '从静水基础开始逐步进阶', '根据天气、水况和能力安排训练内容', '不在不安全条件下强行训练'),
  class_flow = JSON_ARRAY(
    JSON_OBJECT('title','入门安全','description','装备、安全规则、上下水、跪姿基础。'),
    JSON_OBJECT('title','站立划行','description','站姿、直线、转向、停止、倒退。'),
    JSON_OBJECT('title','落水回板','description','主动落水、中位上板和风险处理。'),
    JSON_OBJECT('title','进阶控板','description','支撑、走板、高阶转向和救援基础。'),
    JSON_OBJECT('title','训练复盘','description','建立后续练习计划和装备选择建议。')
  ),
  change_policy = '完整课可拆分预约；天气、水况不适合时延期；个人原因改期请提前沟通。',
  coach_profile = JSON_OBJECT('name','i_add_u','experience','长期建设 SUP Wiki 技术动作库、课程内容和赛事资料。','specialties','系统入门、技术路径规划、进阶控板、装备建议','philosophy','把一次体验变成真正进入桨板运动的起点。','certificates','普通兴趣课不承诺官方证书；如开设认证课程会单独说明。'),
  faq = JSON_ARRAY(
    JSON_OBJECT('question','完整课可以分几次上吗？','answer','可以预约制拆分上课，具体节奏根据天气、场地和学员时间确认。'),
    JSON_OBJECT('question','适合完全零基础吗？','answer','适合。课程会从安全穿戴和上下水开始，逐步进入进阶动作。'),
    JSON_OBJECT('question','学完能参赛吗？','answer','课程能建立完整基础和训练方向，但参赛还需要持续训练和专项准备。')
  ),
  enrollment_note = '添加微信 i_add_u，备注：桨板完整课 + 姓名 + 基础情况 + 希望上课时间',
  wechat_id = 'i_add_u',
  cta_text = '微信咨询完整课'
WHERE slug = 'sup-combo';
