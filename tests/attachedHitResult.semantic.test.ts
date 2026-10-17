import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const result={c:'event_hit',p:{requireAdditional:true},label:'本次命中且技能附加有效'};
const monitor={op:'timed',p:{turns:3,from:'now',trig:'self_after_attack',body:[{cond:[result],acts:[{op:'heal_flat',p:{amount:123},label:'正式命中恢復'}]}]}};
const attack=(mode='hit')=>h.kitSkill('結果觀測攻擊',[],{category:'物理',power:10,...(mode==='miss'?{accuracy:0,isSureHit:false}:{})});
try{
  await check('結果條件只接受正式行動後事件及布林參數；下回合增傷合約已支援',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    const c={raw:'測試',trig:'self_after_attack',parsed:true,body:[{cond:[result],acts:[{op:'heal_flat',p:{amount:1}}]}]};assert.equal(sequenceIssue(c),null);
    assert.ok(sequenceIssue({...c,trig:'use'}));assert.ok(sequenceIssue({...c,body:[{cond:[{...result,p:{requireAdditional:'true'}}],acts:c.body[0].acts}]}));
    assert.equal(sequenceIssue(h.kitSkill('下兩回合增傷',[{op:'dmg_mod_turns',p:{dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true}}]).kit[0].params.clause),null);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 持續監控讀本次命中與附加旗標，命中0傷害仍有效；未命中／無效／封附加不觸發`,async()=>{
      for(const mode of ['hit','zero','miss','invalid','seal']){
        const own=attack(mode);if(mode==='zero')own.power=0;
        const opp=mode==='invalid'?h.kitSkill('攻擊無效',[{op:'invalid_turns',p:{kind:'攻擊',turns:1,next:false}}],{priority:4})
          :mode==='seal'?h.kitSkill('攻擊附加無效',[{op:'add_invalid_turns',p:{kind:'攻擊',turns:1,next:false}}],{priority:4}):h.wait();
        const history=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('建立監控',[monitor]),own],{maxHp:20000}),opp:h.unit('E',100000,[h.wait(),opp]),turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
        assert.equal(history[1].self.currentHp,['hit','zero'].includes(mode)?10123:10000,mode+'\n'+history[1].logs.join('\n'));
      }
    });
    await check(`${side} 正式AFTER_ACTION特質讀相同結果，封附加並非未命中；監控第三回合到期`,async()=>{
      const mk=(requireAdditional:boolean)=>({name:'行動結果',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'after_action',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'正式行動結果',trig:'self_after_attack',parsed:true,body:[{cond:[{...result,p:{requireAdditional}}],acts:[{op:'heal_flat',p:{amount:50},label:'命中恢復'}]}]}}}]});
      const seal=h.kitSkill('封附加',[{op:'add_invalid_turns',p:{kind:'攻擊',turns:1,next:false}}],{priority:4});
      for(const requireAdditional of [true,false]){
        const [r]=await h.play(side,{self:h.unit('S',10000,[attack()],{maxHp:20000,extra:{trait:mk(requireAdditional)}}),opp:h.unit('E',100000,[seal])});
        assert.equal(r.self.currentHp,requireAdditional?10000:10050,r.logs.join('\n'));
      }
      const hist=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('建立監控',[monitor]),attack()],{maxHp:20000}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual(hist.map(r=>r.self.currentHp),[10000,10123,10246,10246]);
    });
    await check(`${side} 下兩回合增傷不影響授予本次，保留加算並於第四回合到期`,async()=>{
      const setup=h.kitSkill('下兩回合增傷',[{op:'dmg_mod_turns',p:{dir:'out',kind:'攻擊',boost:1.5,turns:2,next:true}}],{category:'物理',power:10});
      const plain=attack();const execute=(first:any)=>h.play(side,{self:h.unit('S',50000,[first,plain]),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},4);
      const hist=await execute(setup),base=await execute(plain);const deltas=(r:any[])=>r.map((v,i)=>(i?r[i-1].opp.currentHp:100000)-v.opp.currentHp);
      const got=deltas(hist),normal=deltas(base);assert.equal(got[0],normal[0]);assert.ok(got[1]>normal[1]*2);assert.ok(got[2]>normal[2]*2);assert.equal(got[3],normal[3]);
    });
  }
  console.log(`正式命中及附加結果：${checks}項通過`);
}finally{await h.close();}
