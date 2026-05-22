'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface BrandLibraryItem {
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
  min_price: number | null;
  max_price: number | null;
}

const tierLabels: Record<string, string> = {
  entry: '入门体验',
  intermediate: '进阶定位',
  pro: '高性能',
};

const typeLabels: Record<string, { label: string; short: string; icon: ReactNode }> = {
  inflatable: { label: '充气桨板', short: 'iSUP', icon: <path d="M8 4c1.6 0 2.5 4 2.5 8S9.6 20 8 20 5.5 16 5.5 12 6.4 4 8 4Z" /> },
  hardboard: { label: '硬式桨板', short: 'SUP', icon: <path d="M12 4c1.4 0 2.2 4 2.2 8S13.4 20 12 20s-2.2-4-2.2-8S10.6 4 12 4Z" /> },
  race: { label: '竞速板', short: 'Racing', icon: <path d="M12 3 6 20l6-4 6 4Z" /> },
  allround: { label: '全能板', short: 'Allround', icon: <><circle cx="12" cy="12" r="6" /><path d="M12 6v12M6 12h12" /></> },
  yoga: { label: '瑜伽板', short: 'Yoga', icon: <><path d="M12 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" /><path d="M5 18c3-4 11-4 14 0" /><path d="m8 12 4 3 4-3" /></> },
  touring: { label: '长距离巡航', short: 'Touring', icon: <><path d="M4 16c5-8 11-8 16 0" /><path d="M7 16h10" /></> },
};

const tierOptions = [
  { value: '', label: '全部品类' },
  { value: 'entry', label: '入门体验' },
  { value: 'intermediate', label: '进阶定位' },
  { value: 'pro', label: '高性能' },
];

const priceOptions = [
  { value: '', label: '价格定位' },
  { value: 'entry', label: '入门价位' },
  { value: 'mid', label: '中端价位' },
  { value: 'premium', label: '高端价位' },
];

const sortOptions = [
  { value: 'default', label: '综合排序' },
  { value: 'products', label: '产品数优先' },
  { value: 'name', label: '品牌名称' },
  { value: 'price', label: '价格从低到高' },
];

function Icon({ name }: { name: 'search' | 'globe' | 'grid' | 'tag' | 'box' | 'flame' | 'arrow' | 'heart' | 'home' | 'shield' }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3 3 15 0 18" /><path d="M12 3c-3 3-3 15 0 18" /></>,
    grid: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></>,
    tag: <><path d="M20 12 12 20 4 12V4h8z" /><circle cx="9" cy="9" r="1.4" /></>,
    box: <><path d="M4 8 12 4l8 4-8 4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></>,
    flame: <path d="M12 21c4 0 7-3 7-7 0-3-2-5-4-7 .1 3-1.5 4.5-3.2 5.3C10 10.5 10.2 8 11 5c-4 2-6 5.2-6 9 0 4 3 7 7 7Z" />,
    arrow: <path d="M9 6 15 12 9 18" />,
    heart: <><path d="M20 8.5c0 5-8 9.5-8 9.5S4 13.5 4 8.5A4.3 4.3 0 0 1 12 6a4.3 4.3 0 0 1 8 2.5Z" /></>,
    home: <><path d="m4 10 8-6 8 6" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
    shield: <path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function ProductTypeIcon({ type }: { type: string }) {
  const item = typeLabels[type];
  if (!item) return <Icon name="box" />;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {item.icon}
    </svg>
  );
}

function BrandLogo({ brand, className = '' }: { brand: BrandLibraryItem; className?: string }) {
  if (brand.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logo} alt={brand.name} className={`object-contain ${className}`} />
    );
  }
  return (
    <span className={`flex items-center justify-center text-xl font-black text-[#A66B2E] ${className}`}>
      {brand.name.slice(0, 2)}
    </span>
  );
}

function selectText(brand: BrandLibraryItem) {
  return [brand.name, brand.name_en, brand.country, brand.description].filter(Boolean).join(' ').toLowerCase();
}

