import { BaseStats } from "../types";
import { TITLE_CATALOG } from "./titles";

export interface SuitDefinition {
  id: string;
  name: string;
  description: string;
  statBonus?: Partial<BaseStats>;
  percentBonus?: Partial<BaseStats>;
  oppStatDebuff?: Partial<BaseStats>;
  oppPercentDebuff?: Partial<BaseStats>;
  badge?: string;
  effects?: {
    damageDealtMultiplier?: number;       // 造成攻擊傷害倍率，如1.4代表+40%
    damageTakenMultiplier?: number;       // 受到攻擊傷害倍率
    critRateBonus?: number;               // 致命一擊機率加成(0-1)
    guaranteedCritOnFirstAttack?: boolean;// 首次攻擊必定致命
    guaranteedCritOnEntranceTurn?: boolean;// 登場回合必定致命
    starterShield?: number;               // 首發精靈初始護盾
    reflectDamagePercent?: number;        // 受擊反射傷害比例
    healPercentOnTurnEnd?: number;        // 回合結束回復最大體力比例
    elementalDamageBonus?: { element: string; multiplier: number }; // 特定屬性傷害加成
    statusChanceOnHit?: { status: string; chance: number; duration?: number }; // 命中後機率附加異常
    ignoreDefSpdefFlat?: number;          // 無視對手固定點數的防禦/特防
    ignoreDefSpdefPercent?: number;       // 無視對手百分比的防禦/特防
    fixedDamageOnHit?: number;            // 命中後附加固定傷害
    critRateBonusPerStack?: number;       // 每層疊加的致命機率(如1/16)
    maxCritRateStacks?: number;           // 最高疊加層數
    critDamageMultiplier?: number;        // 致命一擊時的額外傷害倍率(如1.15)
    hasCustomHandler?: boolean;           // 標記此套裝需要走 SuitEffectRegistry
  };
}

export interface EyewearDefinition {
  id: string;
  name: string;
  description: string;
  statBonus?: Partial<BaseStats>;
  badge?: string;
}

