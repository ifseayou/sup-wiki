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
