# SUP Wiki

桨板运动资讯百科网站，提供品牌、产品、运动员、博主、赛事信息。由管理员通过 AI 辅助维护，无用户 UGC。

**线上地址：** https://sup.iaddu.cn

## 项目目标与核心价值观

这是功能迭代的最高优先级判断依据，所有需求和设计决策都应以此对齐：

### 第一目标（最重要）：辅助 i_add_u 成为桨板领域超级资深专家

- 对象：管理员用户 `i_add_u`（微信号 i_add_u）
- 覆盖维度：桨板品牌与产品、运动员、博主、赛事、专业知识（装备/技术/竞技规则/安全/历史）
- 核心工具：知识题库（学习模块）、系统化的内容管理、AI 辅助录入与查阅
- **功能优先级判断**：凡是能帮助 i_add_u 更快更深地掌握桨板专业知识、建立结构化认知的功能，优先级最高

### 第二目标（次重要）：基于项目内容帮助 i_add_u 扩大桨板领域影响力

- 场景：桨板教学、宣传推广、知识分享、赛事解说
- 方向：将网站的结构化内容转化为可直接用于对外传播的素材和工具
- **功能优先级判断**：凡是能帮 i_add_u 生产高质量桨板内容、扩大个人影响力的功能，优先级次高

### 第三目标（次次重要）：新手和桨板爱好者了解桨板的平台

- 对象：公众用户、桨板新手
- 方向：内容可读性、搜索与筛选体验、知识科普质量
- **功能优先级判断**：面向大众用户的体验优化排在前两个目标之后

### 设计原则（由目标推导）

1. **深度优于广度**：内容宁可少但精准权威，不堆砌泛泛信息
2. **工具性优先**：i_add_u 用这个网站是为了提升自己，所有功能要让"用起来变强"
3. **可信度第一**：每一条数据、每一道题目、每一个解析都要经得起推敲，错误比空白更有害

## 技术栈

- **前端**: Next.js 16 + React 19 + Tailwind CSS v4
- **字体**: Cormorant Garamond（标题）+ DM Sans（正文），通过 Google Fonts 引入
- **后端**: Next.js API Routes
- **数据库**: MySQL 8（共用 hk_aliyun_ecs 上的 sport_hacker 数据库）
- **部署**: hz_aliyun_ecs + Nginx + PM2

## 项目结构

```
sup-wiki/
├── src/
│   ├── app/
│   │   ├── page.tsx                # 首页（编辑式排版风格）
│   │   ├── brands/                 # 品牌列表 + 详情
│   │   ├── products/               # 产品列表 + 详情
│   │   ├── athletes/               # 运动员列表 + 详情
│   │   ├── creators/               # 博主列表 + 详情
│   │   ├── events/                 # 赛事列表 + 详情
│   │   ├── admin/                  # 管理后台（独立布局，不含公共 Header/Footer）
│   │   │   ├── layout.tsx          # 认证守卫 + 侧边栏
│   │   │   ├── page.tsx            # 仪表板
│   │   │   ├── brands/             # 品牌 CRUD
│   │   │   ├── products/           # 产品 CRUD
│   │   │   ├── athletes/           # 运动员 CRUD
│   │   │   ├── creators/           # 博主 CRUD
│   │   │   ├── events/             # 赛事 CRUD
│   │   │   └── import/             # 批量 JSON 导入
│   │   └── api/
│   │       ├── brands/             # 公开 API
│   │       ├── products/
│   │       ├── athletes/
│   │       ├── creators/
│   │       ├── events/
│   │       └── admin/              # 管理员 API（JWT 鉴权）
│   │           ├── login/          # 登录接口
│   │           ├── brands/
│   │           ├── products/
│   │           ├── athletes/
│   │           ├── creators/
│   │           └── events/
│   ├── components/
│   │   ├── Header.tsx              # 公共导航（编辑风格，小型大写 Logo）
│   │   ├── Footer.tsx              # 公共底部
│   │   ├── PublicShell.tsx         # 按路径控制是否渲染 Header/Footer（admin 路径跳过）
│   │   └── admin/
│   │       └── EntityManager.tsx   # 通用 CRUD 表格组件（含 JSON 粘贴模式）
│   ├── lib/
│   │   ├── db.ts                   # MySQL 连接池
│   │   ├── auth.ts                 # 管理员密码验证 + JWT
│   │   └── admin.ts                # withAdmin 中间件
│   └── types/
│       └── index.ts                # 所有 TypeScript 类型定义
├── database/
│   ├── init.sql                    # 完整建表语句（v2，含 status 字段和 sup_events）
│   ├── seed.sql                    # 品牌/产品/运动员/博主种子数据
│   ├── seed-events.sql             # 国内 SUP 赛事种子数据（7条）
│   └── migrate-v2.sql              # v1→v2 迁移脚本（添加 status 列，创建 events 表）
└── .claude/
    └── deploy.json                 # 部署配置
```

