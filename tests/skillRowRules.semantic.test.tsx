// 技能欄與第五技能規則（docs/rules/技能欄與第五技能規則.md）。全精靈掃描 + 戰鬥技能列實際渲染 + 存檔／匯入。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const {createRoot}=await import('react-dom/client');
const server=await createServer({server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'silent'});
const root=createRoot(document.getElementById('root')!);
let checks=0;const ok=()=>{checks++;};
try {
 const {DEFAULT_ELVES}=await server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
 const {applySavedSkillCorrections}=await server.ssrLoadModule('/src/data/savedSkillCorrections.ts');
 const {prepareSavedBattleRoster}=await server.ssrLoadModule('/src/data/prepareSavedBattleRoster.ts');
 const {createBattleEngine}=await server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {BattleContext}=await server.ssrLoadModule('/src/components/BattleScreen.tsx');
 const {BattleScreenUI}=await server.ssrLoadModule('/src/components/BattleScreen.ui.tsx');
 const {fifthSkillSlot,orderSkillsForDisplay,orderBattleSkillsForDisplay,canonicalSkillRow,restoreBuiltinFifthFlags}=await server.ssrLoadModule('/src/battle/skillSlot.ts');
 const {parseFullElfData}=await server.ssrLoadModule('/src/utils/fullElfParser.ts');
 const elves:any[]=DEFAULT_ELVES;
 assert.ok(elves.length>=40);

 // ── 一、全精靈資料規則 ──
 const noFifth=new Set<string>();
 for(const e of elves){
  const tag=`${e.id} ${e.name}`;
  const main=e.skills;
  assert.equal(main.length,5,`${tag} 主列必須恰 5 招（多的放 skillPool）`);ok();
  const flagged=main.map((s:any,i:number)=>s.isFifthSkill?i:-1).filter((i:number)=>i>=0);
  assert.ok(flagged.length<=1,`${tag} 主列最多一個第五旗標`);ok();
  if(flagged.length){assert.deepEqual(flagged,[4],`${tag} 規範格式：第五技能在 skills[4]`);ok();}
  else noFifth.add(tag);
  assert.equal(new Set(main.map((s:any)=>s.name)).size,main.length,`${tag} 主列技能不可重名`);ok();
  const pool=e.skillPool||[];
  assert.equal(new Set(pool.map((s:any)=>s.name)).size,pool.length,`${tag} 技能池不可重名`);ok();
  for(const s of main){
   assert.ok(Number.isInteger(s.pp)&&s.pp>=0,`${tag} ${s.name} PP 需為非負整數`);ok();
   if(s.maxPp!==undefined)assert.equal(s.maxPp,s.pp,`${tag} ${s.name} maxPp 與 pp 一致`);
   if(s.currentPp!==undefined)assert.equal(s.currentPp,s.pp,`${tag} ${s.name} currentPp 與 pp 一致`);
   if(s.pp===0)assert.ok(s.ppUnlimited===true||s.maxPp===0||/PP/.test(s.description),`${tag} ${s.name} PP 為 0 必須是原廠 0/0、ppUnlimited 或描述明載 PP 規則`);
   ok();
  }
  // 技能池與主列同名者，第五身分必須一致。
  for(const s of pool){const m=main.find((x:any)=>x.name===s.name);if(m){assert.equal(!!s.isFifthSkill,!!m.isFifthSkill,`${tag} ${s.name} 池與主列第五旗標一致`);ok();}}
  // 顯示順序：有第五時第一格為第五，其餘維持原順序；沒有則原樣。
  const rows=orderSkillsForDisplay(main);
  assert.equal(rows.length,5);
  if(flagged.length){
   assert.equal(rows[0].skill,main[4],`${tag} 第一格必須是第五技能`);assert.ok(rows[0].isFifth);
   assert.deepEqual(rows.slice(1).map((r:any)=>r.slot),[0,1,2,3]);
   assert.equal(rows.filter((r:any)=>r.isFifth).length,1);
  }else{assert.deepEqual(rows.map((r:any)=>r.slot),[0,1,2,3,4]);assert.ok(rows.every((r:any)=>!r.isFifth));}
  ok();
 }
 // 沒有第五技能的精靈只能是已知清單（新增精靈漏標會在這裡被抓到）。
 assert.deepEqual([...noFifth],['5020 皮皮'],'只有皮皮沒有第五技能；其他精靈漏標 isFifthSkill 會在此失敗');ok();
 // 回歸：魔獅迪露（5009）第五技能是辟冥·鎮獄斷，戰鬥列第一格
 const delu=elves.find(e=>e.id==='5009');
 assert.equal(delu.skills[4].name,'辟冥·鎮獄斷');assert.equal(fifthSkillSlot(delu.skills),4);
 assert.deepEqual(orderSkillsForDisplay(delu.skills).map((r:any)=>r.skill.name),['辟冥·鎮獄斷','狻猊噬','負岳勢','目瘴淵禁','劫盡歸塵']);ok();

 // ── 二、判定函式：不靠格位／威力／名稱推定 ──
 const fake=(flags:boolean[],power=[0,0,0,0,0])=>flags.map((f,i)=>({name:'s'+i,power:power[i],isFifthSkill:f}));
 assert.equal(fifthSkillSlot(fake([false,false,false,false,false],[1,1,1,1,999])),-1);
 assert.equal(fifthSkillSlot(fake([false,false,false,false,false]).map(s=>({...s,name:'第五技能'}))),-1);
 assert.equal(fifthSkillSlot(fake([false,true,false,false,false])),1);
 assert.equal(fifthSkillSlot(fake([true,false,false,false,true])),4,'重複旗標：標準末格優先');
 assert.deepEqual(orderSkillsForDisplay(fake([false,false,true,false,false])).map((r:any)=>r.slot),[2,0,1,3,4]);
 assert.deepEqual(orderSkillsForDisplay(fake([false,false,false,false,false,true]),5).map((r:any)=>r.slot),[0,1,2,3,4],'第六格不算主列');
 assert.deepEqual(orderSkillsForDisplay(undefined),[]);ok();

 // ── 三、戰鬥技能列實際渲染（全精靈，P1／P2） ──
 const base=elves.find(e=>e.id==='5036');
 const team=prepareSavedBattleRoster([base],[base],false,'p1');
 const engine=createBattleEngine({initialP1Team:team,initialP2Team:structuredClone(team),p1StarterId:team[0].battleId,p2StarterId:team[0].battleId,battleMode:'PVP',preparedTeams:true});
 const state=engine.getState();
 const render=async(side:'p1'|'p2',elf:any)=>{
  const value={...state,[side]:{...structuredClone(state[side]),skills:structuredClone(elf.skills)},phase:`${side}_select`};
  await act(async()=>root.render(<BattleContext.Provider value={value}><BattleScreenUI battleMode="PVP" onSkillSelect={()=>{}} onSwitchElf={()=>{}} onUseItem={()=>{}} onReset={()=>{}} onBackToMenu={()=>{}} onAutoBattleToggle={()=>{}} activeSkillAnim={null} floatingDamagePopups={[]} consoleShake={null} damageDealt={{}}/></BattleContext.Provider>));
  return [...document.querySelectorAll(`[data-act-side="${side}"] > button`)] as HTMLButtonElement[];
 };
 const shown=(buttons:HTMLButtonElement[],skills:any[])=>buttons.map(b=>skills.filter(s=>b.textContent?.includes(s.name)).sort((a,c)=>c.name.length-a.name.length)[0]?.name);
 for(const e of elves){
  for(const side of ['p1','p2'] as const){
   const buttons=await render(side,e);
   assert.equal(buttons.length,5,`${e.id} ${side} 5 格`);
   const names=shown(buttons,e.skills);
   const fifth=fifthSkillSlot(e.skills);
   const expected=fifth>=0?[e.skills[fifth].name,...e.skills.filter((_:any,i:number)=>i!==fifth).map((s:any)=>s.name)]:e.skills.map((s:any)=>s.name);
   assert.deepEqual(names,expected,`${e.id} ${e.name} ${side} 戰鬥技能列順序`);
   const badges=buttons.map(b=>b.textContent?.includes('第五'));
   assert.deepEqual(badges,fifth>=0?[true,false,false,false,false]:[false,false,false,false,false],`${e.id} ${side} 第五標記只在第一格`);
   ok();
  }
 }
 // 戰鬥內共用排序函式與 battleSlot
 const visible=delu.skills.map((s:any,i:number)=>({...s,battleSlot:i}));
 assert.deepEqual(orderBattleSkillsForDisplay(delu.skills,visible).map((s:any)=>s.battleSlot),[4,0,1,2,3]);ok();

 // ── 四、存檔修正：缺旗標的內建精靈補回；自選／已有旗標不動；可重複套用 ──
 const savedDelu=structuredClone(delu);savedDelu.skills.forEach((s:any)=>{delete s.isFifthSkill;});savedDelu.skills[0].pp=7;
 const fixed=applySavedSkillCorrections(savedDelu,elves);
 assert.equal(fifthSkillSlot(fixed.skills),4,'存檔的魔獅迪露補回第五旗標');
 assert.equal(fixed.skills[0].pp,7,'玩家自訂 PP 保留');
 assert.deepEqual(applySavedSkillCorrections(fixed,elves).skills,fixed.skills,'重複套用不再改動');
 assert.equal(savedDelu.skills[4].isFifthSkill,undefined,'不就地修改輸入');ok();
 const oldLayout=structuredClone(delu);oldLayout.skills=[oldLayout.skills[4],...oldLayout.skills.slice(0,4)].map(s=>({...s,isFifthSkill:undefined}));
 const fixedOld=applySavedSkillCorrections(oldLayout,elves);
 assert.equal(fifthSkillSlot(fixedOld.skills),0,'舊存檔第五在第一格也能辨識');
 assert.equal(orderSkillsForDisplay(fixedOld.skills)[0].skill.name,'辟冥·鎮獄斷');ok();
 const custom=structuredClone(delu);custom.id='custom_delu';custom.skills.forEach((s:any)=>delete s.isFifthSkill);
 assert.equal(fifthSkillSlot(applySavedSkillCorrections(custom,elves).skills),-1,'自訂精靈不推定第五');ok();
 const ownChoice=structuredClone(delu);ownChoice.skills.forEach((s:any,i:number)=>{s.isFifthSkill=i===1;});
 assert.deepEqual(applySavedSkillCorrections(ownChoice,elves).skills.map((s:any)=>!!s.isFifthSkill),[false,true,false,false,false],'主列已有旗標者不被改');ok();
 assert.equal(restoreBuiltinFifthFlags(delu.skills,delu.skills),undefined,'已標記者無需補');ok();
 // 所有內建精靈拿掉旗標後的存檔，都會被補回與預設一致（皮皮例外：沒有第五）。
 for(const e of elves){
  const stripped=structuredClone(e);stripped.skills.forEach((s:any)=>delete s.isFifthSkill);
  const back=applySavedSkillCorrections(stripped,elves);
  assert.equal(fifthSkillSlot(back.skills),fifthSkillSlot(e.skills),`${e.id} ${e.name} 存檔缺旗標可補回`);ok();
 }

 // ── 五、匯入：只認明確標記；整理為 4 + 第五 ──
 const parsed=parseFullElfData(['A','B','C','D','E'].map((n,i)=>`[技能${n}] 普通 物理${i===1?' 第五技能':''}\n威力 ${i===1?100:50} PP 5\n效果：無`).join('\n'));
 assert.equal(parsed.skills.length,5);
 assert.deepEqual(parsed.skills.map((s:any)=>!!s.isFifthSkill),[false,false,false,false,true],'匯入後第五技能置於 skills[4]');
 assert.equal(parsed.skills[4].name,'技能B');
 const two=canonicalSkillRow(fake([true,false,true,false,false]));
 assert.equal(two.filter((s:any)=>s.isFifthSkill).length,1,'重複旗標只留第一個');
 assert.equal(canonicalSkillRow(fake([false,false,false,false,false])).every((s:any)=>!s.isFifthSkill),true);ok();

 // ── 六、顯示點共用同一函式（靜態檢查，避免再各寫一套判斷） ──
 // 「第五置首」視圖：戰鬥技能列、戰鬥資訊唯讀檔案、精靈介紹；倉庫／背包／編輯器維持資料順序（第五在 skills[4]），由 teamWorkspace.ui 測試鎖定。
 const used=['src/components/BattleScreen.ui.tsx','src/components/ElfSpotlight.tsx','src/components/ElfReadOnlyProfile.tsx'];
 for(const f of used){const text=fs.readFileSync(f,'utf8');assert.match(text,/orderSkillsForDisplay|orderBattleSkillsForDisplay/,`${f} 必須用共用顯示排序`);ok();}
 for(const f of fs.readdirSync('src/components').filter(n=>/\.tsx$/.test(n)).map(n=>'src/components/'+n).concat(['src/shell/art/TeamPanel.tsx'])){
  const text=fs.readFileSync(f,'utf8');
  assert.doesNotMatch(text,/(?:slot|Slot|idx|index|\bi) === 4 \|\| .*isFifthSkill|isFifthSkill \|\| (?:slot|idx|index|i) === 4/,`${f} 不可再用「格位 4 或旗標」推定第五`);
  assert.doesNotMatch(text,/power >= 160/,`${f} 不可用威力推定第五`);ok();
 }
 console.log(`技能欄與第五技能規則：${elves.length} 隻精靈資料／戰鬥列 P1·P2 實際渲染／存檔補旗標／匯入整理／共用函式靜態檢查，${checks} 項通過`);
}finally{await act(async()=>root.unmount());await server.close();dom.window.close();}
process.exit(0);
