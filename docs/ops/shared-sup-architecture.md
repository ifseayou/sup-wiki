# SUP Wiki 与 Sport Hacker 融合架构

本文档定义 `sup-wiki` 与 `sport_hacker` 两个仓库在 SUP 业务上的长期运维边界。目标是减少重复判断，避免数据库、接口、部署顺序混乱。

## 当前定位

`sup-wiki` 是 SUP Web 站、管理后台、赛事成绩导入、数据库迁移和公开页面的主仓库。

`sport_hacker` 是微信小程序、Express API、微信登录、用户侧上传/反馈/认领、通用运动健康功能的主仓库。

两个仓库共享同一个 MySQL 数据库 `sport_hacker`，SUP 业务表统一使用 `sup_` 前缀。OSS 图片统一使用 `sport-hacker-assets` bucket。

## 线上拓扑

> 2026-06-05 起两服务整合到同一台 hz_aliyun_ecs（原 sport_hacker 在 zjk，已迁移）。

| 项目 | 域名 | 机器 | 线上路径 | 服务 |
| --- | --- | --- | --- | --- |
| `sup-wiki` | `https://sup.iaddu.cn` | `hz_aliyun_ecs` / `120.55.113.181` | `/root/sup-wiki` | PM2 `sup-wiki`，端口 `3107` |
| `sport_hacker` | `https://sport.iaddu.cn` | `hz_aliyun_ecs` / `120.55.113.181` | `/opt/sport-hacker` | PM2 `sport-hacker`，端口 `3002` |
| MySQL | - | `hk_aliyun_ecs` / `8.217.233.65` | - | MySQL 8，库名 `sport_hacker` |

两服务同机：sport_hacker(BFF) 的 SUP 只读接口经 `127.0.0.1:3107` 复用 sup-wiki（唯一事实来源），鉴权用 `X-Internal-Token`/`X-Acting-Sup-User-Id`。线上 `sup-wiki` 以 `/root/sup-wiki` 为准；不要再混用历史路径 `/www/wwwroot/sup-wiki`。旧机 `zjk_aliyun_ecs`(39.100.160.80) 待清理。

## 责任边界

### sup-wiki 负责

- Web 公开站：赛事、运动员、成绩、积分、品牌、学习、课程、商城等页面。
- 管理后台：内容维护、成绩册提交、媒体库、用户反馈、认领审核、成绩来源管理。
- 赛事成绩导入：PDF/表格解析、缓存、干跑校验、生产库导入、来源追溯。
- SUP 数据库结构：所有 `sup_` 表结构变更默认先在 `sup-wiki/database/` 落迁移文件。
- SUP 数据质量：成绩来源、运动员匹配、积分映射、俱乐部/队伍别名等后台治理。

### sport_hacker 负责

- 微信小程序页面与交互。
- 小程序请求适配层：`server/routes/sup-wiki.js`。
- 微信登录、token、用户资料、头像上传。
- 小程序侧用户反馈、成绩册上传、运动员认领、训练记录。
- 通用运动健康功能：运动、饮食、体重、路线、活动周期、场地点评、活动招募。

## 跨仓开发原则

- 一个需求如果同时影响 Web/Admin 和小程序，应形成两个仓库的提交，但作为一个发布批次处理。
- 涉及共享字段时，先更新或核对 `docs/contracts/sup-api-contract.md`，再修改两端代码。
- 涉及 `sup_` 表结构时，迁移文件必须落在 `sup-wiki/database/`，`sport_hacker/server/database/schema.md` 只做速查。
- 小程序仍请求 `sport_hacker` 的 `/api/sup-wiki/*`，不要直接追 `sup-wiki` Next API。
- 生产 `.env` 不进入部署同步，部署后必须确认数据库仍指向 `hk_aliyun_ecs`。

### 禁止事项

- 不在 `sport_hacker` 私自新增或修改 `sup_` 表结构后不回写 `sup-wiki/database/`。
- 不让 Web 与小程序各自维护不同的成绩排序、积分组别、赛事状态口径。
- 不把图片写入本地 `public/*-import/` 路径；新增图片必须使用 OSS URL。
- 不在生产库手工执行一次性 SQL 后不落迁移记录。

## 数据库规则

`sup-wiki/database/` 是 SUP 表结构事实来源。新增、修改、索引优化、回填脚本都应放在这里。

`sport_hacker/server/database/schema.md` 是小程序后端的速查文档。生产迁移执行后，如果影响小程序读取或写入，必须同步更新该文档。

迁移文件命名建议：

```text
database/migrate-<area>-YYYY-MM-DD.sql
database/backfill-<area>-YYYY-MM-DD.sql
database/rollback-<area>-YYYY-MM-DD.sql
```

生产迁移前必须确认：

- 字段或索引是否已存在。
- 是否影响 Web 公开页。
- 是否影响小程序接口。
- 是否需要数据回填。
- 是否需要回滚 SQL。

## API 规则

Web 公开页面优先使用 `sup-wiki` 的 Next API 或 SSR 查询。

小程序继续请求 `sport_hacker` 的 `/api/sup-wiki/*`。Express 层只做小程序展示适配，不定义与 Web 不一致的业务口径。

共享业务字段以 `docs/contracts/sup-api-contract.md` 为准。涉及以下模块时必须同时检查两端：

- 成绩查询
- 年度积分
- 赛事详情与赛事成绩档案
- 运动员详情
- 学习模块
- 成绩册提交
- 用户反馈
- 运动员资料认领

## 部署顺序

只改 Web 或管理后台：

1. 在 `sup-wiki` 构建验证。
2. 部署 `sup-wiki`。
3. 检查 Web 页面和管理后台。

只改小程序后端：

1. 在 `sport_hacker/server` 跑测试。
2. 部署 `sport_hacker` Express 服务。
3. 检查小程序相关接口。

改共享数据库或共享接口：

1. 备份生产库或确认可回滚。
2. 执行数据库迁移。
3. 部署接口提供方。
4. 部署接口消费方。
5. 同时检查 Web 与小程序。

## 常见风险

- Web 新增字段后，小程序接口未适配，导致小程序展示空值或报错。
- 小程序提交的数据结构变了，管理后台审核页仍按旧结构解析。
- 成绩导入脚本误命中赛事 slug，导致结果挂错 event_id。
- 索引只按 Web 查询优化，遗漏小程序高频接口。
- 发布时只部署一个仓库，另一个仓库仍依赖旧字段。

处理这些风险的默认方法是：先看契约文档，再看迁移记录，再做双端冒烟测试。
