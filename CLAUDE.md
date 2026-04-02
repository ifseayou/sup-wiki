# SUP Wiki

桨板资讯百科网站，提供品牌、产品、运动员、博主信息。

## 技术栈

- **前端**: Next.js 15 + React 19 + Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: MySQL 8（共用 sport_hacker 数据库）
- **部署**: Vercel（计划）

## 项目结构

```
sup-wiki/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页
│   │   ├── brands/             # 品牌页面
│   │   ├── products/           # 产品页面
│   │   ├── athletes/           # 运动员页面
│   │   ├── creators/           # 博主页面
│   │   ├── contribute/         # 贡献页面
│   │   ├── admin/              # 管理后台
│   │   └── api/                # API Routes
│   ├── components/             # 共享组件
│   ├── lib/
│   │   ├── db.ts               # MySQL 连接
│   │   ├── auth.ts             # 认证工具
│   │   └── admin.ts            # 管理员工具
│   └── types/                  # TypeScript 类型
├── database/
│   ├── init.sql                # 数据库表结构
│   └── seed.sql                # 种子数据
└── public/                     # 静态资源
```

## 数据库

共用 sport_hacker 数据库，表名加 `sup_` 前缀：

- `sup_brands` - 品牌表
- `sup_products` - 产品表
- `sup_athletes` - 运动员表
- `sup_creators` - 博主表
- `sup_wiki_users` - Wiki 用户表
- `sup_contributions` - 贡献请求表

## 本地开发

```bash
# 安装依赖
npm install

# 创建 .env.local（参考 .env.example）
cp .env.example .env.local
# 编辑 .env.local 填入实际配置

# 初始化数据库
mysql -h <host> -u <user> -p < database/init.sql
mysql -h <host> -u <user> -p < database/seed.sql

# 启动开发服务器
npm run dev
```

## API 路由

### 公开 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/brands` | 品牌列表 |
| GET | `/api/brands/[slug]` | 品牌详情 |
| GET | `/api/products` | 产品列表 |
| GET | `/api/products/[id]` | 产品详情 |
| GET | `/api/athletes` | 运动员列表 |
| GET | `/api/athletes/[id]` | 运动员详情 |
| GET | `/api/creators` | 博主列表 |
| GET | `/api/creators/[id]` | 博主详情 |

### 用户 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/wx-login` | 微信登录 |
| GET | `/api/user/me` | 当前用户 |
| GET | `/api/user/contributions` | 我的贡献 |
| POST | `/api/contributions` | 提交贡献 |

### 管理员 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/contributions` | 待审核列表 |
| GET/PUT | `/api/admin/contributions/[id]` | 审核贡献 |
| POST | `/api/admin/brands` | 创建品牌 |
| PUT/DELETE | `/api/admin/brands/[id]` | 编辑/删除品牌 |

## 部署

已部署到 zjk_aliyun_ecs，域名 `sup.iaddu.cn`（HTTPS）。
- 服务器：zjk_aliyun_ecs (39.100.160.80)
- 路径：/www/wwwroot/sup-wiki
- 端口：3107（PM2 进程 id=8）
- 部署命令：`git archive HEAD | ssh zjk_aliyun_ecs "tar -xf - -C /www/wwwroot/sup-wiki"`，然后在服务器 build + restart

## Lessons Learned

### mysql2 JSON 列自动解析问题
- **What went wrong:** mysql2 将 MySQL JSON 列返回为已解析的 JS 对象（数组/对象），而不是字符串。对已解析的数组调用 `JSON.parse(array)` 时，JS 会先调用 `array.toString()` 得到 `"race,distance"` 格式的字符串，导致 `JSON.parse` 失败。
- **Root cause:** mysql2 3.x 对 MySQL JSON 类型列可能返回已解析的 JS 对象，与对 TEXT 列存储 JSON 的行为不同。
- **Correct approach:** 始终用防御性写法解析 JSON 列：`Array.isArray(v) ? v : (v ? JSON.parse(String(v)) : [])`

### 服务器部署时必须删除旧 .next 目录
- **What went wrong:** 用 `git archive | tar` 传输文件后重启 PM2，但服务器仍使用旧的 `.next` 构建目录，导致代码修复未生效。
- **Root cause:** `git archive` 只传输源文件，不删除服务器上的旧构建产物。PM2 restart 使用已有的 `.next` 目录，不会自动重新构建。
- **Correct approach:** 传输后先 `rm -rf .next`，再 `npm run build`，最后 `pm2 restart`。

### MySQL LIMIT ? OFFSET ? 参数化问题
- **What went wrong:** 使用 `pool.execute(sql, [...params, pageSize, offset])` 传递 LIMIT/OFFSET 参数，MySQL 8.0 某些版本报 `ER_WRONG_ARGUMENTS` 错误。
- **Root cause:** mysql2 prepared statements 对 LIMIT/OFFSET 参数类型有严格要求，混合 string/number 数组时可能出现类型不匹配。
- **Correct approach:** 对 LIMIT/OFFSET 使用模板字符串直接嵌入：`` LIMIT ${pageSize} OFFSET ${offset} ``，其余过滤参数继续用 `?` 占位符。
