import { LucideIcon, Heart, Zap, Shield, Sword, Sparkles, Crown, Wind, Crosshair, ShieldAlert, ShieldCheck, Flame } from "lucide-react";

export interface Collectible {
  id: string;
  name: string;
  description: string;
  type: "stat" | "special" | "elemental";
  rarity: "common" | "rare" | "epic" | "legendary";
  effect: (stats: any) => any;
}

export const INTERSTELLAR_COLLECTIBLES: Collectible[] = [
  // Energy Beads (Stat based)
  { 
    id: "atk_bead", name: "攻擊能量珠", description: "全隊攻擊 +50", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, atk: (s.atk || 0) + 50 })
  },
  { 
    id: "spatk_bead", name: "特攻能量珠", description: "全隊特攻 +50", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, spatk: (s.spatk || 0) + 50 })
  },
  { 
    id: "def_bead", name: "防禦能量珠", description: "全隊防禦 +50", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, def: (s.def || 0) + 50 })
  },
  { 
    id: "spdef_bead", name: "特防能量珠", description: "全隊特防 +50", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, spdef: (s.spdef || 0) + 50 })
  },
  { 
    id: "speed_bead", name: "速度能量珠", description: "全隊速度 +25", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, speed: (s.speed || 0) + 25 })
  },
  { 
    id: "hp_bead", name: "體力能量珠", description: "全隊體力 +100", type: "stat", rarity: "common",
    effect: (s) => ({ ...s, hp: (s.hp || 0) + 100 })
  },
  
  // Strong Versions
  { 
    id: "strong_atk_bead", name: "強效攻擊珠", description: "全隊攻擊 +150", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, atk: (s.atk || 0) + 150 })
  },
  { 
    id: "strong_spatk_bead", name: "強效特攻珠", description: "全隊特攻 +150", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, spatk: (s.spatk || 0) + 150 })
  },
  { 
    id: "strong_def_bead", name: "強效防禦珠", description: "全隊防禦 +150", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, def: (s.def || 0) + 150 })
  },
  { 
    id: "strong_spdef_bead", name: "強效特防珠", description: "全隊特防 +150", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, spdef: (s.spdef || 0) + 150 })
  },
  { 
    id: "strong_speed_bead", name: "強效速度珠", description: "全隊速度 +75", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, speed: (s.speed || 0) + 75 })
  },
  { 
    id: "dmg_reduction_bead", name: "減傷能量珠", description: "全隊受到傷害 -10% (戰鬥中生效)", type: "stat", rarity: "rare",
    effect: (s) => s
  },

  // Named Collectibles (Epic/Legendary)
  { 
    id: "justin_arm", name: "賈斯汀之臂", description: "全隊攻擊傷害 +15%", type: "special", rarity: "epic",
    effect: (s) => s
  },
  { 
    id: "dean_blade", name: "迪恩之刃", description: "全隊攻擊 +150，無視對手防禦 +5%", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, atk: (s.atk || 0) + 150 })
  },
  { 
    id: "ray_wing", name: "雷神之翼", description: "全隊速度 +100，免疫麻痺狀態", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, speed: (s.speed || 0) + 100 })
  },
  { 
    id: "gaia_fist", name: "戰神之拳", description: "全隊攻擊 +250，但防禦 -50", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, atk: (s.atk || 0) + 250, def: (s.def || 0) - 50 })
  },
  { 
    id: "puni_robe", name: "譜尼之袍", description: "全隊全屬性 +80", type: "special", rarity: "legendary",
    effect: (s) => ({
      ...s,
      hp: (s.hp || 0) + 80,
      atk: (s.atk || 0) + 80,
      def: (s.def || 0) + 80,
      spatk: (s.spatk || 0) + 80,
      spdef: (s.spdef || 0) + 80,
      speed: (s.speed || 0) + 80,
    })
  },
  { 
    id: "captain_badge", name: "船長之徽", description: "全隊體力 +150，戰鬥後賽爾豆獲得 +15%", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, hp: (s.hp || 0) + 150 })
  },
  { 
    id: "silver_wing", name: "銀翼獵手", description: "全隊攻擊傷害 +20%", type: "special", rarity: "epic",
    effect: (s) => s
  },
  { 
    id: "six_wing", name: "六翼獵手", description: "擊敗對手後恢復最大體力 20%", type: "special", rarity: "legendary",
    effect: (s) => s
  },
  { 
    id: "holy_spirit_soul", name: "聖靈之魂", description: "全隊全屬性 +100", type: "special", rarity: "legendary",
    effect: (s) => ({
      ...s,
      hp: (s.hp || 0) + 100,
      atk: (s.atk || 0) + 100,
      def: (s.def || 0) + 100,
      spatk: (s.spatk || 0) + 100,
      spdef: (s.spdef || 0) + 100,
      speed: (s.speed || 0) + 100,
    })
  },
  { 
    id: "quantum_chip", name: "量子計算晶片", description: "全隊特攻 +200，速度 +30", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, spatk: (s.spatk || 0) + 200, speed: (s.speed || 0) + 30 })
  },
  { 
    id: "ancient_armor_plate", name: "遠古裝甲殘骸", description: "全隊防禦、特防 +150", type: "special", rarity: "rare",
    effect: (s) => ({ ...s, def: (s.def || 0) + 150, spdef: (s.spdef || 0) + 150 })
  },
  { 
    id: "energy_overload_core", name: "能量超載核心", description: "全隊攻擊 +300，但每回合損失 5% 體力 (戰鬥生效)", type: "special", rarity: "epic",
    effect: (s) => ({ ...s, atk: (s.atk || 0) + 300 })
  },
  {
    id: "void_shield_gen", name: "虛空護盾發生器", description: "戰鬥開始時全隊獲得 500 點護盾", type: "special", rarity: "epic",
    effect: (s) => s
  },
  {
    id: "nanobot_swarm", name: "奈米修復群", description: "每回合結束恢復全隊 50 點體力", type: "special", rarity: "rare",
    effect: (s) => ({ ...s, hp: (s.hp || 0) + 50 })
  },
  {
    id: "gravity_boots", name: "重力靴", description: "全隊速度 +40，免疫速度下降效果", type: "stat", rarity: "rare",
    effect: (s) => ({ ...s, speed: (s.speed || 0) + 40 })
  }
];

export interface DifficultyModifier {
  id: string;
  name: string;
  description: string;
  scoreMult: number;
  multiplier: number; // Added to match usage in InterstellarRun
  effect: string;
}

export const DIFFICULTY_MODIFIERS: DifficultyModifier[] = [
  { id: "weak_body", name: "體能衰減", description: "我方精靈體力降低 20%", scoreMult: 0.2, multiplier: 0.2, effect: "p1_hp_0.8" },
  { id: "strong_boss", name: "首領狂暴", description: "Boss 全屬性額外提升 20%", scoreMult: 0.3, multiplier: 0.3, effect: "boss_all_1.2" },
  { id: "no_potions", name: "禁藥令", description: "局內藥劑使用次數上限 -3", scoreMult: 0.2, multiplier: 0.2, effect: "potion_limit_minus_3" },
  { id: "cost_recruit", name: "物資匱乏", description: "招募精靈所需的鑽石增加 1", scoreMult: 0.2, multiplier: 0.2, effect: "recruit_cost_plus_1" },
  { id: "high_gravity", name: "強重力環境", description: "我方全體速度降低 15%", scoreMult: 0.15, multiplier: 0.15, effect: "p1_speed_0.85" },
];
