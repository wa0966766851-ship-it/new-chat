// 異能雷霆系通用件（legacyWrapped 拆解組 4；5029 異境神霆·雷伊 魂印「異」／專屬特質「神明」「雷神」／技能「霆·禁雷敕令」）。
// 舊 handler（effects/elves/otherworld-rey/registry.ts handleOtherworldReySoulMark／OTHERWORLD_REY_SKILLS）整份空殼化，
// 行為以本檔 op 在 Kit 內重現；引擎既有讀取端不動（survivalRules／damageCalculator／contextBuilders 的精靈旗標與 calcAtkDefMult 等）。
//
// alien_category        ：戰鬥中被視為異能精靈（category／isAlienElf）並登記異能值資源印記（顯示用，count 保留既有）。
// survival_rule         ：非正體力仍存活規則（mode='god_descent'，體力下限＝-floorMult×最大體力；引擎 survivalRules 讀取）。
// elf_trait             ：寫入引擎已接通的精靈旗標（見 ELF_TRAIT_FLAGS）。旗標只開放白名單，不接受任意欄位。
// stage_copy_up         ：複製對手能力提升狀態（逐項設為對手等級；任一項被複製即成功）。
// drain_stage_sum       ：吸取「雙方能力等級絕對值總和×unit」點體力（kind＝fixed 固定吸取／true 汲取）。
// drain_body_weight     ：汲取對手等同於自身當前重量（捨去小數）的體力（真實傷害＋等量恢復）。
// calc_stat_mult        ：mode='lost_hp'→自身雙攻／雙防在雙方計算傷害時的倍率＝1+min(cap,已損失體力比例)；mode='reset'→1。
// dmg_scale_by_lost_hp  ：造成指定類傷害時，增傷百分比＋min(cap,已損失體力比例)（outgoing 事件）。
// heal_share_bench      ：恢復自身 amount 點體力，並令不在場且存活的隊友額外恢復「自身實際可增加量（≤amount）」。
// alien_entry_cost      ：登場異能值消耗降低比例（特殊模式留接口：只登記數值，現行模式沒有讀取端）。
// nullify_incoming      ：受到指定類傷害前令其倍率歸 0（免疫；無視抵擋的傷害不適用，同 attackDefense.bypassesAttackDefense）。
// round_fact            ：記錄本回合已發生的事實（nonTrueDamaged）；供 no_nontrue_damage 條件讀取。
// 條件 god_descent{side}：該側在場者處於神降（體力≤0 且存活規則為神降）。
// 條件 no_nontrue_damage：當回合未受到非真實傷害（round_fact 於 damaged_nontrue 寫入）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { matchesDamageTypes } from '../../effects/damageChoices';
import { queueHpDrain } from '../../battle/hpDrain';
import { bypassesAttackDefense } from '../../battle/attackDefense';
import { calculateEffectiveStat, getTypeMatchup } from '../../utils/statCalculator';

type S = 'p1' | 'p2';
const STATS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 精靈旗標白名單：旗標名→值型別。讀取端分散於引擎既有檔案（見各旗標註解）。 */
export const ELF_TRAIT_FLAGS: Record<string, 'boolean' | 'turns'> = {
  // utils/damageCalculator：對手能力提升視為同等級 2 倍能力下降。
  treatOpponentBoostAsDoubleDrop: 'boolean',
  // battle/contextBuilders.clearTurnEffectsOf：自身回合類效果無法被消除。
  ownTurnEffectsUnclearable: 'boolean',
  // battle/contextBuilders.addTimerTo：對手回合類效果開始時變為 1 回合（減少的回合轉為自身麻痺）。
  collapseOpponentTurnEffectsToOne: 'boolean',
  // battle/contextBuilders：自身能力等級被改變時雙方麻痺 N 回合。
  paralyzeBothOnOwnStatChangeTurns: 'turns',
  // utils/battleHelpers／engine：處於麻痺時異常附帶效果失效。
  suppressAbnormalSideEffectsWhenParalyzed: 'boolean',
  // battle/ppExemptions：麻痺回合數不小於 N 時使用技能不受 PP 限制。
  ppLimitIgnoredWhenParalyzedTurns: 'turns',
  ppLimitIgnoredRequiresNonFull: 'boolean',
  // 攻擊技能以雙攻值總和計算（engine 於行動前寫 blkAtkSpatkSum）。
  useAtkSpAtkSumForAttacks: 'boolean',
};

