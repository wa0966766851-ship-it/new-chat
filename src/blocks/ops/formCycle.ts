
import type { BattleEventContext, DamageComputation } from '../../effects/types';
import type { RunState } from '../runtime';
import type { Mark } from '../../battle/marks';

import { applyKitPpOperation } from '../../effects/ppOperations';

type Display = Pick<Mark, 'id' | 'name' | 'description' | 'displayChar'>;
type Cycle = {
  key: string;
  blade: Display;
  upgraded: Display;
  forms: [Display, Display, Display];
  upgradeRounds: number;
  criticalBonus: number;
  statusTurns: number;
};
type CycleState = {
  main: number;
  lost: number[];
  fatalRound?: number;
  lastFormLossRound?: number;
  upgradeThrough?: number;
  damageRound?: number;
  damage?: number;
  killDamage?: number;
};

export const FORM_CYCLE_FIELDS = {
  form_cycle: ['cycle', 'step', 'form', 'ratio'],
  selected_opponent_pp_reduce: ['amount'],
  next_entry_invalid: ['kind'],
};

const cycleTriggers: Record<string, string[]> = {
  init: ['entrance', 'battle_start'], prepare: ['before_skill'], critical: ['outgoing_attack'],
  record: ['opp_damage_settled'], upgrade: ['kill'], use: ['self_after_use'],
  fatal: ['fatal'], end: ['round_end', 'team_round_end'], switch: ['use'], intercept: ['opponent_switch_out'],
};
export function formCycleIssue(op: string, p: any, trigger: string): string | null {
  if (op === 'next_entry_invalid') return trigger === 'kill' && ['攻擊', '屬性'].includes(p.kind) ? null : '登場技能無效需要擊敗事件及技能類型';
  if (op === 'selected_opponent_pp_reduce') return ['use', 'after_hit'].includes(trigger) && Number.isSafeInteger(p.amount) && p.amount > 0 ? null : '扣除對手所用技能PP需使用時點與正整數';
  const c = p.cycle as Cycle | undefined;
  if (!cycleTriggers[p.step]?.includes(trigger) || !c || typeof c.key !== 'string' || !c.key || c.key.length > 100 ||
      !Array.isArray(c.forms) || c.forms.length !== 3 ||
      ![c.blade, c.upgraded, ...c.forms].every(m => m && ['id', 'name', 'description', 'displayChar'].every(k => typeof m[k as keyof Display] === 'string' && m[k as keyof Display])) ||
      new Set([c.blade, c.upgraded, ...c.forms].map(m => m.id)).size !== 5 ||
      !Number.isSafeInteger(c.upgradeRounds) || c.upgradeRounds < 1 || !Number.isFinite(c.criticalBonus) || c.criticalBonus < 0 ||
      !Number.isSafeInteger(c.statusTurns) || c.statusTurns < 1) return '多形態與武器循環需要完整的印記、期限、增傷與事件設定';
  if (p.step === 'switch' && ![0, 1, 2].includes(p.form)) return '切換形態需要有效索引';
  if (p.step === 'use' && (!Number.isFinite(p.ratio) || p.ratio < 0 || p.ratio > 1)) return '技能真實傷害需要體力比例';
  return null;
}

const identity = (e: { battleId?: string; id: string }) => String(e.battleId || e.id);

