import { getEffectiveBody } from '../../utils/statCalculator';
import { getMaxPp } from '../../utils/battleHelpers';
import { markAppliesToElf } from '../../battle/marks';
import { queueHpDrain } from '../../battle/hpDrain';
import { queueActionPowerAdd, queueActionPowerMultiplier } from '../../battle/actionDamageModifiers';
import type { BattleEventContext } from '../../effects/types';
import { changePp, timed } from '../../effects/newElfOperations';
import { StatusRegistry } from '../../effects/statusRegistry';
import { statusDurationSum } from '../../effects/statusCollection';
import type { Elf } from '../../types';
import type { RunState } from '../runtime';

type Side = 'p1' | 'p2';
type Context = BattleEventContext;
export const WEIGHT_EFFECT_FIELDS: Record<string, readonly string[]> = {
  weight_adjust: ['side', 'amount'],
  weight_skill_damage: ['side', 'ratio', 'element', 'doublePerInvalid'],
  weight_power: ['ratio', 'hpStep', 'hpBonus'],
  weight_pp_set: ['amount', 'kind'],
  weight_pp_transfer: ['ratio'],
  weight_previous_heal: ['ratio'],
  heal_and_percent: ['ratio'],
  status_random_then_invalid: ['count', 'successClass', 'fallbackStatus', 'kind', 'turns'],
  status_clear_weight: ['amount', 'rewardStatus', 'kind'],
  weight_drain_from_skill: ['threshold'],
  status_turn_exchange: ['amount'],
  weight_ramp: ['step', 'cap', 'threshold', 'cost'],
  weight_entry_status_window: ['status', 'turns', 'deduct'],
  weight_control_cleanse: [],
};

export function weightEffectIssue(op: string, p: any, trig: string): string | null {
  if (p.ratio !== undefined && !(typeof p.ratio === 'number' && p.ratio > 0)) return '比例需為正數';
  if (op === 'weight_adjust' && (!['self', 'opp', 'both'].includes(p.side) || !p.amount)) return '重量調整需指定對象與非零數值';
  if (op === 'weight_skill_damage' && (!['self', 'opp'].includes(p.side) || !p.element)) return '等量系別傷害需明確重量來源及屬性';
  if (op === 'weight_control_cleanse' && !['status_received', 'team_status_received'].includes(trig)) return '控制解除需異常實際附加事件';
  if (op === 'weight_drain_from_skill' && trig !== 'after_hit') return '按技能傷害吸取須於命中後結算';
  return null;
}

export const battleElfId = (elf: Pick<Elf, 'id' | 'battleId'>) => elf.battleId || elf.id;
export function weightOf(ctx: Context, side: Side, elf: Elf) {
  const marks = (ctx.getAllMarks?.(side) ?? ctx.getMarks(side)).filter(mark => markAppliesToElf(mark, elf));
  const current = ctx.getFullTeam(side).find(member => battleElfId(member) === battleElfId(elf)) ?? elf;
  return getEffectiveBody(current, marks).weight;
}

export function adjustWeight(ctx: Context, side: Side, elf: Elf, amount: number) {
  const current = ctx.getFullTeam(side).find(member => battleElfId(member) === battleElfId(elf)) ?? elf;
  const marks = (ctx.getAllMarks?.(side) ?? ctx.getMarks(side)).filter(mark => markAppliesToElf(mark, current));
  const multiplier = getEffectiveBody({ ...current, weight: 100 } as Elf, marks).weight / 100;
  if (!(multiplier > 0) || !amount) return false;
  const weight = Math.max(0, Number(current.weight || 0) + amount / multiplier);
  if (weight === current.weight) return false;
  ctx.updateAnyElf(side, battleElfId(current), { weight });
  ctx.addLog(`【${current.name}】戰鬥重量${amount > 0 ? '+' : ''}${amount}。`, 'effect');
  return true;
}

export function healAndPercent(ctx: Context, elf: Elf, ratio: number) {
  const targetId = battleElfId(ctx.target);
  const options = { onSettled: (receipt: import('../../battle/settlementReceipt').SettlementReceipt) => {
    if (receipt.hpGained > 0 && battleElfId(ctx.target) === targetId) {
      ctx.applyPinkDamage(ctx.targetSide, receipt.hpGained, undefined, undefined, undefined, 'percent');
    }
  } };
  if (ctx.applyHealToElf) ctx.applyHealToElf(ctx.actor, battleElfId(elf), Math.floor(elf.maxHp * ratio), options);
  else ctx.applyHeal(ctx.actor, Math.floor(elf.maxHp * ratio), options);
}

