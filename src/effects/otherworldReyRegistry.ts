import type { Elf, Skill, StatType } from "../types";
import { calculateEffectiveStat, getTypeMatchup } from "../utils/statCalculator";
import { isSkillDamageType } from "../battle/damageSemantics";
import { reyGodDescentRule, resolveDamageTransition, resolveRecoveryTransition } from "../battle/survivalRules";
import { OTHERWORLD_REY_TRANSFORM_SKILLS } from "../data/otherworldRey";
import type { BattleEventContext, BattleSkillHandler, DamageComputation, PriorityComputation } from "./types";
import { EffectTiming } from "./types";

const R = "otherworldRey";
const STATS: StatType[] = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
type Side = "p1" | "p2";

export const sumAbsoluteStatStages = (...elves: Array<Pick<Elf, "statStages"> | undefined>): number =>
  elves.reduce((total, elf) => total + STATS.reduce((sum, stat) => sum + Math.abs(elf?.statStages?.[stat] || 0), 0), 0);

export const hasPositiveStage = (elf: Pick<Elf, "statStages"> | undefined): boolean =>
  STATS.some((stat) => (elf?.statStages?.[stat] || 0) > 0);

export const getLostHpRatio = (elf: Pick<Elf, "currentHp" | "maxHp">): number => {
  if (!elf.maxHp || elf.currentHp >= elf.maxHp) return 0;
  return Math.min(0.7, Math.max(0, (elf.maxHp - elf.currentHp) / elf.maxHp));
};

export const getWeightStepPower = (weight: number): number => 210 + Math.floor(Math.max(0, weight) / 70) * 70;

export const pickBestReyElement = (defenderType: string): string => {
  const candidates = ["電", "神秘", "神秘.電"];
  return candidates.reduce((best, next) =>
    getTypeMatchup(next, defenderType) > getTypeMatchup(best, defenderType) ? next : best,
  candidates[0]);
};

const statuses = (ctx: BattleEventContext, elf: Elf) => ctx.getStatuses(elf) || {};
const statusTurns = (ctx: BattleEventContext, elf: Elf, ...ids: string[]) =>
  Math.max(0, ...ids.map((id) => Number(statuses(ctx, elf)[id] || 0)));
const isParalyzed = (ctx: BattleEventContext, elf: Elf) => statusTurns(ctx, elf, "麻痺", "麻痹", "paralyzed") > 0;
const isAbnormal = (ctx: BattleEventContext, elf: Elf) => Object.values(statuses(ctx, elf)).some((turn) => Number(turn) > 0);
const elfIdentity = (elf: Pick<Elf, "id" | "battleId">) => elf.battleId || elf.id;
export const isReyActive = (ctx: Pick<BattleEventContext, "actor" | "self" | "activeP1" | "activeP2">) =>
  elfIdentity(ctx.self) === elfIdentity(ctx.actor === "p1" ? ctx.activeP1 : ctx.activeP2);

export interface ReyTransformOptions {
  inherentInvalid?: boolean;
  defenderType?: string;
  defenderWeight?: number;
  effectiveAtk: number;
  effectiveSpAtk: number;
  paralyzed: boolean;
}

/** 回傳 undefined 表示保留原本的屬性技能；此時附加效果仍照常執行。 */
export function resolveReyFifthTransformation(options: ReyTransformOptions): Skill | undefined {
  if (!options.paralyzed || options.inherentInvalid || options.effectiveAtk === options.effectiveSpAtk) return undefined;
  const base = options.effectiveAtk > options.effectiveSpAtk
    ? OTHERWORLD_REY_TRANSFORM_SKILLS.physical
    : OTHERWORLD_REY_TRANSFORM_SKILLS.special;
  return {
    ...base,
    type: pickBestReyElement(options.defenderType || "普通"),
    power: getWeightStepPower(Math.floor(options.defenderWeight || 0)),
  };
}

export const isGodDescent = (ctx: BattleEventContext) => ctx.self.currentHp <= 0 && ctx.self.survivalRule?.mode === "god_descent";
export const godDescentFloor = (elf: Pick<Elf, "maxHp">) => -70 * elf.maxHp;
export const clampGodDescentHp = (elf: Pick<Elf, "maxHp">, hp: number) => Math.max(godDescentFloor(elf), hp);

/**
 * 神降中的傷害結算值。非真實傷害本身歸零，再作 -70% 最大體力的「體力調整」；
 * 真實傷害保留原傷害量。這個 helper 不把結果標成 damage/heal。
 */
