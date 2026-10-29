import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {kitEntryIssue}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const entry=(node:string,trig:string,acts:any[],source='soulmark',role='innate')=>({codeId:'effect_sequence',node,source,role,order:0,customText:'正式開局',params:{clause:{raw:'正式開局',trig,parsed:true,body:[{acts:acts.map(a=>({...a,label:a.op}))}]}}});
const mark=(id:string)=>({op:'resource_mark_add',p:{id,name:id,side:'self',scope:'elf',displayChar:'層',unit:'層',persistsOffField:true,description:'逐隻正式特質計數',ratio:1}});
const kit=[entry('battle_start','battle_start',[{op:'count_team_trait',p:{side:'both',name:'瞬殺',state:'any'}},mark('start_count')])];
const soul={name:'開局',description:'正式開局',effectMode:'kit',kit};
const fixedMark=(amount:number)=>{const {ratio,...p}=mark('fixed_count').p;return {op:'resource_mark_add',p:{...p,amount}};};
let editedKit:any[]=[];
try{
  await check('資源固定量與前次結算比例互斥，拒絕缺量／小數／零量',()=>{
    const clause=(a:any)=>entry('battle_start','battle_start',[a]).params.clause;
    assert.equal(sequenceIssue(clause(fixedMark(1)),'battle_start'),null);
    for(const amount of [0,1.5,undefined])assert.ok(sequenceIssue(clause(fixedMark(amount as any))));
    assert.ok(sequenceIssue(clause({...fixedMark(1),p:{...fixedMark(1).p,ratio:1}})));
  });
  await check('Blockly實際開局節點與特質計數參數保存重載，可改精確特質名稱',()=>{
    defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
    try{const b=buildEntryBlock(w as any,kit[0] as any);assert.ok(b);for(const a of w.getAllBlocks(false))if(a.type==='sequence_action'&&a.getFieldValue('OP')==='count_team_trait'){const p=JSON.parse(a.getFieldValue('PARAMS'));p.name='其他特質';a.setFieldValue(JSON.stringify(p),'PARAMS');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);const loaded=createKitBlockParser('soulmark')(r.getTopBlocks(false)[0] as any,'battle_start',0)!;assert.equal(loaded.params.clause.body[0].acts[0].p.name,'其他特質');assert.equal(kitEntryIssue(loaded),null);editedKit=[loaded];
    }finally{w.dispose();r.dispose();}
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 改特質名稱保存重載後改魂印名稱仍實行，不借原文瞬殺計數`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:{...soul,name:'自訂開局',kit:structuredClone(editedKit)},trait:{name:'瞬殺',description:''}}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.state[`${side}Marks`].some((m:any)=>m.id==='start_count'),false);
    });
    await check(`${side} 開局固定1層再計雙方特質0層仍保留1；固定量不借前次結算`,async()=>{
      const ownSoul={...soul,kit:[entry('battle_start','battle_start',[fixedMark(1),{op:'count_team_trait',p:{side:'both',name:'不存在特質',state:'any'}},fixedMark(2),mark('fixed_count')])]};
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()],{extra:{soulMark:ownSoul}}),opp:h.unit('E',10000,[h.wait()])});assert.equal(r.state[`${side}Marks`].find((m:any)=>m.id==='fixed_count').count,3);
    });
    await check(`${side} 正式1.1全背包開局先於登場，首發與場下各一次，重複start／換人不重播`,async()=>{
      const self=h.unit('S',10000,[h.wait()],{extra:{soulMark:structuredClone(soul),trait:{name:'瞬殺',description:''}}});
      const b=h.unit('B',10000,[h.wait()],{extra:{soulMark:structuredClone(soul),alienTraits:{generalTrait:{name:'瞬殺',description:''},exclusiveTraits:[{name:'瞬殺',description:''}]}}});
      const d=h.unit('D',0,[h.wait()],{maxHp:10000,extra:{soulMark:structuredClone(soul),trait:{name:'瞬殺',description:''}}});
      const x=h.unit('X',10000,[h.wait()],{extra:{isExtra:true,soulMark:structuredClone(soul),trait:{name:'瞬殺',description:''}}});
      const e=h.unit('E',10000,[h.wait()],{extra:{trait:{name:'瞬殺',description:''}}});
      const seen:any[]=[];h.S.E=(ctx:any,event:any)=>{if(event===T.ON_ENTRANCE)seen.push(ctx.getFullTeam(ctx.targetSide).flatMap((owner:any)=>ctx.contextForElf(ctx.targetSide,owner).getMarks(ctx.targetSide).filter((m:any)=>m.id==='start_count').map((m:any)=>m.count)));};
      try{const nodes:string[]=[];const teams:any={[side]:[self,b,d,x],[other]:[e]};const engine=createBattleEngine({initialP1Team:teams.p1,initialP2Team:teams.p2,p1StarterId:teams.p1[0].id,p2StarterId:teams.p2[0].id,battleMode:'PVP',preparedTeams:true,isFast:()=>true,onNode:(node:string)=>nodes.push(node)});engine.mount();engine.start();await engine.idle();engine.start();await engine.idle();
        const marks=engine.getState()[`${side}Marks`];assert.deepEqual(marks.filter((m:any)=>m.id==='start_count').map((m:any)=>[m.ownerBattleId,m.count]),[['S',4],['B',4]]);assert.deepEqual(seen,[[4,4]]);assert.equal(nodes.filter(n=>n==='1.1').length,1);
        if(side==='p1'){engine.onSwitchElf(side,1);engine.onSkillSelect(other,engine.getState()[other].skills[0]);}else{engine.onSkillSelect(other,engine.getState()[other].skills[0]);engine.onSwitchElf(side,1);}await engine.idle();assert.equal(engine.getState()[side].battleId,'B');assert.deepEqual(engine.getState()[`${side}Marks`].filter((m:any)=>m.id==='start_count').map((m:any)=>m.count),[4,4]);engine.unmount();
      }finally{delete h.S.E;}
    });
    await check(`${side} 場下攜帶技能與其他特質開局可執行，同名特質按精靈只算一次`,async()=>{
      const b=h.unit('B',10000,[{...h.wait(),name:'攜帶開局',effectMode:'kit',kit:[entry('battle_start','battle_start',[{op:'count_team_trait',p:{side:'self',name:'瞬殺',state:'alive'}},mark('carried_count')],'skill','carried')]}],{extra:{trait:{name:'開局',description:'正式開局',effectMode:'kit',kit:structuredClone(kit)},alienTraits:{generalTrait:{name:'瞬殺',description:''}}}});
      const [r]=await h.play(side,{self:h.unit('S',10000,[h.wait()]),selfBench:[b],opp:h.unit('E',10000,[h.wait()])});const marks=r.state[`${side}Marks`];assert.equal(marks.find((m:any)=>m.id==='carried_count').count,1);assert.equal(marks.find((m:any)=>m.id==='start_count').count,1);
    });
  }
  console.log(`全背包正式開局：${checks}項通過`);
}finally{await h.close();}
