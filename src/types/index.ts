// SUP Wiki TypeScript 类型定义

// 内容发布状态
export type ContentStatus = 'draft' | 'published';

// 品牌定位
export type BrandTier = 'entry' | 'intermediate' | 'pro';

// 产品类型
export type ProductType = 'inflatable' | 'hardboard' | 'race' | 'allround' | 'yoga' | 'touring';

// 适合人群
export type SuitableFor = 'beginner' | 'intermediate' | 'advanced';

// 运动项目
export type Discipline = 'race' | 'surf' | 'distance' | 'technical';

// 社交平台
export type Platform = 'douyin' | 'xiaohongshu' | 'bilibili' | 'youtube' | 'weibo' | 'instagram';

// 粉丝量级
export type FollowerTier = '1k-10k' | '10k-100k' | '100k-1m' | '1m+';

// 内容风格
export type ContentStyle = 'tutorial' | 'review' | 'vlog' | 'adventure';

// 赛事类型
export type EventType = 'race' | 'festival' | 'training' | 'exhibition';

// 赛事运行状态
export type EventRunStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

// 实体类型（用于批量导入等）
export type EntityType = 'brand' | 'product' | 'athlete' | 'creator' | 'event' | 'shop_item';

// 商城商品分类
export type ShopCategory = 'board' | 'paddle' | 'life_jacket' | 'accessory';

// 桨板分级（仅 board 类）
export type BoardType = 'race' | 'allround' | 'touring' | 'yoga' | 'inflatable';

// 库存状态
export type StockStatus = 'in_stock' | 'low_stock' | 'pre_order' | 'sold_out';

// 商城颜色变体（SKU）
export interface ShopVariant {
  color: string;       // SKU 标识，如 "绿色"、"紫色"
  images: string[];    // 该颜色的图片数组
  extra_note?: string; // 备注，如 "限量"、"预定"
}

// 商城视频
export interface ShopVideo {
  title: string;
  url: string;
  cover?: string;
}

// 商城商品
export interface ShopItem {
  shop_item_id: number;
  category: ShopCategory;
  board_type?: BoardType | null;
  brand_id?: number | null;
  brand_name?: string | null;
  product_id?: number | null;
  name: string;
  slug: string;
  subtitle?: string;
  description?: string;
  highlights?: string[];
  cost_price?: number;
  market_price?: number;
  discount_price?: number;
  stock_status: StockStatus;
  images?: string[];
  variants?: ShopVariant[];
  videos?: ShopVideo[];
  spec?: Record<string, string | number>;
  status: ContentStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 商城筛选参数
export interface ShopItemFilter {
  category?: ShopCategory;
  board_type?: BoardType;
  brand_id?: number;
  search?: string;
}

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
  status: ContentStatus;
  created_at: Date;
  updated_at: Date;
  product_count?: number;
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
  status: ContentStatus;
  created_at: Date;
  updated_at: Date;
  brand?: Brand;
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
  status: ContentStatus;
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
  status: ContentStatus;
  created_at: Date;
  updated_at: Date;
}

// 赛事安排条目
export interface ScheduleItem {
  date: string;
  time: string;
  event: string;
}

// 赛事
export interface Event {
  event_id: number;
  name: string;
  name_en?: string;
  slug: string;
  event_type: EventType;
  location?: string;
  province?: string;
  city?: string;
  venue?: string;
  start_date?: string;
  end_date?: string;
  registration_deadline?: string;
  organizer?: string;
  description?: string;
  requirements?: string;
  website?: string;
  registration_url?: string;
  contact_info?: string;
  images?: string[];
  schedule?: ScheduleItem[];
  disciplines?: string[];
  price_range?: string;
  max_participants?: number;
  status: ContentStatus;
  event_status: EventRunStatus;
  created_at: Date;
  updated_at: Date;
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

export interface EventFilter {
  event_type?: EventType;
  province?: string;
  event_status?: EventRunStatus;
  year?: number;
  month?: number;
  search?: string;
}

// JWT Payload（管理员）
export interface JwtPayload {
  role: 'admin';
  iat: number;
  exp: number;
}

// 向后兼容别名
export type AdminPayload = JwtPayload;
