import type { BattleItem } from '../types';
import type { BattleEventContext } from '../effects/types';
import { BATTLE_ITEMS, isElfItemDisabled } from '../utils/battleHelpers';
import { changePp, identity } from '../effects/newElfOperations';
import { clearStatuses, abilityKeys } from '../effects/semanticOperations';
import { StatusRegistry } from '../effects/statusRegistry';
import { getMaxPp } from '../utils/battleHelpers';

export type BattleItemInventory = Record<string, { left: number; max: number }>;
/** 每種藥劑獨立計量，屬於陣營背包，不隨精靈切換；新戰鬥重新建立。 */
export function createBattleItemInventory(): BattleItemInventory {
  return Object.fromEntries(BATTLE_ITEMS.map(item => {
    const max = item.type === 'special' ? 5 : item.type === 'hybrid' ? 50 : 100;
    return [item.id, { left: max, max }];
  }));
}
export function hasBattleItem(inventory: BattleItemInventory | undefined, id: string): boolean {
  // 未配置庫存的舊測試／星際探索仍使用原模式的計次規則。
  return inventory === undefined || (inventory[id]?.left || 0) > 0;
}
export function consumeBattleItem(inventory: BattleItemInventory, id: string): BattleItemInventory | undefined {
  const entry = inventory[id];
  if (!entry || entry.left <= 0) return undefined;
  return { ...inventory, [id]: { ...entry, left: entry.left - 1 } };
}

/** 通用藥劑效果：正常使用及偷取後立即使用走同一結算，沒有免費替代。 */
export function applyBattleItem(ctx: BattleEventContext, item: BattleItem, recipient: 'p1' | 'p2'): boolean {
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
  ctx.addLog(`【藥劑】：${item.name}效果已結算（持有者 ${identity(elf)}）。`, 'effect');
  return true;
}
