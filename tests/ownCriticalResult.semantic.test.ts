import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const monitor={op:'timed',p:{turns:2,from:'now',trig:'self_after_attack',body:[
  {cond:[{c:'crit',p:{},label:'本次自身攻擊致命'}],acts:[{op:'drain',p:{flat:350,true:false},label:'致命後吸取'}]},
]}};
try{
  for(const side of ['p1','p2'] as const){
    await check(`${side} 正式AFTER_ACTION特質直接讀事件結果，不依賴已清除暫存旗標`,async()=>{
      const trait={name:'本次致命恢復',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'after_action',source:'mechanic',role:'innate',order:0,
        params:{clause:{raw:'自身致命恢復',trig:'self_after_attack',parsed:true,body:[{cond:[{c:'crit',p:{},label:'本次致命'}],acts:[{op:'heal_flat',p:{amount:123},label:'致命恢復'}]}]}}}]};
      for(const critical of [false,true]){
        const attack=h.kitSkill('主攻擊',critical?[{op:'crit_now',p:{}}]:[],{category:'物理',power:1});
        const [r]=await h.play(side,{self:h.unit('S',10000,[attack],{maxHp:20000,extra:{trait}}),opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.self.currentHp,critical?10123:10000,r.logs.join('\n'));
      }
    });
    await check(`${side} 行動後讀本次主攻擊致命結果；普通攻擊、屬性及對手致命不觸發`,async()=>{
      for(const mode of ['crit','normal','status','opponentCrit']){
        const self=h.kitSkill('本次攻擊結果',[monitor,...(mode==='crit'?[{op:'crit_now',p:{}}]:[])],{category:mode==='status'?'屬性':'物理',power:mode==='status'?0:1});
        const opponent=mode==='opponentCrit'?h.kitSkill('對手致命',[{op:'crit_now',p:{}}],{category:'物理',power:1}):h.wait();
        const [r]=await h.play(side,{self:h.unit('S',10000,[self],{maxHp:20000,speed:200}),opp:h.unit('E',100000,[opponent])});
        const [base]=await h.play(side,{self:h.unit('S',10000,[h.kitSkill('沒有監控',mode==='crit'?[{op:'crit_now',p:{}}]:[],{category:mode==='status'?'屬性':'物理',power:mode==='status'?0:1})],{maxHp:20000,speed:200}),opp:h.unit('E',100000,[opponent])});
        assert.equal(r.opp.currentHp,base.opp.currentHp-(mode==='crit'?350:0),`${mode}\n${r.logs.join('\n')}`);
        assert.equal(r.self.currentHp,base.self.currentHp+(mode==='crit'?350:0),`${mode}\n${r.logs.join('\n')}`);
        assert.equal(!!r.state[`${side}RegistryState`].blkLastCrit,false,'清掉暫存旗標後仍能查詢事件結果');
      }
    });
    await check(`${side} 致命監控兩回合期限、每次行動一次；第三回合停止`,async()=>{
      const setup=h.kitSkill('監控兩回合',[monitor,{op:'crit_now',p:{}}],{category:'物理',power:1});
      const hit=h.kitSkill('致命攻擊',[{op:'crit_now',p:{}}],{category:'物理',power:1});
      const history=await h.play(side,{self:h.unit('S',10000,[setup,hit],{maxHp:20000}),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(history.map(r=>r.self.currentHp),[10350,10700,10700],history.flatMap(r=>r.logs).join('\n'));
    });
  }
  console.log(`自身致命一擊事件：${checks}項通過`);
}finally{await h.close();}