/** 契約欄位（登記於 sequenceContract）。 */
export const THUNDER_GOD_ACTION_FIELDS: Record<string, readonly string[]> = {
  alien_category: ['id', 'name', 'displayChar', 'description'],
  survival_rule: ['mode', 'floorMult'],
  elf_trait: ['flag', 'value'],
  stage_copy_up: [],
  drain_stage_sum: ['unit', 'kind'],
  drain_body_weight: [],
  calc_stat_mult: ['mode', 'cap'],
  dmg_scale_by_lost_hp: ['kind', 'cap'],
  heal_share_bench: ['amount'],
  alien_entry_cost: ['ratio'],
  round_fact: ['key'],
  nullify_incoming: ['kind'],
};
export const THUNDER_GOD_CONDITION_FIELDS: Record<string, readonly string[]> = {
  god_descent: ['side'],
  no_nontrue_damage: [],
};

/** 契約補充檢查；回傳 null 代表通過。 */
export function thunderGodActionIssue(op: string, p: any, trig: string): string | null {
  if (op === 'alien_category') {
    for (const k of ['id', 'name', 'displayChar', 'description']) if (typeof p[k] !== 'string' || !p[k] || p[k].length > (k === 'description' ? 1000 : 60)) return '異能精靈登記需完整有限文字欄位';
    return null;
  }
  if (op === 'survival_rule') {
    if (p.mode !== 'god_descent') return '非正體力存活規則目前只開放神降';
    // 引擎 survivalRules 神降規則的非真實傷害調整／恢復調整固定 70%；下限倍率隨之固定 70，避免參數與讀取端不一致。
    if (p.floorMult !== 70) return '神降體力下限倍率需為70（引擎神降規則固定值）';
    return null;
  }
  if (op === 'elf_trait') {
    const kind = ELF_TRAIT_FLAGS[p.flag];
    if (!kind) return '精靈旗標需為已接通名單內的名稱';
    if (kind === 'boolean' && p.value !== true) return '布林旗標只接受 true';
    if (kind === 'turns' && (!Number.isInteger(p.value) || p.value < 1 || p.value > 100)) return '回合旗標需1至100整數';
    return null;
  }
  if (op === 'drain_stage_sum') {
    if (!Number.isInteger(p.unit) || p.unit < 1 || p.unit > 100000) return '能力等級總和吸取需正整數單位';
    if (!['fixed', 'true'].includes(p.kind)) return '能力等級總和吸取需明確固定吸取或真實汲取';
    if (!['use', 'self_skill', 'self_attack'].includes(trig)) return '能力等級總和吸取需在自身使用技能時';
    return null;
  }
  if (op === 'drain_body_weight') return ['use', 'self_skill', 'self_attack'].includes(trig) ? null : '重量汲取需在自身使用技能時';
  if (op === 'calc_stat_mult') {
    if (!['lost_hp', 'reset'].includes(p.mode)) return '能力倍率需為依已損失體力或重置';
    if (p.mode === 'lost_hp' && !(p.cap > 0 && p.cap <= 10)) return '已損失體力能力倍率需正上限';
    return null;
  }
  if (op === 'dmg_scale_by_lost_hp') {
    if (!['攻擊', '技能', '非真實', '固定', '百分比'].includes(p.kind)) return '已損失體力增傷需明確傷害類型';
    if (!(p.cap > 0 && p.cap <= 10)) return '已損失體力增傷需正上限';
    if (!['outgoing', 'outgoing_skill', 'outgoing_attack'].includes(trig)) return '已損失體力增傷需造成傷害事件';
    return null;
  }
  if (op === 'heal_share_bench') {
    if (!Number.isInteger(p.amount) || p.amount < 1 || p.amount > 1000000) return '隊友分享恢復需正整數點數';
    return null;
  }
  if (op === 'alien_entry_cost') {
    if (!(p.ratio > 0 && p.ratio < 1)) return '登場異能值消耗降低需0至100%（不含）比例';
    return null;
  }
  if (op === 'nullify_incoming') {
    if (p.kind !== '非真實') return '免疫受到傷害目前只開放非真實傷害';
    if (!['incoming', 'incoming_nontrue'].includes(trig)) return '免疫受到傷害需受方公式前事件';
    return null;
  }
  if (op === 'round_fact') {
    if (p.key !== 'nonTrueDamaged') return '回合事實目前只開放受到非真實傷害';
    return null;
  }
  return null;
}

/**
 * 技能本體屬性 skill_transform（技能固有查詢，與 base_power／stage_view 同層）：條件成立時，本次使用的技能轉為
 * 依雙攻較高者決定物理／特殊、威力＝基礎＋floor(對手重量/perWeight)×perPower、屬性取 types 中對對手克制倍數最高者的攻擊技能；
 * 雙攻（含能力等級）相同則不轉化。名稱取 names（物理／特殊各一個同效果隱藏技能），其餘欄位（Kit、技能槽）沿用原技能，
 * 因此原技能的附加效果仍由同一份 Kit 執行，不重複結算。
 */
