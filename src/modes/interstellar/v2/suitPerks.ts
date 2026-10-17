/**
 * 套裝的回廊特權：只作用於星蝕回廊的跑圖層（資源、招募令、商店、星爐、蝕度、開戰前準備），不改變套裝本身的戰鬥效果。
 * 點數預算：強戰鬥套裝 1.0、中等 1.5、輔助 2.0（見 perkCost，測試鎖定）。
 * 每套至少有 1 項「招牌功能」（特徵鍵 perkKeys 全局唯一），不得與他套相同。N12 起所有特權失效。
 */
export interface Perk {
  beans?: number; potions?: number;
  /** 起始任意招募令 +n */ anyTokens?: number;
  /** 起始單屬性招募令（含複合屬性） */ typeToken?: string;
  /** 起始雙屬性招募令（屬性恰為這兩個） */ dualToken?: [string, string];
  /** 起始重複招募令 +n */ repeatTokens?: number;
  /** 招募令可選強度上限 +1 階 */ tokenTierUp?: boolean;
  /** 重複招募強化層數上限 +n */ dupCap?: number;
  /** 禁用名額 +n */ banBonus?: number;
  /** 每章第一場戰鬥：全隊護盾 */ openShield?: boolean;
  /** 商店每層免費刷新 1 次 */ freeReroll?: boolean;
  /** 首領戰前全隊回滿體力與 PP */ bossHeal?: boolean;
  /** 戰敗一次保留隊伍（每局一次） */ lifeline?: boolean;
  shopMult?: number; restHealMult?: number; eclipsePerMove?: number;
  revealMystery?: boolean; eliteRelicChoice?: number; extraRewardChoice?: number;
  expMult?: number; beansMult?: number;
}
export type PerkTier = "strong" | "mid" | "support";
export const PERK_BUDGET: Record<PerkTier, number> = { strong: 1, mid: 1.5, support: 2 };
/** 每章首戰護盾的基礎值（隨層數以 √depthMul 縮放） */
export const OPEN_SHIELD_BASE = 400;
/** 各特權的點數成本（線性；乘數類以偏離程度換算） */
export function perkCost(p: Perk): number {
  return (p.anyTokens ?? 0) * 1 + (p.typeToken ? .5 : 0) + (p.dualToken ? .75 : 0) + (p.repeatTokens ?? 0) * 1.5 + (p.tokenTierUp ? .75 : 0)
    + (p.dupCap ?? 0) * .5 + (p.banBonus ?? 0) * .5 + (p.openShield ? .75 : 0) + (p.freeReroll ? .5 : 0) + (p.bossHeal ? 1 : 0) + (p.lifeline ? 1.5 : 0)
    + (p.potions ?? 0) * .5 + (p.beans ?? 0) / 60 * .5
    + (p.shopMult ? (1 - p.shopMult) / .1 : 0) + (p.restHealMult ? (p.restHealMult - 1) / .25 * .75 : 0)
    + (p.eclipsePerMove ? -p.eclipsePerMove : 0) + (p.revealMystery ? 1.5 : 0)
    + (p.eliteRelicChoice ?? 0) + (p.extraRewardChoice ?? 0) * 1.5 + (p.expMult ? p.expMult / .15 * .5 : 0) + (p.beansMult ? p.beansMult / .15 * .5 : 0);
}
/** 特徵鍵（含參數）：用來檢查每套至少有一項不與他套重複的功能。 */
export function perkKeys(p: Perk): string[] {
  const k: string[] = [];
  if (p.anyTokens) k.push(`anyTokens:${p.anyTokens}`);
  if (p.typeToken) k.push(`typeToken:${p.typeToken}`);
  if (p.dualToken) k.push(`dualToken:${[...p.dualToken].sort().join("+")}`);
  if (p.repeatTokens) k.push(`repeatTokens:${p.repeatTokens}`);
  for (const f of ["tokenTierUp", "openShield", "freeReroll", "bossHeal", "lifeline", "revealMystery"] as const) if (p[f]) k.push(f);
  for (const f of ["dupCap", "banBonus", "eliteRelicChoice", "extraRewardChoice", "shopMult", "restHealMult", "eclipsePerMove", "expMult", "beansMult", "potions", "beans"] as const) if (p[f]) k.push(`${f}:${p[f]}`);
  return k;
}
/** 簡短標籤＋說明（說明放 tooltip，不佔介面）。 */
export function perkItems(p: Perk): { text: string; tip?: string }[] {
  const t: { text: string; tip?: string }[] = [];
  const add = (text: string, tip?: string) => t.push({ text, tip });
  if (p.anyTokens) add(`起始任意招募令 +${p.anyTokens}`, "開局多一張任意招募令：免費招募一次任一精靈");
  if (p.typeToken) add(`起始${p.typeToken}系招募令`, `開局附贈一張${p.typeToken}系招募令：免費招募一次${p.typeToken}系精靈（含複合屬性）`);
  if (p.dualToken) add(`起始${p.dualToken.join("/")}雙屬性令`, `開局附贈一張雙屬性招募令：免費招募一次屬性恰為${p.dualToken.join("＋")}的精靈`);
  if (p.repeatTokens) add(`起始重複招募令 +${p.repeatTokens}`, "開局附贈重複招募令：免費進階一次（全能力 +40%，或戰鬥 PP×2）");
  if (p.tokenTierUp) add("招募令強度上限 +1 階", PERK_TIPS.tokenTierUp);
  if (p.dupCap) add(`重複招募上限 +${p.dupCap} 層`, PERK_TIPS.dupCap);
  if (p.banBonus) add(`禁用名額 +${p.banBonus}`, PERK_TIPS.banBonus);
  if (p.openShield) add("每章首戰全隊護盾", PERK_TIPS.openShield);
  if (p.freeReroll) add("商店每層免費刷新 1 次", PERK_TIPS.freeReroll);
  if (p.bossHeal) add("首領戰前全隊回滿", PERK_TIPS.bossHeal);
  if (p.lifeline) add("戰敗保留隊伍（每局一次）", PERK_TIPS.lifeline);
  if (p.potions) add(`起始藥劑 +${p.potions}`);
  if (p.beans) add(`起始賽爾豆 +${p.beans}`);
  if (p.shopMult) add(`商店價格 ×${p.shopMult}`);
  if (p.restHealMult) add(`星爐修復 ×${p.restHealMult}`);
  if (p.eclipsePerMove) add(`每步蝕度 ${p.eclipsePerMove > 0 ? "+" : ""}${p.eclipsePerMove}`);
  if (p.revealMystery) add("看穿「？」節點");
  if (p.eliteRelicChoice) add(`夢魘遺物選項 +${p.eliteRelicChoice}`);
  if (p.extraRewardChoice) add(`遺物獎勵選項 +${p.extraRewardChoice}`);
  if (p.expMult) add(`旅程經驗 +${Math.round(p.expMult * 100)}%`);
  if (p.beansMult) add(`戰鬥賽爾豆 +${Math.round(p.beansMult * 100)}%`);
  return t;
}
export const perkText = (p: Perk): string[] => perkItems(p).map(x => x.text);
/** 滑過標籤時顯示的說明 */
export const PERK_TIPS: Record<string, string> = {
  tokenTierUp: "招募令可選的精靈強度上限提高一階（含起始令與之後取得的令；星晶招募不受強度限制）",
  dupCap: "重複招募與星晶進階的強化層數上限 3 → 4（第 4 層 12 星晶）",
  banBonus: "開局設定的禁用名額多 1 個",
  openShield: `每章第一場戰鬥開始時，我方全隊獲得 ${OPEN_SHIELD_BASE} 點護盾（隨層數縮放）`,
  freeReroll: "每次進商店，第一次刷新商品免費",
  bossHeal: "迎戰章末首領前，出戰全隊體力與 PP 回滿",
  lifeline: "全隊倒下或首領戰敗北時，改為全隊以 30% 體力回到地圖；每局一次",
};
export const SUIT_PERKS: Record<string, { tier: PerkTier; perk: Perk }> = {
  dark_angel: { tier: "strong", perk: { typeToken: "暗影", beans: 60 } },
  sky_cloud: { tier: "strong", perk: { tokenTierUp: true } },
  emperor_armor: { tier: "strong", perk: { bossHeal: true } },
  silver_knight: { tier: "strong", perk: { eliteRelicChoice: 1 } },
  berserker: { tier: "strong", perk: { openShield: true } },
  shadow_judgment: { tier: "strong", perk: { dupCap: 1, potions: 1 } },
  destiny_armor: { tier: "strong", perk: { freeReroll: true, beans: 60 } },
  inferno_mecha: { tier: "strong", perk: { typeToken: "火", potions: 1 } },
  proud_peak: { tier: "strong", perk: { banBonus: 1, expMult: .15 } },
  morning_star: { tier: "mid", perk: { eclipsePerMove: -1, typeToken: "光" } },
  venom_armor: { tier: "mid", perk: { shopMult: .9, typeToken: "草" } },
  future_armor: { tier: "mid", perk: { revealMystery: true } },
  corrupter: { tier: "mid", perk: { dualToken: ["暗影", "混沌"], potions: 1 } },
  space_time: { tier: "mid", perk: { dualToken: ["光", "超能"], expMult: .15 } },
  phoenix_wings: { tier: "mid", perk: { restHealMult: 1.25, typeToken: "飛行" } },
  imperial_armor: { tier: "mid", perk: { restHealMult: 1.25, dualToken: ["戰鬥", "聖靈"] } },
  shadow_slayer: { tier: "mid", perk: { eclipsePerMove: -1, typeToken: "戰鬥" } },
  void_traveler: { tier: "mid", perk: { dualToken: ["神秘", "電"], potions: 1 } },
  eternal_starlight: { tier: "mid", perk: { anyTokens: 1, beans: 60 } },
  starlight_guardian: { tier: "support", perk: { restHealMult: 1.25, typeToken: "聖靈", beans: 60 } },
  crystal_barrier: { tier: "support", perk: { shopMult: .9, dualToken: ["冰", "暗影"] } },
  nuclear_armor: { tier: "support", perk: { repeatTokens: 1, potions: 1 } },
  abyssal_walker: { tier: "support", perk: { eclipsePerMove: -1, dualToken: ["水", "混沌"] } },
  fate_defier: { tier: "support", perk: { lifeline: true, beans: 60 } },
  holy_sanctuary: { tier: "support", perk: { extraRewardChoice: 1, expMult: .15 } },
};
export const perkOf = (equipType: "suit" | "title", equipId: string): Perk | null => equipType === "suit" ? SUIT_PERKS[equipId]?.perk ?? null : null;
