# SUP Wiki 数据模型与变更记录

本文档是 SUP Wiki 数据模型、导入副作用和后续需求变更的事实记录入口。涉及表结构、字段语义、赛事成绩导入、积分导入、运动员身份匹配、隐私展示权限或跨仓共享接口的数据迭代，都必须同步更新本文档。

最后核对时间：2026-06-05。当前生产数据库 `sport_hacker` 共有 77 张表。

## 数据库概览

SUP 业务表统一使用 `sup_` 前缀，主要由 `sup-wiki` 维护迁移和导入逻辑；微信小程序和部分 Express 适配 API 在 `sport_hacker` 仓库中消费同一批数据。

当前表可以分为三类：

- 核心 SUP 表：赛事、成绩、积分、运动员、俱乐部、用户、隐私、学习、商城等 `sup_` 表。
- 支撑与运营表：内容浏览、搜索日志、媒体、公告、反馈、训练记录等 `sup_` 表。
- 历史或非 SUP 表：`activity_cycles`、`venues`、`weight_logs` 等通用运动健康或历史业务表。

## 成绩入库对运动员的影响

成绩入库的主表是 `sup_event_results`。每条记录表示某运动员或队伍在某赛事、某组别、某项目、某轮次中的一个成绩。

导入成绩时，导入器通常会执行以下副作用：

- 根据 `athlete_name_snapshot` 查询 `sup_athlete_identity_links`，优先使用已确认的 `athlete_id`。
- 如果没有身份链接，则按 `sup_athletes.name` 查找同名运动员；唯一或高置信匹配时会写入 `sup_athlete_identity_links`。
- 如果仍找不到运动员，会自动创建 `sup_athletes` 草稿档案，通常为 `status='draft'`，并写入身份链接。
- 团体或多人项目会写入 `sup_event_result_members`，成员也可能触发运动员匹配或草稿创建。
- 导入完成后会刷新相关运动员的 `sup_athletes.race_times` 缓存，用于运动员详情页和列表展示。
- 非空队伍名会同步进入 `sup_club_team_aliases`，作为俱乐部认领和队伍别名治理来源。

因此，录入“成绩”不是只新增成绩行，也可能新增运动员草稿、身份链接、团体成员和队伍别名。

## 积分入库对运动员的影响

积分分为赛事内积分和年度积分两类：

- 赛事内积分写入 `sup_event_point_standings`，通常来自成绩册中的个人积分、总积分或分项积分页。
- 年度积分写入 `sup_annual_point_standings`，并通过 `sup_annual_point_sources`、`sup_annual_point_breakdowns`、`sup_annual_point_event_mappings` 记录来源、分项和赛事映射。

导入积分时，运动员匹配规则与成绩导入类似：

- 优先用 `sup_athlete_identity_links` 匹配已有运动员。
- 找不到时按姓名匹配 `sup_athletes`。
- 仍找不到时可创建 `sup_athletes` 草稿档案，并写入身份链接。

积分不会自动生成比赛成绩；成绩和积分是两条不同链路。一个 PDF 如果同时包含成绩页和积分页，必须分别核验 `sup_event_results` 与 `sup_event_point_standings` 的行数。用户选择“隐藏成绩&积分”时，公开展示层必须同时遮蔽成绩表和积分表中的敏感字段。

## 核心数据模型分类

### 用户与权限

- `sup_users`：公众用户账号。
- `sup_login_codes`：验证码登录。
- `sup_user_result_query_usage`：普通用户成绩、积分、运动员查询次数统计。

### 运动员档案与身份

- `sup_athletes`：运动员主档案，包含姓名、国籍、项目、照片、主页资料、精英标记、战绩缓存等。
- `sup_athlete_identity_links`：成绩或积分中的姓名与运动员实体的匹配关系。
- `sup_athlete_data_license`：运动员数据许可协议单例配置，小程序认领/绑定运动员时展示并记录用户同意版本。
- `sup_athlete_profile_claims`：用户认领运动员资料的提交与审核。
- `sup_athlete_profile_owners`：已确认的运动员主页拥有者。

