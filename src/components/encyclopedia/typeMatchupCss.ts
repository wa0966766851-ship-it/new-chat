export default `
.tm-panel { --tm-bg:#14232c; --tm-line:#34505d; --tm-text:#e6eef0; color:var(--tm-text); background:#0c1820; border:1px solid var(--tm-line); border-radius:14px; padding:clamp(10px,2vw,24px); display:grid; gap:14px; min-width:0; font: 14px/1.5 system-ui,sans-serif }
.tm-search,.tm-fields,.tm-tools,.tm-legend,.tm-result,.tm-type { display:flex; align-items:center; gap:9px }
.tm-search,.tm-results { display:flex; flex-wrap:wrap; gap:12px }
.tm-search { align-items:end }
.tm-fields { flex:1; align-items:start; min-width:min(100%,260px) }
.tm-fields label { flex:1; min-width:0; display:grid; gap:4px; color:#b8cbd1 }
.tm-fields input { width:100%; padding:8px; min-height:40px; border:1px solid var(--tm-line); border-radius:6px; background:var(--tm-bg); color:var(--tm-text) }
.tm-fields small { color:#ffad9f }
.tm-tools { flex-wrap:wrap }
.tm-tools button { display:flex; align-items:center; gap:6px; min-height:40px; padding:6px 10px; border:1px solid var(--tm-line); border-radius:6px; background:var(--tm-bg) }
.tm-tools button[type=submit]:enabled { background:#bdf0df; color:#12392c }
.tm-tools button:disabled { opacity:.45 }
.tm-result { flex-wrap:wrap; flex:1 1 250px; padding:9px 12px; border:1px solid var(--tm-line); border-radius:8px; background:var(--tm-bg) }
.tm-result strong { font-size:1.35rem; margin-inline-start:auto; padding-inline:7px; border-radius:5px }
.tm-legend { flex-wrap:wrap; color:#bacdd2; font-size:12px }
.tm-legend span[data-relation] { padding:2px 7px; border-radius:4px }
.tm-scroll { overflow:auto; max-height:min(51vh,510px); border:1px solid var(--tm-line); border-radius:8px; scroll-padding:44px 0 0 105px }
.tm-scroll table { border-collapse:separate; border-spacing:0; font-variant-numeric:tabular-nums; width:max-content }
.tm-scroll th,.tm-scroll td { border-right:1px solid #253944; border-bottom:1px solid #253944; text-align:center; padding:0 }
.tm-scroll th { background:#20343e; position:sticky; padding:5px 8px; white-space:nowrap }
.tm-scroll thead th { top:0; z-index:2; height:40px }
.tm-scroll th:first-child { left:0; z-index:1; min-width:100px }
.tm-scroll thead th:first-child { z-index:3 }
.tm-scroll td button { position:relative; width:100%; min-width:43px; min-height:34px; padding-inline:4px }
.tm-scroll td sup { position:absolute; font-size:8px }
.tm-panel [data-relation="克制"] { background:#194339; color:#b9f4db }
.tm-panel [data-relation="微弱"] { background:#483326; color:#ffcdab }
.tm-panel [data-relation="無效"] { background:#47283b; color:#ffd0e3 }
.tm-panel [data-relation="普通"] { background:#14232c; color:#bacbd0 }
.tm-scroll th[data-axis] { background:#345762; color:#f3ffff }
.tm-scroll td[data-axis] button { box-shadow:inset 0 0 0 1px #5f9299 }
.tm-scroll td button:hover,.tm-scroll td button[aria-pressed=true] { box-shadow:inset 0 0 0 2px #d0fbec; font-weight:bold }
.tm-panel :is(button,input,.tm-scroll):focus-visible { outline:2px solid #d0fbec; outline-offset:-2px }
`;
