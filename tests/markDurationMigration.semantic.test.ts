import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {kitEntryIssue} from '../src/effects/effectConnection';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {readMarkRemainingTurns}=await h.server.ssrLoadModule('/src/effects/markQueries.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const registry=getBattleSkillRegistry(),name='聖武·虛極拓世',old=registry[name];let oldCalls=0;
registry[name]=()=>{oldCalls++;throw Error('不得重播舊專屬技能');};
const skill=()=>structuredClone(h.find('arena_14',name));
const a=(op:string,p:any)=>({op,p,label:op});
const attack={...h.wait(),name:'後續攻擊',category:'物理',power:100};
let markOptions:any={};
let statusProbe=false;
h.S.self=(ctx:any,event:any)=>{
  if(statusProbe&&event===T.ROUND_END)for(const status of ['燒傷','中毒','凍傷'])ctx.applyStatusWithImmunityCheck(ctx.actor,status,3);
};
h.S.foe=(ctx:any,event:any)=>{
  if(event===T.ON_ENTRANCE)ctx.setMark({id:'arena.weiyue',name:'威怯',count:markOptions.turns??3,unit:markOptions.unit??'回合',source:'測試',ownerBattleId:markOptions.owner??ctx.self.battleId,clearable:false},ctx.actor);
};
try{
  assert.equal(skill().effectMode,'kit');defineCustomBlocks();let edited:any;
  for(const entry of skill().kit){
    assert.equal(kitEntryIssue(entry),null);
    const w=new Blockly.Workspace(),copy=new Blockly.Workspace();
    try{
      const block=buildEntryBlock(w as any,entry)!;assert.ok(block);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
      assert.deepEqual(createKitBlockParser('skill')(copy.getBlockById(block.id)!,entry.node,entry.order),entry);
      if(entry.order===2){
        const b=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;
        const p=JSON.parse(b.getFieldValue('PARAMS'));p.turns=2;b.setFieldValue(JSON.stringify(p),'PARAMS');
        edited=createKitBlockParser('skill')(block,entry.node,entry.order);assert.equal(kitEntryIssue(edited),null);
      }
    }finally{w.dispose();copy.dispose();}
  }
  const invalid=skill().kit[2];
  for(const q of [{side:'both',id:'x'},{side:'opp',id:''},{side:'opp',id:'x',handler:'custom'},null]){
    const e=structuredClone(invalid);e.params.clause.body[0].acts[0].p.perMarkTurns=q;assert.ok(kitEntryIssue(e));
  }
  const ctx:any={actor:'p1',targetSide:'p2',self:{battleId:'s'},target:{battleId:'e'},getMarks:()=>[
    {id:'m',unit:'層',count:99,ownerBattleId:'e'},{id:'m',unit:'回合',count:8,ownerBattleId:'bench'},
    {id:'m',unit:'回合',count:3,ownerBattleId:'e'},{id:'m',unit:'回合',count:2,ownerBattleId:'e'}]};
  assert.equal(readMarkRemainingTurns(ctx,{side:'opp',id:'m'}),3,'只讀實際持有者回合期限；不加總重複期限或借用層數');
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    const run=async(s:any,o:any={})=>{
      markOptions=o.mark??{};
      return h.play(side,{self:h.unit('self',o.hp??10000,[s,h.wait(),attack],{maxHp:100000,speed:o.speed??200,extra:o.selfExtra}),
        opp:h.unit('foe',o.enemyHp??100000,[h.wait(),o.enemySkill??h.wait()],{maxHp:o.enemyMax??100000,speed:100,extra:o.enemyExtra}),
        oppBench:o.bench?[h.unit('reserve',100000,[h.wait()])]:[],
        turns:(e,t)=>o.turns?o.turns(e,t):[t===1?0:1,0]},o.rounds??1);
    };
    const hist=await run(skill(),{rounds:4});
    assert.ok(hist[0].logs.some((x:string)=>x.includes('必中致命一擊')),'先出手必定致命');
    assert.equal(hist[0].self.currentHp,43333,'未擊敗恢復實際附加的33333');
    assert.equal(hist[0].state[`${other}RegistryState`].attackSkillInvalidTurns,2);
    assert.equal(hist[0].state[`${other}RegistryState`].utilitySkillInvalidTurns,2);
    assert.equal(hist[3].state[`${other}RegistryState`].attackSkillInvalidTurns??0,0);checks++;
    console.log(`✓ ${side} 全文來源、先手致命、等量回血及3回合全技能無效到期`);
    for(const mark of [{turns:0},{turns:5,unit:'層'},{turns:5,owner:'bench'}]){
      const [r]=await run(skill(),{mark});
      assert.equal(r.state[`${other}RegistryState`].attackSkillInvalidTurns??0,0);checks++;
    }
    const changed=skill();changed.name='可改名期限技能';changed.kit[2]=edited;
    const [edit]=await run(changed,{mark:{turns:2}});
    assert.equal(edit.state[`${other}RegistryState`].attackSkillInvalidTurns,3);checks++;
    const noBoost=skill();noBoost.kit=noBoost.kit.filter((e:any)=>e.order!==3);
    const turns=(_:any,t:number):[number,number]=>[t===1?0:2,0];
    const boosted=await run(skill(),{rounds:3,turns}),base=await run(noBoost,{rounds:3,turns});
    const d=(r:any[],i:number)=>r[i-1].opp.currentHp-r[i].opp.currentHp;
    assert.ok(Math.abs(d(boosted,1)-2*d(base,1))<=1,'下回合攻擊翻倍');
    assert.equal(d(boosted,2),d(base,2),'第三回合增傷到期');checks++;
    const [slow]=await run(skill(),{speed:1});assert.ok(!slow.logs.some((x:string)=>x.includes('必中致命一擊')));checks++;
    const [sealed]=await run(skill(),{selfExtra:{isAdditionalInvalid:true}});
    assert.ok(sealed.logs.some((x:string)=>x.includes('必中致命一擊')),'附加失效不封鎖固有先手致命');
    assert.equal(sealed.self.currentHp,10000);assert.equal(sealed.state[`${other}RegistryState`].attackSkillInvalidTurns??0,0);checks++;
    const buff=h.kitSkill('對手提升',[a('stat',{side:'self',stats:['攻擊'],v:1})]);
    const invalidHistory=await run(skill(),{rounds:4,enemySkill:buff,turns:(_,t)=>[t===1?0:1,1]});
    assert.deepEqual(invalidHistory.map(r=>r.opp.statStages.atk??0),[0,0,0,1],'實際屬性技能僅前三回合無效');checks++;
    const [killed]=await run(skill(),{enemyHp:200,enemyMax:900,bench:true});
    assert.equal(killed.self.currentHp,10000,'擊敗不恢復');
    assert.equal(killed.state[`${side}RegistryState`].blkImmuneStatusCount,2,'擊敗授予兩次，並非兩回合');checks++;
    const [unselected]=await run(skill(),{enemyHp:1,enemyMax:900,bench:true,turns:()=>[2,0]});
    assert.equal(unselected.state[`${side}RegistryState`].blkImmuneStatusCount??0,0,'僅攜帶但未選用本技能不授予擊敗免疫');checks++;
    const [percentageKill]=await run({...skill(),power:0},{enemyHp:200,enemyMax:900,bench:true});
    assert.equal(percentageKill.self.currentHp,10000);
    assert.equal(percentageKill.state[`${side}RegistryState`].blkImmuneStatusCount,2,'附加傷害擊敗也須觸發正式擊敗事件');checks++;
    statusProbe=true;
    try{
      const [counted]=await run({...skill(),power:0},{enemyHp:200,enemyMax:900,bench:true});
      assert.equal(counted.state[`${side}RegistryState`].blkImmuneStatusCount,0);
      assert.ok(!h.statuses(counted.self).includes('燒傷'));assert.ok(!h.statuses(counted.self).includes('中毒'));
      assert.ok(h.statuses(counted.self).includes('凍傷'),'同回合第三次異常可生效，確為次數免疫');checks++;
    }finally{statusProbe=false;}
    const capped=h.kitSkill('百分比減半',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:.5})]).kit[0];
    capped.node='before_damage';capped.role='innate';capped.params.clause.trig='incoming';
    assert.equal(kitEntryIssue(capped),null);
    const [reduced]=await run(skill(),{enemyExtra:{trait:{name:'百分比減半',description:'',effectMode:'kit',kit:[capped]}}});
    assert.equal(reduced.self.currentHp,26666,'回血只取實際附加16666');checks++;
  }
  assert.equal(oldCalls,0);console.log(`markDurationMigration: ${checks} P1/P2情境及Blockly/拒絕合約通過`);
}finally{registry[name]=old;delete h.S.foe;delete h.S.self;await h.close();}
