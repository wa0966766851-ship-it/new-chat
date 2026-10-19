import type { BattleEventContext } from '../effects/types';
import { activeConstraints } from './timedConstraints';
import { normalizeDamageType } from './damageSemantics';

/** 綁定受擊者的計時效果；攻擊傷害才觸發，固定/百分比/真傷不能遞迴觸發。 */
export function reactToTimedAttack(ctx: BattleEventContext, damageType: string): void {
  if (normalizeDamageType({ damageType }) !== 'skill_attack') return;
  const timers = ctx.targetSide === 'p1' ? ctx.p1Timers : ctx.p2Timers;
  // 「同一次使用只附加 1 次」（2026-10-17 使用者規則）：同回合內同一技能的多次攻擊結算
  //（主攻＋額外行動／連擊）只算一次附加，避免同源重複。
  // 「同一次使用只附加 1 次」（2026-10-17 使用者規則）：以 timer 自身的一次性消費標記去重。
  // 同一 timer 在一次攻擊結算中被多個入口（主攻／額外行動／粉傷回聲）重複查詢時只結算一次；
  // 該標記隨 timer 消耗或回合結束清除，下一回合再攻擊仍各觸發 1 次。
  const stamp = (ctx.roundNumber ?? 0) + ':' + String((ctx as any).moveIndex ?? '');
  for (const p of activeConstraints(timers, ctx.target)) {
    const ratio = p.onAttackReceivedTruePercent;
    if (typeof ratio !== 'number' || !(ratio > 0)) continue;
    if ((p as any).__trueAppliedStamp === stamp) continue;
    (p as any).__trueAppliedStamp = stamp;
    ctx.applyTrueDamage(ctx.targetSide, Math.floor(ctx.target.maxHp * ratio), '受攻擊時附加真實傷害');
  }
}

/** 恢復量減少不同於禁止執行恢復；神降等體力調整仍由生存規則處理。 */
export function timedRecoveryMultiplier(timers: BattleEventContext['p1Timers'], elf: BattleEventContext['self'], isPotion = false): number {
  const reductions = activeConstraints(timers, elf)
    .filter(p => !isPotion || p.recoveryReductionIncludesPotions === true)
    .map(p => p.recoveryReductionPercent).filter((n): n is number => typeof n === 'number');
  return Math.max(0, 1 - reductions.reduce((sum, n) => sum + Math.max(0, n), 0));
}

/** 全隊持有登場紀錄，但計數按battleId分開，同名精靈不共用。 */
export function recordBattleEntrance(ctx: BattleEventContext): void {
  ctx.setPlayerState(`${ctx.actor}_turnsInBattle`,0);
  const history = ctx.getPlayerState('teamEntranceHistory') || {};
  const id = ctx.self.battleId || ctx.self.id;
  ctx.setPlayerState('teamEntranceHistory', { ...history, [id]: (history[id] || 0) + 1 });
}
