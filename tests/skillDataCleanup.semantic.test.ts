import assert from 'node:assert/strict';
import {createServer} from 'vite';
/** 技能資料整理（2026-11-13）：技能無效時＝附加、屬性列不進描述、先制／必中補顯示、雙屬性存檔還原、專屬特性全文。 */
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
try{
 const m=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');await m.loadImportedElves?.();
 const {skillDescriptionText}=await server.ssrLoadModule('/src/utils/skillDescription.ts');
 const {isSkillStatLine,normalizeSkillText}=await server.ssrLoadModule('/src/data/skillTextNormalize.ts');
 const {correctSavedJiuqing}=await server.ssrLoadModule('/src/data/savedJiuqingCorrection.ts');
 const elves:any[]=m.DEFAULT_ELVES,by=(id:string)=>elves.find(e=>String(e.id)===id);
 const all=elves.flatMap(e=>[...e.skills,...(e.skillPool||[])].map((s:any)=>({e,s})));
 // 屬性列不在描述與積木標籤
 for(const {e,s} of all){
  assert.ok(!String(s.description||'').split('\n').some(isSkillStatLine),`${e.name}/${s.name} 描述含屬性列`);
  for(const k of s.kit||[])assert.ok(!isSkillStatLine(String(k.customText||'')),`${e.name}/${s.name} 積木標籤含屬性列`);
 }
 // 技能無效時（整句開頭）＝附加效果；固有句中段的子條款（淨世洗禮頌）不動
 for(const {e,s} of all)for(const k of s.kit||[]){
  const raw=String(k.customText||'');
  if(k.params?.clause?.trig==='self_invalid'&&/^\s*[■🎯]?\s*技能無效時/u.test(raw)&&s.name!=='淨世洗禮頌')assert.equal(k.role,'attached',`${e.name}/${s.name}：${raw.slice(0,30)}`);
 }
 // 載入期整理對內建資料是無作用（來源已修正）
 for(const {e,s} of all)assert.equal(normalizeSkillText(s),s,`${e.name}/${s.name} 來源尚未整理`);
 // 先制／必中由欄位補顯示
 const lone=by('5047').skills.find((s:any)=>s.name==='凋零');
 assert.match(skillDescriptionText(lone),/^■ 先制\+3/,'凋零補先制');
 const cass=by('5041').skills.find((s:any)=>s.name==='歸塵');assert.equal(cass.isSureHit,true,'卡修斯必中接上');
 // 天邪龍王
 const tx=by('5047');assert.match(tx.soulMark.description,/無視對手百分比技能傷害減少效果/);
 const origin=tx.skills.find((s:any)=>s.name==='朔源皆難');assert.match(JSON.stringify(origin.kit),/"trig":"round_end"/);assert.match(origin.description,/每回合結束時/);
 // 龍神第五：百分比技能減傷
 assert.match(JSON.stringify(by('5035')),/"what":"百分比減傷"/);
 // 赫爾卡：命中率0%已是欄位，不重複列固有
 const herka=by('5040').skills.find((s:any)=>s.accuracy===0);assert.ok(herka&&!/命中率0%/.test(herka.description));
 // 奈尼芬多專屬特性全文
 const naifen=by('5045').soulMark.description;for(const k of ['搖晃的鈴鐺草:','星形鈴鐺草','藥劑反噬:','星佑:'])assert.ok(naifen.includes(k),`奈尼芬多缺：${k}`);
 // 八戒戰鬥系
 assert.equal(by('5003').type,'戰鬥');
 // 九青：舊存檔被截成單屬性時還原
 const jq=by('5036'),saved=structuredClone(jq);saved.skills=saved.skills.map((s:any)=>s.name==='生塵眷盼'?{...s,type:'聖靈'}:s);
 assert.equal(correctSavedJiuqing(saved,elves).skills.find((s:any)=>s.name==='生塵眷盼').type,'聖靈.地面');
 const custom=structuredClone(jq);custom.skills=custom.skills.map((s:any)=>s.name==='生塵眷盼'?{...s,type:'火'}:s);
 assert.equal(correctSavedJiuqing(custom,elves).skills.find((s:any)=>s.name==='生塵眷盼').type,'火','自訂屬性保留');
 console.log('技能資料整理：屬性列、技能無效時附加、先制必中顯示、天邪／龍神／赫爾卡／奈尼芬多／八戒／九青 通過');
}finally{await server.close();}
process.exit(0);
