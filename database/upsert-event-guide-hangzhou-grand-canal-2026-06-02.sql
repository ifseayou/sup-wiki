-- Event guide entry for:
-- 全日联动迎2026“浙水大运河”皮划艇与桨板系列赛（杭州站）暨第二届杭州市皮划艇桨板大公开赛
-- Source: user-provided participant notice long image.
-- Note: image/map URLs should be replaced with OSS URLs after screenshots are cropped and uploaded.

INSERT INTO sup_events (
  name,
  slug,
  event_type,
  location,
  province,
  city,
  venue,
  start_date,
  end_date,
  organizer,
  description,
  requirements,
  images,
  schedule,
  disciplines,
  result_status,
  status,
  event_status,
  event_guide
) VALUES (
  '全日联动迎2026“浙水大运河”皮划艇与桨板系列赛（杭州站）暨第二届杭州市皮划艇桨板大公开赛',
  'zhe-water-grand-canal-kayak-sup-hangzhou-2026',
  'race',
  '杭州市武林门码头',
  '浙江省',
  '杭州市',
  '武林门码头一楼售票大厅',
  '2026-06-06',
  '2026-06-07',
  NULL,
  '杭州站赛事选手须知已收录，前台重点展示参赛选手需要关注的领物、器材、开幕式、自带皮划艇入库和交通信息。',
  '参赛选手应按选手须知完成领物、证件核验、免责声明签署和器材安排。雨天开赛前请在武林门码头售票处集合等候。',
  JSON_ARRAY(),
  JSON_ARRAY(
    JSON_OBJECT('date', '2026-06-05', 'time', '09:00-20:00', 'event', '领物与自带皮划艇入库'),
    JSON_OBJECT('date', '2026-06-06', 'time', '开赛前', 'event', '开幕仪式与参赛队列入场'),
    JSON_OBJECT('date', '2026-06-06', 'time', '全天', 'event', '正式比赛'),
    JSON_OBJECT('date', '2026-06-07', 'time', '全天', 'event', '正式比赛')
  ),
  JSON_ARRAY('桨板', '皮划艇'),
  'none',
  'published',
  'upcoming',
  JSON_OBJECT(
    'summary', '这不是成绩册，而是选手赛前须知。重点关注领物时间地点、证件与代领要求、器材规则、开幕式动线、自带皮划艇入库和交通抵达方式。',
    'source', JSON_OBJECT(
      'title', '选手须知长图',
      'type', 'participant_notice',
      'note', '来自用户提供的赛事选手须知图片，仅抽取参赛必要信息。'
    ),
    'highlights', JSON_ARRAY(
      JSON_OBJECT('label', '比赛日期', 'value', '2026-06-06 至 2026-06-07', 'note', '杭州站正式比赛日'),
      JSON_OBJECT('label', '比赛地点', 'value', '杭州市武林门码头', 'note', '领物、开幕式和比赛相关动线均围绕该区域'),
      JSON_OBJECT('label', '领物时间', 'value', '2026-06-05 09:00-20:00', 'note', '在武林门码头一楼售票大厅'),
      JSON_OBJECT('label', '领物地点', 'value', '武林门码头一楼售票大厅', 'note', '需携带本人身份证件等资料'),
      JSON_OBJECT('label', '自带皮划艇入库', 'value', '2026-06-05 09:00-20:00', 'note', '统一运至武林门码头并按流线入库')
    ),
    'sections', JSON_ARRAY(
      JSON_OBJECT(
        'title', '领物相关',
        'items', JSON_ARRAY(
          '本人领取：请携带本人身份证原件、复印件和本人签署的免责声明。',
          '代领：请携带选手身份证复印件、选手签署的免责声明，以及代领人的身份证复印件。',
          '若遇雨天，开赛前请在武林门码头售票处集合等候。'
        )
      ),
      JSON_OBJECT(
        'title', '器材须知',
        'items', JSON_ARRAY(
          '海洋皮艇公开组参赛选手可自带皮划艇。',
          '海洋皮艇大师组参赛选手须统一使用组委会免费提供的海洋皮艇。',
          '桨板公开组、大师组选手均可自带符合规则的比赛板。',
          '长距离大师组项目中，男子大师组可使用桨板，女子大师组可使用皮划艇。'
        )
      ),
      JSON_OBJECT(
        'title', '开幕仪式',
        'items', JSON_ARRAY(
          '6月6日比赛开始前举行开幕仪式。',
          '参赛选手从西湖文化广场地下 6 号口附近进入，按队列入场。'
        )
      ),
      JSON_OBJECT(
        'title', '自带皮划艇须知',
        'items', JSON_ARRAY(
          '自带皮划艇的选手请在 6月5日 09:00-20:00 将艇运至武林门码头。',
          '所有自带艇统一入库，入库时间外不接收入库。'
        )
      ),
      JSON_OBJECT(
        'title', '交通出行',
        'items', JSON_ARRAY(
          '建议绿色出行，优先选择公交或地铁抵达赛场。',
          '如需自驾，可参考选手须知中的周边停车场信息，现场以实际交通管理为准。'
        )
      )
    ),
    'images', JSON_ARRAY(
      JSON_OBJECT('title', '比赛线路示意图', 'url', '', 'caption', '待从选手须知长图裁切后上传 OSS'),
      JSON_OBJECT('title', '开幕仪式动线图', 'url', '', 'caption', '待从选手须知长图裁切后上传 OSS'),
      JSON_OBJECT('title', '自带皮划艇入库流线图', 'url', '', 'caption', '待从选手须知长图裁切后上传 OSS'),
      JSON_OBJECT('title', '交通与地铁站路线图', 'url', '', 'caption', '待从选手须知长图裁切后上传 OSS')
    )
  )
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  event_type = VALUES(event_type),
  location = VALUES(location),
  province = VALUES(province),
  city = VALUES(city),
  venue = VALUES(venue),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  description = VALUES(description),
  requirements = VALUES(requirements),
  schedule = VALUES(schedule),
  disciplines = VALUES(disciplines),
  result_status = VALUES(result_status),
  status = VALUES(status),
  event_status = VALUES(event_status),
  event_guide = VALUES(event_guide);
