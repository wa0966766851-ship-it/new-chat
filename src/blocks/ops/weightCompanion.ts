import { ANCIENT_SONG } from '../../data/leonidasSkills';
import { LEONIDAS_AGE_TEXT, LEONIDAS_COMPANION_TEXT } from '../../data/strengthenedElfDescriptions';
import { multiplyDamageReduction } from '../../battle/damageReduction';
import { markAppliesToElf } from '../../battle/marks';
import { isPassSkill } from '../../battle/passAction';
import { createExtraElf } from '../../utils/extraElf';
import { queueHpDrain } from '../../battle/hpDrain';
import { isNonTrueDamageType } from '../../battle/damageSemantics';
import { queueActionDamageModifier } from '../../battle/actionDamageModifiers';
import { getStatuses, removeStatusEffect } from '../../utils/battleHelpers';
import { timed, timersFor, changePp } from '../../effects/newElfOperations';
import { activeConstraints } from '../../battle/timedConstraints';
import { getMaxPp } from '../../utils/battleHelpers';
import { adjustWeight, battleElfId, healAndPercent, transferSlotPp, weightOf } from './weightEffects';
import { EffectTiming, type BattleEventContext } from '../../effects/types';
import type { Elf, Skill } from '../../types';
import type { RunState } from '../runtime';

type Side = 'p1' | 'p2';
type Context = BattleEventContext;
const snapshotKey = 'teamRecordedWeight';
const shieldKey = 'teamRecordedWeightProtection';
const pendingGuardKey = 'recordedWeightFatalGuard';
const guardMarkId = 'recorded_weight_fatal_guard';
const sacrificedKey = 'teamRecordedWeightSacrificed';
const categoryKey = 'previousRecordedSkillCategory';
const selectionKey = 'recordedSkillSelection';

export const WEIGHT_COMPANION_FIELDS: Record<string, readonly string[]> = {
  age_mark_add: ['side'],
  record_weight_extra: ['id', 'name', 'type', 'revive'],
  recorded_weight_status: ['id', 'families', 'ratio', 'ppRatio'],
  recorded_weight_guard: ['id', 'threshold', 'turns'],
  recorded_weight_fatal: ['id'],
  weight_round_choice: ['id', 'name', 'status', 'whenVoluntarySwitch'],
  weight_phase_choice: ['id', 'name', 'status'],
  weight_choice_priority: [],
  weight_choice_use: [],
  weight_choice_after: [],
  weight_choice_drain: ['ratio'],
  weight_carry_passive: ['ratio'],
  weight_carry_event: ['id', 'name', 'type'],
  weight_carry_phase: [],
  weight_enemy_monitor: ['mode', 'turns'],
  weight_stage_guard: ['turns', 'mode'],
  weighted_song_damage: [],
  weight_record_song_category: [],
  next_attack_priority_offset: ['amount'],
  weight_entry_status_tick: [],
};

export function weightCompanionIssue(op: string, p: any, trig: string): string | null {
  if (op === 'record_weight_extra' && (!p.id || !p.name || !p.type)) return '額外精靈需名稱、識別碼與屬性';
  if (p.mode && !['stage', 'heal', 'block_up', 'keep_down'].includes(p.mode)) return '模式未登記';
  if (p.turns !== undefined && (!Number.isInteger(p.turns) || p.turns < 1)) return '需正整數期限';
  if (op === 'recorded_weight_fatal' && trig !== 'fatal') return '保命必須接致死事件';
  return null;
}

function active(ctx: Context, side: Side): Elf {
  return side === 'p1' ? ctx.activeP1 : ctx.activeP2;
}
const alive = (elf?: Elf) => Boolean(elf && elf.currentHp > 0 && !elf.isVanished);
function hasCarry(skill?: Skill) {
  return Boolean(skill?.kit?.some(entry => entry.role === 'carried'));
}

const AGE_MARK_ID = 'field_age_mark';
const AGE_DESCRIPTION = LEONIDAS_AGE_TEXT;

function applyAgeMark(ctx: Context, side: Side, elf: Elf) {
  if (elf.isVanished) return false;
  const ownerId = battleElfId(elf);
  const current = (ctx.getAllMarks?.(side) ?? ctx.getMarks(side)).find(mark => mark.id === AGE_MARK_ID && mark.ownerBattleId === ownerId);
  if ((current?.count || 0) >= 3) return false;
  ctx.setMark({
    id: AGE_MARK_ID, name: '歲月之痕', description: AGE_DESCRIPTION,
    ownerBattleId: ownerId, scope: 'elf', unit: '道', displayChar: '歲',
    count: (current?.count || 0) + 1, maxCount: 3, persistsOffField: true, clearable: false,
    effects: { agePanel: true, hpBeforeAgeMark: current?.effects?.hpBeforeAgeMark ?? elf.currentHp },
  }, side);
  return true;
}

