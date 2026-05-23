'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface LearnCreatorItem {
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

const platformLabels: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  youtube: 'YouTube',
  instagram: 'Instagram',
  weibo: '微博',
  wechat_channels: '视频号',
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

function CreatorAvatar({ creator }: { creator: LearnCreatorItem }) {
  if (creator.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={creator.avatar} alt={creator.nickname} className="h-full w-full object-cover" />
    );
  }
  return <span>{creator.nickname.slice(0, 1)}</span>;
}

export default function LearnCreatorsClient({ creators }: { creators: LearnCreatorItem[] }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [platform, setPlatform] = useState('');
  const [style, setStyle] = useState('');

  const platforms = useMemo(() => (
    Array.from(new Set(creators.map(item => item.platform).filter(Boolean)))
  ), [creators]);

  const visibleCreators = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return creators.filter((creator) => {
      const haystack = [creator.nickname, creator.bio, platformLabels[creator.platform], styleLabels[creator.content_style]].filter(Boolean).join(' ').toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (region && creator.region !== region) return false;
      if (platform && creator.platform !== platform) return false;
      if (style && creator.content_style !== style) return false;
      return true;
    });
  }, [creators, platform, query, region, style]);

  return (
    <div className="learn-directory">
      <div className="learn-filter">
        <label>
          <span>搜索博主</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="昵称 / 内容关键词" />
        </label>
        <label>
          <span>地区</span>
          <select value={region} onChange={event => setRegion(event.target.value)}>
            <option value="">全部地区</option>
            <option value="domestic">国内</option>
            <option value="international">国外</option>
          </select>
        </label>
        <label>
          <span>平台</span>
          <select value={platform} onChange={event => setPlatform(event.target.value)}>
            <option value="">全部平台</option>
            {platforms.map(item => <option key={item} value={item}>{platformLabels[item] || item}</option>)}
          </select>
        </label>
        <label>
          <span>内容方向</span>
          <select value={style} onChange={event => setStyle(event.target.value)}>
            <option value="">全部方向</option>
            {Object.entries(styleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="learn-result-meta">当前筛选 {visibleCreators.length} 位博主</div>

      <div className="learn-creator-grid">
        {visibleCreators.map((creator) => (
          <article key={creator.creator_id} className="learn-creator-card">
            <Link href={`/creators/${creator.creator_id}`} className="learn-creator-card__avatar">
              <CreatorAvatar creator={creator} />
            </Link>
            <div className="learn-creator-card__main">
              <h2>{creator.nickname}</h2>
              <div className="learn-creator-card__tags">
                <span>{platformLabels[creator.platform] || creator.platform}</span>
                <span>{styleLabels[creator.content_style] || creator.content_style}</span>
                <span>粉丝 {tierLabels[creator.follower_tier] || creator.follower_tier}</span>
              </div>
              <p>{creator.bio || '已收录的桨板内容创作者，适合结合平台内容继续观察其教程、测评或训练分享。'}</p>
              <div className="learn-creator-card__actions">
                <Link href={`/creators/${creator.creator_id}`}>查看资料</Link>
                {creator.profile_url && <a href={creator.profile_url} target="_blank" rel="noopener noreferrer">主页</a>}
              </div>
            </div>
          </article>
        ))}
      </div>

      {visibleCreators.length === 0 && (
        <div className="learn-empty">没有匹配的博主，换一个关键词或筛选条件试试。</div>
      )}
    </div>
  );
}
