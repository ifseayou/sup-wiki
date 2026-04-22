-- 新增：气阀类型判断题（Halkey-Roberts vs Leafield）
INSERT INTO sup_quiz_questions (question, type, options, correct, explanation, explanation_image, category, difficulty) VALUES
('判断：所有 SUP 品牌的充气板都使用统一标准的气阀接头，互相兼容。',
 'truefalse',
 '["正确","错误"]',
 '1',
 '错误。充气桨板主要使用两种气阀标准，接口完全不兼容：\n\n① Halkey-Roberts 阀（约 90% 桨板使用）：中间有弹簧按压小柱（Pin），气泵接头插入后旋转锁定，压住 Pin 才能进气，类似汽车气嘴的升级版。Red Paddle Co、Starboard、BOTE、迪卡侬等品牌使用此阀。\n\n② Leafield 阀（利菲尔德）：无中间 Pin，内部是平整阀门结构，采用卡口式（Bayonet）连接——插入、旋转、锁死，类似相机镜头卡口。气密性更强、支持更高压力、更耐用（军工/救援设备常用），但成本高且需要专用气泵头。\n\n购买气泵或替换阀门前，务必确认你的桨板使用的是哪种标准。',
 '/quiz-images/valve-types-comparison.svg',
 'equipment', 'intermediate');