export function observeWeightChange(ctx: Context, changed: { side: Side; elf: Elf; weight: number }) {
  const recorded = ctx.getPlayerState(snapshotKey);
  if (!recorded || recorded.weights[battleElfId(changed.elf)] === undefined) return;
  const extra = ctx.getFullTeam(ctx.actor).find(elf => elf.id === recorded.id && elf.isExtra && alive(elf));
  if (extra) applyAgeMark(ctx, changed.side, changed.elf);
}

export function weightCompanionOperations(deps: {
  runAct: (ctx: Context, act: any, state: RunState) => boolean;
  runClause: typeof import('../runtime').runClause;
}) {
  const self = (ctx: Context) => active(ctx, ctx.actor);
  const enemy = (ctx: Context) => active(ctx, ctx.targetSide);
  const run = (ctx: Context, state: RunState, op: string, p: any = {}) => deps.runAct(ctx, { op, p, label: op }, state);
  const beast = (ctx: Context, id: string) => ctx.getFullTeam(ctx.actor).find(elf => elf.id === id && elf.isExtra && alive(elf));
  const now = (ctx: Context) => ctx.roundNumber ?? 0;
  const restoreAfterRevival = (ctx: Context) => {
    for (const side of ['p1', 'p2'] as const) for (const mark of [...(ctx.getAllMarks?.(side) ?? [])]) {
      if (mark.id !== AGE_MARK_ID) continue;
      const target = ctx.getFullTeam(side).find(elf => battleElfId(elf) === mark.ownerBattleId);
      ctx.clearMark(mark.id, side, mark.ownerBattleId);
      if (target && alive(target)) ctx.updateAnyElf(side, battleElfId(target), {
        currentHp: Math.max(1, Number(mark.effects?.hpBeforeAgeMark) || 1),
      });
    }
  };
  const summon = (ctx: Context, p: any) => {
    if (beast(ctx, p.id)) return false;
    if (p.revive) restoreAfterRevival(ctx);
    const weights: Record<string, number> = {};
    for (const side of ['p1', 'p2'] as const) for (const elf of ctx.getFullTeam(side)) {
      if (!elf.isVanished && elf.id !== p.id) weights[battleElfId(elf)] = weightOf(ctx, side, elf);
    }
    const value = Math.max(1, Math.floor(Object.values(weights).reduce((sum, weight) => sum + weight, 0)));
    const stats = { hp: value, atk: value, def: value, spatk: value, spdef: value, speed: value };
    ctx.setPlayerState(snapshotKey, { id: p.id, weights, total: value });
    const extra = createExtraElf(ctx.self, {
      id: p.id, name: p.name, type: p.type, calculatedStats: stats, baseStats: stats, maxHp: value, currentHp: value,
      skills: [], weight: 0,
      soulMark: { name: p.name, description: LEONIDAS_COMPANION_TEXT, effectType: 'none', effectValue: 0 },
    });
    ctx.addExtraElf(ctx.actor, extra);
    return true;
  };
  const triggerChoiceBonus = (ctx: Context, state: RunState) => {
    const choice = ctx.getPlayerState(selectionKey);
    if (!choice || choice.drain) return;
    ctx.setPlayerState(selectionKey, { ...choice, drain: true });
    run(ctx, state, 'status_random', { count: 3 });
  };
  return {
    age_mark_add: (ctx: Context, p: any, state: RunState) => {
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const targetId = state.event?.data?.targetBattleId ?? (ctx as any).effectEventData?.targetBattleId;
      const elf = targetId ? ctx.getFullTeam(side).find(member => battleElfId(member) === targetId) : active(ctx, side);
      return elf ? applyAgeMark(ctx, side, elf) : false;
    },
    record_weight_extra: summon,
    recorded_weight_status: (ctx: Context, p: any) => {
      const record = ctx.getPlayerState(snapshotKey);
      const ally = self(ctx);
      const restricted = ctx.getPlayerState(sacrificedKey);
      if (!alive(ally) || !record || (!beast(ctx, p.id) && !restricted)) return false;
      if (restricted && !p.families.some((name: string) => ally.name.includes(name))) return false;
      const amount = Math.floor(record.total * p.ratio);
      const allyCtx = ctx.contextForElf?.(ctx.actor, ally) || ctx;
      allyCtx.applyShield(ctx.actor, amount);
      allyCtx.updateElf(ctx.actor, { barrier: (ally.barrier || 0) + amount });
      transferSlotPp(allyCtx, ally, enemy(ctx), p.ppRatio);
      const old = ctx.getPlayerState(shieldKey);
      ctx.setPlayerState(shieldKey, { owner: battleElfId(ally), round: now(ctx),
        total: old?.owner === battleElfId(ally) && old.round === now(ctx) ? old.total + 2 * amount : 2 * amount });
      return true;
    },
    recorded_weight_guard: (ctx: Context, p: any, state: RunState) => {
      const data = state.event?.data ?? (ctx as any).effectEventData;
      if (data?.targetSide !== ctx.actor || !['fixed', 'percent'].includes(data.damageType)) return false;
      const ally = self(ctx), record = ctx.getPlayerState(shieldKey);
      if (!record || record.round !== now(ctx) || record.owner !== battleElfId(ally) || !record.total || !beast(ctx, p.id)) return false;
      const value = Number(data.receipt?.settledAmount ?? data.hpReduced ?? data.amount) || 0;
      const soaked = (Number(data.receipt?.shieldAbsorbed) || 0) + (Number(data.receipt?.barrierAbsorbed) || 0);
      const total = (record.received || 0) + value;
      ctx.setPlayerState(shieldKey, { ...record, received: total, soaked: (record.soaked || 0) + soaked });
      if (!(total >= record.total * p.threshold) || !(soaked || record.soaked || ((ally.shield || 0) + (ally.barrier || 0) < record.total))) return false;
      const allyCtx = ctx.contextForElf?.(ctx.actor, ally) || ctx;
      allyCtx.setPlayerState(pendingGuardKey, { expires: now(ctx) + p.turns, id: p.id });
      allyCtx.setMark({
        id: guardMarkId, name: '重量護盾保命', displayChar: '護', source: ctx.self.name, description: '期限內受到致死傷害時，犧牲額外精靈並保留1點體力',
        count: 1, maxCount: 1, scope: 'elf', ownerBattleId: battleElfId(ally), persistsOffField: false,
        remainingRounds: p.turns, effects: { blkTurns: p.turns, blockProgram: [{
          raw: '期限內受到致死傷害時，保留1點體力', trig: 'fatal', parsed: true,
          body: [{ acts: [{ op: 'recorded_weight_fatal', p: { id: p.id }, label: '重量護盾保命' }] }],
        }] },
      }, ctx.actor);
      return true;
    },
    recorded_weight_fatal: (ctx: Context, p: any, state: RunState) => {
      const guard = ctx.getPlayerState(pendingGuardKey);
      if (!guard || guard.expires <= now(ctx) || guard.id !== p.id || !beast(ctx, p.id)) return false;
      if (!run(ctx, state, 'survive')) return false;
      ctx.setPlayerState(pendingGuardKey, undefined);
      ctx.clearMark(guardMarkId, ctx.actor, battleElfId(ctx.self));
      const companion = beast(ctx, p.id);
      if (companion) ctx.killExtraElf(ctx.actor, companion);
      ctx.setPlayerState(sacrificedKey, true);
      return true;
    },
    weight_round_choice: (ctx: Context, p: any, state: RunState) => {
      const selected = ctx.skill as Skill | undefined;
      const switching = selected?.name === '切換精靈';
      if (p.whenVoluntarySwitch) {
        const event = (ctx as any).effectEventData ?? state.event?.data;
        if (event?.forced !== false) return false;
      } else if (switching) return false;
      const usesSkill = !p.whenVoluntarySwitch && selected && !['未知', '切換精靈', '使用道具'].includes(selected.name) && !isPassSkill(selected) && selected.category;
      const previous = ctx.getPlayerState(categoryKey);
      ctx.setPlayerState(selectionKey, { round: now(ctx), kind: usesSkill || null, previous, status: p.status, drain: false });
      if (usesSkill) ctx.setPlayerState(categoryKey, selected.category);
      return true;
    },
    weight_phase_choice: (ctx: Context, p: any, state: RunState) => {
      const choice = ctx.getPlayerState(selectionKey);
      if (!alive(ctx.self) || choice?.round !== now(ctx) || choice.kind || choice.phaseDone) return false;
      ctx.setPlayerState(selectionKey, { ...choice, phaseDone: true });
      adjustWeight(ctx, ctx.actor, ctx.self, 100);
      if (beast(ctx, p.id) && ctx.queueExtraAction) {
        ctx.queueExtraAction(ctx.actor, { label: p.name, skillId: 'ancient-weight-song', phase: 'battle_phase_end', run: frame => {
          const companion = beast(frame, p.id);
          const extra = companion && frame.contextForElf?.(frame.actor, companion);
          if (!extra) return;
          const fresh: RunState = { last: null, lastAmount: 0, sourceKind: 'skill', event: { trig: 'use' } };
          const skillContext = Object.assign(Object.create(extra), { skill: ANCIENT_SONG });
          for (const entry of ANCIENT_SONG.kit || []) {
            deps.runClause(skillContext, entry.params.clause, fresh);
          }
        } });
      } else adjustWeight(ctx, ctx.targetSide, enemy(ctx), 300);
      triggerChoiceBonus(ctx, state);
      return true;
    },
    weight_choice_priority: (ctx: Context, _p: any, state: RunState) => {
      const selection = ctx.getPlayerState(selectionKey);
      const comp = state.event?.data?.priorityComp ?? (ctx as any).effectEventData?.priorityComp;
      if (!comp || selection?.round !== now(ctx) || !selection.kind || selection.kind !== selection.previous) return false;
      const bonus = (comp.base + comp.bonus) !== 0 ? 2 : 1;
      comp.bonus += bonus;
      ctx.setPlayerState('recordedSelectionDamageMultiplier', bonus === 2 ? 4 : 2.5);
      return true;
    },
    weight_choice_use: (ctx: Context, _p: any, state: RunState) => {
      const selection = ctx.getPlayerState(selectionKey);
      if (selection?.round !== now(ctx) || !selection.kind || selection.used) return false;
      ctx.setPlayerState(selectionKey, { ...selection, used: true });
      if (selection.kind === selection.previous) queueActionDamageModifier(ctx, ctx.getPlayerState('recordedSelectionDamageMultiplier') || 2.5, '技能');
      if (run(ctx, state, 'status', { side: 'opp', status: selection.status, turns: 3, chance: 100 })) {
        ctx.setOpponentState('teamNextVoluntaryWeightPenalty', true);
      }
      triggerChoiceBonus(ctx, state);
      return true;
    },
    weight_choice_after: (ctx: Context, _p: any, state: RunState) => {
      const choice = ctx.getPlayerState(selectionKey);
      if (choice?.round !== now(ctx) || !choice.kind || !choice.previous || choice.kind === choice.previous || choice.healed) return false;
      ctx.setPlayerState(selectionKey, { ...choice, healed: true });
      healAndPercent(ctx, self(ctx), .5);
      triggerChoiceBonus(ctx, state);
      return true;
    },
    weight_choice_drain: (ctx: Context, p: any) => {
      const choice = ctx.getPlayerState(selectionKey);
      if (choice?.round !== now(ctx) || !choice.drain) return false;
      queueHpDrain(ctx, ctx.targetSide, Math.floor(enemy(ctx).maxHp * p.ratio), 'percent');
      return true;
    },
    weighted_song_damage: (ctx: Context) => {
      const damage = Math.floor(weightOf(ctx, ctx.targetSide, enemy(ctx)));
      ctx.applySkillTypeDamage(ctx.targetSide, damage, '亙古之歌', { elem: '遠古', category: 'skill_extra_action', applyTypeMatchup: true });
      const ally = self(ctx);
      (ctx.contextForElf?.(ctx.actor, ally) || ctx).applyShield(ctx.actor, damage);
      return true;
    },
    weight_record_song_category: (ctx: Context) => {
      const summoner = ctx.getFullTeam(ctx.actor).find(elf => battleElfId(elf) === ctx.self.summonerId);
      const holder = summoner && ctx.contextForElf?.(ctx.actor, summoner);
      if (!holder) return false;
      holder.setPlayerState(categoryKey, '屬性');
      const choice = holder.getPlayerState(selectionKey);
      if (choice?.round === now(ctx)) holder.setPlayerState(selectionKey, { ...choice, kind: '屬性' });
      return true;
    },
    weight_carry_passive: (ctx: Context, p: any, state: RunState) => {
      const count = self(ctx).skills.filter(hasCarry).length;
      if (!count) return false;
      if (state.event?.trig === 'phase_end') {
        ctx.applyHeal(ctx.actor, Math.floor(self(ctx).maxHp * p.ratio * count));
        return true;
      }
      const comp = state.event?.data?.damageComp ?? (ctx as any).effectEventData?.damageComp;
      if (!comp?.isIncoming || !isNonTrueDamageType(comp.damageCategory)) return false;
      multiplyDamageReduction(comp, Math.max(0, 1 - p.ratio * count));
      return true;
    },
    weight_carry_event: (ctx: Context, p: any, state: RunState) => {
      const ally = self(ctx), liveBeast = beast(ctx, p.id);
      const companionExists = ctx.getFullTeam(ctx.actor).some(elf => elf.id === p.id && elf.isExtra);
      const naturallyEligible = battleElfId(ally) === battleElfId(ctx.self) || !!liveBeast;
      if (!hasCarry(ctx.skill) || !alive(ctx.self) || !(naturallyEligible || companionExists)) return false;
      const allyCtx = ctx.contextForElf?.(ctx.actor, ally) || ctx;
      if (naturallyEligible) {
        applyAgeMark(allyCtx, ctx.actor, ally);
        const previous = allyCtx.getPlayerState('recordedCarryPpRecovery');
        allyCtx.setPlayerState('recordedCarryPpRecovery', { round: now(ctx), count: (previous?.round === now(ctx) ? previous.count : 0) + 1 });
      }
      if (liveBeast && !getStatuses(ally)['腐朽']) {
        timed(allyCtx, ctx.actor, 'devoutHeartFromCompanion', 3, { weightDevoutHeart: true }, false, 'soulmark', false);
        const timers = timersFor(allyCtx, ctx.actor);
        allyCtx.setPlayerState('concealedTurnEffectIds', timers.filter(timer => timer.kind === 'turn_effect').map(timer => timer.id));
        if (allyCtx.getPlayerState('weightDevoutHealRound') !== now(ctx)) {
          allyCtx.setPlayerState('weightDevoutHealRound', now(ctx));
          allyCtx.applyHeal(ctx.actor, Math.floor(ally.maxHp / 3));
        }
      } else if (!liveBeast && companionExists) {
        let success = false;
        for (let i = 0; i < 3; i++) {
          const change = allyCtx.applyStatChange(ctx.targetSide, { def: -2, spdef: -2 });
          success = Object.values(change.applied || {}).some(value => value < 0) || success;
        }
        run(allyCtx, state, 'weight_stage_guard', { turns: 3, mode: 'keep_down' });
        if (success) summon(ctx, { ...p, revive: true });
      }
      return true;
    },
    weight_carry_phase: (ctx: Context, _p: any, state: RunState) => {
      const active = self(ctx);
      const activeCtx = ctx.contextForElf?.(ctx.actor, active) || ctx;
      const record = activeCtx.getPlayerState('recordedCarryPpRecovery');
      if (!record || record.round !== now(ctx)) return false;
      activeCtx.setPlayerState('recordedCarryPpRecovery', undefined);
      return run(activeCtx, state, 'pp_restore', { v: record.count });
    },
    weight_stage_guard: (ctx: Context, p: any, state: RunState) => {
      const side = ctx.targetSide;
      if (p.mode === 'block_up') run(ctx, state, 'stat_clear', { side: 'opp', kind: 'up' });
      timed(ctx, side, 'weightedStageGuard:' + p.mode, p.turns,
        p.mode === 'block_up' ? { preventPositiveStages: true } : { block: { stageGuard: 'down' }, hideNegativeStages: true }, false, 'skill', false);
      return true;
    },
    weight_enemy_monitor: (ctx: Context, p: any) => {
      timed(ctx, ctx.targetSide, 'weightEnemyMonitor:' + p.mode + ':' + battleElfId(ctx.self), p.turns,
        { monitorWeightEffect: { mode: p.mode, sourceId: battleElfId(ctx.self), sourceSide: ctx.actor } }, false, 'skill', false);
      return true;
    },
    next_attack_priority_offset: (ctx: Context, p: any) => {
      ctx.setPlayerState('nextWeightedAttackPriority', { amount: p.amount, action: ctx.actionId });
      return true;
    },
    weight_entry_status_tick: (ctx: Context) => {
      const window = ctx.getPlayerState('entryStatusProtection');
      const elf = self(ctx);
      if (elf.ageStatusTurnsFrozen || !window || window.ownerId !== battleElfId(elf) || !getStatuses(elf)[window.status]) return false;
      const statuses = getStatuses(elf);
      const modified = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...statuses } };
      for (const name of Object.keys(statuses)) {
        if (statuses[name] <= window.deduct) removeStatusEffect(modified, name);
        else {
          modified.effects = modified.effects.map(effect => effect.id === name ? { ...effect, duration: effect.duration - window.deduct } : effect);
          modified.battleStatuses[name] -= window.deduct;
        }
      }
      ctx.updateElf(ctx.actor, { effects: modified.effects, battleStatuses: modified.battleStatuses, battleStatus: modified.battleStatus, battleStatusDuration: modified.battleStatusDuration });
      return true;
    },
  };
}

