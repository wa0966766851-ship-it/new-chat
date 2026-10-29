import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_STAGE_SKILL_KITS as defs} from '../src/data/migratedStageSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleDixinSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/dixin/registry.ts');
const {readStageLevels}=await h.server.ssrLoadModule('/src/effects/stageQueries.ts');
const legacy=getBattleSkillRegistry(),saved=legacy['帝怒傾天'];legacy['帝怒傾天']=(c:any)=>{calls++;return saved(c);};
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=()=>structuredClone(h.find('5017','帝怒傾天'));
const a=(op:string,p:any)=>({op,p,label:op});
function init(count:number,observe?:(c:any,e:any,d:any)=>void){h.S.S=(c:any,e:any,d:any)=>{
  if(e===T.ON_ENTRANCE)c.setMark({id:'bahuang_mark',name:'八荒',count,ownerBattleId:c.self.battleId||c.self.id},c.actor);
  observe?.(c,e,d);
};}
const neg={atk:-1,def:-2,spatk:-3,spdef:-4,speed:-5,accuracy:-6};
const pos={atk:1,def:2,spatk:3,spdef:4,speed:5,accuracy:6};
function reload(s:any,edit=false){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');const b=buildEntryBlock(w as any,e)!;assert.ok(b);slot.getInput('STACK')!.connection!.connect(b.previousConnection!);}
    if(edit)for(const b of w.getAllBlocks(false)){
      if(b.type==='skill_property'&&b.getFieldValue('PROPERTY')==='stage_power'){b.setFieldValue('5','VALUE');b.setFieldValue('{"side":"self","kind":"up"}','PER_STAGE');}
      if(b.type==='skill_property'&&b.getFieldValue('PROPERTY')==='ignore_damage_reduction'){const c=JSON.parse(b.getFieldValue('CONDITIONS'));c[0].p.amount=2;b.setFieldValue(JSON.stringify(c),'CONDITIONS');}
      if(b.type==='sequence_action'&&b.getFieldValue('OP')==='dmg'){const p=JSON.parse(b.getFieldValue('PARAMS'));p.flat=10;p.perStage={side:'self',kind:'up'};b.setFieldValue(JSON.stringify(p),'PARAMS');}
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map((slot:any,i:number)=>createKitBlockParser('skill')(slot.getInputTargetBlock('STACK'),slot.getFieldValue('TARGET_NODE'),i)!)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('整份8條原文精確匹配、預設Kit、全Blockly往返與已保存自訂圖紙保護',async()=>{
    const s=skill();assert.equal(s.description,(source as any)['5017'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.equal(s.effectMode,'kit');assert.deepEqual(s.kit,defs[0].kit);assert.deepEqual(reload(s).kit,s.kit);
    for(const e of s.kit)assert.equal(e.codeId==='skill_property'?skillPropertyIssue(e):sequenceIssue(e.params.clause,e.node),null);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');const raw={...s,kit:undefined,effectMode:undefined};
    for(const [id,v] of [['x',raw],['5017',{...raw,description:raw.description+'改'}],['5017',{...raw,effectMode:'registry'}]] as any)assert.equal(applyReviewedSkillKits({id,skills:[v]}).skills[0].kit,undefined);
    const edited=reload(s,true);assert.deepEqual(applyReviewedSkillKits({id:'5017',skills:[edited]}).skills[0].kit,edited.kit);
  });
  await check('能力等級查詢只讀原始六項、單一方向；拒絕非法角色／來源／節點／數字或自訂程式',()=>{
    const ctx:any={self:{statStages:{...neg,hp:-6}},target:{statStages:{...pos,hp:6}}};assert.equal(readStageLevels(ctx,{side:'self',kind:'down'}),21);assert.equal(readStageLevels(ctx,{side:'opp',kind:'up'}),21);
    for(const q of [{side:'both',kind:'up'},{side:'self',kind:'all'},{side:'self',kind:'up',handler:'x'}]){const e=structuredClone(defs[0].kit[6]);e.params.perStage=q;assert.ok(skillPropertyIssue(e));assert.ok(sequenceIssue(h.kitSkill('壞',[a('dmg',{flat:10,type:'固定',perStage:q})]).kit[0].params.clause));}
    for(const change of [{node:'on_hit'},{role:'attached'},{source:'soulmark'},{params:{property:'stage_power',value:0,perStage:{side:'opp',kind:'up'},conditions:[]}},{params:{property:'stage_power',value:1.5,perStage:{side:'opp',kind:'up'},conditions:[]}}])assert.ok(skillPropertyIssue({...structuredClone(defs[0].kit[6]),...change}));
    assert.ok(sequenceIssue(h.kitSkill('壞',[a('dmg',{ratio:.5,base:'最大體力',perStage:{side:'self',kind:'up'}})]).kit[0].params.clause));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 同時兩個能力視圖等於真實反向對照，原始21级仍加630威力及1260固傷而不改能力`,async()=>{
      const powers:number[]=[],bases:number[]=[];init(0,(_,e,d)=>{if(e===T.MODIFY_POWER&&!d?.isIncoming)powers.push(d.skill.power);if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')bases.push(d.base);});
      const [r]=await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:neg}),opp:h.unit('E',1000000,[h.wait()],{statStages:pos})});assert.deepEqual(powers,[skill().power+630]);assert.deepEqual(r.self.statStages,neg);assert.deepEqual(r.opp.statStages,pos);
      const base=bases[0],plain={...skill(),name:'公式對照',power:skill().power+630,kit:skill().kit.filter((e:any)=>e.params.property==='sure_hit')};powers.length=0;bases.length=0;
      const [p]=await h.play(side,{self:h.unit('S',1000000,[plain],{statStages:pos}),opp:h.unit('E',1000000,[h.wait()],{statStages:neg})});assert.equal(bases[0],base);assert.equal(p.opp.currentHp-r.opp.currentHp,1260);
    });
    await check(`${side} 兩條條件先制獨立相加，只有一方成立+3、兩方+6；無條件時不借描述`,async()=>{
      for(const [selfStages,oppStages,expected] of [[{}, {},'E'],[{atk:-1},{},'E'],[{}, {def:1},'E'],[{atk:-1},{def:1},'S']] as any){const order:string[]=[];init(0,(_,e)=>{if(e===T.BEFORE_ACTION)order.push('S');});h.S.E=(_,e)=>{if(e===T.BEFORE_ACTION)order.push('E');};
        await h.play(side,{self:h.unit('S',1000000,[skill()],{speed:50,statStages:selfStages}),opp:h.unit('E',1000000,[{...h.wait(),priority:4}],{speed:200,statStages:oppStages})});assert.equal(order[0],expected);
      }delete h.S.E;
    });
    await check(`${side} 八荒2層減傷80%，3層起無視受方減傷，但附加固定不借攻擊繞過`,async()=>{
      for(const n of [2,3]){const bases:number[]=[];init(n,(_,e,d)=>{if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack'){d.base=1000;bases.push(d.base);}});
        const [r]=await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:{accuracy:-1}}),opp:h.unit('E',1000000,[h.wait()],{extra:{battleStatuses:{山神守護:3}}})});assert.equal(r.opp.currentHp,1000000-(n===3?1000:200)-60,r.logs.join('\n'));
      }
      init(3,(c,e,d)=>{if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')d.base=1000;});const reduction={name:'共用減傷',description:'共用減傷',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',order:0,params:{clause:{raw:'非真實減半',trig:'incoming_nontrue',parsed:true,body:[{acts:[a('dmg_mod',{dir:'in',kind:'非真實',reduce:.5})]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:{accuracy:-1}}),opp:h.unit('E',1000000,[h.wait()],{extra:{trait:reduction}})});assert.equal(r.opp.currentHp,998970,r.logs.join('\n'));
    });
    await check(`${side} 無視減傷保留正式傷害上限、抵擋、護盾／護罩與自身輸出減傷`,async()=>{
      const compBase=(_:any,e:any,d:any)=>{if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')d.base=1000;};
      for(const n of [2,3]){init(n,compBase);const flat=h.kitSkill('固定量減傷',[a('flat_reduction_uses',{flat:400,uses:1,kind:'攻擊'})],{priority:10});
        const [f]=await h.play(side,{self:h.unit('S',1000000,[skill()]),opp:h.unit('E',1000000,[flat])});assert.equal(f.opp.currentHp,n===3?999000:999400,f.logs.join('\n'));
      }init(3,compBase);
      const cap=h.kitSkill('傷害上限',[a('damage_cap_turns',{side:'self',dir:'in',kind:'攻擊',cap:100,turns:2,next:false})],{priority:10});const [limited]=await h.play(side,{self:h.unit('S',1000000,[skill()]),opp:h.unit('E',1000000,[cap])});assert.equal(limited.opp.currentHp,999900);
      const block=h.kitSkill('次數抵擋',[a('block_damage_uses',{uses:1,kind:'攻擊',key:'test'})],{priority:10});const [blocked]=await h.play(side,{self:h.unit('S',1000000,[skill()]),opp:h.unit('E',1000000,[block])});assert.equal(blocked.opp.currentHp,1000000);
      const [shield]=await h.play(side,{self:h.unit('S',1000000,[skill()]),opp:h.unit('E',1000000,[h.wait()],{extra:{shield:2000}})});assert.equal(shield.opp.currentHp,1000000);assert.equal(shield.opp.shield,1000);
      const [barrier]=await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:{accuracy:-1}}),opp:h.unit('E',1000000,[h.wait()],{extra:{barrier:2000}})});assert.equal(barrier.opp.currentHp,999000);assert.equal(barrier.opp.barrier,1940);
      const out={name:'自身輸出降低',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',order:0,params:{clause:{raw:'自身輸出減半',trig:'outgoing_attack',parsed:true,body:[{acts:[a('dmg_mod',{dir:'out_reduce',kind:'攻擊',reduce:.5})]}]}}}]};const [down]=await h.play(side,{self:h.unit('S',1000000,[skill()],{extra:{trait:out}}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(down.opp.currentHp,999500);
    });
    await check(`${side} 固有失效保留原始下降固傷，附加失效仍保留原始提升威力／能力視圖`,async()=>{
      for(const [flag,power] of [['isInherentInvalid',skill().power],['isAdditionalInvalid',skill().power+630]] as any){const powers:number[]=[];init(3,(_,e,d)=>{if(e===T.MODIFY_POWER&&!d.isIncoming)powers.push(d.skill.power);if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')d.base=1000;});
        const [r]=await h.play(side,{self:h.unit('S',1000000,[{...skill(),accuracy:100}],{statStages:{atk:-2},extra:{[flag]:true}}),opp:h.unit('E',1000000,[h.wait()],{statStages:pos})});assert.deepEqual(powers,[power]);assert.equal(r.opp.currentHp,flag==='isInherentInvalid'?998880:999000);assert.deepEqual(r.self.statStages,{atk:-2});assert.deepEqual(r.opp.statStages,pos);
      }
    });
    await check(`${side} 原魂印相容路由不雙加條件先制，公式威力只加一次且技能handler0次`,async()=>{
      const order:string[]=[];h.S.S=(c:any,e:any,d:any)=>{if(e===T.MODIFY_PRIORITY)handleDixinSoulMark(c,e,d);if(e===T.BEFORE_ACTION)order.push('S');};h.S.E=(_,e)=>{if(e===T.BEFORE_ACTION)order.push('E');};
      await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:{atk:-1},speed:50}),opp:h.unit('E',1000000,[{...h.wait(),priority:7}],{statStages:{def:1},speed:200})});assert.equal(order[0],'E');delete h.S.E;
    });
    await check(`${side} Blockly改名後改數值／等級方向／門檻真的執行，未命中不造成固定附加`,async()=>{
      const powers:number[]=[];init(2,(_,e,d)=>{if(e===T.MODIFY_POWER&&!d.isIncoming)powers.push(d.skill.power);if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')d.base=1000;});
      const edited={...reload(skill(),true),name:'改名帝怒'};const [r]=await h.play(side,{self:h.unit('S',1000000,[edited],{statStages:{atk:-2,accuracy:1}}),opp:h.unit('E',1000000,[h.wait()],{statStages:{atk:2},extra:{battleStatuses:{山神守護:3}}})});assert.deepEqual(powers,[skill().power+5]);assert.equal(r.opp.currentHp,998990);
      const miss={...skill(),accuracy:0,isSureHit:false,kit:skill().kit.filter((e:any)=>e.params.property!=='sure_hit')};init(3);const [m]=await h.play(side,{self:h.unit('S',1000000,[miss],{statStages:neg}),opp:h.unit('E',1000000,[h.wait()])});assert.equal(m.opp.currentHp,1000000);
    });
  }
  for(const side of ['p1','p2'] as const)await check(`${side} 正式固有封印計時器停用威力、能力視圖與减傷繞過，不修改實際下降`,async()=>{
    const measure=async(timer:boolean)=>{let base=0,power=0;init(3,(c,e,d)=>{
      if(timer&&e===T.ON_ENTRANCE)c.addTimerTo(c.actor,{id:'innate-test',name:'固有失效',kind:'turn_effect',source:'skill',remaining:2,tickAt:'never',ownerBattleId:c.self.battleId||c.self.id,payload:{inherentInvalid:true}},false);
      if(e===T.MODIFY_POWER&&!d?.isIncoming)power=d.skill.power;
      if(e===T.BEFORE_DAMAGE&&!d.isIncoming&&d.damageCategory==='skill_attack')base=d.base;
    });
      const [r]=await h.play(side,{self:h.unit('S',1000000,[skill()],{statStages:{atk:-2},extra:timer?{}:{isInherentInvalid:true}}),opp:h.unit('E',1000000,[h.wait()],{statStages:{def:2},extra:{battleStatuses:{山神守護:3}}})});
      assert.equal(power,skill().power);assert.deepEqual(r.self.statStages,{atk:-2});return {hp:r.opp.currentHp,base};
    };assert.deepEqual(await measure(true),await measure(false));
  });
  assert.equal(calls,0);console.log(`${checks} stage skill checks passed; legacy calls ${calls}`);
}finally{legacy['帝怒傾天']=saved;delete h.S.S;delete h.S.E;await h.close();}
