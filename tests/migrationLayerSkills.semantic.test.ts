import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_LAYER_SKILL_KITS as defs} from '../src/data/migratedLayerSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,legacyCalls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleDixinSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/dixin/registry.ts');
const legacy=getBattleSkillRegistry(),saved=legacy['鹿台悲歌'];legacy['鹿台悲歌']=(c:any)=>{legacyCalls++;return saved(c);};
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const skill=(n:string)=>({...structuredClone(h.find('5017',n)),power:0});
const own=(r:any,side:string,id='bahuang_mark',owner='S')=>r.state[`${side}Marks`].find((m:any)=>m.id===id&&m.ownerBattleId===owner);
const a=(op:string,p:any)=>({op,p,label:op});
const add=(amount:number,id='bahuang_mark',cap=9)=>a('resource_mark_add',{side:'self',id,name:'八荒',displayChar:'荒',unit:'層',scope:'elf',persistsOffField:true,description:'資源',amount,maxCount:cap});
const entry=(node:string,trig:string,acts:any[],order=0)=>({codeId:'effect_sequence',node,source:'soulmark',order,customText:trig,params:{clause:{raw:trig,trig,parsed:true,body:[{acts}]}}});
const trait=(kit:any[])=>({name:'資源觀察',description:'資源觀察',effectMode:'kit',kit});
function init(n:number,observe?:(c:any,e:any,d:any)=>void){h.S.S=(c:any,e:any,d:any)=>{
  if(e===T.ON_ENTRANCE){c.setMark({id:'bahuang_mark',name:'八荒',count:n,scope:'elf',ownerBattleId:c.self.battleId||c.self.id,persistsOffField:true},c.actor);c.setPlayerState('dixinBahuangStacks',999);}
  observe?.(c,e,d);
};}
function reload(s:any,edit=false){
  defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{
    for(const e of s.kit){const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');const b=buildEntryBlock(w as any,e)!;assert.ok(b);slot.getInput('STACK')!.connection!.connect(b.previousConnection!);}
    if(edit)for(const b of w.getAllBlocks(false)){
      if(b.type==='skill_property'&&b.getFieldValue('PROPERTY')==='mark_priority'){b.setFieldValue('2','VALUE');b.setFieldValue('{"side":"self","id":"edited_resource"}','PER_MARK');}
      if(b.type==='sequence_action'){const p=JSON.parse(b.getFieldValue('PARAMS')),op=b.getFieldValue('OP');if(op==='resource_mark_add'){p.id='edited_resource';p.maxCount=4;p.amount=3;}if(op==='drain'){p.flat=100;p.perMark.id='edited_resource';}b.setFieldValue(JSON.stringify(p),'PARAMS');}
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map((slot:any,i:number)=>createKitBlockParser('skill')(slot.getInputTargetBlock('STACK'),slot.getFieldValue('TARGET_NODE'),i)!)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('兩份技能精確全文、持有者、預設Kit與全部Blockly節點保存重載',()=>{
    for(const d of defs){const s=h.find('5017',d.name);assert.equal(d.description,(source as any)['5017'].skills[d.name].d);assert.equal(s.description,d.description);assert.equal(s.effectMode,'kit');assert.deepEqual(s.kit,d.kit);assert.deepEqual(reload(s).kit,s.kit);for(const e of s.kit)assert.equal(e.codeId==='skill_property'?skillPropertyIssue(e):sequenceIssue(e.params.clause,e.node),null);}
  });
  await check('嚴格拒絕未接讀取端的逐層／上限參數與直接遞迴資源反應',()=>{
    for(const cap of [0,-1,1.5,Infinity,1000001])assert.ok(sequenceIssue(h.kitSkill('壞',[add(1,'x',cap)]).kit[0].params.clause));
    for(const q of [{side:'both',id:'x'},{side:'self',id:''},{side:'self',id:'x',handler:'x'}]){
      const e=structuredClone(defs[1].kit[0]);e.params.perMark=q;assert.ok(skillPropertyIssue(e));assert.ok(sequenceIssue(h.kitSkill('壞',[a('drain',{flat:1,perMark:q})]).kit[0].params.clause));
    }
    assert.ok(sequenceIssue(h.kitSkill('壞',[a('drain',{ratio:.5,perMark:{side:'self',id:'x'}})]).kit[0].params.clause));
    assert.ok(sequenceIssue(entry('on_resource_changed','resource_changed',[add(1)]).params.clause));
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 鹿台層數0／3／4／8／9，先吸取舊層數、再加2封頂，強化只在大於3翻倍`,async()=>{
      for(const n of [0,3,4,8,9]){const events:any[]=[];init(n,(_,e,d)=>{if(e===T.RESOURCE_CHANGED)events.push(d);});
        const [r]=await h.play(side,{self:h.unit('S',5000,[skill('鹿台悲歌')],{maxHp:10000,speed:200}),opp:h.unit('E',100000,[h.wait()])});
        assert.equal(r.opp.currentHp,100000-n*139,r.logs.join('\n'));assert.equal(r.self.currentHp,5000+n*139);assert.equal(own(r,side).count,Math.min(9,n+2));
        for(const k of ['atk','def','spatk','spdef','speed','accuracy'])assert.equal(r.self.statStages[k],n>3?2:1,k);
        assert.ok(h.statuses(r.self).includes('狂暴'));assert.equal(events.length,n===9?0:1);if(n!==9){assert.equal(events[0].before,n);assert.equal(events[0].after,Math.min(9,n+2));assert.equal(events[0].targetBattleId,'S');}
      }
    });
    await check(`${side} 鹿台遵循共用吸取的結算值恢復規則，禁療仍扣對方體力`,async()=>{
      init(4);const [r]=await h.play(side,{self:h.unit('S',1000,[skill('鹿台悲歌')],{maxHp:10000}),opp:h.unit('E',100,[h.wait()])});assert.equal(r.self.currentHp,1556);assert.equal(r.opp.currentHp,0);
      init(4);const ban=h.kitSkill('禁療',[a('no_heal',{turns:3,next:false})],{priority:10});
      const [b]=await h.play(side,{self:h.unit('S',1000,[skill('鹿台悲歌')],{maxHp:10000}),opp:h.unit('E',100000,[ban])});assert.equal(b.self.currentHp,1000);assert.equal(b.opp.currentHp,99444);
    });
    await check(`${side} 玄鳥先制只讀自己的現有層數，不借999舊計數、不先計增加2層`,async()=>{
      for(const n of [3,4,5]){const order:string[]=[];init(n,(c,e)=>{if(e===T.BEFORE_ACTION)order.push(c.self.id);});h.S.E=(c:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push(c.self.id);};
        const [r]=await h.play(side,{self:h.unit('S',100000,[skill('玄鳥天命')],{speed:50}),opp:h.unit('E',100000,[{...h.wait(),priority:4}],{speed:200})});assert.equal(order[0],n>4?'S':'E',r.logs.join('\n'));
      }delete h.S.E;
    });
    await check(`${side} 玄鳥清除成功疲憊、失敗害怕；同回合100%減療、下一回合恢復`,async()=>{
      init(5);h.S.E=(c:any,e:any)=>{if(e===T.ROUND_END)c.applyHeal(c.actor,10000);};const hist=await h.play(side,{self:h.unit('S',100000,[skill('玄鳥天命'),h.wait()]),opp:h.unit('E',50000,[h.wait()],{maxHp:100000}),turns:(_,t)=>[t===1?0:1,0]},2);
      assert.ok(h.statuses(hist[0].opp).includes('害怕'));assert.equal(hist[0].opp.currentHp,50000);assert.equal(hist[1].opp.currentHp,60000,hist[1].logs.join('\n'));
      delete h.S.E;init(0);const shield=h.turnEffectSkill();const s={...skill('玄鳥天命'),priority:-1};const [r]=await h.play(side,{self:h.unit('S',100000,[s],{speed:50}),opp:h.unit('E',100000,[shield],{speed:200})});assert.ok(h.statuses(r.opp).includes('疲憊'));assert.ok(!h.statuses(r.opp).includes('害怕'));
    });
    await check(`${side} 附加封印不移除玄鳥固有先制，但禁止資源／清除／減療`,async()=>{
      const order:string[]=[];init(5,(c,e)=>{if(e===T.BEFORE_ACTION)order.push(c.self.id);});h.S.E=(c:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push(c.self.id);};
      const [r]=await h.play(side,{self:h.unit('S',100000,[skill('玄鳥天命')],{speed:50,extra:{isAdditionalInvalid:true}}),opp:h.unit('E',50000,[{...h.healSkill(10000),priority:4}],{speed:200,maxHp:100000})});assert.equal(order[0],'S');assert.equal(own(r,side).count,5);assert.equal(r.opp.currentHp,60000);assert.ok(!h.statuses(r.opp).includes('害怕'));delete h.S.E;
    });
    await check(`${side} 正式資源改變反應可編輯，場下特質／攜帶槽各一次，同id持有者隔離且封頂不重播`,async()=>{
      delete h.S.S;const kit=[entry('battle_start','battle_start',[add(3,'renamed',4)]),entry('on_resource_changed','resource_changed',[a('heal_flat',{amount:100})])];
      const carried={...h.wait(),effectMode:'kit',kit:[{...entry('on_resource_changed','resource_changed',[a('heal_flat',{amount:50})]),source:'skill',role:'carried'}]};
      const hist=await h.play(side,{self:h.unit('S',1000,[h.kitSkill('再增加',[add(3,'renamed',4)]),carried],{maxHp:5000,extra:{trait:trait(kit)}}),selfBench:[h.unit('S',1000,[carried],{maxHp:5000,extra:{battleId:'B',trait:trait(kit)}})],opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[0,0]},2);
      assert.equal(hist[0].self.currentHp,1300);assert.equal(hist[1].self.currentHp,1300);assert.equal(hist[0].state[`${side}Team`][1].currentHp,1150);assert.equal(own(hist[1],side,'renamed').count,4);assert.equal(own(hist[1],side,'renamed','B').count,3);
    });
    await check(`${side} 原魂印同步讀積木印記，達9層時立即開陣、玄鳥先制不雙算`,async()=>{
      const order:string[]=[],formations:number[]=[];h.S.S=(c:any,e:any,d:any)=>{handleDixinSoulMark(c,e,d);if(e===T.ON_ENTRANCE)c.setMark({id:'bahuang_mark',name:'八荒',count:7,ownerBattleId:c.self.battleId||c.self.id},c.actor);if(e===T.RESOURCE_CHANGED)formations.push(c.getPlayerState('dixinFormationRounds'));if(e===T.BEFORE_ACTION)order.push('S');};h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('E');};
      const [r]=await h.play(side,{self:h.unit('S',100000,[skill('玄鳥天命')],{speed:50}),opp:h.unit('E',100000,[{...h.wait(),priority:8}],{speed:200})});assert.equal(order[0],'E');assert.deepEqual(formations,[9]);assert.equal(r.state[`${side}RegistryState`].dixinFormationRounds,9);assert.equal(own(r,side).count,8);delete h.S.E;
    });
    await check(`${side} Blockly修改並改名後，獨立資源cap4、吸取100與逐層先制2真正生效`,async()=>{
      delete h.S.S;const setup=trait([entry('on_entered','entrance',[add(3,'edited_resource',4)])]);
      const custom={...reload(skill('鹿台悲歌'),true),name:'自訂鹿台'};const [r]=await h.play(side,{self:h.unit('S',1000,[custom],{maxHp:10000,extra:{trait:setup}}),opp:h.unit('E',100000,[h.wait()])});assert.equal(r.self.currentHp,1300);assert.equal(r.opp.currentHp,99700);assert.equal(own(r,side,'edited_resource').count,4);
      const order:string[]=[];h.S.S=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('S');};h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('E');};
      const [x]=await h.play(side,{self:h.unit('S',100000,[{...reload(skill('玄鳥天命'),true),name:'自訂玄鳥'}],{speed:50,extra:{trait:setup}}),opp:h.unit('E',100000,[{...h.wait(),priority:5}],{speed:200})});assert.equal(order[0],'S');assert.equal(own(x,side,'edited_resource').count,4);delete h.S.E;
    });
    await check(`${side} 鹿台下2回合先制，後手狂暴按共用3回合補償後到期，普通順序恢復`,async()=>{
      const order=new Map<number,string[]>();const observe=(c:any,e:any)=>{if(e!==T.BEFORE_ACTION)return;const round=c.roundNumber;order.set(round,[...(order.get(round)||[]),c.self.id]);};init(0,observe);h.S.E=observe;
      const hist=await h.play(side,{self:h.unit('S',100000,[skill('鹿台悲歌'),h.wait()],{speed:50}),opp:h.unit('E',100000,[{...h.wait(),priority:1}],{speed:200}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.deepEqual([...order.values()].map(v=>v[0]),['E','S','S','E']);assert.deepEqual(hist.map(r=>h.statuses(r.self).includes('狂暴')),[true,true,true,false]);delete h.S.E;
    });
    await check(`${side} 未命中不增加資源、吸取或狂暴；固有封印取消玄鳥先制但保留附加積木`,async()=>{
      init(4);const miss={...skill('鹿台悲歌'),accuracy:0,isSureHit:false};const [r]=await h.play(side,{self:h.unit('S',1000,[miss],{maxHp:10000}),opp:h.unit('E',100000,[h.wait()])});assert.equal(own(r,side).count,4);assert.equal(r.self.currentHp,1000);assert.equal(r.opp.currentHp,100000);assert.ok(!h.statuses(r.self).includes('狂暴'));
      const order:string[]=[];init(5,(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('S');});h.S.E=(_:any,e:any)=>{if(e===T.BEFORE_ACTION)order.push('E');};const [x]=await h.play(side,{self:h.unit('S',100000,[skill('玄鳥天命')],{speed:50,extra:{isInherentInvalid:true}}),opp:h.unit('E',100000,[{...h.wait(),priority:4}],{speed:200})});assert.equal(order[0],'E');assert.equal(own(x,side).count,7);delete h.S.E;
    });
  }
  assert.equal(legacyCalls,0);console.log(`${checks} layer skill checks passed; legacy calls ${legacyCalls}`);
}finally{legacy['鹿台悲歌']=saved;delete h.S.S;delete h.S.E;await h.close();}
