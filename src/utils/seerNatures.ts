import { BaseStats } from "../types";

export interface SeerNature {
  name: string;
  up: keyof BaseStats | null;
  down: keyof BaseStats | null;
  description: string;
  category: "物攻" | "特攻" | "速度" | "防禦" | "特防" | "平衡";
}

export const SEER_NATURES: SeerNature[] = [
  // 物攻型 (+攻擊)
  { name: "固執", up: "atk", down: "spatk", description: "+攻擊 -特攻", category: "物攻" },
  { name: "孤僻", up: "atk", down: "def", description: "+攻擊 -防禦", category: "物攻" },
  { name: "勇敢", up: "atk", down: "speed", description: "+攻擊 -速度", category: "物攻" },
  { name: "調皮", up: "atk", down: "spdef", description: "+攻擊 -特防", category: "物攻" },

  // 特攻型 (+特攻)
  { name: "保守", up: "spatk", down: "atk", description: "+特攻 -攻擊", category: "特攻" },
  { name: "穩重", up: "spatk", down: "def", description: "+特攻 -防禦", category: "特攻" },
  { name: "冷靜", up: "spatk", down: "speed", description: "+特攻 -速度", category: "特攻" },
  { name: "馬虎", up: "spatk", down: "spdef", description: "+特攻 -特防", category: "特攻" },

  // 速度型 (+速度)
  { name: "開朗", up: "speed", down: "spatk", description: "+速度 -特攻", category: "速度" },
  { name: "膽小", up: "speed", down: "atk", description: "+速度 -攻擊", category: "速度" },
  { name: "急躁", up: "speed", down: "def", description: "+速度 -防禦", category: "速度" },
  { name: "天真", up: "speed", down: "spdef", description: "+速度 -特防", category: "速度" },

  // 防禦型 (+防禦)
  { name: "頑皮", up: "def", down: "spatk", description: "+防禦 -特攻", category: "防禦" },
  { name: "大膽", up: "def", down: "atk", description: "+防禦 -攻擊", category: "防禦" },
  { name: "悠閒", up: "def", down: "speed", description: "+防禦 -速度", category: "防禦" },
  { name: "無慮", up: "def", down: "spdef", description: "+防禦 -特防", category: "防禦" },

  // 特防型 (+特防)
  { name: "慎重", up: "spdef", down: "spatk", description: "+特防 -特攻", category: "特防" },
  { name: "沉著", up: "spdef", down: "atk", description: "+特防 -攻擊", category: "特防" },
  { name: "狂妄", up: "spdef", down: "speed", description: "+特防 -速度", category: "特防" },
  { name: "溫順", up: "spdef", down: "def", description: "+特防 -防禦", category: "特防" },

  // 平衡型 (1.0x)
  { name: "認真", up: null, down: null, description: "平衡性格 (全部 1.0x)", category: "平衡" },
  { name: "實干", up: null, down: null, description: "平衡性格 (全部 1.0x)", category: "平衡" },
  { name: "浮躁", up: null, down: null, description: "平衡性格 (全部 1.0x)", category: "平衡" },
  { name: "害羞", up: null, down: null, description: "平衡性格 (全部 1.0x)", category: "平衡" },
  { name: "坦率", up: null, down: null, description: "平衡性格 (全部 1.0x)", category: "平衡" },
];

/**
 * 預設性格：提升種族值最高的一項（體力不受性格影響，不計入）；
 * 降低項為較弱的那一項攻擊（與預設學習力「本攻＋體力」一致），
 * 若最高項本身是攻擊則降低另一項攻擊。同分時優先順序：本攻 → 速度 → 防禦 → 特防。
 */
export function getDefaultNature(baseStats?: Partial<BaseStats>): SeerNature {
  const fallback = SEER_NATURES.find(n => n.name === "認真")!;
  if (!baseStats) return fallback;
  const atk = baseStats.atk ?? 0, spatk = baseStats.spatk ?? 0;
  const mainAtk: keyof BaseStats = atk >= spatk ? "atk" : "spatk";
  const weakAtk: keyof BaseStats = mainAtk === "atk" ? "spatk" : "atk";
  const order: (keyof BaseStats)[] = [mainAtk, "speed", "def", "spdef", weakAtk];
  let up = order[0];
  for (const key of order) if ((baseStats[key] ?? 0) > (baseStats[up] ?? 0)) up = key;
  const down: keyof BaseStats = up === weakAtk ? mainAtk : weakAtk;
  return SEER_NATURES.find(n => n.up === up && n.down === down) ?? fallback;
}

