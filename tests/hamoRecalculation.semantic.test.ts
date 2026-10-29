import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';

const h=await createHarness();
try {
  const {getBattleSkillOnInvalidRegistry,getBattleSkillAfterHitRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
  assert.ok(sequenceIssue({raw:'錯誤入口',trig:'use',parsed:true,body:[{acts:[{op:'recalculate_skill',p:{powerMultiplier:2}}]}]}));
  assert.ok(sequenceIssue({raw:'錯誤倍率',trig:'self_invalid',parsed:true,body:[{acts:[{op:'recalculate_skill',p:{powerMultiplier:0}}]}]}));
  for(const side of ['p1','p2'] as const)for(const name of ['逐波','燼世','纏根']){
    const source=structuredClone(h.find('5035',name));
    assert.equal(getBattleSkillOnInvalidRegistry()[name],undefined,'不得依賴舊無效處理器');
    assert.equal(getBattleSkillAfterHitRegistry()[name],undefined,'不得重播舊命中異常處理器');
    // 隔離此條原文；保留真實技能名、固有先制及必中，避免其他尚未驗收條款干擾重算值。
    source.kit=source.kit.filter((e:any)=>[0,1,9].includes(e.order));
    source.pp=20;source.maxPp=20;
    const run=async(power:number,invalid:boolean,miss=false)=>{
      const receipts:any[]=[];const outcomes:string[]=[];
      const skill=structuredClone(source);skill.power=power;
      if(miss){skill.kit=skill.kit.filter((e:any)=>e.order!==1);skill.isSureHit=false;skill.alwaysHit=false;skill.accuracy=0;}
      const caster=h.unit('重算施放者',10000,[skill],{speed:300});
      const foe=h.unit('重算受方',100000,[{...h.wait(),priority:-10}]);
      h.S[caster.name]=(_c:any,event:string)=>{if(['ON_SKILL_HIT','ACTION_FAILED'].includes(event))outcomes.push(event);};
      h.S[foe.name]=(c:any,event:string,data:any)=>{
        if(event==='ON_ENTRANCE'&&invalid)c.addTimerTo(c.targetSide,{id:'驗收無效',name:'驗收無效',remaining:1,kind:'use_counter',source:'skill',tickAt:'never',payload:{block:{invalid:'all'}}},false);
        if(event==='AFTER_DAMAGE'&&data.damageType==='skill_attack')receipts.push(data.receipt.settledAmount);
      };
      const [r]=await h.play(side,{self:caster,opp:foe});
      assert.equal(r.self.skills[0].pp,19,'原技能只扣一次PP');
      return {r,receipts,outcomes};
    };
    const normal=await run(100,false);
    const doubled=await run(200,false);
    const retry=await run(100,true);
    assert.equal(normal.receipts.length,1);
    assert.ok(doubled.receipts[0]>normal.receipts[0]);
    assert.deepEqual(retry.receipts,doubled.receipts,'無效重算須等於同招雙倍威力的正式公式，不以保底傷害代替');
    assert.equal(retry.outcomes.filter(e=>e==='ON_SKILL_HIT').length,0,'不假裝原招命中');
    assert.equal(retry.outcomes.filter(e=>e==='ACTION_FAILED').length,1);
    const miss=await run(100,false,true);
    assert.deepEqual(miss.receipts,[],'未命中不能觸發技能無效的傷害重算');
    assert.equal(miss.outcomes.filter(e=>e==='ACTION_FAILED').length,1);
    const statusAttempts:string[]=[];
    h.S['完整招式受方']=(c:any,event:string,data:any)=>{if(event==='BEFORE_STATUS_APPLY'&&data?.targetSide===c.actor)statusAttempts.push(data.status);};
    const full=structuredClone(h.find('5035',name));
    await h.play(side,{self:h.unit('完整招式施放者',10000,[full],{speed:300}),opp:h.unit('完整招式受方',100000,[{...h.wait(),priority:-10}])});
    const expected={逐波:'凍傷',燼世:'燒傷',纏根:'中毒'}[name];
    assert.equal(statusAttempts.filter(s=>s===expected).length,1,'完整技能的命中異常只能施加一次');
  }
  console.log('三招無效重算：P1/P2正式公式、單次扣PP、無舊處理器、未命中隔離通過');
}finally{await h.close();}
