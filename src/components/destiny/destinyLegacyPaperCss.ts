// 由同名 .css 內容轉成字串模組：tsx 測試環境不能 import .css，執行時以 <style> 注入（useScopedStyle）。
export default String.raw`/*
 * 命運之輪舊頁「紙本」風格補完（D-04）。
 * 舊頁的面板、標頭、介紹頁、Ban／Pick、詳情視窗都是深色 slate；紙本態只換了底色，白字落在紙底讀不到。
 * 這裡以作用域覆寫把整頁重新映射到紙底／墨藍／鈷藍：無漸層、無光暈、無毛玻璃。
 * 只在 .destiny-legacy-paper 內生效，不影響數理與標準風格。
 */
.destiny-legacy-paper { --dlp-paper:#F2EDE4; --dlp-dim:#E4DDD0; --dlp-ink:#16307A; --dlp-cobalt:#1F4FD8; --dlp-pale:#7C9BE8; --dlp-warm:#E8622B; color: var(--dlp-ink); }
.destiny-legacy-paper * { text-shadow: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.destiny-legacy-paper [class*="bg-gradient"] { background-image: none !important; }
/* 面板與卡面：紙色 */
.destiny-legacy-paper [class*="bg-slate-9"], .destiny-legacy-paper [class*="bg-black"],
.destiny-legacy-paper [class*="bg-indigo-9"], .destiny-legacy-paper [class*="bg-purple-9"],
.destiny-legacy-paper [class*="bg-emerald-9"], .destiny-legacy-paper [class*="bg-amber-9"],
.destiny-legacy-paper [class*="bg-red-9"], .destiny-legacy-paper [class*="bg-blue-9"] { background-color: var(--dlp-paper) !important; }
.destiny-legacy-paper [class*="bg-slate-8"], .destiny-legacy-paper [class*="bg-slate-7"] { background-color: var(--dlp-dim) !important; }
.destiny-legacy-paper [class*="bg-white/"] { background-color: rgba(22,48,122,0.05) !important; }
/* 彈窗遮罩改淡墨，內容維持紙色 */
.destiny-legacy-paper .fixed[class*="bg-slate-950/"], .destiny-legacy-paper .fixed[class*="bg-black/"] { background-color: rgba(22,48,122,0.55) !important; }
/* 文字：全部墨藍；次要字用淡一點的墨藍 */
.destiny-legacy-paper [class*="text-white"], .destiny-legacy-paper [class*="text-slate-"],
.destiny-legacy-paper [class*="text-indigo-"], .destiny-legacy-paper [class*="text-purple-"],
.destiny-legacy-paper [class*="text-emerald-"], .destiny-legacy-paper [class*="text-teal-"],
.destiny-legacy-paper [class*="text-blue-"], .destiny-legacy-paper [class*="text-rose-"],
.destiny-legacy-paper [class*="text-red-"], .destiny-legacy-paper [class*="text-amber-"],
.destiny-legacy-paper [class*="text-\[#36B2BC\]"] { color: var(--dlp-ink) !important; }
.destiny-legacy-paper [class*="text-slate-4"], .destiny-legacy-paper [class*="text-slate-5"] { color: rgba(22,48,122,0.72) !important; }
/* 邊框：淡鈷 */
.destiny-legacy-paper [class*="border-"] { border-color: var(--dlp-pale) !important; }
.destiny-legacy-paper table, .destiny-legacy-paper thead, .destiny-legacy-paper tbody, .destiny-legacy-paper tr { background-color: transparent !important; }
.destiny-legacy-paper thead { background-color: var(--dlp-dim) !important; }
/* 分級徽章：靠色塊＋字，仍以文字標明級別 */
.destiny-legacy-paper [class*="from-amber-"][class*="bg-gradient"], .destiny-legacy-paper [class*="from-amber-"] { background-color: var(--dlp-warm) !important; color: var(--dlp-paper) !important; }
.destiny-legacy-paper [class*="from-purple-"], .destiny-legacy-paper [class*="from-indigo-"] { background-color: var(--dlp-cobalt) !important; color: var(--dlp-paper) !important; }
.destiny-legacy-paper [class*="from-emerald-"] { background-color: var(--dlp-ink) !important; color: var(--dlp-paper) !important; }
.destiny-legacy-paper [class*="bg-amber-500"], .destiny-legacy-paper [class*="bg-emerald-600"], .destiny-legacy-paper [class*="bg-purple-600"], .destiny-legacy-paper [class*="bg-indigo-600"] { background-color: var(--dlp-cobalt) !important; color: var(--dlp-paper) !important; }
.destiny-legacy-paper button:disabled { opacity: 0.5; }
/* 輸入框 */
.destiny-legacy-paper input { background-color: var(--dlp-paper) !important; color: var(--dlp-ink) !important; }
/* Ban 蓋章與無圖漢字 fallback（SVG text fill 為淺色） */
.destiny-legacy-paper svg text { fill: var(--dlp-cobalt) !important; }
/* 數字用的 mono 欄位保持可讀 */
.destiny-legacy-paper .font-mono { color: var(--dlp-ink); }
`;
