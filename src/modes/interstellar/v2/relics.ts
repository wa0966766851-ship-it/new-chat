import type { BaseStats } from "../../../types";

/** 遺物（藏品）。面板類加成直接加在能力值（面板），戰鬥類效果見 effects/relicEffectRegistry。 */
export type RelicRarity = "common" | "rare" | "legendary" | "cursed" | "boss";
export interface RelicDef {
  id: string;
  name: string;
  rarity: RelicRarity;
  /** 單字徽記（UI 圖示） */
  glyph: string;
  desc: string;
  /** 一句氛圍短句（tooltip 第二行） */
  lore?: string;
  /** 面板加成（全隊） */
  panel?: Partial<BaseStats>;
  /** 面板百分比加成（全隊，0.1=+10%） */
  panelPct?: Partial<BaseStats>;
  /** 局內修正 */
  run?: {
    beansMult?: number;        // 戰鬥賽爾豆 +x
    shopMult?: number;         // 商店價格倍率疊乘
    eclipsePerMove?: number;   // 每步蝕度增減
    restHealMult?: number;     // 星爐修復倍率疊乘
    extraRewardChoice?: number;// 遺物獎勵多 n 選項
    revealMystery?: boolean;   // 看穿「？」節點
    potions?: number;          // 取得時藥劑 +n
    lineupBonus?: number;      // 出戰與待命上限 +n（最多各 6）
    eliteRelicChoice?: number; // 精英遺物選項 +n
  };
}

