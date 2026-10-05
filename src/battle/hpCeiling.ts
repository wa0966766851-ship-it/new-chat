import type { BattleState } from '../components/BattleManager';
import type { Elf } from '../types';
import { addTimer } from './timers';

/** 傷害前體力快照是當前體力限制，不改最大體力，也不是禁止回血。 */
export function recordDamageHpCeilings(state: BattleState, side: 'p1' | 'p2', elf: Elf, hpBefore: number): BattleState {
  const sourceSide = side === 'p1' ? 'p2' : 'p1';
  const source = state[sourceSide];
  let timers = state[`${side}Timers`] || [];
  for (const timer of state[`${sourceSide}Timers`] || []) {
    if (!timer.payload?.opponentDamageHpCeiling || timer.remaining <= 0 || timer.pendingActivation
      || (timer.ownerBattleId && timer.ownerBattleId !== (source.battleId || source.id))) continue;
    const id = `hp_ceiling:${timer.id}:${elf.battleId || elf.id}`;
    const previous = timers.find(t => t.id === id)?.payload?.hpCeiling;
    timers = addTimer(timers, { id, name: `${timer.name}·體力限制`, kind: 'round_counter', source: timer.source,
      remaining: 1, tickAt: 'never', scope: 'elf', ownerBattleId: elf.battleId || elf.id, persistsOffField: true,
      payload: { hpCeiling: Math.min(hpBefore, Number.isFinite(previous) ? previous : hpBefore),
        linkedSourceTimerId: timer.id, linkedSourceSide: sourceSide, linkedSourceBattleId: source.battleId || source.id } });
  }
  return timers === state[`${side}Timers`] ? state : { ...state, [`${side}Timers`]: timers };
}

/** 來源已結束、下場或換成同名另一隻時，快照立即失效。 */
export function capCurrentHp(state: BattleState, side: 'p1' | 'p2', elf: Elf, hp: number): number {
  for (const timer of state[`${side}Timers`] || []) {
    const p = timer.payload;
    if (!p || !Number.isFinite(p.hpCeiling) || timer.remaining <= 0 || timer.pendingActivation
      || (timer.ownerBattleId && timer.ownerBattleId !== (elf.battleId || elf.id))) continue;
    if (p.linkedSourceTimerId) {
      const sourceSide = p.linkedSourceSide as 'p1' | 'p2';
      if (!['p1', 'p2'].includes(sourceSide)) continue;
      const source = state[sourceSide];
      if (p.linkedSourceBattleId !== (source.battleId || source.id)
        || !state[`${sourceSide}Timers`]?.some(t => t.id === p.linkedSourceTimerId && t.remaining > 0 && !t.pendingActivation)) continue;
    }
    hp = Math.min(hp, p.hpCeiling);
  }
  return hp;
}
