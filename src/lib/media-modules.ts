export const MEDIA_MODULES = ['athlete', 'system', 'club', 'professional'] as const;

export type MediaModule = (typeof MEDIA_MODULES)[number];

export const MEDIA_MODULE_LABELS: Record<MediaModule, string> = {
  athlete: '运动员',
  system: '系统',
  club: '俱乐部',
  professional: '专业人员',
};

export const MEDIA_MODULE_DEFAULT_FOLDERS: Record<MediaModule, string> = {
  athlete: 'athletes',
  system: 'media',
  club: 'clubs',
  professional: 'professionals',
};

export function normalizeMediaModule(value: unknown): MediaModule | null {
  if (typeof value !== 'string') return null;
  return (MEDIA_MODULES as readonly string[]).includes(value) ? (value as MediaModule) : null;
}

export function inferMediaModule(folder?: string | null, sourceContext?: string | null): MediaModule {
  const text = `${folder || ''} ${sourceContext || ''}`.toLowerCase();
  if (text.includes('athlete')) return 'athlete';
  if (text.includes('club')) return 'club';
  if (
    text.includes('professional') ||
    text.includes('coach') ||
    text.includes('referee') ||
    text.includes('certificate') ||
    text.includes('license')
  ) {
    return 'professional';
  }
  return 'system';
}