export const SUIT_CATALOG: Record<string, SuitDefinition> = {
  dark_angel: {
    id: "dark_angel",
    name: "漆黑天使",
    badge: "漆黑",
    description: "背包內所有精靈全屬性+50，造成的攻擊傷害提升40%；己方的首發精靈獲得300點護盾且首次攻擊必定打出致命一擊。",
    statBonus: { hp: 50, atk: 50, def: 50, spatk: 50, spdef: 50, speed: 50 },
    effects: {
      damageDealtMultiplier: 1.4,
      starterShield: 300,
      guaranteedCritOnFirstAttack: true
    }
  },
  morning_star: {
    id: "morning_star",
    name: "晨曦之星戰甲",
    badge: "晨曦",
    description: "背包內所有精靈速度、體力+60，回合開始時若己方在場精靈不處於異常狀態則當回合忽略對手10點速度；己方在場精靈造成的攻擊傷害提升10%且自身攻擊後附加100點固定傷害，體力高於1/2時效果翻倍；己方在場精靈受到的攻擊傷害減少10%且對手攻擊後自身恢復100點體力，體力低於1/2時效果翻倍。",
    statBonus: { hp: 60, speed: 60 },
    effects: {
      damageDealtMultiplier: 1.1,
      damageTakenMultiplier: 0.9,
      hasCustomHandler: true
    }
  },
  sky_cloud: {
    id: "sky_cloud",
    name: "天光雲影戰甲",
    badge: "天光",
    description: "背包內所有精靈全屬性+65；雙方任意一方精靈登場的回合己方精靈攻擊必定打出致命一擊；己方在場精靈攻擊結束時，若本次攻擊打出了致命一擊則令對手當回合體力恢復效果減少75%，若未打出致命一擊則附加對手已損失體力值25%的百分比傷害，若未造成傷害則上述效果同時觸發。",
    statBonus: { hp: 65, atk: 65, def: 65, spatk: 65, spdef: 65, speed: 65 },
  },
  venom_armor: {
    id: "venom_armor",
    name: "毒液戰甲",
    badge: "毒液",
    description: "遊戲首回合開始時，令對手背包內精靈本場戰鬥防禦值-15%、特防值-15%、速度-10%；令對手在場精靈恢復體力時恢復效果減少30%（體力藥劑除外）；己方精靈使用攻擊技能30%附加對手最大體力15%的百分比傷害，若對手未受到該百分比傷害則當回合造成的攻擊傷害提升30%。",
    oppPercentDebuff: { def: -15, spdef: -15, speed: -10 },
  },
  future_armor: {
    id: "future_armor",
    name: "未來戰甲",
    badge: "未來",
    description: "背包內精靈全屬性+10%；背包內每死亡1隻精靈則自身攻擊命中後有1%的機率瞬殺對手。",
    percentBonus: { hp: 10, atk: 10, def: 10, spatk: 10, spdef: 10, speed: 10 },
    effects: {
      hasCustomHandler: true
    }
  },
  corrupter: {
    id: "corrupter",
    name: "腐蝕者套裝",
    badge: "腐蝕",
    description: "背包內精靈攻擊+10%、特攻+10%；所有攻擊技能忽略對手防禦值和特防值的15%；對方使用攻擊技能則使對手在場精靈下回合開始時麻痺1回合，未觸發則附加對方等同於對方最大體力1/6的百分比傷害",
    percentBonus: { atk: 0.10, spatk: 0.10 },
    effects: {
      ignoreDefSpdefPercent: 0.15,
      hasCustomHandler: true
    }
  },
  space_time: {
    id: "space_time",
    name: "時空戰甲套裝",
    badge: "時空",
    description: "速度+11%；每回合有10%的機率使登場精靈免疫異常狀態，未觸發則使自身下1次受到的攻擊傷害、固定傷害和百分比傷害減少30%同時使自身本次戰鬥免疫異常狀態的機率提高5%（最高30%）；受到攻擊時吸取對手當前體力的1/5。",
    percentBonus: { speed: 11 },
    effects: {
      hasCustomHandler: true
    }
  },
  proud_peak: {
    id: "proud_peak",
    name: "笑傲巔峰套裝",
    badge: "笑傲",
    description: "背包內精靈全屬性+10%；己方精靈造成的致命一擊傷害提升15%；攻擊技能有1/16的機率打出致命一擊，每次使用增加1/16，最高4/16，未打出致命一擊則造成傷害前附加自身最大體力13%的百分比傷害。",
    percentBonus: { hp: 10, atk: 10, def: 10, spatk: 10, spdef: 10, speed: 10 },
    effects: {
      critRateBonusPerStack: 1/16,
      maxCritRateStacks: 3,
      critDamageMultiplier: 1.15,
      hasCustomHandler: true
    }
  },
  phoenix_wings: {
    id: "phoenix_wings",
    name: "浴火之翼套裝",
    badge: "浴火",
    description: "背包內精靈攻擊+13%、特攻+13%、速度+8%；每次攻擊技能命中後附加對手最大體力5%的百分比傷害，最多疊加6次；每次屬性技能生效後使自身造成的攻擊傷害提升10%，最多疊加3次。",
    percentBonus: { atk: 13, spatk: 13, speed: 8 },
    effects: {
      hasCustomHandler: true
    }
  },
  emperor_armor: {
    id: "emperor_armor",
    name: "皇帝戰鎧套裝",
    badge: "皇帝",
    description: "背包內精靈造成的攻擊傷害提升40%，所有攻擊技能致命一擊機率提升1/8。",
    effects: {
      damageDealtMultiplier: 1.4,
      critRateBonus: 0.125
    }
  },
  silver_knight: {
    id: "silver_knight",
    name: "銀翼騎士套裝",
    badge: "銀翼",
    description: "背包內精靈造成的攻擊傷害提升30%；先出手時傷害再額外提升30%（先出手的額外增傷效果與基礎增傷效果為加法結算，即先出手時傷害總共提升60%）。",
    effects: {
      damageDealtMultiplier: 1.3,
      hasCustomHandler: true
    }
  },
  destiny_armor: {
    id: "destiny_armor",
    name: "勝天之命戰甲",
    badge: "勝天",
    description: "背包內所有精靈雙攻+75、速度+65；登場或技能累積【勝天之力】，每層增傷4%、固定與百分比減傷2%(最多疊加10層，下場不保留)；使用攻擊技能後若傷害<300則吸取對手最大體力2%×層數，若>=300則附加傷害4%×層數的百分比傷害。",
    statBonus: { atk: 75, spatk: 75, speed: 65 },
    effects: {
      hasCustomHandler: true
    }
  },
  imperial_armor: {
    id: "imperial_armor",
    name: "皇御神臨戰甲",
    badge: "皇御",
    description: "背包內所有精靈雙防+55、速度+55、體力+105；受到攻擊傷害低於300附加300固傷，不低於300下1次增傷40%(切換延續)；登場首回合受擊回血1/4；若當回合未受到攻擊則下回合使用攻擊技能後附加最大體力15%百分比傷害。",
    statBonus: { def: 55, spdef: 55, speed: 55, hp: 105 },
    effects: {
      hasCustomHandler: true
    }
  },
  eternal_starlight: {
    id: "eternal_starlight",
    name: "星光永恆套裝",
    badge: "星恆",
    description: "全屬性+11%，對手使用攻擊技能則對手造成傷害前忽略對手雙攻值11%，若本次攻擊為對手先出手則額外為自身附加星賜，若自身已處於異常狀態則改為將自身所處異常狀態轉化為星賜，若本次攻擊為對手後出手則額外為自身附加星哲，若自身已處於異常狀態則改為將自身所處異常狀態轉化為星哲；戰鬥階段結束時，自身處於擁有n種異常狀態則額外令自身異常回合數-n，最多減至1回合，下回合回合開始時令對手進入沉睡異常狀態n+1回合，未觸發則自身下次使用攻擊技能則使用後附加111點真實傷害。星賜：處於該異常狀態造成攻擊傷害提升30%，每回合恢復2點PP值。星哲：處於該異常狀態造成固定傷害、百分比傷害提升30%，每回合恢復最大體力1/4。沉睡：無法行動，受到爆擊轉為睡眠，結束後隨機轉為睡眠1-3回合。睡眠：無法行動，受到攻擊解除。",
    percentBonus: { hp: 11, atk: 11, def: 11, spatk: 11, spdef: 11, speed: 11 },
    effects: {
      hasCustomHandler: true
    }
  },
  starlight_guardian: {
    id: "starlight_guardian",
    name: "星光守護者",
    badge: "星守",
    description: "己方背包內精靈防禦、特防+100；戰鬥階段結束時恢復自身100點體力，若自身體力低於最大體力1/2則恢復量翻倍",
    statBonus: { def: 100, spdef: 100 },
    effects: {
      hasCustomHandler: true
    }
  },
  berserker: {
    id: "berserker",
    name: "狂暴者套裝",
    badge: "狂暴",
    description: "己方精靈全屬性+115，己方精靈每次攻擊造成傷害前有15%機率令自身本次攻擊後秒殺對手，未觸發則造成傷害前令自身進入狂暴狀態且本次攻擊技能使用後附加115點真實傷害；己方精靈受到攻擊傷害、固定傷害、百分比傷害減少15%，處於狂暴狀態時效果翻倍且當回合使用技能不消耗技能PP值；戰鬥階段結束後恢復自身最大體力15%與所有技能1點PP值，自身處於狂暴狀態下效果翻倍。狂暴：造成攻擊傷害提升100%。",
    statBonus: { hp: 115, atk: 115, def: 115, spatk: 115, spdef: 115, speed: 115 },
    effects: {
      hasCustomHandler: true
    }
  },
  void_traveler: {
    id: "void_traveler",
    name: "虛空旅者戰甲",
    badge: "虛空",
    description: "己方背包內精靈速度+80；使用攻擊技能時忽略對方雙防值50點；使用屬性技能後有20%機率令對手隨機進入一種異常狀態3回合",
    statBonus: { speed: 80 },
    effects: {
      ignoreDefSpdefFlat: 50,
      hasCustomHandler: true
    }
  },
  nuclear_armor: {
    id: "nuclear_armor",
    name: "核能機甲",
    badge: "核能",
    description: "己方背包內精靈防禦、特防+120；受到攻擊傷害時反彈對方在場精靈等同於傷害值15%百分比傷害；自身體力低於最大體力1/3時，計算攻擊技能所造成的技能傷害時最終雙防值提升至基礎值的2倍(條件未滿足時失去該加成)",
    statBonus: { def: 120, spdef: 120 },
    effects: {
      hasCustomHandler: true
    }
  },
  shadow_slayer: {
    id: "shadow_slayer",
    name: "影之獵殺者",
    badge: "影獵",
    description: "己方背包內精靈攻擊、特攻+100；自身先出手時，本次攻擊技能必定命中，且額外附加自身最大體力15%的百分比傷害",
    statBonus: { atk: 100, spatk: 100 },
    effects: {
      hasCustomHandler: true
    }
  },
  crystal_barrier: {
    id: "crystal_barrier",
    name: "水晶之盾套裝",
    badge: "水晶",
    description: "己方背包內精靈體力+150；每次受到超過250點的技能傷害時，有20%機率抵擋本次技能傷害",
    statBonus: { hp: 150 },
    effects: {
      hasCustomHandler: true
    }
  },
  inferno_mecha: {
    id: "inferno_mecha",
    name: "烈焰機甲",
    badge: "烈焰",
    description: "己方背包內精靈攻擊+120；使用火屬性攻擊技能造成的技能傷害提升25%；攻擊技能命中後100%機率令對手進入燒傷狀態3回合",
    statBonus: { atk: 120 },
    effects: {
      elementalDamageBonus: { element: "火", multiplier: 1.25 },
      statusChanceOnHit: { status: "燒傷", chance: 1.0, duration: 3 }
    }
  },
  abyssal_walker: {
    id: "abyssal_walker",
    name: "深淵漫步者",
    badge: "深淵",
    description: "全隊體力+100，每回合結束後恢復5%最大體力；防禦、特防+50。",
    statBonus: { hp: 100, def: 50, spdef: 50 },
    effects: {
      healPercentOnTurnEnd: 0.05
    }
  },
  fate_defier: {
    id: "fate_defier",
    name: "逆命者戰甲",
    badge: "逆命",
    description: "對手攻擊、特攻-100，速度-10%，己方精靈若當回合對對手當前精靈克制倍數低於1倍時令其提升為1倍且技能使用後吸取對手最大體力10%，高於1倍時則自身當回合使用技能不消耗技能PP值且使用技能後令對手疲憊；戰鬥階段結束後令己方所有精靈本場戰鬥造成攻擊額外傷害提升10%且之後使用技能額外附加10點真實傷害，最多疊加至攻擊額外傷害提升100%，真實傷害最高疊加為100(永久保留、延續到所有精靈)。",
    oppStatDebuff: { atk: -100, spatk: -100 },
    oppPercentDebuff: { speed: -10 },
    effects: {
      hasCustomHandler: true
    }
  },
  shadow_judgment: {
    id: "shadow_judgment",
    name: "影翼裁決套裝",
    badge: "影翼",
    description: "背包內所有精靈攻擊、特攻+60、速度+80，造成的攻擊傷害提升40%；登場首回合若自身未被擊敗則自身每損失10%的體力，獲得50點護罩，最高300點，然後自身每有50點護罩本次在場自身造成的攻擊傷害提升10%，最高提升40%；回合開始時，若自身沒有護罩，則自身受到的固定傷害、百分比傷害減少5%，自身的體力值每下降15%，效果提升5%，最高25%。",
    statBonus: { atk: 60, spatk: 60, speed: 80 },
    effects: {
      damageDealtMultiplier: 1.4,
      hasCustomHandler: true
    }
  },
  holy_sanctuary: {
    id: "holy_sanctuary",
    name: "聖芒佑界套裝",
    badge: "聖芒",
    description: "己方精靈體力+100點，其他能力+80點；己方在場精靈抗性中的唯一最高項觸發機率提升至100%，其餘項機率減少至0%；自身進入的異常狀態最高為2回合；自身異常抗性觸發時，恢復自身最大體力的30%，每生效1次比例減少5%，下場時重置。（因異常抗性沒有實裝，現僅作為佔位符號，受到異常觸發並降低比例直到歸0）。",
    statBonus: { hp: 100, atk: 80, def: 80, spatk: 80, spdef: 80, speed: 80 },
    effects: {
      hasCustomHandler: true
    }
  },
};