export function getDefaultNatureModifiers(baseStats?: Partial<BaseStats>): { [key in keyof BaseStats]: number } {
  return getModifiersFromNature(getDefaultNature(baseStats).name);
}

export function getNatureFromModifiers(mods?: { [key in keyof BaseStats]?: number }, baseStats?: Partial<BaseStats>): SeerNature {
  if (!mods) return getDefaultNature(baseStats);
  let upStat: keyof BaseStats | null = null;
  let downStat: keyof BaseStats | null = null;
  
  for (const stat of ["atk", "def", "spatk", "spdef", "speed"] as (keyof BaseStats)[]) {
    const val = mods[stat] ?? 1.0;
    if (Math.abs(val - 1.1) < 0.01) upStat = stat;
    else if (Math.abs(val - 0.9) < 0.01) downStat = stat;
  }
  
  if (!upStat && !downStat) {
    return SEER_NATURES.find(n => n.name === "認真")!;
  }
  
  const matched = SEER_NATURES.find(n => n.up === upStat && n.down === downStat);
  return matched || { name: "自訂", up: upStat, down: downStat, description: `+${upStat || '無'} -${downStat || '無'}`, category: "平衡" };
}

export function getModifiersFromNature(natureName: string): { [key in keyof BaseStats]: number } {
  const nature = SEER_NATURES.find(n => n.name === natureName) || SEER_NATURES.find(n => n.name === "認真")!;
  const mods: { [key in keyof BaseStats]: number } = { hp: 1.0, atk: 1.0, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.0 };
  if (nature.up) mods[nature.up] = 1.1;
  if (nature.down) mods[nature.down] = 0.9;
  return mods;
}

export function validateSeerNature(mods?: { [key in keyof BaseStats]?: number }): { valid: boolean; message?: string } {
  if (!mods) return { valid: true };
  let countUp = 0;
  let countDown = 0;
  for (const stat of ["atk", "def", "spatk", "spdef", "speed"] as (keyof BaseStats)[]) {
    const val = mods[stat] ?? 1.0;
    if (Math.abs(val - 1.1) < 0.01) countUp++;
    else if (Math.abs(val - 0.9) < 0.01) countDown++;
    else if (Math.abs(val - 1.0) > 0.01) {
      return { valid: false, message: `性格數值錯誤 (${stat}: ${val})！倍率必須為 1.1、1.0 或 0.9。` };
    }
  }
  if ((countUp === 1 && countDown === 1) || (countUp === 0 && countDown === 0)) {
    return { valid: true };
  }
  return {
    valid: false,
    message: `在《賽爾號》中，合法的精靈性格只能是：【一項 1.1 (強化) 且一項 0.9 (弱化)】，或是【全部 1.0 (平衡性格)】！目前檢測到 ${countUp} 項強化與 ${countDown} 項弱化，請調整後再儲存。`
  };
}

export const EV_PRESETS: { name: string; desc: string; evs: BaseStats }[] = [
  { name: "標準物攻體", desc: "255攻擊 / 255體力 (本攻+體力)", evs: { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 } },
  { name: "標準特攻體", desc: "255特攻 / 255體力 (本攻+體力)", evs: { hp: 255, atk: 0, def: 0, spatk: 255, spdef: 0, speed: 0 } },
  { name: "極限物攻速", desc: "252攻擊 / 252速度 / 6體力", evs: { hp: 6, atk: 252, def: 0, spatk: 0, spdef: 0, speed: 252 } },
  { name: "極限特攻速", desc: "252特攻 / 252速度 / 6體力", evs: { hp: 6, atk: 0, def: 0, spatk: 252, spdef: 0, speed: 252 } },
  { name: "極限物攻體", desc: "252攻擊 / 252體力 / 6速度", evs: { hp: 252, atk: 252, def: 0, spatk: 0, spdef: 0, speed: 6 } },
  { name: "極限特攻體", desc: "252特攻 / 252體力 / 6速度", evs: { hp: 252, atk: 0, def: 0, spatk: 252, spdef: 0, speed: 6 } },
  { name: "極限雙防盾", desc: "252體力 / 128防禦 / 130特防", evs: { hp: 252, atk: 0, def: 128, spatk: 0, spdef: 130, speed: 0 } },
  { name: "平衡平均流", desc: "各項 85 點 (共 510 點)", evs: { hp: 85, atk: 85, def: 85, spatk: 85, spdef: 85, speed: 85 } },
  { name: "一鍵全清零", desc: "各項 0 點", evs: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 } },
];
