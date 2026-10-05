export type MusicSource =
  | { type: 'youtube'; id: string; playlist?: string; index?: number }
  | { type: 'bilibili'; id: string; page: number }
  | { type: 'invalid'; message: string };

/** 場景設定、試聽與自訂歌曲共用；不把無效輸入偷偷改成預設歌曲。 */
export function parseMusicSource(input: string, defaultPage = 1): MusicSource {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return { type: 'youtube', id: text };
  if (/^BV[\w]{10}$/i.test(text)) return { type: 'bilibili', id: text, page: defaultPage };
  let url: URL;
  try { url = new URL(text); } catch { return { type: 'invalid', message: '請輸入有效的 YouTube 影片 ID／網址或 B站 BV 號／網址。' }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { type: 'invalid', message: '音樂連結必須使用 http 或 https。' };
  const host = url.hostname.toLowerCase();
  if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) {
    const id = url.pathname.match(/BV[\w]{10}/i)?.[0] || url.searchParams.get('bvid');
    if (id && /^BV[\w]{10}$/i.test(id)) return { type: 'bilibili', id, page: positiveIndex(url.searchParams.get('p') || url.searchParams.get('page'), defaultPage) };
  }
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:\/|$)/)?.[1];
    const playlist = url.searchParams.get('list');
    if (id && /^[\w-]{11}$/.test(id)) return {
      type: 'youtube', id,
      ...(playlist && /^[\w-]+$/.test(playlist) ? { playlist, index: positiveIndex(url.searchParams.get('index'), 1) } : {}),
    };
  }
  return { type: 'invalid', message: '無法識別音樂連結；目前支援 YouTube 影片及 B站 BV 影片，不支援短網址轉址。' };
}

function positiveIndex(value: string | null, fallback: number) {
  const index = Number(value);
  return Number.isSafeInteger(index) && index > 0 ? index : fallback;
}

export function musicWatchUrl(source: MusicSource): string | undefined {
  if (source.type === 'invalid') return undefined;
  if (source.type === 'bilibili') return `https://www.bilibili.com/video/${source.id}?p=${source.page}`;
  const params = new URLSearchParams({ v: source.id });
  if (source.playlist) { params.set('list', source.playlist); params.set('index', String(source.index || 1)); }
  return `https://www.youtube.com/watch?${params}`;
}

export function youtubeEmbedUrl(source: Extract<MusicSource, { type: 'youtube' }>, origin: string) {
  const params = new URLSearchParams({ enablejsapi: '1', autoplay: '0', playsinline: '1', origin, loop: '1' });
  // 單曲循環只帶該影片；只有使用者真的提供歌單時才加入 list。
  if (source.playlist) { params.set('list', source.playlist); params.set('index', String(source.index || 1)); }
  else params.set('playlist', source.id);
  return `https://www.youtube.com/embed/${source.id}?${params}`;
}

export function youtubeErrorMessage(code: number) {
  const detail: Record<number, string> = {
    2: '影片 ID 或播放參數無效', 5: '瀏覽器無法播放此影片',
    100: '影片已刪除、設為私人或不存在', 101: '影片擁有者禁止嵌入播放', 150: '影片擁有者禁止嵌入播放',
    153: 'YouTube 未收到來源識別；請檢查瀏覽器隱私／擴充套件的 Referer 限制',
  };
  return `YouTube 錯誤 ${code}：${detail[code] || '播放器無法播放'}。可換曲或在原網站開啟。`;
}
