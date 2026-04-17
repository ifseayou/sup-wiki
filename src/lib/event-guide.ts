export type GuideTimelineEvent = {
  event_id: number;
  name: string;
  slug: string;
  province: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  organizer: string | null;
  description: string | null;
  disciplines: string[];
};

export type GuideMeta = {
  stars: string;
  lane: 'top' | 'middle' | 'bottom';
  desktopLeft: string;
  mobileAccent: string;
  note: string;
  popupDirection: 'up' | 'down';
};

export const GUIDE_EVENT_META: Record<string, GuideMeta> = {
  'china-sup-super-league-sanmenxia-2025': {
    stars: '5星',
    lane: 'top',
    desktopLeft: '10%',
    mobileAccent: '#7A6145',
    note: '超级联赛首个高权重节点',
    popupDirection: 'down',
  },
  'sup-asia-cup-qingtian-2025': {
    stars: '5星',
    lane: 'top',
    desktopLeft: '83%',
    mobileAccent: '#C49A57',
    note: '亚洲级核心国际节点',
    popupDirection: 'down',
  },
  'china-sup-elite-series-shizuishan-2025': {
    stars: '4.5星',
    lane: 'middle',
    desktopLeft: '14%',
    mobileAccent: '#6F7B5A',
    note: '国家级精英积分战',
    popupDirection: 'up',
  },
  'national-sup-championship-haikou-2025': {
    stars: '4.5星',
    lane: 'middle',
    desktopLeft: '48%',
    mobileAccent: '#5E766F',
    note: '冠军赛年度分站',
    popupDirection: 'down',
  },
  'china-sup-super-league-shaoyang-2025': {
    stars: '5星',
    lane: 'middle',
    desktopLeft: '82%',
    mobileAccent: '#876746',
    note: '联赛末段高热度站点',
    popupDirection: 'up',
  },
  'national-sup-championship-finals-changshu-2025': {
    stars: '4.5星',
    lane: 'bottom',
    desktopLeft: '12%',
    mobileAccent: '#B9894D',
    note: '全年冠军赛总决赛',
    popupDirection: 'up',
  },
  'china-city-sup-open-finals-keqiao-2025': {
    stars: '4星',
    lane: 'bottom',
    desktopLeft: '49%',
    mobileAccent: '#7C7267',
    note: '百城总决赛收束全国线',
    popupDirection: 'up',
  },
  'china-sup-open-pingdingshan-2025': {
    stars: '4星',
    lane: 'bottom',
    desktopLeft: '82%',
    mobileAccent: '#A86E4B',
    note: '国家级公开赛窗口',
    popupDirection: 'up',
  },
};

export const GUIDE_EVENT_ORDER = Object.keys(GUIDE_EVENT_META);
