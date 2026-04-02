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

计划部署到 Vercel，域名 `sup.iaddu.cn`。

## 待办事项

- [ ] 执行数据库初始化脚本
- [ ] 配置环境变量
- [ ] 部署到 Vercel
- [ ] 配置域名
