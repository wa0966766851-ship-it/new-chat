// 藥劑反噬與行動限制（2026-11-07 使用者規格）：
// 藥劑反噬中藥劑效果反轉；藥劑反噬傷害為獨立類型（無視減免與限制，綠字黃框負數）；
// 百分比藥劑（上限 30%，PP 以各技能上限計）；切換／用藥限制統一查詢（個體／全隊、原因與回合）。
import assert from 'node:assert/strict';
import { BATTLE_ITEMS, getStatuses, addStatusEffect } from '../src/utils/battleHelpers';
import { applyBattleItem, percentPp, ITEM_PERCENT_CAP } from '../src/battle/itemInventory';
import { switchRestrictions, itemRestrictions, potionBacklash, restrictionText } from '../src/battle/actionRestrictions';
import { normalizeDamageType, isPotionBacklashDamageType, isNonTrueDamageType } from '../src/battle/damageSemantics';
import { damagePopupStyle } from '../src/battle/damagePopupStyle';
import { itemUseActionIssue, ITEM_USE_ACTION_FIELDS } from '../src/blocks/ops/itemUse';

let n = 0; const ok = () => n++;
const item = (id: string) => BATTLE_ITEMS.find(i => i.id === id)!;
const makeElf = (id = 'A'): any => ({ id, battleId: id, name: id, currentHp: 500, maxHp: 1000, effects: [], battleStatuses: {},
  skills: [{ name: '甲', pp: 10, maxPp: 20 }, { name: '乙', pp: 3, maxPp: 5 }], statStages: { atk: 2, def: -1, spatk: 0, spdef: 0, speed: 0, accuracy: 0 } });
const makeCtx = (side: 'p1' | 'p2', self: any, opp: any, timers: any[] = []) => {
  const log: any = { heals: [], potion: [], status: [] };
  const team = (s: string) => (s === side ? [self] : [opp]);
  const ctx: any = { actor: side, self, activeP1: side === 'p1' ? self : opp, activeP2: side === 'p2' ? self : opp,
    p1Timers: side === 'p1' ? timers : [], p2Timers: side === 'p2' ? timers : [], targetSide: side === 'p1' ? 'p2' : 'p1',
    getFullTeam: (s: string) => team(s),
    updateAnyElf: (s: string, id: string, patch: any) => Object.assign(team(s).find((e: any) => e.battleId === id), patch),
    emitElfEvent: () => {}, addLog: () => {},
    applyHeal: (s: string, amount: number) => log.heals.push({ s, amount }),
    applyPotionBacklashDamage: (s: string, amount: number, label: string, targetId: string) => log.potion.push({ s, amount, label, targetId }),
    applyStatusWithImmunityCheck: (s: string, name: string, turns: number, _i: boolean, id: string) => { log.status.push({ s, name, turns, id }); const t = team(s)[0];
      // 與正式流程一致：以新回合數取代同名異常（effects），已處於＝重置。
      t.effects = [...(t.effects || []).filter((e: any) => e.id !== name && e.name !== name), { id: name, name, duration: turns, stacks: 1 }];
      t.battleStatuses = { ...t.battleStatuses, [name]: turns }; return { success: true, immune: false }; } };
  return { ctx, log };
};
const backlashTimer = { id: 'bl', name: '藥劑反噬', remaining: 2, kind: 'turn_effect', scope: 'elf', ownerBattleId: 'A', payload: { block: { potionBacklash: true } } };

// 一、傷害類型定義
assert.equal(normalizeDamageType({ damageType: '藥劑反噬傷害' }), 'potion_backlash');
assert.ok(isPotionBacklashDamageType('potion_backlash'));
assert.equal(isNonTrueDamageType('potion_backlash'), false, '不屬於非真實傷害（不吃印記倍率、護盾護罩、抗性）');
assert.equal(damagePopupStyle('potion_backlash').variant, 'potion');
assert.equal(damagePopupStyle('potion_backlash').colorClass, damagePopupStyle('heal').colorClass, '與回復同色');
ok();

// 二、百分比藥劑
assert.equal(ITEM_PERCENT_CAP, 30);
for (const id of ['hp_pct_10', 'hp_pct_20', 'hp_pct_30', 'pp_pct_10', 'pp_pct_20', 'pp_pct_30']) assert.ok(item(id), id);
{
  const self = makeElf(), opp = makeElf('B');
  const { ctx, log } = makeCtx('p1', self, opp);
  applyBattleItem(ctx, item('hp_pct_30'), 'p1');
  assert.equal(log.heals[0].amount, 300, '30% 最大體力');
  assert.equal(percentPp(self.skills[0], self, 20), 4); assert.equal(percentPp(self.skills[1], self, 10), 1, '至少 1 點');
  applyBattleItem(ctx, item('pp_pct_20'), 'p1');
  assert.deepEqual(self.skills.map((s: any) => s.pp), [14, 4], 'PP 以各技能自己的上限計');
  applyBattleItem(ctx, { ...item('hp_pct_10'), hpPercent: 80 }, 'p1');
  assert.equal(log.heals[1].amount, 300, '百分比上限 30%');
  ok();
}

