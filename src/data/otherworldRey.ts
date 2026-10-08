import type { Elf, Skill } from "../types";
import { reyGodDescentRule } from "../battle/survivalRules";
import { OTHERWORLD_REY_TEXT } from "./otherworldReyDescriptions";

export const OTHERWORLD_REY_ID = "5029";
export const OTHERWORLD_REY_NAME = "異境神霆·雷伊";

const skill = (
  name: string,
  type: string,
  category: Skill["category"],
  power: number,
  pp: number,
  description: string,
  extra: Partial<Skill> = {},
): Skill => ({
  name,
  type,
  category,
  power,
  pp,
  currentPp: pp,
  maxPp: pp,
  accuracy: 100,
  description,
  effectType: "custom",
  effectDetail: "otherworld_rey",
  ...extra,
});

export const OTHERWORLD_REY_SKILL_LIST: Skill[] = [
  skill(
    "空墟赫星",
    "神秘",
    "特殊",
    120,
    20,
    OTHERWORLD_REY_TEXT.skills["空墟赫星"],
    { priority: 4, isSureHit: true },
  ),
  skill(
    "異境神霆",
    "神秘.電",
    "特殊",
    40,
    10,
    OTHERWORLD_REY_TEXT.skills["異境神霆"],
    { isSureHit: true },
  ),
  skill(
    "同塵祭",
    "暗影",
    "物理",
    40,
    10,
    OTHERWORLD_REY_TEXT.skills["同塵祭"],
    { isSureHit: true },
  ),
  skill(
    "天雷誅殺",
    "電",
    "物理",
    120,
    20,
    OTHERWORLD_REY_TEXT.skills["天雷誅殺"],
    { priority: 4, isSureHit: true },
  ),
  skill(
    "霆·禁雷敕令",
    "無屬性",
    "屬性",
    0,
    0,
    OTHERWORLD_REY_TEXT.skills["霆·禁雷敕令"],
    { isFifthSkill: true },
  ),
];

/**
 * 第五技能的兩個隱藏轉化型態。不放入可選技能欄；引擎在技能執行前依條件取用。
 * 附加效果仍由原技能 handler 執行，避免轉化型態重複結算。
 */
export const OTHERWORLD_REY_TRANSFORM_SKILLS = {
  physical: skill(
    "霆·禁雷敕令·神罰",
    "神秘.電",
    "物理",
    210,
    0,
    "【霆·禁雷敕令】的物理轉化型態；無視對手攻擊免疫效果。",
    { isFifthSkill: true, isInherent: true },
  ),
  special: skill(
    "霆·禁雷敕令·神譴",
    "神秘.電",
    "特殊",
    210,
    0,
    "【霆·禁雷敕令】的特殊轉化型態；無視對手攻擊免疫效果。",
    { isFifthSkill: true, isInherent: true },
  ),
} as const;

export type ElfSeed = Omit<Elf, "calculatedStats" | "currentHp" | "maxHp">;

export const OTHERWORLD_REY_SEED: ElfSeed = {
  id: OTHERWORLD_REY_ID,
  name: OTHERWORLD_REY_NAME,
  type: "神秘.電",
  level: 100,
  height: 185,
  weight: 70,
  gender: "雄性",
  path: "otherworld_thunder_rey",
  artPresentation: "scene",
  suppressAbnormalSideEffectsWhenParalyzed: true,
  ppLimitIgnoredWhenParalyzedTurns: 7,
  useAtkSpAtkSumForAttacks: true,
  treatOpponentBoostAsDoubleDrop: true,
  ownTurnEffectsUnclearable: true,
  collapseOpponentTurnEffectsToOne: true,
  paralyzeBothOnOwnStatChangeTurns: 7,
  category: "異能精靈",
  isAlienElf: true,
  // maxHp 會在進場重算；minHp 由戰鬥開始時依實際 maxHp 更新。
  survivalRule: reyGodDescentRule(0),
  baseStats: { hp: 120, atk: 170, spatk: 170, def: 125, spdef: 125, speed: 140 },
  soulMark: {
    name: "異",
    effectType: "custom",
    effectValue: 0,
    description: OTHERWORLD_REY_TEXT.soul,
  },
  alienTraits: {
    gen2Trait: { name: "電氣纏繞", description: OTHERWORLD_REY_TEXT.gen2 },
    exclusiveTraits: [
      { name: "神明", description: OTHERWORLD_REY_TEXT.god },
      { name: "雷神", description: OTHERWORLD_REY_TEXT.thunder },
    ],
  },
  skills: OTHERWORLD_REY_SKILL_LIST.map((entry) => ({ ...entry })),
  skillPool: OTHERWORLD_REY_SKILL_LIST.map((entry) => ({ ...entry })),
};