### 赛事与成绩

- `sup_events`：赛事主表。
- `sup_event_results`：赛事成绩明细。
- `sup_event_result_members`：团体成绩成员。
- `sup_event_result_sources`：成绩来源、成绩册、解析器和提交批次追溯。
- `sup_event_result_submissions`：用户上传的成绩册提交记录。

### 赛事积分与年度积分

- `sup_event_point_standings`：单场赛事积分榜。
- `sup_annual_point_sources`：年度积分来源配置。
- `sup_annual_point_standings`：年度个人积分榜。
- `sup_annual_point_breakdowns`：年度积分明细拆分。
- `sup_annual_point_event_mappings`：年度积分来源中的赛事名称映射。
- `sup_annual_club_point_standings`：年度俱乐部积分榜。
- `sup_annual_point_import_cache`：年度积分导入缓存。

### 隐私与审核

- `sup_privacy_requests`：隐藏主页、恢复主页、隐藏成绩&积分、恢复成绩&积分等请求。
- `sup_privacy_request_logs`：隐私请求处理日志。
- `sup_search_logs`：搜索行为日志。

### 俱乐部与队伍

- `sup_clubs`：俱乐部主档案。
- `sup_club_members`：俱乐部成员。
- `sup_club_team_aliases`：成绩册队伍名与俱乐部实体的别名匹配池。
- `sup_club_claims`：俱乐部认领申请。
- `sup_club_owners`：俱乐部拥有者。
- `sup_club_courses`：俱乐部课程。

### 内容、学习与题库

- `sup_articles`、`sup_learn_articles`：文章与学习内容。
- `sup_courses`、`sup_techniques`、`sup_course_techniques`：课程、技术动作和课程技术关联。
- `sup_quiz_questions`、`sup_quiz_attempts`、`sup_quiz_bookmarks`、`sup_quiz_user_stats`、`sup_quiz_wrong_history`：题库、答题、收藏、统计和错题。

### 商业、品牌与行业

- `sup_brands`、`sup_products`、`sup_shop_items`：品牌、产品、商城条目。
- `sup_professionals`、`sup_professional_certificates`、`sup_professional_course_links`、`sup_professional_event_roles`：专业人员、证书、课程和赛事角色。
- `sup_service_projects`、`sup_industry_submissions`、`sup_creators`：服务项目、行业提交、创作者。

### 训练、媒体与运营

- `sup_training_sessions`、`sup_training_session_images`、`sup_training_laps`：用户训练记录。
- `sup_media_assets`：媒体素材。
- `sup_content_views`：内容浏览。
- `sup_mini_announcements`、`sup_mini_feedback`：小程序公告与反馈。
- `sup_coach_certificate_checks`：教练证书核验。

## 当前 76 张表清单

