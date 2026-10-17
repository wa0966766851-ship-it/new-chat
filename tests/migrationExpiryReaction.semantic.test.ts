import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_EXPIRY_REACTION_SKILL_KITS as definitions} from '../src/data/migratedExpiryReactionSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const {getBattleSkillRegistry,hasSkillHandler}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {effectRoute}=await h.server.ssrLoadModule('/src/effects/effectConnection.ts');
const legacy=getBattleSkillRegistry(),original=legacy['晨曦昭世'];let legacyCalls=0;
legacy['晨曦昭世']=(ctx:any)=>{legacyCalls++;return original(ctx);};
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5014','晨曦昭世'),power:0,category:'屬性'});
const clear=()=>h.kitSkill('消除對手回合',[{op:'clear_turn',p:{side:'opp'}}]);
const statuses=(values:Record<string,number>)=>({battleStatuses:values,effects:Object.entries(values).map(([id,duration])=>({id,name:id,duration,stacks:1}))});
const duration=(elf:any,id:string)=>elf.effects?.find((e:any)=>e.id===id)?.duration||0;
const reg=(r:any,side:string,key:string)=>Number(r.state[`${side}RegistryState`]?.[key]||0);
function roundtrip(active:any,edit?:(block:any)=>void){
  defineCustomBlocks();const workspace=new Blockly.Workspace(),reload=new Blockly.Workspace();
  try{
    for(const entry of active.kit){const b=buildEntryBlock(workspace as any,entry);assert.ok(b);assert.notEqual(b.type,'native_effect_reference');}
    for(const b of workspace.getAllBlocks(false))edit?.(b);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),reload);
    const kit=reload.getTopBlocks(false).map(b=>{const old=JSON.parse(b.data!).entry;return createKitBlockParser('skill')(b,old.node,old.order);}).sort((a,b)=>a!.order-b!.order);
    return {...active,kit};
  }finally{workspace.dispose();reload.dispose();}
}
try{
  await check('完整原文、持有者、單一Kit入口與Blockly保存重載一致',async()=>{
    const active=skill();assert.equal(active.description,definitions[0].description);assert.deepEqual(active.kit,definitions[0].kit);
    assert.equal(active.effectMode,'kit');assert.equal(effectRoute(active,hasSkillHandler(active.name)),'kit');
    assert.deepEqual(roundtrip(active).kit,active.kit);
    const {applyReviewedSkillKits}=await h.server.ssrLoadModule('/src/data/reviewedKitCatalogue.ts');
    const source={...active,effectMode:undefined,kit:undefined};
    for(const [id,s] of [['wrong',source],['5014',{...source,description:source.description+'自訂'}],['5014',{...source,effectMode:'registry'}]] as any){
      assert.equal(applyReviewedSkillKits({id,skills:[s]}).skills[0].kit,undefined);
    }
    const {readBasePriority,readSkillProperty}=await h.server.ssrLoadModule('/src/effects/skillProperty.ts');
    const ctx={actor:'p1',targetSide:'p2',self:{},target:{},getPlayerState:()=>0,getOpponentState:()=>0};
    assert.equal(readBasePriority(active,ctx),1);assert.equal(readSkillProperty(active,'sure_hit',ctx),true);
  });
  for(const side of ['p1','p2'] as const){const other=side==='p1'?'p2':'p1';
    await check(`${side} 四回合使用真傷按自身上限20%，授予本次不補算，第五回合停止`,async()=>{
      const history=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()]),opp:h.unit('E',100000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[100000,98000,96000,94000,94000]);
    });
    await check(`${side} 所有異常免疫反彈五回合，控制／附屬皆走正式狀態管道，第六回合恢復`,async()=>{
      for(const id of ['狂暴','麻痺']){
        const status=h.kitSkill('施加異常',[{op:'status',p:{side:'opp',status:id,turns:3,chance:100}}]);
        const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()]),opp:h.unit('E',100000,[status]),turns:(_,t)=>[t===1?0:1,0]},6);
        // 控制異常可能阻止後續敵方行動；其反彈只在第一回合斷言，完整五回合以附屬類驗證。
        assert.equal(h.statuses(history[0].self).includes(id),false);assert.ok(h.statuses(history[0].opp).includes(id));
        if(id==='狂暴'){for(const r of history.slice(0,5))assert.equal(h.statuses(r.self).includes(id),false);assert.ok(h.statuses(history[5].self).includes(id));}
      }
    });
    await check(`${side} 無異常僅免疫當回合起兩回合；雙方2+3異常期限則免疫七回合`,async()=>{
      const attack={...h.wait(),name:'必中物理',category:'物理',power:30,isSureHit:true};
      for(const extended of [false,true]){
        const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{extra:extended?statuses({狂暴:2}):{}}),
          opp:h.unit('E',100000,[attack],{extra:extended?statuses({星哲:3}):{}}),turns:(_,t)=>[t===1?0:1,0]},extended?8:3);
        const n=extended?7:2;assert.equal(reg(history[0],side,'immuneAttackTurns'),n-1);
        for(const r of history.slice(0,n))assert.equal(r.self.currentHp,50000,r.logs.join('\n'));
        assert.ok(history[n].self.currentHp<50000);
      }
    });
    await check(`${side} 清除監控本身，新星贖3回合／已有星贖+2保留期限；取消到期禁換`,async()=>{
      for(const existing of [false,true]){
        const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{extra:existing?statuses({星贖:5}):{}}),
          opp:h.unit('E',100000,[clear(),h.wait()],{extra:existing?statuses({星贖:4}):{}}),turns:(_,t)=>[t===1?0:1,t===1?0:1]},4);
        // 星贖自己在階段結束+1，再正常扣1，因此回合後仍是原期限。
        assert.equal(duration(history[0].self,'星贖'),existing?7:3);assert.equal(duration(history[0].opp,'星贖'),existing?6:3);
        for(const r of history)assert.equal(reg(r,other,'noSwitchTurns'),0);
      }
    });
    await check(`${side} 清除受保護時未觸發；第3回合到期才禁換兩回合，真實换人到第6回合可行`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{extra:{ownTurnEffectsUnclearable:true}}),
        opp:h.unit('E',100000,[clear(),h.wait()]),oppBench:[h.unit('B',100000,[h.wait()])],turns:(engine,t)=>{
          if(t===4||t===5){engine.onSwitchElf(other,1);assert.equal(engine.getState()[other].id,'E');}
          return [t===1?0:1,t===1?0:t===6?{switch:1}:1];
        }},6);
      for(const r of history)assert.equal(h.statuses(r.self).includes('星贖'),false);
      assert.deepEqual(history.slice(0,5).map(r=>reg(r,other,'noSwitchTurns')),[0,0,2,1,0]);assert.equal(history[5].opp.id,'B');
    });
    await check(`${side} Blockly改到期禁換2→1與自身免疫加總範圍，保存重載後正式引擎改變`,async()=>{
      const edited=roundtrip(skill(),b=>{
        if(b.type!=='sequence_action')return;const op=b.getFieldValue('OP'),p=JSON.parse(b.getFieldValue('PARAMS'));
        if(op==='timed'&&p.once){p.onExpire[0].acts[0].p.turns=1;b.setFieldValue(JSON.stringify(p),'PARAMS');}
        if(op==='immune_attack_turns'){p.extendByStatusTurns='self';b.setFieldValue(JSON.stringify(p),'PARAMS');}
      });
      const history=await h.play(side,{self:h.unit('S',50000,[edited,h.wait()],{extra:statuses({狂暴:2})}),opp:h.unit('E',100000,[h.wait()],{extra:statuses({星哲:3})}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.equal(reg(history[0],side,'immuneAttackTurns'),3);assert.deepEqual(history.map(r=>reg(r,other,'noSwitchTurns')),[0,0,1,0]);
    });
    await check(`${side} 原魂印名稱下旧技能监控键不寫入，不重播旧同名技能處理器`,async()=>{
      const history=await h.play(side,{self:h.unit('S',50000,[skill(),h.wait()],{extra:{name:'聖光斯嘉麗',soulMark:{name:'燦',description:''}}}),
        opp:h.unit('E',5000000,[h.wait()]),turns:(_,t)=>[t===1?0:1,0]},3);
      for(const r of history){assert.equal(reg(r,side,'clearWatchTurns'),0);assert.equal(reg(r,side,'selfSkillTrueDmgTurns'),0);
        assert.equal(r.logs.some((l:string)=>l.includes('【晨曦昭世】：5回合免疫')||l.includes('【晨曦昭世】：附加自身最大體力')),false);}
    });
  }
  await check('完整Kit從未調用舊處理器；自訂registry模式仍保留原有入口',async()=>{
    assert.equal(legacyCalls,0);
    const custom={...skill(),effectMode:'registry',kit:undefined,description:'自訂保留舊路徑'};
    assert.equal(effectRoute(custom,true),'registry');
    await h.play('p1',{self:h.unit('S',50000,[custom]),opp:h.unit('E',100000,[h.wait()])});
    assert.equal(legacyCalls,1);
  });
  console.log(`到期反應整份遷移：${checks}項通過，未授予全部定義全文語意驗收`);
}finally{legacy['晨曦昭世']=original;await h.close();}
