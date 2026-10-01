import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesConditionType, matchesEffectConditions } from '../src/effects/effectConditions';
import { ATOMS, runNode, runTimerPayload } from '../src/effects/effectRunner';
import { validateAtomParams } from '../src/effects/kitValidation';
import { applyActiveGateTimersToDamage } from '../src/battle/damageGates';
import { createServer } from 'vite';
import { addStatusEffect, getStatuses } from '../src/utils/battleHelpers';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
const elf = (id: string): any => ({ id, battleId: id, name: id, type: '神秘.電', currentHp: 200, maxHp: 1000, shield: 0, effects: [], battleStatuses: {}, statStages: {}, skills: [] });
const item = (atom: string, params: any = {}) => ({ atom, params });
const timer = (items: any[], extra: any = {}): any => ({ id: 't', name: '驗收', remaining: 2, tickAt: 'round_end', kind: 'turn_effect', source: 'skill', payload: { applyMode: 'gate', wrapItems: items }, ...extra });
const state = (): any => ({ p1: elf('a'), p2: elf('b'), p1Timers: [], p2Timers: [], p1Marks: [], p2Marks: [], p1RegistryState: {}, p2RegistryState: {} });
const comp = (damageCategory = 'fixed'): any => ({ damageCategory, base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1 });
const ctx = (): any => ({ actor: 'p1', activeP1: elf('a'), activeP2: elf('b'), p1Timers: [], p2Timers: [], getStatuses });

