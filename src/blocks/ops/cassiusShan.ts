// 5041 岳峙淵渟.卡修斯 專用 op（DSH 2026-10-31）。
// 只收本精靈需要、且既有積木無法表達的效果；能複用既有 op 的一律複用。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const live = (ctx: BattleEventContext, side: S) => side === ctx.actor ? ctx.self : ctx.target;

export const CASSIUS_SHAN_ACTION_FIELDS: Record<string, readonly string[]> = {
  clear_both_shields: ['drainRatio', 'threshold', 'maxHpBonus'],
  drain_shield_ratio: ['ratio'],
  drain_then_shield: ['ratio'],
  escalating_drain: ['base', 'step', 'max'],
  no_weak_damage: [],
  power_multiplier: ['v'],
  damage_to_heal_next: [],
  dmg_taken_boost: ['side', 'ratio', 'turns'],
  timed_drain_after_use: ['turns', 'amount', 'ratioOfTargetMax', 'doubleBelowHalf', 'failTrueDamage', 'failBarrier', 'noHealTurns'],
  timed_react_on_attack: ['turns', 'status', 'chance', 'thenInvalidUtilityTurns'],
  timed_shield_break_reaction: ['trueDamage', 'statuses', 'turns'],
  timed_status_transfer_down: ['turns'],
  shield_break_no_switch: ['turns'],
  status_if_absent_else_heal: ['status', 'turns', 'healRatio'],
  team_next_entry_status_immune: ['count'],
  excess_non_true_intercept: [],
  shield_break_mountain_god_death: [],
  // 炫彩山神（額外精靈）用
  shield_owner_ratio: ['ratio'],
  status_owner: ['status', 'turns'],
  self_destroy: [],
  clear_turn: ['side'],
};

export function cassiusShanActionIssue(op: string, p: any): string | null {
  if (op === 'clear_both_shields') {
    if (!(p.drainRatio >= 0 && p.drainRatio <= 2)) return '清除護盾需0至200%吸取比例';
    if (!Number.isFinite(p.threshold) || p.threshold < 0) return '清除護盾需非負門檻';
    if (!Number.isFinite(p.maxHpBonus) || p.maxHpBonus < 0) return '清除護盾需非負體力上限加成';
    return null;
  }
  if (op === 'drain_shield_ratio' || op === 'drain_then_shield') {
    if (!(p.ratio > 0 && p.ratio <= 2)) return '吸取護盾需0至200%比例';
    return null;
  }
  if (op === 'escalating_drain') {
    if (!(p.base > 0 && p.base <= 1)) return '遞增吸取需0至100%基礎比例';
    if (!(p.step >= 0 && p.step <= 1)) return '遞增吸取需0至100%每步增幅';
    if (!(p.max > 0 && p.max <= 1)) return '遞增吸取需0至100%上限';
    return null;
  }
  if (op === 'power_multiplier') {
    if (!(p.v > 0 && p.v <= 10)) return '威力倍率需大於0且不超過10';
    return null;
  }
  if (op === 'dmg_taken_boost') {
    if (!['self', 'opp'].includes(p.side)) return '受傷增幅需指定對象';
    if (!(p.ratio > 0 && p.ratio <= 10)) return '受傷增幅需正比例';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '受傷增幅需正整數回合';
    return null;
  }
  if (op === 'timed_drain_after_use') {
    if (!Number.isInteger(p.turns) || p.turns < 1) return '持續吸取需正整數回合';
    if (p.amount !== undefined && (!Number.isFinite(p.amount) || p.amount < 0)) return '持續吸取需非負固定量';
    if (p.ratioOfTargetMax !== undefined && !(p.ratioOfTargetMax > 0 && p.ratioOfTargetMax <= 1)) return '持續吸取需0至100%比例';
    return null;
  }
  if (op === 'timed_react_on_attack') {
    if (!Number.isInteger(p.turns) || p.turns < 1) return '攻擊反應需正整數回合';
    if (p.status !== undefined && typeof p.status !== 'string') return '攻擊反應需狀態名稱';
    if (p.thenInvalidUtilityTurns !== undefined && (!Number.isInteger(p.thenInvalidUtilityTurns) || p.thenInvalidUtilityTurns < 1)) return '攻擊反應需正整數失效回合';
    return null;
  }
  if (op === 'timed_shield_break_reaction') {
    if (!Number.isFinite(p.trueDamage) || p.trueDamage < 0) return '護盾破裂需非負真傷';
    if (!Array.isArray(p.statuses) || !p.statuses.length) return '護盾破裂需狀態清單';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '護盾破裂需正整數回合';
    return null;
  }
  if (op === 'timed_status_transfer_down') {
    if (!Number.isInteger(p.turns) || p.turns < 1) return '轉移下降需正整數回合';
    return null;
  }
  if (op === 'shield_break_no_switch') {
    if (!Number.isInteger(p.turns) || p.turns < 1) return '護盾破裂禁切需正整數回合';
    return null;
  }
  if (op === 'status_if_absent_else_heal') {
    if (typeof p.status !== 'string' || !p.status) return '需狀態名稱';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '需正整數回合';
    if (!(p.healRatio > 0 && p.healRatio <= 1)) return '需0至100%恢復比例';
    return null;
  }
  if (op === 'excess_non_true_intercept') return null;
  if (op === 'shield_break_mountain_god_death') return null;
  if (op === 'shield_owner_ratio') {
    if (!(p.ratio > 0 && p.ratio <= 2)) return '護盾需0至200%比例';
    return null;
  }
  if (op === 'status_owner') {
    if (typeof p.status !== 'string' || !p.status) return '需狀態名稱';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '需正整數回合';
    return null;
  }
  if (op === 'clear_turn') {
    if (p.side !== undefined && !['self','opp'].includes(p.side)) return '需指定對象';
    return null;
  }
  if (op === 'team_next_entry_status_immune') {
    if (!Number.isInteger(p.count) || p.count < 1) return '需正整數次數';
    return null;
  }
  return null;
}