| 分类 | 表 |
| --- | --- |
| 历史/通用 | `activity_cycles`, `cycle_members`, `event_signups`, `events`, `exercise_details`, `exercise_logs`, `food_calories`, `meal_items`, `meal_logs`, `migration_progress_exercise_logs`, `monthly_goals`, `route_points`, `route_sessions`, `route_waypoints`, `users`, `venue_review_tags`, `venue_reviews`, `venues`, `weight_logs` |
| 年度积分 | `sup_annual_club_point_standings`, `sup_annual_point_breakdowns`, `sup_annual_point_event_mappings`, `sup_annual_point_import_cache`, `sup_annual_point_sources`, `sup_annual_point_standings` |
| 内容与学习 | `sup_articles`, `sup_learn_articles`, `sup_course_techniques`, `sup_courses`, `sup_quiz_attempts`, `sup_quiz_bookmarks`, `sup_quiz_questions`, `sup_quiz_user_stats`, `sup_quiz_wrong_history`, `sup_techniques` |
| 运动员 | `sup_athlete_data_license`, `sup_athlete_identity_links`, `sup_athlete_profile_claims`, `sup_athlete_profile_owners`, `sup_athletes` |
| 品牌/商业/行业 | `sup_brands`, `sup_products`, `sup_shop_items`, `sup_creators`, `sup_industry_submissions`, `sup_professional_certificates`, `sup_professional_course_links`, `sup_professional_event_roles`, `sup_professionals`, `sup_service_projects` |
| 俱乐部 | `sup_club_claims`, `sup_club_courses`, `sup_club_members`, `sup_club_owners`, `sup_club_team_aliases`, `sup_clubs` |
| 赛事/成绩/积分 | `sup_event_point_standings`, `sup_event_result_members`, `sup_event_result_sources`, `sup_event_result_submissions`, `sup_event_results`, `sup_events`, `sup_events_rating_backup_20260603` |
| 用户/隐私/运营 | `sup_content_views`, `sup_login_codes`, `sup_media_assets`, `sup_mini_announcements`, `sup_mini_feedback`, `sup_privacy_request_logs`, `sup_privacy_requests`, `sup_search_logs`, `sup_user_result_query_usage`, `sup_users` |
| 训练 | `sup_training_laps`, `sup_training_session_images`, `sup_training_sessions` |
| 证书核验 | `sup_coach_certificate_checks` |

## 变更记录规则

后续任何需求如果符合以下任一条件，都必须在本节追加记录：

- 新增、删除、重命名表或字段。
- 改变成绩、积分、运动员、隐私、认领、查询次数的数据口径。
- 改变导入脚本对运动员自动创建、身份匹配、战绩缓存、队伍别名的副作用。
- 改变 Web 与小程序共享 API 的字段含义。
- 生产库执行了一次性 SQL、回填或修复脚本。

记录格式：

```text
YYYY-MM-DD - 标题
- 变更：
- 影响表：
- 影响接口/页面：
- 回滚/核验：
```

### 2026-06-04 - 建立数据模型事实文档

- 变更：新增本文档，记录当前 76 张表、核心表分类、成绩/积分导入对运动员自动创建的影响。
- 影响表：无结构变更。
- 影响接口/页面：无。
- 回滚/核验：只读查询 `information_schema.tables` 确认当前数据库表数量为 76。

### 2026-06-05 - 运动员数据许可协议配置化

- 变更：新增 `sup_athlete_data_license` 单例表，用于维护运动员认领/绑定流程中的数据许可协议标题、段落和版本号；后台新增 `/admin/athlete-data-license`，公开读取接口新增 `/api/athlete-data-license`。
- 影响表：`sup_athlete_data_license`。该表由 `src/lib/athlete-data-license.ts` 在读取或保存协议时 `CREATE TABLE IF NOT EXISTS` 确保存在。
- 影响接口/页面：`/api/athlete-data-license`、`/api/admin/athlete-data-license`、`/admin/athlete-data-license`；小程序认领页读取该协议并在用户同意时留存版本号。
- 回滚/核验：如需回滚，可移除后台入口和两个 API；数据库表为单例配置表，删除前需确认小程序不再读取该接口。上线后访问 `/api/athlete-data-license` 应返回 `title`、`sections`、`version`。

### 2026-06-07 - 录入第二届杭州皮划艇大众公开赛桨板 10 公里成绩

