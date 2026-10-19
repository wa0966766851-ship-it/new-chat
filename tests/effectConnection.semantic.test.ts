import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { compileEffectPlan, kitEntryIssue } from '../src/effects/effectConnection';
import { parseEffectDescriptionLocal } from '../src/utils/aiTextParser';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import { DEFAULT_ELVES } from '../src/data/defaultElvesLoaded';
import type { KitEntry } from '../src/effects/effectSystem.schema';
import { distillEffect } from '../src/effects/distillEffect';
import * as Blockly from '../src/vendor/blockly/index.js';
import { defineCustomBlocks, buildEntryBlock, createKitBlockParser } from '../src/components/BlocklyBuilder';
import { EFFECT_NODES, eventEffectNode } from '../src/effects/effectNodes';
import { EffectTiming } from '../src/effects/types';
import { getElfAdvancedMechanics } from '../src/data/traitsRegistry';

let count = 0;
const check = (name: string, run: () => void) => { run(); console.log(`✓ ${name}`); count++; };
const entry = (node: KitEntry['node'], amount = 70): KitEntry => ({ codeId: 'heal', params: { amount }, node, source: 'skill', order: 0 });
check('42節點同一合約；含逐擊、額外行動、資源變動、擊敗未擊敗與持有者消除事件', () => {
  assert.equal(Object.keys(EFFECT_NODES).length,45); // 2026-10-18 before_stat_change；2026-10-19 cthyaat_death；2026-10-20 ally_entered（隊友登場，克塔亞特額外精靈用）（5007 克塔亞特被擊敗事件；正式被擊敗節點）
  assert.equal(eventEffectNode(EffectTiming.AFTER_ATTACK_HIT),'after_attack_hit');
  assert.equal(EFFECT_NODES.after_attack_hit.trigger,'attack_hit');
  assert.equal(eventEffectNode(EffectTiming.EXTRA_ACTION_START),'extra_action_start');
  assert.equal(eventEffectNode(EffectTiming.EXTRA_ACTION_END),'extra_action_end');
  assert.equal(eventEffectNode(EffectTiming.RESOURCE_CHANGED),'on_resource_changed');
  assert.equal(eventEffectNode(EffectTiming.BATTLE_START),'battle_start');
  assert.equal(eventEffectNode(EffectTiming.NOT_KILLED),'on_not_killed');
  assert.equal(eventEffectNode(EffectTiming.BEFORE_INSTANT_KILL),'before_instant_kill');
  assert.equal(eventEffectNode(EffectTiming.STAT_BOOST_CLEARED),'on_stat_boost_cleared');
  assert.equal(eventEffectNode(EffectTiming.TURN_EFFECTS_CLEARED),'on_turn_effects_cleared');
  assert.equal(eventEffectNode(EffectTiming.ON_STATUS_ENDED),'on_status_ended');
  assert.equal(eventEffectNode(EffectTiming.SELF_STATUS_APPLIED),'on_status_received');
  assert.equal(eventEffectNode(EffectTiming.ON_STATUS_IMMUNIZED),'on_status_immunized');
  assert.equal(eventEffectNode(EffectTiming.BEFORE_STATUS_TICK),'before_status_tick');
  assert.equal(eventEffectNode(EffectTiming.BEFORE_STATUS_APPLY),'before_status_apply');
  assert.equal(EFFECT_NODES.opponent_entered.trigger,'bench');assert.ok(EFFECT_NODES.opponent_entered.derived);
  for(const [node,contract] of Object.entries(EFFECT_NODES)) {
    if(contract.event) assert.equal(eventEffectNode(contract.event),node);
    else assert.ok(contract.derived);
    assert.equal(kitEntryIssue(entry(node as KitEntry['node'])),null,`${node}需通過正式圖紙驗證`);
    const plan=compileEffectPlan({name:'節點核對',kit:[entry(node as KitEntry['node'])]},'soul');
    assert.equal(plan.program.clauses[0].trig,contract.trigger);
  }
  assert.equal(eventEffectNode(EffectTiming.ACTION_FAILED),'on_invalid');
  assert.equal(eventEffectNode(EffectTiming.AFTER_DAMAGE),undefined,'同義受擊事件不得重複');
  assert.equal(eventEffectNode(EffectTiming.SKILL_INVALID),undefined,'雙側技能無效通知不與失敗收尾重播');
});
check('手動特質不被精靈名稱的舊自動補登覆蓋；其他未改來源保持', () => {
  const elf:any={id:'5026',name:'無序·墜星',skills:[],alienTraits:{gen2Trait:{name:'豪邁',description:'原文',effectMode:'kit',kit:[]},exclusiveTrait:{name:'投石者',description:'原文',effectMode:'description'}}};
  const normal=getElfAdvancedMechanics({...elf,alienTraits:undefined});
  const overridden=getElfAdvancedMechanics(elf);
  assert.ok(Object.keys(normal).length>Object.keys(overridden).length);
  assert.equal(overridden.doubleDamageToAlienElf,true,'未修改星魂使徒保持');
  elf.alienTraits.gen2Trait.effectMode='auto';elf.alienTraits.exclusiveTrait.effectMode='registry';
  assert.deepEqual(getElfAdvancedMechanics(elf),normal);
});
check('原文未知／已知都不改成庫內模板或臆造50%增傷', () => {
  for (const text of ['若對手體力高於一半，恢復自身37點體力', '空夢機制令宇宙折疊']) {
    const result = parseEffectDescriptionLocal(text); assert.equal(result.structuredTemplate, `${text}；`);
  }
});
check('畫布、顯示與待接通清單用同一資料；不把日誌原子算成實裝', () => {
  const kit = [entry('on_hit'), { ...entry('before_damage'), codeId: 'pierce' }, { ...entry('on_hit'), codeId: 'copy_stat_sum' }];
  const plan = compileEffectPlan({ name: '測試', kit }, 'skill');
  assert.equal(plan.route, 'kit'); assert.equal(plan.connected, 1); assert.equal(plan.issues.length, 2);
  assert.equal(plan.program.clauses[0].body[0].acts[0].p.amount, 70);
  assert.ok(kitEntryIssue({ ...entry('on_hit'), codeId: 'condition_gate', params: { innerItems: [{ atom: 'pierce', params: {} }] } }));
  assert.equal(kitEntryIssue({...entry('on_hit'),codeId:'turn_effect_apply',params:{duration:3,applyMode:'gate',wraps:['damage_reduce'],wrapParams:{percent:40,damageTypes:['non_true']}}}),null);
  assert.ok(kitEntryIssue({...entry('on_hit'),codeId:'turn_effect_apply',params:{duration:3,applyMode:'gate',wraps:['heal'],wrapParams:{amount:40}}}));
  const mutable=entry('on_hit');assert.equal(kitEntryIssue(mutable),null);
  mutable.params.amount=-1;assert.ok(kitEntryIssue(mutable),'修改後不得沿用快取通過結果');
  mutable.params.amount=30;assert.equal(kitEntryIssue(mutable),null);
});
check('圖紙完整保留來源、魂印Kit與特質Kit，拒絕未知模式', () => {
  const elf = structuredClone(DEFAULT_ELVES[0]);
  elf.soulMark = { name: '新魂印', description: '原文', effectType: 'none', effectValue: 0, effectMode: 'kit', kit: [entry('round_start')] };
  elf.skills[0] = { ...elf.skills[0], effectMode: 'description' };
  elf.alienTraits = { gen2Trait: { name: '新特質', description: '原文', effectMode: 'kit', kit: [entry('round_end')] } };
  const json = JSON.stringify({ schemaVersion: 2, manualElf: elf });
  const restored = parseElfBlueprint(json).elf;
  assert.deepEqual(restored.soulMark, elf.soulMark); assert.deepEqual(restored.alienTraits, elf.alienTraits);
  assert.equal(restored.skills[0].effectMode, 'description');
  assert.throws(() => parseElfBlueprint(json.replace('"effectMode":"description"', '"effectMode":"unsupported"')));
});
check('原文嚴格煉成：數字／傷害類型／異常與時點保持，不吞未支援句', () => {
  const result = distillEffect({ name: '煉成', description: '🎯 令對手中毒\n🎯 附加對手70點固定傷害\n🎯 恢復自身37點體力' }, 'skill');
  assert.equal(result.complete,true); assert.equal(result.kit.length,3);
  // 一律走連鎖：每句一個獨立連鎖項，數值與類型在連鎖內保持。
  const act0=(e:any)=>e.params.clause.body[0].acts[0]; assert.ok(result.kit.every((e:any)=>e.codeId==='effect_sequence'));
  assert.equal(act0(result.kit[0]).p.status,'中毒'); assert.equal(act0(result.kit[1]).p.type,'固定'); assert.equal(act0(result.kit[1]).p.flat,70);
  assert.equal(act0(result.kit[2]).p.amount,37); assert.equal(result.kit[0].node,'on_skill_use');
  const unknown = distillEffect({ name:'保留',description:'恢復自身37點體力\n空夢機制令宇宙折疊' },'skill');
  assert.equal(unknown.complete,false); assert.ok(unknown.issues.some(i=>i.text.includes('空夢')));
  for (const text of ['命中後100%令對手中毒', '🎯 命中時10%令對手燒傷']) {
    const hit = distillEffect({ name:'命中限定', description:text },'skill');
    assert.equal(hit.complete,true); assert.equal(hit.kit[0].node,'on_hit','不得把命中條件剝去而改成使用時');
    assert.equal(compileEffectPlan({ name:'命中限定',description:text },'skill').program.clauses[0].trig,'after_hit');
  }
});
check('Blockly實際公開存檔／重載保留效果身分；百分比改值與0不能回到舊值', () => {
  defineCustomBlocks(); const ws = new Blockly.Workspace();
  const source = { ...entry('round_end'), params:{ mode:'percent',ratio:0.25,target:'self' }, role:'carried' as const };
  const block = buildEntryBlock(ws as any,source)!;
  const saved = Blockly.serialization.workspaces.save(ws), restored = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved,restored);
  const reloaded = restored.getBlockById(block.id)!;
  assert.equal(createKitBlockParser('skill')(reloaded,'round_end')!.role,'carried');
  reloaded.setFieldValue(30,'AMOUNT');
  const updated = createKitBlockParser('skill')(reloaded,'round_end')!;
  assert.equal(updated.params.amount,30); assert.equal(updated.params.ratio,undefined);
  reloaded.setFieldValue(0,'AMOUNT'); assert.equal(createKitBlockParser('skill')(reloaded,'round_end')!.params.amount,0);
  ws.dispose(); restored.dispose();
});

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const registry = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const blocks = await server.ssrLoadModule('/src/blocks/registry.ts');
  const { describeExecution } = await server.ssrLoadModule('/src/blocks/audit.ts');
  const { effectDefinitionEntries } = await server.ssrLoadModule('/src/battle/effectSources.ts');
  check('全部預設精靈魂印／所有特質／技能及替換庫都有積木對照入口，原文不被改寫', () => {
    let definitions=0;
    for (const elf of DEFAULT_ELVES) {
      const before=JSON.stringify(elf);
      const traits=effectDefinitionEntries(elf);
      assert.equal(traits.filter((t:any)=>t.soul).length,elf.soulMark?1:0);
      for (const trait of traits) {
        const view=describeExecution(trait.soul?{elf}:{trait});
        assert.ok(view.program && view.source && view.route); definitions++;
      }
      for (const skill of [...elf.skills,...(elf.skillPool || [])]) {
        const view=describeExecution({elf,skill});assert.ok(view.program && view.source && view.route);definitions++;
      }
      assert.equal(JSON.stringify(elf),before);
    }
    console.log(`  入口清點：${DEFAULT_ELVES.length}隻／${definitions}筆定義；此測試不代表效果逐句正確。`);
  });
  const { EffectTiming: T } = await server.ssrLoadModule('/src/effects/types.ts');
  const source: any = { id: 'custom_test', battleId: 'test-instance', name: '連接測試', isCustom: true, currentHp: 300, maxHp: 1000,
    soulMark: { name: '測試魂印', description: '', effectType: 'none', effectValue: 0, effectMode: 'kit' },
    skills: [{ name: '連接技能', description: '恢復自身70點體力', kit: [entry('on_hit')], effectMode: 'kit', category: '物理' }],
    kit: [{ ...entry('round_start', 30), source: 'soulmark' }], alienTraits: { gen2Trait: { name: '測試特質', description: '', effectMode: 'kit', kit: [entry('round_end', 40)] } } };
  const state: Record<string, any> = {}, calls: any[] = [];
  const ctx: any = { actor: 'p1', targetSide: 'p2', self: source, target: { currentHp: 1000 }, activeP1: source, activeP2: { currentHp: 1000 },
    skill: source.skills[0], p1Timers: [], p2Timers: [], getMarks: () => [], getFullTeam: () => [source], roundNumber: 1,
    getPlayerState: (key: string) => state[key], getOpponentState: () => undefined, setPlayerState: (key: string, value: any) => state[key] = value,
    applyHeal: (side: string, amount: number) => calls.push([side, amount]), addLog: () => {} };
  check('真實Vite註冊入口：技能使用前不回血、命中後僅一次，不再重跑描述', () => {
    registry.BattleSkillRegistry[ctx.skill.name](ctx); assert.equal(calls.length, 0);
    blocks.runSkillBlocks(ctx, 'after_hit', false); assert.deepEqual(calls.splice(0), [['p1', 70]]);
  });
  check('真實魂印／特質入口：各自round_start/round_end，別的節點不誤觸發', () => {
    registry.SoulMarkRegistry[source.name](ctx, T.ROUND_START); assert.deepEqual(calls.splice(0), [['p1', 30]]);
    registry.SoulMarkRegistry[source.name](ctx, T.BATTLE_PHASE_END); assert.equal(calls.length, 0);
    registry.SoulMarkRegistry[source.name](ctx, T.ROUND_END); assert.deepEqual(calls.splice(0), [['p1', 40]]);
  });
  check('新增自訂魂印原文能執行，不必改全域SOUL_MODE，UI與引擎解析相同', () => {
    source.soulMark = { ...source.soulMark, description: '回合結束時恢復自身70點體力', effectMode: 'description' };
    source.alienTraits = undefined;
    const plan = compileEffectPlan({ ...source.soulMark, kit: source.kit }, 'soul');
    assert.equal(plan.issues.length, 0);
    registry.SoulMarkRegistry[source.name](ctx, T.ROUND_END); assert.deepEqual(calls.splice(0), [['p1', 70]]);
  });
  check('P2來源／目標不串位；非法原子只有待接通通知，不產生替代效果', () => {
    source.soulMark.effectMode = 'kit'; source.kit = [{ ...entry('round_start'), codeId: 'copy_stat_sum', source: 'soulmark' }];
    const other = { ...ctx, actor: 'p2', targetSide: 'p1', activeP2: source, activeP1: ctx.activeP2 };
    registry.SoulMarkRegistry[source.name](other, T.ROUND_START); assert.equal(calls.length, 0);
    source.kit = [{ ...entry('round_start', 55), source: 'soulmark' }];
    registry.SoulMarkRegistry[source.name](other, T.ROUND_START); assert.deepEqual(calls.splice(0), [['p2', 55]]);
  });
  check('對手行動結果actor不覆蓋持有者；失效節點與固有／附加分類分流', () => {
    source.kit = [{...entry('opponent_after_action',21),source:'soulmark'}];
    registry.SoulMarkRegistry[source.name](ctx,T.OPPONENT_AFTER_ACTION,{actor:'p2'});
    assert.deepEqual(calls.splice(0),[['p1',21]]);
    source.skills[0].kit = [{...entry('on_invalid',19),role:'attached'}];
    blocks.runSkillBlocks(ctx,'on_invalid',false); assert.deepEqual(calls.splice(0),[['p1',19]]);
    source.isAdditionalInvalid=true;
    blocks.runSkillBlocks(ctx,'on_invalid',false); assert.equal(calls.length,0);
    source.skills[0].kit[0].role='innate';
    blocks.runSkillBlocks(ctx,'on_invalid',false); assert.deepEqual(calls.splice(0),[['p1',19]]);
    source.isInherentInvalid=true;
    blocks.runSkillBlocks(ctx,'on_invalid',false); assert.equal(calls.length,0);
    source.isAdditionalInvalid=false; source.isInherentInvalid=false;
  });
  check('指定不存在的註冊表不偷偷回退描述／模板', () => {
    source.skills[0] = {...source.skills[0],effectMode:'registry',description:'恢復自身70點體力',templateId:'unknown'};
    ctx.skill=source.skills[0]; registry.BattleSkillRegistry[ctx.skill.name](ctx); assert.equal(calls.length,0);
  });
  check('原文先制／必中真正查詢接通；必定先手沒有入口就保留待辦', () => {
    const skill = {...source.skills[0],effectMode:'description',description:'■ 先制+3\n■ 必中',isSureHit:false};
    assert.equal(blocks.blockCondPriority(skill,source,ctx.target,()=>({})),3);
    assert.equal(blocks.blockSkillTransform(ctx,skill).isSureHit,true);
    assert.ok(compileEffectPlan({...skill,description:'■ 必定先手'},'skill').issues.length);
  });
  const { skillBasePriority } = await server.ssrLoadModule('/src/battle/conditionalPriority.ts');
  const { computeHitChance } = await server.ssrLoadModule('/src/effects/genericSkillText.ts');
  check('正式先制與命中查詢遵循來源；欄位先制不重複、Kit不偷讀原文必中', () => {
    const skill={...source.skills[0],effectMode:'description',description:'■ 先制+3\n■ 必中',priority:3,isSureHit:false,accuracy:0};
    assert.equal(skillBasePriority(skill,source,ctx.target,()=>({})),3);
    assert.equal(computeHitChance(source,ctx.target,skill,()=>({})),1);
    assert.equal(skillBasePriority({...skill,effectMode:'kit',priority:0,kit:[]},source,ctx.target,()=>({})),0);
    assert.equal(computeHitChance(source,ctx.target,{...skill,effectMode:'kit',kit:[]},()=>({})),0);
    assert.equal(skillBasePriority(skill,source,ctx.target,()=>({}),true),0);
    assert.ok(compileEffectPlan({name:'魂印',description:'必中'},'soul').issues.length);
  });
  check('無法辨認或未完整解析的先制條件不變成無條件；固有效果失效不轉必中', () => {
    const skill={...source.skills[0],effectMode:'description',description:'宇宙折疊時先制+3且必定命中',isSureHit:false};
    assert.equal(blocks.blockCondPriority(skill,source,ctx.target,()=>({})),0);
    assert.equal(blocks.blockSkillTransform(ctx,skill).isSureHit,false);
    assert.equal(blocks.blockSkillTransform({...ctx,self:{...source,isInherentInvalid:true}},{...skill,description:'■ 必中'}).isSureHit,false);
  });
  check('傷害範圍／先制數值由正式生命週期讀取，不寫無人讀取旗標', () => {
    const skill={...source.skills[0],effectMode:'kit',kit:[
      {codeId:'priority',node:'modify_priority',params:{level:3},source:'skill',order:0,role:'innate'},
      {codeId:'damage_multiplier',node:'before_damage',params:{multiplier:1.7,damageTypes:['skill']},source:'skill',order:1,role:'innate'}]};
    source.skills=[skill];ctx.skill=skill;
    const priorityComp={bonus:0};registry.SoulMarkRegistry[source.name](ctx,T.MODIFY_PRIORITY,{skill,priorityComp});
    assert.equal(priorityComp.bonus,3);
    for(const category of ['skill_attack','fixed','true']) {
      const damageComp={isIncoming:false,multiplier:1,damageCategory:category};
      registry.SoulMarkRegistry[source.name](ctx,T.BEFORE_DAMAGE,{skill,damageComp});
      assert.equal(damageComp.multiplier,category==='skill_attack'?1.7:1);
    }
  });
  check('未使用技能的附加效果不能靠裝備自動觸發；攜帶效果仍能監控其他技能', () => {
    const used={...source.skills[0],name:'本次使用',kit:[]};
    const monitored={...used,name:'未使用',kit:[entry('round_end',999),{...entry('round_end',11),role:'carried'},
      {...entry('before_skill',12),role:'carried'},entry('before_skill',999),{...entry('on_hit',13),role:'carried'},
      {...entry('on_skill_use',14),role:'carried'}]};
    source.skills=[used,monitored];ctx.skill=used;source.kit=[];
    registry.SoulMarkRegistry[source.name](ctx,T.ROUND_END,{skill:used});assert.deepEqual(calls.splice(0),[['p1',11]]);
    registry.SoulMarkRegistry[source.name](ctx,T.BEFORE_SKILL,{skill:used});assert.deepEqual(calls.splice(0),[['p1',12]]);
    registry.SoulMarkRegistry[source.name](ctx,T.ON_SKILL_HIT,{skill:used});assert.deepEqual(calls.splice(0),[['p1',13]]);
    blocks.emitSkillUse(ctx,{...ctx,actor:'p2',targetSide:'p1',self:{...source,skills:[],soulMark:{...source.soulMark,effectMode:'registry'}}},used,false);
    assert.deepEqual(calls.splice(0),[['p1',14]]);
  });
  check('幻化取得的手動魂印與特質使用持有者側，不重跑目標技能', () => {
    const copied={...source,id:'different-target',battleId:'different-target',soulMark:{name:'複製魂印',effectMode:'kit',kit:[entry('round_end',17)]},
      alienTraits:{gen2Trait:{name:'複製特質',effectMode:'kit',kit:[entry('round_end',13)]}},skills:[{...source.skills[0],kit:[entry('round_end',999)]}]};
    blocks.runCopiedSoulEvent(ctx,T.ROUND_END,{},copied);
    assert.deepEqual(calls.splice(0),[['p1',17],['p1',13]]);
  });
  check('失敗收尾接通魂印與其他攜帶槽；本次使用槽無效分支只能一次', () => {
    const used={...source.skills[0],name:'失敗使用槽',kit:[entry('on_invalid',19)]};
    const observer={...used,name:'失敗監控槽',kit:[{...entry('on_invalid',13),role:'carried'},entry('on_invalid',999)]};
    source.skills=[used,observer];source.kit=[{...entry('on_invalid',17),source:'soulmark'}];source.alienTraits=undefined;ctx.skill=used;
    for(const side of ['p1','p2']) {
      const failedCtx={...ctx,actor:side,targetSide:side==='p1'?'p2':'p1',[side==='p1'?'activeP1':'activeP2']:source};
      registry.SoulMarkRegistry[source.name](failedCtx,T.ACTION_FAILED,{skill:used,actor:side,hit:false,invalid:true});
      assert.deepEqual(calls.splice(0),[[side,17],[side,13]]);
      blocks.runSkillBlocks(failedCtx,'on_invalid',false);assert.deepEqual(calls.splice(0),[[side,19]]);
      registry.SoulMarkRegistry[source.name](failedCtx,T.SKILL_INVALID,{skill:used,isIncoming:false});assert.equal(calls.length,0);
    }
  });
} finally { await server.close(); }
console.log(`自訂語意／積木統一來源：${count} 項通過`);
