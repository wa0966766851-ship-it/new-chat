import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import type { BattleEventContext } from './types';
import {activeConstraints} from '../battle/timedConstraints';

export function innateAllowed(ctx:BattleEventContext):boolean{
  return !portableSkillCapabilities(ctx.self,ctx.skill).innateDisabled&&!ctx.self.isInherentInvalid&&!activeConstraints((ctx.actor==='p1'?ctx.p1Timers:ctx.p2Timers)||[],ctx.self).some(p=>p.inherentInvalid);
}

/** 附加效果是否可生效：附加效果失效／全命中效果無效／回合內附加無效，任一成立即不可。 */
export function additionalAllowed(ctx: BattleEventContext): boolean {
  const timers = (ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers) || [];
  return (ctx as any).additionalEffectsEnabled !== false && !ctx.self.isAdditionalInvalid && !(ctx.getPlayerState('allHitEffectNullTurns') > 0)
    && !timers.some(t => !t.pendingActivation && t.remaining > 0 && ['all', '攻擊'].includes(t.payload?.block?.addInvalid));
}
