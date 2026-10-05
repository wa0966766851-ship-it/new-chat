export type PlaylistItem = { url: string; title: string };

/** 相容舊字串、正確物件及曾被誤包成 {url:{url,title}} 的存檔。 */
export function normalizePlaylist(value: unknown, fallback: PlaylistItem[]): PlaylistItem[] {
  if (!Array.isArray(value)) return fallback.map(item => ({ ...item }));
  return value.flatMap((raw, index) => {
    const item = typeof raw === 'string' ? { url: raw } : raw;
    const nested = item && typeof item.url === 'object' ? item.url : item;
    if (!nested || typeof nested.url !== 'string' || !nested.url.trim()) return [];
    const title = typeof nested.title === 'string' && !['未知標題', '無法取得標題'].includes(nested.title)
      ? nested.title : `歌曲 ${index + 1}`;
    return [{ url: nested.url, title }];
  });
}

export const CONTROL_SECTIONS = [
  { id: 'background', title: '背景', description: '點縮圖直接套用；可指定套用到單一頁面或全部頁面' },
  { id: 'audio', title: '音樂', description: '播放控制、歌單與各頁 BGM' },
  { id: 'visual', title: '外觀', description: '明暗、主色與卡片透明度' },
  { id: 'battle', title: '戰鬥', description: '戰鬥動畫開關' },
  { id: 'system', title: '系統', description: '效能量測、設定備份與更新' },
] as const;

export type ControlSectionId = typeof CONTROL_SECTIONS[number]['id'];
/** 舊分頁 id（外部 open-settings 事件或舊存檔）對應到新分頁。 */
const LEGACY_SECTION: Record<string, ControlSectionId> = { resources: 'background', library: 'background', advanced: 'system', updates: 'system' };
export function resolveControlSection(id: unknown): ControlSectionId | null {
  if (typeof id !== 'string') return null;
  if (CONTROL_SECTIONS.some(section => section.id === id)) return id as ControlSectionId;
  return LEGACY_SECTION[id] ?? null;
}

/** HTML 動態背景用預先截好的縮圖，避免同時開數十個 iframe。 */
export function backgroundThumb(url: string): string {
  if (!url.endsWith('.html')) return url;
  const name = url.split('/').pop()!.replace(/\.html$/, '');
  return `/bg-thumbs/${name}.jpg`;
}

export function readControlSetting<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return valid(value) ? value : fallback; }
  catch { return fallback; }
}