export function formCycleOperations(h: {
  survive: (ctx: BattleEventContext) => void;
  ops: () => Record<string, (ctx: BattleEventContext, p: any, st: RunState) => boolean | void>;
}) {
  return {
    selected_opponent_pp_reduce(ctx: BattleEventContext, p: { amount: number }) {
      const used = ctx.getOpponentState('lastUsedSkillSlotThisRound');
      if (used?.round !== ctx.roundNumber || String(used?.battleId) !== identity(ctx.target)) return false;
      const selected = ctx.target.skills[used.slot];
      return !!selected && applyKitPpOperation(ctx, ctx.targetSide, 'reduce', p.amount, sk => sk === selected);
    },
    next_entry_invalid(ctx: BattleEventContext, p: { kind: '攻擊' | '屬性' }) {
      ctx.setOpponentState('nextElfInvalidCategory', p.kind);
      return true;
    },
    form_cycle(ctx: BattleEventContext, p: { cycle: Cycle; step: string; form?: number; ratio?: number }, st: RunState) {
      const { cycle, step } = p;
      const owner = identity(ctx.self);
      const key = cycle.key + ':' + owner;
      const existing = ctx.getPlayerState(key) as CycleState | undefined;
      const state: CycleState = { main: 0, lost: [], ...existing };
      const round = ctx.roundNumber ?? 0;
      const upgraded = (state.upgradeThrough ?? -1) >= round;
      const save = () => ctx.setPlayerState(key, state);
      const show = (rounds = upgraded ? state.upgradeThrough! - round + 1 : 0) => {
        const marks = ctx.getAllMarks?.(ctx.actor) ?? ctx.getMarks(ctx.actor);
        const update = (display: Display, active: boolean, main = false, remaining?: number) => {
          const old = marks.find(mark => mark.id === display.id && mark.ownerBattleId === owner);
          if (!active) {
            if (old) ctx.clearMark(display.id, ctx.actor, owner);
            return;
          }
          const count = remaining ?? 1;
          const description = main ? '【主要形態】\n' + display.description : display.description;
          if (old?.count === count && old.description === description) return;
          ctx.setMark({ ...display, description, count, unit: remaining ? '回合' : '層', scope: 'elf', clearable: false,
            ownerBattleId: owner, persistsOffField: true }, ctx.actor);
        };
        update(cycle.blade, rounds <= 0);
        update(cycle.upgraded, rounds > 0, false, rounds);
        cycle.forms.forEach((display, form) => update(display, !state.lost.includes(form), form === state.main));
      };

      switch (step) {
        case 'init':
          if (!existing) save();
          show();
          return true;
        case 'prepare':
          if (!ctx.skill || ctx.skill.category === '屬性') return false;
          ctx.setPlayerState('nextTurnCrit', true);
          if (!state.lost.includes(1)) ctx.setPlayerState('minimumTypeMultiplierThisAction', upgraded ? 2 : 1);
          return true;
        case 'critical': {
          const damage = st.event?.data?.damageComp || (ctx as BattleEventContext & { damageComp?: DamageComputation }).damageComp;
          if (!damage?.isCrit || state.lost.includes(0)) return false;
          damage.increasePercent += cycle.criticalBonus * (upgraded ? 2 : 1);
          return true;
        }
        case 'record': {
          const data = st.event?.data?.effectEventData ?? st.event?.data;
          if (data?.sourceSide !== ctx.actor || String(data.sourceBattleId) !== owner || (data.damageType !== 'skill_attack' || data.typedSkill === true)) return false;
          state.damage = (state.damageRound === round ? state.damage ?? 0 : 0) + Math.max(0, data.receipt?.settledAmount ?? data.amount ?? 0);
          state.damageRound = round;
          // 擊敗事件若早於此筆結算通知，最後仍會補齊擊敗回合的總值。
          if (state.upgradeThrough === round + cycle.upgradeRounds) state.killDamage = state.damage;
          save();
          return true;
        }
        case 'upgrade':
          state.upgradeThrough = round + cycle.upgradeRounds;
          state.killDamage = state.damageRound === round ? state.damage : 0;
          save();
          show(cycle.upgradeRounds);
          return true;
        case 'use': {
          const damage = h.ops().dmg;
          const flat = Math.floor(ctx.target.maxHp * (p.ratio ?? 0));
          if (flat > 0) damage(ctx, { type: '真實', flat }, st);
          if (upgraded && (state.killDamage ?? 0) > 0) damage(ctx, { type: '真實', flat: state.killDamage }, st);
          return true;
        }
        case 'fatal':
          if (state.lost.length >= cycle.forms.length) return false;
          if (state.fatalRound !== round) {
            state.fatalRound = round;
            save();
            ctx.addLog('【' + cycle.forms[state.main].name + '】本回合受到致命傷害時保留1點體力。', 'effect');
          }
          h.survive(ctx);
          st.survived = true;
          return true;
        case 'end': {
          if (state.fatalRound === round && state.lastFormLossRound !== round) {
            if (!state.lost.includes(state.main)) state.lost = [...state.lost, state.main];
            for (let offset = 1; offset <= cycle.forms.length; offset++) {
              const next = (state.main + offset) % cycle.forms.length;
              if (!state.lost.includes(next)) { state.main = next; break; }
            }
            // 同回合收尾可能再次觸發致命傷害，形態只結算一次。
            state.lastFormLossRound = round;
            save();
          }
          if (existing) show(Math.max(0, (state.upgradeThrough ?? -1) - round));
          return !!existing;
        }
        case 'switch': {
          const desired = p.form!;
          state.main = state.main === desired ? 0 : desired;
          state.lost = state.lost.filter(form => form !== state.main);
          save();
          show();
          return true;
        }
        case 'intercept': {
          const event = st.event?.data?.effectEventData ?? st.event?.data;
          if (event?.forced !== false || state.lost.includes(2)) return false;
          ctx.applyStatusWithImmunityCheck(ctx.targetSide, '束縛', cycle.statusTurns);
          if (upgraded) ctx.applyStatusWithImmunityCheck(ctx.targetSide, '害怕', cycle.statusTurns);
          return true;
        }
        default: return false;
      }
    },
  };
}

