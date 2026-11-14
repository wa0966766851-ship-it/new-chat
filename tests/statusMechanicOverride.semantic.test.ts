import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_FLAME_LIFECYCLE_KIT,IMMORTAL_AINS_FLAME_STATUS_KIT,IMMORTAL_FLAME_SACRIFICED} from '../src/data/immortalAinsFlameKit';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 defineCustomBlocks();
 for(const entry of IMMORTAL_AINS_FLAME_STATUS_KIT){
  assert.equal(sequenceIssue(entry.params.clause,entry.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,entry);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('soulmark')(r.getTopBlocks(false)[0],entry.node,entry.order),entry);}finally{w.dispose();r.dispose();}
 }
 const override={op:'status_mechanic_override',p:{statuses:['燒傷'],skipDamage:true,powerMultiplier:1.5},label:'替換'};
 for(const patch of [{statuses:[]},{statuses:['不存在']},{skipDamage:1},{powerMultiplier:NaN},{powerMultiplier:-1}]){
  assert.ok(sequenceIssue({raw:'非法參數',trig:'status_mechanic',parsed:true,body:[{acts:[{...override,p:{...override.p,...patch}}]}]}));
 }
 assert.ok(sequenceIssue({raw:'錯誤事件',trig:'use',parsed:true,body:[{acts:[override]}]}));
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 for(const side of ['p1','p2'] as const){
  async function play(mode:'none'|'alive'|'sacrificed'|'dead'|'personal',holderIsSource=false,otherStatus=false){
   const powers:number[]=[];
   h.S.O=(_ctx:any,event:any,data:any)=>{if(event===T.MODIFY_POWER&&data.isIncoming&&data.skill?.category==='物理')powers.push(data.powerComp.power);};
   const entries=mode==='alive'||mode==='dead'?[...IMMORTAL_AINS_FLAME_LIFECYCLE_KIT.filter(e=>e.node==='battle_start'),...IMMORTAL_AINS_FLAME_STATUS_KIT]:mode==='sacrificed'?[...IMMORTAL_AINS_FLAME_STATUS_KIT,{
    codeId:'effect_sequence',source:'soulmark',role:'innate',node:'battle_start',order:0,customText:'測試：已犧牲',params:{clause:{raw:'測試：已犧牲',trig:'battle_start',parsed:true,body:[{acts:[{op:'flag_set',p:{key:IMMORTAL_FLAME_SACRIFICED,value:true},label:'已犧牲'}]}]}},
   }]:[];
   if(mode==='dead')entries.push({codeId:'effect_sequence',source:'soulmark',role:'innate',node:'battle_start',order:1,customText:'測試：神焰被擊殺',params:{clause:{raw:'測試：神焰被擊殺',trig:'battle_start',parsed:true,body:[{acts:[{op:'kill_owned_extra',p:{id:'x_immortal_flame'},label:'神焰被擊殺'}]}]}}} as any);
   if(mode==='personal')entries.push({codeId:'effect_sequence',source:'soulmark',role:'innate',node:'modify_status_mechanic',order:0,customText:'測試：持有者替換',params:{clause:{raw:'測試：持有者替換',trig:'status_mechanic',parsed:true,body:[{acts:[override]}]}}} as any);
   const prep=h.kitSkill('正式附加三回合燒傷',[{op:'status',p:{side:'self',status:'燒傷',chance:100,turns:3}},...(otherStatus?[{op:'status',p:{side:'self',status:'中毒',chance:100,turns:3}}]:[])]);
   const attack={...h.wait(),name:'威力100',category:'物理',power:100,isSureHit:true};
   const source=h.unit('S',10000,holderIsSource?[prep,attack,h.wait()]:[h.wait()],{speed:200,extra:{soulMark:{name:'神焰燒傷效果',description:'正式積木片段',effectMode:'kit',effectType:'custom',kit:entries}}});
   const holder=holderIsSource?source:h.unit('H',10000,[prep,attack,h.wait()],{speed:200});
   const result=await h.play(side,{self:holder,selfBench:holderIsSource?[]:[source],opp:h.unit('O',100000,[h.wait()]),turns:(_e,t)=>[t===1?0:t===2?1:2,0]},3);
   assert.equal(powers.length,1,result[1].logs.join('\n'));
   assert.ok(!h.statuses(result[2].self).includes('燒傷'),'替換效果不可凍結燒傷期限');
   return {result,power:powers[0]};
  }
  const normal=await play('none');assert.equal(normal.power,50,'原燒傷威力減半');assert.equal(normal.result[1].self.currentHp,7500,'原燒傷每次對手出手扣1250，兩次共2500');
  const ally=await play('alive');assert.equal(ally.power,150,'神焰存活時後排來源替隊友改為威力提升50%');assert.equal(ally.result[1].self.currentHp,10000,'替換燒傷不再承受原扣血');
  const owner=await play('alive',true);assert.equal(owner.power,150);assert.equal(owner.result[1].self.currentHp,10000);
  const personal=await play('personal',true);assert.equal(personal.power,150);assert.equal(personal.result[1].self.currentHp,10000,'持有者正式事件也能直接替換');
  const afterOwner=await play('sacrificed',true);assert.equal(afterOwner.power,150);assert.equal(afterOwner.result[1].self.currentHp,10000,'犧牲後原召喚者保留替換');
  const afterAlly=await play('sacrificed');assert.equal(afterAlly.power,50);assert.ok(afterAlly.result[1].self.currentHp<10000,'犧牲後隊友恢復原燒傷效果');
  const dead=await play('dead');assert.equal(dead.power,50);assert.ok(dead.result[1].self.currentHp<10000,'神焰被擊殺不能留下快取光環');
  const poisoned=await play('alive',false,true);assert.equal(poisoned.power,150);assert.equal(poisoned.result[1].self.currentHp,7500,'只保留中毒的兩次1250扣血');
  console.log(`✓ ${side} 燒傷扣血與威力替換、後排光環、犧牲後範圍、死亡失效及正常到期`);
 }
}finally{delete h.S.O;await h.close();}
