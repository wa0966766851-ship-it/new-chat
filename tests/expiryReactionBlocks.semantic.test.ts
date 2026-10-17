import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const monitor=(trig='turn_effects_cleared',turns=3,from='now')=>h.kitSkill('期限監控',[{op:'timed',p:{turns,from,trig,once:true,
  body:[{acts:[{op:'stat',p:{side:'self',stats:['攻擊'],v:1,chance:100}}]}],
  onExpire:[{acts:[{op:'no_switch',p:{turns:2,next:true}}]}]}}]);
const noSwitch=(r:any,side:string)=>Number(r.state[`${side}RegistryState`]?.noSwitchTurns||0);
try{
  await check('不同到期分支／一次性監控不覆寫彼此，同程式改顯示名稱仍刷新',async()=>{
    const {timerProgramIdentity}=await h.server.ssrLoadModule('/src/blocks/timerProgramIdentity.ts');
    const body=[{acts:[{op:'heal_flat',p:{amount:1},label:'回復'}]}];
    const first={body,once:true,expireBody:[{acts:[{op:'no_switch',p:{turns:2,next:true}}]}]};
    const second=structuredClone(first);second.expireBody[0].acts[0].p.turns=1;
    assert.notEqual(timerProgramIdentity(first),timerProgramIdentity(second));assert.notEqual(timerProgramIdentity({body}),timerProgramIdentity({body,once:true}));
    const renamed=structuredClone(first);renamed.body[0].acts[0].label='顯示';assert.equal(timerProgramIdentity(first),timerProgramIdentity(renamed));
    assert.equal(timerProgramIdentity({body}),`|program=${JSON.stringify([{acts:[{op:'heal_flat',p:{amount:1}}]}])}`);
  });
  await check('一次性監控期限／到期分支嚴格合約，禁止初次立即觸發混用',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    const c=monitor().kit[0].params.clause;assert.equal(sequenceIssue(c),null);
    for(const change of [{once:false},{initial:true,trig:'self_skill'},{onExpire:[{acts:[{op:'unknown',p:{}}]}]}]){
      const bad=structuredClone(c);Object.assign(bad.body[0].acts[0].p,change);assert.ok(sequenceIssue(bad));
    }
  });
  await check('既有狀態延長保留堆疊與來源；缺少時使用正式免疫管道',async()=>{
    const {applyOrExtendStatus,statusDurationSum}=await h.server.ssrLoadModule('/src/effects/statusCollection.ts');
    const {getStatuses}=await h.server.ssrLoadModule('/src/utils/battleHelpers.ts');
    const elf:any={effects:[{id:'星贖',name:'星贖',duration:5,stacks:3,sourceBattleId:'origin'}],battleStatuses:{星贖:5}};
    let patch:any,calls=0;const ctx:any={getStatuses,updateElf:(_:any,p:any)=>{patch=p;},applyStatusWithImmunityCheck:()=>{calls++;return {success:false};}};
    assert.equal(applyOrExtendStatus(ctx,'p1',elf,'星贖',3,2),true);assert.equal(patch.battleStatuses.星贖,7);
    assert.deepEqual(patch.effects[0],{...elf.effects[0],duration:7});assert.equal(calls,0);
    assert.equal(applyOrExtendStatus(ctx,'p1',{effects:[]},'星贖',3,2),false);assert.equal(calls,1);
    assert.equal(statusDurationSum(ctx,[elf,{battleStatuses:{星哲:3}}]),8);
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 3回合未觸發，到期才限制對手下2回合；不提前且不延長`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[monitor(),h.wait()]),opp:h.unit('E',50000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(history.map(r=>noSwitch(r,other)),[0,0,2,1,0],history.map(r=>r.logs.join('\n')).join('\n'));
    });
    await check(`${side} 清除觸發後取消整段監控，第三回合不再啟動到期分支`,async()=>{
      const clear=h.kitSkill('清除',[{op:'clear_turn',p:{side:'opp'}}]);
      const history=await h.play(side,{self:h.unit('S',50000,[monitor(),h.wait()],{speed:200}),opp:h.unit('E',50000,[clear,h.wait()]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},4);
      assert.equal(history[0].self.statStages.atk,1);for(const r of history)assert.equal(noSwitch(r,other),0);
    });
    await check(`${side} 下回合起算排除待啟用回合；下場不啟動到期`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[monitor('turn_effects_cleared',1,'next'),h.wait()]),opp:h.unit('E',50000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(history.map(r=>noSwitch(r,other)),[0,2,1]);
      const switched=await h.play(side,{self:h.unit('S',50000,[monitor()]),selfBench:[h.unit('B',50000,[h.wait()])],opp:h.unit('E',50000,[h.wait()]),turns:(_,t)=>[t===1?0:t===2?{switch:1}:0,0]},4);
      for(const r of switched)assert.equal(noSwitch(r,other),0);
    });
    await check(`${side} 最後回合事件成立只執行成功分支，不同時執行到期分支`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',50000,[monitor('round_end',1)]),opp:h.unit('E',50000,[h.wait()])});
      assert.equal(r.self.statStages.atk,1);assert.equal(noSwitch(r,other),0);
    });
  }
  console.log(`到期反應通用底座：${checks}項通過`);
}finally{await h.close();}
