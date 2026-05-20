# SUP Wiki

桨板运动资讯百科 + 运动员比赛成绩平台。提供品牌、产品、运动员、博主、赛事、**每场比赛成绩**信息。当前由管理员通过 AI 辅助维护，正在逐步从「管理员私人知识工具」演进为「面向所有桨板运动员与爱好者的公共平台」。

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

### 产品演进阶段（决定当前优先级）

产品正在从「i_add_u 私人知识工具」演进为「面向所有桨板运动员与爱好者的公共平台」。**比赛成绩模块（`/results`、运动员战绩面板、赛事成绩面板）是这次转折的起点**——它把"自己跑过的比赛"变成用户进入平台的第一个钩子。

- **当前阶段：管理员维护 + 公众浏览。** 所有内容仍由管理员（i_add_u）录入，但访问者已经包含运动员、爱好者、赛事关注者。任何已开放的页面（成绩、运动员、赛事、品牌、产品等）必须**按公开产品标准**设计，不能再当作"i_add_u 自用界面"。
- **下一阶段：开放更多模块给公众。** 题库、个人主页、订阅、收藏、成绩认领（运动员证明"这是我"）、装备/赛事评价等会陆续向公众开放，需要预留账号体系、权限模型、UGC 审核流的位置。
- **优先级反转规则**：原本排在第三的"公众用户体验"，在**已开放或即将开放的模块**上**升级为第一优先级**——这些模块是新用户进入平台的入口，体验差会直接劝退用户、伤害口碑；只有纯管理员使用、不对外暴露的模块（批量导入、草稿编辑、身份匹配后台等）仍以 i_add_u 录入效率为唯一目标。
- **判断方法**：动手前先问 ——「这个功能在 `/admin` 之外能被普通访客触达吗？」 → 是 → 走下面的「公众产品设计原则」；否 → 走管理员效率优先。

### 面向公众用户的产品设计原则（开放模块强制遵守）

任何已开放或即将开放给公众的模块，除「三大目标 + 设计原则」外，必须满足：

1. **零门槛进入**：未登录也能看到核心内容（成绩、运动员、品牌、产品），不强制注册或扫码才能浏览。
2. **移动优先**：桨板用户大量在赛场、湖边、户外用手机查看；列表/详情/筛选必须在 375px 宽度下完整可用，禁止依赖 hover、长按等手机难触发的交互。
3. **运动员"找自己"零摩擦**：成绩列表、运动员列表必须支持按**姓名 / 号码布 / 队伍 / 赛事**快速检索，让用户 5 秒内定位到本人/熟人——这是平台粘性的核心。
4. **数据出处可追溯**：比赛成绩、运动员战绩等关键数据必须能点回原始来源（`source_url` / `source_title` / `source_type`），错一条比缺一条伤害大得多。前台展示要把"已核验/待核验"（`review_status`、`is_verified`）状态明确传达给用户。
5. **可分享、可外链**：所有公开页有稳定 URL、合理的 `<title>` / 描述 / OG 图片，便于在微信、小红书、抖音渠道传播——这是冷启动的主要获客路径。
6. **三态必备**：空状态（"暂无成绩"）、错误状态（网络/数据错误）、加载状态（骨架屏或 spinner）都不能省，不能让用户面对白屏或英文报错。
7. **为账号体系预留接口**：当前没有公众用户登录，但**新组件、新数据模型必须为未来的"我的"、"认领成绩"、"订阅赛事"、"评价装备" 留好挂点**——不要写死成纯静态展示，例如成绩条目应预留"是否本人"、"已认领"等状态字段位置。
8. **性能预算**：开放页面 LCP < 2.5s（4G 网络），列表分页 ≤ 50 条，禁止一次性渲染整个赛事的所有成绩；详情页核心信息（运动员姓名、名次、成绩）必须 SSR 直出，不能等待客户端 JS。
9. **隐私与署名**：成绩页公开个人姓名/成绩是合理的（赛事本身就是公开的），但**禁止公开私人联系方式（手机号、微信号、住址）**；运动员个人主页要支持未来"是否公开"开关。

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
│   │   ├── events/                 # 赛事列表 + 详情（含成绩面板）
│   │   ├── results/                # 全站比赛成绩浏览页（跨赛事检索成绩）
│   │   ├── admin/                  # 管理后台（独立布局，不含公共 Header/Footer）
│   │   │   ├── layout.tsx          # 认证守卫 + 侧边栏
│   │   │   ├── page.tsx            # 仪表板
│   │   │   ├── brands/             # 品牌 CRUD
│   │   │   ├── products/           # 产品 CRUD
│   │   │   ├── athletes/           # 运动员 CRUD
│   │   │   ├── creators/           # 博主 CRUD
│   │   │   ├── events/             # 赛事 CRUD（可在赛事下编辑成绩）
│   │   │   ├── results/            # 成绩管理（审核、纠错、身份匹配）
│   │   │   └── import/             # 批量 JSON 导入
│   │   └── api/
│   │       ├── brands/             # 公开 API
│   │       ├── products/
│   │       ├── athletes/
│   │       ├── creators/
│   │       ├── events/             # 含 /api/events/[id]/results 嵌套接口
│   │       ├── results/            # 公开成绩聚合查询接口
│   │       └── admin/              # 管理员 API（JWT 鉴权）
│   │           ├── login/          # 登录接口
│   │           ├── brands/
│   │           ├── products/
│   │           ├── athletes/
│   │           ├── creators/
│   │           ├── events/         # 含 /api/admin/events/[id]/results
│   │           └── results/        # 成绩审核 / 修改 / 身份匹配
│   ├── components/
│   │   ├── Header.tsx              # 公共导航（编辑风格，小型大写 Logo）
│   │   ├── Footer.tsx              # 公共底部
│   │   ├── PublicShell.tsx         # 按路径控制是否渲染 Header/Footer（admin 路径跳过）
│   │   ├── AthleteResultsPanel.tsx # 运动员详情页：本人参赛战绩面板
│   │   ├── EventResultsPanel.tsx   # 赛事详情页：该赛事所有项目成绩面板
│   │   ├── AthleteResultName.tsx   # 成绩中的运动员名（已认领则链到运动员页）
│   │   ├── ResultStatusBadge.tsx   # 成绩审核状态标签（已核验/待核验/有疑问）
│   │   └── admin/
│   │       └── EntityManager.tsx   # 通用 CRUD 表格组件（含 JSON 粘贴模式）
│   ├── lib/
│   │   ├── db.ts                   # MySQL 连接池
│   │   ├── auth.ts                 # 管理员密码验证 + JWT
│   │   ├── admin.ts                # withAdmin 中间件
│   │   ├── event-results.ts        # 成绩查询/聚合/筛选共用逻辑
│   │   ├── result-ordering.ts      # 名次排序规则（含 DNF/DSQ/DNS 排序）
│   │   └── result-status.ts        # 成绩审核状态判断与展示映射
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
| `sup_event_results` | 比赛成绩（每条 = 某运动员在某赛事某项目的一个名次） | event_id(FK), athlete_id(FK, 可空), athlete_name_snapshot, gender_group, discipline, round_label, rank_position, finish_time, time_seconds, points, team_name, source_type, review_status, is_verified |
| `sup_event_result_members` | 团体赛成绩的参赛队员明细 | result_id(FK), athlete_id(FK, 可空), member_name, member_order |
| `sup_event_result_sources` | 成绩来源（官方公告/媒体报道/直播 OCR 等） | event_id(FK), source_url, source_title, source_type |
| `sup_athlete_identity_links` | 成绩中出现的姓名 → 运动员实体的待匹配/已确认关系 | normalized_name, athlete_id(FK, 可空), confidence, status('pending'/'confirmed'/'rejected') |

