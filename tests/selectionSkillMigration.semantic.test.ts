import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
import {kitEntryIssue} from '../src/effects/effectConnection';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
const {isZeroPpExempt,isPpCostFree}=await h.server.ssrLoadModule('/src/battle/ppExemptions.ts');
const {skillSelectable}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const registry=getBattleSkillRegistry(),name='烈武天徵',old=registry[name];let oldCalls=0;
registry[name]=()=>{oldCalls++;throw Error('舊技能不應重播');};
let hero=3,owner:string|undefined,selected=0,sourceCtx:any;
const mark=(ctx:any,count:number)=>ctx.setMark({id:'arena.heroGlory',name:'英雄之耀',count,unit:'層',source:'測試',clearable:false,ownerBattleId:owner??ctx.self.battleId},ctx.actor);
h.S.holder=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE){sourceCtx=ctx;mark(ctx,hero);}if(event===T.SKILL_SELECTED)selected++;};
const skill=()=>structuredClone(h.find('arena_14',name));
try{
  const original=skill();assert.equal(original.effectMode,'kit');defineCustomBlocks();let edited:any;
  for(const entry of original.kit){
    assert.equal(kitEntryIssue(entry),null);
    const w=new Blockly.Workspace(),copy=new Blockly.Workspace();
    try{
      const b=buildEntryBlock(w as any,entry)!;assert.ok(b);
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),copy);
      assert.deepEqual(createKitBlockParser('skill')(copy.getBlockById(b.id)!,entry.node,entry.order),entry);
      if(entry.order===1){const cond=JSON.parse(b.getFieldValue('CONDITIONS'));cond[0].p.amount=2;b.setFieldValue(JSON.stringify(cond),'CONDITIONS');edited=createKitBlockParser('skill')(b,entry.node,entry.order);assert.equal(kitEntryIssue(edited),null);}
    }finally{w.dispose();copy.dispose();}
  }
  for(const params of [{...original.kit[1].params,value:false},{...original.kit[1].params,handler:'custom'},
    {...original.kit[1].params,conditions:[{c:'mark_count',p:{side:'both',id:'x',op:'高於',amount:2}}]},
    {...original.kit[1].params,conditions:[{c:'kill',p:{}}]}])assert.ok(kitEntryIssue({...original.kit[1],params}));
  for(const side of ['p1','p2'] as const){
    const other=side==='p1'?'p2':'p1';
    for(const layers of [2,3]){
      hero=layers;owner=undefined;selected=0;
      const prior=h.kitSkill('舊回合效果',[{op:'dmg_mod_turns',p:{dir:'out',kind:'攻擊',boost:.1,turns:4}}]);
      const self=h.unit('holder',10000,[prior,{...skill(),pp:0},h.wait()],{speed:200});
      const foe=h.unit('foe',10000,[h.wait()]);
      const engine=createBattleEngine({initialP1Team:[side==='p1'?self:foe],initialP2Team:[side==='p2'?self:foe],p1StarterId:side==='p1'?'holder':'foe',p2StarterId:side==='p2'?'holder':'foe',battleMode:'PVP',preparedTeams:true,isFast:()=>true});
      engine.mount();engine.start();
      try{
        await engine.idle();
        for(const s of ['p1','p2'])engine.onSkillSelect(s,engine.getState()[s].skills[0]);
        await engine.idle();
        let st=engine.getState();assert.ok(st[`${side}Timers`].some((t:any)=>t.kind==='turn_effect'));
        assert.equal(isZeroPpExempt(st[side],st[side].skills[1],st[other]),layers===3);
        assert.equal(isPpCostFree(st[side],st[side].skills[1],st[other]),false,'不受PP限制不等於免費扣費');
        assert.equal(skillSelectable(st,side,st[side],1),layers===3);checks++;
        if(layers===3)sourceCtx.applyStatusWithImmunityCheck(side,'害怕',2);
        if(side==='p2')engine.onSkillSelect('p1',st.p1.skills[0]);
        const before=selected;engine.onSkillSelect(side,engine.getState()[side].skills[1]);st=engine.getState();
        if(layers===2){
          assert.equal(selected,before,'非法零PP選招不能發事件');assert.ok(st[`${side}Timers`].some((t:any)=>t.kind==='turn_effect'));
          mark(sourceCtx,3);assert.equal(isZeroPpExempt(engine.getState()[side],st[side].skills[1],st[other]),true,'印記變動當下可選');
          engine.onSkillSelect(side,engine.getState()[side].skills[1]);st=engine.getState();
        }
        assert.equal(selected,before+1);
        assert.ok(!st[`${side}Timers`].some((t:any)=>t.kind==='turn_effect'),'另一方尚未出手，選招就已清除');
        engine.onSkillSelect(side,st[side].skills[1]);assert.equal(selected,before+1,'重複提交不重播');checks++;
        if(side==='p1')engine.onSkillSelect('p2',st.p2.skills[0]);await engine.idle();
        st=engine.getState();assert.equal(st[side].skills[1].pp,0,'0PP使用不製造額外PP');assert.equal(st[side].statStages.atk??0,layers===3?0:2,'受控不能出手仍先執行選招清除');
        if(layers===2)assert.ok(st[`${side}RegistryState`].reflectStatusTurns>0);checks++;
        mark(sourceCtx,2);st=engine.getState();assert.equal(isZeroPpExempt(st[side],st[side].skills[1],st[other]),false,'降回2層後不留永久豁免');checks++;
      }finally{engine.unmount();}
    }
    for(const hp of [5000,5001]){
      hero=3;
      const [r]=await h.play(side,{self:h.unit('holder',hp,[skill()],{maxHp:10000}),opp:h.unit('foe',10000,[h.wait()])});
      for(const stat of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(r.self.statStages[stat],hp===5000?1:2);checks++;
    }
    const change=skill();change.name='可編輯PP條件';change.kit[1]=edited;hero=2;
    const [r]=await h.play(side,{self:h.unit('holder',10000,[{...change,pp:0}]),opp:h.unit('foe',10000,[h.wait()])});
    assert.equal(r.self.statStages.atk,2);checks++;
    hero=3;
    const poison=h.kitSkill('附加中毒',[{op:'status',p:{side:'opp',status:'中毒',chance:100,turns:3}}]);
    const guarded=await h.play(side,{self:h.unit('holder',100000,[skill(),h.wait()],{speed:200}),opp:h.unit('foe',100000,[poison]),turns:(_,t)=>[t===1?0:1,0]},5);
    for(const result of guarded.slice(0,4))assert.ok(!h.statuses(result.self).includes('中毒'));
    assert.ok(h.statuses(guarded[0].opp).includes('中毒'));assert.ok(h.statuses(guarded[4].self).includes('中毒'));checks++;
    const first=await h.play(side,{self:h.unit('holder',10000,[skill(),h.wait()],{speed:200}),opp:h.unit('foe',10000,[{...h.wait(),name:'對手先制一',priority:1}]),turns:(_,t)=>[t===1?0:1,0]},4);
    const firstNames=first.map((r,i)=>r.logs.slice(i?first[i-1].logs.length:0).find((x:string)=>x.includes('使用了')));
    assert.ok(firstNames[0].includes('對手先制一'));assert.ok(firstNames[1].includes('等待'));assert.ok(firstNames[2].includes('等待'));assert.ok(firstNames[3].includes('對手先制一'));checks++;
    hero=3;owner='bench';
    const probe=h.unit('holder',10000,[{...skill(),pp:0}],{extra:{marks:[{id:'arena.heroGlory',count:3,ownerBattleId:'bench'}]}});
    assert.equal(isZeroPpExempt(probe,probe.skills[0]),false);probe.marks[0].ownerBattleId='holder';probe.isInherentInvalid=true;
    assert.equal(isZeroPpExempt(probe,probe.skills[0]),false,'固有失效不能PP豁免');checks++;
    owner=undefined;
  }
  assert.equal(oldCalls,0);console.log(`selectionSkillMigration: ${checks} P1/P2情境及Blockly/嚴格合約通過`);
}finally{registry[name]=old;delete h.S.holder;await h.close();}
