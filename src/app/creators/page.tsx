import Link from 'next/link';
import { Suspense } from 'react';
import Tooltip from '@/components/Tooltip';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import FilterBar from '@/components/FilterBar';
import RegionTabs from '@/components/RegionTabs';

interface CreatorRow extends RowDataPacket {
  creator_id: number;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  platform: string;
  follower_tier: string;
  content_style: string;
  region: string;
  profile_url: string | null;
}

const platformLabels: Record<string, { name: string; color: string; tip?: string }> = {
  douyin: { name: '抖音', color: 'bg-black text-white' },
  xiaohongshu: { name: '小红书', color: 'bg-red-500 text-white' },
  bilibili: { name: 'B站', color: 'bg-pink-400 text-white' },
  youtube: { name: 'YouTube', color: 'bg-red-600 text-white', tip: '谷歌旗下视频分享平台' },
  instagram: { name: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white', tip: 'Meta 旗下图文社交平台' },
  weibo: { name: '微博', color: 'bg-orange-500 text-white' },
  wechat_channels: { name: '视频号', color: 'bg-green-600 text-white', tip: '微信视频号' },
};

const styleLabels: Record<string, string> = {
  tutorial: '教学',
  review: '测评',
  vlog: 'Vlog',
  adventure: '探险',
};

const tierLabels: Record<string, string> = {
  '1k-10k': '1k-10k',
  '10k-100k': '1w-10w',
  '100k-1m': '10w-100w',
  '1m+': '100w+',
};

const tierOrder = `CASE follower_tier
  WHEN '1m+' THEN 1 WHEN '100k-1m' THEN 2
  WHEN '10k-100k' THEN 3 WHEN '1k-10k' THEN 4 ELSE 5 END`;

const domesticPlatformFilters = [
  { label: '抖音', value: 'douyin' },
  { label: '小红书', value: 'xiaohongshu' },
  { label: 'B站', value: 'bilibili' },
  { label: '微博', value: 'weibo' },
  { label: '视频号', value: 'wechat_channels' },
];

const internationalPlatformFilters = [
  { label: 'YouTube', value: 'youtube' },
  { label: 'Instagram', value: 'instagram' },
];

async function getCreators(region: string, platform?: string, content_style?: string) {
  try {
    const conditions: string[] = ["status = 'published'", 'region = ?'];
    const params: string[] = [region];

    if (platform) { conditions.push('platform = ?'); params.push(platform); }
    if (content_style) { conditions.push('content_style = ?'); params.push(content_style); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [creators] = await pool.execute<CreatorRow[]>(
      `SELECT * FROM sup_creators ${where} ORDER BY ${tierOrder} ASC, nickname ASC`,
      params
    );
    return creators;
  } catch (error) {
    console.error('获取博主列表失败:', error);
    return [];
  }
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; platform?: string; content_style?: string }>;
}) {
  const { region: rawRegion, platform, content_style } = await searchParams;
  const region = rawRegion === 'international' ? 'international' : 'domestic';
  const creators = await getCreators(region, platform, content_style);

  const platformOptions = region === 'domestic' ? domesticPlatformFilters : internationalPlatformFilters;

  const filters = [
    {
      key: 'platform',
      placeholder: '全部平台',
      options: platformOptions,
    },
    {
      key: 'content_style',
      placeholder: '内容风格',
      options: [
        { label: '教学', value: 'tutorial' },
        { label: '测评', value: 'review' },
        { label: 'Vlog', value: 'vlog' },
        { label: '探险', value: 'adventure' },
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brown-800 mb-2">博主</h1>
        <p className="text-warm-gray-500">关注桨板领域的内容创作者，获取教程和测评</p>
      </div>

      <Suspense>
        <RegionTabs region={region} />
        <FilterBar filters={filters} />
      </Suspense>

      {creators.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {creators.map((creator) => (
            <Link
              key={creator.creator_id}
              href={`/creators/${creator.creator_id}`}
              className="bg-cream-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-cream-200 group"
            >
              <div className="h-48 bg-[#F5EDF2] flex items-center justify-center">
                {creator.avatar ? (
                  <img
                    src={creator.avatar}
                    alt={creator.nickname}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-cream-50 flex items-center justify-center shadow-lg"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 36, color: '#C0B4A4' }}>
                    {creator.nickname.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-brown-800 group-hover:text-brown-500 transition-colors text-center">
                  {creator.nickname}
                </h3>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-xs px-2 py-1 bg-cream-200 text-warm-gray-500 rounded">
                    {creator.content_style === 'vlog'
                      ? <Tooltip tip="视频博客 / 视频日志" dotted={false}>Vlog</Tooltip>
                      : styleLabels[creator.content_style] || creator.content_style}
                  </span>
                </div>
                <div className="mt-2 text-center text-sm text-warm-gray-400">
                  粉丝 {tierLabels[creator.follower_tier] || creator.follower_tier}
                </div>
                {creator.bio && (
                  <p className="mt-3 text-sm text-warm-gray-500 text-center line-clamp-2">{creator.bio}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-warm-gray-500">暂无符合条件的博主</p>
        </div>
      )}
    </div>
  );
}
