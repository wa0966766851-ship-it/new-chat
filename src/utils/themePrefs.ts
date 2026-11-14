/**
 * 外觀偏好（全部頁面背景、明暗、主色、卡片透明度、指定音樂）的保存（2026-11-07）。
 * 過去只寫在網址參數，桌面版重開或從首頁捷徑進入就消失；現在同時存到 localStorage，
 * 讀取時網址參數優先（分享連結仍可覆寫），沒有才用已保存的值。
 */
const KEY = 'seer_theme_prefs';
const FIELDS = ['bg', 'theme', 'accent', 'cardOpacity', 'bgm'] as const;

function saved(): Record<string, string> {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
/** 合併後的參數：已保存值 ＋ 網址參數（網址優先）。 */
export function themeParams(): URLSearchParams {
  const out = new URLSearchParams();
  const s = saved();
  for (const f of FIELDS) if (typeof s[f] === 'string' && s[f]) out.set(f, s[f]);
  try { new URLSearchParams(window.location.search).forEach((v, k) => { if ((FIELDS as readonly string[]).includes(k)) out.set(k, v); }); } catch { /* 無 window */ }
  return out;
}
/** 寫入（null＝清除）；只處理外觀欄位。 */
export function saveThemeParams(params: Record<string, string | null>) {
  const s = saved();
  for (const [k, v] of Object.entries(params)) if ((FIELDS as readonly string[]).includes(k)) { if (v) s[k] = v; else delete s[k]; }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 儲存不可用時只保留網址參數 */ }
}
