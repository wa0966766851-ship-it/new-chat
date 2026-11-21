import type { BattleItem } from '../types';
import type { BattleEventContext } from '../effects/types';
import { BATTLE_ITEMS, isElfItemDisabled } from '../utils/battleHelpers';
import { changePp, identity } from '../effects/newElfOperations';
import { clearStatuses, abilityKeys } from '../effects/semanticOperations';
import { StatusRegistry } from '../effects/statusRegistry';
import {canonicalStatusName} from '../effects/statusIdentity';
import { getMaxPp } from '../utils/battleHelpers';
import { resolveIllusionPick, setIllusionOverride } from './illusion';
import { potionBacklash } from './actionRestrictions';
import type { Elf } from '../types';
import { makeEffectPresentation } from './effectPresentation';
import { regenTargetText } from './potionRegen';

/** 與道具一起保存的加入時紀錄；不跟隨來源之後的能力變動。 */
export interface BattleItemSnapshot {
  sourceBattleId: string;
  /** 種族身分不隨來源被移除而遺失；不能用戰鬥個體ID推算。 */
  sourceElfId?: string;
  stats: import('../types').BaseStats;
}
export interface BattleItemEntry { left: number; max: number; snapshot?: BattleItemSnapshot; conversionIndex?: number }
export type BattleItemInventory = Record<string, BattleItemEntry>;
/** 回傳副本，讀取者不能繞過庫存管道修改持有量或能力紀錄。 */
export function readBattleItem(inventory: BattleItemInventory | undefined, id: string): BattleItemEntry | undefined {
  const entry = inventory?.[id];
  return entry && { ...entry, ...(entry.snapshot ? { snapshot: { ...entry.snapshot, stats: { ...entry.snapshot.stats } } } : {}) };
}
export function itemRetainsStatusDuration(inventory:BattleItemInventory|undefined,status:string):boolean {
  const name=canonicalStatusName(status);
  return BATTLE_ITEMS.some(item=>(inventory?.[item.id]?.left||0)>0&&item.retainStatusDuration?.some(id=>canonicalStatusName(id)===name));
}
/** 每種藥劑獨立計量，屬於陣營背包，不隨精靈切換；新戰鬥重新建立。 */
export function createBattleItemInventory(unlimited = false): BattleItemInventory {
  return Object.fromEntries(BATTLE_ITEMS.map(item => {
    // 只能被放入的道具（grantOnly）開場為 0。
    if (item.grantOnly) return [item.id, { left: 0, max: item.holdLimit ?? GRANT_CAP }];
    const max = unlimited ? Infinity : item.stock ?? (item.type === 'special' ? 5 : item.type === 'hybrid' ? 50 : 100);
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
export function grantBattleItem(inventory: BattleItemInventory | undefined, id: string, count = 1, snapshot?: BattleItemSnapshot): BattleItemInventory | undefined {
  const item = BATTLE_ITEMS.find(candidate => candidate.id === id);
  if (!item || !Number.isSafeInteger(count) || count < 1) return undefined;
  if (item.holdLimit !== undefined && (!Number.isSafeInteger(item.holdLimit) || item.holdLimit < 1)) return undefined;
  if (snapshot && (!snapshot.sourceBattleId || !(['hp','atk','def','spatk','spdef','speed'] as const).every(key => Number.isFinite(snapshot.stats?.[key]) && snapshot.stats[key] >= 0))) return undefined;
  if(snapshot?.sourceElfId!==undefined&&(typeof snapshot.sourceElfId!=='string'||!snapshot.sourceElfId||snapshot.sourceElfId.length>200))return undefined;
  const base = inventory ?? createBattleItemInventory(true);
  const entry = base[id] ?? { left: 0, max: GRANT_CAP };
  const max = Math.min(Number.isFinite(entry.max) ? entry.max : GRANT_CAP, item.holdLimit ?? Infinity);
  const group = item.inventoryGroup;
  if (group && (!group.id || !Number.isSafeInteger(group.limit) || group.limit < 1)) return undefined;
  const groupHeld = group ? BATTLE_ITEMS.filter(candidate => candidate.inventoryGroup?.id === group.id)
    .reduce((sum, candidate) => sum + (base[candidate.id]?.left || 0), 0) : 0;
  const left = Math.min(max, entry.left + count, entry.left + (group ? Math.max(0, group.limit - groupHeld) : count));
  // 加入失敗不能覆寫舊紀錄；用完重新加入才會得到新的加入時能力。
  if (left <= entry.left) return undefined;
  return { ...base, [id]: { ...entry, left, max, snapshot: snapshot ? { ...snapshot, stats: { ...snapshot.stats } } : entry.left > 0 ? entry.snapshot : undefined } };
}
export function consumeBattleItem(inventory: BattleItemInventory, id: string): BattleItemInventory | undefined {
  const entry = inventory[id];
  if (!entry || entry.left <= 0) return undefined;
  return { ...inventory, [id]: { ...entry, left: entry.left - 1 } };
}

/** 一次轉化一個實際持有物品；選不到合法形態時整筆不變。游標保存在陣營庫存，換人不重設。 */
export function convertBattleItem(inventory: BattleItemInventory | undefined, fromId: string, intoIds: string[]): BattleItemInventory | undefined {
  if (!inventory || !(inventory[fromId]?.left > 0) || !intoIds.length || intoIds.length > 30 ||
      new Set(intoIds).size !== intoIds.length || intoIds.includes(fromId)) return undefined;
  const source = BATTLE_ITEMS.find(item => item.id === fromId);
  const targets = intoIds.map(id => BATTLE_ITEMS.find(item => item.id === id));
  if (!source || targets.some(item => !item)) return undefined;
  const consumed = consumeBattleItem(inventory, fromId)!;
  const cursor = inventory[fromId].conversionIndex || 0;
  for (let offset = 0; offset < intoIds.length; offset++) {
    const index = (cursor + offset) % intoIds.length;
    const next = grantBattleItem(consumed, intoIds[index], 1, inventory[fromId].snapshot);
    if (next) return { ...next, [fromId]: { ...next[fromId], conversionIndex: (index + 1) % intoIds.length } };
  }
  return undefined;
}

/** 百分比藥劑上限（使用者規格：最高 30%）。 */
export const ITEM_PERCENT_CAP = 30;
const pct = (n: number | undefined) => Math.max(0, Math.min(ITEM_PERCENT_CAP, Number(n) || 0));
/** 每個技能依自己的 PP 上限換算百分比，至少 1 點。 */
export function percentPp(skill: any, elf: any, percent: number): number {
  const max = getMaxPp(skill, elf);
  if (!(max > 0) || !(percent > 0)) return 0;
  return Math.max(1, Math.ceil(max * percent / 100));
}

/**
 * 進入異常：一律走正式附加流程（異常免疫、反彈、轉化、魂印／套裝／特性的附加前防護、附加後響應都照常）。
 * 已處於該異常時，正式流程會以新的回合數取代舊的＝重置為指定回合（預設 3）。
 * 2026-11-07：過去「已處於」直接改回合數，繞過了免疫與反彈。
 */
export function enterStatus(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf, name: string, turns = 3): boolean {
  const e = ctx.getFullTeam(side).find(x => identity(x) === identity(elf)) || elf;
  const held = Number((e.battleStatuses || {})[name] || 0) > 0 || e.battleStatus === name;
  const result = ctx.applyStatusWithImmunityCheck(side, name, turns, false, identity(e));
  const ok = !!(result as any)?.success;
  if (ok && held) {
    // 舊欄位（battleStatuses／battleStatus）也同步重置，避免較長的舊回合數蓋過新回合數。
    const now = ctx.getFullTeam(side).find(x => identity(x) === identity(e)) || e;
    if (Number((now.battleStatuses || {})[name] || 0) > 0 || now.battleStatus === name)
      ctx.updateAnyElf(side, identity(now), { ...(now.battleStatuses?.[name] ? { battleStatuses: { ...now.battleStatuses, [name]: turns } } : {}), ...(now.battleStatus === name ? { battleStatusDuration: turns } : {}) });
    ctx.addLog(`【${e.name}】的【${name}】重置為 ${turns} 回合。`, 'status');
  }
  return ok;
}
/** 目前持有、且可被藥劑解除的異常（不含輔助／首領專屬）。 */
const curableHeld = (elf: Elf) => {
  const names = new Set<string>([...Object.entries(elf.battleStatuses || {}).filter(([, t]) => Number(t) > 0).map(([n]) => n),
    ...(elf.battleStatus && elf.battleStatus !== 'normal' ? [elf.battleStatus] : [])]);
  return [...names].filter(name => !StatusRegistry[name]?.categories.some(category => category === 'AUXILIARY' || category === 'BOSS_ONLY'));
};

/**
 * 藥劑施加的回合計時器（藥劑反噬／禁止藥劑／禁止切換／持續恢復）。與積木計時器同一格式（payload.block），
 * 行動限制查詢（actionRestrictions）與回合結束結算（runSideTimers）都讀同一份。
 */
function addPotionTimer(ctx: BattleEventContext, side: 'p1' | 'p2', item: BattleItem, name: string, turns: number, block: Record<string, any>, scope: 'elf' | 'team') {
  const presentation = makeEffectPresentation({ block }, item.name, name, { name });
  ctx.addTimerTo(side, {
    id: `potion_${side}_${item.id}_${name}`, name: presentation.label || name, presentation, scope,
    kind: 'turn_effect', source: 'skill', remaining: turns, pendingActivation: false, tickAt: 'round_end',
    payload: { block: { ...block, owner: side, src: item.name, potion: item.id } },
    description: presentation.description || name,
  } as any, false);
}

/** 藥劑反噬傷害：只能由藥劑附加；無視傷害減免與傷害限制（見 damageSemantics.POTION_BACKLASH_DAMAGE）。 */
function potionDamage(ctx: BattleEventContext, side: 'p1' | 'p2', elf: Elf, amount: number, label: string) {
  const n = Math.max(0, Math.floor(amount));
  if (!n) return;
  if (ctx.applyPotionBacklashDamage) ctx.applyPotionBacklashDamage(side, n, label, identity(elf));
  else ctx.adjustHpToElf?.(side, identity(elf), -n);
}

/**
 * 通用藥劑效果：正常使用及偷取後立即使用走同一結算，沒有免費替代。
 * 藥劑反噬（2026-11-07 使用者規格）：使用方在場精靈處於藥劑反噬時，所有藥劑效果反轉——
 * - 增加體力 → 受到等量藥劑反噬傷害；增加 PP → 扣除等量 PP；
 * - 解除異常 → 進入對應異常（已處於則重置 3 回合；「解除全部異常」＝目前持有的異常全部重置 3 回合）；
 * - 解除能力下降 → 消除自身能力提升（對稱補完）；
 * - 對對手的藥劑反噬傷害／扣 PP／附加異常 → 生效目標改為使用方在場精靈。
 */
/** 持有物指定的對方精靈（存活即可，不論在場）依反噬量恢復體力與PP。 */
export function restoreBacklashGrantor(ctx: BattleEventContext, holderSide: 'p1' | 'p2', hp: number, ppFor?: (skill: any, elf: any) => number): void {
  const rule = BATTLE_ITEMS.find(held => held.backlashRestore && (ctx.getBattleItem?.(holderSide, held.id)?.left || 0) > 0)?.backlashRestore;
  if (!rule) return;
  const side: 'p1' | 'p2' = holderSide === 'p1' ? 'p2' : 'p1';
  const grantor = ctx.getFullTeam(side).find(e => String(e.id) === rule.elfId && e.currentHp > 0 && !(e as any).isVanished);
  if (!grantor) return;
  const heal = Math.floor(hp * rule.ratio);
  if (heal > 0) ctx.applyHealToElf ? ctx.applyHealToElf(side, identity(grantor), heal, {}) : ctx.applyHeal(side, heal);
  if (ppFor) changePp(ctx, side, grantor, s => Math.min(getMaxPp(s, grantor), s.pp + Math.floor(ppFor(s, grantor) * rule.ratio)), true);
}

export const itemHpAmount = (item: BattleItem, maxHp: number) =>
  (item.value || 0) + Math.floor(maxHp * pct(item.hpPercent) / 100);

export const itemDamageAmount = (item: BattleItem, maxHp: number) =>
  (item.oppDamage || 0) + Math.floor(maxHp * pct(item.oppDamagePercent) / 100);

export function applyBattleItem(ctx: BattleEventContext, item: BattleItem, recipient: 'p1' | 'p2', runProgram?: (ctx:BattleEventContext,item:BattleItem,backlash:boolean)=>void): boolean {
  if(item.unusable)return false;
  if(item.useKit&&!runProgram)return false;
  // 需要選擇對象的道具：對象在使用當下必須仍在雙方背包內且未消逝，否則整個道具不生效。
  if (item.pickTarget && !(item.picked && resolveIllusionPick(ctx, item.picked))) {
    ctx.addLog(`【${item.name}】：指定的精靈已消逝或不在背包內，無法使用。`, 'effect');
    return false;
  }
  const active = recipient === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const elf = ctx.actor === recipient ? ctx.self : active;
  if (isElfItemDisabled(elf)) return false;
  const oppSide: 'p1' | 'p2' = recipient === 'p1' ? 'p2' : 'p1';
  const opp = oppSide === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const state = { [`${recipient}Timers`]: recipient === 'p1' ? ctx.p1Timers : ctx.p2Timers, [recipient]: elf } as any;
  const backlash = !!potionBacklash(state, recipient, elf)||BATTLE_ITEMS.some(held=>held.potionBacklashWhileHeld&&(ctx.getBattleItem?.(recipient,held.id)?.left||0)>0);
  ctx.addLog(`【${elf.name}】使用了【${item.name}】！${backlash ? '（藥劑反噬：效果反轉）' : ''}`, 'info');
  const hpGain = itemHpAmount(item, elf.maxHp);
  if (hpGain > 0) {
    if (backlash) { potionDamage(ctx, recipient, elf, hpGain, `${item.name}・藥劑反噬`); restoreBacklashGrantor(ctx, recipient, hpGain); }
    else {
      const opts = { isPotion: true, presentationPotion: true };
      if (identity(elf) !== identity(active) && ctx.applyHealToElf) ctx.applyHealToElf(recipient, identity(elf), hpGain, opts);
      else ctx.applyHeal(recipient, hpGain, opts);
    }
  }
  const ppPct = pct(item.ppPercent);
  if (item.ppValue || ppPct) {
    const amountFor = (s: any) => (item.ppValue || 0) + (ppPct ? percentPp(s, elf, ppPct) : 0);
    if (backlash) { changePp(ctx, recipient, elf, s => Math.max(0, s.pp - amountFor(s))); restoreBacklashGrantor(ctx, recipient, 0, (s, g) => (item.ppValue || 0) + (ppPct ? percentPp(s, g, ppPct) : 0)); }
    else changePp(ctx, recipient, elf, s => Math.min(getMaxPp(s, elf), s.pp + amountFor(s)), true);
  }
  if (item.effect === 'clear_status' || item.cureStatuses?.length) {
    const only = item.cureStatuses?.length ? new Set(item.cureStatuses) : null;
    if (backlash) {
      const fresh = ctx.getFullTeam(recipient).find(x => identity(x) === identity(elf)) || elf;
      for (const name of only ? [...only] : curableHeld(fresh)) enterStatus(ctx, recipient, elf, name, 3);
    } else clearStatuses(ctx, recipient, elf, name => (only ? only.has(name) : true) && !StatusRegistry[name]?.categories.some(category => category === 'AUXILIARY' || category === 'BOSS_ONLY'));
  }
  if (item.effect === 'clear_debuff') {
    const stages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, ...elf.statStages };
    for (const key of abilityKeys) stages[key] = backlash ? Math.min(0, stages[key]) : Math.max(0, stages[key]);
    ctx.updateAnyElf(recipient, identity(elf), { statStages: stages });
  }
  // 攻擊型藥劑：藥劑反噬時目標改為使用方在場精靈。
  const hitSide = backlash ? recipient : oppSide;
  const hitElf = backlash ? elf : opp;
  if (hitElf && (item.oppDamage || item.oppDamagePercent)) {
    const amount = itemDamageAmount(item, hitElf.maxHp);
    potionDamage(ctx, hitSide, hitElf, amount, item.name);
  }
  if (hitElf && item.oppPpDrain) changePp(ctx, hitSide, hitElf, s => Math.max(0, s.pp - item.oppPpDrain!));
  if (hitElf && item.inflictStatuses?.length) for (const st of item.inflictStatuses) enterStatus(ctx, hitSide, hitElf, st.name, st.turns ?? 3);
  // 回合類干擾：令對手進入藥劑反噬／無法使用藥劑／無法主動切換；反噬時改為施加在自己身上。
  if (item.oppPotionBacklash) { addPotionTimer(ctx, hitSide, item, '藥劑反噬', item.oppPotionBacklash, { potionBacklash: true }, 'team');
    ctx.addLog(`🧪 ${hitSide === recipient ? '自身' : '對手'}全隊 ${item.oppPotionBacklash} 回合進入藥劑反噬！`, 'effect'); }
  if (item.oppItemLock) { addPotionTimer(ctx, hitSide, item, '無法使用藥劑', item.oppItemLock, { noItem: true }, 'team');
    ctx.addLog(`🚫 ${hitSide === recipient ? '自身' : '對手'}全隊 ${item.oppItemLock} 回合無法使用藥劑！`, 'effect'); }
  if (item.oppSwitchLock && hitElf) { addPotionTimer(ctx, hitSide, item, '無法主動切換', item.oppSwitchLock, { lockSwitch: true }, 'elf');
    ctx.addLog(`⛓️ 【${hitElf.name}】${item.oppSwitchLock} 回合無法主動切換精靈！`, 'effect'); }
  // 強化型：自身附屬狀態；反噬時改為解除自身這些狀態。
  if (item.selfStatuses?.length) {
    if (backlash) { const names = new Set(item.selfStatuses.map(st => st.name)); clearStatuses(ctx, recipient, elf, name => names.has(name)); }
    else for (const st of item.selfStatuses) enterStatus(ctx, recipient, elf, st.name, st.turns ?? 3);
  }
  // 持續恢復：之後 N 回合每回合結束結算；使用當下的反噬狀態決定是否整段反轉。
  if (item.regen && item.regen.turns > 0) {
    const r = item.regen;
    const tick = { hp: r.hp, hpPercent: r.hpPercent, pp: r.pp, ppPercent: r.ppPercent, targets: r.targets, inverted: backlash, label: item.name };
    addPotionTimer(ctx, recipient, item, backlash ? '持續反噬' : '持續恢復', r.turns,
      { trig: 'round_end', potionRegen: tick, body: [{ acts: [{ op: 'potion_regen', p: tick }] }] }, 'team');
    ctx.addLog(`🧪 ${regenTargetText(r.targets)}之後 ${r.turns} 回合每回合結束${backlash ? '受到藥劑反噬' : '持續恢復'}！`, 'effect');
  }
  if (item.effect === 'set_illusion_target' && item.picked) setIllusionOverride(ctx, item.picked);
  if(item.useKit)runProgram!(ctx,item,backlash);
  ctx.addLog(`【藥劑】：${item.name}效果已結算（持有者 ${identity(elf)}）。`, 'effect');
  return true;
}