- 变更：为用户提交批次 `mp_1780814033934_6fype14i` 创建生产赛事 `event_id=356`（`第二届杭州皮划艇大众公开赛`，2026-06-07，杭州大运河武林门至拱宸桥），从 4 份成绩册 PDF 导入桨板 10 公里成绩共 204 条；导入脚本新增 `--event-id`，用于将成绩锁定写入已确认赛事，避免同名赛事误建。
- 影响表：`sup_events`、`sup_event_results`、`sup_event_result_sources`、`sup_event_result_submissions`、`sup_athletes`、`sup_athlete_identity_links`、`sup_club_team_aliases`。本次导入按结果册创建或复用运动员实体，并同步运动员战绩缓存；4 条提交记录状态更新为 `imported`。
- 影响接口/页面：`/events/356`、`/api/events/356/results`、`/results`、`/api/results`、运动员详情页战绩面板。公开页面按现有隐私规则展示姓名和成绩，不改变成绩/积分权限口径。
- 回滚/核验：核验生产库 `sup_event_results` 中 `event_id=356` 共 204 条，含 172 条完赛、31 条 DNS、1 条 DNF；4 个组别分别为公开女子组 33、公开男子组 77、大师女子组 30、大师男子组 64，且每个组别仅 1 个正常第一名。OSS 原始 PDF 与 `/events/356` 均返回 200；如需回滚，应先删除 `event_id=356` 关联的 `sup_event_results`、`sup_event_result_sources`，再视情况清理本次自动创建且无其他成绩关联的运动员实体和身份链接。

### 2026-06-09 - 录入第二届全国全民健身大赛（西北区陕西省）桨板比赛成绩

- 变更：为用户提交批次 `mp_1780969858286_o27c9hxc` 创建生产赛事 `event_id=357`（`第二届全国全民健身大赛（西北区陕西省）桨板比赛`，2026-05-31，陕西省），从 1 份成绩册 PDF 导入 200 米竞速赛与 3000 米耐力赛成绩共 208 条。成绩册积分列为空，本次仅录入成绩，不生成积分明细。
- 影响表：`sup_events`、`sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`、`sup_event_result_submissions`、`sup_athletes`、`sup_athlete_identity_links`、`sup_club_team_aliases`。本次导入包含双人项目成员明细 256 条，触达并同步 108 名运动员战绩缓存；提交记录 `submission_id=29` 状态更新为 `imported`。
- 影响接口/页面：`/events/357`、`/api/events/357/results`、`/results`、`/api/results`、运动员详情页战绩面板。公开页面继续按现有隐私规则展示，不改变成绩/积分权限口径。
- 回滚/核验：核验生产库 `sup_event_results` 中 `event_id=357` 共 208 条，含 193 条正常成绩、13 条 DNS、1 条 DNF、1 条 DSQ；32 个成绩模块均仅有 1 个正常第一名。来源 PDF 返回 200；如需回滚，应先删除 `event_id=357` 关联的 `sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`，再视情况清理本次自动创建且无其他成绩关联的运动员实体、身份链接和提交记录状态。

### 2026-06-14 - 录入 2026 杭州桨板系列赛-西溪湿地上午成人组成绩

- 变更：为用户提交批次 `mp_1781419973432_ofobbfxv` 创建生产赛事 `event_id=381`（`2026杭州桨板系列赛-西溪湿地`，2026-06-14，浙江省杭州市西溪湿地），从 1 份成绩册 PDF 导入 5 公里和 7 公里成人组成绩共 282 条。成绩册无积分列，本次仅录入成绩，不生成积分明细。
- 影响表：`sup_events`、`sup_event_results`、`sup_event_result_sources`、`sup_event_result_submissions`、`sup_athletes`、`sup_athlete_identity_links`、`sup_club_team_aliases`。本次导入触达并同步 269 名运动员战绩缓存；提交记录 `submission_id=30` 状态更新为 `imported`。
- 影响接口/页面：`/events/381`、`/api/events/381/results`、`/results`、`/api/results`、运动员详情页战绩面板。公开页面仅展示 280 条已核验成绩；`#VALUE!` 的 2 条记录（卡佳 Kate、刘丽）保留在后台为 `needs_review` 且 `is_verified=0`，待人工修正后再公开。
- 回滚/核验：核验生产库 `sup_event_results` 中 `event_id=381` 共 282 条，含 249 条正常成绩、31 条 DNS、2 条待核验；6 个成绩模块均仅有 1 个正常第一名。来源 PDF 返回 200，公开 API 返回 280 条成绩、0 条积分；如需回滚，应先删除 `event_id=381` 关联的 `sup_event_results`、`sup_event_result_sources`，再视情况清理本次自动创建且无其他成绩关联的运动员实体、身份链接和提交记录状态。