export const EYEWEAR_CATALOG: Record<string, EyewearDefinition> = {
  roamer_as: {
    id: "roamer_as",
    name: "漫遊者-AS",
    badge: "AS",
    description: "背包內全體精靈攻擊+30點、特攻+30點、速度+15點",
    statBonus: { atk: 30, spatk: 30, speed: 15 },
  },
  roamer_ah: {
    id: "roamer_ah",
    name: "漫遊者-AH",
    badge: "AH",
    description: "背包內全體精靈攻擊+30點、特攻+30點、體力+40點",
    statBonus: { atk: 30, spatk: 30, hp: 40 },
  },
  roamer_s: {
    id: "roamer_s",
    name: "漫遊者-S",
    badge: "S",
    description: "背包內全體精靈速度+20點",
    statBonus: { speed: 20 },
  },
  hanged_mask: {
    id: "hanged_mask",
    name: "倒吊的假面",
    badge: "假面",
    description: "背包內精靈攻擊+25點、特攻+25點",
    statBonus: { atk: 25, spatk: 25 },
  },
  demon_wind: {
    id: "demon_wind",
    name: "魔界之風",
    badge: "魔界",
    description: "背包內精靈防禦+25點、特防+25點、速度+15點",
    statBonus: { def: 25, spdef: 25, speed: 15 },
  },
};

