// 戰術風整頁外觀（字串模組；node 測試不能 import .css，以 useScopedStyle 注入）。
export default String.raw`/*
 * 戰術風整頁外觀（2026-11-07）：戰鬥百科、精靈編輯器。
 * 與對戰「原廠風・戰術」同一套語言：墨黑平塗、髮絲線、缺角＋四角 L 角標、單一強調色（青）、窄體數字、英文微字。
 * 只在 .tac-page 作用域內覆寫既有的 iOS／Tailwind 深色卡片樣式，不改元件邏輯。
 */
.tac-page {
  --t-acc: #5ee7ff;
  --t-acc-ink: #04141a;
  --t-acc-dim: rgba(94, 231, 255, .22);
  --t-ink: rgba(11, 14, 19, .9);
  --t-ink-2: rgba(19, 24, 31, .92);
  --t-line: rgba(233, 238, 244, .13);
  --t-line-strong: rgba(233, 238, 244, .36);
  --t-num: "Bahnschrift", "DIN Alternate", "Barlow Condensed", "Roboto Condensed", "Arial Narrow", sans-serif;
  --tick: var(--t-line-strong);
}

/* 面板：平塗＋缺角＋四角 L 角標（純背景，不增 DOM） */
.tac-page.ios-panel,
.tac-page .ios-panel,
.tac-page .ios-card {
  border-radius: 0 !important;
  border: 1px solid var(--t-line) !important;
  box-shadow: none !important;
  background-color: transparent !important;
  background-image:
    linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
    linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
    linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
    linear-gradient(var(--tick), var(--tick)), linear-gradient(var(--tick), var(--tick)),
    linear-gradient(var(--t-ink), var(--t-ink)) !important;
  background-size: 12px 1px, 1px 12px, 12px 1px, 1px 12px, 12px 1px, 1px 12px, 12px 1px, 1px 12px, 100% 100% !important;
  background-position: 0 0, 0 0, 100% 0, 100% 0, 0 100%, 0 100%, 100% 100%, 100% 100%, 0 0 !important;
  background-repeat: no-repeat !important;
  backdrop-filter: none !important;
}
.tac-page .ios-panel:not(.tac-flat),
.tac-page .ios-card { clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); }

/* 圓角收斂、深色卡片統一為墨黑髮絲線 */
.tac-page :is(.rounded, .rounded-md, .rounded-lg, .rounded-xl, .rounded-2xl, .rounded-3xl, [class*="rounded-["]) { border-radius: 2px !important; }
.tac-page :is([class*="bg-slate-9"], [class*="bg-slate-8"], [class*="bg-[#0F1117]"], [class*="bg-[#0f1117]"], [class*="bg-black/"]) { background-color: var(--t-ink-2) !important; }
.tac-page :is([class*="border-slate-"], [class*="border-white/"]) { border-color: var(--t-line) !important; }
.tac-page :is(.shadow, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl, [class*="shadow-["]) { box-shadow: none !important; }
.tac-page .font-mono, .tac-page :is(input[type="number"], output) { font-family: var(--t-num) !important; letter-spacing: .02em; }

/* 分段頁籤：底線式，選中為強調色 */
.tac-page .ios-segment { background: transparent !important; border: 0 !important; border-bottom: 1px solid var(--t-line) !important; border-radius: 0 !important; padding: 0 !important; gap: 2px; box-shadow: none !important; }
.tac-page .ios-segment > button { position: relative; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: #aab3bd; letter-spacing: .08em; padding: 8px 14px 10px !important; }
.tac-page .ios-segment > button:hover { color: #eef1f4; }
.tac-page .ios-segment > button[data-active="true"], .tac-page .ios-segment > button[aria-current="page"] { color: var(--t-acc) !important; }
.tac-page .ios-segment > button[data-active="true"]::after, .tac-page .ios-segment > button[aria-current="page"]::after {
  content: ""; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; background: var(--t-acc);
}

/* 輸入：方角、墨黑、聚焦強調色 */
.tac-page :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea, .ios-search) {
  border-radius: 0 !important; background-color: #0b0e13 !important; border: 1px solid var(--t-line) !important; box-shadow: none !important;
}
.tac-page :is(input, select, textarea, .ios-search):focus { border-color: var(--t-acc) !important; outline: none; }

/* 按鈕：ios-button 改為髮絲框；主要動作（強調底色）改為強調色實心 */
.tac-page .ios-button { border-radius: 0 !important; background: transparent !important; border: 1px solid var(--t-line-strong) !important; letter-spacing: .08em; box-shadow: none !important; padding: 6px 12px; min-height: 34px; font-family: inherit; }
.tac-page .ios-button:hover { border-color: var(--t-acc) !important; color: var(--t-acc); }
.tac-page button:is([class*="bg-emerald-6"], [class*="bg-blue-6"], [class*="bg-indigo-6"], [class*="bg-teal-6"], [class*="from-"]):not(:disabled) {
  background: var(--t-acc) !important; color: var(--t-acc-ink) !important; border-color: var(--t-acc) !important; box-shadow: none !important;
}

/* 頁首英文微字與標題 */
.tac-kicker { display: block; font-family: var(--t-num); font-size: 10px; letter-spacing: .32em; color: var(--t-acc); opacity: .85; text-transform: uppercase; line-height: 1.2; }
.tac-page .tac-title { letter-spacing: .08em; }
.tac-page .tac-rule { height: 1px; background: linear-gradient(90deg, var(--t-acc) 0 36px, var(--t-line) 36px 100%); border: 0; }
.tac-page .tac-badge { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--t-line-strong); color: var(--t-acc);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); background: rgba(94, 231, 255, .06); }

@media (prefers-reduced-motion: reduce) { .tac-page * { transition: none !important; } }
`;
