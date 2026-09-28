import type { StatType } from "../types";
import type { BattleEventContext, BattleSkillHandler, DamageComputation } from "./types";
import { EffectTiming } from "./types";

const key = (name: string) => `holyMiles.${name}`;
const stats: StatType[] = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
const active = (c: BattleEventContext) => (c.self.battleId || c.self.id) === ((c.actor === "p1" ? c.activeP1 : c.activeP2).battleId || (c.actor === "p1" ? c.activeP1 : c.activeP2).id);
const turns = (c: BattleEventContext, name: string) => Number(c.getPlayerState(key(name)) || 0);
const set = (c: BattleEventContext, name: string, n: number) => c.setPlayerState(key(name), n);
const hpSteps = (hp: number, max: number) => max > 0 ? Math.min(10, Math.floor(Math.max(0, hp) / max * 10 + 1e-9)) : 0;
const isAbnormal = (c: BattleEventContext) => Object.values(c.getStatuses(c.self)).some(n => n > 0);

/** 本精靈所有跨回合狀態只由自己的生命週期遞減，避免核心增加名字特判。 */
export function handleHolyMilesSoulMark(c: BattleEventContext, event: EffectTiming, data?: any): void {
  if (!active(c)) return;
  if (event === EffectTiming.ROUND_START) {
    for (const name of ["reflect", "fatigue", "drain", "crit", "burn", "prioritySeal"]) {
      const n = turns(c, name);
      if (n > 0) set(c, name, n - 1);
    }
    set(c, "halves", 1 + hpSteps(c.self.currentHp, c.self.maxHp));
    set(c, "anger", 0);
    if (turns(c, "cleansePending")) {
      const remaining = { ...c.getStatuses(c.self) };
      for (const id of Object.keys(remaining)) {
        if (/麻痺|麻痹|害怕|疲憊|冰封|束縛|睡眠|混亂|弱化|中毒|燒傷|凍傷/.test(id)) delete remaining[id];
      }
      c.updateElf(c.actor, {
        battleStatuses: remaining,
        battleStatus: Object.keys(remaining)[0] || "normal",
        effects: c.self.effects?.filter(e => e.id in remaining),
      });
      set(c, "cleansePending", 0);
      c.setOpponentState("priorityBoostTurns", 0);
    }
    if (turns(c, "drain")) c.applyAbsorb(c.targetSide, Math.floor(c.target.maxHp / 3) * (c.self.currentHp < c.self.maxHp / 2 ? 2 : 1));
  }
  if (event === EffectTiming.ROUND_END) {
    if (c.self.currentHp > 0) {
      const repetitions = 1 + hpSteps(c.self.maxHp - c.self.currentHp, c.self.maxHp);
      for (let i = 0; i < repetitions; i++) {
        c.applyHeal(c.actor, Math.floor(c.self.maxHp / 10));
        c.applyPercentDamage(c.targetSide, 0.1);
        if (i > 0 && isAbnormal(c)) set(c, "cleansePending", 1);
      }
    }
  }
  if (event === EffectTiming.BEFORE_ACTION && c.skill?.category !== "屬性") {
    if (turns(c, "crit")) c.setPlayerState("mustCrit", true);
    c.applyAbsorb(c.targetSide, Math.floor(c.self.maxHp / 10));
  }
  if (event === EffectTiming.BEFORE_DAMAGE && data?.damageComp) {
    const d = data.damageComp as DamageComputation;
    if (d.isIncoming && d.damageCategory !== "true") {
      const count = turns(c, "halves") || 1;
      d.multiplier *= 2 ** -count;
      if (turns(c, "anger") && d.damageCategory === "skill_attack") {
        d.multiplier *= 2 ** turns(c, "anger");
        set(c, "anger", 0);
      }
    }
    if (!d.isIncoming && d.damageCategory === "skill_attack") {
      if (turns(c, "attackDouble")) {
        d.multiplier *= 2;
        set(c, "attackDouble", turns(c, "attackDouble") - 1);
      }
      if (c.skill?.name === "淨世洗禮頌") d.floor = Math.max(d.floor || 0, 280);
    }
  }
  if (event === EffectTiming.OPPONENT_ACTION && data?.skill) {
    if (data.skill.category === "屬性") {
      if (turns(c, "utilityPunish")) {
        c.applyTrueDamage(c.targetSide, 300, "八荒憫淚");
        set(c, "utilityPunish", turns(c, "utilityPunish") - 1);
      }
      if (turns(c, "burn")) c.applyStatusWithImmunityCheck(c.targetSide, "燒傷", 2);
    } else if (turns(c, "fatigue")) c.applyStatusWithImmunityCheck(c.targetSide, "疲憊", 2);
  }
  if (event === EffectTiming.BEFORE_STATUS_APPLY && data && turns(c, "reflect")) {
    data.prevented = true;
    c.applyStatusWithImmunityCheck(c.targetSide, data.status, data.duration);
  }
  if (event === EffectTiming.OPPONENT_DAMAGE && data?.damageType === "percent" && data.sourceElfName === c.self.name && data.hpReduced === 0) {
    const highest = Math.max(0, ...c.getFullTeam(c.targetSide).map(e => hpSteps(e.currentHp, e.maxHp)));
    set(c, "anger", 1 + highest);
  }
  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === c.targetSide && data?.amount > 0 && /skill_attack/.test(data.damageType || "") && c.skill?.name === "淨世洗禮頌") {
    // The observer receives actual HP damage after shields and limits have been applied.
    if (Object.values(c.getStatuses(c.target)).some(n => n > 0)) c.applyPinkDamage(c.targetSide, data.amount, "淨世洗禮頌", undefined, undefined, "percent");
  }
  if (event === EffectTiming.ON_DAMAGED && data?.targetSide === c.actor && data?.amount > 0 && /skill_attack/.test(data.damageType || "")) {
    if (turns(c, "reflectHits")) {
      const defense = (c.self.calculatedStats?.def || 0) + (c.self.calculatedStats?.spdef || 0);
      c.applyTrueDamage(c.targetSide, Math.floor(defense * 0.65), "四象靈獸回饋");
      set(c, "reflectHits", turns(c, "reflectHits") - 1);
    }
  }
}