## 数据库

**服务器：** hk_aliyun_ecs (8.217.233.65)，sport_hacker 数据库，表名加 `sup_` 前缀。

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `sup_brands` | 品牌 | slug, tier(entry/intermediate/pro), status |
| `sup_products` | 产品 | brand_id(FK), type, suitable_for, images(JSON), buy_links(JSON), status |
| `sup_athletes` | 运动员 | discipline, icf_ranking, achievements(JSON), social_links(JSON), status |
| `sup_creators` | 博主 | platform, follower_tier, content_style, status |
| `sup_events` | 赛事 | event_type, event_status, province, start_date, disciplines(JSON), status |

所有实体表均有 `status ENUM('draft','published')` 字段，公开 API 只返回 `published` 数据。

## 内容管理工作流（AI 辅助）

管理员工作流（无 UGC）：

1. **Claude Code 生成 JSON 数据**（品牌/产品/赛事等）
2. **管理员登录** https://sup.iaddu.cn/admin（密码见 .env.local 中 `ADMIN_PASSWORD`）
3. **批量导入**：进入「批量导入」页面，粘贴 JSON 数组 → 解析预览 → 选择导入为草稿或直接发布
4. **单条编辑**：各实体管理页均支持表单模式和 JSON 粘贴模式
5. **状态切换**：表格中一键 发布/收回 草稿

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local 填入数据库密码和管理员密码

npm run dev   # 默认端口 3000（本地）
```

**初始化数据库（首次）：**
```bash
mysql -h 8.217.233.65 -u root -p sport_hacker < database/init.sql
mysql -h 8.217.233.65 -u root -p sport_hacker < database/seed.sql
mysql -h 8.217.233.65 -u root -p sport_hacker < database/seed-events.sql
```

## API 路由

### 公开 API（只返回 published 内容）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/brands` | 品牌列表（支持 tier/country/search 筛选） |
| GET | `/api/brands/[slug]` | 品牌详情 + 旗下产品 |
| GET | `/api/products` | 产品列表（支持 brand_id/type/suitable_for/price 筛选） |
| GET | `/api/products/[id]` | 产品详情 |
| GET | `/api/athletes` | 运动员列表（支持 discipline/nationality 筛选） |
| GET | `/api/athletes/[id]` | 运动员详情 |
| GET | `/api/creators` | 博主列表（支持 platform/follower_tier 筛选） |
| GET | `/api/creators/[id]` | 博主详情 |
| GET | `/api/events` | 赛事列表（支持 event_type/province/event_status 筛选） |
| GET | `/api/events/[id]` | 赛事详情 |

### 管理员 API（需 Bearer JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 密码登录，返回 JWT |
| GET/POST | `/api/admin/brands` | 列表（含 draft）/ 创建 |
| PUT/DELETE | `/api/admin/brands/[id]` | 编辑 / 删除 |
| GET/POST | `/api/admin/products` | 同上 |
| PUT/DELETE | `/api/admin/products/[id]` | 同上 |
| GET/POST | `/api/admin/athletes` | 同上 |
| PUT/DELETE | `/api/admin/athletes/[id]` | 同上 |
| GET/POST | `/api/admin/creators` | 同上 |
| PUT/DELETE | `/api/admin/creators/[id]` | 同上 |
| GET/POST | `/api/admin/events` | 同上 |
| PUT/DELETE | `/api/admin/events/[id]` | 同上 |

## 部署

**服务器：** hz_aliyun_ecs (120.55.113.181)

| 项目 | 值 |
|------|----|
| 部署路径 | `/www/wwwroot/sup-wiki` |
| 端口 | 3107 |
| 进程管理 | PM2（进程名 `sup-wiki`） |
| Nginx 配置 | `/etc/nginx/sites-enabled/sup.iaddu.cn` |
| SSL 证书 | Let's Encrypt，有效至 2026-07-01（自动续期） |

**部署命令（服务器不能直接访问 GitHub，用文件传输方式）：**
```bash
git archive HEAD | ssh hz_aliyun_ecs "tar -xf - -C /www/wwwroot/sup-wiki"
ssh hz_aliyun_ecs "cd /www/wwwroot/sup-wiki && rm -rf .next && npm run build && pm2 restart sup-wiki"
```

**注意：必须先 `rm -rf .next` 再 build，否则 pm2 restart 会使用旧构建产物。**

