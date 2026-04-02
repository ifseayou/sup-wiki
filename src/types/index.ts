// SUP Wiki TypeScript 类型定义

// 品牌定位
export type BrandTier = 'entry' | 'intermediate' | 'pro';

// 产品类型
export type ProductType = 'inflatable' | 'hardboard' | 'race' | 'allround' | 'yoga' | 'touring';

// 适合人群
export type SuitableFor = 'beginner' | 'intermediate' | 'advanced';

// 运动项目
export type Discipline = 'race' | 'surf' | 'distance' | 'technical';

// 社交平台
export type Platform = 'douyin' | 'xiaohongshu' | 'bilibili' | 'youtube' | 'weibo';

// 粉丝量级
export type FollowerTier = '1k-10k' | '10k-100k' | '100k-1m' | '1m+';

// 内容风格
export type ContentStyle = 'tutorial' | 'review' | 'vlog' | 'adventure';

// 用户角色
export type UserRole = 'contributor' | 'admin';

// 贡献状态
export type ContributionStatus = 'pending' | 'approved' | 'rejected';

// 实体类型
export type EntityType = 'brand' | 'product' | 'athlete' | 'creator';

// 操作类型
export type ActionType = 'create' | 'update';

// 品牌
export interface Brand {
  brand_id: number;
  slug: string;
  name: string;
  name_en?: string;
  logo?: string;
  country?: string;
  website?: string;
  description?: string;
  tier: BrandTier;
  created_at: Date;
  updated_at: Date;
  product_count?: number; // 关联产品数量
}

// 购买链接
export interface BuyLink {
  platform: string;
  url: string;
}

// 产品
export interface Product {
  product_id: number;
  brand_id: number;
  model: string;
  type: ProductType;
  length_cm?: number;
  width_cm?: number;
  thickness_cm?: number;
  weight_kg?: number;
  material?: string;
  max_load_kg?: number;
  suitable_for: SuitableFor;
  price_min?: number;
  price_max?: number;
  buy_links?: BuyLink[];
  images?: string[];
  description?: string;
  created_at: Date;
  updated_at: Date;
  brand?: Brand; // 关联品牌
}

// 运动成就
export interface Achievement {
  year: number;
  event: string;
  result: string;
}

// 社交媒体链接
export interface SocialLinks {
  instagram?: string;
  youtube?: string;
  weibo?: string;
  douyin?: string;
  xiaohongshu?: string;
  twitter?: string;
  facebook?: string;
}

// 运动员
export interface Athlete {
  athlete_id: number;
  name: string;
  name_en?: string;
  nationality?: string;
  photo?: string;
  bio?: string;
  discipline: Discipline;
  achievements?: Achievement[];
  icf_ranking?: number;
  social_links?: SocialLinks;
  created_at: Date;
  updated_at: Date;
}

// 博主/KOL
export interface Creator {
  creator_id: number;
  nickname: string;
  avatar?: string;
  bio?: string;
  platform: Platform;
  follower_tier: FollowerTier;
  content_style: ContentStyle;
  profile_url?: string;
  created_at: Date;
  updated_at: Date;
}

// SUP Wiki 用户
export interface SupWikiUser {
  sup_user_id: number;
  user_id: number;
  role: UserRole;
  created_at: Date;
  nickname?: string; // 从 users 表关联
  avatar?: string;
}

// 贡献请求
export interface Contribution {
  contribution_id: number;
  sup_user_id: number;
  entity_type: EntityType;
  entity_id?: number;
  action: ActionType;
  payload: Record<string, unknown>;
  status: ContributionStatus;
  review_note?: string;
  reviewed_at?: Date;
  created_at: Date;
  user?: SupWikiUser; // 关联用户
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 筛选参数
export interface BrandFilter {
  tier?: BrandTier;
  country?: string;
  search?: string;
}

export interface ProductFilter {
  brand_id?: number;
  type?: ProductType;
  suitable_for?: SuitableFor;
  price_min?: number;
  price_max?: number;
  search?: string;
}

export interface AthleteFilter {
  discipline?: Discipline;
  nationality?: string;
  search?: string;
}

export interface CreatorFilter {
  platform?: Platform;
  follower_tier?: FollowerTier;
  content_style?: ContentStyle;
  search?: string;
}

// JWT Payload
export interface JwtPayload {
  user_id: number;
  sup_user_id: number;
  role: UserRole;
  iat: number;
  exp: number;
}
