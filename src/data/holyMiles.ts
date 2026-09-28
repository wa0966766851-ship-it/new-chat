import type { Elf, Skill } from "../types";

export const HOLY_MILES_ID = "5030";
export const HOLY_MILES_NAME = "聖靈邁爾斯";

const skill = (name: string, category: Skill["category"], power: number, pp: number, priority: number, description: string, fifth = false): Skill => ({
  name, type: category === "屬性" ? "無屬性" : "聖靈", category, power, pp,
  currentPp: pp, maxPp: pp, priority, accuracy: 100, isSureHit: true,
  isFifthSkill: fifth, effectType: "custom", effectDetail: "holy_miles", description,
});

export const HOLY_MILES_SKILLS: Skill[] = [
  skill("八荒憫淚", "屬性", 0, 5, 0, "必中；5回合內免疫並反彈所有受到的異常狀態；5回合內若對手使用攻擊技能則100%使對手疲憊；對手下2次使用屬性技能，則附加對手300點真實傷害；免疫下1次受到的攻擊"),
  skill("天佑聖障", "屬性", 0, 5, 0, "必中；全屬性+1，自身體力高於1/2時強化效果倍增；5回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍；使自身在接下來的2回合直接攻擊必定致命一擊；下2回合自身所有技能先制+3"),
  skill("四象靈獸", "特殊", 90, 20, 3, "必中；反轉自身能力下降狀態，反轉成功則100%依序令對手進入燒傷、凍傷、中毒、麻痺；吸取對手能力提升狀態，吸取成功則下2次自身造成的攻擊傷害翻倍；自身下2次受到技能傷害，則回饋給對手等同於自身雙防值總和65%的真實傷害"),
  skill("淨世洗禮頌", "特殊", 90, 20, 3, "本次造成技能傷害不少於280，技能無效時效果翻倍1次，對方在場精靈體力每有10%則額外執行1次翻倍；給對手造成技能傷害時，傷害數值的100%恢復自身體力，若對手處於異常狀態則附加對手等量百分比傷害；3回合內若對手使用屬性技能100%燒傷"),
  skill("聖靈乾坤斷", "特殊", 160, 5, 1, "必中；消除對手回合類效果，消除成功則攻擊+2、速度+2、命中+2；2回合內對手使用的屬性技能無效；吸取對手200點固定體力，每次使用額外附加100點，最高500點；吸取對手所有技能1點PP值，若吸取後對手所選擇的技能PP值為0，則當回合對手無法行動且受到300點真實傷害", true),
];

export const HOLY_MILES_SEED: Omit<Elf, "calculatedStats" | "currentHp" | "maxHp"> = {
  id: HOLY_MILES_ID, name: HOLY_MILES_NAME, type: "聖靈", level: 100,
  seerId: 1204, height: 178, weight: 87, gender: "雄性",
  baseStats: { hp: 194, atk: 158, spatk: 60, def: 134, spdef: 134, speed: 135 },
  soulMark: {
    name: "聖", effectType: "custom", effectValue: 0,
    description: `【四象】自身專屬特性中每次額外執行效果觸發時若自身同時處於異常狀態則下次執行回合開始時效果則額外解除其中的控制類、弱化類異常且當回合對手先制效果失效；
【八荒】自身每次受到非真實傷害時減半1次，回合開始時自身每有最大體力10%的當前體力值則額外減半1次；
【天佑】回合結束時恢復自身最大體力10%並造成對手等量百分比傷害，自身已損失體力每有最大體力10%則額外執行1次；
【聖怒】自身使用攻擊技能時吸取對手等同於自身最大體力10%的體力值，若對手受到百分比傷害後體力未減少則本回合受到攻擊技能所造成的技能傷害翻倍1次，對方所有精靈中體力比例最高的精靈最大體力每有10%的當前體力值則額外翻倍1次。`,
  },
  skills: HOLY_MILES_SKILLS.map(s => ({ ...s })),
  skillPool: HOLY_MILES_SKILLS.map(s => ({ ...s })),
};