## Lessons Learned

### mysql2 JSON 列自动解析问题
- **What went wrong:** mysql2 将 MySQL JSON 列返回为已解析的 JS 对象，对已解析的数组调用 `JSON.parse(array)` 时，JS 先调用 `array.toString()` 得到 `"race,distance"` 格式字符串，导致 JSON.parse 失败。
- **Root cause:** mysql2 3.x 对 MySQL JSON 类型列可能返回已解析的 JS 对象，与 TEXT 列存储 JSON 的行为不同。
- **Correct approach:** 始终用防御性写法：`Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : [])`

### 服务器部署必须删除旧 .next 目录
- **What went wrong:** `git archive | tar` 传输源文件后重启 PM2，服务器仍使用旧的 `.next` 构建目录。
- **Root cause:** `git archive` 只传输源文件，不清除旧构建产物；PM2 restart 不会自动重新构建。
- **Correct approach:** 传输后先 `rm -rf .next`，再 `npm run build`，最后 `pm2 restart`。

### MySQL LIMIT ? OFFSET ? 参数化问题
- **What went wrong:** `pool.execute(sql, [...params, pageSize, offset])` 报 `ER_WRONG_ARGUMENTS` 错误。
- **Root cause:** mysql2 prepared statements 对 LIMIT/OFFSET 参数类型有严格要求。
- **Correct approach:** LIMIT/OFFSET 用模板字符串直接嵌入：`` LIMIT ${pageSize} OFFSET ${offset} ``

### Admin layout 与 Root layout 隔离
- **What went wrong:** 管理后台页面显示了公共 Header 和 Footer，因为根 layout 对所有路由生效。
- **Root cause:** Next.js App Router 的 nested layout 仍被 root layout 包裹，admin layout 无法阻止 root layout 渲染。
- **Correct approach:** 创建 `PublicShell` client 组件，通过 `usePathname()` 判断，`/admin` 路径下跳过 Header/Footer 直接渲染 children。

### Server Component 不能有事件处理器
- **What went wrong:** 在 Server Component 中使用 `onMouseEnter`/`onMouseLeave` 导致构建失败。
- **Root cause:** React Server Components 不支持任何事件处理器 prop。
- **Correct approach:** 所有 hover 效果改用 CSS（globals.css 中定义 `.class:hover` 规则），不使用 JS 事件。

### 直接执行 MySQL 命令前必须确认客户端可用性和连接路径
- **What went wrong:** 直接在本地运行 `mysql -h 8.217.233.65 ...`，命令报 exit 127（命令不存在）；随后改为 `ssh hz_aliyun_ecs "mysql ..."` 仍然失败，因为 hz_aliyun_ecs（部署服务器）上没有安装 mysql 客户端。
- **Root cause:** 本地 Mac 没有 mysql 客户端；部署服务器 hz_aliyun_ecs 只跑 Node/PM2，不装 mysql；数据库在 hk_aliyun_ecs（8.217.233.65），该机器上才有 mysql 客户端。两台服务器职责不同，混淆了。
- **Correct approach:** 需要直接操作 MySQL 时，应通过 `ssh hk_aliyun_ecs "mysql -u root -p'xxx' sport_hacker ..."` 在数据库所在机器上执行，而非 hz_aliyun_ecs。

### git archive 部署不包含未提交的本地修改
- **What went wrong:** 修改了 `constants.ts` 和 `WechatContactCard.tsx` 后直接运行 `git archive HEAD | ssh ...` 部署，服务器仍是旧版本代码，改动完全没生效。
- **Root cause:** `git archive HEAD` 只打包 git 已追踪且已提交的文件，未提交的本地修改不会被包含。新增未追踪的静态资源（如图片）同样不会被包含，需单独 `scp`。
- **Correct approach:** 有未提交改动时，用 `scp` 直接传输改动的文件到服务器对应路径，再重新 build；或先 commit 再 git archive。新增的 `public/` 静态资源文件必须单独 `scp` 传输（不在 git archive 中）。

### .env.local 不存在时不要盲目读取，应先确认文件位置
- **What went wrong:** 被授权读取 .env.local 后直接 Read，结果文件不存在（本地没有），浪费了一次工具调用。
- **Root cause:** .env.local 是本地敏感配置，通常不提交 git 也不同步到本地开发机；真正的生产配置在服务器 `/www/wwwroot/sup-wiki/.env.local`。
- **Correct approach:** 若本地 .env.local 不存在，应立即通过 `ssh hz_aliyun_ecs "cat /www/wwwroot/sup-wiki/.env.local"` 从生产服务器读取配置，而不是继续在本地查找。
