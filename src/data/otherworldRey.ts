import type { Elf, Skill } from "../types";
import { reyGodDescentRule } from "../battle/survivalRules";

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
    "■ 先制+4\n■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 吸取對手等同於自身本次造成技能傷害70%的體力值，先出手時效果翻倍，任一方處於能力提升狀態時變為3倍\n🎯 令對手7回合內攻擊技能威力為1/70（綁定對手）\n🎯 2回合內對手攻擊技能無效",
    { priority: 4, isSureHit: true },
  ),
  skill(
    "異境神霆",
    "神秘.電",
    "特殊",
    40,
    10,
    "■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 1回合內對手受到技能傷害不小於300×電系、神秘系、神秘·電系中克制倍數最高的值\n🎯 5回合內吸取對手最大體力1/2，吸取後未擊敗對手則回合結束時吸取對手最大體力1/3；前述效果造成百分比傷害時，若對手體力未減少或自身體力未增加，則額外附加對手210點真實傷害\n🎯 令自身下2回合造成非真實傷害提升210%\n🎯 下2回合自身所有技能先制+3",
    { isSureHit: true },
  ),
  skill(
    "同塵祭",
    "暗影",
    "物理",
    40,
    10,
    "■ 必中\n🎯 調整自身能力等級，令自身能力等級不會小於對手\n🎯 令自身體力歸1\n🎯 7回合內對手PP值消耗量為7倍\n🎯 對手每有1點重量，則失去1點體力上限與1點相應異能值，最多70",
    { isSureHit: true },
  ),
  skill(
    "天雷誅殺",
    "電",
    "物理",
    120,
    20,
    "■ 先制+4\n■ 必中\n🎯 令對手全屬性+1，對手處於能力提升狀態則額外令對手全屬性+1\n🎯 出手時令對手本次受到非真實傷害提升70%，先出手時效果翻倍，任一方處於能力提升狀態時變為3倍\n🎯 吸取對手70點體力\n🎯 2回合對手屬性技能無效",
    { priority: 4, isSureHit: true },
  ),
  skill(
    "霆·禁雷敕令",
    "無屬性",
    "屬性",
    0,
    0,
    "■ 自身體力低於210則必定先手\n■ 自身處於麻痺狀態時轉化為威力210的攻擊技能且無視對手免疫效果；對手每擁有70點重量則攻擊威力額外提升70；攻擊類型為雙攻中較高者，兩者相同則轉化失效；技能屬性取電系、神秘系、神秘·電系中克制倍數最高的值\n🎯 附加對手自身已損失體力70%的真實傷害；附加時若自身體力低於0則改為附加自身體力上限70%的真實傷害\n🎯 消除對手回合類效果，消除成功則下2回合受到傷害翻倍\n🎯 自身體力低於最大體力1/3時則造成技能傷害提升3倍\n🎯 未擊敗對手則下2回合自身所有技能先制+2",
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
    description: `【回合開始時】
複製對手能力提升狀態。
複製成功則令自身麻痺。
若對手不處於能力提升狀態，則令自身攻擊、速度、命中+2，當回合自身所有技能先制+1。

【觸發效果】
自身將對手能力提升狀態視為同等級2倍能力下降狀態。
自身回合類效果無法被消除。
對手每次回合類效果開始時變為1回合。
觸發成功則當回合令自身麻痺。
每減少1回合令自身麻痺回合數+1。
自身能力提升/下降等級狀態被改變時，令雙方100%麻痺，麻痺狀態增加7回合。

【自身處於異常狀態時】
當回合戰鬥階段結束時恢復所有技能7點PP值。
若處於麻痺異常狀態，則額外令自身所處的異常狀態效果附帶效果失效（仍然處於異常），改為造成技能傷害提升70%。

【使用攻擊技能時】
吸取對手雙方能力等級總和×70的體力值。
吸取前若自身處於異常狀態，則汲取對手等同於自身當前重量的體力值，且上述吸取體力改為汲取體力。`,
  },
  alienTraits: {
    gen2Trait: { name: "電氣纏繞", description: `攻擊威力提升70%。
使用技能後令對手進入麻痺狀態。
對手使用攻擊技能時令對手最終攻擊/特攻值變為面板原始值的70%。` },
    exclusiveTraits: [
      { name: "神明", description: `戰鬥中被視為異能精靈。
自身存活條件不受當前體力限制。
自身當前體力歸0時進入「神降」。` },
      { name: "雷神", description: `【自身為滿體力時】
登場異能值消耗降低70%（特殊模式生效）。

【自身不為滿體力時】
若當前處於麻痺狀態且不小於7回合時自身使用技能不受PP值限制。
體力每降低1%則雙攻值與雙防值在雙方計算傷害時額外提升1%，當回合戰鬥階段結束時失去該加成，最高70%。
體力每降低1%則自身造成非真實傷害提升1%，最高70%。
使用攻擊技能會以雙攻值總和視為當前攻擊/特攻值計算傷害。
物理攻擊時恢復己方至少70點體力值，自身每增加1點體力，己方不在場精靈額外恢復1體力。
特殊攻擊時令對手先制-1。

【神降效果】
令自身死亡時的體力下限不再為0，改為70乘以（-自身體力上限）為體力下限。
自身恢復體力量降低100%，改為每次執行恢復體力效果時令自身增加等同於自身最大體力的70%。
自身每次受到非真實傷害時免疫此傷害，並令扣除自身體力上限70%的體力值。
自身每次受到真實傷害時，正常結算傷害。
回合結束時若當回合未受到非真實傷害，則增加自身最大體力7%的體力值。
並開始觸發上列效果，直到自身體力恢復為正數時結束神降。
神降狀態下場後保留。` },
    ],
  },
  skills: OTHERWORLD_REY_SKILL_LIST.map((entry) => ({ ...entry })),
  skillPool: OTHERWORLD_REY_SKILL_LIST.map((entry) => ({ ...entry })),
};

