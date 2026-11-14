import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {IMMORTAL_AINS_ROYAL_FLAME as skill} from '../src/data/immortalAinsSkills';
import {sequenceIssue} from '../src/effects/sequenceContract';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';

const h=await createHarness();
try{
 h.assertKitOnly(skill);defineCustomBlocks();
 for(const e of skill.kit!){
  if(e.codeId==='effect_sequence')assert.equal(sequenceIssue(e.params.clause,e.node),null);
  const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{buildEntryBlock(w as any,e);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);assert.deepEqual(createKitBlockParser('skill')(r.getTopBlocks(false)[0],e.node,e.order),e);}finally{w.dispose();r.dispose();}
 }
 const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
 const {runSideTimers,evalCond}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
 const notUsed={c:'player_state',p:{key:'periodic',equals:true,thisRound:true,neg:true},label:'本回合未用'};
 const state:Record<string,any>={};const query={roundNumber:2,self:{},target:{},getPlayerState:(key:string)=>state[key]};
 assert.equal(evalCond(query,notUsed,{}),true,'沒有紀錄可觸發');
 state.periodic=true;state['periodic:round']=2;assert.equal(evalCond(query,notUsed,{}),false,'同回合重複通知不再觸發');
 state['periodic:round']=1;assert.equal(evalCond(query,notUsed,{}),true,'上回合紀錄不阻止新回合');
 for(const side of ['p1','p2'] as const){
  const hits:number[]=[];
  h.S.S=(ctx:any,event:any,data:any)=>{
   if(event===T.OPPONENT_DAMAGE&&data.damageType==='percent')hits.push(data.hpReduced);
   if(event===T.AFTER_ACTION){runSideTimers(ctx,['self_skill'],{skill:ctx.skill});runSideTimers(ctx,['self_skill'],{skill:ctx.skill});}
  };
  const poke=h.kitSkill('固定扣血',[{op:'dmg',p:{flat:1000,type:'真實'}}]);
  const result=await h.play(side,{self:h.unit('S',3000,[skill,h.wait()],{speed:200,maxHp:12000}),opp:h.unit('O',100000,[poke]),turns:(_e,t)=>[t===1?0:1,0]},6);
  assert.deepEqual(hits,[8000,2000,1000,1000,1000],'低血翻倍看恢復前；等量百分比按實際恢復；持續五回合');
  assert.equal(result[0].self.currentHp,10000);assert.equal(result[5].self.currentHp,10000,'第六回合不再恢復');
  for(const k of ['atk','def','spdef','speed','accuracy'])assert.equal(result[0].self.statStages[k],1,`${k}強化一級`);
  assert.equal(result[0].self.statStages.spatk||0,0,'不額外強化特攻');
  delete h.S.S;delete h.S.O;
  const markSoul={name:'測試秩序之火',effectMode:'kit',effectType:'custom',description:'測試初始化',kit:[{codeId:'effect_sequence',node:'battle_start',source:'soulmark',role:'innate',order:0,customText:'初始化',params:{clause:{raw:'初始化',trig:'battle_start',parsed:true,body:[{acts:[{op:'resource_mark_add',p:{side:'opp',scope:'elf',id:'orderFire',name:'秩序之火',amount:1,persistsOffField:true,unit:'道',displayChar:'火',description:'只用於測試條件，不附帶傷害與回復'},label:'秩序之火'}]}]}}}]};
  h.S.O=(_ctx:any,event:any,data:any)=>{const c=data?.damageComp||data;if(event===T.BEFORE_DAMAGE&&c.isIncoming&&c.damageCategory==='skill_attack')c.base=100;};
  const attack={...h.wait(),name:'測試攻擊',category:'物理',power:100};
  const marked=await h.play(side,{self:h.unit('S',12000,[skill,attack],{speed:200,extra:{soulMark:markSoul}}),opp:h.unit('O',100000,[{...h.wait(),priority:1}]),oppBench:[h.unit('B',100000,[h.wait()])],turns:(_e,t)=>[t===1?0:1,0]},4);
  for(const k of ['atk','def','spdef','speed','accuracy'])assert.equal(marked[0].self.statStages[k],2,`${k}秩序之火強化翻倍 ${JSON.stringify(marked[0].state[`${side==='p1'?'p2':'p1'}Marks`])} ${marked[0].logs.join('\n')}`);
  const other=side==='p1'?'p2':'p1';
  const locked=(i:number)=>marked[i].state[`${other}Timers`].filter((t:any)=>t.payload?.block?.lockSwitch);
  assert.equal(locked(0)[0]?.scope,'team','禁止對手全隊主動切換');
  assert.ok(locked(1).some((t:any)=>t.remaining>0),'下第一回合限制存在');
  assert.equal(locked(2).length,0,'下第二回合結束限制到期');
  const debuff=(i:number)=>marked[i].state[`${other}Timers`].filter((t:any)=>t.payload?.block?.dmgIn===1.5);
  assert.equal(debuff(0)[0]?.payload.block.kind,'技能','僅增加受到技能傷害');
  assert.equal(debuff(2).length,0,'技能易傷同時到期');
  assert.deepEqual(marked.map(r=>r.opp.currentHp),[100000,99750,99500,99400],'下兩回合技能傷害實際×2.5，之後回到100');
  const turnLogs=(i:number)=>marked[i].logs.slice(i?marked[i-1].logs.length:0).filter((l:string)=>l.includes('使用了'));
  assert.ok(turnLogs(1)[0].includes('S'),'下回合先制-2使原本+1的對手後手');
  assert.ok(turnLogs(3)[0].includes('O'),'先制減少到期，對手恢復先手');
  delete h.S.S;delete h.S.O;
  console.log(`✓ ${side} 不滅君焰：五項強化、低血翻倍、五回合實際恢復與等量百分比、秩序之火限制`);
 }
}finally{delete h.S.S;delete h.S.O;await h.close();}
