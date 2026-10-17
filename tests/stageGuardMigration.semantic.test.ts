import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {validateKit} from '../src/effects/kitValidation';
import {kitEntryIssue} from '../src/effects/effectConnection';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
try{
  const original=structuredClone(h.find('arena_15','日月安屬'));assert.equal(original.effectMode,'kit');validateKit(original.kit);
  for(const p of [{kind:'all',turns:3},{kind:'down',turns:0},{kind:'up',turns:1.5},{kind:'up',turns:3,handler:'elf'}]){
    const bad=structuredClone(original.kit[3]);bad.params.clause.body[0].acts[0].p=p;assert.throws(()=>validateKit([bad]),/圖紙格式錯誤/);
  }
  defineCustomBlocks();let edited:any;
  for(const entry of original.kit){
    assert.equal(kitEntryIssue(entry),null);const w=new Blockly.Workspace(),copy=new Blockly.Workspace();
    try{const b=buildEntryBlock(w as any,entry)!;assert.ok(b);Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
      assert.deepEqual(createKitBlockParser('skill')(copy.getBlockById(b.id)!,entry.node,entry.order),entry);
      if(entry===original.kit[4]){const action=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;const p=JSON.parse(action.getFieldValue('PARAMS'));p.turns=1;action.setFieldValue(JSON.stringify(p),'PARAMS');edited=createKitBlockParser('skill')(b,entry.node,entry.order);validateKit([edited]);}
    }finally{w.dispose();copy.dispose();}
  }
  const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts'),R=getBattleSkillRegistry(),old=R[original.name];let oldCalls=0;
  R[original.name]=()=>{oldCalls++;throw Error('舊日月技能不可重播');};
  const prd=await h.server.ssrLoadModule('/src/utils/prd.ts');
  const a=(op:string,p:any)=>({op,p});
  const clear=h.kitSkill('消除雙向等級',[a('stat_clear',{side:'opp',kind:'all'})]);
  try{for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    const play=async(enemy:any,options:any={})=>h.play(side,{self:h.unit('holder',10000,[options.skill||original,h.wait(),...(options.ownSkills||[])],{speed:200,statStages:{atk:2,def:-2}}),
      selfBench:options.bench,opp:h.unit('foe',100000,enemy),turns:(_e:any,t:number)=>{prd.resetPrd(()=>options.roll??.999999);return options.pick?.(t)||[t===1?0:1,0];}},options.turns||1);
    const protectedHistory=await play([clear],{turns:4});
    for(const r of protectedHistory.slice(0,3)){assert.equal(r.self.statStages.atk,2);assert.equal(r.self.statStages.def,-2);}
    assert.equal(protectedHistory[3].self.statStages.atk,0);assert.equal(protectedHistory[3].self.statStages.def,0);checks++;
    const [stolen]=await play([h.kitSkill('吸取',[a('stat_steal',{mode:'吸取'})])]);
    assert.equal(stolen.self.statStages.atk,2);assert.ok(!stolen.opp.statStages.atk);checks++;
    const legacySteal={...structuredClone(h.find('arena_15','陰陽三合')),effectMode:'auto',kit:undefined};
    const legacy=await play([h.wait(),legacySteal],{turns:2,pick:(t:number)=>[t===1?0:1,t===1?0:1]});
    assert.equal(legacy[1].self.statStages.atk,2);assert.ok(!legacy[1].opp.statStages.atk,'舊競技場吸取共用入口也讀操作保護');checks++;
    const legacyReverse={...structuredClone(h.find('arena_15','九轉輪迴天')),effectMode:'auto',kit:undefined};
    const ownLegacy=await play([h.wait()],{ownSkills:[legacyReverse],turns:2,pick:(t:number)=>[t===1?0:2,0]});
    assert.equal(ownLegacy[1].self.statStages.def,-2,'舊競技場反轉共用入口也讀下降保護');checks++;
    const [copied]=await play([h.kitSkill('複製',[a('stat_steal',{mode:'複製'})])]);assert.equal(copied.self.statStages.atk,2);assert.equal(copied.opp.statStages.atk,2,'防吸取不禁止複製');checks++;
    const [reversed]=await play([h.kitSkill('反轉所有等級',[a('stat_reverse',{side:'opp',kind:'all'})])]);assert.equal(reversed.self.statStages.atk,-2,'提升保護未包含反轉');assert.equal(reversed.self.statStages.def,-2,'下降保護明確阻止反轉');checks++;
    const [normal]=await play([h.kitSkill('正常能力變化',[a('stat',{side:'opp',stats:['攻擊','防禦'],v:-1})])]);
    assert.equal(normal.self.statStages.atk,1,'保護消除不是免疫普通弱化');assert.equal(normal.self.statStages.def,-3);checks++;
    const selfActions=await play([h.wait()],{ownSkills:[h.kitSkill('解除下降',[a('stat_clear',{side:'self',kind:'down'})]),h.kitSkill('反轉下降',[a('stat_reverse',{side:'self',kind:'down'})])],
      turns:4,pick:(t:number)=>[t===1?0:t===2?2:3,0]});
    assert.equal(selfActions[1].self.statStages.def,-2);assert.equal(selfActions[2].self.statStages.def,-2);assert.equal(selfActions[3].self.statStages.def,2);checks++;
    const [cleared]=await play([h.kitSkill('消回合後清等級',[a('clear_turn',{side:'opp'}),a('stat_clear',{side:'opp',kind:'all'})])]);
    assert.equal(cleared.self.statStages.atk,0);assert.equal(cleared.self.statStages.def,0);checks++;
    const renamed=structuredClone(original);renamed.name='改名保護';renamed.kit[4]=edited;
    const editedHistory=await play([clear],{skill:renamed,turns:2});
    assert.equal(editedHistory[0].self.statStages.def,-2);assert.equal(editedHistory[1].self.statStages.def,0);assert.equal(editedHistory[1].self.statStages.atk,2);checks++;
    const [,...switched]=await play([clear],{turns:2,bench:[h.unit('receiver',10000,[h.wait()],{statStages:{atk:3,def:-3}})],pick:(t:number)=>t===1?[0,0]:[{switch:1},0]});
    assert.equal(switched[0].self.id,'receiver');assert.equal(switched[0].self.statStages.atk,0);assert.equal(switched[0].self.statStages.def,0);checks++;
    const attack={...h.wait(),name:'普通攻擊',category:'物理',power:100};
    const noCounter=structuredClone(original);noCounter.kit[2].params.clause.body.pop();
    const full=await play([attack],{turns:2}),base=await play([attack],{skill:noCounter,turns:2});
    const amount=10000-base[0].self.currentHp;assert.ok(amount>0);
    assert.equal(full[0].self.currentHp,10000);assert.equal(base[0].opp.currentHp-full[0].opp.currentHp,amount,'抵擋後以實際抵擋量100%附加百分比傷害');
    assert.equal(full[1].self.currentHp,10000-(base[0].self.currentHp-base[1].self.currentHp),'第二次攻擊不再抵擋；逐回合公式亂數取同回合基準');assert.equal(full[1].opp.currentHp,full[0].opp.currentHp);checks++;
    const fixedAttack=[h.kitSkill('固定傷害',[a('dmg',{flat:100,type:'固定'})]),attack];
    const picks={turns:3,pick:(t:number)=>[t===1?0:1,t===1?0:1]};
    const mixed=await play(fixedAttack,picks),mixedBase=await play(fixedAttack,{...picks,skill:noCounter});
    assert.equal(mixed[0].self.currentHp,9900,'固定傷害不被攻擊抵擋攔截');assert.equal(mixed[1].self.currentHp,9900,'固定傷害不消耗攻擊抵擋次數');
    assert.equal(mixedBase[1].opp.currentHp-mixed[1].opp.currentHp,mixedBase[0].self.currentHp-mixedBase[1].self.currentHp);
    assert.ok(mixed[2].self.currentHp<9900,'抵擋已消耗，第三回合攻擊照常扣血');checks++;
    const [silenced]=await play([h.wait()],{roll:0});assert.ok(h.statuses(silenced.opp).includes('沉默'));assert.equal(silenced.opp.currentHp,87500,'沉默每回合最大體力1/8百分比傷害');
    assert.ok(!silenced.state[`${side}Timers`].some((t:any)=>t.remaining>0&&t.payload?.block?.recordBlockedDamage));checks++;
    const fifth=h.kitSkill('第五技能',[a('dmg',{flat:500,type:'真實'})],{isFifthSkill:true});
    const [fifthStopped]=await play([fifth],{roll:0});assert.equal(fifthStopped.self.currentHp,10000,'沉默真正封鎖第五技能');checks++;
    const inflict=h.kitSkill('中毒',[a('status',{side:'opp',status:'中毒',chance:100,turns:3})]);
    const reflected=await play([inflict],{turns:5,roll:.999999});
    for(const r of reflected.slice(0,4))assert.ok(!h.statuses(r.self).includes('中毒'));
    assert.ok(h.statuses(reflected[0].opp).includes('中毒'),'反彈異常給攻擊者');assert.ok(h.statuses(reflected[4].self).includes('中毒'),'4回合後免疫反彈自然到期');checks++;
    assert.ok(!full.some(r=>r.logs.some((x:string)=>x.includes('效果待接通'))));
    console.log(`✓ ${side} 日月安屬操作保護/期限/改值/換人/反擊/沉默/免疫反彈`);
  }assert.equal(oldCalls,0);}finally{R[original.name]=old;}
  console.log(`${checks} 正式雙側日月安屬情境通過，含Blockly往返與舊handler探針`);
}finally{await h.close();}
