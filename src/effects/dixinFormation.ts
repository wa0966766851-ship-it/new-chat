import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import { isNonTrueDamageType } from '../battle/damageSemantics';

/** 天陣的期限與正常關閉代價，獨立於八荒倍率與伏魔計算。 */
export function runDixinFormation(c: BattleEventContext, event: EffectTiming | string, data?: any): void {
  const active = c.actor === 'p1' ? c.activeP1 : c.activeP2;
  if ((active.battleId || active.id) !== (c.self.battleId || c.self.id)) return;
  const round = c.roundNumber ?? 0;
  let left = Number(c.getPlayerState('dixinFormationRounds') || 0);
  if (!left && (c.getPlayerState('dixinBahuangStacks') || 0) >= 9 && !c.getPlayerState('dixinFormationAtNine')) {
    left = 9;
    c.setPlayerState('dixinFormationRounds', left);
    c.setPlayerState('dixinFormationBornRound', round);
    c.setPlayerState('dixinFormationAtNine', true);
    c.addTimerTo(c.actor, { id: 'dixin_formation', name: '誅魔天陣', kind: 'round_counter', source: 'soulmark',
      remaining: left, tickAt: 'never', scope: 'elf', payload: { opponentDamageHpCeiling: true } }, false);
    c.addLog('👑 誅魔天陣開啟，持續9回合。', 'effect');
  }
  if ((c.getPlayerState('dixinBahuangStacks') || 0) < 9) c.setPlayerState('dixinFormationAtNine', false);
  if (!left) return;
  const comp = data?.damageComp || data;
  if (event === EffectTiming.BEFORE_DAMAGE && comp?.isIncoming && !comp.pure && isNonTrueDamageType(comp.damageCategory)) {
    // 固定點數減傷，不將「已損失體力」改成比例；可降至0。
    comp.flatReduction = (comp.flatReduction || 0) + Math.max(0, c.target.maxHp - c.target.currentHp) * (comp.reductionPolicy?.attenuation ?? 1);
  }
  const nineLock = (c.actor === 'p1' ? c.p1Timers : c.p2Timers)?.some(t => t.id === 'dixin_nine_lock' && t.remaining > 0 && (!t.ownerBattleId || t.ownerBattleId === (c.self.battleId || c.self.id)));
  const killClose = event === EffectTiming.BATTLE_PHASE_END && data?.killedOpponent && nineLock;
  if (killClose || (event === EffectTiming.ROUND_END && round !== c.getPlayerState('dixinFormationBornRound') && c.getPlayerState('dixinFormationTickRound') !== round)) {
    c.setPlayerState('dixinFormationTickRound', round);
    left = killClose ? 0 : left - 1;
    c.setPlayerState('dixinFormationRounds', left);
    c.consumeTimer(c.actor, 'dixin_formation');
    if (left) c.addTimerTo(c.actor, { id: 'dixin_formation', name: '誅魔天陣', kind: 'round_counter', source: 'soulmark',
      remaining: left, tickAt: 'never', scope: 'elf', payload: { opponentDamageHpCeiling: true } }, false);
    if (!left) {
      for (let i = 1; i < 9; i++) c.consumeTimer(c.actor, 'dixin_formation');
      // 移除來源綁定的快照；不把下一隻或另一個天陣的限制一起清掉。
      for (const s of ['p1', 'p2'] as const) for (const t of (s === 'p1' ? c.p1Timers : c.p2Timers) || []) {
        if (t.payload?.linkedSourceTimerId === 'dixin_formation' && t.payload?.linkedSourceSide === c.actor) c.consumeTimer(s, t.id);
      }
      c.adjustHp(c.actor, 1 - c.self.currentHp);
      c.updateElf(c.actor, { skills: c.self.skills.map(s => ({ ...s, pp: 0, currentPp: 0 })) });
      c.addTimerTo(c.actor, { id: 'dixin_formation_exit', name: '誅魔天陣·關閉', kind: 'round_counter', source: 'soulmark', remaining: 1,
        tickAt: 'round_end', pendingActivation: true, payload: { lockSwitch: true }, scope: 'elf' }, false);
      c.addLog('👑 誅魔天陣正常關閉：體力調整為1、技能PP歸0，下回合無法主動切換。', 'effect');
    }
  }
}