export function resolveGodDescentHit(currentHp: number, maxHp: number, incoming: number, trueDamage: boolean): number {
  return resolveDamageTransition(
    currentHp,
    maxHp,
    incoming,
    trueDamage ? "true" : "non_true",
    reyGodDescentRule(maxHp),
  ).hp;
}

export function resolveGodDescentRecovery(currentHp: number, maxHp: number): number {
  return resolveRecoveryTransition(currentHp, maxHp, 0, reyGodDescentRule(maxHp)).hp;
}

const addPp = (ctx: BattleEventContext, amount: number) => {
  const next = ctx.self.skills.map((entry) => {
    const max = entry.maxPp ?? entry.pp;
    const now = entry.currentPp ?? entry.pp;
    return { ...entry, pp: Math.min(max, now + amount), currentPp: Math.min(max, now + amount) };
  });
  // ROUND_END/BATTLE_PHASE_END 會廣播給整隊；必須按精靈身分更新，不能覆蓋當前在場精靈的技能。
  ctx.updateAnyElf(ctx.actor, elfIdentity(ctx.self), { skills: next });
};

const applyAllStage = (ctx: BattleEventContext, side: Side, amount: number) =>
  ctx.applyStatChange(side, Object.fromEntries(STATS.map((stat) => [stat, amount])));

const addParalysis = (ctx: BattleEventContext, side: Side, turns: number) => {
  const target = side === ctx.actor ? ctx.self : ctx.target;
  const current = statusTurns(ctx, target, "麻痺", "麻痹", "paralyzed");
  ctx.applyStatusWithImmunityCheck(side, "麻痺", Math.max(turns, current + turns));
};

const skillDamageBoostFactor = (ctx: BattleEventContext): number => {
  if (hasPositiveStage(ctx.self) || hasPositiveStage(ctx.target)) return 3;
  return ctx.goesFirst ? 2 : 1;
};

const setCurrentDamageIncrease = (ctx: BattleEventContext, increasePercent: number) =>
  ctx.setPlayerState(`${R}.currentDamageIncrease`, increasePercent);

const boostOpponentStages = (ctx: BattleEventContext) => {
  const amount = hasPositiveStage(ctx.target) ? 2 : 1;
  applyAllStage(ctx, ctx.targetSide, amount);
};

const benchHeal = (ctx: BattleEventContext, amount: number) => {
  if (amount <= 0) return;
  const activeId = ctx.self.battleId || ctx.self.id;
  for (const ally of ctx.getFullTeam(ctx.actor)) {
    if ((ally.battleId || ally.id) === activeId || ally.currentHp <= 0 || ally.isVanished) continue;
    ctx.updateAnyElf(ctx.actor, ally.battleId || ally.id, { currentHp: Math.min(ally.maxHp, ally.currentHp + amount) });
  }
};

