/** 只整理本輪實測證據；沒有六項結果或視覺裁定時，絕不自動宣稱驗收完成。 */
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('.seer-cache/player-audit-20261027');
const roster=JSON.parse(fs.readFileSync(path.join(dir,'progress.json'),'utf8'));
const files=fs.readdirSync(dir).filter(n=>n.endsWith('-playback.json'));
const playbacks=files.map(n=>({...JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')),file:n}));
const notesPath=path.join(dir,'visual-notes.json');
const notes=fs.existsSync(notesPath)?JSON.parse(fs.readFileSync(notesPath,'utf8')):{};
const six=r=>r?.actions?.length===6&&r.actions.every(a=>a.finished);
// 使用者本輪明確排除；保留歷史證據，但不列入待驗收或通過數。
const excluded=new Set(['arena_16']);
const rows=roster.map(r=>{
 const run=playbacks.find(p=>p.id===r.id&&!p.skin);
 return {...r,excluded:excluded.has(r.id),playbackFile:run?.file,playbackVersion:run?.version||'baseline',sixPlaybackChecks:!excluded.has(r.id)&&six(run),visual:excluded.has(r.id)?'使用者指定本輪不測（純龍系龍之治癒）；不算驗收通過':notes[r.id]||'待最終視覺裁定'};
});
const text=`# 全精靈動畫驗收（持續更新）\n\n產生時間：${new Date().toISOString()}。測試在 ChatGPT 內部瀏覽器、同一來源 http://127.0.0.1:3015 進行。\n\n## 完成程度\n\n- 靜態／動態對照名單：${rows.length} 筆（含普通雷伊測試對照；不是 ${rows.length} 個不同動畫來源）。\n- 雙方播放器載入成功：${rows.filter(r=>r.loaded).length} 筆；未登記動畫：${rows.filter(r=>!r.expected).length} 筆。\n- 六項雙向出招已取得結束紀錄：${rows.filter(r=>r.sixPlaybackChecks).length} 筆。這只證明物攻、特攻、屬性技左右各一次能回到操作階段，不等於外觀全部合格。\n- 尚未完成：全名單最終視覺裁定、修正後全體重驗、多尺寸與桌面版本確認。普通底圖不列阻擋項；招式覆蓋背景另驗。\n\n## 確認的問題與處理\n\n1. 索比拉特原接 3435（伊麗莎白），已取得官方 343 包並核實畫面、雜湊、片段與雙向出招；正式綁定已修正。舊截圖保留為錯誤證據。\n2. 譜尼、六界神王、無極聖武等動態較靜態小。原縮放以整段待機範圍決定，包含擴散光暈／飄移；正在改用固定本體參照並逐隻重驗，尚不能稱尺寸全部修好。\n3. 驗收服務曾錯把本機圖片轉送至未啟動的服務，並監看輸出造成重載／退出；已先供應本機圖並調整監看。重啟服務後的瀏覽器錯誤頁不算精靈卡住。\n4. 驗收頁重選同一精靈／皮膚可能清空控制器但不重掛載；已加相同值保護，待完整回歸。\n5. 中央對戰紀錄遮住角色與戰場，需要獨立處理；部分早期截圖仍有紀錄框，不得據此判定被遮住的部位不存在。\n\n## 每隻紀錄\n\n| ID | 精靈 | 載入／回退 | 六項出招結束 | 出招版本 | 視覺判斷 |\n|---|---|---|---|---|---|\n${rows.map(r=>`| ${r.id} | ${r.name} | ${r.loaded?'雙方動態就緒':r.expected?'載入未完成':'靜態回退'} | ${r.sixPlaybackChecks?'已有紀錄':'未完成'} | ${r.playbackVersion} | ${r.visual} |`).join('\n')}\n\n## 重現與繼續\n\n1. 啟動：\`npm run animation:workbench\`，固定使用3015入口，不混用3013或3100。\n2. 使用頁面工具選同一精靈的P1與P2，先確認皮膚、素材來源及兩個播放器就緒；比較同一視窗的靜態／動態。\n3. 出招方選P1／P2，各跑物理、特殊、屬性；看命中前後、收招與下一回合，不只看按鈕能點。\n4. 巨型外觀檢查保留體量與合理裁切；不能為了塞進框裡而全部縮成小圖。\n5. 每次共用縮放或鏡射規則改動後，相關舊通過紀錄須重驗。\n6. 整理目前證據：\`node scripts/summarize_player_animation_audit.mjs\`。原始紀錄及截圖位於 \`.seer-cache/player-audit-20261027/\`；此報告不會補造不存在的量測或通過結論。\n`;
fs.writeFileSync('docs/audits/2026-10-27_全精靈動畫驗收.md',text);
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify({rows,playbacks:playbacks.map(p=>({id:p.id,skin:p.skin,file:p.file,version:p.version,sixPlaybackChecks:six(p)}))},null,2));
console.log(JSON.stringify({roster:rows.length,loaded:rows.filter(r=>r.loaded).length,sixPlaybackChecks:rows.filter(r=>r.sixPlaybackChecks).length,finished:false}));
