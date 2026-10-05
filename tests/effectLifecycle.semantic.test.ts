import assert from 'node:assert/strict';
import * as Blockly from '../src/vendor/blockly/index.js';
import LegacyBlockly from 'blockly/core';
import { defineCustomBlocks, buildEntryBlock, createKitBlockParser } from '../src/components/BlocklyBuilder';
import { DEFAULT_ELVES } from '../src/data/defaultElves';
import { parseElfBlueprint } from '../src/utils/elfBlueprint';
import { ATOM_PARAMETER_FIELDS, validateAtomParams, validateKit } from '../src/effects/kitValidation';
import { ATOMS, runNode, runTimerPayload } from '../src/effects/effectRunner';
import { normalizeBlockAtom } from '../src/effects/blockParams';
import { advanceStatusEffect, mergeSameStatus } from '../src/battle/statusLifecycle';
import { StatusRegistry } from '../src/effects/statusRegistry';
import { addStatusEffect, clearAllStatuses, getStatuses, removeStatusEffect } from '../src/utils/battleHelpers';
import { applyStatuses } from '../src/utils/statusManager';
import { tickTimers, clearTurnEffects, type Timer } from '../src/battle/timers';
import { applyActiveGateTimersToDamage } from '../src/battle/contextBuilders';
import type { KitEntry } from '../src/effects/effectSystem.schema';
import { normalizePlaylist, CONTROL_SECTIONS } from '../src/utils/controlSettings';
import { matchesElfQuery } from '../src/utils/elfSearch';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
const entry = (codeId: string, params: any = {}): KitEntry => ({ codeId, params, node: 'on_hit', source: 'skill', order: 0 });
const elf = () => ({ id: 'test', name: '測試', currentHp: 100, maxHp: 1000, effects: [], battleStatuses: {} } as any);

