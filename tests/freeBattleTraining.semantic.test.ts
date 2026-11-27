import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
 const {normalizeElfStats}=await h.server.ssrLoadModule('/src/utils/elfStats.ts');
 const {readFreeBattleSetup}=await h.server.ssrLoadModule('/src/battle/freeBattleSetup.ts');
 const {resolveBattlefield}=await h.server.ssrLoadModule('/src/battle/battlefields.ts');
 const {captureConfiguration,prepareConfiguration}=await h.server.ssrLoadModule('/src/playerConfig/model.ts');
 const storage=new Map([['seer_free_battle_field','destiny'],['seer_p1_flame','flame_green'],['seer_p2_flame','flame_purple']]);
 assert.deepEqual(readFreeBattleSetup({getItem:(k:string)=>storage.get(k)||null}),{fieldId:'destiny',flames:{p1:'flame_green',p2:'flame_purple'}});
 assert.equal(resolveBattlefield(undefined,'normal_6v6','destiny').name,'命運之輪');
 assert.equal(resolveBattlefield('interstellar','normal_6v6','destiny').name,'星蝕迴廊');
 const unit=(id:string)=>normalizeElfStats({...h.unit(id,1000,[h.wait()]),level:120,startingHp:{mode:'percent',value:50}});
 for(const side of ['p1','p2'] as const){
  const opponent=side==='p1'?'p2':'p1';
  const owner={...unit('owner'),destinyRank:'C',interceptorEffect:{id:'pp_chain',name:'時空枷鎖',type:'on_enter',triggerLog:'攔截測試'}};
  const enemy=unit('enemy');
  const engine=createBattleEngine({initialP1Team:[side==='p1'?owner:enemy],initialP2Team:[side==='p2'?owner:enemy],p1StarterId:side==='p1'?'owner':'enemy',p2StarterId:side==='p2'?'owner':'enemy',battleMode:'PVP',battleFormat:'normal_6v6',fieldId:'destiny',battleFlames:{[side]:'flame_green'},isFast:()=>true});
  try{
   engine.mount();engine.start();await engine.idle();const state=engine.getState();
   assert.equal(state[side].level,120);assert.equal(state[side].currentHp,Math.floor(state[side].maxHp/2),'正式初始化後依最終上限設置開戰HP');
   assert.equal(state[side].statStages.atk,1,'自由戰綠火登場效果');
   assert.equal(state[opponent].skills[0].pp,97,'自由戰命運場地也啟用攔截');
  }finally{engine.unmount();}
 }
 const base=normalizeElfStats({...unit('save'),level:100,startingHp:undefined}),inscription={id:'stat-owner',name:'保留原數值',stats:{hp:17,atk:19,def:23,spatk:29,spdef:31,speed:37},gem:{id:'1800265',skillName:base.skills[0].name},skinId:'40001',skinIcon:'/seer/countermark/40001.png'};
 const training={...base,level:120,startingHp:{mode:'percent',value:50},inscriptions:[inscription]};
 const saved=new Map([['seer_default_elves_overrides',JSON.stringify({save:training})]]);
 const doc=captureConfiguration({getItem:(k:string)=>saved.get(k)||null},'外觀練度測試','test');
 const plan=prepareConfiguration(doc,{getItem:()=>null},{elves:[base],aliases:{},normalize:normalizeElfStats,validateKit:()=>{}},'test');
 const roundtrip=JSON.parse(plan.writes.seer_default_elves_overrides).save;
 assert.equal(roundtrip.level,120);assert.deepEqual(roundtrip.startingHp,training.startingHp);assert.deepEqual(roundtrip.inscriptions,[inscription]);
 const appearance=normalizeElfStats({...training,inscriptions:[{...inscription,skinId:'40002',skinIcon:'/seer/countermark/40002.png'}]});
 assert.deepEqual(appearance.calculatedStats,normalizeElfStats(training).calculatedStats,'只換圖樣不得改變數值');
 const newer={...inscription,gem:{id:'future-gem',skillName:'x'},skinId:'invalid'};
 const compatible=prepareConfiguration({...doc,entries:{seer_default_elves_overrides:JSON.stringify({save:{inscriptions:[newer]}})}},{getItem:()=>null},{elves:[base],aliases:{},normalize:normalizeElfStats,validateKit:()=>{}},'test');
 const kept=JSON.parse(compatible.writes.seer_default_elves_overrides).save.inscriptions[0];
 assert.deepEqual(kept.stats,inscription.stats);assert.equal(kept.gem,undefined);assert.equal(kept.skinId,undefined);
 console.log('自由戰場地／火焰、雙方120級正式初始化與半血、外觀不改數值、配置碼與未知寶石相容帶入通過');
}finally{await h.close();}