export const SKILL_TRANSFORM_VALUE_KEYS = ['power', 'perWeight', 'perPower', 'types', 'names', 'ignoreAttackImmunity'];
export function skillTransformIssue(entry: any): string | null {
  const { value, conditions = [] } = entry.params || {};
  if (entry.source !== 'skill' || entry.role !== 'innate' || entry.node !== 'before_skill') return '技能轉化需技能固有、使用前查詢';
  if (!conditions.length) return '技能轉化需明確條件';
  if (Object.keys(entry.params).some(k => !['property', 'value', 'conditions'].includes(k))) return '技能轉化含未知參數';
  if (!value || typeof value !== 'object' || Object.keys(value).some(k => !SKILL_TRANSFORM_VALUE_KEYS.includes(k))) return '技能轉化內容含未接通欄位';
  if (!Number.isInteger(value.power) || value.power < 0 || value.power > 1000000) return '轉化威力需0至1000000整數';
  if (!Number.isInteger(value.perWeight) || value.perWeight < 1 || !Number.isInteger(value.perPower) || value.perPower < 0) return '重量換算需正整數單位與非負整數威力';
  if (!Array.isArray(value.types) || value.types.length < 1 || value.types.length > 8 || value.types.some((t: any) => typeof t !== 'string' || !t || t.length > 20)) return '轉化屬性需1至8個屬性';
  if (!value.names || typeof value.names.物理 !== 'string' || typeof value.names.特殊 !== 'string' || !value.names.物理 || !value.names.特殊) return '轉化技能需物理與特殊隱藏技能名稱';
  if (typeof value.ignoreAttackImmunity !== 'boolean') return '轉化技能需明確是否無視攻擊免疫';
  return null;
}
/** 回傳套用於本次技能的欄位；條件不符、雙攻相同或固有效果失效回傳 undefined。 */
export function skillTransformPatch(skill: any, ctx: any, evalCond: (ctx: any, c: any, st: any) => boolean | undefined): Record<string, any> | undefined {
  if (skill?.effectMode !== 'kit' || ctx.self?.isInherentInvalid) return undefined;
  const entry = (skill.kit || []).filter((e: any) => e.codeId === 'skill_property' && e.params?.property === 'skill_transform' && !skillTransformIssue(e))
    .sort((a: any, b: any) => a.order - b.order).find((e: any) => (e.params.conditions || []).every((c: any) => evalCond(ctx, c, { last: null, lastAmount: 0 }) === true));
  if (!entry) return undefined;
  const v = entry.params.value, self = ctx.self, target = ctx.target;
  const atkBase = self.calculatedStats?.atk || self.baseStats?.atk || 0, spBase = self.calculatedStats?.spatk || self.baseStats?.spatk || 0;
  const atk = calculateEffectiveStat(atkBase, self.statStages?.atk || 0), spatk = calculateEffectiveStat(spBase, self.statStages?.spatk || 0);
  if (atk === spatk) return undefined;
  const category = atk > spatk ? '物理' : '特殊';
  const weight = Math.floor(ctx.getBody?.(ctx.targetSide).weight ?? target?.weight ?? 0);
  const defenderType = target?.type || '普通';
  const type = (v.types as string[]).reduce((best, next) => getTypeMatchup(next, defenderType) > getTypeMatchup(best, defenderType) ? next : best, v.types[0]);
  return { name: v.names[category], category, type, power: v.power + Math.floor(Math.max(0, weight) / v.perWeight) * v.perPower, accuracy: 100,
    ...(v.ignoreAttackImmunity ? { ignoreAttackImmunity: true } : {}) };
}

const lostHpRatio = (e: any, cap: number): number => {
  if (!e?.maxHp || e.currentHp >= e.maxHp) return 0;
  return Math.min(cap, Math.max(0, (e.maxHp - e.currentHp) / e.maxHp));
};

/** 條件執行端（併入 runtime evalCond 預設鏈）。 */
export function thunderGodEvalCond(ctx: BattleEventContext, c: { c: string; p?: any }, liveElf: (ctx: BattleEventContext, side: S) => any): boolean | undefined {
  const p = c.p || {};
  if (c.c === 'god_descent') {
    const e = liveElf(ctx, p.side === 'self' ? ctx.actor : ctx.targetSide);
    return !!e && e.currentHp <= 0 && e.survivalRule?.mode === 'god_descent' && !!e.survivalRule?.active;
  }
  if (c.c === 'no_nontrue_damage') return ctx.getPlayerState('blkNonTrueDmgTakenRound') !== (ctx.roundNumber ?? 0);
  return undefined;
}

