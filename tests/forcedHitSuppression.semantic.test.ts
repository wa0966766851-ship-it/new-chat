import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
 const {authoredEntry:e,authoredSkill:skill,operation:a,actions:act,condition:c}=await h.server.ssrLoadModule('/src/data/authoredKitTools.ts');
 for(const side of ['p1','p2'] as const){
  const run=async(mode:string,blocked:string,power=100,force=true,guard=false,powerUp=false)=>{
   const receipts:number[]=[];let used=0,failed=0;
   const kit=[e('命中附加計數','use',[act(a('pending_counter',{key:'forcedExecutionCount',amount:1,label:'計數'}))],0)];
   if(powerUp)kit.push(e('威力翻倍','outgoing_power',[act(a('power_mod',{boost:1}))],2));
   if(mode==='recalc')kit.push(e('無效重新計算','self_invalid',[act(a('recalculate_skill',{powerMultiplier:2}))],1,'skill',true));
   const sk=skill('重算交互驗證','普通','特殊',power,20,0,kit,{sure:true});
   h.S['交互施放者']=(c:any,event:string)=>{if(event==='BEFORE_SKILL'&&force&&mode!=='recalc')c.setPlayerState('forceHitEffectsThisAction',true);if(event==='ACTION_FAILED')failed++;if(event==='AFTER_ACTION')used++;};
   h.S['交互受方']=(c:any,event:string,data:any)=>{
    if(event==='ON_ENTRANCE'){
     if(mode!=='normal')c.addTimerTo(c.targetSide,{id:'效果失效',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{[mode==='sealed'?'addInvalid':'invalid']:'all'}}},false);
     if(blocked.includes('prevent'))c.addTimerTo(c.targetSide,{id:'無法傷害',remaining:4,kind:'turn_effect',source:'skill',tickAt:'round_end',payload:{preventAttackDamage:true}},false);
     if(blocked.includes('block'))c.addTimerTo(c.actor,{id:'傷害抵擋',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{recordBlockedDamage:'suppressionTest',kind:'技能'}}},false);
     if(blocked.includes('legacy'))c.addTimerTo(c.actor,{id:'原有次數抵擋',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{blockAttack:true}}},false);
     if(guard){c.applyShield(c.actor,10);c.addTimerTo(c.actor,{id:'仍然減傷',remaining:4,kind:'turn_effect',source:'skill',tickAt:'round_end',payload:{block:{dmgIn:-.5,kind:'攻擊'}}},false);}
    }
    if(event==='AFTER_DAMAGE'&&data?.damageType==='skill_attack')receipts.push(data.receipt.settledAmount);
   };
   const extra=blocked.includes('direct')?{trait:{name:'直接抵擋',effectMode:'kit',kit:[e('直接抵擋','incoming_attack',[act(a('block_damage',{kind:'攻擊',key:'direct'}))],0,'soulmark',true,blocked==='directInactive'?[c('player_state',{key:'allowBlock',equals:true,fallback:false})]:[])]}}:{};
   const [r]=await h.play(side,{self:h.unit('交互施放者',10000,[sk],{speed:300}),opp:h.unit('交互受方',100000,[{...h.wait(),priority:-10}],{extra})});
   assert.equal(r.self.skills[0].pp,19,'僅扣一次PP');
   return {r,receipts,used,failed,count:r.state[side+'RegistryState'].forcedExecutionCount};
  };
  const base=await run('normal','',100,false),double=await run('normal','',200,false);
  assert.ok(base.receipts[0]>0);
  for(const block of ['block','prevent','block+prevent','direct','direct+prevent','legacy','legacy+prevent']){
   for(const mode of ['invalid','sealed','recalc']){
    const r=await run(mode,block);
    assert.deepEqual(r.receipts,mode==='recalc'?double.receipts:base.receipts,`${side}/${mode}/${block}沿用正式公式`);
    assert.equal(r.count,mode==='recalc'?undefined:1,'強制附加只執行一次');
    assert.equal(r.failed,mode==='sealed'?0:1,'重算不把原本無效技能改成成功命中');
   }
   const ordinary=await run('sealed',block,100,false);
   assert.ok(ordinary.receipts.every(n=>n===0),'沒有強制或重算能力仍受封鎖');
  }
  const guarded=await run('sealed','block+prevent',100,true,true),reference=await run('normal','',100,false,true);
  assert.deepEqual(guarded.receipts,reference.receipts,'減傷仍生效');
  assert.equal(guarded.r.opp.currentHp,reference.r.opp.currentHp,'護盾仍承傷');
  const inactive=await run('invalid','directInactive');
  assert.deepEqual(inactive.receipts,[],'未啟用的抵擋積木不能令一般無效技能獲得主傷害');
  assert.equal(inactive.count,1,'只補執行命中效果');
  // 2026-11-13：強制命中＋技能自帶威力變化（倍率、隨機威力等）→ 以正式公式重算主傷害，不再整招無效零傷害。
  const powered=await run('invalid','',100,true,false,true);
  assert.deepEqual(powered.receipts,double.receipts,`${side}：威力翻倍經重算生效`);
  assert.equal(powered.count,1,'強制附加只執行一次');
 }
 console.log('forcedHitSuppression passed: P1/P2 invalid/sealed/recalculation crossed with blocking and no-damage, one PP/attached execution, reduction and shield retained');
}finally{await h.close();}
