import { queueActionPowerMultiplier } from '../../../battle/actionDamageModifiers';


import { queueHpDrain } from '../../../battle/hpDrain';
import { bypassesAttackDefense } from '../../../battle/attackDefense';
import type { Elf, Skill, StatType } from "../../../types";
import { calculateEffectiveStat, getTypeMatchup } from "../../../utils/statCalculator";
import { isSkillDamageType, isNonTrueDamageType, normalizeDamageType } from "../../../battle/damageSemantics";
import { reyGodDescentRule, resolveDamageTransition, resolveRecoveryTransition } from "../../../battle/survivalRules";
import { OTHERWORLD_REY_TRANSFORM_SKILLS } from "../../../data/otherworldRey";
import type { BattleEventContext, BattleSkillHandler, DamageComputation, PriorityComputation } from "../../types";
import { EffectTiming } from "../../types";

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

const setCurrentDamageIncrease = (ctx: BattleEventContext, increasePercent: number, scope = "skill") => {
  ctx.setPlayerState(`${R}.currentDamageIncrease`, increasePercent);
  ctx.setPlayerState(`${R}.currentDamageScope`, scope);
};

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

/** 5029 異境神霆·雷伊的魂印／神明／雷神／電氣纏繞皆已拆成真 Kit（migratedReyKits.ts 等）；舊 handler 僅留空殼供注冊名稱相容。 */
export function handleOtherworldReySoulMark(_ctx: BattleEventContext, _event: EffectTiming, _data?: any): boolean | void {}

const isNonTrueDamage = (damageType: unknown) => isNonTrueDamageType(normalizeDamageType({ damageType }));

/** 技能已全數拆成真 Kit（migratedReySkillKits.ts），舊技能 handler／轉化表清空。 */
export const OTHERWORLD_REY_SKILL_TRANSFORMS: Record<string, (ctx: BattleEventContext, skill: Skill) => Skill | undefined> = {};

export const OTHERWORLD_REY_SKILLS: Record<string, BattleSkillHandler> = {};

export const OTHERWORLD_REY_ENGINE_KEYS = {
  ppFree: `${R}.ppFree`,
  godDescent: `${R}.godDescent`,
  suppressAbnormalSideEffects: `${R}.suppressAbnormalSideEffects`,
} as const;

