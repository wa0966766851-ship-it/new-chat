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
  { id: 'visual', title: '外觀', description: '主題、主色與目前背景' },
  { id: 'audio', title: '音樂', description: '播放、靜音與音樂連結' },
  { id: 'battle', title: '戰鬥介面', description: '資訊面板配置與透明度' },
  { id: 'resources', title: '場景配置', description: '各頁使用的背景與音樂' },
  { id: 'library', title: '素材庫', description: '管理歌單與可選背景' },
  { id: 'advanced', title: '診斷', description: '效能量測與目前設定摘要' },
  { id: 'updates', title: '更新', description: '手動檢查網站部署及桌面版本；不自動重載或覆寫' },
] as const;

export function readControlSetting<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return valid(value) ? value : fallback; }
  catch { return fallback; }
}