test('歷史異常別名在讀取端合併且不污染存檔；frozen不誤轉冰封', () => {
  const old = { battleStatuses: { poisoned: 2, 中毒: 3, frozen: 2, ice_sealed: 4 }, effects: [] };
  const snapshot = JSON.stringify(old);
  assert.deepEqual(getStatuses(old), { 中毒: 3, 石化: 2, 冰封: 4 });
  assert.equal(JSON.stringify(old), snapshot);
});
test('模組化 Blockly 檔案可重現核對且維持舊版公開序列化格式', () => {
  const folder=new URL('../src/vendor/blockly/',import.meta.url);
  const info=JSON.parse(readFileSync(new URL('build-info.json',folder),'utf8'));
  assert.equal(info.version,'13.2.1'); assert.equal(info.propertyMangling,false);
  for(const file of info.files) {
    const bytes=readFileSync(new URL(file.file,folder)); assert.ok(bytes.length<500000);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.file);
  }
  const definition=[{type:'qa_legacy_compat',message0:'傷害 %1',args0:[{type:'field_number',name:'VALUE',value:70}],previousStatement:null,nextStatement:null}];
  LegacyBlockly.defineBlocksWithJsonArray(definition); Blockly.defineBlocksWithJsonArray(definition);
  const old=new LegacyBlockly.Workspace(); const block=old.newBlock('qa_legacy_compat'); block.setFieldValue(210,'VALUE'); block.data='保留原始參數';
  const saved=LegacyBlockly.serialization.workspaces.save(old); const modern=new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved,modern); const restored=modern.getTopBlocks(false)[0];
  assert.equal(restored.getFieldValue('VALUE'),210); assert.equal(restored.data,block.data);
  const oldAgain=new LegacyBlockly.Workspace(); LegacyBlockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(modern),oldAgain);
  assert.equal(oldAgain.getTopBlocks(false)[0].getFieldValue('VALUE'),210);
  old.dispose();modern.dispose();oldAgain.dispose();
});
test('精靈搜尋支援序號、名稱、魂印、複合屬性及多詞，數字不誤中相鄰序號', () => {
  const target = { id:'custom_5002', seerId:5002, name:'異境神霆·雷伊', type:'神秘·電', soulMark:{name:'異'} } as any;
  for (const query of ['5002', 'id:5002', '#custom_5002', '雷伊 電', 'type:神秘/电', '屬性:電 異', '']) assert.equal(matchesElfQuery(target,query),true,query);
  for (const query of ['500', '15002', '雷伊 火', 'type:火']) assert.equal(matchesElfQuery(target,query),false,query);
  assert.equal(matchesElfQuery(target,'',['神秘','電']),true);
  assert.equal(matchesElfQuery(target,'',['神秘','火']),false);
  assert.equal(matchesElfQuery({id:'15002'},'5002'),false);
});
test('控制中心相容舊歌單與錯誤巢狀存檔，分類不混用', () => {
  assert.deepEqual(normalizePlaylist([{url:{url:'https://example.test/music',title:'原標題'},title:'未知標題'}], []), [{url:'https://example.test/music',title:'原標題'}]);
  assert.deepEqual(normalizePlaylist(['legacy', null, {url:3}], []), [{url:'legacy',title:'歌曲 1'}]);
  const ids = CONTROL_SECTIONS.map(s => s.id);
  assert.deepEqual(ids, ['background', 'audio', 'visual', 'battle', 'system']);
  assert.equal(new Set(ids).size, ids.length);
});
test('巢狀特質機制保留、過深拒絕；不把資料通過當成可執行', () => {
  const source = structuredClone(DEFAULT_ELVES[0]);
  source.trait = { name:'驗收',description:'資料保留',mechanics:{ branch:{ args:[70, { mode:'fixed', enabled:true }] } } } as any;
  const result = parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:source}));
  assert.deepEqual(result.elf.trait, source.trait);
  let nested: any = 1; for (let i=0;i<14;i++) nested = { child:nested };
  source.trait.mechanics = { nested }; assert.throws(() => parseElfBlueprint(JSON.stringify({schemaVersion:2,manualElf:source})), /過深/);
});
test('未提供欄位的專屬機制／複合條件與舊原子參數，移動和序列化不得改意', () => {
  defineCustomBlocks(); const ws = new Blockly.Workspace();
  const entries = [entry('native:test', { slots:{n:70} }), entry('condition_gate', {has_status:'麻痺',is_first:true,innerItems:[{atom:'heal',params:{amount:70}}]}), entry('drain_hp', {ratio:0.25}), entry('damage_multiplier', {value:2})];
  for (const source of entries) {
    const b = buildEntryBlock(ws as any, source)!;
    const result = createKitBlockParser('skill')(b,'on_hit')!;
    assert.deepEqual(result.params, source.params, source.codeId);
  }
  ws.dispose();
});
test('只剩 BOSS 狀態時解除失敗，不得假觸發解除成功回血', () => {
  const self=elf(); addStatusEffect(self,'神話',1); let healed=0,updated=0;
  ATOMS.cure_status({},'self',{actor:'p1',activeP1:self,getStatuses,getPlayerState:()=>true,applyHeal:()=>healed++,updateElf:()=>updated++,addLog:()=>{},setPlayerState:()=>{}});
  assert.equal(healed,0); assert.equal(updated,0); assert.deepEqual(getStatuses(self),{'神話':1});
});
test('28 原子都有參數白名單；未知欄位、非法數值與未實裝舊積木不能偷渡', () => {
  assert.equal(Object.keys(ATOM_PARAMETER_FIELDS).length, 28);
  for (const id of Object.keys(ATOM_PARAMETER_FIELDS)) assert.throws(() => validateAtomParams(id, { unknown: true }));
  for (const value of [-1, NaN, Infinity, '100']) assert.throws(() => validateAtomParams('extra_damage', { amount: value }));
  for (const id of ['mark_op','force_switch','bad']) assert.throws(() => validateAtomParams(id, {}));
  assert.throws(() => validateKit([entry('force_switch')]));
  assert.throws(() => validateKit([{ ...entry('heal'), node: 'invalid' }]));
  assert.throws(() => validateAtomParams('extra_damage', { dmgType: 'skill', amount: 1 }));
  assert.throws(() => validateAtomParams('turn_effect_apply', { wraps: 42 }));
  assert.throws(() => validateAtomParams('condition_gate', { innerParams: [] }));
  validateAtomParams('heal', { mode: 'fixed', amount: 0 });
});
test('巢狀容器／多分支逐層校驗；錯誤定位到子原子而非只看外層', () => {
  const valid = entry('condition_gate', { hp_below: 0.5, innerItems: [{ atom: 'turn_effect_apply', params: { duration: 2, applyMode: 'on_expire', wrapItems: [{ atom: 'extra_damage', params: { damageType: 'fixed', amount: 70 } }, { atom: 'heal', params: { mode: 'percent', amount: 25 } }] } }] });
  validateKit([valid]);
  const bad = structuredClone(valid); bad.params.innerItems[0].params.wrapItems[1].params.amount = -1;
  assert.throws(() => validateKit([bad]), /wrapItems\[1\].params.amount/);
  let nested: any = { atom: 'heal', params: { amount: 1 } };
  for (let i = 0; i < 14; i++) nested = { atom: 'condition_gate', params: { innerItems: [nested] } };
  assert.throws(() => validateKit([entry(nested.atom, nested.params)]), /12 層/);
});
test('32 隻完整圖紙可匯入，訓練／技能／專屬特質無格式回歸', () => {
  for (const source of DEFAULT_ELVES) {
    const result = parseElfBlueprint(JSON.stringify({ schemaVersion: 2, manualElf: source }));
    assert.deepEqual(result.elf.baseStats, source.baseStats, source.name);
    assert.deepEqual(result.elf.skills.map(s => s.name), source.skills.slice(0, 5).map(s => s.name), source.name);
    for (const extra of source.skills.slice(5)) assert.ok(result.elf.skillPool?.some(s => s.name === extra.name));
    assert.deepEqual(result.elf.alienTraits, source.alienTraits, source.name);
  }
});
test('Blockly 真正公開序列化重載保留巢狀順序／傷害範圍／反彈吸取類型', () => {
  defineCustomBlocks();
  const ws = new Blockly.Workspace();
  const source = entry('condition_gate', { hp_below: 0.5, innerItems: [
    { atom: 'turn_effect_apply', params: { duration: 2, applyMode: 'on_expire', clearable: false, timerId: 'stable', tickAt: 'action_end', wrapItems: [
      { atom: 'damage_multiplier', params: { multiplier: 0, damageTypes: ['fixed','percent'] } },
      { atom: 'damage_reduce', params: { percent: 70, damageTypes: ['skill'] } },
      { atom: 'damage_reflect', params: { percent: 70, damageType: 'fixed', elem: '電', target: 'opponent' } },
      { atom: 'drain_hp', params: { amount: 25, damageType: 'true', amountMode: 'max_hp_percent', elem: '電', target: 'opponent' } },
    ] } }, { atom: 'heal', params: { amount: 70, mode: 'fixed', target: 'self' } },
  ] });
  const built = buildEntryBlock(ws as any, source)!;
  const saved = Blockly.serialization.workspaces.save(ws);
  const restored = new Blockly.Workspace(); Blockly.serialization.workspaces.load(saved, restored);
  const result = createKitBlockParser('skill')(restored.getBlockById(built.id)!, 'on_hit')!;
  validateKit([result]);
  assert.equal(result.params.innerItems.length, 2);
  const p = result.params.innerItems[0].params;
  assert.equal(p.timerId, 'stable'); assert.equal(p.tickAt, 'action_end'); assert.equal(p.clearable, false);
  assert.deepEqual(p.wrapItems[0].params.damageTypes, ['fixed','percent']); assert.equal(p.wrapItems[0].params.multiplier, 0);
  assert.equal(p.wrapItems[1].params.percent, 70); assert.equal(p.wrapItems[2].params.damageType, 'fixed');
  assert.equal(p.wrapItems[3].params.amountMode, 'max_hp_percent'); assert.equal(p.wrapItems[3].params.damageType, 'true');
  ws.dispose(); restored.dispose();
});
test('同容器多原子各自取值；到期只觸發一次；百分比回血不被二次正規化歸零', () => {
  const calls: any[] = [], timers: any[] = [], ctx: any = { actor: 'p1', activeP1: elf(), activeP2: elf(), goesFirst: true, applyFixedDamage: (...a: any[]) => calls.push(['damage', ...a]), applyHeal: (...a: any[]) => calls.push(['heal', ...a]), addTimerTo: (_s: string, t: any) => timers.push(t) };
  runNode('on_hit', [entry('turn_effect_apply', { duration: 2, applyMode: 'on_expire', wrapItems: [{ atom: 'extra_damage', params: { damageType: 'fixed', amount: 70 } }, { atom: 'heal', params: { mode: 'percent', amount: 25 } }] })], {}, ctx);
  let list = tickTimers(timers, 'round_end', t => runTimerPayload(t, ctx, 'p1')); assert.equal(calls.length, 0);
  list = tickTimers(list, 'round_end', t => runTimerPayload(t, ctx, 'p1')); assert.equal(list.length, 0);
  assert.deepEqual(calls.map(c => c.slice(0, 3)), [['damage','p2',70], ['heal','p1',250]]);
  tickTimers(list, 'round_end', t => runTimerPayload(t, ctx, 'p1')); assert.equal(calls.length, 2);
});
test('條件成功執行所有子效果，失敗完全不執行', () => {
  const calls: any[] = [], ctx: any = { actor: 'p1', activeP1: elf(), activeP2: elf(), applyHeal: (...a: any[]) => calls.push(a), applyFixedDamage: (...a: any[]) => calls.push(a) };
  const kit = [entry('condition_gate', { hp_below: 0.5, innerItems: [{ atom: 'heal', params: { amount: 70 } }, { atom: 'extra_damage', params: { amount: 80, damageType: 'fixed' } }] })];
  runNode('on_hit', kit, {}, ctx); assert.equal(calls.length, 2);
  ctx.activeP1.currentHp = 900; runNode('on_hit', kit, {}, ctx); assert.equal(calls.length, 2);
});
test('50%減傷是0.5乘區且不減真傷，傷害類別與零倍率不兜底', () => {
  for (const category of ['skill_attack','skill_attribute','fixed','percent','true']) {
    const comp = { damageCategory: category, isIncoming: true, decreasePercent: 0, multiplier: 1 };
    ATOMS.damage_reduce({ percent: 50, damageTypes: ['non_true'] }, 'self', { damageComp: comp });
    assert.equal(comp.decreasePercent, category === 'true' ? 0 : 0.5);
  }
  const comp = { damageCategory: 'fixed', isIncoming: false, multiplier: 1 };
  ATOMS.damage_multiplier({ multiplier: 0, damageTypes: ['fixed'] }, 'self', { damageComp: comp }); assert.equal(comp.multiplier, 0);
  const calls: any[] = [];
  ATOMS.stat_change(normalizeBlockAtom('stat_change', { stat: 'atk', stages: 0 }).params, 'self', { applyStatChange: (...a: any[]) => calls.push(a) }); assert.deepEqual(calls[0][1], { atk: 0 });
});
test('扣血＋恢復原子結算0點時回血0點（不代表所有吸血）；百分比反彈不把點數當HP百分比', () => {
  let heal = -1, ratio = -1;
  const ctx: any = { actor: 'p1', activeP1: elf(), activeP2: elf(), hpReduced: 200, applyFixedDamage: () => 0, applyHeal: (_s: string, a: number) => heal = a, applyPercentDamage: (_s: string, a: number) => ratio = a };
  ATOMS.drain_hp({ amount: 100, damageType: 'fixed' }, 'opponent', ctx); assert.equal(heal, 0);
  ATOMS.damage_reflect({ ratio: 0.5, damageType: 'percent' }, 'opponent', ctx); assert.equal(ratio, 0.1);
});
test('回合效果不被消除保護生效；計次與魂印回合計數保留', () => {
  const timer = (kind: Timer['kind'], clearable = true): Timer => ({ id: kind + clearable, name: '測試', kind, clearable, source: 'skill', tickAt: 'round_end', remaining: 2 });
  const [kept, count] = clearTurnEffects([timer('turn_effect'), timer('turn_effect', false), timer('round_counter'), timer('use_counter')]);
  assert.equal(count, 1); assert.equal(kept.length, 3);
});
test('同隻自傷閘門不重複乘算；場下持有者閘門不污染在場精靈', () => {
  const timer: Timer = { id: 'boost', name: '倍率', kind: 'turn_effect', source: 'skill', remaining: 2, tickAt: 'round_end', ownerBattleId: 'same', payload: { applyMode: 'gate', wrapItems: [{ atom: 'damage_multiplier', params: { multiplier: 2, damageTypes: ['fixed'] } }] } };
  const comp: any = { damageCategory: 'fixed', multiplier: 1, decreasePercent: 0 };
  const state: any = { current: { p1: { battleId: 'same' }, p2: { battleId: 'other' }, p1Timers: [timer], p2Timers: [] } };
  applyActiveGateTimersToDamage('p1','p1',comp,() => {},state); assert.equal(comp.multiplier, 2);
  state.current.p1.battleId = 'next'; comp.multiplier = 1;
  applyActiveGateTimersToDamage('p1','p2',comp,() => {},state); assert.equal(comp.multiplier, 1);
});
test('所有已登記異常逐一：正常期限／後手補償／場下保留／BOSS不扣', () => {
  for (const [id, spec] of Object.entries(StatusRegistry)) {
    const effect = { id, name: spec.name, duration: 2 };
    const result = advanceStatusEffect(effect, {}, () => 0);
    assert.equal(result.next?.duration, spec.categories.includes('BOSS_ONLY') ? 2 : 1, id);
    assert.equal(advanceStatusEffect(effect, {}, () => 0, true).next?.duration, 2, id);
    assert.equal(advanceStatusEffect({ ...effect, isLateMover: true }, {}, () => 0).next?.duration, 2, id);
  }
});
test('冰封到期變凍傷3回合及速度-1；石化不衍化，焚燼及隨機詛咒逐一驗證', () => {
  const end = (id: string, rng = () => 0) => advanceStatusEffect({ id, name: id, duration: 1 }, {}, rng);
  assert.equal(end('冰封').transformed?.id, '凍傷'); assert.equal(end('冰封').transformed?.duration, 3); assert.deepEqual(end('冰封').statDebuff, { speed: -1 });
  assert.equal(end('石化').transformed, undefined);
  for (const [id, spec] of Object.entries(StatusRegistry)) {
    const p = spec.mechanics.find(m => m.type === 'EVOLUTION_TRANSFORM')?.params;
    if (!p) continue;
    if (p.nextStatus) { assert.equal(end(id).transformed?.id, p.nextStatus, id); assert.equal(end(id).transformed?.duration, p.nextDuration, id); }
    for (let i = 0; i < (p.randomPool?.length || 0); i++) assert.equal(end(id, () => (i + 0.1) / p.randomPool.length).transformed?.id, p.randomPool[i], id);
  }
});
test('查詢不修改快照；麻痺別名合併；清除同步兩份狀態，普通清除保留BOSS', () => {
  const e = elf(); e.battleStatus = 'normal';
  addStatusEffect(e, '麻痹', 2); addStatusEffect(e, 'paralyzed', 3);
  assert.equal(Object.keys(getStatuses(e)).length, 1);
  const before = structuredClone(e); getStatuses(e); assert.deepEqual(e, before);
  removeStatusEffect(e, '麻痺'); assert.deepEqual(getStatuses(e), {});
  addStatusEffect(e, '神話', 1); addStatusEffect(e, '麻痺', 2); clearAllStatuses(e);
  assert.deepEqual(getStatuses(e), { 神話: 1 }); clearAllStatuses(e, true); assert.deepEqual(getStatuses(e), {});
});
test('神話與BOSS免疫抵擋異常；已過期BOSS不抵擋；異常抵抗不是全免疫', () => {
  for (const id of ['神話','免疫']) {
    const e = elf(); addStatusEffect(e, id, 1); const out = applyStatuses(e, [{ name: '麻痺', duration: 2 }] as any); assert.equal(getStatuses(out.elf)['麻痺'], undefined);
  }
  const e = elf(); e.battleStatuses = { 神話: 0 }; assert.equal(getStatuses(applyStatuses(e, [{ name: '麻痺', duration: 2 }] as any).elf)['麻痺'], 2);
  const resist = elf(); addStatusEffect(resist, '異常抵抗', 1); assert.equal(getStatuses(applyStatuses(resist, [{ name: '麻痺', duration: 2 }] as any).elf)['麻痺'], 2);
});
test('漸凍 1 回合當回合結束轉冰封 3 回合；同名異常合併、回合數相加', () => {
  const t = advanceStatusEffect({ id: '漸凍', name: '漸凍', duration: 1, isLateMover: false, stacks: 1 } as any, {}, () => 0.5);
  assert.equal(t.next, undefined); assert.equal(t.transformed?.id, '冰封'); assert.equal(t.transformed?.duration, 3);
  const merged = mergeSameStatus([{ id: '冰封', duration: 2 }, { id: '中毒', duration: 1 }, { id: '冰封', duration: 3 }, { id: '冰封', duration: 3 }]);
  assert.deepEqual(merged, [{ id: '冰封', duration: 8 }, { id: '中毒', duration: 1 }]);
});
console.log(`\n${passed} 項第五階段匯入／積木／狀態結算測試通過；分類與期限測試不代表每個狀態所有機制均通過。`);
