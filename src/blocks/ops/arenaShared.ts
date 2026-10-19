// 競技場通用件（legacyWrapped 拆解；DSH 20261017 第十批）。
// fifthPpDiff：自身第五技能目前 PP − 對手第五技能目前 PP（下限 0）——「每多 1 點」句式基準。
// arenaDrainAmount：drain 擴充（每級自身能力下降吸取／PP差翻倍）。
import type { BattleEventContext } from '../../effects/types';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 第五技能 PP 差（自身−對手；無第五技能＝0）。 */
export function fifthPpDiff(ctx: BattleEventContext): number {
  const fifthOf = (elf: any) => {
    const skill = (elf?.skills || []).find((s: any) => s.isFifthSkill);
    return Math.max(0, Number(skill?.currentPp ?? skill?.pp ?? 0) || 0);
  };
  const self = (ctx as any).self ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
  const opp = (ctx as any).target ?? ((ctx as any).targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
  return Math.max(0, fifthOf(self) - fifthOf(opp));
}

/** drain 擴充：每級自身能力下降／PP差翻倍。由 runtime drain 呼叫。 */
export function arenaDrainAmount(ctx: BattleEventContext, p: any, baseAmt: number): number {
  let amt = baseAmt;
  if (p.perStageDown) {
    const self = (ctx as any).self ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
    const stages: Record<string, number> = self?.statStages || {};
    const dropLevels = Object.values(stages).reduce((n: number, v: any) => n + Math.max(0, -Number(v || 0)), 0);
    amt = Math.floor((p.perStageDown.amount ?? 0) * dropLevels);
    if (p.perStageDown.doubleOnOppBoost) {
      const opp = (ctx as any).target ?? ((ctx as any).targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
      const ostages: Record<string, number> = opp?.statStages || {};
      if (Object.values(ostages).some(v => Number(v || 0) > 0)) amt *= 2;
    }
  }
  if (p.ppDiffDouble && fifthPpDiff(ctx) > 3) amt *= 2;
  return amt;
}

// ───────── 隨機分支（DSH 20261018 第十二批：arena_15 命運龍輪「隨機觸發以下 N 項中的 1 項」） ─────────
import type { BattleEventContext as Ctx2 } from '../../effects/types';
import type { RunState as St2 } from '../runtime';

// ───────── HP 階梯計數（DSH 20261018 第十三批：5030 八荒/天佑/聖怒/淨世洗禮頌的「每有最大體力10%」句式） ─────────
// hp_steps{side, of, base, cap}：計算 base＋floor(指定HP/maxHp×10)（每滿10%為一階，滿血=10階），
//   寫入 st.lastAmount 供後續 op（resource_mark_add{ratio}／pending_counter 等以 lastAmount 為量）讀取。
//   of='current'＝當前體力（八荒）；of='lost'＝已損失體力（天佑）；不支援負值。
// 無為龍者（arena_12）通用件（DSH 20261018 第十六批）：PP 上限／互換／不耗 PP、屬性整體重設、必中強制、屬性下降免疫。
export const ARENA12_ACTION_FIELDS: Record<string, readonly string[]> = {
  // 互換該技能的目前 PP 與已損失 PP（「不扣除固定 PP，改為互換目前 PP 與已損失 PP」）。
  pp_swap_selected: [],
  // 所有能力值變為全部能力值之和的一半（戰鬥開始的整體重設）。
  stat_set_sum_half: [],
  // 必定命中並強制執行命中效果（0 PP 使用時）。
  sure_hit_force: [],
  // 本回合所選技能 PP 歸零時無法行動（標記行動受阻）。
  action_prevent_on_empty: ['kind'],
  // 免疫能力下降（回合類）。
  stat_drop_immune_turns: ['turns'],
  // 清除指定回合鍵（無為效果消耗後清旗標）。
  turn_key_clear: ['key', 'side'],
};

// arena_12 條件（DSH 20261018 第十六批）：「先出手／未行動／對手本回合切換／自身與技能同屬性」。
export const ARENA12_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 本回合先出手（比較雙方行動序；引擎寫入 blkFirstMoverThisRound）
  first_move: ['neg'],
  // 本回合未使用技能（引擎未進出手流程／行動受阻；讀 actionPreventedRound 或未行動旗標）
  unacted: ['neg'],
  // 對手本回合切換過精靈（引擎寫入 blkSwitchedThisRound）
  opp_switched: ['neg'],
  // 自身屬性與所用技能屬性相同
  same_type: ['side','neg'],
};

export function arena12ConditionIssue(op: string, p: any): string | null {
  if (!(op in ARENA12_CONDITION_FIELDS)) return null;
  if (op === 'same_type' && p?.side !== undefined && !['self', 'opp'].includes(p.side)) return '同屬性判定需明確持有者';
  return null;
}

export function arena12Conditions(helpers: { liveElf: (ctx: any, side: 'p1' | 'p2') => any }) {
  return {
    first_move: (ctx: any,p:any): boolean => {const side=ctx.getPlayerState?.('blkFirstMoverThisRound');return (side==='p1'||side==='p2')&&((side===ctx.actor)!==!!p.neg);},
    unacted: (ctx: any): boolean => ctx.getPlayerState?.('actionPreventedRound') === (ctx.roundNumber ?? 0)
      || ctx.getPlayerState?.('blkActedThisRound') !== ctx.actor,
    opp_switched: (ctx: any): boolean => ctx.getPlayerState?.('blkSwitchedThisRound') === ctx.targetSide,
    same_type: (ctx: any, p: any): boolean => {
      const side = p?.side === 'opp' ? ctx.targetSide : ctx.actor;
      const elf = helpers.liveElf(ctx, side);
      const skill = side === ctx.actor ? ctx.skill : (ctx as any).opponentSkill;
      if (!elf || !skill) return false;
      const et = String(elf.type || ''), st = String(skill.type || '');
      if (!et || !st) return false;
      // 複合屬性（如「光·次元」）以任一分項相同即算同屬性
      const parts = et.split(/[·.、／/]/).map(x => x.trim()).filter(Boolean);
      return parts.some(x => st.includes(x)) || et === st;
    },
  };
}

export function arena12ActionIssue(op: string, p: any): string | null {
  if (!(op in ARENA12_ACTION_FIELDS)) return null;
  if (op === 'stat_drop_immune_turns' && (!Number.isInteger(p?.turns) || p.turns < 1 || p.turns > 99)) return '能力下降免疫需1至99回合';
  if (op === 'turn_key_clear' && (typeof p?.key !== 'string' || !p.key)) return '回合鍵清除需明確鍵名';
  if (op === 'action_prevent_on_empty' && p.kind !== undefined && !['攻擊', '屬性'].includes(p.kind)) return '行動受阻需明確技能類型';
  return null;
}

export const HP_STEPS_ACTION_FIELDS: Record<string, readonly string[]> = {
  hp_steps: ['side', 'basis', 'base', 'cap', 'scope'],
};

export function hpStepsIssue(op: string, p: any): string | null {
  if (op !== 'hp_steps') return null;
  if (!['self', 'opp'].includes(p.side)) return 'HP階梯需明確持有者';
  if (!['current', 'lost'].includes(p.basis)) return 'HP階梯需明確當前或已損失體力';
  if (p.scope !== undefined && !['elf', 'teamMax'].includes(p.scope)) return 'HP階梯作用域需為個體或隊伍最高';
  if (!Number.isInteger(p.base ?? 0) || (p.base ?? 0) < 0 || (p.base ?? 0) > 100) return 'HP階梯基數需0至100整數';
  if (p.cap !== undefined && (!Number.isInteger(p.cap) || p.cap < 1 || p.cap > 100)) return 'HP階梯上限需1至100整數';
  return null;
}

export function hpStepsCompute(ctx: any, p: any, liveElf: (ctx: any, side: any) => any, st: any): boolean {
  const side = p.side === 'self' ? ctx.actor : ctx.targetSide;
  let e = liveElf(ctx, side);
  if (p.scope === 'teamMax') {
    // 該側隊伍中體力比例最高者（聖怒「對方所有精靈中體力比例最高的精靈」）。
    const team: any[] = (ctx as any).getFullTeam?.(side) || [];
    const alive = team.filter((x: any) => Number(x?.currentHp) > 0 && Number(x?.maxHp) > 0);
    if (alive.length) e = alive.reduce((best: any, x: any) => (x.currentHp / x.maxHp > best.currentHp / best.maxHp ? x : best), alive[0]);
  }
  if (!e) return false;
  const max = Math.max(0, Number(e.maxHp) || 0);
  if (max <= 0) return false;
  const cur = Math.max(0, Number(e.currentHp) || 0);
  const basis = p.basis === 'lost' ? max - cur : cur;
  const steps = Math.min(10, Math.floor(basis / max * 10 + 1e-9));
  const value = Math.min(p.cap ?? 100, (p.base ?? 0) + steps);
  st.lastAmount = value;
  return true;
}

export const ARENA_SHARED_ACTION_FIELDS: Record<string, readonly string[]> = {
  // branches：語句陣列的陣列——擲一次骰，等機率執行其中一個分支的主體。
  random_branch: ['branches'],
};

export function arenaSharedActionIssue(op: string, p: any, nested: (body: any[], trig: string) => string | null): string | null {
  if (op === 'random_branch') {
    if (!Array.isArray(p.branches) || p.branches.length < 2 || p.branches.length > 10) return '隨機分支需2至10個分支主體';
    for (const b of p.branches) {
      if (!Array.isArray(b)) return '隨機分支主體需為語句陣列';
      const issue = nested(b, 'use');
      if (issue) return '隨機分支：' + issue;
    }
    return null;
  }
  return null;
}

/** 執行端（runtime 注入 runStmts；單次擲骰等機率選一支——「隨機觸發 N 項中的 1 項」）。 */
export function arenaSharedOperations(helpers: {
  runStmts: (ctx: Ctx2, body: any[], st: St2) => void;
  liveElf: (ctx: Ctx2, side: 'p1' | 'p2') => any;
}) {
  return {
    hp_steps: (ctx: Ctx2, p: any, st: St2): boolean => hpStepsCompute(ctx, p, helpers.liveElf, st),
    // 互換所選技能的「目前 PP」與「已損失 PP」（已損失＝maxPp−pp）。
    pp_swap_selected: (ctx: Ctx2): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      const skill = (ctx as any).skill;
      if (!elf || !skill) return false;
      const idx = (elf.skills || []).findIndex((x: any) => x.name === skill.name);
      if (idx < 0) return false;
      const cur = Number(elf.skills[idx].currentPp ?? elf.skills[idx].pp) || 0;
      const max = Number(elf.skills[idx].maxPp ?? elf.skills[idx].pp) || 0;
      const lost = Math.max(0, max - cur);
      const next = (elf.skills || []).map((x: any, i: number) => i === idx ? { ...x, pp: lost, currentPp: lost } : x);
      (ctx as any).updateElf?.(ctx.actor, { skills: next });
      ctx.addLog?.('🔄 PP 互換：目前 ' + cur + ' ↔ 已損失 ' + lost, 'effect');
      return true;
    },
    // 所有能力值變為全部能力值之和的一半（六維重設）。
    stat_set_sum_half: (ctx: Ctx2): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf) return false;
      const stats = elf.calculatedStats || elf.baseStats || {};
      const keys = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
      const sum = keys.reduce((a, k) => a + (Number((stats as any)[k]) || 0), 0);
      const half = Math.floor(sum / 2);
      (ctx as any).updateElf?.(ctx.actor, { calculatedStats: { ...stats, ...Object.fromEntries(keys.map(k => [k, half])) } });
      ctx.addLog?.('⚖️ 能力重設：六維全部變為總和的一半（' + half + '）', 'effect');
      return true;
    },
    // 必定命中並強制執行命中效果（0 PP 使用技能時）。
    sure_hit_force: (ctx: Ctx2, p: any, st: St2): boolean => {
      const comp = (st.event?.data?.hitComp || st.event?.data) as any;
      if (comp && typeof comp === 'object') { comp.forcedHit = true; comp.ignoreAccuracy = true; }
      (ctx as any).setPlayerState?.('forcedHitThisAction', true);
      (ctx as any).setPlayerState?.('forceHitEffectsThisAction', true);
      (ctx as any).setPlayerState?.('soulSureHitThisAction', true);
      return true;
    },
    // 所選技能 PP 歸零則無法行動（引擎既有 actionPreventedRound 讀取端）。
    action_prevent_on_empty: (ctx: Ctx2, p: any): boolean => {
      (ctx as any).setPlayerState?.('actionPreventedRound', ctx.roundNumber);
      ctx.addLog?.('⛔ 所選技能 PP 為 0，無法行動！', 'effect');
      return true;
    },
    // 免疫能力下降（回合類）。
    stat_drop_immune_turns: (ctx: Ctx2, p: any): boolean => {
      (ctx as any).setPlayerState?.('statDropImmuneTurns', Number(p.turns) || 1);
      return true;
    },
    // 清除指定回合鍵。
    turn_key_clear: (ctx: Ctx2, p: any): boolean => {
      const setter = p.side === 'opp' ? (ctx as any).setOpponentState : (ctx as any).setPlayerState;
      setter?.call(ctx, p.key, undefined);
      return true;
    },
    random_branch: (ctx: Ctx2, p: any, st: St2): boolean => {
      if (!Array.isArray(p.branches) || p.branches.length < 2) return false;
      const roll = (ctx.rng?.() ?? Math.random());
      const idx = Math.min(p.branches.length - 1, Math.floor(roll * p.branches.length));
      helpers.runStmts(ctx, p.branches[idx], st);
      return true;
    },
  };
}