export const HOLY_MILES_SKILLS: Record<string, BattleSkillHandler> = {
  "八荒憫淚": c => {
    set(c, "reflect", 6); set(c, "fatigue", 6); set(c, "utilityPunish", 2);
    c.setPlayerState("blockAttackCount", Number(c.getPlayerState("blockAttackCount") || 0) + 1);
  },
  "天佑聖障": c => {
    c.applyStatChange(c.actor, Object.fromEntries(stats.map(s => [s, c.self.currentHp > c.self.maxHp / 2 ? 2 : 1])));
    set(c, "drain", 6); set(c, "crit", 3);
    c.setPlayerState("priorityBoostTurns", 3); c.setPlayerState("priorityBoostValue", 3);
  },
  "四象靈獸": c => {
    const down = Object.fromEntries(stats.filter(s => (c.self.statStages?.[s] || 0) < 0).map(s => [s, -2 * (c.self.statStages?.[s] || 0)]));
    if (Object.keys(down).length) {
      c.applyStatChange(c.actor, down);
      for (const s of ["燒傷", "凍傷", "中毒", "麻痺"]) c.applyStatusWithImmunityCheck(c.targetSide, s, 2);
    }
    const up = Object.fromEntries(stats.filter(s => (c.target.statStages?.[s] || 0) > 0).map(s => [s, c.target.statStages?.[s] || 0]));
    if (Object.keys(up).length) {
      c.applyStatChange(c.actor, up);
      c.applyStatChange(c.targetSide, Object.fromEntries(Object.entries(up).map(([s, n]) => [s, -n])));
      set(c, "attackDouble", 2);
    }
    set(c, "reflectHits", 2);
  },
  "淨世洗禮頌": c => {
    c.setPlayerState("vampireRatio", 1);
    set(c, "burn", 4);
  },
  "聖靈乾坤斷": c => {
    if (c.clearTurnEffectsOf(c.targetSide)) c.applyStatChange(c.actor, { atk: 2, speed: 2, accuracy: 2 });
    c.setOpponentState("utilitySkillInvalidTurns", 2);
    c.setOpponentState("utilitySkillInvalidReason", "聖靈乾坤斷");
    const uses = turns(c, "fifthUses");
    c.applyAbsorb(c.targetSide, Math.min(500, 200 + uses * 100));
    set(c, "fifthUses", uses + 1);
    const selectedName = c.opponentSkill?.name;
    const depletedSelected = !!selectedName && c.target.skills.some(s => s.name === selectedName && (s.currentPp ?? s.pp) === 1);
    const skills = c.target.skills.map(s => {
      const pp = Math.max(0, (s.currentPp ?? s.pp) - 1);
      return { ...s, pp, currentPp: pp };
    });
    c.updateElf(c.targetSide, { skills });
    if (depletedSelected) {
      c.setOpponentState("nextSkillInvalid", true);
      c.applyTrueDamage(c.targetSide, 300, "聖靈乾坤斷");
    }
  },
};
