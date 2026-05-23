'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface LearnBrandItem {
  brand_id: number;
  slug: string;
  name: string;
  name_en: string | null;
  logo: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  tier: string;
  product_count: number;
  product_types: string[];
}

const tierLabels: Record<string, string> = {
  entry: '入门体验',
  intermediate: '进阶定位',
  pro: '专业竞技',
};

const productTypeLabels: Record<string, string> = {
  inflatable: '充气板',
  hardboard: '硬板',
  race: '竞速板',
  allround: '全能板',
  yoga: '瑜伽板',
  touring: '长距离',
};

function BrandLogo({ brand }: { brand: LearnBrandItem }) {
  if (brand.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logo} alt={brand.name} className="max-h-14 max-w-24 object-contain" />
    );
  }
  return <span className="text-xl font-black text-[#9A6429]">{brand.name.slice(0, 2)}</span>;
}

function matchesProductType(brand: LearnBrandItem, type: string) {
  return !type || brand.product_types.includes(type);
}

export default function LearnBrandsClient({ brands }: { brands: LearnBrandItem[] }) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [tier, setTier] = useState('');
  const [productType, setProductType] = useState('');

  const countries = useMemo(() => (
    Array.from(new Set(brands.map(brand => brand.country).filter(Boolean) as string[]))
      .sort((a, b) => {
        if (a === '中国') return -1;
        if (b === '中国') return 1;
        return a.localeCompare(b, 'zh-CN');
      })
  ), [brands]);

  const visibleBrands = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return brands
      .filter((brand) => {
        const haystack = [brand.name, brand.name_en, brand.country, brand.description].filter(Boolean).join(' ').toLowerCase();
        if (keyword && !haystack.includes(keyword)) return false;
        if (country && brand.country !== country) return false;
        if (tier && brand.tier !== tier) return false;
        if (!matchesProductType(brand, productType)) return false;
        return true;
      })
      .sort((a, b) => b.product_count - a.product_count || a.name.localeCompare(b.name, 'zh-CN'));
  }, [brands, country, productType, query, tier]);

  return (
    <div className="learn-directory">
      <div className="learn-filter">
        <label>
          <span>搜索品牌</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="中文 / 英文名称" />
        </label>
        <label>
          <span>国家地区</span>
          <select value={country} onChange={event => setCountry(event.target.value)}>
            <option value="">全部国家</option>
            {countries.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>品牌定位</span>
          <select value={tier} onChange={event => setTier(event.target.value)}>
            <option value="">全部定位</option>
            {Object.entries(tierLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>产品线</span>
          <select value={productType} onChange={event => setProductType(event.target.value)}>
            <option value="">全部产品线</option>
            {Object.entries(productTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="learn-result-meta">当前筛选 {visibleBrands.length} 个品牌</div>

      <div className="learn-brand-grid">
        {visibleBrands.map((brand) => (
          <article key={brand.brand_id} className="learn-brand-card">
            <div className="learn-brand-card__top">
              <Link href={`/brands/${brand.slug}`} className="learn-brand-card__logo">
                <BrandLogo brand={brand} />
              </Link>
              <div>
                <h2>{brand.name}</h2>
                {brand.name_en && <p>{brand.name_en}</p>}
              </div>
            </div>
            <div className="learn-brand-card__tags">
              <span>{brand.country || '未知地区'}</span>
              <span>{tierLabels[brand.tier] || brand.tier}</span>
              <span>{brand.product_count} 款产品</span>
            </div>
            <p className="learn-brand-card__desc">
              {brand.description || `${brand.name} 是已收录的桨板品牌，适合结合产品线与官网资料继续了解。`}
            </p>
            <div className="learn-brand-card__products">
              {brand.product_types.length > 0 ? brand.product_types.map(type => (
                <span key={type}>{productTypeLabels[type] || type}</span>
              )) : <span>暂无产品线数据</span>}
            </div>
            <div className="learn-brand-card__actions">
              <Link href={`/brands/${brand.slug}`}>查看品牌</Link>
              {brand.website && <a href={brand.website} target="_blank" rel="noopener noreferrer">官网</a>}
            </div>
          </article>
        ))}
      </div>

      {visibleBrands.length === 0 && (
        <div className="learn-empty">没有匹配的品牌，换一个关键词或筛选条件试试。</div>
      )}
    </div>
  );
}
