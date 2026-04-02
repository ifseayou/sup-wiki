# SUP Wiki

桨板运动资讯百科网站，提供品牌、产品、运动员、博主、赛事信息。由管理员通过 AI 辅助维护，无用户 UGC。

**线上地址：** https://sup.iaddu.cn

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
