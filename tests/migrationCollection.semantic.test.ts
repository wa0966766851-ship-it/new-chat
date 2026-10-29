import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_COLLECTION_SKILL_KITS as defs} from '../src/data/migratedCollectionSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const name='劫數・限界歸無',definition=defs[0];
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const legacy=getBattleSkillRegistry(),original=legacy[name];legacy[name]=(ctx:any)=>{legacyCalls++;return original(ctx);};
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=()=>({...structuredClone(h.find('5024',name)),power:0});
function reload(s:any,edit=false){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const b=buildEntryBlock(w as any,e);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    if(edit)for(const b of w.getAllBlocks(false))if(b.type==='sequence_action'){
      const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
      if(op==='select_elf'&&p.orderBy==='max_hp'){p.body[0].acts[0].p.ratio=2;p.body[0].acts[1].p.body[0].acts[0].p.cap=25;}
      if(op==='watch'&&p.trig==='kill')p.body[0].acts[0].p.turns=2;
      b.setFieldValue(JSON.stringify(p),'PARAMS');
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('完整來源／持有者／名稱精確、獨立条件先制與必中、Blockly往返及自訂保留',async()=>{
    const s=skill();assert.equal(s.effectMode,'kit');assert.equal(s.description,definition.description);assert.deepEqual(s.kit,definition.kit);assert.deepEqual(reload(s).kit,s.kit);
    const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');assert.equal(effectRoute(s,true),'kit');
    const {readBasePriority,readSkillProperty}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
    for(const down of [false,true]){const ctx={actor:'p1',targetSide:'p2',self:{statStages:down?{atk:-2}:{}},target:{},getPlayerState:()=>0,getOpponentState:()=>0};assert.equal(readBasePriority(s,ctx),down?3:0);assert.equal(readSkillProperty(s,'sure_hit',ctx),true);}
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,effectMode:undefined,kit:undefined};
    for(const [id,v] of [['other',raw],['5024',{...raw,description:raw.description+'改'}],['5024',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,true);assert.deepEqual(applyReviewedSkillKits({id:'5024',skills:[edited]}).skills[0].kit,edited.kit);
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 反轉成功只附本次弱化、選最低上限、未擊敗只消逝場下首位陣亡`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10050,[skill()],{speed:200,statStages:{atk:-2,def:3}}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('B',4000,[h.wait()],{maxHp:10000}),h.unit('D',0,[h.wait()],{maxHp:20000}),h.unit('D2',0,[h.wait()],{maxHp:20000})]});const team=r.state[`${other}Team`];assert.equal(r.self.statStages.atk,2);assert.equal(r.opp.statStages.atk,-2);assert.equal(r.opp.statStages.def||0,0);assert.equal(team[1].maxHp,10050);assert.equal(team[1].currentHp,4050);assert.equal(team[1].calculatedStats.atk,250);assert.equal(team[2].isVanished,true);assert.ok(!team[3].isVanished);assert.equal(r.state[`${other}RegistryState`].nextElfPriorityConstraint,undefined);
    });
    await check(`${side} 額外行動擊敗發生在未擊敗節點前，不消逝陣亡隊員而保留下隻限制`,async()=>{
      h.S.S=(ctx:any,e:any)=>{if(e===T.AFTER_ACTION&&ctx.skill?.name===name)ctx.queueExtraAction(ctx.actor,{owner:ctx.actor,label:'追擊',run:(cc:any)=>cc.applyTrueDamage(cc.targetSide,999999,'追擊')});};
      try{const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{speed:200}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('D',0,[h.wait()],{maxHp:20000}),h.unit('B',20000,[h.wait()])]});assert.equal(r.opp.currentHp,0);assert.ok(!r.state[`${other}Team`][1].isVanished);assert.equal(r.state[`${other}RegistryState`].nextElfPriorityConstraint.turns,1);}finally{delete h.S.S;}
    });
    await check(`${side} 正式死亡一後強制替換，下隻首個實際出手回合取消先制且翌回合恢復`,async()=>{
      let fired=false;h.S.S=(ctx:any,e:any)=>{if(e===T.AFTER_ACTION&&!fired&&ctx.skill?.name===name){fired=true;ctx.queueExtraAction(ctx.actor,{owner:ctx.actor,label:'追擊',run:(cc:any)=>cc.applyTrueDamage(cc.targetSide,999999,'追擊')});}};
      const order:string[]=[];h.S.B=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('B');};
      const originalS=h.S.S;h.S.S=(ctx:any,e:any)=>{originalS(ctx,e);if(e===T.BEFORE_ACTION)order.push('S');};
      let first:string[]=[];
      try{const hist=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{speed:200}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('B',20000,[{...h.wait(),priority:5}],{speed:100})],turns:async(engine,t)=>{
        if(t===2){engine.onSwitchElf(other,1);await engine.idle();order.length=0;}if(t===3){first=[...order];order.length=0;}return [t===1?0:1,0];
      }},3);assert.equal(hist[1].opp.battleId,'B');assert.deepEqual(first,['S','B']);assert.deepEqual(order,['B','S']);assert.ok(!hist[2].state[`${other}Timers`].some((t:any)=>t.id==='next_entry_priority'));}
      finally{delete h.S.S;delete h.S.B;}
    });
    await check(`${side} 本次監控不借後續回合擊敗；附加封印不反轉或改上限／消逝`,async()=>{
      const hist=await h.play(side,{self:h.unit('S',10000,[skill(),h.kitSkill('後續擊敗',[{op:'dmg',p:{flat:999999,type:'真實'}}])],{speed:200}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('B',20000,[h.wait()])],turns:(_,t)=>[t===1?0:1,0]},2);assert.equal(hist[1].opp.currentHp,0);assert.equal(hist[1].state[`${other}RegistryState`].nextElfPriorityConstraint,undefined);
      const [sealed]=await h.play(side,{self:h.unit('S',10050,[skill()],{statStages:{atk:-2},extra:{isAdditionalInvalid:true}}),opp:h.unit('E',5000,[h.wait()],{maxHp:10000}),oppBench:[h.unit('D',0,[h.wait()],{maxHp:20000})]});assert.equal(sealed.self.statStages.atk,-2);assert.equal(sealed.opp.maxHp,10000);assert.equal(sealed.opp.currentHp,5000);assert.ok(!sealed.state[`${other}Team`][1].isVanished);
    });
    await check(`${side} Blockly改下隻期限2回合，真正雙回合失效後恢復先制；負先制也失效`,async()=>{
      const edited={...reload(skill(),true),name:'編輯集合技能',description:''};let fired=false;
      const order:string[]=[];h.S.S=(ctx:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('S');if(e===T.AFTER_ACTION&&!fired&&ctx.skill?.name===edited.name){fired=true;ctx.queueExtraAction(ctx.actor,{owner:ctx.actor,label:'追擊',run:(cc:any)=>cc.applyTrueDamage(cc.targetSide,999999,'追擊')});}};
      h.S.B=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('B');};
      const orders:string[][]=[];
      try{await h.play(side,{self:h.unit('S',10000,[edited,h.wait()],{speed:200}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('B',20000,[{...h.wait(),priority:5}],{speed:100})],turns:async(engine,t)=>{if(t===2){engine.onSwitchElf(other,1);await engine.idle();}if(t>=3)orders.push([...order]);order.length=0;return [t===1?0:1,0];}},4);orders.push([...order]);assert.deepEqual(orders,[['S','B'],['S','B'],['B','S']]);}
      finally{delete h.S.S;delete h.S.B;}
      // 取消負先制同樣讀通用優先權查詢，首回合回到速度比較而不是繼續負先制。
      fired=false;const neg:string[]=[];h.S.S=(ctx:any,e:any)=>{if(e===T.BEFORE_ACTION)neg.push('S');if(e===T.AFTER_ACTION&&!fired&&ctx.skill?.name===name){fired=true;ctx.queueExtraAction(ctx.actor,{owner:ctx.actor,label:'追擊',run:(cc:any)=>cc.applyTrueDamage(cc.targetSide,999999,'追擊')});}};h.S.B=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)neg.push('B');};
      try{await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{speed:100}),opp:h.unit('E',20000,[h.wait()],{speed:1}),oppBench:[h.unit('B',20000,[{...h.wait(),priority:-5}],{speed:300})],turns:async(engine,t)=>{if(t===2){engine.onSwitchElf(other,1);await engine.idle();neg.length=0;}return [t===1?0:1,0];}},2);assert.deepEqual(neg,['B','S']);}finally{delete h.S.S;delete h.S.B;}
    });
    await check(`${side} Blockly改比例與扣點上限後改名仍執行；原持有者魂印不重播舊handler`,async()=>{
      const edited={...reload(skill(),true),name:'編輯集合技能',description:''};
      const [r]=await h.play(side,{self:h.unit('S',1050,[edited]),opp:h.unit('E',500,[h.wait()],{maxHp:1000})});assert.equal(r.opp.maxHp,2100);assert.equal(r.opp.currentHp,1600);assert.equal(r.opp.calculatedStats.atk,275);
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const elf=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5024');
      await h.play(side,{self:h.unit('S',10000,[skill()],{extra:{name:elf.name,soulMark:structuredClone(elf.soulMark)}}),opp:h.unit('E',20000,[h.wait()]),oppBench:[h.unit('D',0,[h.wait()],{maxHp:20000})]});assert.equal(legacyCalls,0);
    });
  }
  console.log(`劫數・限界歸無完整遷移：${checks}項通過，未授予全部定義全文驗收`);
}finally{legacy[name]=original;delete h.S.S;delete h.S.B;await h.close();}
