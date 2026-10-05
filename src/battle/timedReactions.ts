import type { BattleEventContext } from '../effects/types';
import { activeConstraints } from './timedConstraints';
import { normalizeDamageType } from './damageSemantics';

/** 綁定受擊者的計時效果；攻擊傷害才觸發，固定/百分比/真傷不能遞迴觸發。 */
export function reactToTimedAttack(ctx: BattleEventContext, damageType: string): void {
  if (normalizeDamageType({ damageType }) !== 'skill_attack') return;
  const timers = ctx.targetSide === 'p1' ? ctx.p1Timers : ctx.p2Timers;
  for (const p of activeConstraints(timers, ctx.target)) {
    const ratio = p.onAttackReceivedTruePercent;
    if (typeof ratio === 'number' && ratio > 0) {
      ctx.applyTrueDamage(ctx.targetSide, Math.floor(ctx.target.maxHp * ratio), '受攻擊時附加真實傷害');
    }
  }
}

/** 恢復量減少不同於禁止執行恢復；神降等體力調整仍由生存規則處理。 */
export function timedRecoveryMultiplier(timers: BattleEventContext['p1Timers'], elf: BattleEventContext['self']): number {
  const reductions = activeConstraints(timers, elf)
    .map(p => p.recoveryReductionPercent).filter((n): n is number => typeof n === 'number');
  return Math.max(0, 1 - reductions.reduce((sum, n) => sum + Math.max(0, n), 0));
}

/** 全隊持有登場紀錄，但計數按battleId分開，同名精靈不共用。 */
export function recordBattleEntrance(ctx: BattleEventContext): void {
  const history = ctx.getPlayerState('teamEntranceHistory') || {};
  const id = ctx.self.battleId || ctx.self.id;
  ctx.setPlayerState('teamEntranceHistory', { ...history, [id]: (history[id] || 0) + 1 });
}