export function handleOtherworldReySoulMark(ctx: BattleEventContext, event: EffectTiming, data?: any): boolean | void {
  const { self, target, actor, targetSide } = ctx;

  // 這些節點由 BattleScreen 廣播給整隊；雷伊下場後保留神降資料，但不以場下 ctx 操作新上場精靈。
  if (!isReyActive(ctx) && (
    event === EffectTiming.ROUND_START ||
    event === EffectTiming.ROUND_END ||
    event === EffectTiming.BATTLE_PHASE_END ||
    event === EffectTiming.ENFORCE
  )) return;

  if (event === EffectTiming.ON_ENTRANCE) {
    ctx.updateElf(actor, { category: "異能精靈", isAlienElf: true, survivalRule: reyGodDescentRule(self.maxHp) });
    ctx.setMark({
      id: "rey_alien_energy",
      name: "異能值",
      count: Number(ctx.getPlayerState(`${R}.alienEnergy`) || 0),
      displayChar: "異",
      ownerBattleId: elfIdentity(self),
      visibleWhenZero: true,
      description: "異能值系統預留欄位；目前只顯示數值，不產生任何戰鬥效果。",
    }, actor);
    ctx.setPlayerState(`${R}.entered`, true);
  }

  if (event === EffectTiming.ROUND_START) {
    const copied: Partial<Record<StatType, number>> = {};
    for (const stat of STATS) {
      const value = target.statStages?.[stat] || 0;
      if (value > 0) copied[stat] = value;
    }
    if (Object.keys(copied).length) {
      const deltas = Object.fromEntries(Object.entries(copied).map(([stat, value]) => [stat, Number(value) - Number(self.statStages?.[stat as StatType] || 0)]));
      ctx.applyStatChange(actor, deltas);
      addParalysis(ctx, actor, 1);
      ctx.addLog("⚡ 【異】：複製對手能力提升成功，當回合令自身麻痺！", "effect");
    } else {
      ctx.applyStatChange(actor, { atk: 2, speed: 2, accuracy: 2 });
      ctx.setPlayerState(`${R}.roundPriority`, 1);
      ctx.addLog("⚡ 【異】：對手沒有能力提升，自身攻擊、速度、命中+2，當回合技能先制+1！", "effect");
    }
    ctx.setPlayerState(`${R}.tookNonTrueInGodDescent`, false);
  }

  if (event === EffectTiming.MODIFY_PRIORITY && data?.priorityComp) {
    const comp = data.priorityComp as PriorityComputation;
    comp.bonus += Number(ctx.getPlayerState(`${R}.roundPriority`) || 0);
    comp.bonus += Number(ctx.getPlayerState(`${R}.priorityTurns`) > 0 ? ctx.getPlayerState(`${R}.priorityValue`) || 0 : 0);
    if (ctx.skill?.name === "霆·禁雷敕令" && self.currentHp < 210) comp.forcedFirst = true;
    if (ctx.getOpponentState(`${R}.specialAttackPriorityPenalty`)) comp.bonus -= 1;
  }

  if (event === EffectTiming.BEFORE_ACTION && ctx.skill) {
    if (ctx.skill.category !== "屬性") {
      if (self.useAtkSpAtkSumForAttacks) ctx.setPlayerState("blkAtkSpatkSum", true);
      const stageAmount = sumAbsoluteStatStages(self, target) * 70;
      if (isAbnormal(ctx, self)) {
        ctx.applyAbsorb(targetSide, Math.floor(ctx.getBody?.(actor).weight ?? self.weight ?? 0));
      }
      if (stageAmount > 0) ctx.applyAbsorb(targetSide, stageAmount);
    }
  }

  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const comp = data.damageComp as DamageComputation;
    if (!comp.isIncoming) {
      comp.increasePercent += 0.7; // 電氣纏繞：攻擊威力提升70%的等價傷害乘區
      comp.increasePercent += getLostHpRatio(self); // 雷神：每損失1%體力，非真實傷害+1%，最高70%
      if (isParalyzed(ctx, self)) comp.increasePercent += 0.7;
      comp.increasePercent += Number(ctx.getPlayerState(`${R}.currentDamageIncrease`) || 0);
      const floor = Number(ctx.getPlayerState(`${R}.currentDamageFloor`) || 0);
      if (floor > 0) comp.floor = Math.max(comp.floor || 0, floor);
    } else {
      // 電氣纏繞：對手最終雙攻為面板70%；雷神：已損體力比例同步強化雙防。
      comp.multiplier *= 0.7;
      comp.multiplier /= 1 + getLostHpRatio(self);
      if (isGodDescent(ctx) && comp.damageCategory !== "true") comp.multiplier = 0;
    }
  }

  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === actor && isNonTrueDamage(data?.damageType)) {
    if (isGodDescent(ctx)) ctx.setPlayerState(`${R}.tookNonTrueInGodDescent`, true);
  }

  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === targetSide && data?.amount > 0) {
    // 這一段要求中央 observer 名單包含本精靈，才會在「對手受擊」時收到通知。
    if (ctx.getPlayerState(`${R}.pendingStarAbsorb`) && isSkillDamageType(data.damageType)) {
      const ratio = Number(ctx.getPlayerState(`${R}.pendingStarAbsorb`) || 0.7);
      ctx.applyAbsorb(targetSide, Math.floor(data.amount * ratio));
      ctx.setPlayerState(`${R}.pendingStarAbsorb`, 0);
    }
  }

  if (event === EffectTiming.AFTER_ACTION && ctx.skill) {
    addParalysis(ctx, targetSide, 1); // 電氣纏繞
    if (ctx.skill.category === "物理") {
      const actual = Math.min(70, Math.max(0, self.maxHp - self.currentHp));
      ctx.applyHeal(actor, 70);
      benchHeal(ctx, actual);
    } else if (ctx.skill.category === "特殊") {
      ctx.setOpponentState(`${R}.specialAttackPriorityPenalty`, true);
    }
    setCurrentDamageIncrease(ctx, 0);
    ctx.setPlayerState(`${R}.currentDamageFloor`, 0);
  }

  if (event === EffectTiming.BATTLE_PHASE_END && isAbnormal(ctx, self)) addPp(ctx, 7);

  if (event === EffectTiming.ROUND_END) {
    if (isGodDescent(ctx) && !ctx.getPlayerState(`${R}.tookNonTrueInGodDescent`)) {
      ctx.adjustHp(actor, Math.floor(self.maxHp * 0.07));
    }
    const drainTurns = Number(ctx.getPlayerState(`${R}.stormDrainTurns`) || 0);
    if (drainTurns > 0 && target.currentHp > 0) {
      ctx.applyAbsorb(targetSide, Math.floor(target.maxHp / 3));
      ctx.setPlayerState(`${R}.stormDrainTurns`, drainTurns - 1);
    }
    const priorityTurns = Number(ctx.getPlayerState(`${R}.priorityTurns`) || 0);
    if (priorityTurns > 0) ctx.setPlayerState(`${R}.priorityTurns`, priorityTurns - 1);
    ctx.setPlayerState(`${R}.roundPriority`, 0);
  }

  if (event === EffectTiming.ON_PP_CONSUME && isParalyzed(ctx, self) && statusTurns(ctx, self, "麻痺", "麻痹", "paralyzed") >= 7) {
    // 中央 PP 扣除點須在扣除前查詢此旗標；本事件只保留相容狀態。
    ctx.setPlayerState(`${R}.ppFree`, true);
  }

  if (event === EffectTiming.FATAL_RESIST) {
    const incoming = Math.max(0, Number(data?.amount || data?.damage || 0));
    const trueDamage = data?.damageType === "true" || data?.damageType === "true_damage";
    if (!isGodDescent(ctx)) {
      ctx.setPlayerState(`${R}.godDescent`, true);
      ctx.applyDeathImmunity(actor, { guardTurns: 0, deathImmuneTurns: 999, preserveOffField: true });
      const entryHp = trueDamage
        ? resolveGodDescentHit(self.currentHp, self.maxHp, incoming, true)
        : -Math.floor(self.maxHp * 0.7);
      ctx.updateElf(actor, { currentHp: entryHp });
      ctx.addLog("⚡ 【神明】：體力歸0，進入神降！存活判定不再受0體力限制。", "effect");
      return true;
    }
    if (!trueDamage) ctx.setPlayerState(`${R}.tookNonTrueInGodDescent`, true);
    const nextHp = resolveGodDescentHit(self.currentHp, self.maxHp, incoming, trueDamage);
    ctx.updateElf(actor, { currentHp: nextHp });
    return true;
  }
}

