import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();try{
 const {MIGRATED_ARENA12_SKILL_KITS:defs}=await h.server.ssrLoadModule('/src/data/migratedArena12SkillKits.ts');
 const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
 const {multiplyDamageReduction}=await h.server.ssrLoadModule('/src/battle/damageReduction.ts');
 const source=(name:string)=>{const d=defs.find((d:any)=>d.name===name);assert.ok(d,name);return d;};
 const skill=(name:string)=>({...h.wait(),name,description:'',effectMode:'kit',kit:structuredClone(source(name).kit.filter((e:any)=>e.order===2))});
 defineCustomBlocks();for(const name of ['百法拜','十玄釋']){const entry=skill(name).kit[0];assert.equal(kitEntryIssue(entry),null);const w=new Blockly.Workspace(),r=new Blockly.Workspace();try{
  assert.ok(buildEntryBlock(w as any,entry));Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
  assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],entry.node,entry.order),entry);
 }finally{w.dispose();r.dispose();}}
 for(const side of ['p1','p2'] as const){
  for(const hp of [4499,4500,9000]){
   h.S['每回合補滿受方']=(ctx:any,ev:string)=>{if(ev==='ROUND_START')ctx.updateElf(ctx.actor,{currentHp:9000});};
   const history=await h.play(side,{self:h.unit('吸取持有者',hp,[skill('百法拜'),h.wait()],{maxHp:9000,speed:400}),opp:h.unit('每回合補滿受方',9000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},5);
   assert.equal(history[0].opp.currentHp,hp<4500?3000:6000,'首次低於半血翻倍，恰半血不翻倍');
   for(let i=1;i<4;i++)assert.equal(history[i].opp.currentHp,6000,'後續任何技能均吸取一次');
   assert.equal(history[4].opp.currentHp,9000,'含啟動當回合共4回合，第5回合不吸取');
   assert.ok(!history[4].logs.some((l:string)=>l.includes('效果待接通')));
  }
  delete h.S['每回合補滿受方'];
  for(const mode of ['immune','block','barrier','plain']){
   h.S['百分比判定受方']=(ctx:any,ev:string,data:any)=>{
    if(ev==='BEFORE_DAMAGE'&&data?.damageComp?.isIncoming&&data.damageComp.damageCategory==='percent'){
     if(mode==='immune')multiplyDamageReduction(data.damageComp,0);
    }
    if(ev==='ON_ENTRANCE'&&mode==='block')ctx.addTimerTo(ctx.actor,{id:'百分比抵擋',remaining:1,kind:'round_counter',source:'soulmark',tickAt:'never',payload:{block:{recordBlockedDamage:'測試抵擋量',kind:'百分比'}}},false);
    if(ev==='ON_ENTRANCE'&&mode==='barrier')ctx.updateElf(ctx.actor,{barrier:10000});
   };
   const [out]=await h.play(side,{self:h.unit('免疫判定持有者',9000,[skill('百法拜')],{speed:400}),opp:h.unit('百分比判定受方',9000,[h.wait()])});
   assert.equal(out.opp.currentHp,mode==='immune'?8700:mode==='block'||mode==='barrier'?9000:6000,mode+'僅百分比免疫追加300真傷，滿血吸取不另補');
  }
  delete h.S['百分比判定受方'];
  h.S['每回合補滿受方']=(ctx:any,ev:string)=>{if(ev==='ROUND_START')ctx.updateElf(ctx.actor,{currentHp:20000});};
  const history=await h.play(side,{self:h.unit('回應持有者',1000,[skill('十玄釋'),h.wait()],{maxHp:9000,speed:400}),opp:h.unit('每回合補滿受方',20000,[h.wait()]),turns:(_e:any,t:number)=>[t===1?0:1,0]},5);
  assert.equal(history[0].self.currentHp,4000);assert.equal(history[1].self.currentHp,7000);assert.equal(history[2].self.currentHp,9000);
  for(let i=0;i<4;i++)assert.equal(history[i].opp.currentHp,17000,'等量指自身最大體力1/3的計算恢復量，不受對手上限與自身滿血截斷影響');
  assert.equal(history[4].opp.currentHp,20000,'第5回合停止回應');delete h.S['每回合補滿受方'];
  const attack={...h.wait(),name:'對手實際攻擊',category:'物理',power:1};
  const [react]=await h.play(side,{self:h.unit('攻擊回應持有者',9000,[skill('十玄釋')],{speed:400}),opp:h.unit('攻擊回應受方',9000,[attack])});
  assert.ok(h.statuses(react.opp).includes('束縛'),'攻擊技能後施加束縛');
 }
 console.log('無為龍者：P1/P2百法拜首次/後續4回合吸取、半血界線及真正免疫補傷；十玄釋屬性回復與等量傷害、攻擊束縛及到期、Blockly通過');
}finally{await h.close();}