所有「内容实体」表（brands/products/athletes/creators/events）均有 `status ENUM('draft','published')` 字段，公开 API 只返回 `published` 数据。**比赛成绩表使用独立的审核维度**（`review_status` + `is_verified`）：公开 API 默认只返回 `is_verified=1` 的成绩，`needs_review` 的成绩仅在管理后台可见，待匹配的同名运动员通过 `sup_athlete_identity_links` 单独处理，避免错挂导致运动员战绩污染。

## 图片资源规范（强制）

**所有图片必须走 OSS，禁止使用 `public/*-import/` 等本地静态目录。** 这是硬性规定，无论新增运动员、博主、品牌、产品还是赛事，一律按以下流程处理：

### OSS 配置（阿里云）

| 项 | 值 |
|----|----|
| Bucket | `sport-hacker-assets` |
| Endpoint | `sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com` |
| 路径约定 | `sup-wiki/<folder>/<timestamp>-<rand>.<ext>` |
| 凭据位置 | 生产 `.env.local`：`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` |

### 目录约定

| 实体 | OSS folder |
|------|-----------|
| 运动员 | `sup-wiki/athletes/` |
| 博主 | `sup-wiki/creators/` |
| 品牌 | `sup-wiki/brands/` |
| 产品 | `sup-wiki/products/` |
| 赛事 | `sup-wiki/events/` |

### 上传方式

**方式 1（推荐，日常管理员录入）**：管理后台 `/admin` 的图片上传组件 → 走 `/api/admin/upload`（JWT 鉴权 + OSS 签名）。

**方式 2（Claude Code 批量脚本上传）**：直接写一次性 Node 脚本调用 OSS HTTP API，使用手写 HMAC-SHA1 签名。签名模板：

```js
import crypto from 'crypto';
const stringToSign = `PUT\n\n${contentType}\n${date}\n/${OSS_BUCKET}/${ossKey}`;
const signature = crypto.createHmac('sha1', OSS_SK).update(stringToSign).digest('base64');
// Header: Authorization: OSS <AK>:<signature>
```

完整参考：`src/app/api/admin/upload/route.ts`。脚本放 `/tmp/`，执行完立即删除，不污染项目目录。

### 禁止事项

- ❌ 不要把图片放 `public/` 下任何 `*-import/` 目录后当静态资源用
- ❌ 不要用 `scp` 把图片传到服务器 `public/` 再用本地路径引用
- ❌ 数据库 `photo` / `avatar` / `cover_image` 等字段禁止写入 `/xxx-import/*.png` 这类相对路径，必须写完整 OSS URL

### 新增实体带图片的标准流程

1. Claude Code 收到用户发来的图片
2. 直接通过 OSS 签名上传到对应 folder，获得 URL
3. 数据库 INSERT 时 `photo` / `avatar` 字段写 OSS URL
4. 本地不留图片副本，脚本执行后清理

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
| GET | `/api/events/[id]/results` | 单场赛事所有项目成绩 |
| GET | `/api/results` | 全站成绩聚合检索（支持 athlete/event/discipline/姓名 搜索） |

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
| GET/POST | `/api/admin/events/[id]/results` | 单场赛事的成绩 列表/录入 |
| GET/POST | `/api/admin/results` | 全量成绩列表 / 单条新增 |
| PUT/DELETE | `/api/admin/results/[id]` | 单条成绩 编辑/删除（含审核状态、身份匹配） |

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