### 2026-06-14 - 录入 2026 长三角皮划艇桨板大赛暨苏州市桨板系列赛吴江站报名信息

- 变更：根据苏州市皮划艇桨板协会公众号文章，创建或更新生产赛事 `2026第十届长三角皮划艇桨板大赛暨2026苏州市桨板系列赛吴江站`（2026-06-27，江苏省苏州市苏州湾旅游区顾家荡路码头）。本次仅录入报名公告、赛程、组别名额、奖励办法和路线图，不录入成绩或积分；报名截止时间已过，前台不展示报名入口。
- 影响表：`sup_events`、`sup_event_categories`、`sup_event_category_prizes`。不影响 `sup_event_results`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`，不会自动创建运动员或同步战绩缓存。
- 影响接口/页面：赛事列表、赛事详情页、`/api/events`、`/api/events/[id]`。该赛事 `result_status='none'`，成绩/积分查询不会新增记录。
- 回滚/核验：核验该赛事组别共 10 条、名额合计 440、逐名次奖金 80 条，且成绩与积分关联记录均为 0。如需回滚，按 `event_id` 删除 `sup_event_category_prizes`、`sup_event_categories`，再删除 `sup_events` 记录。

### 2026-06-15 - 录入 2026 绿水青山挑战赛宁波北仑站成绩与团体积分

- 变更：为用户提交批次 `mp_1781489980326_rdfi0mec` 绑定既有生产赛事 `event_id=358`（`2026年“绿水青山”中国休闲运动挑战赛（宁波站）`，浙江省宁波市梅山湾），从 1 份成绩册 PDF 导入个人两项赛、路跑单项、桨板单项、男女混合双人接力成绩共 293 条，并从成绩册团体总分页导入团体积分 47 条。
- 影响表：`sup_events`、`sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`、`sup_event_result_submissions`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`、`sup_club_team_aliases`。本次导入触达并同步 298 名运动员战绩缓存；提交记录 `submission_id=31` 状态更新为 `imported`，来源记录 `source_id=466`。
- 影响接口/页面：`/events/358`、`/api/events/358/results`、`/results`、`/api/results`、运动员详情页战绩面板。公开页面按现有隐私规则展示成绩和团体积分；`/api/events/358/results` 返回 17 个成绩模块和 1 个团体总分积分模块。
- 回滚/核验：核验生产库 `sup_event_results` 中 `event_id=358` 共 293 条，含 256 条正常成绩、20 条 DNS、12 条 DNF、5 条 DSQ；17 个成绩模块均仅有 1 个正常第一名。`sup_event_point_standings` 中 `group_name='团体总分'` 共 47 条，前三名为宁波甬炫旅游文化发展有限公司 2628 分、澄爸玩桨板 2576 分、宁波栖拓文旅有限公司 2252 分。来源 PDF 与 `/events/358` 均返回 200；如需回滚，应先删除 `event_id=358` 关联的 `sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`、`sup_event_point_standings`，再视情况清理本次自动创建且无其他成绩关联的运动员实体、身份链接和提交记录状态。

### 2026-06-16 - 录入第二届亚洲桨板锦标赛与中国运动员选拔办法

