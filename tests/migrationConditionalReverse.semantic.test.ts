import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_FEEDBACK_SKILL_KITS as defs} from '../src/data/migratedFeedbackSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const name='懼噬・恐源浸染',definition=defs.find(d=>d.name===name)!;
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const legacy=getBattleSkillRegistry(),original=legacy[name];legacy[name]=(ctx:any)=>{legacyCalls++;return original(ctx);};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=()=>({...structuredClone(h.find('5025',name)),power:0});
function reload(s:any,turns?:number,ratio?:number){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));if(turns!==undefined&&['no_heal','add_invalid_turns'].includes(op))p.turns=turns;if(ratio!==undefined&&op==='heal')p.ratio=ratio;b.setFieldValue(JSON.stringify(p),'PARAMS');}
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
const effect=(category='屬性')=>h.kitSkill('對手附加',[{op:'heal_flat',p:{amount:300}},{op:'stat',p:{side:'self',stats:['防禦'],v:1}}],{category,power:0});
try{
  await check('完整來源與Blockly往返、條件先制和必中獨立查詢，不借舊處理器',async()=>{
    const s=skill();assert.equal(s.effectMode,'kit');assert.equal(s.description,definition.description);assert.deepEqual(s.kit,definition.kit);assert.deepEqual(reload(s).kit,s.kit);
    const {readBasePriority,readSkillProperty}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
    for(const up of [false,true]){const ctx={actor:'p1',targetSide:'p2',self:{},target:{statStages:up?{atk:2}:{}},getPlayerState:()=>0,getOpponentState:()=>0};assert.equal(readBasePriority(s,ctx),up?4:3);assert.equal(readSkillProperty(s,'sure_hit',ctx),up?true:undefined);}
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['other',raw],['5025',{...raw,description:raw.description+'改'}],['5025',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,1,.5);assert.deepEqual(applyReviewedSkillKits({id:'5025',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 成功命中即回滿體力，不要求對手有提升；反轉只改提升而保留既有下降`,async()=>{
      for(const up of [false,true]){const [r]=await h.play(side,{self:h.unit('S',1000,[skill()],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{statStages:up?{atk:2,def:-3}:{def:-3}})});assert.equal(r.self.currentHp,10000);assert.equal(r.opp.statStages.def,-3);assert.equal(r.opp.statStages.atk||0,up?-2:0);}
    });
    await check(`${side} 有提升時0命中率也必中，未提升時未命中不回復；固有附加分開封印`,async()=>{
      const zero={...skill(),accuracy:0,isSureHit:false,alwaysHit:false};
      const [hit]=await h.play(side,{self:h.unit('S',1000,[zero],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2}})});assert.equal(hit.self.currentHp,10000);assert.equal(hit.opp.statStages.atk,-2);
      const [miss]=await h.play(side,{self:h.unit('S',1000,[zero],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()])});assert.equal(miss.self.currentHp,1000);
      const [sealed]=await h.play(side,{self:h.unit('S',1000,[zero],{maxHp:10000,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2}})});assert.equal(sealed.self.currentHp,1000);assert.equal(sealed.opp.statStages.atk,2);assert.ok(!sealed.logs.some((s:string)=>s.includes('未命中')));
    });
    await check(`${side} 反轉被不可消提升擋住才嘗試清除，兩者均擋住保持提升；自身禁療不取消對手限制`,async()=>{
      h.S.E=(ctx:any,e:any)=>{if(e===T.ON_ENTRANCE)ctx.setPlayerState('statBoostUnclearableTurns',4);};
      try{const [r]=await h.play(side,{self:h.unit('S',1000,[skill()],{maxHp:10000}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2}})});assert.equal(r.opp.statStages.atk,2);assert.ok(r.logs.filter((s:string)=>s.includes('能力上升狀態無法被消除')).length>=2,r.logs.join('\n'));}finally{delete h.S.E;}
      const ban=h.kitSkill('先禁療',[{op:'no_heal',p:{turns:2,next:false}}],{priority:5});
      const r=await h.play(side,{self:h.unit('S',1000,[skill(),h.wait()],{maxHp:10000}),opp:h.unit('E',10000,[ban,effect()],{maxHp:20000}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);assert.equal(r[0].self.currentHp,1000);assert.equal(r[1].opp.currentHp,10000);assert.equal(r[1].opp.statStages.def||0,0);
    });
    await check(`${side} 禁療完整三回合，僅屬性附加失效；第四回合恢復，攻擊附加仍可強化`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',1000,[skill(),h.wait()],{maxHp:10000}),opp:h.unit('E',10000,[effect(),effect('物理')],{maxHp:20000}),turns:(_,t)=>[t===1?0:1,t===2?1:0]},4);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[10000,10000,10000,10300]);assert.deepEqual(hist.map(r=>r.opp.statStages.def||0),[0,1,1,2]);
    });
    await check(`${side} Blockly改回復比例與期限，保存重載改名後按新值運行`,async()=>{
      const edited={...reload(skill(),1,.5),name:'改名恐源',description:''};
      const hist=await h.play(side,{self:h.unit('S',1000,[edited,h.wait()],{maxHp:10000}),opp:h.unit('E',10000,[effect()],{maxHp:20000}),turns:(_,t)=>[t===1?0:1,0]},2);assert.equal(hist[0].self.currentHp,6000);assert.equal(hist[0].opp.currentHp,10000);assert.equal(hist[1].opp.currentHp,10300);assert.equal(hist[1].opp.statStages.def,1);
    });
    await check(`${side} 原恐懼魂印不重播舊技能handler`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5025');
      await h.play(side,{self:h.unit('S',1000,[skill()],{maxHp:10000,extra:{name:elf.name,soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',10000,[h.wait()],{statStages:{atk:2}})});assert.equal(legacyCalls,0);
    });
  }
  console.log(`懼噬・恐源浸染既有圖紙複檢：${checks}項通過，未新增遷移數或授予全部定義全文驗收`);
}finally{legacy[name]=original;delete h.S.E;await h.close();}