test('雙屬性支持單項、完整、順序及簡繁；不做模糊名稱包含', () => {
  for (const required of ['電', '神秘', '神秘·電', '电/神秘']) assert.equal(matchesConditionType('神秘.電', required), true);
  for (const required of ['火', '神', '秘', '神秘/電/火', '']) assert.equal(matchesConditionType('神秘.電', required), false);
  assert.equal(matchesConditionType('聖靈', '靈'), false);
});
test('體力條件嚴格大小於，負體力有效；缺失／無效快照不當成成功', () => {
  const c = ctx();
  assert.equal(matchesEffectConditions({ hp_below: 0.2 }, c), false);
  assert.equal(matchesEffectConditions({ hp_above: 0.2 }, c), false);
  c.activeP1.currentHp = -70; assert.equal(matchesEffectConditions({ hp_below: 0.1 }, c), true);
  c.activeP1.maxHp = 0; assert.equal(matchesEffectConditions({ hp_below: 0.5 }, c), false);
  delete c.activeP1; assert.equal(matchesEffectConditions({ hp_above: 0 }, c), false);
  assert.equal(matchesEffectConditions({ has_shield: false }, c), false);
});
test('先後手未知不猜測；明確先後手與否定條件一致', () => {
  const c = ctx();
  for (const p of [{ is_first: true }, { is_first: false }, { is_second: true }, { is_second: false }]) assert.equal(matchesEffectConditions(p, c), false);
  c.moveIndex = 0; assert.equal(matchesEffectConditions({ is_first: true, is_second: false }, c), true);
  c.moveIndex = 1; assert.equal(matchesEffectConditions({ is_first: false, is_second: true }, c), true);
});
test('層數只讀在場持有者／隊伍有效計時器，不取過期、零層或場下同名資料', () => {
  const c = ctx();
  c.p1Timers = [timer([], { ownerBattleId: 'bench', layers: 4 })];
  assert.equal(matchesEffectConditions({ timerId: 't', layer_gte: 2 }, c), false);
  c.p1Timers[0].ownerBattleId = 'a'; assert.equal(matchesEffectConditions({ timerId: 't', layer_gte: 2 }, c), true);
  c.p1Timers[0].layers = 0; assert.equal(matchesEffectConditions({ timerId: 't', layer_gte: 1 }, c), false);
  c.p1Timers[0].layers = 4; c.p1Timers[0].remaining = 0;
  assert.equal(matchesEffectConditions({ timerId: 't', layer_gte: 2 }, c), false);
  c.p1Timers[0].remaining = 2; c.p1Timers[0].scope = 'team'; c.p1Timers[0].ownerBattleId = 'bench';
  assert.equal(matchesEffectConditions({ timerId: 't', layer_gte: 2 }, c), true, '合法陣營計時器不被個體隔離誤清');
  assert.throws(() => validateAtomParams('condition_gate', { layer_gte: 2 }), /timerId/);
});
test('異常條件讀正式狀態與歷史別名，已過期不匹配', () => {
  const c = ctx(); addStatusEffect(c.activeP1, '冰封', 2);
  assert.equal(matchesEffectConditions({ has_status: '冰封' }, c), true);
  assert.equal(matchesEffectConditions({ has_status: 'frozen' }, c), false);
  addStatusEffect(c.activeP1, '麻痺', 2);
  assert.equal(matchesEffectConditions({ has_status: 'paralyzed' }, c), true);
  assert.throws(() => validateAtomParams('condition_gate', { has_status: '未定義異常' }));
});
test('舊式 innerTarget 明確指向不被原子預設覆蓋，巢狀仍正規化百分比', () => {
  const c = ctx(), calls: any[] = [];
  c.applyHeal = (...args: any[]) => calls.push(args);
  runNode('on_hit', [{ codeId: 'condition_gate', node: 'on_hit', source: 'skill', order: 0,
    params: { hp_below: 0.5, inner: 'condition_gate', innerParams: { enemy_type: '電', inner: 'heal', innerTarget: 'opponent', innerParams: { mode: 'percent', amount: 25 } } } }], {}, c);
  assert.deepEqual(calls, [['p2', 250]]);
});
test('多條件為 AND；假條件不執行傷害、回血或子條件', () => {
  const c = ctx(); let called = 0; c.applyHeal = () => called++;
  const p = { hp_below: 0.5, enemy_type: '火', innerItems: [item('heal', { amount: 70 })] };
  ATOMS.condition_gate(p, 'self', c); assert.equal(called, 0);
  p.enemy_type = '電'; ATOMS.condition_gate(p, 'self', c); assert.equal(called, 1);
});
test('雙方倍率只套造成方，減傷只套受到方，不互相雙倍套用', () => {
  const s = state();
  s.p1Timers = [timer([item('damage_multiplier', { multiplier: 2 }), item('damage_reduce', { percent: 20 })])];
  s.p2Timers = [timer([item('damage_multiplier', { multiplier: 3 }), item('damage_reduce', { percent: 50 })])];
  const a = comp(); applyActiveGateTimersToDamage('p1', 'p2', a, () => {}, { current: s });
  assert.equal(a.multiplier, 2); assert.equal(a.decreasePercent, 0.5);
  const b = comp(); applyActiveGateTimersToDamage('p2', 'p1', b, () => {}, { current: s });
  assert.equal(b.multiplier, 3); assert.equal(b.decreasePercent, 0.2);
});
test('持續 gate 遞迴條件會重新讀本次HP／異常，不在掛上時固定或執行回血', () => {
  const s = state(); addStatusEffect(s.p1, '麻痺', 2);
  s.p1Timers = [timer([item('condition_gate', { hp_below: 0.5, innerItems: [item('condition_gate', { has_status: '麻痺', innerItems: [item('damage_multiplier', { multiplier: 2 }), item('heal', { amount: 999 })] })] })])];
  const run = () => { const c = comp(); applyActiveGateTimersToDamage('p1', 'p2', c, () => {}, { current: s }); return c; };
  assert.equal(run().multiplier, 2); assert.equal(s.p1.currentHp, 200);
  s.p1.currentHp = 700; assert.equal(run().multiplier, 1);
});
test('明確子目標及持有者順序：對手倍率、對手減傷、不誤讀攻擊者的先後手', () => {
  const s = state();
  s.p2Timers = [timer([item('condition_gate', { is_second: true, innerItems: [item('damage_multiplier', { multiplier: 4, target: 'opponent' })] })])];
  const c = comp(); applyActiveGateTimersToDamage('p1', 'p2', c, () => {}, { current: s }, { side: 'p1', moveIndex: 0 }); assert.equal(c.multiplier, 4);
  const d = comp(); applyActiveGateTimersToDamage('p1', 'p2', d, () => {}, { current: s }, { side: 'p1', moveIndex: 1 }); assert.equal(d.multiplier, 1);
  s.p1Timers = [timer([item('damage_reduce', { percent: 25, target: 'opponent' })])];
  const e = comp(); applyActiveGateTimersToDamage('p1', 'p2', e, () => {}, { current: s }); assert.equal(e.decreasePercent, 0.25);
});
test('真傷不減傷；類型選擇、零倍率、獨立乘區、過期與場下隔離', () => {
  const s = state(); s.p1Timers = [timer([item('damage_multiplier', { multiplier: 0, damageTypes: ['fixed'] })])];
  s.p2Timers = [timer([item('damage_reduce', { percent: 50 })])];
  const c = comp(); applyActiveGateTimersToDamage('p1', 'p2', c, () => {}, { current: s }); assert.equal(c.multiplier, 0);
  const t = comp('true'); applyActiveGateTimersToDamage('p1', 'p2', t, () => {}, { current: s }); assert.equal(t.multiplier, 1); assert.equal(t.decreasePercent, 0);
  const p = { ...comp(), pure: true }; applyActiveGateTimersToDamage('p1', 'p2', p, () => {}, { current: s }); assert.equal(p.multiplier, 1);
  s.p1Timers[0].ownerBattleId = 'bench'; const b = comp(); applyActiveGateTimersToDamage('p1', 'p2', b, () => {}, { current: s }); assert.equal(b.multiplier, 1);
  s.p2Timers[0].remaining = 0; const e = comp(); applyActiveGateTimersToDamage('p1', 'p2', e, () => {}, { current: s }); assert.equal(e.decreasePercent, 0);
});
test('舊 wraps／value 倍率與新 wrapItems 使用同一傷害管線', () => {
  const s = state(); s.p1Timers = [timer([], { payload: { applyMode: 'gate', wraps: 'damage_multiplier', params: { value: 2 } } })];
  const c = comp(); applyActiveGateTimersToDamage('p1', 'p2', c, () => {}, { current: s }); assert.equal(c.multiplier, 2);
});
test('每回合條件與持續條件共用結果，條件失敗不執行', () => {
  const c = ctx(); let healed = 0; c.applyHeal = () => healed++;
  const t = timer([item('condition_gate', { enemy_type: '電', inner: 'heal', innerParams: { amount: 70 } })]);
  t.payload.applyMode = 'per_tick'; runTimerPayload(t, c, 'p1'); assert.equal(healed, 1);
  c.activeP2.type = '火'; runTimerPayload(t, c, 'p1'); assert.equal(healed, 1);
});
// 真正入口用 Vite 轉換 import.meta.glob；不以空註冊表或 mock 迴避引擎載入。
const vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
const { buildDamageAPIs } = await vite.ssrLoadModule('/src/battle/contextBuilders.ts');
test('真正固定傷害 API 與普通攻擊入口接入共用閘門，不只測純函式', () => {
  const s = state(), emitted: any[] = [];
  s.p1Timers = [timer([item('condition_gate', { enemy_type: '電', innerItems: [item('damage_multiplier', { multiplier: 2 })] })])];
  const api = buildDamageAPIs({ side: 'p1', moveIndex: 0, syncStateRef: { current: s }, self: s.p1, opp: s.p2,
    pushEffect: (e: any) => emitted.push(e), getBattleEventContext: () => ({}) } as any);
  assert.equal(api.applyFixedDamage('p2', 100), 200);
  assert.equal(emitted.find(e => e.type === 'damage').data.amount, 200);
  s.p1Timers = [timer([item('damage_multiplier', { multiplier: 2 }), item('damage_reduce', { percent: 20 })])];
  s.p2Timers = [timer([item('damage_multiplier', { multiplier: 9 })])];
  assert.equal(api.applyFixedDamage('p1', 100), 160, '自傷來源仍是自己，不偷用對手9倍增傷');
  assert.equal(api.applyTrueDamage('p2', 100), 200, '真傷增傷先於安全倍率計算，不被舊快照忽略');
  const source = readFileSync(new URL('../src/components/BattleScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /applyActiveGateTimersToDamage\(s, oppSide, damageComp, pushEffect, syncStateRef, \{ side: s, moveIndex: mIdx \}\)/);
  assert.match(source, /goesFirst: moveIndex === 0 \? true : moveIndex === 1 \? false : undefined/);
});
} finally { await vite.close(); }
console.log(`\n${passed} 項條件／持續傷害閘門語意測試通過；不代表所有精靈或原子已實裝。`);
