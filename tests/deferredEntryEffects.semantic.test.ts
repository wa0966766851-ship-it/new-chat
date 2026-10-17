import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {sequenceIssue} from '../src/effects/sequenceContract';
import {validateKit} from '../src/effects/kitValidation';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
import {withRecoveryOrigin} from '../src/battle/recoveryOrigin';
const a=(op:string,p:any)=>({op,p,label:op});
const entry=(ratio=.5)=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node:'on_switch_out',order:0,customText:'換人後交付',
  params:{clause:{raw:'換人後交付',trig:'switch_out',parsed:true,body:[{acts:[a('next_ally_entry',{resource:'maxHp',ratio,excludeSource:true,label:'可改名的交付',
    body:[{acts:[a('shield_from_last',{ratio:1}),a('immune_status_turns',{turns:2,reflect:false})]}]})]}]}}});
const h=await createHarness();let checks=0;
try{
  assert.equal(sequenceIssue(entry().params.clause,'on_switch_out'),null);validateKit([entry()]);
  for(const patch of [{resource:'arbitraryKey'},{ratio:0},{excludeSource:'yes'},{body:[{acts:[a('custom',{handler:'elf'})]}]}]){
    const e=entry();Object.assign(e.params.clause.body[0].acts[0].p,patch);assert.ok(sequenceIssue(e.params.clause,'on_switch_out'));
  }
  const bad=entry();bad.params.clause.body[0].acts[0].p.body[0].acts=[a('status',{side:'self',status:'未登記異常XYZ',chance:100,turns:1})];
  assert.throws(()=>validateKit([bad]),/尚未登記/);
  const calls:any[]=[];const ctx:any={actor:'p1',self:{id:'receiver'},effectSource:{kind:'skill',sourceSide:'p1',sourceBattleId:'source'},
    applyHeal:(...args:any[])=>calls.push(args),applyStatusWithImmunityCheck:()=>{},setPlayerState:()=>{}};
  withRecoveryOrigin(ctx,'skill').applyHeal('p1',100);
  assert.equal(calls[0][2].recoveryOrigin.sourceBattleId,'source','交付的回復不是接收者自己的技能');
  defineCustomBlocks();const w=new Blockly.Workspace(),copy=new Blockly.Workspace();let edited:any;
  try{
    const block=buildEntryBlock(w as any,entry() as any)!;assert.ok(block);
    const action=w.getAllBlocks(false).find(b=>b.type==='sequence_action')!;
    const p=JSON.parse(action.getFieldValue('PARAMS'));p.ratio=.25;action.setFieldValue(JSON.stringify(p),'PARAMS');
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
    edited=createKitBlockParser('soulmark')(copy.getBlockById(block.id)!,'on_switch_out',0)!;
    assert.deepEqual(edited,entry(.25));
  }finally{w.dispose();copy.dispose();}
  for(const side of ['p1','p2'] as const)for(const ratio of [.5,.25]){
    const source=h.unit('source',8000,[h.wait()],{extra:{soulMark:{name:'改名魂印',description:'換人後交付',effectMode:'kit',kit:[ratio===.25?edited:entry()]}}});
    const receiver=h.unit('receiver',20000,[h.wait()]);
    const other=side==='p1'?'p2':'p1';
    const results=await h.play(side,{self:source,selfBench:[receiver],opp:h.unit('foe',10000,[h.wait()]),
      turns:(_e:any,t:number)=>t===1?[{switch:1},0]:t===2?[{switch:0},0]:[{switch:1},0]},3);
    assert.equal(results[0].self.id,'receiver');
    assert.equal(results[0].self.shield,8000*ratio,'取來源maxHp快照，不用接收者maxHp');
    assert.equal(results[0].opp.shield||0,0,'敵方不領取');
    assert.ok(!(results[0].state[`${side}RegistryState`].nextElfBlockPrograms||[]).length,'交付前消費佇列');
    assert.equal(results[2].self.shield,8000*ratio*2,'第二次來源換出只新增一次，不重領舊資料');
    assert.equal(results[2].state[`${other}Team`][0].shield||0,0);
    checks++;console.log(`✓ ${side} 下一隊友領取來源快照${ratio}、隔離敵方、舊交付不重播`);
  }
  for(const side of ['p1','p2'] as const){
    const handoff=h.kitSkill('改名技能交付',[a('next_ally_entry',{resource:'none',ratio:1,excludeSource:true,
      body:[{acts:[a('timed',{turns:2,trig:'round_end',body:[{acts:[a('heal_flat',{amount:100})]}]})]}]})]);
    validateKit(handoff.kit);
    const lock=h.kitSkill('禁止自身技能回血',[a('no_heal',{turns:2,scope:'own_skill'})]);
    const results=await h.play(side,{self:h.unit('giver',1000,[handoff]),selfBench:[h.unit('receiver',500,[h.healSkill(50)],{maxHp:2000})],
      opp:h.unit('foe',10000,[h.wait(),lock]),turns:(_engine:any,t:number)=>t===1?[0,0]:t===2?[{switch:1},1]:[0,0]},3);
    assert.equal(results[1].self.currentHp,600,'隊友技能的回合回血不誤認為接收者自身技能');
    assert.equal(results[2].self.currentHp,700,'自身技能回血仍被封，交付計時器保留原施加者');
    checks++;console.log(`✓ ${side} 技能交付計時器保留來源，與接收者自身技能禁療分開`);
  }
  for(const side of ['p1','p2'] as const){
    const death=entry();death.node='cthyaat_death';death.params.clause.trig='defeated';
    validateKit([death]);assert.equal(sequenceIssue(death.params.clause,'cthyaat_death'),null);
    const source=h.unit('fallen',1000,[h.wait()],{extra:{soulMark:{name:'改名交付魂印',description:'戰敗後交付',effectMode:'kit',kit:[death]}}});
    const killer=h.kitSkill('確定傷害',[{op:'dmg',p:{flat:1000,type:'真實'}}]);
    const results=await h.play(side,{self:source,selfBench:[h.unit('successor',9000,[h.wait()])],opp:h.unit('foe',10000,[killer,h.wait()]),
      turns:async(engine:any,t:number)=>{
        if(t===1)return [0,0];
        assert.match(engine.getState().phase,/forced_switch/,'戰敗後由正式強制換人入口接續');
        engine.onSwitchElf(side,1);await engine.idle();
        assert.equal(engine.getState()[side].shield,500,'死亡交付保留來源最大體力快照');
        return [0,1];
      }},2);
    assert.equal(results[1].self.id,'successor');assert.equal(results[1].self.shield,500);
    assert.equal(results[1].opp.shield||0,0);assert.equal(results[1].state[`${side}RegistryState`].nextElfBlockPrograms.length,0);
    checks++;console.log(`✓ ${side} 戰敗後強制換人交付一次，隔離敵方`);
  }
  console.log(`${checks} 正式雙側隊友交付情境通過，含可編輯保存重載；不授予盾魂印全文驗收`);
}finally{await h.close();}
