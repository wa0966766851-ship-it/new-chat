// 戰鬥百科整合版面（2026-11-14）：與 Aegis 培養頁／對戰 HUD 同一套語言（斜切角、青色描邊、軌道線）。
// 字串模組：node 測試不能 import .css，以 useScopedStyle 注入。
export default String.raw`
.enc-shell { position: relative; isolation: isolate; display: flex; flex-direction: column; overflow: hidden; color: #d7edf6;
  border: 1px solid #6f9aae80; border-top: 2px solid #84e1f5; border-radius: 2px 22px 2px 2px; background: linear-gradient(155deg, #0f2c40f2, #050f19f5 60%); box-shadow: 0 24px 60px #000a; }
.enc-orbit { position: absolute; width: 640px; height: 640px; right: -260px; top: -300px; border: 1px solid #94c8de24; border-radius: 50%; pointer-events: none; z-index: -1;
  background: repeating-conic-gradient(from 20deg, transparent 0 29.7deg, #b1def52a 29.7deg 30deg); opacity: .5; }
.enc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #b4ddec36; flex: none; }
.enc-kicker { font-size: 9px; letter-spacing: .24em; color: #8fc3d6; }
.enc-title { font-size: 20px; font-weight: 800; letter-spacing: .04em; color: #f1fbff; }
.enc-icon { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #cee8f4; border: 1px solid #6f9aae65;
  border-radius: 2px 9px 2px 2px; background: linear-gradient(120deg, #1b3d50ed, #0a1a28ed); flex: none; }
.enc-icon:hover { border-color: #8de8ff; background: #28536b; }
.enc-body { flex: 1; min-height: 0; display: flex; }
.enc-rail { flex: none; width: 128px; display: flex; flex-direction: column; gap: 2px; padding: 10px 8px; overflow-y: auto; border-right: 1px solid #b4ddec26; background: #04101acc; }
.enc-rail h4 { margin: 10px 6px 4px; font-size: 9px; letter-spacing: .22em; color: #6f95a6; font-weight: 600; }
.enc-rail h4:first-child { margin-top: 0; }
.enc-rail button { text-align: left; padding: 7px 10px; font-size: 13px; color: #a7c9d8; border: 1px solid transparent; border-radius: 2px 10px 2px 2px; }
.enc-rail button:hover { color: #e2f6ff; background: #123044; }
.enc-rail button[data-active="true"] { color: #082330; background: linear-gradient(105deg, #9beef7, #5dbbd8); border-color: #b8f4ff; font-weight: 700; }
.enc-content { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 18px 24px; scrollbar-color: #6299af66 #08172555; scrollbar-width: thin; }
.enc-panel { border: 1px solid #639ab669; border-left: 2px solid #84e1f5; border-radius: 2px 14px 2px 2px; background: linear-gradient(150deg, #102b3fd9, #06121dd9); padding: 12px 14px; }
.enc-panel + .enc-panel { margin-top: 12px; }
.enc-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid #9bc8d62b; }
.enc-panel-head h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; letter-spacing: .06em; color: #d1e9f3; font-weight: 700; }
.enc-panel-head h3::before { content: ''; width: 6px; height: 6px; background: #84e1f5; transform: rotate(45deg); }
.enc-chip { font-size: 11px; padding: 2px 8px; color: #bfeefa; border: 1px solid #84e1f566; border-radius: 2px 8px 2px 2px; background: #0b2433; font-variant-numeric: tabular-nums; white-space: nowrap; }
.enc-search { display: flex; gap: 8px; align-items: center; }
.enc-search input { flex: 1; min-width: 0; padding: 8px 12px; font-size: 14px; color: #effaff; border: 1px solid #6a9ab966; border-radius: 2px 12px 2px 2px; background: #0b2433; }
.enc-search input:focus { outline: none; border-color: #8de8ff; }
.enc-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.enc-pill { padding: 3px 10px; font-size: 11px; color: #cee8f4; border: 1px solid #6f9aae65; border-radius: 2px 9px 2px 2px; background: linear-gradient(120deg, #1b3d50ed, #0a1a28ed); }
.enc-pill:hover { border-color: #8de8ff; }
.enc-pill[data-on="true"] { color: #082330; background: linear-gradient(105deg, #9beef7, #5dbbd8); border-color: #b8f4ff; }
.enc-pill:disabled { opacity: .4; cursor: default; }
.enc-pill b { margin-left: 4px; font-weight: 600; opacity: .75; font-variant-numeric: tabular-nums; }
.enc-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 380px); gap: 12px; margin-top: 12px; align-items: start; }
.enc-list { display: flex; flex-direction: column; gap: 4px; }
.enc-row { display: grid; grid-template-columns: 4.6rem minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 10px; text-align: left; font-size: 13px;
  border: 1px solid #709db130; border-radius: 2px 10px 2px 2px; background: #0c2232; color: #d4ebf4; }
.enc-row:hover { border-color: #8de8ff; }
.enc-row[data-active="true"] { border-color: #84e1f5; box-shadow: inset 3px 0 #84e1f5; background: #123247; }
.enc-row small { font-size: 10px; letter-spacing: .1em; color: #8fc3d6; }
.enc-row b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enc-row code, .enc-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; color: #9beef7; white-space: nowrap; }
.enc-detail { position: sticky; top: 0; }
.enc-detail dl { display: grid; grid-template-columns: 4rem 1fr; gap: 6px 10px; font-size: 12px; margin: 0; }
.enc-detail dt { color: #8fb3c4; }
.enc-detail dd { margin: 0; color: #eafcff; word-break: break-word; }
.enc-text { font-size: 13px; line-height: 1.75; color: #d4ebf4; white-space: pre-line; }
.enc-go { margin-top: 12px; width: 100%; padding: 7px 0; font-size: 13px; font-weight: 700; color: #082330; border-radius: 2px 10px 2px 2px; background: linear-gradient(105deg, #9beef7, #5dbbd8); }
.enc-more { margin-top: 8px; width: 100%; padding: 6px 0; font-size: 12px; color: #bfeefa; border: 1px dashed #6f9aae80; border-radius: 2px 10px 2px 2px; }
.enc-empty { text-align: center; color: #6f95a6; padding: 28px 0; font-size: 13px; }
.enc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.enc-card { padding: 10px 12px; border: 1px solid #709db146; border-radius: 2px 12px 2px 2px; background: linear-gradient(120deg, #173b50e8, #0b1b2bea); }
.enc-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.enc-card-head b { flex: 1; min-width: 0; font-size: 14px; color: #f1fbff; }
.enc-card ul { margin: 6px 0 0; padding-left: 16px; font-size: 12px; line-height: 1.7; color: #c3dfea; list-style: square; }
.enc-timeline { columns: 300px 3; column-gap: 28px; }
.enc-timeline .enc-step { break-inside: avoid; }
.enc-step { display: grid; grid-template-columns: 3.4rem minmax(0, 1fr); gap: 10px; align-items: center; padding: 5px 0; font-size: 13px; border-left: 1px solid #84e1f555; margin-left: 10px; padding-left: 12px; position: relative; }
.enc-step::before { content: ''; position: absolute; left: -4px; width: 7px; height: 7px; background: #84e1f5; transform: rotate(45deg); }
.enc-step[data-death="true"]::before { background: #f87171; }
.enc-step code { color: #9beef7; font-size: 12px; font-family: ui-monospace, Consolas, monospace; }
.enc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.enc-table th { text-align: left; color: #8fb3c4; font-weight: 600; padding: 4px 6px; border-bottom: 1px solid #9bc8d62b; }
.enc-table td { padding: 5px 6px; border-bottom: 1px solid #9bc8d614; color: #d4ebf4; vertical-align: top; }
.enc-table td:first-child { white-space: nowrap; }
@media (max-width: 860px) {
  .enc-split { grid-template-columns: 1fr; }
  .enc-detail { position: static; order: -1; }
}
@media (max-width: 720px) {
  .enc-shell { border-radius: 0; }
  .enc-body { flex-direction: column; }
  .enc-rail { width: auto; flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid #b4ddec26; padding: 6px; }
  .enc-rail h4 { display: none; }
  .enc-rail button { flex: none; white-space: nowrap; }
  .enc-content { padding: 12px; }
  .enc-row { grid-template-columns: 3.8rem minmax(0, 1fr); }
  .enc-row code { display: none; }
}
`;