/** 執行端（併入 runtime 的 OPS）。 */
export function thunderGodOperations(deps: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  const { liveElf } = deps;
  return {
    alien_category: (ctx: BattleEventContext, p: any): boolean => {
      const self = ctx.self; if (!self) return false;
      ctx.updateElf(ctx.actor, { category: '異能精靈', isAlienElf: true } as any);
      const owner = idOf(self);
      const prev = ctx.getMarks(ctx.actor).find(m => m.id === p.id && m.ownerBattleId === owner);
      // 資源只登記顯示：既有數值保留（下場回場不重設），其增減由消耗該資源的技能負責。
      ctx.setMark({ id: p.id, name: p.name, count: prev?.count ?? 0, displayChar: p.displayChar, ownerBattleId: owner, visibleWhenZero: true, description: p.description }, ctx.actor);
      return true;
    },
    survival_rule: (ctx: BattleEventContext, p: any): boolean => {
      const self = ctx.self; if (!self) return false;
      ctx.updateElf(ctx.actor, { survivalRule: { mode: p.mode, active: true, preserveOffField: true, minHp: -p.floorMult * Math.max(0, self.maxHp) } } as any);
      return true;
    },
    elf_trait: (ctx: BattleEventContext, p: any): boolean => {
      if (!ctx.self) return false;
      ctx.updateElf(ctx.actor, { [p.flag]: p.value } as any);
      return true;
    },
    stage_copy_up: (ctx: BattleEventContext): boolean => {
      const self = liveElf(ctx, ctx.actor), opp = liveElf(ctx, ctx.targetSide);
      const deltas: Record<string, number> = {};
      for (const stat of STATS) {
        const v = opp?.statStages?.[stat] || 0;
        if (v > 0) deltas[stat] = v - (self?.statStages?.[stat] || 0);
      }
      if (!Object.keys(deltas).length) return false;
      ctx.applyStatChange(ctx.actor, deltas);
      return true;
    },
    drain_stage_sum: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor), opp = liveElf(ctx, ctx.targetSide);
      const sum = [self, opp].reduce((total, e) => total + STATS.reduce((s, k) => s + Math.abs(e?.statStages?.[k] || 0), 0), 0);
      const amount = sum * p.unit;
      if (amount <= 0) return false;
      return queueHpDrain(ctx, ctx.targetSide, amount, p.kind === 'true' ? 'true' : 'fixed') > 0;
    },
    drain_body_weight: (ctx: BattleEventContext): boolean => {
      const weight = Math.floor(ctx.getBody?.(ctx.actor).weight ?? ctx.self?.weight ?? 0);
      if (weight <= 0) return false;
      ctx.applyAbsorb(ctx.targetSide, weight);
      return true;
    },
    calc_stat_mult: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor);
      ctx.setPlayerState('calcAtkDefMult', p.mode === 'reset' ? 1 : 1 + lostHpRatio(self, p.cap));
      return true;
    },
    dmg_scale_by_lost_hp: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
      if (!comp || comp.isIncoming) return false;
      const scopes: Record<string, string> = { 攻擊: 'attack', 技能: 'skill', 非真實: 'non_true', 固定: 'fixed', 百分比: 'percent' };
      if (!matchesDamageTypes([scopes[p.kind]], comp.damageCategory)) return false;
      const ratio = lostHpRatio(liveElf(ctx, ctx.actor), p.cap);
      if (ratio <= 0) return false;
      comp.increasePercent += ratio;
      return true;
    },
    heal_share_bench: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor);
      const activeId = idOf(self);
      ctx.applyHeal(ctx.actor,p.amount,{minimum:p.amount,onSettled:r=>{
        if(r.hpGained<=0)return;
        for(const ally of ctx.getFullTeam(ctx.actor)){
          if(idOf(ally)===activeId||ally.currentHp<=0||ally.isVanished)continue;
          ctx.applyHealToElf?.(ctx.actor,idOf(ally),r.hpGained);
        }
      }});
      return true;
    },
    alien_entry_cost: (ctx: BattleEventContext, p: any): boolean => {
      ctx.setPlayerState('alienEntryCostReduction', p.ratio);
      return true;
    },
    nullify_incoming: (ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      const comp = st.event?.data?.damageComp || (st.event?.data?.base != null ? st.event.data : null);
      if (!comp || !comp.isIncoming) return false;
      if (!matchesDamageTypes(['non_true'], comp.damageCategory)) return false;
      if (bypassesAttackDefense(comp, 'block')) return false;
      comp.multiplier = 0;
      return true;
    },
    round_fact: (ctx: BattleEventContext): boolean => {
      ctx.setPlayerState('blkNonTrueDmgTakenRound', ctx.roundNumber ?? 0);
      return true;
    },
  };
}