const isNonTrueDamage = (damageType: unknown) => {
  const type = String(damageType || "");
  return type !== "true" && type !== "true_damage" && type !== "absorb";
};

export const OTHERWORLD_REY_SKILL_TRANSFORMS: Record<string, (ctx: BattleEventContext, skill: Skill) => Skill | undefined> = {
  "霆·禁雷敕令": (ctx) => {
    const atkBase = ctx.self.calculatedStats?.atk || ctx.self.baseStats.atk;
    const spatkBase = ctx.self.calculatedStats?.spatk || ctx.self.baseStats.spatk;
    const transformed = resolveReyFifthTransformation({
      inherentInvalid: !!ctx.self.isInherentInvalid,
      defenderType: ctx.target.type,
      defenderWeight: ctx.getBody?.(ctx.targetSide).weight ?? ctx.target.weight ?? 0,
      effectiveAtk: calculateEffectiveStat(atkBase, ctx.self.statStages?.atk || 0),
      effectiveSpAtk: calculateEffectiveStat(spatkBase, ctx.self.statStages?.spatk || 0),
      paralyzed: isParalyzed(ctx, ctx.self),
    });
    if (transformed) {
      ctx.setPlayerState("blkAtkSpAtkSum", true);
      ctx.addLog(`⚡ 【霆·禁雷敕令】：轉化為【${transformed.name}】，屬性取${transformed.type}、威力${transformed.power}！`, "effect");
    }
    return transformed;
  },
};

