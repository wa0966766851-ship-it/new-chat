// Stage sizing is shared by reveal, ban and pick so preserving all 12 slots never enlarges cards.
export default String.raw`
.dwb { container:destiny / inline-size; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) { min-height:var(--draft-viewport-height,100dvh); }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-bd { height:var(--draft-viewport-height,100dvh);margin-bottom:calc(-1 * var(--draft-viewport-height,100dvh)); }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-dock { position:absolute;left:0;right:0;bottom:0; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-main { max-width:none; padding:4px 12px 62px; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-chead { min-height:64px; margin:0 0 10px; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-chead h2 { font-size:26px; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-pools { gap:12px; align-items:start; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-plate { padding:28px 8px 22px; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-plate-head { gap:4px; margin-bottom:8px; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-plate-head h3 { font-size:13px; letter-spacing:.02em; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-plate-fig { display:none; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-grid { gap:6px; grid-template-columns:repeat(4,var(--draft-card-width));justify-content:center;align-items:start; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-main { --draft-card-width:max(60px,min(calc((100cqw - 104px)/8),calc((var(--draft-viewport-height,100dvh) - 292px)/4))); }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-card { width:100%;height:auto;aspect-ratio:3/4;max-width:none; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-pools { max-width:calc(8 * var(--draft-card-width) + 80px);width:100%;margin-inline:auto; }
.dwb-draft-workspace { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; align-items:start; }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-rail { left:0;right:0;bottom:0;flex-direction:row;gap:0;padding:3px;background:var(--paper);border-top:1px solid var(--line); }
.dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-dot { min-height:32px;min-width:0;gap:5px;font-size:12px; }
.dwb-loadout-rail .dwb-lo { grid-template-columns:minmax(0,1fr); gap:0; }
.dwb-loadout-rail .dwb-plate-head { grid-template-columns:minmax(0,1fr); }
.dwb-loadout-rail .dwb-plate-right { justify-self:start;font-size:11px; }
.dwb-loadout-rail .dwb-lo-row { position:relative;grid-template-columns:minmax(0,1fr); gap:4px; padding:5px 0; }
.dwb-loadout-rail .dwb-lo-key { flex-direction:row; align-items:baseline; gap:6px; }
.dwb-loadout-rail .dwb-lo-side h4 { font-size:12px; letter-spacing:0; }
.dwb .dwb-loadout-rail .dwb-lo-opts { gap:4px; }
.dwb .dwb-loadout-rail .dwb-lo-opt { width:100%; min-height:28px; padding:3px 5px; font-size:12px; letter-spacing:0; line-height:1.3; text-align:left; }
@container destiny (min-width:1000px) {
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-pools { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-main { --draft-rail-width:clamp(110px,10cqw,160px);--draft-card-width:max(60px,min(calc((100cqw - 2 * var(--draft-rail-width) - 128px)/8),calc((var(--draft-viewport-height,100dvh) - 292px)/4))); }

 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-portrait { left:5%;right:5%;top:19%;bottom:34%; }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-card-name { font-size:clamp(12px,calc(var(--draft-card-width) * .08),16px); }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-seal { width:24px;height:24px; }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-card-detail,
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-card-star { bottom:51%;width:26px;height:26px; }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-tag { left:29px;right:29px;top:28px;max-width:none;font-size:9px;white-space:nowrap;text-overflow:ellipsis; }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-order:not(.dwb-order--starter) { left:36px;top:6px;min-width:14px;padding:0 3px;font-size:10px; }
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-order--starter { top:5px;bottom:auto;font-size:9px;padding:0 3px;white-space:nowrap; }
 .dwb-draft-workspace { grid-template-columns:var(--draft-rail-width) minmax(0,1fr) var(--draft-rail-width);max-width:calc(8 * var(--draft-card-width) + 2 * var(--draft-rail-width) + 104px);width:100%;margin-inline:auto; }
 .dwb-loadout-rail--p1 { grid-column:1; }
 .dwb-draft-workspace > .dwb-pools { grid-column:2; }
 .dwb-loadout-rail--p2 { grid-column:3; }
}
@container destiny (max-width:999px) {
 .dwb-draft-workspace { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .dwb-draft-workspace > .dwb-pools { grid-row:1;grid-column:1/-1; }

}

@container destiny (min-width:650px) and (max-width:999px) {
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-pools { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@container destiny (max-width:649px) {
 .dwb:is([data-chapter="reveal"],[data-chapter="ban"],[data-chapter="pick"]) .dwb-main { --draft-card-width:calc((100cqw - 58px)/4); }
}
.dwb .dwb-lo-summary { display:flex;align-items:center;justify-content:space-between;gap:5px;width:100%;min-height:34px;padding:5px 7px;text-align:left;font-size:12px;line-height:1.3;background:var(--paper);border:1px solid var(--line); }
.dwb-lo-summary span { min-width:0;overflow:hidden;text-overflow:ellipsis; }
.dwb .dwb-lo-summary[aria-expanded="true"] { border-color:var(--cobalt); }
.dwb-lo-row .dwb-lo-opts { position:absolute;top:100%;left:0;right:0;z-index:8;padding:6px;background:var(--paper);border:1px solid var(--cobalt);box-shadow:0 8px 16px #16307a22; }
.dwb-lo-row .dwb-lo-opts .dwb-lo-opt { width:100%; }
`;


