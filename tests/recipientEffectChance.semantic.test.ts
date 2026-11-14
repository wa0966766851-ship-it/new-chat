import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {recipientEffectChance} from '../src/battle/recipientEffectChance';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
const mark=(more:any={})=>({op:'mark_program',p:{id:'chance:recipient',name:'受方機率保證',displayChar:'火',description:'敵方施加給持有者的機率效果必定通過機率判定',side:'self',mode:'set',count:1,maxCount:3,scope:'elf',persistsOffField:true,unit:'道',incomingEffectChanceGuaranteed:true,rules:[],...more}});
try{
 const skill=h.kitSkill('受方印記',[mark()]);
 assert.equal(sequenceIssue(skill.kit[0].params.clause),null);
 assert.ok(sequenceIssue(h.kitSkill('非法旗標',[mark({incomingEffectChanceGuaranteed:1})]).kit[0].params.clause));
 defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
 try{buildEntryBlock(w as any,skill.kit[0]);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],skill.kit[0].node,0),skill.kit[0]);}finally{w.dispose();r.dispose();}
 const holder:any={id:'H',battleId:'H'},m:any={id:'m',count:1,scope:'elf',ownerBattleId:'H',effects:{incomingEffectChanceGuaranteed:1}};
 const ctx:any={actor:'p1',targetSide:'p2',target:holder,getMarks:()=>[m]};
 for(const n of [0,1,50,99,100])assert.equal(recipientEffectChance(ctx,'p2',n),100);
 assert.equal(recipientEffectChance(ctx,'p1',25,holder),25,'不改敵方自己的機率');
 assert.equal(recipientEffectChance(ctx,'p2',25,{id:'B',battleId:'B'}),25,'不外溢給同側其他精靈');
 m.count=0;assert.equal(recipientEffectChance(ctx,'p2',25),25);m.count=1;
 const {ATOMS}=await h.server.ssrLoadModule('/src/effects/effectRunner.ts');
 let applied=0;
 ATOMS.apply_status({status:'燒傷',chance:0,turns:3},'opponent',{...ctx,applyStatusWithImmunityCheck:()=>{applied++;return {success:true};}});
 assert.equal(applied,1,'原子入口也使用受方機率政策');
 for(const side of ['p1','p2'] as const){
  const play=(attack:any,enabled=true,extra:any[]=[],more:any={})=>h.play(side,{self:h.unit('S',10000,[h.kitSkill('設置',[...(enabled?[mark(more)]:[]),...extra]),h.wait()],{speed:200}),opp:h.unit('E',10000,[h.wait(),attack]),turns:(_e,t)=>[t===1?0:1,t===1?0:1]},2);
  const bothStatus=h.kitSkill('雙方機率燒傷',[{op:'status',p:{side:'both',status:'燒傷',chance:0,turns:3}}]);
  const baseline=await play(bothStatus,false);assert.ok(!h.statuses(baseline[1].self).includes('燒傷'));
  const forced=await play(bothStatus);assert.ok(h.statuses(forced[1].self).includes('燒傷'),forced[1].logs.join('\n'));assert.ok(!h.statuses(forced[1].opp).includes('燒傷'),'敵方自身不因對手有印記而燒傷');
  const seq=await play(h.kitSkill('異常列表',[{op:'status_seq',p:{side:'opp',list:['燒傷'],chance:0,turns:3}}]));
  assert.ok(h.statuses(seq[1].self).includes('燒傷'));
  for(const chance of [1,50,99]){
   const p=await play(h.kitSkill('正常機率',[{op:'stat',p:{side:'opp',stats:['防禦'],v:-1,chance}}]));
   assert.equal(p[1].self.statStages.def,-1,`${side}/${chance}%必定通過機率判定`);
  }
  const stat=await play(h.kitSkill('雙方機率弱化',[{op:'stat',p:{side:'both',stats:['攻擊'],v:-1,chance:0}}]));
  assert.equal(stat[1].self.statStages.atk,-1);assert.equal(stat[1].opp.statStages.atk||0,0);
  const own=await play(h.kitSkill('敵方自我強化',[{op:'stat',p:{side:'self',stats:['攻擊'],v:1,chance:0}}]));
  assert.equal(own[1].opp.statStages.atk||0,0);
  const timed=await play(h.kitSkill('機率易傷',[{op:'dmg_mod_turns',p:{side:'opp',dir:'taken',kind:'非真實',boost:.5,turns:3,chance:0}}]));
  assert.ok(timed[1].state[`${side}Timers`].some((t:any)=>t.payload?.block?.dmgIn===.5),'回合類易傷的受方機率入口');
  const immune=await play(bothStatus,true,[{op:'immune_status_turns',p:{turns:4,cls:'非附屬類',reflect:false}}]);
  assert.ok(!h.statuses(immune[1].self).includes('燒傷'),'機率保證不繞過異常免疫');
  assert.ok(immune[1].state[`${side}Marks`].some((m:any)=>m.id==='chance:recipient'),'免疫測試必須確實持有機率保證印記');
  const expired=await play(bothStatus,true,[],{turns:1});
  assert.ok(!h.statuses(expired[1].self).includes('燒傷'),'印記到期後機率恢復');
  console.log(`✓ ${side} 受方機率保證：異常、列表、能力變化、雙方目標隔離及到期／免疫`);
 }
}finally{await h.close();}
