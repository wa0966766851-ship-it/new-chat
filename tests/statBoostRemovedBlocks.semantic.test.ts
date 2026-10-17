import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const monitor=()=>h.kitSkill('監控能力提升移除',[{op:'timed',p:{turns:3,from:'now',trig:'stat_boost_cleared',body:[{acts:[{op:'heal_flat',p:{amount:5},label:'回復5'}]}]}}]);
const clear=()=>h.kitSkill('消強',[{op:'stat_clear',p:{side:'opp',kind:'up'}}]);
try{
  await check('正式事件映射及嚴格合約；空資料與自身清除不冒充他方移除',async()=>{
    const {EffectTiming}=await h.server.ssrLoadModule('/src/effects/types.ts');
    const {eventTriggers}=await h.server.ssrLoadModule('/src/blocks/runtime.ts');
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    assert.equal(sequenceIssue(monitor().kit[0].params.clause),null);
    const ctx={actor:'p1'};
    assert.deepEqual(eventTriggers(ctx,EffectTiming.STAT_BOOST_CLEARED,{sourceSide:'p2',removedStages:{atk:2}}),['stat_boost_cleared']);
    for(const data of [{},{sourceSide:'p2',removedStages:{}},{sourceSide:'p2',removedStages:{atk:-1}},{sourceSide:'p1',removedStages:{atk:2}}])assert.deepEqual(eventTriggers(ctx,EffectTiming.STAT_BOOST_CLEARED,data),[]);
    const bad=structuredClone(monitor().kit[0].params.clause);bad.body[0].acts[0].p.trig='unknown';assert.ok(sequenceIssue(bad));
    const {parseLine}=await h.server.ssrLoadModule('/src/blocks/parse.ts');
    const parsed=parseLine('3回合內自身能力強化狀態被消除、吸取時則對手2回合使用屬性技能附加效果失效');
    assert.equal(parsed.parsed,true,JSON.stringify(parsed));assert.equal(parsed.body[0].acts[0].p.trig,'stat_boost_cleared');const {rest,...clause}=parsed;assert.equal(sequenceIssue(clause),null);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 正式消除／吸取各觸發一次；複製、普通弱化及空消除不觸發`,async()=>{
      for(const mode of ['clear','steal','reverse','copy','debuff','empty']){
        const act=mode==='clear'||mode==='empty'?{op:'stat_clear',p:{side:'opp',kind:'up'}}:mode==='debuff'?{op:'stat',p:{side:'opp',stats:['攻擊'],v:-1}}:{op:'stat_steal',p:{mode:mode==='copy'?'複製':'吸取',...(mode==='reverse'?{reverse:true}:{})}};
        const [r]=await h.play(side,{self:h.unit('S',1000,[monitor()],{maxHp:9000,speed:200,statStages:mode==='empty'?{}:{atk:2}}),opp:h.unit('E',50000,[h.kitSkill('對手變更',[act])])});
        assert.equal(r.self.currentHp,1000+(['clear','steal','reverse'].includes(mode)?5:0),mode+'\n'+r.logs.join('\n'));
      }
    });
    await check(`${side} 受保護能力提升未被消除／吸取，不觸發反應`,async()=>{
      const trait={name:'能力保護',description:'測試',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'on_entered',source:'mechanic',role:'innate',order:0,params:{clause:{raw:'保護',trig:'entrance',parsed:true,body:[{acts:[{op:'stat_protect_turns',p:{turns:3},label:'保護'}]}]}}}]};
      for(const act of [{op:'stat_clear',p:{side:'opp',kind:'up'}},{op:'stat_steal',p:{mode:'吸取'}}]){
        const [r]=await h.play(side,{self:h.unit('S',1000,[monitor()],{maxHp:9000,speed:200,statStages:{atk:2},extra:{trait}}),opp:h.unit('E',50000,[h.kitSkill('試圖消強',[act])])});
        assert.equal(r.self.currentHp,1000);assert.equal(r.self.statStages.atk,2);
      }
    });
    await check(`${side} 期限到期與換人不觸發，監控不移交新在場者`,async()=>{
      const history=await h.play(side,{self:h.unit('S',1000,[monitor(),h.wait()],{maxHp:9000,speed:200,statStages:{atk:2}}),opp:h.unit('E',50000,[h.wait(),clear()]),turns:(_,t)=>[t===1?0:1,t===4?1:0]},4);
      assert.equal(history[3].self.currentHp,1000);
      const switched=await h.play(side,{self:h.unit('S',1000,[monitor()],{maxHp:9000,speed:200,statStages:{atk:2}}),selfBench:[h.unit('B',1000,[h.wait()],{maxHp:9000,statStages:{atk:2}})],opp:h.unit('E',50000,[h.wait(),clear()]),turns:(_,t)=>[t===1?0:{switch:1},t===1?0:1]},2);
      assert.equal(switched[1].self.id,'B');assert.equal(switched[1].self.currentHp,1000);
    });
  }
  console.log(`能力提升移除事件：${checks}項通過`);
}finally{await h.close();}