export function transferSlotPp(ctx: Context, ally: Elf, enemy: Elf, ratio: number) {
  const desired = enemy.skills.map(skill => Math.floor(getMaxPp(skill, enemy) * ratio));
  const before = enemy.skills.map(skill => skill.pp);
  changePp(ctx, ctx.targetSide, enemy, (skill, index) => Math.max(0, skill.pp - (desired[index] || 0)), false, 'drain');
  const current = ctx.getFullTeam(ctx.targetSide).find(member => battleElfId(member) === battleElfId(enemy)) ?? enemy;
  changePp(ctx, ctx.actor, ally, (skill, index) => skill.pp + Math.max(0, (before[index] ?? 0) - (current.skills[index]?.pp ?? 0)), true, 'restore');
}

export function weightEffectOperations(deps: {
  liveElf: (ctx: Context, side: Side) => Elf;
  runAct: (ctx: Context, act: any, state: RunState) => boolean;
  addBlockTimer: typeof import('../runtime').addBlockTimer;
}) {
  const { liveElf, addBlockTimer } = deps;
  const self = (ctx: Context) => liveElf(ctx, ctx.actor);
  const opp = (ctx: Context) => liveElf(ctx, ctx.targetSide);
  const run = (ctx: Context, state: RunState, op: string, p: any) => deps.runAct(ctx, { op, p, label: op }, state);
  const statuses = (ctx: Context, elf: Elf) => Object.entries(ctx.getStatuses(elf)).filter(([, turns]) => turns > 0);
  const invalidCount = (ctx: Context, side: Side, elf: Elf, timers: any[] = []) => {
    const scoped = timers.filter(timer => timer.remaining > 0 && !timer.pendingActivation && (!timer.ownerBattleId || timer.ownerBattleId === battleElfId(elf)));
    const types = new Set(scoped.map(timer => timer.payload?.block?.invalid).filter(Boolean));
    const read = side === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState;
    if (read('globalSkillInvalidTurns') > 0) types.add('all');
    if (read('attackSkillInvalidTurns') > 0) types.add('攻擊');
    if (read('utilitySkillInvalidTurns') > 0) types.add('屬性');
    return types.size;
  };

  return {
    weight_adjust: (ctx: Context, p: any) => {
      const targets = p.side === 'both' ? [ctx.actor, ctx.targetSide] : [p.side === 'self' ? ctx.actor : ctx.targetSide];
      return targets.map(side => adjustWeight(ctx, side, liveElf(ctx, side), p.amount)).some(Boolean);
    },
    weight_skill_damage: (ctx: Context, p: any) => {
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const stamp = 'weightDamage:' + ctx.skill?.name;
      if (ctx.actionId !== undefined && ctx.getPlayerState(stamp) === ctx.actionId) return false;
      const count = p.doublePerInvalid
        ? invalidCount(ctx, 'p1', ctx.activeP1, ctx.p1Timers) + invalidCount(ctx, 'p2', ctx.activeP2, ctx.p2Timers)
        : 0;
      const amount = Math.floor(weightOf(ctx, side, liveElf(ctx, side)) * p.ratio * 2 ** count);
      if (!(amount > 0)) return false;
      ctx.setPlayerState(stamp, ctx.actionId);
      ctx.applySkillTypeDamage(ctx.targetSide, amount, '按重量附加系別傷害', {
        elem: p.element, category: 'skill_attribute', applyTypeMatchup: true,
      });
      return true;
    },
    weight_power: (ctx: Context, p: any) => {
      const enemy = opp(ctx);
      const steps = Math.floor((enemy.currentHp / Math.max(1, enemy.maxHp) + Number.EPSILON) / p.hpStep);
      const weightBonus = weightOf(ctx, ctx.actor, self(ctx)) * p.ratio;
      queueActionPowerAdd(ctx, Math.floor(weightBonus));
      if (steps > 0) queueActionPowerMultiplier(ctx, 1 + steps * p.hpBonus);
      return true;
    },
    weight_pp_set: (ctx: Context, p: any) => {
      const enemy = opp(ctx);
      const result = changePp(ctx, ctx.targetSide, enemy, skill => {
        if (p.kind === '攻擊' && skill.category === '屬性') return skill.pp;
        return Math.min(getMaxPp(skill, enemy), p.amount);
      }, false, 'clear');
      return result.removed > 0 || result.restored > 0;
    },
    weight_pp_transfer: (ctx: Context, p: any) => {
      transferSlotPp(ctx, self(ctx), opp(ctx), p.ratio);
      return true;
    },
    weight_previous_heal: (ctx: Context, p: any) => {
      const previousId = ctx.getPlayerState('previousActiveElfId');
      const ally = ctx.getFullTeam(ctx.actor).find(elf => (elf.id === previousId || battleElfId(elf) === previousId) && elf.currentHp > 0 && !elf.isVanished);
      if (!ally || !ctx.applyHealToElf) return false;
      ctx.applyHealToElf(ctx.actor, battleElfId(ally), Math.floor(ally.maxHp * p.ratio));
      return true;
    },
    heal_and_percent: (ctx: Context, p: any) => { healAndPercent(ctx, self(ctx), p.ratio); return true; },
    status_random_then_invalid: (ctx: Context, p: any, state: RunState) => {
      const matched = run(ctx, state, 'status_random', { count: p.count, successClass: p.successClass });
      if (!matched || ctx.getStatuses(opp(ctx))[p.fallbackStatus] > 0) {
        run(ctx, state, 'invalid_turns', { kind: p.kind, turns: p.turns, next: false });
      }
      return matched;
    },
    status_clear_weight: (ctx: Context, p: any, state: RunState) => {
      run(ctx, state, 'cure_status', { side: 'both' });
      const count = state.lastAmount;
      run(ctx, state, 'weight_adjust', { side: 'both', amount: p.amount });
      run(ctx, state, 'status', { side: 'self', status: p.rewardStatus, turns: 1, chance: 100 });
      if (count > 0) {
        run(ctx, state, 'invalid_turns', { kind: p.kind, turns: count, next: false });
        timed(ctx, ctx.targetSide, 'statusBlockedWithInvalid:' + battleElfId(ctx.self), count, {
          statusInflictGuard: { kind: 'all' }, block: { statusGuard: { cls: '' } },
        }, false, 'skill', false);
      }
      return true;
    },
    weight_drain_from_skill: (ctx: Context, p: any) => {
      const amount = Math.floor(ctx.mainSkillSettledAmount ?? ctx.mainSkillHpReduced ?? 0);
      if (amount <= 0) return false;
      queueHpDrain(ctx, ctx.targetSide, amount, amount < p.threshold ? 'true' : 'fixed');
      return true;
    },
    status_turn_exchange: (ctx: Context, p: any, state: RunState) => {
      const ids = new Set(['turn_effect']);
      const timers = [...(ctx.p1Timers || []), ...(ctx.p2Timers || [])].filter(timer => timer.remaining > 0 && ids.has(timer.kind));
      const existingTurns = statusDurationSum(ctx, [self(ctx), opp(ctx)]);
      if (timers.length) for (const side of [ctx.actor, ctx.targetSide]) {
        const elf = liveElf(ctx, side);
        const effects = (elf.effects || []).map(effect => statuses(ctx, elf).some(([name]) => name === effect.id)
          ? { ...effect, duration: effect.duration + timers.length } : effect);
        ctx.updateElf(side, { effects });
      }
      if (existingTurns) run(ctx, state, 'weight_adjust', { side: 'both', amount: p.amount * existingTurns });
      return Boolean(timers.length || existingTurns);
    },
    weight_ramp: (ctx: Context, p: any, state: RunState) => {
      const exponent = Math.round(p.cap / p.step);
      const owner = self(ctx);
      const battle = weightOf(ctx, ctx.actor, owner) > p.threshold;
      const stem = 'weightDamageRamp:' + ctx.skill?.name;
      const fieldCount = Number(ctx.getPlayerState(stem + ':field')) || 0;
      const battleCount = Number(ctx.getPlayerState(stem + ':battle')) || 0;
      if (battle) adjustWeight(ctx, ctx.actor, owner, -p.cost);
      const count = Math.min(exponent, (battle ? battleCount : fieldCount) + 1);
      ctx.setPlayerState(stem + (battle ? ':battle' : ':field'), count);
      const clearOnSwitch = new Set(ctx.getPlayerState('clearOnSwitch') || []);
      clearOnSwitch.add(stem + ':field');
      ctx.setPlayerState('clearOnSwitch', [...clearOnSwitch]);
      ctx.setPlayerState('weightedDamageBonus', p.step * Math.min(exponent, (battle ? fieldCount : battleCount) + count));
      ctx.setPlayerState('weightedBattleDamageBonus', p.step * Math.min(exponent, battle ? count : battleCount));
      return true;
    },
    weight_entry_status_window: (ctx: Context, p: any, state: RunState) => {
      if (!run(ctx, state, 'status', { side: 'self', status: p.status, turns: p.turns, chance: 100 })) return false;
      ctx.setPlayerState('entryStatusProtection', { status: p.status, deduct: p.deduct, ownerId: battleElfId(self(ctx)) });
      return true;
    },
    weight_control_cleanse: (ctx: Context, _p: any, state: RunState) => {
      const name = state.event?.data?.status ?? (ctx as any).effectEventData?.status;
      if (!StatusRegistry[name]?.categories.includes('CONTROL')) return false;
      if (weightOf(ctx, ctx.targetSide, opp(ctx)) > weightOf(ctx, ctx.actor, self(ctx))) return false;
      return run(ctx, state, 'cure_status', { side: 'self' });
    },
  };
}

