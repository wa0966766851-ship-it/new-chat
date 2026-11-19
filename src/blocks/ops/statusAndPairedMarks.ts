import { EffectTiming, type BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { markAppliesToElf } from '../../battle/marks';
import { multiplyDamageReduction } from '../../battle/damageReduction';

import { statusMatchesProjection } from '../../battle/statusRules';
import { StatusRegistry } from '../../effects/statusRegistry';
import { applyMarkProgram } from '../../effects/markProgram';
import { timed as addConstraint } from '../../effects/newElfOperations';

type Side = 'p1' | 'p2';
type Ctx = BattleEventContext;
export const STATUS_PAIR_FIELDS: Record<string, readonly string[]> = {
  average_current_health: [], attached_effect_lock: ['side', 'kind', 'turns'], attack_damage_lock: ['turns', 'kind'],
  reward_cured_statuses: ['healRatio', 'damageMultiplier'], halve_next_damage: ['ratio'],
  recovery_checked_then: ['ratio', 'noHealBody'], status_count_priority: ['side', 'amount'],
  status_count_snapshot: ['side', 'includeApplications'], status_count_damage: ['ratio'],
  clear_both_protections: ['statuses', 'fallback', 'turns'],
  balance_paired_marks: ['first', 'second', 'uses', 'programs'],
  paired_mark_enemy_entry: ['first', 'second', 'statuses', 'ratio', 'turns'],
  paired_mark_lethal: ['first', 'second', 'statuses', 'turns'],
  paired_mark_finish: ['first', 'second', 'threshold'], paired_mark_pass: ['first', 'second', 'programs'],
  paired_mark_sample: ['highKey', 'lowKey', 'uses'], clear_health_comparison: ['highKey', 'lowKey'],
  paired_mark_followup: ['first', 'second', 'mode', 'uses', 'freeAt', 'status', 'turns'],
  paired_mark_status_convert: ['side', 'category', 'status', 'turns'],
  paired_mark_recovery: ['first', 'second', 'minimum', 'ratio'],
};

export function statusPairIssue(op: string, p: any, trig: string) {
  const count = (n: number) => Number.isSafeInteger(n) && n > 0 && n <= 100;
  const ratio = (n: number) => Number.isFinite(n) && n > 0 && n <= 1;
  const statuses = (values: string[]) => Array.isArray(values) && values.length > 0 && values.every(status => StatusRegistry[status]);
  if (op.startsWith('paired_mark_') && !['paired_mark_status_convert', 'paired_mark_sample'].includes(op) ||
      op === 'balance_paired_marks') {
    if (![p.first, p.second].every(v => typeof v === 'string' && v.length > 0) || p.first === p.second) return '需指定兩種相異的印記';
  }
  if (p.turns !== undefined && !count(p.turns) || p.uses !== undefined && !count(p.uses)) return '回合數與次數需為正整數';
  if (p.ratio !== undefined && !ratio(p.ratio) || p.threshold !== undefined && !ratio(p.threshold)) return '比例需大於零且不超過一';
  if (p.statuses !== undefined && !statuses(p.statuses) || p.fallback !== undefined && !statuses(p.fallback)) return '需指定已註冊的異常';
  if (op === 'status_count_priority' && (trig !== 'modify_priority' || !['self', 'opp', 'both'].includes(p.side) || !count(p.amount))) return '異常數先制需正式先制查詢';
  if (op === 'paired_mark_lethal' && trig !== 'fatal') return '配對印記強制存活需正式致死事件';
  if (op === 'paired_mark_followup' && (!['attack', 'utility'].includes(p.mode) || !count(p.freeAt) || !StatusRegistry[p.status])) return '配對次數效果需有效條件與異常';
  if (op === 'paired_mark_pass' && (!Array.isArray(p.programs) || p.programs.length !== 2)) return '轉贈需兩個印記程式';
  if (op === 'paired_mark_status_convert' && (!['AUXILIARY', 'WEAKENING'].includes(p.category) || !StatusRegistry[p.status])) return '狀態轉化需有效分類與目標';
  return null;
}

const id = (elf: { battleId?: string; id: string }) => String(elf.battleId || elf.id);
const statusCount = (ctx: Ctx, elf: Ctx['self']) => Object.values(ctx.getStatuses(elf)).filter(turns => turns > 0).length;
const skillFollowupKey = (mode: 'attack' | 'utility') => 'pairedSkillFollowup:' + mode;
const attackStatusKey = 'pairedSkillFollowupAttackStatus';

export function runPairedSkillFollowup(ctx: Ctx, event: EffectTiming, data: any) {
  if (event === EffectTiming.ON_SWITCH_OUT) {
    for (const mode of ['attack', 'utility'] as const) {
      const key = skillFollowupKey(mode);
      if (ctx.getPlayerState(key)) ctx.setPlayerState(key, undefined);
    }
    return;
  }
  if (event === EffectTiming.AFTER_ACTION || event === EffectTiming.ACTION_FAILED) {
    const pending = ctx.getPlayerState(attackStatusKey);
    if (pending && pending.actionId === ctx.actionId) {
      ctx.setPlayerState(attackStatusKey, undefined);
      if (ctx.target.currentHp > 0 && id(ctx.target) === pending.targetId) {
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, pending.status, pending.turns);
      }
    }
    return;
  }
  if (event !== EffectTiming.MODIFY_PRIORITY && event !== EffectTiming.BEFORE_SKILL) return;
  const kind = data?.skill?.category || ctx.skill?.category;
  if (!kind) return;
  const key = skillFollowupKey(kind === '屬性' ? 'utility' : 'attack');
  const state = ctx.getPlayerState(key);
  if (!state || state.ownerId !== id(ctx.self) || state.uses < 1) return;
  if (event === EffectTiming.MODIFY_PRIORITY && data?.priorityComp) {
    data.priorityComp.bonus += state.mode === 'utility' ? -2 : 2;
    return;
  }
  if (event !== EffectTiming.BEFORE_SKILL || ctx.actionId === undefined || state.lastActionId === ctx.actionId) return;
  const marks = ctx.getMarks(state.sourceSide).filter(mark => mark.ownerBattleId === state.sourceId);
  const groups = Math.min(...[state.first, state.second].map(key => marks.find(mark => mark.id === key)?.count ?? 0));
  ctx.setPlayerState(key, { ...state, uses: state.uses - Number(groups < state.freeAt), lastActionId: ctx.actionId });
  if (state.mode === 'utility') ctx.setPlayerState('utilityStatusBlockedAction', ctx.actionId);
  else ctx.setPlayerState(attackStatusKey, { actionId: ctx.actionId, targetId: id(ctx.target), status: state.status, turns: state.turns });
}

