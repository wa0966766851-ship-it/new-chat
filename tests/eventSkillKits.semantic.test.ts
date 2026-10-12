import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import { buildEntryBlock,createKitBlockParser,defineCustomBlocks } from '../src/components/BlocklyBuilder';
import { MIGRATED_EVENT_SKILL_KITS as definitions } from '../src/data/migratedEventSkillKits';
import { validateKit } from '../src/effects/kitValidation';
import { kitEntryIssue } from '../src/effects/effectConnection';
import { createHarness } from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>Promise<void>|void)=>{console.log(`檢查：${name}`);await fn();checks++;console.log(`✓ ${name}`);};
const a=(op:string,p:any)=>({op,p,label:op});
const carry=(body:any[],order=0):any=>({codeId:'effect_sequence',node:'pp_consumed',source:'skill',role:'carried',order,
  customText:'本技能PP被消耗',params:{clause:{raw:'本技能PP被消耗',trig:'pp_consumed',parsed:true,body}}});
const carriedSkill=(name:string,body:any[])=>({...h.wait(),name,effectMode:'kit',kit:[carry(body)]});
try {
  defineCustomBlocks();
  await check('13份來源完整精確匹配、每項合約可執行，真正Blockly保存重載可編輯（非專屬引用）',()=>{
    let matched=0;
    for(const def of definitions)for(const id of def.elfIds){const s=h.find(id,def.name);assert.equal(s.description,def.description);assert.equal(s.effectMode,'kit');
      assert.deepEqual(JSON.parse(JSON.stringify(s.kit)),def.kit);validateKit(s.kit);assert.ok(s.kit.every((e:any)=>!kitEntryIssue(e)));matched++;
      const ws=new Blockly.Workspace(),reload=new Blockly.Workspace();
      try {for(const e of s.kit){const b=buildEntryBlock(ws as any,e)!;assert.ok(b);assert.notEqual(b.type,'native_effect_reference');assert.deepEqual(createKitBlockParser('skill')(b,e.node,e.order),e);}
        Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(ws),reload);
        const result=reload.getTopBlocks(false).map(b=>{const e=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,e.node,e.order);}).sort((x,y)=>x!.order-y!.order);
        assert.deepEqual(result,s.kit);
      }finally{ws.dispose();reload.dispose();}
    }assert.equal(matched,16);
    assert.throws(()=>validateKit([carry([{acts:[a('watch',{trig:'kill',body:[{acts:[a('next_entry_status',{status:'不存在的異常',turns:3})]}]})]}])]),/尚未登記/,'巢狀擊敗監控不得藏未知異常');
    assert.ok(kitEntryIssue({...carry([{acts:[a('heal_flat',{amount:1})]}]),role:'attached'}),'PP槽不能用普通附加角色蒙混');
  });
  for(const side of ['p1','p2'] as const) {
    await check(`${side} 虛無含使用回合共2回合、僅先手才無效對手技能；後手不補出第3回合`,async()=>{
      const sk=h.find('300','虛無'),enemy=h.kitSkill('對手附加',[a('dmg',{flat:17,type:'固定'})]);
      const run=(speed:number)=>h.play(side,{self:h.unit('S',90000,[sk,h.wait()],{speed}),opp:h.unit('E',90000,[enemy],{speed:100}),turns:(_e,t)=>[t===1?0:1,0]},3);
      const fast=await run(200);assert.deepEqual(fast.map(r=>r.self.currentHp),[90000,90000,89983]);
      const slow=await run(50);assert.deepEqual(slow.map(r=>r.self.currentHp),[89983,89966,89949]);
    });
    await check(`${side} 聖光吟誦受攻擊監控含當回合4次，回饋為百分比且不受攻擊專屬增傷`,async()=>{
      const source=h.find('5000','聖光吟誦'),sk={...source,power:0,category:'屬性',kit:[source.kit[0],source.kit[2],source.kit[3]]};
      const enemy=h.kitSkill('攻擊前恢復',[a('heal',{side:'self',ratio:1})],{category:'物理',power:30});
      const hist=await h.play(side,{self:h.unit('S',1e6,[sk,h.wait()],{speed:200}),opp:h.unit('E',90000,[enemy],{speed:100}),turns:(_e,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(hist.map(r=>r.opp.currentHp),[60000,60000,60000,60000,90000]);
    });
    await check(`${side} 安息契全PP內部鏈一次、攻擊槽歸零、百分比加成與免疫期限`,async()=>{
      const sk={...h.find('5023','安息契'),power:0,category:'屬性',pp:5,maxPp:10};
      const attack={...h.wait(),name:'敵攻擊',category:'物理',power:0,pp:13,maxPp:20};
      const hist=await h.play(side,{self:h.unit('S',4000,[sk,{...h.wait(),pp:7,maxPp:10}],{maxHp:10000}),opp:h.unit('E',100000,[attack,{...h.wait(),pp:7,maxPp:10}]),turns:()=>[0,1]});
      const r=hist[0];assert.equal(r.opp.currentHp,92000);assert.equal(r.self.currentHp,10000);assert.deepEqual(r.self.skills.map((s:any)=>s.pp),[3,6]);assert.deepEqual(r.opp.skills.map((s:any)=>s.pp),[0,6]);
      assert.equal(r.state[`${side}RegistryState`].ppCarryChain,undefined);assert.equal(r.state[`${side}RegistryState`].immuneStatusTurns,1);
      assert.equal(r.state[`${side}Timers`].filter((t:any)=>t.payload?.block?.trig==='kill').length,1);
    });
    await check(`${side} 下一次擊敗才給下一隻詛咒；登場免疫仍正常，消耗後不留全隊狀態`,async()=>{
      const seal={...h.find('5023','安息契'),power:0,category:'屬性'};
      const kill=h.kitSkill('精確擊敗',[a('dmg',{flat:100000,type:'真實'})]);
      const guard={name:'登場異常防護',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,params:{clause:{raw:'免疫',trig:'before_status',parsed:true,body:[{acts:[a('status_guard',{cls:''})]}]}}}]};
      for(const immune of [false,true]){
        const hist=await h.play(side,{self:h.unit('S',90000,[seal,kill,h.wait()]),opp:h.unit('E',100000,[h.wait()]),oppBench:[h.unit('N',100000,[h.wait()],{extra:immune?{soulMark:guard}:{}})],turns:(_e,t)=>[t===1?0:t===2?1:2,t===3?{switch:1}:0]},3);
        assert.equal(hist[2].opp.id,'N');assert.equal(h.statuses(hist[2].opp).includes('詛咒'),!immune);assert.equal(hist[2].state[`${side==='p1'?'p2':'p1'}RegistryState`].nextElfStatus,undefined);
      }
    });
    await check(`${side} 整份影契可移植自訂名，PP攜帶消強降級及低血百分比吸取全部執行`,async()=>{
      const sk={...h.find('5023','影契·噬滅'),name:'自訂影契',description:'不靠原精靈名稱',power:0,category:'屬性'};
      const guard={name:'拒絕異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,params:{clause:{raw:'免疫異常',trig:'before_status',parsed:true,body:[{acts:[a('status_guard',{cls:''})]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('S',4000,[sk,h.wait()],{maxHp:10000,statStages:{atk:2,def:-1},extra:{soulMark:guard}}),opp:h.unit('E',10000,[h.wait()],{statStages:{def:2},extra:{soulMark:guard}})});
      assert.equal(r.opp.currentHp,5000);assert.equal(r.self.currentHp,9000);assert.equal(r.self.statStages.atk,0);assert.equal(r.self.statStages.def,0);
      assert.ok(Object.values(r.opp.statStages).every(v=>v===-1));assert.deepEqual(r.self.skills.map((s:any)=>s.pp),[sk.pp-1,99]);
    });
    await check(`${side} 正常出招只消耗本槽；攜帶槽不需命中，其他槽不重播`,async()=>{
      const one=carriedSkill('獨立甲',[{acts:[a('dmg',{flat:17,type:'固定'})]}]),two=carriedSkill('獨立乙',[{acts:[a('dmg',{flat:1000,type:'固定'})]}]);
      const [r]=await h.play(side,{self:h.unit('S',90000,[one,two]),opp:h.unit('E',90000,[h.wait()])});
      assert.equal(r.opp.currentHp,89983);assert.deepEqual(r.self.skills.map((s:any)=>s.pp),[98,99]);
      const failed={...one,category:'物理',power:100,accuracy:0,isSureHit:false};
      const [f]=await h.play(side,{self:h.unit('S',90000,[failed,two]),opp:h.unit('E',90000,[h.wait()])});assert.equal(f.opp.currentHp,89983,'攜帶不依主技能命中');
    });
    await check(`${side} 對手削PP通知所有實際槽；恢復PP和零消耗都不觸發`,async()=>{
      const one=carriedSkill('甲',[{acts:[a('dmg',{flat:17,type:'固定'})]}]),two=carriedSkill('乙',[{acts:[a('dmg',{flat:23,type:'固定'})]}]);
      const run=(mode:string,amount:number)=>h.play(side,{self:h.unit('S',90000,[{...one,pp:0},two,h.wait()]),opp:h.unit('E',90000,[h.kitSkill('改PP',[a('pp_op',{side:'opp',mode,amount})])]),turns:()=>[2,0]});
      assert.equal((await run('reduce',1))[0].opp.currentHp,89977,'原本0PP槽不觸發');
      assert.equal((await run('add',1))[0].opp.currentHp,90000);assert.equal((await run('reduce',0))[0].opp.currentHp,90000);
    });
    await check(`${side} 內部削PP與補满循環每槽一次；新外部消耗重新起算，不殘留連鎖`,async()=>{
      const one=carriedSkill('扣全PP',[{acts:[a('pp_op',{side:'self',mode:'reduce',amount:1}),a('dmg',{flat:7,type:'固定'})]}]);
      const two=carriedSkill('補全PP',[{acts:[a('pp_op',{side:'self',mode:'recover'}),a('dmg',{flat:11,type:'固定'})]}]);
      const hist=await h.play(side,{self:h.unit('S',90000,[one,two]),opp:h.unit('E',90000,[h.wait()])},2);
      assert.equal(hist[0].opp.currentHp,89982);assert.equal(hist[1].opp.currentHp,89964);
      assert.deepEqual(hist[1].self.skills.map((s:any)=>s.pp),[99,99]);assert.equal(hist[1].state[`${side}RegistryState`].ppCarryChain,undefined);
    });
    await check(`${side} 帝永壁令使用當回合回血轉盾，以实际恢復量為基數；全屬性提升前判定`,async()=>{
      const sk=h.find('5002','帝永壁令');
      const [r]=await h.play(side,{self:h.unit('S',1000,[sk],{maxHp:3000,statStages:{atk:1}}),opp:h.unit('E',90000,[h.wait()])});
      assert.equal(r.self.currentHp,2000);assert.equal(r.self.shield,500);assert.equal(r.self.statStages.atk,3);assert.equal(r.self.statStages.def,2);
      const [full]=await h.play(side,{self:h.unit('S',3000,[sk]),opp:h.unit('E',90000,[h.wait()])});assert.equal(full.self.shield||0,0,'滿血無恢復量不憑空生盾');
    });
    await check(`${side} 粉末擊打兩條失敗分支獨立：免疫寄生及中毒時百分比與固定都附加`,async()=>{
      const sk={...h.find('5011','星光·粉末擊打'),power:0,category:'屬性',isSureHit:true};
      const guard={name:'拒絕異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,params:{clause:{raw:'免疫異常',trig:'before_status',parsed:true,body:[{acts:[a('status_guard',{cls:''})]}]}}}]};
      const [r]=await h.play(side,{self:h.unit('S',4000,[sk]),opp:h.unit('E',10000,[h.wait()],{extra:{soulMark:guard}})});
      assert.equal(r.opp.currentHp,8800);assert.deepEqual(h.statuses(r.opp),[]);
    });
    await check(`${side} 寄生種子含使用回合結束共5次吸取；草/草雙系不生效`,async()=>{
      const sk={...h.find('5011','寄生種子'),isSureHit:true};
      const hist=await h.play(side,{self:h.unit('S',10000,[sk,h.wait()],{maxHp:100000}),opp:h.unit('E',80000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},6);
      assert.equal(hist[4].opp.currentHp,30000);assert.equal(hist[5].opp.currentHp,30000);assert.equal(hist[4].self.currentHp,60000);
      const [grass]=await h.play(side,{self:h.unit('S',10000,[sk]),opp:h.unit('E',80000,[h.wait()],{type:'草·水'})});assert.equal(grass.opp.currentHp,80000);
    });
    await check(`${side} 陰世遊靈當回合回血，真傷只從下回合攻擊觸發，到期停止`,async()=>{
      const sk=h.find('5001','陰世遊靈'),hit={...h.wait(),name:'試擊',category:'物理',power:0};
      const hist=await h.play(side,{self:h.unit('S',1000,[sk,hit],{maxHp:10000}),opp:h.unit('E',90000,[h.wait()]),turns:(_e,t)=>[t===1?0:1,0]},5);
      assert.equal(hist[0].self.currentHp,6000);assert.equal(hist[0].opp.currentHp,90000);
      const loss=(i:number)=>(i?hist[i-1].opp.currentHp:90000)-hist[i].opp.currentHp;
      assert.equal(loss(1),250);assert.equal(loss(2),250);assert.equal(loss(3),250);assert.equal(loss(4),0);
    });
    await check(`${side} 窒息轉化中斷原技能連續威力，解除後同槽灰燼從40重新起算`,async()=>{
      const ash=h.find('5006','灰燼');
      const hist=await h.play(side,{self:h.unit('S',90000,[ash]),opp:h.unit('E',90000,[h.wait()]),turns:(engine,t)=>{
        if(t===3||t===4){const elf=engine.getState()[side];elf.effects=t===3?[{id:'窒息',name:'窒息',duration:10}]:[];elf.battleStatuses=t===3?{'窒息':10}:{};}
        return [0,0];
      }},5);
      const adds=hist.map((r,i)=>r.logs.slice(i?hist[i-1].logs.length:0).filter((s:string)=>s.includes('本次攻擊威力 +')));
      assert.ok(adds[1].some((s:string)=>s.includes('+20')));assert.equal(adds[2].length,0);assert.ok(adds[3].some((s:string)=>s.includes('+0')));assert.ok(adds[4].some((s:string)=>s.includes('+20')));
    });
    await check(`${side} 條件必中是附加查詢，固有失效不抹掉；附加封印則回到固有命中率`,async()=>{
      const source=h.find('5031','界・裁決之劍'),kit=source.kit.filter((e:any)=>e.codeId==='skill_property');
      const sk={...source,name:'條件必中驗證',description:'',accuracy:0,kit:kit.map((e:any)=>e.params.property==='base_accuracy'?{...e,params:{...e.params,value:0}}:e)};
      const run=(extra:any)=>h.play(side,{self:h.unit('S',90000,[sk],{statStages:{atk:-1},extra}),opp:h.unit('E',90000,[h.wait()])});
      assert.ok((await run({isInherentInvalid:true}))[0].opp.currentHp<90000,'附加必中仍生效');
      assert.equal((await run({isAdditionalInvalid:true}))[0].opp.currentHp,90000,'封印後0命中率MISS');
    });
  }
  await check('正式結算拋錯只扣一次PP，停止託管並清除選招，不自動重跑失敗回合',async()=>{
    const {createBattleEngine}=await h.server.ssrLoadModule('/src/engine/battleEngine.ts');
    const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');const registry=getBattleSkillRegistry();
    let called=0,errors=0;registry['後台單次失敗']=()=>{called++;throw new Error('刻意驗證失敗');};
    const engine=createBattleEngine({initialP1Team:[h.unit('S',90000,[{...h.wait(),name:'後台單次失敗'}])],initialP2Team:[h.unit('E',90000,[h.wait()])],p1StarterId:'S',p2StarterId:'E',battleMode:'PVP',preparedTeams:true,isFast:()=>true,onSimulationError:()=>errors++});
    try {engine.mount();engine.start();await engine.idle();engine.onSkillSelect('p1',engine.getState().p1.skills[0]);engine.onSkillSelect('p2',engine.getState().p2.skills[0]);await engine.idle();
      assert.equal(called,1);assert.equal(errors,1);assert.equal(engine.getState().p1.skills[0].pp,98);assert.equal(engine.getState().phase,'p1_select');
      assert.equal(engine.getState().p1SelectedSkill,null);assert.equal(engine.getState().p2SelectedSkill,null);assert.equal(engine.getState().isAutoBattle,false);
      assert.ok(engine.getState().logs.some((l:any)=>String(l.text).includes('停止自動重試')));
    }finally{engine.unmount();delete registry['後台單次失敗'];}
  });
  await check('能力視圖與命中率走明確查詢；改積木參數後不依原文回退',async()=>{
    const {skillStageView}=await h.server.ssrLoadModule('/src/battle/skillStageView.ts');
    const {applyFormulaProperties,readAttachedSureHit}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
    const s=h.find('5023','影契·噬滅');assert.equal(skillStageView({statStages:{def:3}},s,'def',true),-3);
    const changed={...s,kit:s.kit.filter((e:any)=>e.params.property!=='stage_view')};assert.equal(skillStageView({statStages:{def:3}},changed,'def',true),3);
    const accuracy=h.find('300','靈魂干涉'),ctx:any={self:{statStages:{}},getPlayerState:()=>0};assert.equal(applyFormulaProperties(accuracy,ctx).accuracy,70);
    const judicial=h.find('5031','界・裁決之劍');assert.equal(readAttachedSureHit(judicial,{...ctx,self:{statStages:{atk:-1}}}),true);
    assert.equal(readAttachedSureHit(judicial,{...ctx,self:{statStages:{atk:-1},isAdditionalInvalid:true}}),false);
    assert.equal(readAttachedSureHit(judicial,{...ctx,self:{statStages:{atk:-1},isInherentInvalid:true}}),true);
  });
  console.log(`${checks} 事件Kit語意情境通過；不代表全精靈逐句驗收`);
}finally{await h.close();}
