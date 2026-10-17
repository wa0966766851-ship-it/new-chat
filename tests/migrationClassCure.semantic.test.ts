import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import {buildEntryBlock,createKitBlockParser,defineCustomBlocks} from '../src/components/BlocklyBuilder';
import {MIGRATED_CLASS_CURE_SKILL_KITS as definitions} from '../src/data/migratedClassCureSkillKits';
import {createHarness} from './helpers/migrationHarness';
const h=await createHarness();let checks=0;
const check=async(name:string,fn:()=>void|Promise<void>)=>{await fn();checks++;console.log(`✓ ${name}`);};
const skill=()=>({...h.find('5007','深海働哭'),power:0,category:'屬性'});
const initial=(names:string[])=>({battleStatuses:Object.fromEntries(names.map(n=>[n,5])),effects:names.map(n=>({id:n,name:n,duration:5,stacks:1}))});
const guard={name:'拒絕異常',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_status_apply',source:'soulmark',order:0,
  params:{clause:{raw:'免疫',trig:'before_status',parsed:true,body:[{acts:[{op:'status_guard',p:{cls:''},label:'免疫'}]}]}}}]};
const reduction=(reduce:number)=>({name:'百分比限制',effectMode:'kit',kit:[{codeId:'effect_sequence',node:'before_damage',source:'mechanic',role:'innate',order:0,
  params:{clause:{raw:'百分比限制',trig:'incoming',parsed:true,body:[{acts:[{op:'dmg_mod',p:{dir:'in',kind:'百分比',reduce},label:'減少'}]}]}}}]});
try{
  await check('分類淨化原句可解析、分類不丟失；未知分類仍拒絕',async()=>{
    const {distillEffect}=await h.server.ssrLoadModule('/src/effects/distillEffect.ts');
    for(const cls of ['非附屬類','附屬類','控制類','弱化類','限制類','衍化類']){
      const result=distillEffect({name:'分類淨化',description:`🎯 解除自身所有${cls}異常狀態`},'skill');
      assert.equal(result.complete,true,cls);assert.equal(result.kit[0].params.clause.body[0].acts[0].p.cls,cls);
    }
    assert.equal(distillEffect({name:'分類淨化',description:'🎯 解除自身所有未知類異常狀態'},'skill').complete,false);
  });
  await check('深海完整來源與Kit路由，Blockly保存重載保留分類、原目標與命中事件',()=>{
    const def=definitions[0],loaded=skill();assert.equal(loaded.description,def.description);assert.equal(loaded.effectMode,'kit');assert.deepEqual(loaded.kit,def.kit);
    defineCustomBlocks();const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
    try{
      for(const entry of loaded.kit){const block=buildEntryBlock(workspace as any,entry);assert.ok(block);assert.notEqual(block.type,'native_effect_reference');}
      Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
      const entries=restored.getTopBlocks(false).map(block=>{const old=JSON.parse(block.data!).entry;return createKitBlockParser('skill')(block,old.node,old.order);}).sort((a,b)=>a!.order-b!.order);
      assert.deepEqual(entries,loaded.kit);
    }finally{workspace.dispose();restored.dispose();}
  });
  for(const side of ['p1','p2'] as const){
    await check(`${side} 非附屬類解除保留狂暴；編輯分類後只解除附屬類`,async()=>{
      for(const cls of ['非附屬類','附屬類']){
        const active=skill();active.kit=structuredClone(active.kit);
        const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
        try{
          const entry=active.kit[4];buildEntryBlock(workspace as any,entry);
          const action=workspace.getAllBlocks(false).find(b=>b.type==='sequence_action'&&b.getFieldValue('OP')==='cure_status');assert.ok(action);
          const params=JSON.parse(action.getFieldValue('PARAMS'));action.setFieldValue(JSON.stringify({...params,cls}),'PARAMS');
          Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
          active.kit[4]=createKitBlockParser('skill')(restored.getTopBlocks(false)[0],entry.node,entry.order);
          assert.equal(active.kit[4].params.clause.body[2].acts[0].p.cls,cls);
        }finally{workspace.dispose();restored.dispose();}
        const [r]=await h.play(side,{self:h.unit('S',200000,[active],{extra:initial(['中毒','狂暴'])}),opp:h.unit('E',200000,[h.wait()])});
        assert.equal(h.statuses(r.self).includes('中毒'),cls==='附屬類',r.logs.join('\n'));
        assert.equal(h.statuses(r.self).includes('狂暴'),cls==='非附屬類',r.logs.join('\n'));
      }
    });
    await check(`${side} 新增漸凍不清回合效果；原本已有或附加失敗才回合末清除`,async()=>{
      const other=side==='p1'?'p2':'p1';
      for(const mode of ['new','existing','immune']){
        const [r]=await h.play(side,{self:h.unit('S',200000,[skill()],{speed:200}),opp:h.unit('E',200000,[h.turnEffectSkill()],{extra:mode==='existing'?initial(['漸凍']):mode==='immune'?{soulMark:guard}:{}})});
        const remaining=(r.state[`${other}Timers`]||[]).filter((t:any)=>t.payload?.block?.statusGuard);
        assert.equal(remaining.length,mode==='new'?1:0,mode+'\n'+r.logs.join('\n'));
        if(mode==='existing')assert.ok(h.statuses(r.opp).includes('冰封'),r.logs.join('\n'));
      }
    });
    await check(`${side} 汲取四分之一是真實；百分比免疫時每次補300真傷，5回合到期`,async()=>{
      // 此情境只核對吸取期限；免疫異常排除漸凍→冰封→凍傷的獨立回合扣血。
      const history=await h.play(side,{self:h.unit('S',200000,[skill(),h.wait()]),opp:h.unit('E',200000,[h.wait()],{extra:{trait:reduction(1),soulMark:guard}}),turns:(_,turn)=>[turn===1?0:1,0]},6);
      assert.deepEqual(history.map((r:any)=>r.opp.currentHp),[149700,149400,149100,148800,148500,148500],history[5].logs.join('\n'));
      for(const stat of ['atk','def','spdef','speed','accuracy'])assert.equal(history[0].self.statStages[stat],2);
    });
    await check(`${side} 原持有者魂印不重播舊深海持續吸取或回合末處理`,async()=>{
      const {DEFAULT_ELVES}=await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');const owner=DEFAULT_ELVES.find((e:any)=>String(e.id)==='5007');
      const [r]=await h.play(side,{self:h.unit('S',200000,[skill()],{extra:{name:owner.name,soulMark:structuredClone(owner.soulMark)}}),opp:h.unit('E',200000,[h.wait()])});
      assert.equal(r.state[`${side}RegistryState`].deepSeaFreezeTarget,undefined);
      assert.ok(!(r.state[`${side}Timers`]||[]).some((t:any)=>t.id==='brinkk_deepsea'||t.id==='brinkk_freeze_pending'));
    });
  }
  console.log(`分類解除遷移：${checks}項通過，未授予完整交叉語意驗收`);
}finally{await h.close();}