- 变更：根据体育总局水上中心 2026-04-28 公示的《第二届亚洲桨板锦标赛中国运动员选拔办法》，创建或更新赛事 `第二届亚洲桨板锦标赛`（2026-08-06 至 2026-08-08，日本京都府京丹后市），并将中国运动员选拔条件、报名截止、积分截止、项目和组别写入赛事详情与参赛指南。
- 影响表：`sup_events`、`sup_event_categories`。本次仅录入赛事与选拔办法信息，生成 30 条项目/组别结构化记录；不影响 `sup_event_results`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`，不会自动创建运动员或同步战绩缓存。
- 影响接口/页面：赛事列表、赛事详情页、`/api/events`、`/api/events/[id]`。该赛事按亚洲级锦标赛口径记录为 `五星+ / 5.5`、`source_scope='亚洲'`，`result_status='none'`。
- 回滚/核验：按 slug `asian-sup-championship-kyotango-2026` 核验赛事存在、状态为 `published/upcoming`、组别数为 30。如需回滚，按 `event_id` 删除 `sup_event_categories` 后删除 `sup_events` 记录。

### 2026-06-15 - 搜索日志改为仅记录关键词查询并清理历史脏数据

- 变更：搜索日志口径收紧为只记录用户主动输入关键词后的成绩/积分/SUP 搜索；赛事详情页成绩浏览、运动员详情页 `athlete_id` 查询、分页筛选、空关键词查询不再写入。
- 影响表：`sup_search_logs` 无结构变更。生产库先备份命中清理规则的 2476 条记录到 `sup_search_logs_backup_20260615_cleanup`，随后从 `sup_search_logs` 硬删除这些无效记录。
- 影响接口/页面：`/api/results`、`/api/annual-points`、`/api/events/[id]/results`、`/api/admin/search-logs`、`/admin/search-logs`。后台搜索日志时间按 `created_at` 直接格式化，不再做二次 `+08:00` 转换。
- 回滚/核验：生产核验 `dirty_remaining=0`，剩余 `sup_search_logs` 964 条，均为 `race_results` 或 `annual_points` 的真实关键词记录。如需回滚历史数据，可从 `sup_search_logs_backup_20260615_cleanup` 按 `log_id` 插回。

### 2026-06-16 - 录入 2026 龙虎山第五届桨板大赛报名公告

- 变更：根据鹰潭马拉松公众号文章，创建生产赛事 `event_id=384`（`2026“龙虎天下绝”龙虎山第五届桨板大赛暨“运动赣鄱·活力江西”江西省第十七届运动会（社会部）鹰潭市桨板选拔赛`，2026-06-20 至 2026-06-21，江西省鹰潭市龙虎山风景名胜区）。本次仅录入赛事报名公告、日程、参赛要求、费用、奖金和报名二维码，不录入成绩或积分。
- 影响表：`sup_events`、`sup_event_categories`、`sup_event_category_prizes`、`sup_event_officials`、`sup_event_submissions`。不影响 `sup_event_results`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`，不会自动创建运动员或同步战绩缓存。
- 影响接口/页面：赛事列表、赛事详情页、`/api/events`、`/api/events/384`。该赛事 `result_status='none'`，成绩/积分查询不会新增记录；提报 `submission_id=1` 已标记为 `ingested` 并关联 `event_id=384`。
- 回滚/核验：核验该赛事组别 5 条、逐名次奖金 78 条、技术官员占位 2 条，赛事状态 `published/upcoming`，星级 `三星`、系数 `3.0`。如需回滚，按 `event_id=384` 删除 `sup_event_category_prizes`、`sup_event_categories`、`sup_event_officials`，再删除 `sup_events` 记录，并将对应 `sup_event_submissions` 恢复为 `pending`。

### 2026-06-16 - 录入 2026 中国桨板精英联赛无锡站补充通知