export const RELICS: RelicDef[] = [
  // ── 普通 ──
  { id: "atk_bead", name: "攻擊能量珠", rarity: "common", glyph: "攻", desc: "全隊攻擊 +50", panel: { atk: 50 } },
  { id: "spatk_bead", name: "特攻能量珠", rarity: "common", glyph: "特", desc: "全隊特攻 +50", panel: { spatk: 50 } },
  { id: "def_bead", name: "防禦能量珠", rarity: "common", glyph: "防", desc: "全隊防禦 +50", panel: { def: 50 } },
  { id: "spdef_bead", name: "特防能量珠", rarity: "common", glyph: "抗", desc: "全隊特防 +50", panel: { spdef: 50 } },
  { id: "speed_bead", name: "速度能量珠", rarity: "common", glyph: "速", desc: "全隊速度 +25", panel: { speed: 25 } },
  { id: "hp_bead", name: "體力能量珠", rarity: "common", glyph: "命", desc: "全隊體力 +100", panel: { hp: 100 } },
  { id: "rusted_gear", name: "鏽蝕齒輪", rarity: "common", glyph: "齒", desc: "攻擊傷害 +8%", lore: "仍在轉，沒人知道它驅動著什麼。" },
  { id: "ash_charm", name: "灰燼護符", rarity: "common", glyph: "燼", desc: "受到的攻擊傷害 −8%", lore: "灰燼之靈留下的體溫。" },
  { id: "moth_wing", name: "燈蛾翅膜", rarity: "common", glyph: "蛾", desc: "回合結束恢復 4% 最大體力", lore: "牠們撲向的不是光，是你。" },
  { id: "bone_flute", name: "骨笛", rarity: "common", glyph: "笛", desc: "登場時令對手攻擊、特攻 −1" },
  { id: "dry_chalice", name: "乾涸聖杯", rarity: "common", glyph: "杯", desc: "擊敗對手後恢復 10% 最大體力" },
  { id: "black_cat_bell", name: "黑貓的鈴", rarity: "common", glyph: "鈴", desc: "商店價格 −15%", run: { shopMult: 0.85 } },
  { id: "gold_tooth", name: "金牙", rarity: "common", glyph: "牙", desc: "戰鬥獲得賽爾豆 +30%", run: { beansMult: 0.3 } },
  { id: "potion_belt", name: "藥劑腰帶", rarity: "common", glyph: "藥", desc: "取得時藥劑 +2", run: { potions: 2 } },
  { id: "apothecary_lamp", name: "藥師的提燈", rarity: "rare", glyph: "藥", desc: "取得時藥劑 +1；每次進入新章額外藥劑 +2", run: { potions: 1 } },

  // ── 稀有 ──
  { id: "strong_atk_bead", name: "強效攻擊珠", rarity: "rare", glyph: "攻", desc: "全隊攻擊 +150", panel: { atk: 150 } },
  { id: "strong_spatk_bead", name: "強效特攻珠", rarity: "rare", glyph: "特", desc: "全隊特攻 +150", panel: { spatk: 150 } },
  { id: "strong_def_bead", name: "強效防禦珠", rarity: "rare", glyph: "防", desc: "全隊防禦 +150", panel: { def: 150 } },
  { id: "strong_spdef_bead", name: "強效特防珠", rarity: "rare", glyph: "抗", desc: "全隊特防 +150", panel: { spdef: 150 } },
  { id: "strong_speed_bead", name: "強效速度珠", rarity: "rare", glyph: "速", desc: "全隊速度 +75", panel: { speed: 75 } },
  { id: "dmg_reduction_bead", name: "減傷能量珠", rarity: "rare", glyph: "減", desc: "受到傷害 −10%（真實傷害除外）" },
  { id: "justin_arm", name: "賈斯汀之臂", rarity: "rare", glyph: "臂", desc: "攻擊傷害 +15%" },
  { id: "dean_blade", name: "迪恩之刃", rarity: "rare", glyph: "刃", desc: "全隊攻擊 +150；物理攻擊無視防禦 5%", panel: { atk: 150 } },
  { id: "ray_wing", name: "雷神之翼", rarity: "rare", glyph: "雷", desc: "全隊速度 +100，免疫麻痺", panel: { speed: 100 } },
  { id: "gravity_boots", name: "重力靴", rarity: "rare", glyph: "靴", desc: "全隊速度 +40，免疫速度下降", panel: { speed: 40 } },
  { id: "ancient_armor_plate", name: "遠古裝甲殘骸", rarity: "rare", glyph: "甲", desc: "全隊防禦、特防 +150", panel: { def: 150, spdef: 150 } },
  { id: "quantum_chip", name: "量子計算晶片", rarity: "rare", glyph: "晶", desc: "全隊特攻 +200，速度 +30", panel: { spatk: 200, speed: 30 } },
  { id: "third_eye", name: "第三隻眼", rarity: "rare", glyph: "眼", desc: "對處於異常狀態的對手，攻擊傷害 +30%", lore: "它一直都在，只是你剛剛才睜開。" },
  { id: "web_spindle", name: "蛛網紡錘", rarity: "rare", glyph: "絲", desc: "回合開始時 20% 令對手疲憊 1 回合" },
  { id: "blood_watch", name: "血契懷錶", rarity: "rare", glyph: "錶", desc: "體力低於 1/2 時攻擊傷害 +35%", lore: "每一秒都是借來的。" },
  { id: "silver_stitch", name: "銀線縫合", rarity: "rare", glyph: "縫", desc: "受到的固定、百分比傷害減半" },
  { id: "tear_vial", name: "淚滴瓶", rarity: "rare", glyph: "淚", desc: "回合結束若體力低於 1/3，恢復 15% 最大體力" },
  { id: "dead_compass", name: "死星羅盤", rarity: "rare", glyph: "羅", desc: "每次移動蝕度 −2", run: { eclipsePerMove: -2 } },
  { id: "star_chart", name: "星圖殘頁", rarity: "rare", glyph: "圖", desc: "看穿所有「？」節點", run: { revealMystery: true } },
  { id: "old_key", name: "舊日之鑰", rarity: "rare", glyph: "鑰", desc: "精英遺物多 1 個選項", run: { eliteRelicChoice: 1 } },
  { id: "six_wing", name: "六翼獵手", rarity: "rare", glyph: "翼", desc: "擊敗對手後恢復 20% 最大體力" },
  { id: "void_shield_gen", name: "虛空護盾發生器", rarity: "rare", glyph: "盾", desc: "戰鬥開始時全隊獲得 500 點護盾" },

  // ── 傳說 ──
  { id: "silver_wing", name: "銀翼獵手", rarity: "legendary", glyph: "銀", desc: "攻擊傷害 +20%" },
  { id: "puni_robe", name: "譜尼之袍", rarity: "legendary", glyph: "袍", desc: "全隊全能力 +80", panel: { hp: 80, atk: 80, def: 80, spatk: 80, spdef: 80, speed: 80 } },
  { id: "holy_spirit_soul", name: "聖靈之魂", rarity: "legendary", glyph: "聖", desc: "全隊全能力 +100", panel: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 } },
  { id: "eclipse_crown", name: "星蝕之冠", rarity: "legendary", glyph: "冠", desc: "攻擊傷害 + 蝕度 ÷ 2 %", lore: "戴上它的人，會看見太陽背面。" },
  { id: "thousand_eyes", name: "千眼聖骸", rarity: "legendary", glyph: "瞳", desc: "攻擊傷害 +20%，對手每有 1 級能力提升再 +5%" },
  { id: "faceless_mask", name: "無面者面具", rarity: "legendary", glyph: "面", desc: "受到的非真實傷害 −30%；回合結束失去 3% 最大體力", lore: "你還記得自己的臉嗎？" },
  { id: "gaia_fist", name: "戰神之拳", rarity: "legendary", glyph: "拳", desc: "全隊攻擊 +250、防禦 −50", panel: { atk: 250, def: -50 } },
  { id: "lantern_heart", name: "提燈者之心", rarity: "legendary", glyph: "燈", desc: "出戰與待命上限各 +1（最多各 6）；星爐修復 +50%", run: { lineupBonus: 1, restHealMult: 1.5 } },

  // ── 詛咒 ──
  { id: "curse_bone", name: "蝕骨詛咒", rarity: "cursed", glyph: "骨", desc: "回合結束失去 3% 最大體力" },
  { id: "curse_dud", name: "啞火詛咒", rarity: "cursed", glyph: "啞", desc: "攻擊傷害 −10%" },
  { id: "curse_greed", name: "貪婪詛咒", rarity: "cursed", glyph: "貪", desc: "商店價格 +25%", run: { shopMult: 1.25 } },
  { id: "curse_insomnia", name: "失眠詛咒", rarity: "cursed", glyph: "眠", desc: "星爐修復效果減半", run: { restHealMult: 0.5 } },
  { id: "curse_mirror", name: "鏡像詛咒", rarity: "cursed", glyph: "鏡", desc: "每次移動蝕度 +3", run: { eclipsePerMove: 3 } },

  // ── 王座（首領掉落） ──
  { id: "throne_shard", name: "王座碎片", rarity: "boss", glyph: "座", desc: "全隊全能力 +8%", panelPct: { hp: .08, atk: .08, def: .08, spatk: .08, spdef: .08, speed: .08 } },
  { id: "black_sun", name: "黑太陽", rarity: "boss", glyph: "日", desc: "攻擊傷害 +30%；每次移動蝕度 +2", run: { eclipsePerMove: 2 } },
  { id: "abyss_cradle", name: "深淵搖籃", rarity: "boss", glyph: "淵", desc: "回合結束恢復 8% 最大體力" },
  { id: "pale_contract", name: "蒼白契約", rarity: "boss", glyph: "契", desc: "受到的攻擊傷害 −20%，戰鬥賽爾豆 −30%", run: { beansMult: -0.3 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map(r => [r.id, r]));
export const relicPool = (rarity: RelicRarity) => RELICS.filter(r => r.rarity === rarity);

export const RARITY_LABEL: Record<RelicRarity, string> = { common: "普通", rare: "稀有", legendary: "傳說", cursed: "詛咒", boss: "王座" };

/** 依持有遺物彙整局內修正 */
export function runMods(relics: readonly string[]) {
  const mods = { beansMult: 1, shopMult: 1, eclipsePerMove: 0, restHealMult: 1, extraRewardChoice: 0, revealMystery: false, lineupBonus: 0, eliteRelicChoice: 0 };
  for (const id of relics) {
    const r = RELIC_BY_ID[id]?.run; if (!r) continue;
    if (r.beansMult) mods.beansMult += r.beansMult;
    if (r.shopMult) mods.shopMult *= r.shopMult;
    if (r.eclipsePerMove) mods.eclipsePerMove += r.eclipsePerMove;
    if (r.restHealMult) mods.restHealMult *= r.restHealMult;
    if (r.extraRewardChoice) mods.extraRewardChoice += r.extraRewardChoice;
    if (r.revealMystery) mods.revealMystery = true;
    if (r.lineupBonus) mods.lineupBonus += r.lineupBonus;
    if (r.eliteRelicChoice) mods.eliteRelicChoice += r.eliteRelicChoice;
  }
  mods.beansMult = Math.max(0, mods.beansMult);
  return mods;
}

/** 面板加成：先百分比後定值 */
export function applyRelicPanel(stats: BaseStats, relics: readonly string[]): BaseStats {
  const out = { ...stats };
  const keys = ["hp", "atk", "def", "spatk", "spdef", "speed"] as const;
  for (const id of relics) {
    const r = RELIC_BY_ID[id]; if (!r?.panelPct) continue;
    for (const k of keys) if (r.panelPct[k]) out[k] = Math.floor(out[k] * (1 + r.panelPct[k]!));
  }
  for (const id of relics) {
    const r = RELIC_BY_ID[id]; if (!r?.panel) continue;
    for (const k of keys) if (r.panel[k]) out[k] = Math.max(1, out[k] + r.panel[k]!);
  }
  return out;
}
