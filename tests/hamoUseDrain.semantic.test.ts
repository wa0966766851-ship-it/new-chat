import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();
try{
  for(const side of ['p1','p2'] as const){
    const skill=structuredClone(h.find('5035','逐波'));
    skill.kit=skill.kit.filter((e:any)=>e.order===4);skill.power=0;
    const amounts:number[]=[];
    h.S['吸取受方']=(c:any,event:string,data:any)=>{
      if(event==='AFTER_DAMAGE'&&data.damageType==='percent')amounts.push(data.receipt.settledAmount);
    };
    const history=await h.play(side,{self:h.unit('吸取施放者',1000,[skill,h.wait()],{speed:300,maxHp:10000}),opp:h.unit('吸取受方',1200,[h.healSkill(1200)]),turns:(_e:any,t:number)=>[t===1?0:1,0]},6);
    // 開始1000/10000：首次800；第二次仍低於半血800，其後亦然，直到5回合期限結束。
    assert.deepEqual(amounts,[800,800,800,800,800],'首次命中啟動，之後各次用技觸發一次；第六回合不觸發');
    assert.equal(history[4].self.currentHp,5000,'每次吸取實際800並回復800');
    assert.equal(history[5].self.currentHp,5000,'期限外沒有偷跑回復');
    assert.ok(!history[5].state[side+'Timers'].some((t:any)=>t.payload?.trig==='self_skill'));
    const normal:number[]=[];
    h.S['吸取受方']=(c:any,event:string,data:any)=>{if(event==='AFTER_DAMAGE'&&data.damageType==='percent')normal.push(data.receipt.settledAmount);};
    await h.play(side,{self:h.unit('吸取施放者',5000,[skill],{speed:300,maxHp:10000}),opp:h.unit('吸取受方',1200,[h.healSkill(1200)])});
    assert.deepEqual(normal,[400],'恰好半血不翻倍');
    const blocked:number[]=[];
    h.S['吸取受方']=(c:any,event:string,data:any)=>{
      if(event==='ON_ENTRANCE')c.addTimerTo(c.targetSide,{id:'吸取啟動無效',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{invalid:'all'}}},false);
      if(event==='AFTER_DAMAGE'&&data.damageType==='percent')blocked.push(data.receipt.settledAmount);
    };
    const [failed]=await h.play(side,{self:h.unit('吸取施放者',1000,[skill],{speed:300,maxHp:10000}),opp:h.unit('吸取受方',1200,[h.healSkill(1200)])});
    assert.deepEqual(blocked,[],'首次未命中不能取得持續吸取');
    assert.equal(failed.self.currentHp,1000);
  }
  console.log('逐波五回合用技吸取：P1/P2首次、後續、低血翻倍、半血邊界與期限通過');
}finally{await h.close();}
