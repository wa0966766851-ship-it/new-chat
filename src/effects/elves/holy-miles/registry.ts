import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import type { StatType } from "../../../types";
import type { BattleEventContext, BattleSkillHandler, DamageComputation } from "../../types";
import { EffectTiming } from "../../types";

const key = (name: string) => `holyMiles.${name}`;
const stats: StatType[] = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
const active = (c: BattleEventContext) => (c.self.battleId || c.self.id) === ((c.actor === "p1" ? c.activeP1 : c.activeP2).battleId || (c.actor === "p1" ? c.activeP1 : c.activeP2).id);
const turns = (c: BattleEventContext, name: string) => Number(c.getPlayerState(key(name)) || 0);
const set = (c: BattleEventContext, name: string, n: number) => c.setPlayerState(key(name), n);
const hpSteps = (hp: number, max: number) => max > 0 ? Math.min(10, Math.floor(Math.max(0, hp) / max * 10 + 1e-9)) : 0;
const isAbnormal = (c: BattleEventContext) => Object.values(c.getStatuses(c.self)).some(n => n > 0);

/** 本精靈所有跨回合狀態只由自己的生命週期遞減，避免核心增加名字特判。 */
export function handleHolyMilesSoulMark(c: BattleEventContext, event: EffectTiming, data?: any): void {
  // 5030 魂印「聖」已遷真 Kit（migratedHolyMilesKits.ts；DSH 20261018 第十三批）——規則3.3 空殼化。
  return;
}

export const HOLY_MILES_SKILLS: Record<string, BattleSkillHandler> = {
  // 5030 四技（含淨世洗禮頌）已全部遷真 Kit（DSH 20261018 第十三批）——規則3.3 空殼化。
};
