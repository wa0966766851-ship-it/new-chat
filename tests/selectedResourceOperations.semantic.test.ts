import assert from 'node:assert/strict';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const resource={id:'test-resource',name:'測試資源',side:'self',scope:'elf',displayChar:'資',unit:'點',persistsOffField:true,description:'PP消耗量資源',ratio:1};
const setup=()=>h.kitSkill('同名技能',[{op:'abolish_selected',p:{side:'self'}},{op:'consume_selected_pp',p:{side:'self'}},{op:'resource_mark_add',p:resource}],{pp:6,maxPp:6});
const mark=(r:any,side:string,id='test-resource')=>r.state[`${side}Marks`].find((m:any)=>m.id===id);
const entry=(trig:string,node:string,acts:any[],cond:any[]=[])=>({codeId:'effect_sequence',node,source:'skill',role:'attached',order:0,params:{clause:{raw:'通用檢查',trig,parsed:true,body:[{cond,acts:acts.map(a=>({label:a.op,...a}))}]}}});
try{
  await check('所選槽、資源、動態層數、保底及本次擊敗監控都有嚴格合約',async()=>{
    const {sequenceIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');assert.equal(sequenceIssue(setup().kit[0].params.clause),null);
    for(const [op,p] of [['abolish_selected',{}],['consume_selected_pp',{side:'both'}],['resource_mark_add',{...resource,ratio:0}],['resource_mark_add',{...resource,scope:'不明'}]])assert.ok(sequenceIssue(h.kitSkill('壞', [{op,p}]).kit[0].params.clause));
    assert.ok(sequenceIssue(entry('use','on_skill_use',[{op:'damage_floor',p:{side:'opp',base:'全隊體力上限',ratio:1}}]).params.clause));
    assert.ok(sequenceIssue(entry('use','on_skill_use',[],[{c:'death_node',p:{node:1},label:'死亡'}]).params.clause));
    assert.ok(sequenceIssue(entry('use','on_skill_use',[{op:'watch',p:{trig:'kill',actionOnly:'yes',body:[{acts:[{op:'next_entry_status',p:{status:'詛咒',turns:1},label:'詛咒'}]}]}}]).params.clause));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 同名第二槽廢除及消耗，第一槽不被寫入；PP恢復後正式人工與AI選招仍排除`,async()=>{
      const {skillSelectable,legalActions}=await h.server.ssrLoadModule('/src/battle/ai/legalActions.ts');
      const hist=await h.play(side,{self:h.unit('S',100000,[{...setup(),pp:5},setup(),h.wait()],{speed:200}),opp:h.unit('E',100000,[h.wait()]),turns:(engine,t)=>{
        if(t===2){let s=engine.getState();engine.dispatch({type:'UPDATE_ELF',side,elf:{skills:s[side].skills.map((sk:any,i:number)=>i===1?{...sk,pp:6}:sk)}});s=engine.getState();
          assert.equal(skillSelectable(s,side,s[side],1),false);assert.ok(!legalActions(s,side).some((a:any)=>a.kind==='skill'&&a.slot===1));
          if(side==='p2')engine.onSkillSelect('p1',s.p1.skills[0]);
          const before=engine.getState().phase;engine.onSkillSelect(side,engine.getState()[side].skills[1]);assert.equal(engine.getState().phase,before);assert.equal(engine.getState()[`${side}SelectedSkill`],null);
        }return[t===1?1:2,0];
      }},2);
      assert.equal(hist[0].self.skills[0].pp,5);assert.ok(!hist[0].self.skills[0].isAbolished);assert.equal(hist[0].self.skills[1].pp,0);assert.equal(hist[0].self.skills[1].isAbolished,true);assert.equal(mark(hist[0],side).count,5);assert.equal(mark(hist[1],side).count,5);
    });
    await check(`${side} 星護補回PP仍廢除，資源只計此槽剩餘消耗；個體資源不讓下一隻借用`,async()=>{
      const [r]=await h.play(side,{self:h.unit('S',100000,[setup()],{extra:{battleStatuses:{星護:5},effects:[{id:'星護',name:'星護',duration:5}]}}),opp:h.unit('E',100000,[h.wait()])});assert.equal(r.self.skills[0].pp,6);assert.equal(r.self.skills[0].isAbolished,true);assert.equal(mark(r,side).count,5);
      const reading=h.kitSkill('資源查詢',[{op:'heal_flat',p:{amount:500}}]);reading.kit[0].params.clause.body[0].cond=[{c:'mark_count',p:{side:'self',id:'test-resource',op:'高於',amount:0},label:'自身有資源'}];
      const hist=await h.play(side,{self:h.unit('S',10000,[setup()],{maxHp:20000,speed:200}),selfBench:[h.unit('B',10000,[reading],{maxHp:20000})],opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===2?{switch:1}:0,0]},3);assert.equal(hist[2].self.currentHp,10000);assert.equal(hist[2].self.battleId,'B');
    });
    await check(`${side} 新增資源後當句立刻讀最新層數；正式攻擊保底走上限後、護盾前且不沿用到下一招`,async()=>{
      const s=setup();s.kit[0].params.clause.body.push({cond:[{c:'mark_count',p:{side:'self',id:'test-resource',op:'高於',amount:4},label:'最新5層'}],acts:[{op:'heal_flat',p:{amount:500},label:'回復'}]});
      const [fresh]=await h.play(side,{self:h.unit('S',10000,[s],{maxHp:20000}),opp:h.unit('E',100000,[h.wait()])});assert.equal(fresh.self.currentHp,10500);
      const floor={...h.wait(),name:'隊伍保底',category:'物理',power:1,kit:[entry('outgoing_attack','before_damage',[{op:'damage_floor',p:{side:'opp',base:'全隊體力上限',ratio:.5}}])],effectMode:'kit'};
      const capped=h.kitSkill('攻擊上限',[{op:'damage_cap_turns',p:{side:'self',dir:'in',kind:'攻擊',cap:1,turns:3,next:false}}],{priority:3});
      const hist=await h.play(side,{self:h.unit('S',100000,[floor,{...h.wait(),name:'下一普通攻擊',category:'物理',power:1}]),opp:h.unit('E',20000,[capped,h.wait()],{extra:{shield:1000}}),oppBench:[h.unit('D',0,[h.wait()],{maxHp:10000}),h.unit('B',10000,[h.wait()])],turns:(_,t)=>[t===1?0:1,t===1?0:1]},2);
      assert.equal(hist[0].opp.currentHp,1000,hist[0].logs.join('\n'));assert.equal(hist[0].opp.shield,0);assert.equal(hist[1].opp.currentHp,999);assert.equal(hist[0].state[`${other}Team`][1].currentHp,0);
    });
    await check(`${side} 本次出手擊敗監控只接受死亡節點一，失敗後下一招擊敗不補發`,async()=>{
      const watcher=h.kitSkill('本次監控',[{op:'watch',p:{trig:'kill',actionOnly:true,body:[{cond:[{c:'death_node',p:{node:1},label:'出手死亡節點一'}],acts:[{op:'next_entry_status',p:{status:'詛咒',turns:1},label:'下隻詛咒'}]}]}}]);
      watcher.kit[0].params.clause.body[0].acts.push({op:'dmg',p:{flat:200000,type:'真實'},label:'本次擊敗'});
      const immediate=await h.play(side,{self:h.unit('S',100000,[watcher,h.wait()],{speed:200}),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('B',100000,[h.wait()])],turns:(_,t)=>[t===1?0:1,t===2?{switch:1}:0]},2);
      assert.equal(immediate[0].state[`${other}RegistryState`].nextElfStatus?.status,'詛咒');assert.ok(h.statuses(immediate[1].opp).includes('詛咒'),JSON.stringify(immediate[1].opp));
      const noKill=structuredClone(watcher);noKill.kit[0].params.clause.body[0].acts.pop();
      const later=await h.play(side,{self:h.unit('S',100000,[noKill,h.kitSkill('後續擊敗',[{op:'dmg',p:{flat:200000,type:'真實'}}]),h.wait()],{speed:200}),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('B',100000,[h.wait()])],turns:(_,t)=>[t===1?0:t===2?1:2,t===3?{switch:1}:0]},3);assert.ok(!h.statuses(later[2].opp).includes('詛咒'));assert.equal(later[1].state[`${other}RegistryState`].nextElfStatus,undefined);
    });
    await check(`${side} 戰鬥階段末及回合末真正擊敗只到死亡節點二／三，不補本次出手詛咒`,async()=>{
      const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
      for(const [timing,node] of [[T.BATTLE_PHASE_END,2],[T.ROUND_END,3]]){
        const nodes:number[]=[];let fired=false;
        h.S.S=(ctx:any,e:any)=>{if(e===timing&&!fired){fired=true;ctx.applyTrueDamage(ctx.targetSide,200000);}};
        h.S.E=(_:any,e:any,d:any)=>{if(e===T.DEATH_NODE_1)nodes.push(d.node);};
        try{const watcher=h.kitSkill('節點監控',[{op:'watch',p:{trig:'kill',actionOnly:true,body:[{cond:[{c:'death_node',p:{node:1},label:'只出手末'}],acts:[{op:'next_entry_status',p:{status:'詛咒',turns:1},label:'下隻詛咒'}]}]}}]);
          const [r]=await h.play(side,{self:h.unit('S',100000,[watcher]),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('B',100000,[h.wait()])]});
          assert.equal(r.opp.currentHp,0);assert.deepEqual(nodes,[node]);assert.equal(r.state[`${other}RegistryState`].nextElfStatus,undefined);
        }finally{delete h.S.S;delete h.S.E;}
      }
    });
  }
  console.log(`所選槽資源與本次擊敗：${checks}項通過`);
}finally{await h.close();}
