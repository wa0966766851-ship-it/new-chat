// Shared settings defaults; no component mounting or storage writes.
export const DEFAULT_P1_LAYOUT = { pos: { x: 59.6, y: -5.2 }, size: { width: 636.8, height: 400 }, opacity: 0.95, scale: 1 };

export const DEFAULT_P2_LAYOUT = { pos: { x: 734.8, y: -3.6 }, size: { width: 598.4, height: 406.4 }, opacity: 0.95, scale: 1.1 };

export const DEFAULT_TACTICAL_LAYOUT = { pos: { x: 161.2, y: 414 }, size: { width: 1199.2, height: 320 }, opacity: 0.95, scale: 1.1 };

export const ACCENT_CONFIGS: Record<AccentColor, { name: string; border: string; glow: string; text: string; dotBg: string; colorHex: string; cardBorder: string; cardTintBg: string }> = {
  emerald: { name: "科技翡翠", border: "border-emerald-500/50", glow: "rgba(16, 185, 129, 0.15)", text: "text-emerald-400", dotBg: "bg-emerald-500", colorHex: "#10b981", cardBorder: "rgba(16, 185, 129, 0.35)", cardTintBg: "6, 24, 18" },
  crimson: { name: "熱血烈焰", border: "border-red-500/50", glow: "rgba(239, 68, 68, 0.18)", text: "text-red-400", dotBg: "bg-red-500", colorHex: "#ef4444", cardBorder: "rgba(239, 68, 68, 0.35)", cardTintBg: "26, 10, 12" },
  blue: { name: "深海天藍", border: "border-blue-500/50", glow: "rgba(59, 130, 246, 0.18)", text: "text-blue-400", dotBg: "bg-blue-500", colorHex: "#3b82f6", cardBorder: "rgba(59, 130, 246, 0.35)", cardTintBg: "10, 18, 30" },
  purple: { name: "虛空紫晶", border: "border-purple-500/50", glow: "rgba(168, 85, 247, 0.18)", text: "text-purple-400", dotBg: "bg-purple-500", colorHex: "#a855f7", cardBorder: "rgba(168, 85, 247, 0.35)", cardTintBg: "20, 10, 28" },
  amber: { name: "神聖琥珀", border: "border-amber-500/50", glow: "rgba(245, 158, 11, 0.18)", text: "text-amber-400", dotBg: "bg-amber-500", colorHex: "#f59e0b", cardBorder: "rgba(245, 158, 11, 0.35)", cardTintBg: "26, 18, 6" },
};


export const OPACITY_CONFIGS: Record<CardOpacity, { name: string; alpha: string; blur: string }> = {
  high: { name: "💎 晶瑩", alpha: "0.45", blur: "6px" },
  medium: { name: "🌙 經典", alpha: "0.80", blur: "12px" },
  solid: { name: "🛡️ 沉浸", alpha: "0.96", blur: "20px" },
};


export const DEFAULT_BACKGROUNDS = [
  "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg",
  "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg",
  "/bg_explore_3.html",
  "/bg_explore_4.html",
  "/bg_explore_5.html",
  "/bg_explore_6.html",
  "/bg_explore_7.html",
  "/bg_explore_8.html",
  "/bg_explore_9.html",
  "/bg_explore_21.html",
  "/bg_explore_22.html",
  "/bg_explore_23.html",
  "/bg_explore_24.html",
  "/slide_01.html",
  "/slide_02.html",
  "/slide_03.html",
  "/slide_04.html",
  "/slide_05.html",
  "/slide_06.html",
  "/slide_07.html",
  "/slide_08.html",
  "/slide_09.html",
  "/slide_10.html",
  "/slide_11.html",
  "/slide_12.html"
];


