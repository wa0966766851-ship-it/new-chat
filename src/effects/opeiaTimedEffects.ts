import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import type { Timer } from '../battle/timers';
import { queueHpDrain } from '../battle/hpDrain';
import { abilityKeys, currentElf } from './semanticOperations';
import { benchSkip } from './fieldGuard';
import { isAliveBySurvivalRule } from '../battle/survivalRules';

export const opeiaIdentity = (elf: BattleEventContext['self']) => elf.battleId || elf.id;
export const opeiaHasType = (elf: BattleEventContext['self'], type: string) =>
  String(elf.type || '').replace(/系/g, '').split(/[.·・]/).includes(type);
export const opeiaAlive = (elf: BattleEventContext['self']) => !elf.isVanished &&
  (isAliveBySurvivalRule(elf.currentHp, elf.survivalRule) || (elf.deathImmunity?.deathImmuneTurns || 0) > 0);

export function opeiaTimer(ctx: BattleEventContext, side: 'p1' | 'p2', id: string, rounds: number,
  payload: Timer['payload'] = {}, next = false, source: 'skill' | 'soulmark' = 'skill', benefitAlreadyMissed = true) {
  ctx.addTimerTo(side, { id, name: source === 'soulmark' ? '后' : id.startsWith('opeia_rust') ? '王·鏽腑喰心' : id.startsWith('opeia_crown') ? '蟲后之冠' : '蟲群庇護',
    kind: source === 'soulmark' ? 'round_counter' : 'turn_effect', source, remaining: rounds, scope: 'elf',
    tickAt: 'round_end', pendingActivation: next, persistsOffField: false, payload }, ctx.moveIndex === 1 && benefitAlreadyMissed);
}

export function opeiaTimerOn(ctx: BattleEventContext, id: string): boolean {
  return ((ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers) || []).some(t =>
    t.id === id && t.remaining > 0 && !t.pendingActivation &&
    (t.scope === 'team' || !t.ownerBattleId || t.ownerBattleId === opeiaIdentity(ctx.self)));
}

/** 技能計時效果由持有者魂印接收生命週期；個體身分及消除/到期均以timer為準。 */
export function runOpeiaTimedEffects(ctx: BattleEventContext, event: EffectTiming, data?: any): void {
  if (benchSkip(ctx, event)) return;
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill && data.skill.category !== '屬性' &&
    opeiaTimerOn(ctx, 'opeia_swarm_disarm')) {
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, '繳械', 3);
  }
  if (event === EffectTiming.ROUND_START && opeiaTimerOn(ctx, 'opeia_swarm_stages')) {
    // 三個不同能力；使用戰鬥RNG，不能以sort(Math.random)造成重複或非均勻選取。
    const keys = [...abilityKeys];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor((ctx.rng ?? Math.random)() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    const before = currentElf(ctx, ctx.targetSide, ctx.target);
    ctx.applyStatChange(ctx.targetSide, Object.fromEntries(keys.slice(0, 3).map(k => [k, -1])));
    const after = currentElf(ctx, ctx.targetSide, ctx.target);
    const gained = Object.fromEntries(keys.slice(0, 3).map(k => [k,
      Math.max(0, (before.statStages?.[k] || 0) - (after.statStages?.[k] || 0))]));
    ctx.applyStatChange(ctx.actor, gained);
    // 使用者確認：受限者是對手；「下2回合」不能提前鎖住當回合的切換。
    if (!abilityKeys.every(k => (after.statStages?.[k] || 0) < 0)) {
      opeiaTimer(ctx, ctx.targetSide, 'opeia_swarm_switch_lock', 2, { lockSwitch: true }, true);
    }
  }
  if (event !== EffectTiming.AFTER_ACTION) return;
  if (opeiaTimerOn(ctx, 'opeia_crown_drain')) {
    const self = currentElf(ctx, ctx.actor, ctx.self);
    const target = currentElf(ctx, ctx.targetSide, ctx.target);
    queueHpDrain(ctx, ctx.targetSide, Math.floor(target.maxHp / 3) *
      (self.currentHp < self.maxHp / 2 ? 2 : 1), 'percent', '蟲后之冠·吸取');
    if (self.currentHp > self.maxHp / 2) for (const e of ctx.getFullTeam(ctx.actor)) {
      if (opeiaIdentity(e) !== opeiaIdentity(self) && opeiaAlive(e)) ctx.applyHealToElf?.(ctx.actor, opeiaIdentity(e), 200);
    }
  }
  if (opeiaTimerOn(ctx, 'opeia_crown_fixed')) {
    const targetId = opeiaIdentity(ctx.target);
    ctx.applyPinkDamage(ctx.targetSide, 300, '蟲后之冠·固定傷害', undefined, undefined, 'fixed', {
      onSettled: receipt => {
        if (receipt.targetBattleId !== targetId || receipt.hpLost >= 200) return;
        // 明寫體力減少量，不能拿名目300或盾罩承受量代替；汲取明確走真傷。
        queueHpDrain(ctx, ctx.targetSide, 200, 'true', '蟲后之冠·汲取');
      },
    });
  }
}

export function opeiaSwarm(ctx: BattleEventContext): void {
  opeiaTimer(ctx, ctx.actor, 'opeia_swarm_status', 5, { immuneStatus: true, reflectStatus: true });
  opeiaTimer(ctx, ctx.actor, 'opeia_swarm_disarm', 3);
  opeiaTimer(ctx, ctx.actor, 'opeia_swarm_stages', 3);
  opeiaTimer(ctx, ctx.targetSide, 'opeia_swarm_damage_taken', 2,
    { applyMode: 'gate', damageTakenIncreasePercent: 1.5, damageTypes: ['skill', 'fixed', 'percent', 'true'] }, true);
  opeiaTimer(ctx, ctx.actor, 'opeia_swarm_priority', 2, { block: { prio: 2 } }, true);
}

export function opeiaCrown(ctx: BattleEventContext): void {
  const target = currentElf(ctx, ctx.targetSide, ctx.target);
  // 此句先於強化計數執行；新轉成蟲系的在場者也納入背包計數。
  if (!opeiaHasType(target, '蟲')) ctx.updateElf(ctx.targetSide,
    { type: '蟲', originalType: target.originalType || target.type, typeChangedUntilSwitch: true });
  else ctx.addTimerTo(ctx.targetSide, { id: 'opeia_crown_next_invalid', name: '蟲后之冠', kind: 'use_counter',
    source: 'skill', remaining: 1, tickAt: 'never', persistsOffField: false, payload: { block: { invalid: 'all' } } }, false);
  const n = [ctx.actor, ctx.targetSide].flatMap(s => ctx.getFullTeam(s as 'p1' | 'p2'))
    .filter(e => !e.isVanished && (opeiaHasType(e, '蟲') || opeiaHasType(e, '混沌'))).length;
  ctx.applyStatChange(ctx.actor, Object.fromEntries(abilityKeys.map(k => [k, 1 + n])));
  // 本次技能的AFTER_ACTION就有收益；即使後手施放，也不能額外多給一回合。
  opeiaTimer(ctx, ctx.actor, 'opeia_crown_drain', 5, {}, false, 'skill', false);
  opeiaTimer(ctx, ctx.actor, 'opeia_crown_fixed', 4, {}, false, 'skill', false);
}