export function applyEquipmentToElfStats(
  stats: BaseStats,
  suitId?: string,
  eyewearId?: string,
  oppSuitId?: string,
  titleId?: string
): BaseStats {
  const suit = suitId ? SUIT_CATALOG[suitId] : undefined;
  const eyewear = eyewearId ? EYEWEAR_CATALOG[eyewearId] : undefined;
  const oppSuit = oppSuitId ? SUIT_CATALOG[oppSuitId] : undefined;
  const title = titleId ? TITLE_CATALOG[titleId] : undefined;

  const calcStat = (stat: keyof BaseStats) => {
    let base = stats[stat] || 1;
    let flatAdd = (suit?.statBonus?.[stat] || 0) + (eyewear?.statBonus?.[stat] || 0) + (title?.statBonus?.[stat] || 0);
    let flatSub = oppSuit?.oppStatDebuff?.[stat] || 0; // oppStatDebuff is already negative like -100
    
    let percentAdd = suit?.percentBonus?.[stat] || 0; // e.g. 10 for 10%
    let percentSub = oppSuit?.oppPercentDebuff?.[stat] || 0; // e.g. -15 for -15%

    let val = base + flatAdd + flatSub;
    if (percentAdd !== 0) val = val * (1 + percentAdd / 100);
    if (percentSub !== 0) val = val * (1 + percentSub / 100);

    return Math.max(1, Math.floor(val));
  };

  return {
    hp: calcStat("hp"),
    atk: calcStat("atk"),
    def: calcStat("def"),
    spatk: calcStat("spatk"),
    spdef: calcStat("spdef"),
    speed: calcStat("speed"),
  };
}

export function applyEquipmentToTeam(
  team: any[],
  suitId?: string,
  eyewearId?: string,
  oppSuitId?: string,
  titleId?: string
): any[] {
  if (!team || team.length === 0) return [];
  return team.map((elf) => {
    const cloned = JSON.parse(JSON.stringify(elf));
    if (!cloned.calculatedStats) {
      cloned.calculatedStats = {
        hp: cloned.maxHp || 100,
        atk: 100,
        def: 100,
        spatk: 100,
        spdef: 100,
        speed: 100,
      };
    }
    const eqStats = applyEquipmentToElfStats(cloned.calculatedStats, suitId, eyewearId, oppSuitId, titleId);
    cloned.calculatedStats = eqStats;
    cloned.maxHp = eqStats.hp;
    cloned.currentHp = eqStats.hp;
    return cloned;
  });
}

