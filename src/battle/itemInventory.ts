import type { BattleItem } from '../types';
import type { BattleEventContext } from '../effects/types';
import { BATTLE_ITEMS, isElfItemDisabled } from '../utils/battleHelpers';
import { changePp, identity } from '../effects/newElfOperations';
import { clearStatuses, abilityKeys } from '../effects/semanticOperations';
import { StatusRegistry } from '../effects/statusRegistry';
import { getMaxPp } from '../utils/battleHelpers';
import { resolveIllusionPick, setIllusionOverride } from './illusion';

export type BattleItemInventory = Record<string, { left: number; max: number }>;
/** 每種藥劑獨立計量，屬於陣營背包，不隨精靈切換；新戰鬥重新建立。 */
export function createBattleItemInventory(unlimited = false): BattleItemInventory {
  return Object.fromEntries(BATTLE_ITEMS.map(item => {
    // 只能被放入的道具（grantOnly）開場為 0。
    if (item.grantOnly) return [item.id, { left: 0, max: GRANT_CAP }];
    const max = unlimited ? Infinity : item.type === 'special' ? 5 : item.type === 'hybrid' ? 50 : 100;
    return [item.id, { left: max, max }];
  }));
}
/** 單一道具可持有的上限（被放入的道具）。 */
export const GRANT_CAP = 99;
/** 未配置庫存的模式（星蝕回廊以藥劑次數計）在首次放入道具時建立：一般藥劑不限量，維持原計次規則。 */
export const isUnlimitedInventory = (inventory: BattleItemInventory | undefined): boolean =>
  !!inventory && Object.values(inventory).some(entry => !Number.isFinite(entry.max));
export function hasBattleItem(inventory: BattleItemInventory | undefined, id: string): boolean {
  // 只能被放入的道具：必須真的持有，沒有庫存表也不能用。
  if (BATTLE_ITEMS.find(item => item.id === id)?.grantOnly) return (inventory?.[id]?.left || 0) > 0;
  // 未配置庫存的舊測試／星際探索仍使用原模式的計次規則。
  return inventory === undefined || (inventory[id]?.left || 0) > 0;
}
/** 通用：放入道具欄位（不超過上限）。庫存表不存在時視為不限量模式並建立。 */
export function grantBattleItem(inventory: BattleItemInventory | undefined, id: string, count = 1): BattleItemInventory | undefined {
  const item = BATTLE_ITEMS.find(candidate => candidate.id === id);
  if (!item || !(count > 0)) return undefined;
  const base = inventory ?? createBattleItemInventory(true);
  const entry = base[id] ?? { left: 0, max: GRANT_CAP };
  const max = Number.isFinite(entry.max) ? entry.max : GRANT_CAP;
  return { ...base, [id]: { left: Math.min(max, entry.left + count), max } };
}
export function consumeBattleItem(inventory: BattleItemInventory, id: string): BattleItemInventory | undefined {
  const entry = inventory[id];
  if (!entry || entry.left <= 0) return undefined;
  return { ...inventory, [id]: { ...entry, left: entry.left - 1 } };
}

/** 通用藥劑效果：正常使用及偷取後立即使用走同一結算，沒有免費替代。 */
export function applyBattleItem(ctx: BattleEventContext, item: BattleItem, recipient: 'p1' | 'p2'): boolean {
  // 需要選擇對象的道具：對象在使用當下必須仍在雙方背包內且未消逝，否則整個道具不生效。
  if (item.pickTarget && !(item.picked && resolveIllusionPick(ctx, item.picked))) {
    ctx.addLog(`【${item.name}】：指定的精靈已消逝或不在背包內，無法使用。`, 'effect');
    return false;
  }
  const active = recipient === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const elf = ctx.actor === recipient ? ctx.self : active;
  if (isElfItemDisabled(elf)) return false;
  ctx.addLog(`【${elf.name}】使用了【${item.name}】！`, 'info');
  if (item.value) {
    const opts = { isPotion: true, presentationPotion: true };
    if (identity(elf) !== identity(active) && ctx.applyHealToElf) ctx.applyHealToElf(recipient, identity(elf), item.value, opts);
    else ctx.applyHeal(recipient, item.value, opts);
  }
  if (item.ppValue) changePp(ctx, recipient, elf, s => Math.min(getMaxPp(s, elf), s.pp + item.ppValue!), true);
  if (item.effect === 'clear_status') {
    clearStatuses(ctx, recipient, elf, name => !StatusRegistry[name]?.categories.some(category => category === 'AUXILIARY' || category === 'BOSS_ONLY'));
  }
  if (item.effect === 'clear_debuff') {
    const stages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, ...elf.statStages };
    for (const key of abilityKeys) stages[key] = Math.max(0, stages[key]);
    ctx.updateAnyElf(recipient, identity(elf), { statStages: stages });
  }
  if (item.effect === 'set_illusion_target' && item.picked) setIllusionOverride(ctx, item.picked);
  ctx.addLog(`【藥劑】：${item.name}效果已結算（持有者 ${identity(elf)}）。`, 'effect');
  return true;
}
