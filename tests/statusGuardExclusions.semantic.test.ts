import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const guard=(p:any={})=>h.kitSkill('免疫但有排除項',[{op:'immune_status_turns',p:{turns:2,reflect:true,exclude:['狂暴'],...p}}]);
const apply=(status:string)=>h.kitSkill('施加異常',[{op:'status',p:{side:'opp',status,turns:3,chance:100}}]);
try{
  await check('排除清單須已登記名稱；分詞與顯示保留排除項',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
    const {parseLine}=await h.server.ssrLoadModule('/src/blocks/parse.ts');
    const {sequenceActionLabel}=await h.server.ssrLoadModule('/src/effects/sequencePresentation.ts');
    assert.equal(sequenceIssue(guard().kit[0].params.clause),null);
    for(const exclude of ['狂暴',[null],['未知異常']])assert.ok(sequenceIssue(guard({exclude}).kit[0].params.clause));
    const parsed=parseLine('5回合內免疫並反彈除狂暴外所有受到的異常狀態');assert.equal(parsed.parsed,true);
    assert.deepEqual(parsed.body[0].acts[0].p.exclude,['狂暴']);assert.ok(sequenceActionLabel({op:'immune_status_turns',p:{turns:2,reflect:true,exclude:['狂暴']},label:''}).includes('除狂暴外'));
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 狂暴正常施加；控制、弱化與附屬異常照常免疫反彈`,async()=>{
      for(const status of ['狂暴','麻痺','燒傷','星哲']){
        const [r]=await h.play(side,{self:h.unit('S',50000,[guard()],{speed:200}),opp:h.unit('E',100000,[apply(status)])});
        assert.equal(h.statuses(r.self).includes(status),status==='狂暴',status+'\n'+r.logs.join('\n'));
        assert.equal(h.statuses(r.opp).includes(status),status!=='狂暴',status+'\n'+r.logs.join('\n'));
      }
    });
    await check(`${side} 排除項不放寬原分類；兩回合期限後停止反彈`,async()=>{
      for(const status of ['麻痺','害怕','狂暴']){
        const [r]=await h.play(side,{self:h.unit('S',50000,[guard({cls:'控制類',exclude:['麻痺']})],{speed:200}),opp:h.unit('E',100000,[apply(status)])});
        assert.equal(h.statuses(r.self).includes(status),status!=='害怕',status+'\n'+r.logs.join('\n'));
      }
      const history=await h.play(side,{self:h.unit('S',50000,[guard(),h.wait()],{speed:200}),opp:h.unit('E',100000,[apply('星哲')]),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(history.map(r=>h.statuses(r.self).includes('星哲')),[false,false,true]);
    });
  }
  console.log(`異常免疫排除清單：${checks}項通過`);
}finally{await h.close();}
