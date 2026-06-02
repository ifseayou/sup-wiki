# SUP 共享 API 契约

本文档记录 Web 与小程序共享的 SUP 业务接口口径。具体 URL 可以在两个仓库中不同，但字段含义、排序规则和空值规则应保持一致。

## 通用规则

- 公开列表必须分页，默认每页不超过 50 条。
- 公开成绩默认只展示已确认、已核验、来源有效的数据。
- 运动员、赛事、成绩、积分都必须保留可追溯来源字段；前台是否展示由页面决定。
- 名次排序必须把正常完赛成绩排在 DNS、DNF、DSQ、DQ 等状态前。
- 时间字段优先返回原始展示值，同时保留可排序秒数字段。
- 头像、封面、图片必须是 OSS 完整 URL。

## 成绩查询

调用方：

- Web：`sup-wiki` `/results` 与相关 API。
- 小程序：`sport_hacker` SUP 查成绩页面。

核心字段：

| 字段 | 含义 |
| --- | --- |
| result_id | 成绩 ID |
| event_id | 赛事 ID |
| event_name | 赛事名称 |
| athlete_id | 匹配到的运动员 ID，可为空 |
| athlete_name | 成绩册中的运动员姓名 |
| athlete_avatar | 运动员头像，可为空 |
| discipline | 项目 |
| gender_group | 组别 |
| round_label | 赛段，如预赛、半决赛、决赛 |
| rank_position | 数字名次，可为空 |
| rank_label | 展示名次或状态 |
| finish_time | 展示成绩 |
| time_seconds | 排序用秒数，可为空 |
| pace_text | 配速，可为空 |
| team_name | 队伍或单位，可为空 |
| result_status_code | DNS/DNF/DSQ/DQ 等状态，可为空 |
| result_status_note | 状态说明，可为空 |
| source_id | 来源 ID |
| source_title | 来源名称 |
| source_locator | 来源页码或定位 |

筛选口径：

- 运动员：支持姓名模糊匹配。
- 赛事：支持赛事名模糊匹配。
- 年份：按赛事开始日期年份。
- 项目：按标准化项目或展示项目匹配。
- 组别：按年度积分/成绩组别展示值匹配。
- 名次：支持前十、前三、冠军等快捷筛选。

## 年度积分

调用方：

- Web：`sup-wiki` `/results` 年度积分 Tab。
- 小程序：积分查询入口。

核心字段：

| 字段 | 含义 |
| --- | --- |
| standing_id | 年度积分记录 ID |
| year | 年份，当前应覆盖 2022 至 2025 等已导入年份 |
| group_code | 组别代码 |
| group_label | 组别展示名 |
| rank_position | 排名 |
| athlete_id | 匹配到的运动员 ID，可为空 |
| athlete_name | 运动员姓名 |
| team_name | 队伍或单位 |
| total_points | 总积分 |
| endurance_points | 耐力积分 |
| sprint_points | 竞速积分 |
| skill_points | 技巧积分 |
| source_title | 来源 |

筛选口径：

- 年份选项必须来自真实已导入数据，不写死单一年份。
- 组别选项必须来自真实已导入数据，不写死“全部组别”。
- 排名筛选保留全部排名、前三、前十等快捷选项。

## 赛事详情与赛事成绩档案

调用方：

- Web：赛事详情页成绩档案。
- 小程序：赛事成绩档案页。

核心字段：

| 字段 | 含义 |
| --- | --- |
| event_id | 赛事 ID |
| name | 赛事名称 |
| city/province | 举办地 |
| start_date/end_date | 比赛日期 |
| star_level | 星级 |
| event_status | 进行中或已结束 |
| result_count | 已收录成绩数 |
| modules | 成绩模块列表 |

模块字段：

| 字段 | 含义 |
| --- | --- |
| module_key | 模块唯一键 |
| discipline | 项目 |
| gender_group | 组别 |
| board_class | 板型，可为空 |
| result_count | 模块成绩数 |
| results | 点击模块后按需加载的成绩 |

模块排序：

- 默认按模块成绩数倒排。
- 同成绩数时按项目、组别稳定排序。
- 大型赛事不得一次性加载所有成绩，必须点击模块后按需读取。

## 运动员详情

调用方：

- Web：运动员详情页。
- 小程序：运动员资料卡。

核心字段：

| 字段 | 含义 |
| --- | --- |
| athlete_id | 运动员 ID |
| name | 中文名 |
| name_en | 英文名，可为空 |
| avatar/photo | 头像 |
| nationality | 国家 |
| province/city | 地区 |
| bio | 生涯介绍 |
| short_bio | 一句话介绍 |
| latest_point_rank | 最新积分排名 |
| race_count | 参赛数 |
| result_count | 成绩数 |
| best_rank | 最佳名次 |

展示规则：

- 小程序姓名下方优先展示 `short_bio`；没有则使用简短 `bio` 摘要。
- 排名区域优先展示最新年度积分排名。
- 隐私字段如手机号、微信号不公开展示。

## 用户提交类接口

包括：

- 成绩册提交
- 用户反馈
- 运动员认领
- 训练记录上传

规则：

- 需要登录。
- 上传图片和 PDF 走 OSS。
- 后台审核状态至少包含待处理、处理中、已入库、不录入、已驳回。
- 管理后台可以追溯提交用户、批次、文件、备注和处理状态。
- 小程序提交成功后必须返回可用于查询状态的 ID。