- 变更：根据中国桨板公众号发布的体育总局水上中心补充通知，创建生产赛事 `event_id=386`（`2026年中国桨板精英联赛（无锡站）`，2026-07-04 至 2026-07-05，江苏省无锡市梁溪区清名桥历史文化街区）。本次仅录入赛事补充通知、日程、项目距离、报名报到要求和技术官员，不录入成绩或积分。
- 影响表：`sup_events`、`sup_event_categories`、`sup_event_officials`、`sup_event_submissions`、`sup_wechat_articles`。不影响 `sup_event_results`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`，不会自动创建运动员或同步战绩缓存。
- 影响接口/页面：赛事列表、赛事详情页、`/api/events`、`/api/events/386`。该赛事 `result_status='none'`，赛事评级按中国桨板精英联赛口径记录为 `五星`、系数 `5.0`、`source_scope='全国'`；提报 `submission_id=67` 和微信文章 `id=151` 已关联 `event_id=386`。
- 回滚/核验：核验该赛事组别 4 条、技术官员 18 条、成绩与积分记录均为 0，赛事状态 `published/upcoming`。如需回滚，按 `event_id=386` 删除 `sup_event_officials`、`sup_event_categories`，再删除 `sup_events` 记录，并将对应 `sup_event_submissions` 恢复为 `pending`、`sup_wechat_articles` 恢复为待人工处理。

### 2026-06-17 - 录入第二届全国全民健身大赛西南区桨板比赛预告

- 变更：根据开州发布公众号文章《国家级桨板大赛即将在汉丰湖举行》，创建生产赛事 `event_id=387`（`第二届全国全民健身大赛（西南区）桨板比赛`，2026-06-19 至 2026-06-21，重庆市开州区汉丰湖城南故津片区）。本次仅录入赛事预告、主办承办信息、赛程、团体年龄组和竞赛项目，不录入成绩或积分。
- 影响表：`sup_events`、`sup_event_categories`。不影响 `sup_event_results`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`，不会自动创建运动员或同步战绩缓存。
- 影响接口/页面：赛事列表、赛事详情页、`/api/events`、`/api/events/387`。该赛事 `result_status='none'`，参考同类全国全民健身大赛区域赛口径记录为 `三星`、系数 `3.0`、`source_scope='西南区'`。
- 回滚/核验：核验该赛事组别 8 条、逐名次奖金 0 条、技术官员 0 条、成绩与积分记录均为 0，赛事状态 `published/upcoming`。如需回滚，按 `event_id=387` 删除 `sup_event_categories` 后删除 `sup_events` 记录。

### 2026-06-18 - 录入 2026 中国桨板国际公开赛（汉中站）成绩与积分

- 变更：为用户提交批次 `mp_1781786111424_mittlaou` 绑定既有生产赛事 `event_id=380`（`2026年中国桨板国际公开赛（汉中站）`，2026-06-13 至 2026-06-14，陕西省汉中市汉江汉中城区段），从 1 份成绩册 PDF 导入第 28-83 页赛事成绩 666 条，并从第 2-27 页导入参赛单位、高校、个人和团体积分 351 条。
- 影响表：`sup_event_point_standings` 新增 `technical_rank`、`technical_points` 两列，用于保存成绩册中的技术赛排名和技术赛积分；`sup_events`、`sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`、`sup_event_result_submissions`、`sup_event_point_standings`、`sup_athletes`、`sup_athlete_identity_links`、`sup_club_team_aliases` 均有数据写入或更新。本次导入触达并同步 327 名运动员战绩缓存；提交记录 `submission_id=32` 更新为 `imported`，来源记录 `source_id=467`。
- 影响接口/页面：`/events/380`、`/api/events/380/results`、`/results`、`/api/results`、运动员详情页战绩面板。赛事状态更新为 `completed`，`result_status='extended_complete'`，`source_scope='国内外'`；赛事成绩 API 的积分榜返回字段新增 `technical_rank`、`technical_points`，前台和后台积分榜增加技术赛列。
- 回滚/核验：核验生产库 `sup_event_results` 中 `event_id=380` 共 666 条，状态分布为正常成绩 615、DNS 38、DNF 7、DSQ 6；成绩模块 47 个，均无同一决赛模块多个正常第一名。`sup_event_point_standings` 中 `event_id=380` 共 351 条、18 个积分模块；双人龙板积分前三名包含技术赛积分 170/200/150。来源 OSS PDF 返回 200。如需回滚，应先删除 `event_id=380` 关联的 `sup_event_results`、`sup_event_result_members`、`sup_event_result_sources`、`sup_event_point_standings`，再视情况清理本次自动创建且无其他成绩关联的运动员实体、身份链接、队伍别名和提交记录状态；字段迁移如需回滚，可在确认没有其他赛事使用后删除 `technical_rank`、`technical_points`。