function priceBand(brand: BrandLibraryItem) {
  const price = brand.min_price;
  if (!price) return '';
  if (price < 2000) return 'entry';
  if (price < 6000) return 'mid';
  return 'premium';
}

function brandTags(brand: BrandLibraryItem) {
  const tags = [tierLabels[brand.tier] || brand.tier];
  if (brand.country === '中国') tags.push('国产品牌');
  else if (brand.country) tags.push('国际品牌');
  if (brand.product_count >= 2) tags.push('热门品牌');
  return tags;
}

function emptyDescription(brand: BrandLibraryItem) {
  const country = brand.country ? `${brand.country}桨板品牌` : '桨板品牌';
  return `${brand.name} 是已收录的${country}，当前资料仍在持续补充中。`;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#E9DCCB] bg-white/78 px-5 py-4 shadow-[0_12px_30px_rgba(98,69,36,0.08)] backdrop-blur">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7EFE4] text-[#B87832]">{icon}</span>
      <span>
        <span className="block text-xs font-semibold text-[#8F8170]">{label}</span>
        <span className="mt-1 block text-3xl font-bold leading-none text-[#6C4423]">{value}</span>
      </span>
    </div>
  );
}

function SelectField({
  icon,
  value,
  onChange,
  options,
  label,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8D7862]">{icon}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-lg border border-[#E4D7C8] bg-white/82 px-11 pr-10 text-sm font-medium text-[#5B4A3A] outline-none transition focus:border-[#B87832] focus:ring-2 focus:ring-[#C78C45]/15"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#A8947D]">⌄</span>
    </label>
  );
}

