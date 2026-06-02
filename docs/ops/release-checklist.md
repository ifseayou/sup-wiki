# SUP 双仓开发与发布检查清单

本文档用于每次涉及 `sup-wiki` 与 `sport_hacker` 的开发、数据迁移和部署。

## 开发前

- 确认需求影响范围：
  - 只影响 Web。
  - 只影响小程序。
  - 同时影响 Web、小程序、数据库或共享接口。
- 检查本地未提交改动，避免覆盖他人或历史任务文件。
- 如果涉及 `sup_` 表，先查看 `sup-wiki/database/` 和 `sport_hacker/server/database/schema.md`。
- 如果涉及成绩导入，优先使用 `race-results-import` skill 和现有导入脚本模式。

## 数据库变更

- 在 `sup-wiki/database/` 新增独立迁移 SQL。
- 迁移必须可重复检查字段或索引是否存在。
- 执行生产迁移前先只读确认当前结构。
- 需要回填时，先干跑或统计影响行数。
- 迁移后更新 `sport_hacker/server/database/schema.md` 中受影响表的字段和索引。

## 本地验证

`sup-wiki`：

```bash
npm run build
```

重点页面：

- `/results`
- `/events`
- `/events/[id]`
- `/athletes/[id]`
- `/admin/event-result-submissions`
- `/admin/results`
- `/admin/media`

`sport_hacker`：

```bash
cd server
npm test
```

重点小程序流程：

- SUP 首页。
- 查成绩。
- 查积分。
- 赛事成绩档案。
- 运动员详情。
- 我的资料。
- 用户反馈。
- 成绩册上传。

## 发布顺序

只改 `sup-wiki`：

1. 拉取最新代码。
2. 安装依赖。
3. 构建。
4. 重启 PM2 服务。
5. 检查 Web 页面和管理后台。

线上目标：

```text
root@120.55.113.181:/root/sup-wiki
PM2 sup-wiki
port 3107
```

只改 `sport_hacker`：

1. 运行后端测试。
2. 同步 `server/` 到生产。
3. 安装依赖。
4. 重启 PM2 服务。
5. 检查小程序接口。

线上目标：

```text
zjk_aliyun_ecs:/opt/sport-hacker
PM2 sport-hacker
port 3002
```

部署时必须排除 `.env`，部署后确认 `MYSQL_HOST=8.217.233.65`。

改共享数据库或共享接口：

1. 备份或确认回滚方案。
2. 执行数据库迁移。
3. 部署接口提供方。
4. 部署接口消费方。
5. 同时做 Web 与小程序冒烟测试。

## 生产冒烟测试

Web：

- 成绩查询能返回真实数据。
- 年度积分年份和组别选项完整。
- 大型赛事成绩模块按需加载。
- 运动员详情能展示成绩和积分排名。
- 管理后台能打开成绩册提交、媒体库、用户反馈。

小程序：

- 首页查成绩、查积分入口可进入。
- 成绩查询筛选能返回数据。
- 积分查询年份和组别完整。
- 运动员详情头像、简介、排名正常。
- 反馈可以提交文字、评分和图片。

跨仓必测：

- 已认领运动员展示头像、简介、成绩和积分。
- 未认领运动员只展示最小必要成绩信息。
- 草稿、回收、隐藏课程不会出现在小程序。
- 用户提交内容能在 `sup-wiki` 后台查到。
- 搜索日志能记录用户、入口、关键词和筛选明细。

## 故障处理

- 如果 Web 正常、小程序异常，优先检查 `sport_hacker/server/routes/sup-wiki.js` 的字段适配。
- 如果小程序正常、Web 异常，优先检查 `sup-wiki` 的 API、SSR 查询和 Next 构建日志。
- 如果两端都异常，优先检查数据库迁移、索引、字段名和生产环境变量。
- 如果成绩挂错赛事，按 `source_id` 或提交批次精确撤回，不按短 slug 或模糊赛事名删除。
- 如果查询变慢，先用真实生产 SQL 做 `EXPLAIN`，再补组合索引。
