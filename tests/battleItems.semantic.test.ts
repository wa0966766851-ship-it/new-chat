import assert from 'node:assert/strict';
import { BATTLE_ITEMS, getStatuses, addStatusEffect } from '../src/utils/battleHelpers';
import { createBattleItemInventory, consumeBattleItem, hasBattleItem, applyBattleItem } from '../src/battle/itemInventory';
import { battleReducer } from '../src/components/BattleManager';

const original = createBattleItemInventory();
for (const item of BATTLE_ITEMS) {
  const max = item.type === 'special' ? 5 : item.type === 'hybrid' ? 50 : 100;
  assert.deepEqual(original[item.id], { left: max, max });
  let inventory = original;
  for (let n = 0; n < max; n++) inventory = consumeBattleItem(inventory, item.id)!;
  assert.equal(hasBattleItem(inventory, item.id), false);
  assert.equal(consumeBattleItem(inventory, item.id), undefined, '不產生負數庫存');
  assert.equal(original[item.id].left, max, '來源快照不得被污染');
  assert.deepEqual(createBattleItemInventory()[item.id], { left: max, max }, '新對戰重置');
}
assert.equal(consumeBattleItem(original, '不存在的藥劑'), undefined);
const p1 = consumeBattleItem(original, 'hp_150')!;
const state: any = { p1ItemInventory: original, p2ItemInventory: original };
const after = battleReducer(state, { type: 'SET_ITEM_INVENTORY', side: 'p1', inventory: p1 });
assert.equal(after.p1ItemInventory!.hp_150.left, 99);
assert.equal(after.p2ItemInventory!.hp_150.left, 100, '敵我庫存隔離');
assert.equal(battleReducer(after, { type: 'RESET_BATTLE', initialState: {} }).p1ItemInventory!.hp_150.left, 100);
let effectsChecked = 0;
for (const side of ['p1', 'p2'] as const) {
  const own: any = { id: '藥劑持有者', battleId: '藥劑持有者', name: '藥劑持有者', currentHp: 500, maxHp: 1000,
    skills: [{ name: '驗收招', category: '物理', type: '普通', pp: 1, maxPp: 20 }], effects: [], battleStatuses: {},
    statStages: { atk: -3, def: 2, spatk: -1, spdef: 0, speed: -2, accuracy: 1 } };
  const heals: any[] = [], events: any[] = [];
  const ctx: any = { actor: side, self: own, activeP1: own, activeP2: own, p1Timers: [], p2Timers: [],
    getFullTeam: () => [own], updateAnyElf: (_s: string, id: string, patch: any) => { assert.equal(id, own.battleId); Object.assign(own, patch); },
    emitElfEvent: (_s: string, _e: any, event: string, data: any) => events.push({ event, data }),
    applyHeal: (s: string, amount: number, opts: any) => heals.push({ s, amount, opts }), addLog: () => {} };
  const item = (id: string) => BATTLE_ITEMS.find(i => i.id === id)!;
  applyBattleItem(ctx, item('hybrid_150_2'), side);
  assert.equal(own.skills[0].pp, 3); assert.equal(heals[0].amount, 150);
  assert.equal(heals[0].opts.isPotion, true); assert.equal(heals[0].opts.presentationPotion, true);
  assert.equal(events[0].event, 'PP_CHANGED'); assert.equal(events[0].data.reason, 'restore'); effectsChecked++;
  applyBattleItem(ctx, item('pp_35'), side);
  assert.equal(own.skills[0].pp, 20, 'PP不得超過上限'); effectsChecked++;
  applyBattleItem(ctx, item('special_5_debuff'), side);
  assert.deepEqual(own.statStages, { atk: 0, def: 2, spatk: 0, spdef: 0, speed: 0, accuracy: 1 }, '只解除下降，保留提升'); effectsChecked++;
  for (const status of ['中毒', '星護', '神話']) addStatusEffect(own, status, 3);
  applyBattleItem(ctx, item('special_170_clear'), side);
  assert.equal(getStatuses(own)['中毒'], undefined);
  assert.ok(getStatuses(own)['星護']); assert.ok(getStatuses(own)['神話'], '淨化不能移除BOSS常駐'); effectsChecked++;
  addStatusEffect(own, '繳械', 3);
  const before = heals.length;
  assert.equal(applyBattleItem(ctx, item('hp_150'), side), false);
  assert.equal(heals.length, before, '禁止吃藥不產生恢復'); effectsChecked++;
}
console.log(`藥劑${BATTLE_ITEMS.length}種上限／耗盡／重開／敵我隔離及${effectsChecked}個效果契約通過。`);