const applicationKey = 'round_status_applications';
export function recordStatusApplication(ctx: Ctx) {
  const previous = ctx.getPlayerState(applicationKey);
  const round = ctx.roundNumber ?? 0;
  ctx.setPlayerState(applicationKey, { round, count: previous?.round === round ? previous.count + 1 : 1 });
}

export function statusPairOperations(deps: {
  liveElf: (ctx: Ctx, side: Side) => Ctx['self'];
  runAct: (ctx: Ctx, act: any, st: RunState) => boolean;
  runStmts: (ctx: Ctx, body: any[], st: RunState) => unknown;
  addBlockTimer: (...args: any[]) => void;
}) {
  const { liveElf, runStmts, addBlockTimer } = deps;
  const run = (ctx: Ctx, st: RunState, op: string, p: any) => deps.runAct(ctx, { op, p, label: op }, st);
  const opp = (ctx: Ctx) => liveElf(ctx, ctx.targetSide);
  const self = (ctx: Ctx) => liveElf(ctx, ctx.actor);
  const pair = (ctx: Ctx, p: { first: string; second: string }) => {
    const owned = ctx.getMarks(ctx.actor).filter(mark => markAppliesToElf(mark, self(ctx)));
    return [p.first, p.second].map(key => owned.find(mark => mark.id === key));
  };
  const pairCount = (ctx: Ctx, p: { first: string; second: string }) => Math.min(...pair(ctx, p).map(mark => mark?.count ?? 0));
  const write = (ctx: Ctx, mark: ReturnType<typeof pair>[number], count: number) => {
    if (!mark) return;
    if (count > 0) ctx.setMark({ ...mark, count }, ctx.actor);
    else ctx.clearMark(mark.id, ctx.actor, mark.ownerBattleId || null);
  };
  const spend = (ctx: Ctx, p: any) => {
    if (!pairCount(ctx, p)) return false;
    for (const mark of pair(ctx, p)) write(ctx, mark, (mark?.count ?? 0) - 1);
    return true;
  };
  const apply = (ctx: Ctx, status: string, turns: number) => ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, turns).success;
  return {
    average_current_health: (ctx: Ctx) => {
      const ally = self(ctx), enemy = opp(ctx);
      const average = Math.min(ally.maxHp, enemy.maxHp, Math.floor((ally.currentHp + enemy.currentHp) / 2));
      ctx.adjustHp(ctx.actor, average - ally.currentHp);
      ctx.adjustHp(ctx.targetSide, average - enemy.currentHp);
      return true;
    },
    attached_effect_lock: (ctx: Ctx, p: any) => {
      addBlockTimer(ctx, p.side === 'opp' ? ctx.targetSide : ctx.actor, '附加效果失效', p.turns, 'turns', { addInvalid: p.kind }, true, 'turn_effect');
      return true;
    },
    attack_damage_lock: (ctx: Ctx, p: any) => {
      addConstraint(ctx, ctx.targetSide, 'attackDamageAndAttachedLock:' + id(ctx.self), p.turns, {
        preventAttackDamage: true, block: { addInvalid: p.kind ?? '攻擊' },
      }, false, 'skill', false);
      return true;
    },
    reward_cured_statuses: (ctx: Ctx, p: any, st: RunState) => {
      const cured = st.lastAmount;
      if (cured < 1) return false;
      for (let n = 0; n < cured; n++) ctx.applyHeal(ctx.actor, Math.floor(self(ctx).maxHp * p.healRatio));
      addBlockTimer(ctx, ctx.actor, '下次非真實傷害減半', 1, 'uses', { trig: 'incoming_nontrue', consumeOnFire: true,
        body: [{ acts: [{ op: 'halve_next_damage', p: { ratio: p.damageMultiplier ** cured }, label: '非真實傷害減半' }] }] });
      return true;
    },
    halve_next_damage: (_ctx: Ctx, p: any, st: RunState) => {
      const comp = st.event?.data?.damageComp;
      if (!comp?.isIncoming || comp.pure) return false;
      multiplyDamageReduction(comp, p.ratio);
      return true;
    },
    recovery_checked_then: (ctx: Ctx, p: any, st: RunState) => {
      ctx.applyHeal(ctx.actor, Math.floor(self(ctx).maxHp * p.ratio), { onSettled: receipt => {
        if (receipt.blocked) runStmts(ctx, p.noHealBody, st);
      } });
      return true;
    },
    status_count_priority: (ctx: Ctx, p: any, st: RunState) => {
      const comp = st.event?.data?.priorityComp ?? (ctx as any).effectEventData?.priorityComp;
      if (!comp) return false;
      comp.bonus += p.amount * ((p.side === 'opp' ? 0 : statusCount(ctx, self(ctx))) + (p.side === 'self' ? 0 : statusCount(ctx, opp(ctx))));
      return true;
    },
    status_count_snapshot: (ctx: Ctx, p: any, st: RunState) => {
      const state = p.side === 'self' ? ctx.getPlayerState : ctx.getOpponentState;
      const record = state(applicationKey);
      const count = statusCount(ctx, p.side === 'self' ? self(ctx) : opp(ctx)) +
        (p.includeApplications && record?.round === ctx.roundNumber ? record.count : 0);
      st.lastAmount = count;
      ctx.setPlayerState('action_status_count', { actionId: ctx.actionId, targetId: id(opp(ctx)), count });
      return count > 0;
    },
    status_count_damage: (ctx: Ctx, p: any) => {
      const enemy = opp(ctx), snapshot = ctx.getPlayerState('action_status_count');
      if (!snapshot || snapshot.actionId !== ctx.actionId || snapshot.targetId !== id(enemy)) return false;
      ctx.setPlayerState('action_status_count', undefined);
      for (let n = 0; n < snapshot.count; n++) ctx.applyPinkDamage(ctx.targetSide, Math.floor(enemy.maxHp * p.ratio), undefined, undefined, undefined, 'percent');
      return snapshot.count > 0;
    },
    clear_both_protections: (ctx: Ctx, p: any, st: RunState) => {
      if (!(Number(opp(ctx).shield) > 0 && Number(opp(ctx).barrier) > 0)) return false;
      run(ctx, st, 'clear_shield', { side: 'opp', kind: 'both' });
      if (Number(opp(ctx).shield) > 0 || Number(opp(ctx).barrier) > 0) return false;
      const results = p.statuses.map((status: string) => apply(ctx, status, p.turns));
      if (results.includes(false)) for (const status of p.fallback) apply(ctx, status, p.turns);
      return true;
    },
    balance_paired_marks: (ctx: Ctx, p: any, st: RunState) => {
      const marks = pair(ctx, p);
      const average = Math.floor(marks.reduce((sum, mark) => sum + (mark?.count ?? 0), 0) / 2);
      for (const [index, mark] of marks.entries()) {
        if (mark) write(ctx, mark, average);
        else if (average > 0 && p.programs?.[index]) applyMarkProgram(ctx, { ...p.programs[index], mode: 'set', count: average }, self(ctx));
      }
      if (!average) return false;
      run(ctx, st, 'prio_next', { v: average, uses: p.uses });
      run(ctx, st, 'timed_uses', { uses: p.uses, trig: 'self_attack', label: '下次攻擊增加連擊', body: [
        { acts: [{ op: 'combo_add', p: { amount: average }, label: '增加連擊' }] },
      ] });
      return true;
    },
    paired_mark_enemy_entry: (ctx: Ctx, p: any, st: RunState) => {
      const count = pairCount(ctx, p);
      if (!count) return false;
      return run(ctx, st, 'next_enemy_entry', { statuses: p.statuses.slice(0, count), duration: p.turns, drainRatio: p.ratio, drainCount: count });
    },
    paired_mark_lethal: (ctx: Ctx, p: any, st: RunState) => {
      if (!spend(ctx, p)) return false;
      ctx.updateElf(ctx.actor, { currentHp: 1 });
      run(ctx, st, 'clear_turn', { side: 'both' });
      run(ctx, st, 'stat_clear', { side: 'both', kind: 'all' });
      run(ctx, st, 'cure_status', { side: 'both' });
      for (const status of p.statuses) apply(ctx, status, p.turns);
      st.survived = true;
      return true;
    },
    paired_mark_finish: (ctx: Ctx, p: any, st: RunState) => {
      const target = opp(ctx);
      if (!(target.currentHp > 0 && target.currentHp < target.maxHp * p.threshold) || !spend(ctx, p)) return false;
      run(ctx, st, 'maxhp_flat_reduce', { amount: target.maxHp - target.currentHp });
      return run(ctx, st, 'no_pos_prio_turns', { turns: 1, next: true });
    },
    paired_mark_pass: (ctx: Ctx, p: any, st: RunState) => {
      const count = pairCount(ctx, p);
      for (const mark of pair(ctx, p)) write(ctx, mark, count);
      if (!count) return false;
      return run(ctx, st, 'next_ally_entry', { resource: 'none', excludeSource: true, ratio: 1, label: '成對印記', body: [
        { acts: p.programs.map((program: any) => ({ op: 'mark_program', p: program, label: program.name })) },
      ] });
    },
    clear_health_comparison: (ctx: Ctx, p: any) => {
      ctx.setPlayerState(p.highKey, 0);
      ctx.setPlayerState(p.lowKey, 0);
      return true;
    },
    paired_mark_sample: (ctx: Ctx, p: any) => {
      const own = self(ctx), target = opp(ctx);
      if (own.currentHp <= 0 || target.currentHp <= 0) return false;
      if (own.currentHp >= target.currentHp) ctx.setPlayerState(p.highKey, p.uses);
      if (own.currentHp <= target.currentHp) ctx.setPlayerState(p.lowKey, p.uses);
      return true;
    },
    paired_mark_followup: (ctx: Ctx, p: any) => {
      const enemy = p.mode === 'utility';
      const side = enemy ? ctx.targetSide : ctx.actor;
      const set = side === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState;
      set(skillFollowupKey(p.mode), { ...p, ownerId: id(liveElf(ctx, side)), sourceSide: ctx.actor, sourceId: id(self(ctx)) });
      return true;
    },
    paired_mark_status_convert: (ctx: Ctx, p: any, st: RunState) => {
      const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const existing = ctx.getStatuses(liveElf(ctx, side));
      let changed = false;
      for (const [status, turns] of Object.entries(existing)) {
        if (turns > 0 && status !== p.status && statusMatchesProjection(status, p.category)) {
          changed = Boolean(run(ctx, st, 'convert_status', { side: p.side, from: status, status: p.status, turns: p.turns + 1 })) || changed;
        }
      }
      return changed;
    },
    paired_mark_recovery: (ctx: Ctx, p: any) => {
      if (pairCount(ctx, p) < p.minimum && statusCount(ctx, self(ctx)) + statusCount(ctx, opp(ctx)) === 0) return false;
      const targetId = id(opp(ctx));
      ctx.applyHeal(ctx.actor, Math.floor(self(ctx).maxHp * p.ratio), { onSettled: receipt => {
        if (receipt.hpGained > 0 && id(opp(ctx)) === targetId) ctx.applyPinkDamage(ctx.targetSide, receipt.hpGained, undefined, undefined, undefined, 'percent');
      } });
      return true;
    },
  };
}