export const DEFAULT_PLAYLIST = [
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=1", title: "歌曲 1" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=2", title: "歌曲 2" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=3", title: "歌曲 3" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=4", title: "歌曲 4" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=5", title: "歌曲 5" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=6", title: "歌曲 6" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=7", title: "歌曲 7" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=8", title: "歌曲 8" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=9", title: "歌曲 9" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=10", title: "歌曲 10" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=11", title: "歌曲 11" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=12", title: "歌曲 12" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=13", title: "歌曲 13" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=14", title: "歌曲 14" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=15", title: "歌曲 15" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=16", title: "歌曲 16" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=17", title: "歌曲 17" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=18", title: "歌曲 18" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=19", title: "歌曲 19" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=20", title: "歌曲 20" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=21", title: "歌曲 21" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=22", title: "歌曲 22" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=23", title: "歌曲 23" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=24", title: "歌曲 24" },
  { url: "https://www.youtube.com/watch?v=wJ8onQryXRY&list=RDwJ8onQryXRY&index=25", title: "歌曲 25" }
];


export const RECOMMENDED_BACKGROUNDS = [
  { name: "首頁星際殿堂", url: "https://scientieic-american-media.s3.ap-northeast-1.amazonaws.com/posts/2026/02/29e4d8b0-928c-413d-ae25-04dd3752e49d.jpg" },
  { name: "精靈實戰決鬥場", url: "https://img.bizhiciyuan.com/item/69bab6ceb96fa53fd04c681d/6fd594e8ad7aa05d95b12a22cf32a634.jpg" },
  { name: "星際背景 · 003 蔚藍母星系 🌌", url: "/bg_explore_3.html" },
  { name: "星際背景 · 004 火紅星塵裂縫 🔥", url: "/bg_explore_4.html" },
  { name: "星際背景 · 005 浩瀚雙星螺旋 🌀", url: "/bg_explore_5.html" },
  { name: "星際背景 · 006 虛空高能信號 ⚡", url: "/bg_explore_6.html" },
  { name: "星際背景 · 007 暗物質吸積盤 🕳️", url: "/bg_explore_7.html" },
  { name: "星際背景 · 008 藍超巨星新星 💫", url: "/bg_explore_8.html" },
  { name: "星際背景 · 009 氣態巨行星帶 🪐", url: "/bg_explore_9.html" },
  { name: "星際背景 · 021 能量風暴通道 🌪️", url: "/bg_explore_21.html" },
  { name: "星際背景 · 022 恆星日冕外殼 ☀️", url: "/bg_explore_22.html" },
  { name: "星際背景 · 023 超對稱重力透鏡 ✨", url: "/bg_explore_23.html" },
  { name: "星際背景 · 024 多元超維通道 🪐", url: "/bg_explore_24.html" },
  { name: "動態幻燈片 · Slide 01 🌌", url: "/slide_01.html" },
  { name: "動態幻燈片 · Slide 02 🌟", url: "/slide_02.html" },
  { name: "動態幻燈片 · Slide 03 🚀", url: "/slide_03.html" },
  { name: "動態幻燈片 · Slide 04 🪐", url: "/slide_04.html" },
  { name: "動態幻燈片 · Slide 05 ⚡", url: "/slide_05.html" },
  { name: "動態幻燈片 · Slide 06 💫", url: "/slide_06.html" },
  { name: "動態幻燈片 · Slide 07 🔥", url: "/slide_07.html" },
  { name: "動態幻燈片 · Slide 08 🌀", url: "/slide_08.html" },
  { name: "動態幻燈片 · Slide 09 ✨", url: "/slide_09.html" },
  { name: "動態幻燈片 · Slide 10 🌠", url: "/slide_10.html" },
  { name: "動態幻燈片 · Slide 11 🔮", url: "/slide_11.html" },
  { name: "動態幻燈片 · Slide 12 🌌", url: "/slide_12.html" },
];


export const RECOMMENDED_BGMS = [
  { name: "星際首頁主題 BGM", id: "wJ8onQryXRY" },
  { name: "烈焰決鬥戰鬥 BGM", id: "RjYnSIzR9Bo" },
  { name: "命運輪替 BGM 系列", id: "BV1uh411Y73e" },
  { name: "電音熱血神曲 BGM", id: "dQw4w9WgXcQ" },
  { name: "神秘虛空寂靜 BGM", id: "1Y20pVY25mI" }
];


export type ThemeMode = "day" | "night" | "dark";
export type AccentColor = "emerald" | "crimson" | "blue" | "purple" | "amber";
export type CardOpacity = "high" | "medium" | "solid";