// 三、藥劑反噬：效果反轉
{
  const self = makeElf(), opp = makeElf('B');
  const { ctx, log } = makeCtx('p1', self, opp, [backlashTimer]);
  assert.ok(potionBacklash({ p1Timers: [backlashTimer], p1: self }, 'p1'));
  applyBattleItem(ctx, item('hp_150'), 'p1');
  assert.equal(log.heals.length, 0, '不回復');
  assert.deepEqual(log.potion[0], { s: 'p1', amount: 150, label: '中級體力藥劑・藥劑反噬', targetId: 'A' }, '改為受到等量藥劑反噬傷害');
  applyBattleItem(ctx, item('pp_5'), 'p1');
  assert.deepEqual(self.skills.map((s: any) => s.pp), [5, 0], 'PP 改為扣除（最低 0）');
  addStatusEffect(self, '中毒', 1);
  applyBattleItem(ctx, item('special_170_clear'), 'p1');
  assert.equal(getStatuses(self)['中毒'], 3, '解除異常 → 已處於的異常重置為 3 回合');
  applyBattleItem(ctx, { ...item('special_170_clear'), effect: undefined, cureStatuses: ['麻痺'] }, 'p1');
  assert.equal(log.status.at(-1).name, '麻痺'); assert.equal(log.status.at(-1).turns, 3, '指定解除 → 進入該異常 3 回合');
  applyBattleItem(ctx, item('special_5_debuff'), 'p1');
  assert.equal(self.statStages.atk, 0, '解除能力下降 → 消除能力提升'); assert.equal(self.statStages.def, -1);
  // 攻擊型藥劑：目標改為自身
  const before = log.potion.length;
  applyBattleItem(ctx, { id: 'x', name: '試驗毒劑', description: '', type: 'special', oppDamage: 120, oppPpDrain: 2, inflictStatuses: [{ name: '燒傷' }] }, 'p1');
  assert.deepEqual(log.potion[before], { s: 'p1', amount: 120, label: '試驗毒劑', targetId: 'A' });
  assert.equal(log.status.at(-1).s, 'p1'); assert.equal(log.status.at(-1).name, '燒傷');
  assert.deepEqual(opp.skills.map((s: any) => s.pp), [10, 3], '對手不受影響');
  ok();
}
// 四、沒有反噬時攻擊型藥劑打對手
{
  const self = makeElf(), opp = makeElf('B');
  const { ctx, log } = makeCtx('p1', self, opp);
  applyBattleItem(ctx, { id: 'x', name: '試驗毒劑', description: '', type: 'special', oppDamagePercent: 10, oppPpDrain: 2, inflictStatuses: [{ name: '燒傷', turns: 2 }] }, 'p1');
  assert.deepEqual(log.potion[0], { s: 'p2', amount: 100, label: '試驗毒劑', targetId: 'B' });
  assert.deepEqual(opp.skills.map((s: any) => s.pp), [8, 1]);
  assert.equal(log.status[0].s, 'p2'); assert.equal(log.status[0].turns, 2);
  ok();
}

// 五、行動限制統一查詢
{
  const a = makeElf(), b = makeElf('B');
  const state: any = { p1: a, p2: b, p1Timers: [], p2Timers: [], p1RegistryState: {}, p2RegistryState: {} };
  assert.equal(switchRestrictions(state, 'p1').blocked, false);
  state.p1Timers = [{ id: 'l', remaining: 2, scope: 'elf', ownerBattleId: 'A', payload: { block: { lockSwitch: true } }, origin: { skillName: '鎖鏈' } }];
  let r = switchRestrictions(state, 'p1');
  assert.equal(r.blocked, true); assert.equal(r.list[0].scope, 'elf'); assert.equal(r.list[0].turns, 2); assert.equal(r.list[0].source, '鎖鏈');
  assert.equal(switchRestrictions(state, 'p1', { forcedReplace: true }).blocked, false, '陣亡強制換人不受限');
  state.p1Timers = [{ id: 't', remaining: 3, scope: 'team', payload: { block: { lockSwitch: true } } }];
  r = switchRestrictions(state, 'p1');
  assert.equal(r.list[0].scope, 'team'); assert.equal(restrictionText(r.list[0]), '全隊無法主動切換（3回合）');
  state.p1Timers = []; state.p1RegistryState = { noSwitchTurns: 2 };
  assert.equal(restrictionText(switchRestrictions(state, 'p1').list[0]), '全隊無法主動切換精靈（2回合）');
  addStatusEffect(a, '癱瘓', 2); state.p1RegistryState = {};
  assert.ok(switchRestrictions(state, 'p1').list.some(x => x.source === '癱瘓'));
  // 用藥限制
  assert.equal(itemRestrictions(state, 'p1').blocked, false);
  state.p1Timers = [{ id: 'i', remaining: 1, scope: 'team', payload: { block: { noItem: true } } }];
  assert.equal(itemRestrictions(state, 'p1').blocked, true);
  state.p1Timers = [backlashTimer];
  const it = itemRestrictions(state, 'p1');
  assert.equal(it.blocked, false, '藥劑反噬不禁止使用'); assert.equal(it.backlash?.turns, 2);
  addStatusEffect(a, '繳械', 2);
  assert.ok(itemRestrictions(state, 'p1').list.some(x => x.source === '繳械'));
  ok();
}

// 六、積木契約
for (const op of ['potion_backlash', 'potion_backlash_damage', 'item_lock', 'switch_lock_scoped']) assert.ok(ITEM_USE_ACTION_FIELDS[op], op);
assert.equal(itemUseActionIssue('potion_backlash', { side: 'opp', turns: 2 }), null);
assert.equal(itemUseActionIssue('item_lock', { side: 'opp', turns: 2, scope: 'team' }), null);
assert.ok(itemUseActionIssue('item_lock', { side: 'x', turns: 2 }));
assert.ok(itemUseActionIssue('switch_lock_scoped', { side: 'self', turns: 0 }));
assert.equal(itemUseActionIssue('potion_backlash_damage', { side: 'opp', maxHpRatio: 0.1 }), null);
assert.ok(itemUseActionIssue('potion_backlash_damage', { side: 'opp' }));
ok();
console.log(`藥劑反噬／百分比藥劑／行動限制／積木契約 ${n} 組通過`);
