// 由同名 .css 內容轉成字串模組：tsx 測試環境不能 import .css，執行時以 <style> 注入（useScopedStyle）。
export default String.raw`/*
 * 命運之輪 B 頁（拾光行記為基礎）。限定在 .dwb 作用域。
 * 色票：紙底 #F2EDE4、深鈷 #16307A、鈷藍 #1F4FD8、淡鈷 #7C9BE8、暖橙 #E8622B（僅分級章 S、封印叉、輪盤焦點、套印；面積 < 3%）。
 * 無漸層、無發光；字型為系統中文襯線（不下載外部字型，離線可用）。
 */
.dwb { --paper:#F2EDE4; --ink:#16307A; --cobalt:#1F4FD8; --pale:#7C9BE8; --warm:#E8622B; --dim:#E4DDD0; --line:rgba(22,48,122,.3);
  position:relative; flex:none; isolation:isolate; min-height:100dvh; width:100%; background-color:var(--paper); color:var(--ink);
  font-family:"Noto Serif TC","Songti TC","PMingLiU","Microsoft JhengHei",serif; font-size:15px; line-height:1.6; overflow-x:clip; }
.dwb *, .dwb *::before, .dwb *::after { box-sizing:border-box; }
.dwb button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; }
.dwb button:disabled { cursor:not-allowed; opacity:.45; }
.dwb h1,.dwb h2,.dwb h3,.dwb p { margin:0; }
.dwb :focus-visible { outline:2px solid var(--ink); outline-offset:2px; box-shadow:0 0 0 4px var(--paper); }
.dwb-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

/* ---------- 景深背景 ---------- */
.dwb-bd { position:sticky; top:0; height:100dvh; margin-bottom:-100dvh; z-index:-1; pointer-events:none; }
.dwb-bd-svg { width:100%; height:100%; display:block; }
.dwb-layer { transition:none; }
.dwb--anim .dwb-layer--far { transform:translate(calc(var(--px,0) * -8px), calc(var(--py,0) * -8px)); }
.dwb--anim .dwb-layer--mid { transform:translate(calc(var(--px,0) * -18px), calc(var(--py,0) * -18px)); }
.dwb--anim .dwb-layer--near { transform:translate(calc(var(--px,0) * -26px), calc(var(--py,0) * -26px)); }
.dwb-bd--reveal .dwb-bd-svg, .dwb-bd--ban .dwb-bd-svg, .dwb-bd--pick .dwb-bd-svg { opacity:.3; }
.dwb-bd--anim .dwb-layer { animation:dwb-in .7s both; }
.dwb-bd--anim .dwb-layer--mid { animation-delay:.08s; } .dwb-bd--anim .dwb-layer--near { animation-delay:.16s; }
.dwb-bd--pulling.dwb-bd--anim .dwb-disc { transform-box:fill-box; transform-origin:center; animation:dwb-turn 18s linear infinite; }
.dwb-flow { animation:dwb-flow 3s linear infinite; }
@keyframes dwb-in { from { opacity:0; } to { opacity:1; } }
@keyframes dwb-turn { to { transform:rotate(360deg); } }
@keyframes dwb-flow { to { stroke-dashoffset:-60; } }

/* ---------- 頂列與工具 ---------- */
.dwb-bar { position:relative; z-index:5; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px 16px;
  padding:56px 16px 10px; }
.dwb-brand { display:flex; align-items:baseline; gap:10px; }
.dwb-brand b { font-size:17px; letter-spacing:.34em; font-weight:600; }
.dwb-brand i { font-style:normal; font-size:11px; letter-spacing:.3em; color:var(--cobalt); }
.dwb-tools { display:flex; flex-wrap:wrap; gap:6px; }
.dwb-tbtn { white-space:nowrap; display:inline-flex; align-items:center; gap:5px; min-height:40px; padding:6px 12px; border:1px solid var(--line) !important; border-radius:2px;
  font-size:13px; letter-spacing:.14em; background:transparent; transition:background .18s,color .18s,border-color .18s; }
.dwb-tbtn:hover:not(:disabled), .dwb-tbtn.on { background:var(--cobalt) !important; color:var(--paper) !important; border-color:var(--cobalt) !important; }
@media (min-width:900px) { .dwb-bar { padding:18px max(26px, var(--control-hub-safe,13rem)) 10px 26px; } }

/* ---------- 章節列（黏在可視區底部的零高度錨點；位置跟著內容區，避開殼層側欄與底部狀態列） ---------- */
.dwb-dock { position:sticky; bottom:0; height:0; z-index:6; }
.dwb-rail { position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:space-around; background:var(--paper); border-top:1px solid var(--line);
  padding:4px 4px calc(4px + env(safe-area-inset-bottom)); }
.dwb-dot { display:flex; flex-direction:column; align-items:center; gap:1px; min-width:56px; min-height:44px; padding:4px 6px; font-size:12px; letter-spacing:.1em; color:rgba(22,48,122,.6); }
.dwb-dot s { display:block; width:18px; height:1px; background:currentColor; text-decoration:none; transition:width .25s; }
.dwb-dot em { font-style:normal; font-size:11px; }
.dwb-dot.on { color:var(--cobalt); font-weight:700; } .dwb-dot.on s { width:34px; height:2px; }
.dwb-dot:hover:not(:disabled) { color:var(--cobalt); }
.dwb-dot:disabled { opacity:.4; }
@media (min-width:1024px) {
  .dwb-rail { left:26px; right:auto; bottom:20px; flex-direction:column; gap:6px; background:transparent; border:0; padding:0; }
  .dwb-dot { flex-direction:row; gap:9px; justify-content:flex-start; min-height:32px; padding:3px 4px; font-size:13px; letter-spacing:.22em; }
  .dwb-dot em { font-size:12px; }
}

/* ---------- 主區 ---------- */
.dwb-main { position:relative; z-index:2; padding:8px 16px 120px; max-width:1640px; margin:0 auto; }
@media (min-width:1024px) { .dwb-main { padding:8px 36px 90px 170px; } }
.dwb--anim .dwb-main { animation:dwb-in .5s both; }
.dwb-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px 20px; margin:6px 0 14px; padding-bottom:10px; border-bottom:1px solid var(--line); }
.dwb-head h2 { font-size:22px; font-weight:600; letter-spacing:.14em; display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 12px; }
.dwb-head h2 em { font-style:normal; font-size:14px; color:var(--cobalt); letter-spacing:.2em; }
.dwb-head h2 small { font-size:14px; letter-spacing:.06em; color:var(--cobalt); font-weight:400; }
.dwb-actions { display:flex; flex-wrap:wrap; gap:8px; }
.dwb-btn { min-height:44px; padding:8px 18px; border:1px solid var(--cobalt) !important; color:var(--cobalt); font-size:14px; letter-spacing:.14em; border-radius:2px; background:transparent; transition:background .18s,color .18s; }
.dwb-btn:hover:not(:disabled) { background:var(--cobalt); color:var(--paper); }
.dwb-btn--go { background:var(--cobalt); color:var(--paper); }
.dwb-btn--go:hover:not(:disabled) { background:var(--ink); border-color:var(--ink) !important; }
.dwb-pools { display:grid; grid-template-columns:1fr; gap:18px; }
@media (min-width:1100px) { .dwb-pools { grid-template-columns:1fr 1fr; gap:22px; } }
.dwb-panel { background:rgba(242,237,228,.9); border:1px solid var(--line); padding:12px; min-width:0; }
.dwb-panel-head { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:4px 12px; margin-bottom:10px; }
.dwb-panel-head h3 { font-size:15px; font-weight:600; letter-spacing:.06em; }
.dwb-counts { font-size:13px; color:var(--cobalt); letter-spacing:.08em; }
.dwb-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
@media (min-width:641px) { .dwb-grid { grid-template-columns:repeat(var(--cols,4),minmax(0,1fr)); gap:10px; } }

/* ---------- 圖版卡 ---------- */
.dwb-card { position:relative; aspect-ratio:3/4; container-type:inline-size; min-width:0; cursor:pointer; background:var(--paper); user-select:none; }
.dwb-card-art, .dwb-starter-ring { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.dwb-seal { position:absolute; left:5px; top:5px; width:max(24px,21cqw); height:max(24px,21cqw); }
.dwb-card-no { position:absolute; right:7px; top:5px; font-size:11px; letter-spacing:.1em; color:var(--pale); font-family:ui-monospace,Menlo,Consolas,monospace; }
.dwb-portrait { position:absolute; left:8%; right:8%; top:19%; bottom:30%; display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:none; }
.dwb-portrait-img { max-width:100%; max-height:100%; object-fit:contain; }
.dwb-card-meta { position:absolute; left:5%; right:5%; bottom:4%; text-align:center; pointer-events:none; }
.dwb-card-name { font-size:clamp(12px,9.4cqw,16px); font-weight:700; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.dwb-card-type { display:flex; align-items:center; justify-content:center; gap:3px; font-size:clamp(11px,7.4cqw,13px); color:rgba(22,48,122,.78); margin-top:1px; white-space:nowrap; overflow:hidden; }
.dwb-card-bp { font-size:10.5px; color:var(--cobalt); letter-spacing:.02em; font-family:ui-monospace,Menlo,Consolas,monospace; }
.dwb-card--back .dwb-back-q { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:clamp(28px,26cqw,48px); color:var(--cobalt); font-weight:600; }
.dwb-card--back .dwb-back-no { position:absolute; left:8px; bottom:6px; font-size:11px; color:var(--pale); font-family:ui-monospace,Menlo,Consolas,monospace; }
.dwb-card--back { background:var(--dim); }
.dwb-card--back:hover, .dwb-card.is-picked { background:#fff7e8; }
.dwb-tag { position:absolute; left:calc(max(24px,21cqw) + 9px); top:6px; max-width:calc(100% - max(24px,21cqw) - 40px); padding:1px 3px; font-size:clamp(10px,8.4cqw,11px); line-height:1.2; background:var(--ink); color:var(--paper); white-space:normal; overflow-wrap:anywhere; text-wrap:balance; overflow:hidden; }
.dwb-card-detail, .dwb-card-star { position:absolute; width:28px; height:28px; border:1px solid var(--line) !important; background:var(--paper) !important; font-size:12px; border-radius:2px; display:flex; align-items:center; justify-content:center; z-index:3; }
.dwb-card-detail { right:3px; bottom:30%; }
.dwb-card-star { left:3px; bottom:30%; }
.dwb-card-star.on, .dwb-card-star:hover { background:var(--cobalt) !important; color:var(--paper); border-color:var(--cobalt) !important; }
.dwb-card-detail:hover { background:var(--ink) !important; color:var(--paper); }
.dwb-order { position:absolute; left:50%; top:calc(max(24px,21cqw) + 9px); transform:translateX(-50%); min-width:20px; padding:0 6px; text-align:center; font-size:12px; font-weight:700; background:var(--cobalt); color:var(--paper); }
.dwb-order--starter { background:var(--ink); top:auto; bottom:calc(30% + 34px); transform:translateX(-50%); }
.dwb-card.is-dim { opacity:.55; } .dwb-card.is-dim:hover { opacity:.88; }
.dwb-card.is-banned { opacity:1; }
.dwb-ban { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(242,237,228,.62); pointer-events:none; }
.dwb-ban svg { width:78%; height:auto; } .dwb-ban span { position:absolute; bottom:6px; font-size:12px; font-weight:700; color:var(--warm); letter-spacing:.2em; background:var(--paper); padding:0 6px; }
.dwb--anim .dwb-card.is-anim { animation:dwb-stamp .42s cubic-bezier(.22,1,.36,1) both; }
.dwb--anim .dwb-card:not(.dwb-card--back):hover { transform:translateY(-2px); }
@keyframes dwb-stamp { from { opacity:0; transform:translateY(14px) scale(.96); } to { opacity:1; transform:none; } }

/* ---------- 序章 ---------- */
/* 圓盤半徑＝270×slice 縮放（max(寬/1600, 高/900)）；hero 至少要撐過圓盤底緣，下方統計框才不會壓到盤面。 */
.dwb-hero { min-height:max(calc(100dvh - 330px), calc(50dvh + max(calc((100vw - 256px) * .1654), 29.4dvh) - 56px)); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:12px; padding:8px 0 16px; }
.dwb-title { font-size:min(calc(var(--dwb-s,1) * 62px), 12.5vw); letter-spacing:.3em; text-indent:.3em; font-weight:600; line-height:1.1; color:var(--paper); }
.dwb-sub { font-size:12px; letter-spacing:.6em; text-indent:.6em; color:var(--paper); opacity:.9; }
.dwb-tag-line { font-size:13px; letter-spacing:.24em; color:var(--paper); opacity:.85; margin-bottom:6px; }
.dwb-start { min-height:50px; padding:10px 34px; background:var(--paper) !important; color:var(--ink); font-size:17px; letter-spacing:.3em; text-indent:.3em; border-radius:2px; transition:background .18s,color .18s,letter-spacing .3s; }
.dwb-start:hover { background:var(--ink) !important; color:var(--paper); letter-spacing:.38em; }
.dwb--bp .dwb-title { color:var(--ink); } .dwb--bp .dwb-sub { color:var(--cobalt); } .dwb--bp .dwb-tag-line { color:rgba(22,48,122,.7); }
.dwb--bp .dwb-start { background:var(--cobalt) !important; color:var(--paper); }
.dwb-error { color:var(--warm); font-weight:700; padding:6px 12px; border:1px solid var(--warm); background:var(--paper); }
.dwb-ranks-wrap { display:flex; justify-content:center; margin:4px 0 22px; }
.dwb-ranks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; width:min(900px,100%); }
@media (min-width:700px) { .dwb-ranks { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@media (min-width:1024px) { .dwb-hero { margin-left:-134px; } }
.dwb-rankcell { position:relative; display:flex; flex-direction:column; align-items:center; gap:2px; padding:12px 8px 14px; border:1px solid var(--line) !important; background:rgba(242,237,228,.92) !important; min-height:44px; text-align:center; }
.dwb-rankcell b { font-size:30px; line-height:1.1; font-weight:600; }
.dwb-rankcell span { font-size:13px; letter-spacing:.1em; color:rgba(22,48,122,.78); }
.dwb-rankcell i { position:absolute; left:0; bottom:0; height:3px; display:block; }
.dwb-rankcell:hover, .dwb-rankcell.on { border-color:var(--cobalt) !important; }
.dwb-rules { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:6px 0 26px; }
@media (min-width:900px) { .dwb-rules { grid-template-columns:repeat(4,minmax(0,1fr)); } }
.dwb-rule { display:grid; grid-template-columns:auto 1fr; gap:0 8px; align-items:baseline; padding:10px 12px; border-left:2px solid var(--cobalt); background:rgba(242,237,228,.9); }
.dwb-rule em { font-style:normal; color:var(--cobalt); font-size:13px; grid-row:span 2; } .dwb-rule b { font-size:15px; letter-spacing:.1em; } .dwb-rule span { font-size:13px; color:rgba(22,48,122,.78); }
.dwb-browser { background:rgba(242,237,228,.94); border:1px solid var(--line); padding:14px; margin-bottom:30px; scroll-margin-top:12px; }
.dwb-browser-bar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; }
.dwb-browser-bar h2 { font-size:19px; letter-spacing:.14em; font-weight:600; } .dwb-browser-bar small { font-size:13px; color:var(--cobalt); letter-spacing:.06em; font-weight:400; }
.dwb-browser-tools { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.dwb-input { min-height:40px; width:min(300px,100%); padding:6px 10px; border:1px solid var(--line); background:var(--paper); color:var(--ink); font:inherit; font-size:14px; border-radius:2px; }
.dwb-seg { display:inline-flex; border:1px solid var(--line); } .dwb-seg button { min-height:40px; padding:6px 14px; font-size:13px; letter-spacing:.1em; } .dwb-seg button.on { background:var(--cobalt); color:var(--paper); }
.dwb-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
.dwb-tabs button { min-height:36px; padding:4px 12px; border:1px solid var(--line) !important; font-size:13px; letter-spacing:.08em; } .dwb-tabs button.on { background:var(--ink) !important; color:var(--paper); border-color:var(--ink) !important; }
.dwb-rulebox { border:1px dashed var(--cobalt); padding:8px 12px; margin-bottom:10px; font-size:13px; line-height:1.75; }
.dwb-empty { padding:30px; text-align:center; color:rgba(22,48,122,.6); }
.dwb-tablewrap { max-height:520px; overflow:auto; border:1px solid var(--line); }
.dwb-tablewrap table { width:100%; border-collapse:collapse; font-size:13px; white-space:nowrap; }
.dwb-tablewrap th { position:sticky; top:0; background:var(--dim); text-align:left; padding:8px 8px; font-weight:600; letter-spacing:.08em; border-bottom:1px solid var(--line); }
.dwb-tablewrap td { padding:6px 8px; border-bottom:1px solid rgba(22,48,122,.12); }
.dwb-tablewrap tbody tr { cursor:pointer; } .dwb-tablewrap tbody tr:hover { background:rgba(31,79,216,.08); }
.dwb-tablewrap td.nm { display:flex; align-items:center; gap:8px; font-weight:600; } .dwb-tablewrap td.nm small { color:var(--cobalt); font-weight:400; margin-left:4px; }
.dwb-tablewrap .av, .dwb-mini-card .av { width:28px; height:28px; display:inline-flex; overflow:hidden; border:1px solid var(--line); flex:none; }
.dwb-av-img { width:100%; height:100%; object-fit:contain; }
.dwb-tablewrap .ty { display:inline-flex; align-items:center; gap:3px; }
.dwb-tablewrap td.soul { max-width:280px; overflow:hidden; text-overflow:ellipsis; }
.dwb-mini { min-height:30px; padding:2px 10px; border:1px solid var(--cobalt) !important; color:var(--cobalt); font-size:12px; }
.dwb-listgrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; max-height:560px; overflow:auto; }
@media (min-width:700px) { .dwb-listgrid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@media (min-width:1200px) { .dwb-listgrid { grid-template-columns:repeat(6,minmax(0,1fr)); } }
.dwb-mini-card { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:26px 6px 8px; border:1px solid var(--line) !important; background:var(--paper) !important; text-align:center; min-height:44px; }
.dwb-mini-card .av { width:48px; height:48px; } .dwb-mini-card b { font-size:13px; line-height:1.25; } .dwb-mini-card small { font-size:11.5px; color:rgba(22,48,122,.75); display:flex; align-items:center; gap:3px; flex-wrap:wrap; justify-content:center; }
.dwb-mini-seal { position:absolute; left:4px; top:4px; }
.dwb-mini-card:hover { border-color:var(--cobalt) !important; }

/* ---------- 輪盤儀式 ---------- */
.dwb-pull { min-height:calc(100dvh - 160px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; text-align:center; }
.dwb-pull h2 { font-size:24px; letter-spacing:.4em; text-indent:.4em; font-weight:600; }
.dwb-ritual { width:min(300px,70vw); height:auto; }
.dwb-ritual.is-anim .dwb-spin { transform-box:view-box; transform-origin:0 0; animation:dwb-turn 6s linear infinite; }
.dwb-ritual.is-anim .dwb-spin--b { animation-duration:8s; animation-direction:reverse; } .dwb-ritual.is-anim .dwb-spin--c { animation-duration:4s; }

/* ---------- 圖紙說明 ---------- */
.dwb-note { position:absolute; right:12px; left:12px; bottom:62px; max-width:380px; margin-left:auto; padding:10px 14px; background:var(--paper); border:1px solid var(--cobalt); font-size:13px; line-height:1.7; }
.dwb-note b { color:var(--cobalt); letter-spacing:.14em; display:block; margin-bottom:2px; }
@media (min-width:1024px) { .dwb-note { right:24px; left:auto; bottom:20px; } }

/* ---------- 詳情圖版 ---------- */
.dwb-sheet-wrap { position:fixed; inset:0; z-index:130; background:rgba(22,48,122,.38); }
.dwb-sheet { position:absolute; top:0; right:0; bottom:0; width:100%; max-height:100dvh; display:flex; flex-direction:column; background:var(--paper); color:var(--ink); border-left:1px solid var(--ink); }
@media (min-width:768px) { .dwb-sheet { width:min(500px,100%); } }
.dwb-sheet-top { flex:none; display:flex; justify-content:flex-start; gap:14px; align-items:center; padding:8px 14px; border-bottom:1px solid var(--line); background:var(--paper); }
.dwb-sheet-kicker { font-size:12px; letter-spacing:.3em; color:var(--cobalt); font-family:ui-monospace,Menlo,Consolas,monospace; }
@media (max-width:767px) { .dwb-sheet-top { padding-top:56px; } .dwb-sheet-body { padding-bottom:96px; } }
.dwb-sheet-x { min-height:44px; min-width:44px; padding:6px 12px; border:1px solid var(--ink) !important; font-size:13px; letter-spacing:.12em; }
.dwb-sheet-x:hover { background:var(--ink) !important; color:var(--paper); }
.dwb-sheet-body { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 18px 48px; -webkit-overflow-scrolling:touch; }
.dwb-sheet-head { display:grid; grid-template-columns:120px 1fr; gap:14px; align-items:center; margin-bottom:14px; }
.dwb-sheet-art { width:120px; height:150px; display:flex; align-items:center; justify-content:center; border:1px solid var(--line); overflow:hidden; background:var(--dim); }
.dwb-sheet-id h2 { font-size:24px; font-weight:700; line-height:1.25; margin-bottom:4px; letter-spacing:.04em; }
.dwb-sheet-row { display:flex; align-items:center; gap:8px; font-size:14px; margin-top:3px; flex-wrap:wrap; }
.dwb-muted { color:rgba(22,48,122,.7); }
.dwb-sec { margin-top:16px; padding-top:10px; border-top:1px solid var(--line); }
.dwb-sec h3 { font-size:16px; font-weight:700; letter-spacing:.14em; margin-bottom:6px; } .dwb-sec h3 small { font-size:13px; font-weight:400; color:var(--cobalt); letter-spacing:.04em; margin-left:6px; }
.dwb-sec--c { border:1px solid var(--ink); padding:10px 12px; background:var(--dim); } .dwb-sec--c p { font-size:14px; line-height:1.8; }
.dwb-sec--bp { border:1px dashed var(--cobalt); padding:8px 12px; font-size:13px; }
.dwb-sheet-rule { display:none; }
.dwb-stats { list-style:none; margin:0; padding:0; display:grid; gap:4px; }
.dwb-stats li { display:grid; grid-template-columns:48px 1fr 40px; align-items:center; gap:8px; font-size:14px; }
.dwb-stats svg { width:100%; height:8px; overflow:visible; } .dwb-stats b { text-align:right; font-family:ui-monospace,Menlo,Consolas,monospace; }
.dwb-trait { margin-top:8px; } .dwb-trait > b { font-size:14px; }
.dwb-desc .dwb-desc-body { font-size:14px; line-height:1.8; }
.dwb-desc .dwb-desc-body *, .dwb-desc-body * { color:var(--ink) !important; background-color:transparent !important; border-color:var(--line) !important; box-shadow:none !important; }
.dwb-desc .dwb-desc-body section { border:1px solid var(--line); border-radius:0; }
.dwb-skills { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.dwb-skills li { border:1px solid var(--line); padding:8px 10px; }
.dwb-skill-head { display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; font-size:14px; }
.dwb-skill-no { font-size:12px; color:var(--cobalt); font-family:ui-monospace,Menlo,Consolas,monospace; }
.dwb-skill-facts { font-size:12.5px; color:rgba(22,48,122,.8); display:inline-flex; align-items:center; gap:4px; flex-wrap:wrap; }
.dwb-skills p { margin-top:4px; font-size:13px; line-height:1.7; color:rgba(22,48,122,.85); }
.dwb-fifth { padding:0 6px; font-size:12px; background:var(--cobalt); color:var(--paper); border-radius:1px; }
@media (prefers-reduced-motion: reduce) { .dwb *, .dwb *::before, .dwb *::after { animation:none !important; transition:none !important; } }
@media (prefers-contrast: more) { .dwb { --line:rgba(22,48,122,.7); } .dwb-card-type, .dwb-rankcell span { color:var(--ink); } }
`;
