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
  /** 面板倍增（全隊；在百分比與定值加成之後乘算，見 applyRelicPanel） */
  panelMul?: Partial<BaseStats>;
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
    lives?: number;            // 取得時永久生命 +n
    tempLivesPerAct?: number;  // 取得時與每章開始臨時生命 +n（當章有效）
    eliteRelicChoice?: number; // 精英遺物選項 +n
  };
}

const ALL_MUL = (m: number): Partial<BaseStats> => ({ hp: m, atk: m, def: m, spatk: m, spdef: m, speed: m });
export const RELICS: RelicDef[] = [
  // ── 普通 ──
  { id: "atk_bead", name: "攻擊能量珠", rarity: "common", glyph: "攻", desc: "全隊攻擊 +100", panel: { atk: 100 } },
  { id: "spatk_bead", name: "特攻能量珠", rarity: "common", glyph: "特", desc: "全隊特攻 +100", panel: { spatk: 100 } },
  { id: "def_bead", name: "防禦能量珠", rarity: "common", glyph: "防", desc: "全隊防禦 +100", panel: { def: 100 } },
  { id: "spdef_bead", name: "特防能量珠", rarity: "common", glyph: "抗", desc: "全隊特防 +100", panel: { spdef: 100 } },
  { id: "speed_bead", name: "速度能量珠", rarity: "common", glyph: "速", desc: "全隊速度 +50", panel: { speed: 50 } },
  { id: "hp_bead", name: "體力能量珠", rarity: "common", glyph: "命", desc: "全隊體力 +200", panel: { hp: 200 } },
  { id: "rusted_gear", name: "鏽蝕齒輪", rarity: "common", glyph: "齒", desc: "攻擊傷害 +16%", lore: "仍在轉，沒人知道它驅動著什麼。" },
  { id: "ash_charm", name: "灰燼護符", rarity: "common", glyph: "燼", desc: "受到的攻擊傷害 −16%", lore: "灰燼之靈留下的體溫。" },
  { id: "moth_wing", name: "燈蛾翅膜", rarity: "common", glyph: "蛾", desc: "回合結束恢復 8% 最大體力", lore: "牠們撲向的不是光，是你。" },
  { id: "bone_flute", name: "骨笛", rarity: "common", glyph: "笛", desc: "登場時令對手攻擊、特攻 −2" },
  { id: "dry_chalice", name: "乾涸聖杯", rarity: "common", glyph: "杯", desc: "擊敗對手後恢復 20% 最大體力" },
  { id: "black_cat_bell", name: "黑貓的鈴", rarity: "common", glyph: "鈴", desc: "商店價格 −30%", lore: "與套裝折扣合計，價格最低 ×0.5。", run: { shopMult: 0.7 } },
  { id: "gold_tooth", name: "金牙", rarity: "common", glyph: "牙", desc: "戰鬥獲得賽爾豆 +60%", run: { beansMult: 0.6 } },
  { id: "potion_belt", name: "藥劑腰帶", rarity: "common", glyph: "藥", desc: "取得時藥劑 +4", run: { potions: 4 } },
  { id: "ember_wick", name: "餘燼燈芯", rarity: "common", glyph: "芯", desc: "取得時與每章開始：臨時生命 +1（當章有效）", lore: "燒得不久，但夠你撐過一個章節。", run: { tempLivesPerAct: 1 } },
  { id: "mul_prism", name: "倍率稜鏡", rarity: "common", glyph: "稜", desc: "全隊全能力 ×2.3", lore: "光穿過它，會多出一道。", panelMul: ALL_MUL(2.3) },
  { id: "substitute_doll", name: "替身人偶", rarity: "common", glyph: "偶", desc: "保命（一次）：生命將歸零時自動觸發：本場不扣生命；失去一半賽爾豆與一件隨機遺物（不含保命遺物），全隊以 80% 體力繼續；用後碎裂", lore: "它替你死過一次，順手拿走了一些東西。" },
  { id: "apothecary_lamp", name: "藥師的提燈", rarity: "rare", glyph: "藥", desc: "取得時藥劑 +2；每次進入新章額外藥劑 +4", run: { potions: 2 } },

  // ── 稀有 ──
  { id: "life_lotus", name: "命蓮", rarity: "rare", glyph: "蓮", desc: "取得時永久生命 +1", lore: "花瓣掉一片，你就多活一次。", run: { lives: 1 } },
  { id: "strong_atk_bead", name: "強效攻擊珠", rarity: "rare", glyph: "攻", desc: "全隊攻擊 +300", panel: { atk: 300 } },
  { id: "strong_spatk_bead", name: "強效特攻珠", rarity: "rare", glyph: "特", desc: "全隊特攻 +300", panel: { spatk: 300 } },
  { id: "strong_def_bead", name: "強效防禦珠", rarity: "rare", glyph: "防", desc: "全隊防禦 +300", panel: { def: 300 } },
  { id: "strong_spdef_bead", name: "強效特防珠", rarity: "rare", glyph: "抗", desc: "全隊特防 +300", panel: { spdef: 300 } },
  { id: "strong_speed_bead", name: "強效速度珠", rarity: "rare", glyph: "速", desc: "全隊速度 +150", panel: { speed: 150 } },
  { id: "dmg_reduction_bead", name: "減傷能量珠", rarity: "rare", glyph: "減", desc: "受到傷害 −20%（真實傷害除外）" },
  { id: "justin_arm", name: "賈斯汀之臂", rarity: "rare", glyph: "臂", desc: "攻擊傷害 +30%" },
  { id: "dean_blade", name: "迪恩之刃", rarity: "rare", glyph: "刃", desc: "全隊攻擊 +300；物理攻擊無視防禦 10%", panel: { atk: 300 } },
  { id: "ray_wing", name: "雷神之翼", rarity: "rare", glyph: "雷", desc: "全隊速度 +200，免疫麻痺", panel: { speed: 200 } },
  { id: "gravity_boots", name: "重力靴", rarity: "rare", glyph: "靴", desc: "全隊速度 +80，免疫速度下降", panel: { speed: 80 } },
  { id: "ancient_armor_plate", name: "遠古裝甲殘骸", rarity: "rare", glyph: "甲", desc: "全隊防禦、特防 +300", panel: { def: 300, spdef: 300 } },
  { id: "quantum_chip", name: "量子計算晶片", rarity: "rare", glyph: "晶", desc: "全隊特攻 +400，速度 +60", panel: { spatk: 400, speed: 60 } },
  { id: "third_eye", name: "第三隻眼", rarity: "rare", glyph: "眼", desc: "對處於異常狀態的對手，攻擊傷害 +60%", lore: "它一直都在，只是你剛剛才睜開。" },
  { id: "web_spindle", name: "蛛網紡錘", rarity: "rare", glyph: "絲", desc: "回合開始時 40% 令對手疲憊 2 回合" },
  { id: "blood_watch", name: "血契懷錶", rarity: "rare", glyph: "錶", desc: "體力低於 1/2 時攻擊傷害 +70%", lore: "每一秒都是借來的。" },
  { id: "silver_stitch", name: "銀線縫合", rarity: "rare", glyph: "縫", desc: "受到的固定、百分比傷害 −75%" },
  { id: "tear_vial", name: "淚滴瓶", rarity: "rare", glyph: "淚", desc: "回合結束若體力低於 1/3，恢復 30% 最大體力" },
  { id: "dead_compass", name: "死星羅盤", rarity: "rare", glyph: "羅", desc: "每次移動蝕度 −4", run: { eclipsePerMove: -4 } },
  { id: "star_chart", name: "星圖殘頁", rarity: "rare", glyph: "圖", desc: "看穿所有「？」節點", run: { revealMystery: true } },
  { id: "old_key", name: "舊日之鑰", rarity: "rare", glyph: "鑰", desc: "精英遺物多 2 個選項", run: { eliteRelicChoice: 2 } },
  { id: "six_wing", name: "六翼獵手", rarity: "rare", glyph: "翼", desc: "擊敗對手後恢復 40% 最大體力" },
  { id: "void_shield_gen", name: "虛空護盾發生器", rarity: "rare", glyph: "盾", desc: "戰鬥開始時全隊獲得 1000 點護盾（隨層數縮放）" },
  { id: "undying_core", name: "不滅星核", rarity: "rare", glyph: "核", desc: "保命（一次）：生命將歸零時自動觸發：本場不扣生命，全隊回復至 100% 體力；若戰敗則留在原節點重戰；用後碎裂", lore: "裂開之前，它一直在替你的心跳數拍子。" },
  { id: "mul_cluster", name: "增殖晶簇", rarity: "rare", glyph: "簇", desc: "全隊全能力 ×3", lore: "它長得比你放下它的時候大。", panelMul: ALL_MUL(3) },

  // ── 傳說 ──
  { id: "silver_wing", name: "銀翼獵手", rarity: "legendary", glyph: "銀", desc: "攻擊傷害 +40%" },
  { id: "puni_robe", name: "譜尼之袍", rarity: "legendary", glyph: "袍", desc: "全隊全能力 +160", panel: { hp: 160, atk: 160, def: 160, spatk: 160, spdef: 160, speed: 160 } },
  { id: "holy_spirit_soul", name: "聖靈之魂", rarity: "legendary", glyph: "聖", desc: "全隊全能力 +200", panel: { hp: 200, atk: 200, def: 200, spatk: 200, spdef: 200, speed: 200 } },
  { id: "eclipse_crown", name: "星蝕之冠", rarity: "legendary", glyph: "冠", desc: "攻擊傷害 + 蝕度 %", lore: "戴上它的人，會看見太陽背面。" },
  { id: "thousand_eyes", name: "千眼聖骸", rarity: "legendary", glyph: "瞳", desc: "攻擊傷害 +40%，對手每有 1 級能力提升再 +10%" },
  { id: "faceless_mask", name: "無面者面具", rarity: "legendary", glyph: "面", desc: "受到的非真實傷害 −60%；回合結束失去 6% 最大體力", lore: "你還記得自己的臉嗎？" },
  { id: "gaia_fist", name: "戰神之拳", rarity: "legendary", glyph: "拳", desc: "全隊攻擊 +500、防禦 −100", panel: { atk: 500, def: -100 } },
  { id: "twin_core", name: "雙生之核", rarity: "legendary", glyph: "核", desc: "全隊全能力 ×4", lore: "有兩顆心跳，只有一個是你的。", panelMul: ALL_MUL(4) },
  { id: "reverse_hourglass", name: "逆時沙漏", rarity: "legendary", glyph: "沙", desc: "保命（一次）：打輸且生命將歸零時自動觸發（勝利不觸發）：回到戰前狀態（體力、PP、藥劑、生命）可改隊重戰，蝕度 +10；用後碎裂", lore: "沙粒往上落的時候，所有人都假裝沒看見。" },
  { id: "lantern_heart", name: "提燈者之心", rarity: "legendary", glyph: "燈", desc: "出戰與待命上限各 +2（最多各 6）；星爐修復 +100%；取得時永久生命 +1", run: { lineupBonus: 2, restHealMult: 2, lives: 1 } },

  // ── 詛咒 ──
  { id: "curse_bone", name: "蝕骨詛咒", rarity: "cursed", glyph: "骨", desc: "回合結束失去 6% 最大體力" },
  { id: "curse_dud", name: "啞火詛咒", rarity: "cursed", glyph: "啞", desc: "攻擊傷害 −20%" },
  { id: "curse_greed", name: "貪婪詛咒", rarity: "cursed", glyph: "貪", desc: "商店價格 +50%", run: { shopMult: 1.5 } },
  { id: "curse_insomnia", name: "失眠詛咒", rarity: "cursed", glyph: "眠", desc: "星爐修復效果減為 1/4", run: { restHealMult: 0.25 } },
  { id: "curse_mirror", name: "鏡像詛咒", rarity: "cursed", glyph: "鏡", desc: "每次移動蝕度 +6", run: { eclipsePerMove: 6 } },

  // ── 王座（首領掉落） ──
  { id: "throne_shard", name: "王座碎片", rarity: "boss", glyph: "座", desc: "全隊全能力 +16%", panelPct: { hp: .16, atk: .16, def: .16, spatk: .16, spdef: .16, speed: .16 } },
  { id: "black_sun", name: "黑太陽", rarity: "boss", glyph: "日", desc: "攻擊傷害 +60%；每次移動蝕度 +4", run: { eclipsePerMove: 4 } },
  { id: "black_sun_heart", name: "黑日之心", rarity: "boss", glyph: "曜", desc: "全隊攻擊、特攻 ×6；防禦、特防 ×0.25", lore: "它很重，因為它把光都吃進去了。", panelMul: { atk: 6, spatk: 6, def: .25, spdef: .25 } },
  { id: "abyss_cradle", name: "深淵搖籃", rarity: "boss", glyph: "淵", desc: "回合結束恢復 16% 最大體力" },
  { id: "pale_contract", name: "蒼白契約", rarity: "boss", glyph: "契", desc: "受到的攻擊傷害 −40%，戰鬥賽爾豆 −60%", run: { beansMult: -0.6 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map(r => [r.id, r]));
export const relicPool = (rarity: RelicRarity) => RELICS.filter(r => r.rarity === rarity);

export const RARITY_LABEL: Record<RelicRarity, string> = { common: "普通", rare: "稀有", legendary: "傳說", cursed: "詛咒", boss: "王座" };

/** 依持有遺物彙整局內修正 */
export function runMods(relics: readonly string[]) {
  const mods = { lives: 0, tempLivesPerAct: 0, beansMult: 1, shopMult: 1, eclipsePerMove: 0, restHealMult: 1, extraRewardChoice: 0, revealMystery: false, lineupBonus: 0, eliteRelicChoice: 0 };
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
    if (r.lives) mods.lives += r.lives;
    if (r.tempLivesPerAct) mods.tempLivesPerAct += r.tempLivesPerAct;
  }
  mods.beansMult = Math.max(0, mods.beansMult);
  return mods;
}

/** 倍增遺物的軟上限：單項總倍率超過 64 的部分以 √ 計（M > 64 → 64·√(M/64)）。 */
export const MUL_SOFT_CAP = 64;
export const softCapMul = (m: number): number => m <= MUL_SOFT_CAP ? m : MUL_SOFT_CAP * Math.sqrt(m / MUL_SOFT_CAP);
export const isMulRelic = (id: string) => !!RELIC_BY_ID[id]?.panelMul;
/** 各能力的倍增遺物總倍率（已套軟上限；沒有倍增遺物的能力不列出）。 */
export function relicMulTotals(relics: readonly string[]): Partial<Record<keyof BaseStats, number>> {
  const keys = ["hp", "atk", "def", "spatk", "spdef", "speed"] as const, mul: Partial<Record<keyof BaseStats, number>> = {};
  for (const id of relics) { const r = RELIC_BY_ID[id]; if (!r?.panelMul) continue; for (const k of keys) if (r.panelMul[k] !== undefined) mul[k] = (mul[k] ?? 1) * r.panelMul[k]!; }
  for (const k of keys) if (mul[k] !== undefined) mul[k] = softCapMul(mul[k]!);
  return mul;
}
/** 面板加成：先百分比、再定值，最後乘算倍增遺物（加算先結算，再乘） */
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
  const mul: Record<string, number> = {};
  for (const id of relics) { const r = RELIC_BY_ID[id]; if (!r?.panelMul) continue; for (const k of keys) if (r.panelMul[k] !== undefined) mul[k] = (mul[k] ?? 1) * r.panelMul[k]!; }
  for (const k of keys) if (mul[k] !== undefined) out[k] = Math.max(1, Math.floor(out[k] * softCapMul(mul[k])));
  return out;
}

/**
 * 保命遺物（生命制）：本場結算會使生命歸零（＝失敗）時才會觸發，每件只能用一次，用後碎裂；觸發時本場不扣生命。
 * 同時持有時依此順序消耗（弱的先用，強的留到最後）；套裝「戰敗保留隊伍」特權排在最前面。
 */
export const RESCUE_ORDER = ["substitute_doll", "undying_core", "reverse_hourglass"] as const;
export type RescueRelicId = typeof RESCUE_ORDER[number];
export const isRescueRelic = (id: string): id is RescueRelicId => (RESCUE_ORDER as readonly string[]).includes(id);
