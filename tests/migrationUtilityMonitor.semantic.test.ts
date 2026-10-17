import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {defineCustomBlocks,buildEntryBlock,createKitBlockParser} from '../src/components/BlocklyBuilder';
import {MIGRATED_UTILITY_MONITOR_SKILL_KITS as defs} from '../src/data/migratedUtilityMonitorSkillKits';
import source from '../src/data/elfSourceText.json';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0,calls=0;
const {EffectTiming:T}=await h.server.ssrLoadModule('/src/effects/types.ts');
const {getBattleSkillRegistry}=await h.server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
const {handleDixinSoulMark}=await h.server.ssrLoadModule('/src/effects/elves/dixin/registry.ts');
const {sequenceIssue,skillPropertyIssue}=await h.server.ssrLoadModule('/src/effects/sequenceContract.ts');
const registry=getBattleSkillRegistry(),saved=registry['人皇御宇'];registry['人皇御宇']=(c:any)=>{calls++;return saved(c);};
const skill=()=>structuredClone(h.find('5017','人皇御宇'));
const a=(op:string,p:any)=>({op,p,label:op});
const check=async(n:string,f:()=>void|Promise<void>)=>{await f();checks++;console.log(`✓ ${n}`);};
const only=(...orders:number[])=>({...skill(),kit:skill().kit.filter((e:any)=>orders.includes(e.order))});
const trait=(node:string,trig:string,acts:any[])=>({name:'共用防護',effectMode:'kit',kit:[{codeId:'effect_sequence',node,source:'mechanic',order:0,params:{clause:{raw:'共用防護',trig,parsed:true,body:[{acts}]}}}]});
const own=(r:any,side:string)=>r.state[`${side}Marks`].find((m:any)=>m.id==='fumo_mark'&&m.ownerBattleId==='S')?.count||0;
const attack=()=>h.kitSkill('攻擊附加強化',[a('stat',{side:'self',stats:['防禦'],v:1})],{category:'物理',power:10});
function init(count:number,observe?:(c:any,e:any,d:any)=>void){h.S.S=(c:any,e:any,d:any)=>{
  if(e===T.ON_ENTRANCE)c.setMark({id:'bahuang_mark',name:'八荒',count,ownerBattleId:c.self.battleId||c.self.id},c.actor);
  observe?.(c,e,d);
};}
function reload(s:any,edit=false){defineCustomBlocks();const w=new Blockly.Workspace(),r=new Blockly.Workspace();
  try{for(const e of s.kit){const slot=w.newBlock('custom_node_slot');slot.setFieldValue(e.node,'TARGET_NODE');const b=buildEntryBlock(w as any,e)!;assert.ok(b);slot.getInput('STACK')!.connection!.connect(b.previousConnection!);}
    if(edit)for(const b of w.getAllBlocks(false)){
      if(b.type==='skill_property'&&b.getFieldValue('PROPERTY')==='base_priority'){const cs=JSON.parse(b.getFieldValue('CONDITIONS'));cs[0].p.amount=2;b.setFieldValue(JSON.stringify(cs),'CONDITIONS');}
      if(b.type==='sequence_action'&&b.getFieldValue('OP')==='timed'){const p=JSON.parse(b.getFieldValue('PARAMS'));p.turns=2;
        if(p.trig==='round_end'){p.body[0].acts[0].p.ratio=.25;p.body[1].acts[0].p.flat=200;p.body[1].acts[1].p.amount=2;}
        b.setFieldValue(JSON.stringify(p),'PARAMS');
      }
    }
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(w),r);
    return {...s,kit:r.getTopBlocks(false).map((slot:any,i:number)=>createKitBlockParser('skill')(slot.getInputTargetBlock('STACK'),slot.getFieldValue('TARGET_NODE'),i)!)};
  }finally{w.dispose();r.dispose();}
}
try{
  await check('整份原文5條及持有者精確匹配、全Blockly往返、固有與附加合約',()=>{
    const s=skill();assert.equal(s.description,(source as any)['5017'].skills[s.name].d);assert.equal(s.description,defs[0].description);assert.deepEqual(s.kit,defs[0].kit);assert.equal(s.kit.length,5);assert.equal(s.effectMode,'kit');assert.deepEqual(reload(s).kit,s.kit);
    for(const e of s.kit)assert.equal(e.codeId==='skill_property'?skillPropertyIssue(e):sequenceIssue(e.params.clause,e.node),null);
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 原始八荒0／2沒有先制，3層+3；原魂印路由不再雙加`,async()=>{
      for(const n of [0,2,3]){const order:string[]=[];init(n,(c,e,d)=>{if(e===T.MODIFY_PRIORITY)handleDixinSoulMark(c,e,d);if(e===T.BEFORE_ACTION)order.push('S');});h.S.E=(_,e)=>{if(e===T.BEFORE_ACTION)order.push('E');};
        await h.play(side,{self:h.unit('S',100000,[only(0,1)],{speed:50}),opp:h.unit('E',100000,[{...h.wait(),priority:2}],{speed:200})});assert.equal(order[0],n===3?'S':'E');
      }delete h.S.E;
    });
    await check(`${side} 臣服成功不給星賜；免疫失敗給星賜且下兩回合攻擊無效，第三回合恢復`,async()=>{
      init(0);const [s]=await h.play(side,{self:h.unit('S',100000,[only(0,1,2)],{speed:200}),opp:h.unit('E',100000,[h.wait()])});assert.ok(h.statuses(s.opp).includes('臣服'));assert.ok(!h.statuses(s.self).includes('星賜'));
      const immunity=trait('on_entered','entrance',[a('immune_status_turns',{turns:10,cls:'弱化類',reflect:false})]);
      const history=await h.play(side,{self:h.unit('S',100000,[only(0,1,2),h.wait()],{speed:200}),opp:h.unit('E',100000,[attack()],{extra:{trait:immunity}}),turns:(_,t)=>[t===1?0:1,0]},4);
      assert.ok(h.statuses(history[0].self).includes('星賜'));assert.ok(!h.statuses(history[0].opp).includes('臣服'));
      assert.equal(history[1].self.currentHp,history[0].self.currentHp);assert.equal(history[2].self.currentHp,history[0].self.currentHp);assert.ok(history[3].self.currentHp<history[2].self.currentHp);
      assert.equal(history[2].opp.statStages.def||0,1);assert.equal(history[3].opp.statStages.def,2);
    });
    await check(`${side} 完整原招每回合吸取1/3最大體力共4次，包含啟動回合，第5回合停止`,async()=>{
      init(0);const history=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:100000,speed:200}),opp:h.unit('E',3000,[h.healSkill(1000)]),turns:(_,t)=>[t===1?0:1,0]},5);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[2000,2000,2000,2000,3000]);assert.deepEqual(history.map(r=>r.self.currentHp),[11000,12000,13000,14000,14000]);assert.ok(history.every(r=>own(r,side)===0));
    });
    await check(`${side} 未受到百分比傷害才300真傷與原持有者伏魔；減半不觸發、護罩吸收仍按正式扣血判斷`,async()=>{
      for(const mode of ['normal','immune','reduced','barrier','cap']){init(0);
        const defense=mode==='immune'||mode==='reduced'?trait('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:mode==='immune'?1:.5})]):mode==='cap'?trait('on_entered','entrance',[a('damage_cap_turns',{side:'self',dir:'in',kind:'百分比',cap:0,turns:2,next:false})]):undefined;
        const [r]=await h.play(side,{self:h.unit('S',5000,[skill()],{maxHp:100000,speed:200}),opp:h.unit('E',6000,[h.wait()],{maxHp:9000,extra:{trait:defense,...(mode==='barrier'?{barrier:9000}:{})}})});
        const fallback=['immune','barrier','cap'].includes(mode);assert.equal(own(r,side),fallback?1:0,r.logs.join('\n'));
        assert.equal(r.opp.currentHp,fallback?5700:mode==='reduced'?4500:3000);assert.equal(r.self.currentHp,mode==='immune'||mode==='cap'?5000:mode==='reduced'?6500:8000);
        if(mode==='barrier')assert.equal(r.opp.barrier,6000);
      }
    });
    await check(`${side} 使用屬性後只封下回合攻擊附加與技能傷害；命中／固有／非技能傷害仍在，最末監控能保留下回合效果`,async()=>{
      init(0);const hits:boolean[]=[],invalids:string[]=[];
      h.S.E=(c,e,d)=>{if(e===T.SKILL_INVALID)invalids.push(d?.reason);
        if(e===T.BEFORE_DAMAGE&&!d?.isIncoming&&d?.damageCategory==='fixed')c.applySkillTypeDamage(c.targetSide,50,'巢狀技能分類驗證',{category:'skill_attribute',elem:'普通'});
        if(e===T.AFTER_ACTION&&c.skill?.category!=='屬性'){
        hits.push(c.isHit);c.applySkillTypeDamage(c.targetSide,200,'獨立乘區技能驗證',{category:'skill_attribute',elem:'普通',pure:true,ignoreLimit:true});c.applySkillTypeDamage(c.targetSide,100,'一般技能分類驗證',{category:'skill_attribute',elem:'普通'});c.applyFixedDamage(c.targetSide,30,'固傷分類驗證');c.applyTrueDamage(c.targetSide,20,'真傷分類驗證');
      }};
      const history=await h.play(side,{self:h.unit('S',50000,[only(0,1,3),h.wait()],{speed:200}),opp:h.unit('E',50000,[h.wait(),attack()]),turns:(_,t)=>[t===1?0:1,[1,4].includes(t)?0:1]},6);
      assert.equal(history[1].self.currentHp,49950,history[1].logs.join('\n'));assert.ok(history[2].self.currentHp<history[1].self.currentHp-50);assert.equal(history[4].self.currentHp,history[3].self.currentHp-50);assert.ok(history[5].self.currentHp<history[4].self.currentHp-50);
      assert.deepEqual(history.map(r=>r.opp.statStages.def||0),[0,0,1,1,1,2]);assert.deepEqual(hits,[true,true,true,true]);assert.equal(invalids.length,0);delete h.S.E;
    });
    await check(`${side} 消除自身回合類效果停止未來吸取；換人不把原持有者監控借給新精靈`,async()=>{
      init(0);const clear=h.kitSkill('清除對方回合類效果',[a('clear_turn',{side:'opp'})]);
      const history=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:100000,speed:200}),opp:h.unit('E',9000,[h.wait(),clear]),turns:(_,t)=>[t===1?0:1,t===2?1:0]},3);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[6000,6000,6000]);
      const switched=await h.play(side,{self:h.unit('S',10000,[skill(),h.wait()],{maxHp:100000,speed:200}),selfBench:[h.unit('B',50000,[h.wait()])],opp:h.unit('E',9000,[h.wait()]),turns:(_,t)=>[t===1?0:{switch:1},0]},2);
      assert.equal(switched[1].self.id,'B');assert.equal(switched[1].self.currentHp,50000);assert.equal(switched[1].opp.currentHp,6000);
    });
    await check(`${side} 附加封印／未命中不建立任何監控；固有封印取消先制但附加仍有效`,async()=>{
      for(const sealed of [true,false]){init(3);const s=sealed?skill():{...skill(),accuracy:0,isSureHit:false,kit:skill().kit.filter((e:any)=>e.params.property!=='sure_hit')};
        const [r]=await h.play(side,{self:h.unit('S',10000,[s],{maxHp:100000,extra:sealed?{isAdditionalInvalid:true}:{}}),opp:h.unit('E',9000,[h.wait()])});assert.equal(r.opp.currentHp,9000);assert.equal(r.self.currentHp,10000);assert.ok(!h.statuses(r.opp).includes('臣服'));assert.equal(r.state[`${side}Timers`].length,0);
      }
      init(3);const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:100000,extra:{isInherentInvalid:true}}),opp:h.unit('E',9000,[h.wait()])});assert.equal(r.opp.currentHp,6000);assert.ok(h.statuses(r.opp).includes('臣服'));
    });
    await check(`${side} Blockly改門檻／監控期限／比例／真傷／層數後改名實行，原魂印timer不存在`,async()=>{
      init(2);const edited={...reload(skill(),true),name:'改名御宇'};
      const immune=trait('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:1})]);const history=await h.play(side,{self:h.unit('S',5000,[edited,h.wait()],{maxHp:100000}),opp:h.unit('E',6000,[h.wait()],{maxHp:9000,extra:{trait:immune}}),turns:(_,t)=>[t===1?0:1,0]},3);
      assert.deepEqual(history.map(r=>r.opp.currentHp),[5800,5600,5600]);assert.deepEqual(history.map(r=>own(r,side)),[2,4,4]);assert.ok(history.every(r=>!r.state[`${side}Timers`].some((t:any)=>t.id==='dixin_yuyu')));
    });
  }
  for(const side of ['p1','p2'] as const)await check(`${side} 真實原魂印仍有78附加固傷，御宇只吸取一次且失敗只添一層伏魔`,async()=>{
    delete h.S.S;delete h.S.E;
    const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>e.id==='5017');
    for(const immune of [false,true]){
      const defense=immune?trait('before_damage','incoming_nontrue',[a('dmg_mod',{dir:'in',kind:'百分比',reduce:1})]):undefined;
      const [r]=await h.play(side,{self:h.unit('S',10000,[skill()],{maxHp:100000,speed:200,extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',9000,[h.wait()],{extra:{trait:defense}})});
      assert.equal(r.opp.currentHp,immune?8622:5922,r.logs.join('\n'));assert.equal(r.self.currentHp,immune?10000:13000);assert.equal(own(r,side),immune?1:0);
      assert.ok(!r.state[`${side}Timers`].some((t:any)=>t.id==='dixin_yuyu'));
    }
  });
  assert.equal(calls,0);console.log(`${checks} utility monitor checks passed; legacy calls ${calls}`);
}finally{registry['人皇御宇']=saved;delete h.S.S;delete h.S.E;await h.close();}