export function cassiusShanOperations(helpers: {
  liveElf: (ctx: BattleEventContext, side: S) => any;
  addBlockTimer: (...args: any[]) => any;
  runAct: (ctx: BattleEventContext, act: any, st: RunState) => any;
}) {
  return {
    /** 消除雙方護盾護罩，吸取對手消除量等量體力；超過門檻則提升體力上限。 */
    clear_both_shields: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self || !opp) return false;
      const oppTotal = Math.max(0, Number(opp.shield) || 0) + Math.max(0, Number(opp.barrier) || 0);
      const selfTotal = Math.max(0, Number(self.shield) || 0) + Math.max(0, Number(self.barrier) || 0);
      if (oppTotal + selfTotal <= 0) return false;
      ctx.updateAnyElf(ctx.targetSide, idOf(opp), { shield: 0, barrier: 0 } as any);
      ctx.updateAnyElf(ctx.actor, idOf(self), { shield: 0, barrier: 0 } as any);
      const drained = Math.floor(oppTotal * p.drainRatio);
      if (drained > 0) ctx.applyHeal(ctx.actor, drained);
      if (oppTotal > p.threshold && p.maxHpBonus > 0) {
        ctx.updateAnyElf(ctx.actor, idOf(self), {
          maxHp: self.maxHp + p.maxHpBonus,
          currentHp: self.currentHp + p.maxHpBonus,
        } as any);
        ctx.addLog?.(`⛰️ 【萬壑崩摧】：消除量 ${oppTotal} 超過 ${p.threshold}，體力上限 +${p.maxHpBonus}！`, 'effect');
      }
      return true;
    },

    /** 吸取雙方護盾值 N% 的體力。 */
    drain_shield_ratio: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self || !opp) return false;
      const total = (Number(self.shield) || 0) + (Number(self.barrier) || 0)
        + (Number(opp.shield) || 0) + (Number(opp.barrier) || 0);
      const amount = Math.floor(total * p.ratio);
      if (amount <= 0) return false;
      ctx.applyHeal(ctx.actor, amount);
      return true;
    },

    /** 吸取對手最大體力 N% 並為自身附加等量護盾。 */
    drain_then_shield: (ctx: BattleEventContext, p: any): boolean => {
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!opp) return false;
      const amount = Math.floor((Number(opp.maxHp) || 0) * p.ratio);
      if (amount <= 0) return false;
      ctx.applyHeal(ctx.actor, amount);
      ctx.applyShield(ctx.actor, amount);
      return true;
    },

    /** 遞增吸取：每次使用提升，最高上限。 */
    escalating_drain: (ctx: BattleEventContext, p: any): boolean => {
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!opp) return false;
      const key = 'cassiusEscalatingDrainUses';
      const uses = Number(ctx.getPlayerState(key)) || 0;
      ctx.setPlayerState(key, uses + 1);
      const ratio = Math.min(p.max, p.base + p.step * uses);
      const amount = Math.floor((Number(opp.maxHp) || 0) * ratio);
      if (amount <= 0) return false;
      ctx.applyHeal(ctx.actor, amount);
      ctx.addLog?.(`⛰️ 【歸塵】：吸取對手最大體力 ${Math.round(ratio * 100)}%（第 ${uses + 1} 次使用）`, 'effect');
      return true;
    },

    /** 本次攻擊不會出現微弱（克制 <1 時視為 1）。 */
    no_weak_damage: (ctx: BattleEventContext): boolean => {
      ctx.setPlayerState('noResistedThisAction', true);
      return true;
    },

    /** 本次技能威力倍率。 */
    power_multiplier: (ctx: BattleEventContext, p: any): boolean => {
      const cur = Number(ctx.getPlayerState('powerMultiplierThisAction')) || 1;
      ctx.setPlayerState('powerMultiplierThisAction', cur * p.v);
      return true;
    },

    /** 下次受到攻擊傷害轉化為自身體力。 */
    damage_to_heal_next: (ctx: BattleEventContext): boolean => {
      ctx.setPlayerState('damageToHealNext', true);
      return true;
    },

    /** 令對手受到技能傷害提升 N%，持續 M 回合。 */
    dmg_taken_boost: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      helpers.addBlockTimer(ctx, side, `受到技能傷害提升${Math.round((p.ratio - 1) * 100)}%`, p.turns, 'turns',
        { trig: 'incoming', body: [{ acts: [{ op: 'dmg_mod', p: { dir: 'in_boost', kind: '技能', boost: p.ratio - 1 } }] }] },
        false, 'round_counter', true, 'elf', 'cassiusDmgTaken:' + idOf(helpers.liveElf(ctx, side)));
      return true;
    },

    /** N 回合內每次使用技能後吸取。 */
    timed_drain_after_use: (ctx: BattleEventContext, p: any): boolean => {
      const body: any[] = [];
      if (p.amount !== undefined) body.push({ acts: [{ op: 'drain', p: { flat: p.amount, side: 'opp', doubleBelowHalf: !!p.doubleBelowHalf } }] });
      if (p.ratioOfTargetMax !== undefined) body.push({ acts: [{ op: 'drain', p: { ratio: p.ratioOfTargetMax, of: 'opp', base: '最大體力', doubleBelowHalf: !!p.doubleBelowHalf } }] });
      if (p.failTrueDamage) body.push({ acts: [{ op: 'dmg_if_no_hp_loss', p: { flat: p.failTrueDamage, type: '真實' } }] });
      if (p.failBarrier) body.push({ acts: [{ op: 'barrier', p: { side: 'opp', flat: p.failBarrier } }] });
      if (p.noHealTurns) body.push({ acts: [{ op: 'no_heal_turns', p: { side: 'opp', turns: p.noHealTurns } }] });
      helpers.addBlockTimer(ctx, ctx.actor, '持續吸取', p.turns, 'turns',
        { trig: 'self_skill', body }, false, 'round_counter', true, 'elf', 'cassiusDrain:' + idOf(ctx.self));
      return true;
    },

    /** N 回合內對手使用攻擊技能時的反應。 */
    timed_react_on_attack: (ctx: BattleEventContext, p: any): boolean => {
      const body: any[] = [];
      if (p.status) body.push({ acts: [{ op: 'status', p: { side: 'opp', status: p.status, turns: 3, chance: p.chance ?? 100 } }] });
      if (p.thenInvalidUtilityTurns) body.push({ acts: [{ op: 'invalid_turns', p: { side: 'opp', kind: '屬性', turns: p.thenInvalidUtilityTurns } }] });
      helpers.addBlockTimer(ctx, ctx.actor, '對手攻擊反應', p.turns, 'turns',
        { trig: 'opp_attack', body }, false, 'round_counter', true, 'elf', 'cassiusReact:' + idOf(ctx.self));
      return true;
    },

    /** 護盾破裂時的反應。 */
    timed_shield_break_reaction: (ctx: BattleEventContext, p: any): boolean => {
      const body: any[] = [
        { acts: [{ op: 'dmg', p: { flat: p.trueDamage, type: '真實' } }] },
        ...(p.statuses || []).map((st: string) => ({ acts: [{ op: 'status', p: { side: 'both', status: st, turns: p.turns, chance: 100 } }] })),
      ];
      helpers.addBlockTimer(ctx, ctx.actor, '護盾破裂反應', 99, 'turns',
        { trig: 'shield_break', body }, false, 'round_counter', true, 'elf', 'cassiusShieldBreak:' + idOf(ctx.self));
      return true;
    },

    /** N 回合內每回合結束時解除自身能力下降並附加給對手。 */
    timed_status_transfer_down: (ctx: BattleEventContext, p: any): boolean => {
      helpers.addBlockTimer(ctx, ctx.actor, '轉移能力下降', p.turns, 'turns',
        { trig: 'round_end', body: [{ acts: [{ op: 'stat_transfer_down', p: { from: 'self', to: 'opp' } }] }] },
        false, 'round_counter', true, 'elf', 'cassiusTransfer:' + idOf(ctx.self));
      return true;
    },

    /** 下次己方精靈護盾消失時令對手無法主動切換。 */
    shield_break_no_switch: (ctx: BattleEventContext, p: any): boolean => {
      ctx.setPlayerState('cassiusShieldBreakNoSwitchTurns', p.turns);
      return true;
    },

    /** 若無該狀態則附加，否則恢復體力。 */
    status_if_absent_else_heal: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      const statuses = (ctx as any).getStatuses?.(self) || {};
      if (statuses[p.status] > 0) {
        const heal = Math.floor((Number(self.maxHp) || 0) * p.healRatio);
        if (heal > 0) ctx.applyHeal(ctx.actor, heal);
        return true;
      }
      ctx.applyStatusWithImmunityCheck(ctx.actor, p.status, p.turns);
      return true;
    },

    /**
     * 2026-10-31（5041 卡修斯）：超額非真實傷害 > 當前護盾 → 本次免傷。
     * 戰鬥階段結束時消耗當前護盾值 50%，恢復在場精靈等同消耗量 25% 的體力。
     * 實際免傷由 before_damage 階段的 damageComp 處理；此 op 只負責掛「階段結束結算」。
     */
    excess_non_true_intercept: (ctx: BattleEventContext): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      const shieldNow = Math.max(0, Number(self.shield) || 0) + Math.max(0, Number(self.barrier) || 0);
      if (shieldNow <= 0) return false;
      // 本次免傷：標記後由傷害管線攔截（引擎讀 excessInterceptThisAction）
      ctx.setPlayerState('excessInterceptThisAction', true);
      // 階段結束結算：消耗 50% 護盾，恢復 25% 消耗量
      const consume = Math.floor(shieldNow * 0.5);
      const heal = Math.floor(consume * 0.25);
      if (consume > 0) {
        const nextShield = Math.max(0, (Number(self.shield) || 0) - consume);
        ctx.updateAnyElf(ctx.actor, idOf(self), { shield: nextShield } as any);
        if (heal > 0) ctx.applyHeal(ctx.actor, heal);
        ctx.addLog?.('⛰️ 【卡修斯】：超額非真實傷害被抵消，消耗 ' + consume + ' 護盾恢復 ' + heal + ' 體力', 'effect');
      }
      return true;
    },

    /**
     * 2026-10-31（5041 卡修斯）：自身護盾消失時，炫彩山神死亡並清除在場累計回合數。
     * 死亡效果（清對手回合類/能力提升/PP歸零）寫在炫彩山神 kit，但該 kit 目前無執行端，
     * 因此在這裡一併處理。
     */
    shield_break_mountain_god_death: (ctx: BattleEventContext): boolean => {
      const team = (ctx as any).getFullTeam?.(ctx.actor) || [];
      const shan = team.find((e: any) => String(e?.name || '').includes('炫彩山神') && e?.currentHp > 0 && !e?.isVanished);
      if (!shan) return false;
      // 炫彩山神死亡
      ctx.vanishElf(ctx.actor, shan);
      // 清除自身在場累計回合數
      ctx.setPlayerState('fieldEntryTurn', ctx.roundNumber ?? 0);
      // 死亡效果：清對手回合類、能力提升、PP 歸零
      ctx.clearTurnEffectsOf?.(ctx.targetSide);
      const opp = helpers.liveElf(ctx, ctx.targetSide);
      if (opp) {
        const up = Object.fromEntries(Object.keys(opp.statStages || {}).map(k => [k, -Math.max(0, Number((opp.statStages as any)?.[k]) || 0)]));
        ctx.applyStatChange(ctx.targetSide, up);
        ctx.updateAnyElf(ctx.targetSide, idOf(opp), {
          skills: (opp.skills || []).map((sk: any) => ({ ...sk, pp: 0, currentPp: 0 })),
        } as any);
      }
      ctx.addLog?.('⛰️ 【炫彩山神】：護盾消失，山神退場並清除對手回合類、能力提升與 PP！', 'effect');
      return true;
    },

    /** 為召喚者附加最大體力 N% 的護盾。 */
    shield_owner_ratio: (ctx: BattleEventContext, p: any): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      // 額外精靈的召喚者：同側的卡修斯
      const team = (ctx as any).getFullTeam?.(ctx.actor) || [];
      const owner = team.find((e: any) => String(e?.name || '').includes('卡修斯') && e?.currentHp > 0);
      if (!owner) return false;
      const amount = Math.floor((Number(owner.maxHp) || 0) * p.ratio);
      if (amount <= 0) return false;
      const ownerCtx: any = (ctx as any).contextForElf?.(ctx.actor, owner) || ctx;
      ownerCtx.applyShield?.(ctx.actor, amount);
      return true;
    },

    /** 為召喚者附加狀態（必須用 contextForElf 指定持有者，否則會加到額外精靈自己）。 */
    status_owner: (ctx: BattleEventContext, p: any): boolean => {
      const team = (ctx as any).getFullTeam?.(ctx.actor) || [];
      const owner = team.find((e: any) => String(e?.name || '').includes('卡修斯') && e?.currentHp > 0);
      if (!owner) return false;
      const ownerCtx: any = (ctx as any).contextForElf?.(ctx.actor, owner) || ctx;
      ownerCtx.applyStatusWithImmunityCheck?.(ctx.actor, p.status, p.turns);
      return true;
    },

    /** 自身消逝（額外精靈退場）。 */
    self_destroy: (ctx: BattleEventContext): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor);
      if (!self) return false;
      ctx.vanishElf(ctx.actor, self);
      return true;
    },

    /** 清除對手回合類效果。 */
    clear_turn: (ctx: BattleEventContext, p: any): boolean => {
      const side: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      return !!ctx.clearTurnEffectsOf?.(side);
    },

    /** 己方其他精靈下次登場時免疫下次受到的異常狀態。 */
    team_next_entry_status_immune: (ctx: BattleEventContext, p: any): boolean => {
      const cur = Number(ctx.getPlayerState('teamNextEntryStatusImmuneCount')) || 0;
      ctx.setPlayerState('teamNextEntryStatusImmuneCount', cur + p.count);
      return true;
    },
  };
}