const starVoid: BattleSkillHandler = (ctx) => {
  boostOpponentStages(ctx);
  ctx.setPlayerState(`${R}.pendingStarAbsorb`, 0.7 * skillDamageBoostFactor(ctx));
  ctx.setOpponentState("attackPowerDivisorTurns", 7);
  ctx.setOpponentState("attackPowerDivisor", 70);
  ctx.setOpponentState("attackSkillInvalidTurns", 2);
};

const otherworldThunder: BattleSkillHandler = (ctx) => {
  boostOpponentStages(ctx);
  const elem = pickBestReyElement(ctx.target.type);
  ctx.setPlayerState(`${R}.currentDamageFloor`, 300 * getTypeMatchup(elem, ctx.target.type));
  ctx.applyAbsorb(ctx.targetSide, Math.floor(ctx.target.maxHp / 2));
  ctx.setPlayerState(`${R}.stormDrainTurns`, 5);
  ctx.setPlayerState(`${R}.currentDamageIncrease`, 2.1);
  ctx.setPlayerState(`${R}.priorityTurns`, 2);
  ctx.setPlayerState(`${R}.priorityValue`, 3);
};

const sameDustRite: BattleSkillHandler = (ctx) => {
  const base = ctx.self.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
  const next = { ...base };
  for (const stat of STATS) next[stat] = Math.max(next[stat] || 0, ctx.target.statStages?.[stat] || 0);
  const weightLoss = Math.min(70, Math.floor(ctx.getBody?.(ctx.targetSide).weight ?? ctx.target.weight ?? 0));
  // 「體力調整為1」不是恢復效果：即使目前為0或負體力，也直接設定為1，
  // 不經治療倍率、禁療或神降的恢復量替換規則。
  ctx.updateElf(ctx.actor, { statStages: next, currentHp: 1 });
  ctx.setOpponentState("attackPpMultiplierTurns", 7);
  ctx.setOpponentState("attackPpMultiplier", 7);
  ctx.updateElf(ctx.targetSide, {
    maxHp: Math.max(1, ctx.target.maxHp - weightLoss),
    currentHp: Math.min(ctx.target.currentHp, Math.max(1, ctx.target.maxHp - weightLoss)),
  });
  ctx.setOpponentState("alienEnergy", Math.max(0, Number(ctx.getOpponentState("alienEnergy") || 0) - weightLoss));
};

const thunderExecution: BattleSkillHandler = (ctx) => {
  boostOpponentStages(ctx);
  setCurrentDamageIncrease(ctx, 0.7 * skillDamageBoostFactor(ctx));
  ctx.applyAbsorb(ctx.targetSide, 70);
  ctx.setOpponentState("utilitySkillInvalidTurns", 2);
};

const forbiddenThunderOrder: BattleSkillHandler = (ctx) => {
  const trueDamage = ctx.self.currentHp < 0
    ? Math.floor(ctx.self.maxHp * 0.7)
    : Math.floor(Math.max(0, ctx.target.maxHp - ctx.target.currentHp) * 0.7);
  if (trueDamage > 0) ctx.applyTrueDamage(ctx.targetSide, trueDamage, "【霆·禁雷敕令】附加真實傷害");
  const cleared = ctx.clearTurnEffectsOf(ctx.targetSide, ctx.target);
  if (cleared) {
    ctx.setOpponentState("damageTakenBoostTurns", 2);
    ctx.setOpponentState("DamageBoostTurns", 2);
  }
  if (ctx.self.currentHp < ctx.self.maxHp / 3) setCurrentDamageIncrease(ctx, 2); // 最終3倍 = 原傷害 +200%
  if (ctx.target.currentHp > 0) {
    ctx.setPlayerState(`${R}.priorityTurns`, 2);
    ctx.setPlayerState(`${R}.priorityValue`, 2);
  }
};

export const OTHERWORLD_REY_SKILLS: Record<string, BattleSkillHandler> = {
  "空墟赫星": starVoid,
  "異境神霆": otherworldThunder,
  "同塵祭": sameDustRite,
  "天雷誅殺": thunderExecution,
  "霆·禁雷敕令": forbiddenThunderOrder,
  "霆·禁雷敕令·神罰": forbiddenThunderOrder,
  "霆·禁雷敕令·神譴": forbiddenThunderOrder,
};

export const OTHERWORLD_REY_ENGINE_KEYS = {
  ppFree: `${R}.ppFree`,
  godDescent: `${R}.godDescent`,
  suppressAbnormalSideEffects: `${R}.suppressAbnormalSideEffects`,
} as const;