export default function BrandsLibraryClient({
  brands,
  initialTier = '',
  initialCountry = '',
}: {
  brands: BrandLibraryItem[];
  initialTier?: string;
  initialCountry?: string;
}) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState(initialCountry);
  const [tier, setTier] = useState(initialTier);
  const [price, setPrice] = useState('');
  const [sort, setSort] = useState('default');
  const [position, setPosition] = useState('entry');
  const [selectedSlug, setSelectedSlug] = useState(brands[0]?.slug || '');
  const hotRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);

  const countries = useMemo(() => (
    Array.from(new Set(brands.map((brand) => brand.country).filter(Boolean) as string[])).sort((a, b) => {
      if (a === '中国') return -1;
      if (b === '中国') return 1;
      return a.localeCompare(b, 'zh-CN');
    })
  ), [brands]);

  const countryOptions = useMemo(() => [
    { value: '', label: '全部国家' },
    ...countries.map((item) => ({ value: item, label: item })),
  ], [countries]);

  const stats = useMemo(() => {
    const domestic = brands.filter((brand) => brand.country === '中国').length;
    const international = brands.filter((brand) => brand.country && brand.country !== '中国').length;
    const hot = brands.filter((brand) => brand.product_count >= 2).length;
    return { total: brands.length, domestic, international, hot };
  }, [brands]);

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = brands.filter((brand) => {
      if (query && !selectText(brand).includes(query)) return false;
      if (country && brand.country !== country) return false;
      if (tier && brand.tier !== tier) return false;
      if (price && priceBand(brand) !== price) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === 'products') return b.product_count - a.product_count || a.name.localeCompare(b.name, 'zh-CN');
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sort === 'price') return (a.min_price || Number.MAX_SAFE_INTEGER) - (b.min_price || Number.MAX_SAFE_INTEGER);
      return b.product_count - a.product_count || a.name.localeCompare(b.name, 'zh-CN');
    });
  }, [brands, country, price, search, sort, tier]);

  const hotBrands = useMemo(() => (
    [...brands].sort((a, b) => b.product_count - a.product_count || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 10)
  ), [brands]);

  const selectedBrand = useMemo(() => (
    filteredBrands.find((brand) => brand.slug === selectedSlug) || filteredBrands[0] || brands[0]
  ), [brands, filteredBrands, selectedSlug]);

  useEffect(() => {
    if (selectedBrand && selectedBrand.slug !== selectedSlug) setSelectedSlug(selectedBrand.slug);
  }, [selectedBrand, selectedSlug]);

  const positionBrands = useMemo(() => {
    const list = brands.filter((brand) => {
      if (position === 'domestic') return brand.country === '中国';
      if (position === 'international') return brand.country && brand.country !== '中国';
      if (position === 'inflatable') return brand.product_types.includes('inflatable');
      if (position === 'hardboard') return brand.product_types.includes('hardboard');
      if (position === 'race') return brand.product_types.includes('race');
      if (position === 'touring') return brand.product_types.includes('touring');
      return brand.tier === position;
    });
    return [...list].sort((a, b) => b.product_count - a.product_count || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 10);
  }, [brands, position]);

  function scroll(ref: React.RefObject<HTMLDivElement | null>, direction: number) {
    ref.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  }

  return (
    <main className="min-h-screen bg-[#FCF8F1] text-[#2F271F]">
      <section className="relative overflow-hidden border-b border-[#EFE2D1] bg-[#F9EFE2]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_6%_24%,rgba(203,145,74,0.18),transparent_30%),linear-gradient(100deg,rgba(255,255,255,0.9),rgba(255,250,242,0.72)_52%,rgba(233,205,166,0.48))]" />
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_88%_28%,rgba(168,104,43,0.18),transparent_36%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.65fr] lg:items-center lg:px-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E8D7C2] bg-white/62 px-3 py-1 text-xs font-semibold text-[#8C6B46]">
              <Icon name="shield" /> SUP WIKI BRAND INDEX
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#2F271F] md:text-5xl">品牌库</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#746556]">收录国内外主流桨板品牌，了解品牌故事、产品线与定位。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Icon name="globe" />} label="收录品牌" value={stats.total} />
            <StatCard icon={<Icon name="home" />} label="国内品牌" value={stats.domestic} />
            <StatCard icon={<Icon name="globe" />} label="国际品牌" value={stats.international} />
            <StatCard icon={<Icon name="flame" />} label="热门品牌" value={stats.hot} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 rounded-lg border border-[#E7D8C5] bg-white/86 p-4 shadow-[0_18px_45px_rgba(94,68,38,0.08)] backdrop-blur md:grid-cols-2 xl:grid-cols-[1.8fr_1fr_1fr_1fr_1fr]">
          <label className="relative block">
            <span className="sr-only">搜索品牌名称</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8D7862]"><Icon name="search" /></span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索品牌名称（中文/英文）"
              className="h-12 w-full rounded-lg border border-[#E4D7C8] bg-white/82 px-11 text-sm font-medium text-[#3B3128] outline-none transition placeholder:text-[#A99B8E] focus:border-[#B87832] focus:ring-2 focus:ring-[#C78C45]/15"
            />
          </label>
          <SelectField icon={<Icon name="globe" />} label="国家" value={country} onChange={setCountry} options={countryOptions} />
          <SelectField icon={<Icon name="grid" />} label="品牌定位" value={tier} onChange={setTier} options={tierOptions} />
          <SelectField icon={<Icon name="tag" />} label="价格定位" value={price} onChange={setPrice} options={priceOptions} />
          <SelectField icon={<Icon name="box" />} label="排序" value={sort} onChange={setSort} options={sortOptions} />
        </div>

        <section className="mt-5 rounded-lg border border-[#E7D8C5] bg-white p-5 shadow-[0_18px_45px_rgba(94,68,38,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#2F271F]">热门品牌</h2>
              <span className="hidden text-xs text-[#9B8D7E] sm:inline">左右滚动查看更多品牌</span>
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label="向左滚动热门品牌" onClick={() => scroll(hotRef, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4D7C8] text-[#8C6B46] transition hover:bg-[#F8EFE4]">‹</button>
              <button type="button" aria-label="向右滚动热门品牌" onClick={() => scroll(hotRef, 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4D7C8] text-[#8C6B46] transition hover:bg-[#F8EFE4]">›</button>
            </div>
          </div>
          <div ref={hotRef} className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {hotBrands.map((brand) => (
              <button
                key={brand.brand_id}
                type="button"
                onClick={() => setSelectedSlug(brand.slug)}
                className={`flex h-16 min-w-[190px] items-center gap-3 rounded-lg border bg-white px-4 text-left transition hover:-translate-y-0.5 hover:border-[#C88E4C] hover:shadow-[0_10px_24px_rgba(119,82,42,0.12)] ${selectedBrand?.slug === brand.slug ? 'border-[#C88E4C] shadow-[0_10px_24px_rgba(119,82,42,0.12)]' : 'border-[#EEE3D6]'}`}
              >
                <span className="flex h-10 w-16 shrink-0 items-center justify-center">
                  <BrandLogo brand={brand} className="max-h-10 max-w-16" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#302820]">{brand.name}</span>
                  <span className="block truncate text-xs text-[#8E8174]">{brand.name_en || `${brand.product_count} 款产品`}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.55fr]">
          <div className="rounded-lg border border-[#E7D8C5] bg-white shadow-[0_18px_45px_rgba(94,68,38,0.06)]">
            <div className="flex items-center justify-between border-b border-[#EEE4D8] px-5 py-4">
              <h2 className="text-lg font-bold text-[#2F271F]">品牌目录</h2>
              <span className="text-sm text-[#9B8D7E]">共 {filteredBrands.length} 个品牌</span>
            </div>
            <div className="max-h-[420px] overflow-auto p-2">
              {filteredBrands.length > 0 ? filteredBrands.map((brand) => (
                <button
                  key={brand.brand_id}
                  type="button"
                  onClick={() => setSelectedSlug(brand.slug)}
                  className={`grid w-full grid-cols-[96px_1fr_auto] items-center gap-3 rounded-md border px-3 py-3 text-left transition ${selectedBrand?.slug === brand.slug ? 'border-[#D29B56] bg-[#FFF7EA]' : 'border-transparent hover:border-[#EEE1D1] hover:bg-[#FFFBF6]'}`}
                >
                  <span className="flex h-9 items-center justify-start">
                    <BrandLogo brand={brand} className="max-h-9 max-w-[86px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#3A2E23]">{brand.name}</span>
                    <span className="block truncate text-xs text-[#9B8D7E]">{brand.name_en || '-'}</span>
                  </span>
                  <span className="hidden items-center gap-3 text-xs text-[#8E8174] sm:flex">
                    <span>{brand.country || '-'}</span>
                    <span>{brand.product_count} 款产品</span>
                    <span className="rounded bg-[#F6EFE5] px-2 py-1 text-[#7D5E3E]">{brand.country === '中国' ? '国产品牌' : '国际品牌'}</span>
                  </span>
                </button>
              )) : (
                <div className="px-5 py-14 text-center text-sm text-[#9B8D7E]">暂无符合筛选条件的品牌</div>
              )}
            </div>
          </div>

          {selectedBrand && (
            <div className="rounded-lg border border-[#E7D8C5] bg-white shadow-[0_18px_45px_rgba(94,68,38,0.06)]">
              <div className="grid gap-6 p-6 md:grid-cols-[260px_1fr_190px]">
                <Link href={`/brands/${selectedBrand.slug}`} className="flex min-h-44 items-center justify-center rounded-lg bg-[#FBF6EF] p-6">
                  <BrandLogo brand={selectedBrand} className="max-h-32 max-w-full" />
                </Link>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/brands/${selectedBrand.slug}`} className="text-2xl font-bold text-[#2F271F] hover:text-[#7A4D25]">{selectedBrand.name}</Link>
                    {selectedBrand.name_en && <span className="text-lg text-[#5E5145]">/ {selectedBrand.name_en}</span>}
                  </div>
                  <p className="mt-1 text-sm text-[#7E7062]">{[selectedBrand.country, selectedBrand.tier ? tierLabels[selectedBrand.tier] : ''].filter(Boolean).join(' · ')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {brandTags(selectedBrand).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-[#E8D8C4] bg-[#FBF4EA] px-3 py-1 text-xs font-semibold text-[#986531]">
                        <Icon name={tag === '热门品牌' ? 'flame' : tag === '国际品牌' ? 'globe' : 'shield'} />{tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-5 line-clamp-3 text-sm leading-7 text-[#5E5145]">{selectedBrand.description || emptyDescription(selectedBrand)}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {selectedBrand.website && (
                    <a href={selectedBrand.website} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#9A662E] px-4 text-sm font-semibold text-white transition hover:bg-[#7B4E23]">
                      访问官网 <Icon name="arrow" />
                    </a>
                  )}
                  <Link href={`/brands/${selectedBrand.slug}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E0D2C1] bg-white px-4 text-sm font-semibold text-[#745333] transition hover:bg-[#FAF1E6]">
                    <Icon name="heart" /> 查看品牌
                  </Link>
                </div>
              </div>
              <div className="grid border-t border-[#EEE4D8] md:grid-cols-[1fr_250px]">
                <div className="p-6">
                  <h3 className="mb-5 text-sm font-bold text-[#2F271F]">核心产品线</h3>
                  {selectedBrand.product_types.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedBrand.product_types.map((type) => (
                        <div key={type} className="flex items-center gap-3 text-[#7A5A37]">
                          <ProductTypeIcon type={type} />
                          <span>
                            <span className="block text-sm font-semibold text-[#3A2E23]">{typeLabels[type]?.label || type}</span>
                            <span className="text-xs text-[#8E8174]">{typeLabels[type]?.short || 'SUP'}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#9B8D7E]">暂无产品线数据</p>
                  )}
                </div>
                <div className="border-t border-[#EEE4D8] p-6 md:border-l md:border-t-0">
                  <h3 className="mb-4 text-sm font-bold text-[#2F271F]">相关数据</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-[#8E8174]">产品数量</dt><dd className="font-semibold text-[#3A2E23]">{selectedBrand.product_count} 款</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[#8E8174]">国家/地区</dt><dd className="font-semibold text-[#3A2E23]">{selectedBrand.country || '-'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[#8E8174]">价格范围</dt><dd className="font-semibold text-[#3A2E23]">{selectedBrand.min_price ? `¥${selectedBrand.min_price.toLocaleString()}+` : '-'}</dd></div>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-lg border border-[#E7D8C5] bg-white p-5 shadow-[0_18px_45px_rgba(94,68,38,0.06)]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-4 text-lg font-bold text-[#2F271F]">按定位浏览</h2>
              {[
                ['entry', '入门体验'],
                ['race', '竞速'],
                ['touring', '长距离'],
                ['inflatable', '充气板'],
                ['hardboard', '硬板'],
                ['domestic', '国产品牌'],
                ['international', '国际品牌'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPosition(value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${position === value ? 'border-[#E0C29A] bg-[#F6EBDD] text-[#8B5B2C]' : 'border-[#EEE3D6] bg-white text-[#6E6256] hover:bg-[#FBF5EC]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label="向左滚动定位品牌" onClick={() => scroll(positionRef, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4D7C8] text-[#8C6B46] transition hover:bg-[#F8EFE4]">‹</button>
              <button type="button" aria-label="向右滚动定位品牌" onClick={() => scroll(positionRef, 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4D7C8] text-[#8C6B46] transition hover:bg-[#F8EFE4]">›</button>
            </div>
          </div>
          <div ref={positionRef} className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {positionBrands.length > 0 ? positionBrands.map((brand) => (
              <button
                key={brand.brand_id}
                type="button"
                onClick={() => setSelectedSlug(brand.slug)}
                className="flex h-20 min-w-[185px] items-center gap-3 rounded-lg border border-[#EEE3D6] bg-white px-4 text-left transition hover:-translate-y-0.5 hover:border-[#C88E4C] hover:shadow-[0_10px_24px_rgba(119,82,42,0.12)]"
              >
                <span className="flex h-12 w-20 shrink-0 items-center justify-center"><BrandLogo brand={brand} className="max-h-10 max-w-20" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#302820]">{brand.name}</span>
                  <span className="block truncate text-xs text-[#8E8174]">{brand.name_en || `${brand.product_count} 款产品`}</span>
                </span>
              </button>
            )) : (
              <div className="py-8 text-sm text-[#9B8D7E]">暂无该定位下的品牌</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
