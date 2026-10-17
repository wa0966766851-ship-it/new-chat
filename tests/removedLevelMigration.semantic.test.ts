import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {validateKit} from '../src/effects/kitValidation';
import {MIGRATED_REMOVED_LEVEL_SKILL_KITS as defs} from '../src/data/migratedRemovedLevelSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0,layers=3;
const a=(op:string,p:any)=>({op,p,label:op});
const sk=()=>structuredClone(h.find('arena_14','鋭武銘戈'));
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log('✓ '+n);};
const trait=(acts:any[])=>({name:'起始效果',effectMode:'kit',kit:[{codeId:'effect_sequence',source:'mechanic',node:'on_entered',order:0,params:{clause:{raw:'起始',trig:'entrance',parsed:true,body:[{acts}]}}}]});
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {isZeroPpExempt}=await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
const {readListedPriority}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {handleWujiSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/staged-arena/wujiRegistry.ts');
const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
const registry=getBattleSkillRegistry(),old=registry['鋭武銘戈'];registry['鋭武銘戈']=()=>{calls++;throw Error('不得重播舊handler');};
h.S.levelHolder=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)ctx.setMark({id:'arena.heroGlory',name:'英雄之耀',count:layers,unit:'層',source:'測試',ownerBattleId:ctx.self.battleId,clearable:false},ctx.actor);};
try{
 let edited:any;
 await check('全文與完整Kit、六條圖紙Blockly保存重載，改每級40→25可編輯',()=>{
  const s=sk();assert.equal(s.effectMode,'kit');assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);validateKit(s.kit);
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{edited={...s,name:'自訂級數消除',kit:s.kit.map((e:any)=>{
   const b=buildEntryBlock(w as any,e)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
   assert.deepEqual(createKitBlockParser('skill')(r.getBlockById(b.id)!,e.node,e.order),e);
   for(const x of r.getAllBlocks(false))if(x.type==='sequence_action'&&x.getFieldValue('OP')==='dmg_from_last'){const p=JSON.parse(x.getFieldValue('PARAMS'));p.ratio=25;x.setFieldValue(JSON.stringify(p),'PARAMS');}
   w.clear();Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(r),w);
   const out=createKitBlockParser('skill')(w.getBlockById(b.id)!,e.node,e.order)!;w.clear();r.clear();return out;
  })};validateKit(edited.kit);}finally{w.dispose();r.dispose();}
  assert.throws(()=>validateKit(h.kitSkill('壞',[a('stat_clear',{side:'opp',kind:'up',captureLevels:'yes'})]).kit));
 });
 for(const side of ['p1','p2'] as const){
  await check(`${side} 真實魂印不重疊Kit先制+1，registry自訂版保留舊加成`,()=>{
   const self=h.unit('S',10000,[sk()]);
   for(const kit of [true,false]){
    const data={priorityComp:{bonus:0}},ctx={actor:side,self,activeP1:self,activeP2:self,skill:{...sk(),effectMode:kit?'kit':'registry'},getPlayerState:(key:string)=>key==='arena.S.hero'?3:0};
    handleWujiSoulMark(ctx,T.MODIFY_PRIORITY,data);assert.equal(data.priorityComp.bonus,kit?0:1);
   }
  });
  await check(`${side} 真正清除5級附加200固定；無提升及受保護不捏造傷害`,async()=>{
   const run=(stages:any,protect=false,s=sk())=>h.play(side,{self:h.unit('S',10000,[s]),opp:h.unit('E',100000,[h.wait()],{statStages:stages,extra:protect?{trait:trait([a('stat_protect_turns',{turns:3})])}:{}})});
   const [plain]=await run({}),[r]=await run({atk:2,accuracy:3,spatk:-1}),[blocked]=await run({atk:2,accuracy:3},true);
   assert.equal(plain.opp.currentHp-r.opp.currentHp,200);assert.equal(r.opp.statStages.atk||0,0);assert.equal(r.opp.statStages.accuracy||0,0);assert.equal(r.opp.statStages.spatk,-1);
   assert.equal(blocked.opp.currentHp,plain.opp.currentHp);assert.equal(blocked.opp.statStages.atk,2);
   const [e]=await run({atk:2,accuracy:3},false,edited);assert.equal(plain.opp.currentHp-e.opp.currentHp,125);
  });
  await check(`${side} 通用計量支援下降／雙側；失敗時清空前筆金額`,async()=>{
   const skill=h.kitSkill('計量',[a('heal_flat',{amount:13}),a('stat_clear',{side:'both',kind:'down',captureLevels:true}),a('dmg_from_last',{ratio:40,type:'固定'})]);
   for(const any of [false,true]){
    const [r]=await h.play(side,{self:h.unit('S',1000,[skill],{maxHp:10000,statStages:any?{def:-2}:{} }),opp:h.unit('E',10000,[h.wait()],{statStages:any?{atk:-3,accuracy:1}:{}})});
    assert.equal(r.opp.currentHp,any?9800:10000);assert.equal(r.self.currentHp,1013);assert.equal(r.opp.statStages.accuracy||0,any?1:0);
   }
  });
  await check(`${side} 反轉自身下降成功後僅無效下一次攻擊，屬性等待不耗次數`,async()=>{
   const attack={...h.wait(),name:'測量攻擊',category:'物理',power:30};
   for(const reverse of [false,true]){
    const r=await h.play(side,{self:h.unit('S',10000,[sk(),h.wait()],{statStages:reverse?{def:-2}:{}}),opp:h.unit('E',100000,[h.wait(),attack]),turns:(_,t)=>[t===1?0:1,t<=2?0:1]},4);
    if(reverse){assert.equal(r[0].self.statStages.def,2);assert.equal(r[2].self.currentHp,10000);assert.ok(r[3].self.currentHp<10000);}
    else assert.ok(r[2].self.currentHp<10000);
   }
  });
  await check(`${side} 附加效果失效不執行清除／按級附傷／反轉或無效計數`,async()=>{
   const [r]=await h.play(side,{self:h.unit('S',10000,[sk()],{statStages:{def:-2}}),opp:h.unit('E',100000,[h.wait()],{statStages:{atk:2},extra:{trait:trait([a('add_invalid_turns',{turns:2,kind:'攻擊'})])}})});
   assert.equal(r.self.statStages.def,-2);assert.equal(r.opp.statStages.atk,2);
   assert.equal(r.state[`${side==='p1'?'p2':'p1'}Timers`].some((t:any)=>t.payload?.block?.invalid),false);
  });
  await check(`${side} 清回合成功才給下兩回合-2；當回合不扣，兩回合後消失`,async()=>{
   for(const hasTimer of [false,true]){
    const r=await h.play(side,{self:h.unit('S',10000,[sk(),{...h.wait(),priority:-1}],{speed:200}),opp:h.unit('E',100000,[h.turnEffectSkill(),h.wait()]),turns:(_,t)=>[t===2?0:1,t===1&&hasTimer?0:1]},5);
    for(const i of [1,2])assert.equal(r[i].state[`${side==='p1'?'p2':'p1'}Timers`].some((t:any)=>t.payload?.block?.prio===-2),hasTimer);
    assert.equal(r[3].state[`${side==='p1'?'p2':'p1'}Timers`].some((t:any)=>t.payload?.block?.prio===-2),false);
    for(const i of [2,3,4])assert.match(r[i].logs.filter((s:string)=>s.includes('使用了')).slice(-2)[0],hasTimer&&i<4?/【S】/:/【E】/,'實際先手順序依下兩回合減先制改變');
   }
  });
  await check(`${side} 三層英雄之耀PP0可真正出手；兩層不可，固有先制3→4`,async()=>{
   for(layers of [2,3]){
    const [r]=await h.play(side,{self:h.unit('S',10000,[{...sk(),pp:0},h.wait()],{extra:{name:'levelHolder',soulMark:{name:'levelHolder',description:''}}}),opp:h.unit('E',100000,[h.wait()]),turns:(engine)=>{
     const st=engine.getState(),self=st[side],opp=st[side==='p1'?'p2':'p1'];assert.equal(isZeroPpExempt(self,self.skills[0],opp),layers===3);
     const ctx={actor:side,targetSide:side==='p1'?'p2':'p1',self,target:opp,getMarks:(s:string)=>st[`${s}Marks`],getPlayerState:()=>undefined};
     assert.equal(readListedPriority(self.skills[0],ctx),layers===3?4:3);return [layers===3?0:1,0];
    }});
    assert.equal(r.opp.currentHp<100000,layers===3);assert.equal(r.self.skills[0].pp,0);
   }
  });
  await check(`${side} 真實無極聖武魂印與三名隊員：PP0可出手且實際先制不重複加成`,async()=>{
   const owner=DEFAULT_ELVES.find((e:any)=>e.id==='arena_14');
   const [r]=await h.play(side,{self:h.unit('S',10000,[{...sk(),pp:0}],{speed:100,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),selfBench:[0,1,2].map(i=>h.unit('B'+i,10000,[h.wait()])),opp:h.unit('E',100000,[{...h.wait(),priority:6}],{speed:1000})});
   // 對手武誅先制-2，6→4；本招為3+1=4，同先制由速度1000的對手先行。
   assert.match(r.logs.filter((s:string)=>s.includes('使用了'))[0],/【E】/);assert.ok(r.opp.currentHp<100000);assert.equal(r.self.skills[0].pp,0);
   assert.equal(r.self.skills[0].ignorePpLimit,undefined,'魂印不再替Kit寫入專屬例外欄位');
  });
 }
 assert.equal(calls,0);console.log(`鋭武銘戈整份遷移：${checks} 項通過`);
}finally{if(old)registry['鋭武銘戈']=old;else delete registry['鋭武銘戈'];delete h.S.levelHolder;await h.close();}
