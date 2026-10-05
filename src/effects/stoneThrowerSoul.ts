import { BattleEventContext, EffectTiming } from './types';
import { isSkillDamageType } from '../battle/damageSemantics';
import { clampSkillPp } from '../utils/battleHelpers';

/** 墜星魂印：特質投石者的轉化、PP、神話由共用機制處理，這裡只處理魂印。 */
export function handleStoneThrowerSoul(ctx: BattleEventContext, event: string, data?: any): boolean {
  if (event === EffectTiming.ON_SKILL_HIT) {
    ctx.applyHeal(ctx.actor, data?.settledDamage ?? data?.finalDamage ?? 0);
  }
  if (event === EffectTiming.AFTER_ACTION && data?.hit !== false && ctx.skill?.category !== '屬性') {
    ctx.updateElf(ctx.actor, { skills: ctx.self.skills.map(s => ({ ...s, pp: clampSkillPp(s, s.pp + 2, ctx.self) })) });
    ctx.setOpponentState('utilitySkillInvalidTurns', 2);
    ctx.setPlayerState('immuneControlTurns', 2);
    const lost = Math.max(0, ctx.target.maxHp - ctx.target.currentHp);
    ctx.applyPinkDamage(ctx.targetSide, Math.floor(lost * .5), '百分比傷害', undefined, undefined, 'percent');
  }
  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === ctx.targetSide && isSkillDamageType(data.damageType)) {
    const id = ctx.self.battleId || ctx.self.id;
    const count = ctx.getEligibleTeam(ctx.actor).filter(e => (e.battleId || e.id) !== id && e.currentHp > 0 && e.currentHp < e.maxHp).length;
    ctx.setPlayerState('nextAttackPowerBonus', count * .25);
  }
  if (event === EffectTiming.MODIFY_POWER && !data?.isIncoming && ctx.skill?.category !== '屬性') {
    const bonus = Number(ctx.getPlayerState('nextAttackPowerBonus') || 0);
    if (bonus > 0) {
      data.powerComp.power *= 1 + bonus;
      ctx.setPlayerState('nextAttackPowerBonus', 0);
    }
  }
  return false;
}
