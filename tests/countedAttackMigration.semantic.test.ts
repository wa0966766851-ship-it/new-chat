import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {kitEntryIssue} from '../src/effects/effectConnection';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
try{
  const skill=structuredClone(h.find('arena_15','陰陽三合'));assert.equal(skill.effectMode,'kit');validateKit(skill.kit);
  const property=skill.kit.find((e:any)=>e.params.property==='attack_hits');assert.deepEqual(property.params.value,{min:5,max:10});
  for(const value of [{min:0,max:10},{min:5,max:4},{min:1,max:101},{min:1.5,max:5},{min:1,max:5,handler:'elf'}]){
    assert.ok(kitEntryIssue({...property,params:{...property.params,value}}));
  }
  defineCustomBlocks();let edited:any;
  for(const entry of skill.kit){
    assert.equal(kitEntryIssue(entry),null);
    const w=new Blockly.Workspace(),copy=new Blockly.Workspace();
    try{
      const b=buildEntryBlock(w as any,entry)!;assert.ok(b);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
      assert.deepEqual(createKitBlockParser('skill')(copy.getBlockById(b.id)!,entry.node,entry.order),entry);
      if(entry===property){b.setFieldValue('{"min":3,"max":3}','VALUE');edited=createKitBlockParser('skill')(b,entry.node,entry.order);validateKit([edited]);}
    }finally{w.dispose();copy.dispose();}
  }
  const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
  const prd=await h.server.ssrLoadModule('/src/utils/prd.ts');
  const handlers=getBattleSkillRegistry(),old=handlers[skill.name];let oldCalls=0;
  handlers[skill.name]=()=>{oldCalls++;throw Error('舊專屬技能不得重播');};
  h.S['計次觀測器']=(ctx:any,event:any,data:any)=>{if(event===EffectTiming.AFTER_ATTACK_HIT)ctx.setPlayerState('observedHits',[...(ctx.getPlayerState('observedHits')||[]),data.hitIndex]);};
  try{
    for(const side of ['p1','p2'] as const){
      const play=async(sk:any,o:any={})=>{
        const self=h.unit('計次觀測器',100000,[sk],{speed:200,extra:o.extra});
        const [r]=await h.play(side,{self,opp:h.unit('foe',100000,[h.wait()],{statStages:o.stages}),
          turns:(e:any)=>{prd.resetPrd(()=>o.roll??0);if(o.protected)e.getState()[`${side==='p1'?'p2':'p1'}RegistryState`].statBoostUnclearableTurns=2;return [0,0];}});
        const hits=r.state[`${side}RegistryState`].observedHits||[];
        assert.deepEqual(hits,hits.map((_:any,i:number)=>i),'一次正式命中只通知一次');
        assert.ok(!r.logs.some((x:string)=>x.includes('效果待接通')));return {...r,hits};
      };
      const noProc=structuredClone(skill);noProc.kit.pop();
      const full=await play(skill),base=await play(noProc);
      assert.ok(full.hits.length>=5&&full.hits.length<=10);assert.equal(full.hits.length,base.hits.length);
      assert.equal(base.opp.currentHp-full.opp.currentHp,full.hits.length*100,'每次命中分別追加100，不是整次一次');
      assert.equal(full.self.skills[0].pp,skill.pp-1,'多次命中只消耗一次技能PP');
      assert.equal(full.opp.statStages.atk,-1);assert.equal(full.opp.statStages.speed,-1);
      checks++;console.log(`✓ ${side} 正式來源5～10擊、每擊固定100、無提升時弱化`);
      const fail=await play(skill,{roll:.999999}),failBase=await play(noProc,{roll:.999999});
      assert.equal(fail.opp.currentHp,failBase.opp.currentHp,'20%每擊未觸發不追加固定傷害');checks++;
      const renamed=structuredClone(skill);renamed.name='可改名連擊';renamed.kit[3]=edited;
      const renamedBase=structuredClone(renamed);renamedBase.kit.pop();
      const changed=await play(renamed),changedBase=await play(renamedBase);
      assert.equal(changed.hits.length,3);assert.equal(changedBase.opp.currentHp-changed.opp.currentHp,300);checks++;
      const boosted=await play(skill,{stages:{atk:2,speed:1}});
      assert.equal(boosted.self.statStages.atk,2);assert.equal(boosted.self.statStages.speed,1);
      assert.equal(boosted.opp.statStages.atk,0);assert.equal(boosted.opp.statStages.speed,0,'吸取後不能再誤觸發無提升弱化');
      const other=side==='p1'?'p2':'p1',priority=boosted.state[`${other}Timers`].find((t:any)=>t.payload?.block?.prio===-2);
      assert.ok(priority&&!priority.pendingActivation&&priority.remaining===1,'先制懲罰從下一回合起算1回合');checks++;
      const protectedResult=await play(skill,{stages:{atk:2},protected:true});
      assert.equal(protectedResult.opp.statStages.atk,2);assert.ok(!protectedResult.self.statStages.atk);
      assert.ok(!protectedResult.state[`${other}Timers`].some((t:any)=>t.payload?.block?.prio===-2));checks++;
      const sealed=await play(skill,{extra:{isAdditionalInvalid:true}}),sealedBase=await play(noProc,{extra:{isAdditionalInvalid:true}});
      assert.ok(sealed.hits.length>=5);assert.equal(sealed.opp.currentHp,sealedBase.opp.currentHp);assert.ok(!sealed.opp.statStages.atk);checks++;
      const noInnate=await play(skill,{extra:{isInherentInvalid:true}}),noInnateBase=await play(noProc,{extra:{isInherentInvalid:true}});
      assert.equal(noInnate.hits.length,1);assert.equal(noInnateBase.opp.currentHp-noInnate.opp.currentHp,100);checks++;
      const missed=structuredClone(skill);missed.accuracy=0;missed.isSureHit=false;missed.alwaysHit=false;
      const miss=await play(missed);assert.equal(miss.hits.length,0,'未命中不發出逐擊事件');checks++;
      const follow=await h.play(side,{self:h.unit('計次觀測器',100000,[skill,h.kitSkill('下回合單擊',[],{category:'物理',power:50})]),opp:h.unit('foe',100000,[h.wait()]),
        turns:(_e:any,t:number)=>{prd.resetPrd(()=>0);return[t===1?0:1,0];}},2);
      assert.equal(follow[1].state[`${side}RegistryState`].observedHits.length-follow[0].state[`${side}RegistryState`].observedHits.length,1,'連擊次數不漏到下一次別的攻擊');checks++;
      const [unequipped]=await h.play(side,{self:h.unit('計次觀測器',100000,[h.kitSkill('單擊',[],{category:'物理',power:50}),skill]),opp:h.unit('foe',100000,[h.wait()]),turns:()=>{prd.resetPrd(()=>0);return[0,0];}});
      assert.equal(unequipped.state[`${side}RegistryState`].observedHits.length,1);assert.ok(!unequipped.opp.statStages.atk,'未選用的技能不因攜帶而弱化對手');checks++;
    }
    assert.equal(oldCalls,0);
    const {handleMoiraiSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/staged-arena/moiraiRegistry.ts');
    let fixed=0;const self={id:'S',currentHp:100};const ctx:any={actor:'p1',targetSide:'p2',self,activeP1:self,rng:()=>0,applyFixedDamage:()=>fixed++};
    prd.resetPrd(()=>0);handleMoiraiSoulMark(ctx,EffectTiming.AFTER_ATTACK_HIT,{skill,additionalEffectsEnabled:true});assert.equal(fixed,0,'舊魂印內同名逐擊分支停用');
    handleMoiraiSoulMark(ctx,EffectTiming.AFTER_ATTACK_HIT,{skill:{...skill,effectMode:'auto'},additionalEffectsEnabled:true});assert.equal(fixed,1,'尚未切Kit的舊資料仍相容');
  }finally{handlers[skill.name]=old;delete h.S['計次觀測器'];}
  console.log(`${checks} 正式雙側連擊遷移情境通過，含原文來源、可改名、Blockly往返及舊路徑探針`);
}finally{await h.close();}
