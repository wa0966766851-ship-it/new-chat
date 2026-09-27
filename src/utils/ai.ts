import { Elf, Skill, BattleItem } from "../types";
import { BattleState } from "../components/BattleManager";
import { calculateDamage } from "./damageCalculator";
import { BATTLE_ITEMS, getStatuses, isZeroPpExempt, isElfSwitchDisabled, getNoSwitchTurns } from "./battleHelpers";
import { getTypeMatchup } from "./statCalculator";
import { decideAction, decideForcedSwitch, type AIContext, type AIDeps } from "../battle/ai";

export interface AIAction {
  type: 'skill' | 'switch' | 'item';
  skill?: Skill;
  switchIndex?: number;
  item?: BattleItem;
}

export const pickAiAction = (
  state: BattleState,
  side: 'p1' | 'p2',
  p1Suit?: string,
  p2Suit?: string,
  rng: () => number = Math.random
): AIAction => {
  const self = side === 'p1' ? state.p1 : state.p2;
  const opponent = side === 'p1' ? state.p2 : state.p1;
  const team = side === 'p1' ? state.p1Team : state.p2Team;
  const activeIndex = side === 'p1' ? state.p1ActiveIndex : state.p2ActiveIndex;

  const canSwitch = team.some((elf, idx) => !elf.isExtra && (elf.currentHp > 0 || (elf.deathImmunity?.deathImmuneTurns ?? 0) > 0) && idx !== activeIndex) && !state.isTyrDuelField
    && !isElfSwitchDisabled(self, opponent, false, getNoSwitchTurns(state, side));

  const ctx: AIContext = {
    self,
    opponent,
    team,
    activeIndex,
    items: BATTLE_ITEMS as BattleItem[],
    canSwitch,
    canUseItem: true,
    turnNumber: state.turnNumber,
  };

  const deps: AIDeps = {
    estimateDamage: (attacker: Elf, defender: Elf, skill: Skill) => {
      const res = calculateDamage(attacker, defender, skill, side, p1Suit, p2Suit, 1.0, false);
      return res.damage;
    },
    getTypeMatchup,
    getStatuses: (elf: Elf) => {
      return getStatuses(elf);
    },
    isSkillUsable: (elf: Elf, skill: Skill) => {
      const realSkill = elf.skills.find(s => s.name === skill.name);
      if (!realSkill) return false;
      if (isZeroPpExempt(elf, realSkill, opponent)) return true;
      const currentPP = realSkill.charge !== undefined ? realSkill.charge : (realSkill.pp || 0);
      return currentPP > 0;
    },
    isControlStatus: (status: string) => {
      const ctrl = ["害怕", "麻痺", "睡眠", "冰封", "疲憊", "癱瘓"];
      return ctrl.includes(status);
    },
    rng,
  };

  const scored = decideAction(ctx, deps);
  if (!scored) {
    const fallback = self.skills.find(s => (s.charge ?? s.pp) > 0);
    return {
      type: "skill",
      skill: fallback ? fallback : self.skills[0]
    };
  }

  const action = scored.action;
  switch (action.kind) {
    case "skill":
      return {
        type: "skill",
        skill: action.skill,
      };
    case "switch":
      // 額外精靈不可作為切換上場的對象；若 AI 誤選則改為使用技能
      if (team[action.index]?.isExtra) {
        const fb = self.skills.find(s => (s.charge ?? s.pp) > 0) || self.skills[0];
        return { type: "skill", skill: fb };
      }
      return {
        type: "switch",
        switchIndex: action.index,
      };
    case "item":
      return {
        type: "item",
        item: action.item,
      };
  }
};

export const pickAiForcedSwitch = (
  state: BattleState,
  side: 'p1' | 'p2',
  p1Suit?: string,
  p2Suit?: string,
  rng: () => number = Math.random
): number => {
  const self = side === 'p1' ? state.p1 : state.p2;
  const opponent = side === 'p1' ? state.p2 : state.p1;
  const team = side === 'p1' ? state.p1Team : state.p2Team;
  const activeIndex = side === 'p1' ? state.p1ActiveIndex : state.p2ActiveIndex;

  const canSwitch = team.some((elf, idx) => !elf.isExtra && (elf.currentHp > 0 || (elf.deathImmunity?.deathImmuneTurns ?? 0) > 0) && idx !== activeIndex);

  const ctx: AIContext = {
    self,
    opponent,
    team,
    activeIndex,
    items: BATTLE_ITEMS as BattleItem[],
    canSwitch,
    canUseItem: false,
    turnNumber: state.turnNumber,
  };

  const deps: AIDeps = {
    estimateDamage: (attacker: Elf, defender: Elf, skill: Skill) => {
      const res = calculateDamage(attacker, defender, skill, side, p1Suit, p2Suit, 1.0, false);
      return res.damage;
    },
    getTypeMatchup,
    getStatuses: (elf: Elf) => {
      return getStatuses(elf);
    },
    isSkillUsable: (elf: Elf, skill: Skill) => {
      const realSkill = elf.skills.find(s => s.name === skill.name);
      if (!realSkill) return false;
      if (isZeroPpExempt(elf, realSkill, opponent)) return true;
      const currentPP = realSkill.charge !== undefined ? realSkill.charge : (realSkill.pp || 0);
      return currentPP > 0;
    },
    isControlStatus: (status: string) => {
      const ctrl = ["害怕", "麻痺", "睡眠", "冰封", "疲憊", "癱瘓"];
      return ctrl.includes(status);
    },
    rng,
  };

  try {
    const bestIdx = decideForcedSwitch(ctx, deps);
    if (bestIdx !== -1 && team[bestIdx] && !team[bestIdx].isExtra) return bestIdx;
  } catch (err) {
    console.error("AI forced switch calculation error:", err);
  }

  // Safety Fallback to prevent getting stuck (額外精靈不可作為替補)
  const fallbackIdx = team.findIndex((elf, idx) => !elf.isExtra && (elf.currentHp > 0 || (elf.deathImmunity?.deathImmuneTurns ?? 0) > 0) && idx !== activeIndex);
  if (fallbackIdx !== -1) return fallbackIdx;
  return team.findIndex(elf => !elf.isExtra && (elf.currentHp > 0 || (elf.deathImmunity?.deathImmuneTurns ?? 0) > 0));
};
