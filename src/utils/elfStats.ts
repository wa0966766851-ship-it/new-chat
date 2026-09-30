import type { BaseStats, Elf } from "../types";
import { getEffectiveInscriptions } from "../data/inscriptionsCatalog";

const STAT_KEYS = ["hp", "atk", "def", "spatk", "spdef", "speed"] as const;

/** 保存/開局邊界使用正式配置重算，不把戰鬥殘留的0或預覽用100當成面板。 */
export function normalizeElfStats<T extends Partial<Elf>>(elf: T): T & Pick<Elf, "calculatedStats" | "maxHp" | "currentHp"> {
  let stats: BaseStats;
  if (elf.baseStats && STAT_KEYS.every(key => Number.isFinite(elf.baseStats![key]) && elf.baseStats![key] >= 0)) {
    stats = calculateElfStats(elf.baseStats, elf.level ?? 100, elf.ivs, elf.evs,
      elf.natureModifiers, elf.inscriptions, elf.guildBonuses, elf.hasAnnualBonus);
  } else if (elf.calculatedStats && STAT_KEYS.every(key => Number.isFinite(elf.calculatedStats![key]) && elf.calculatedStats![key] > 0)) {
    // 僅有完整面板的舊格式仍可使用；缺失資料不能偽造為100。
    stats = { ...elf.calculatedStats };
  } else {
    throw new Error(`【${elf.name || elf.id || "未命名精靈"}】缺少完整種族值或能力面板，無法建立戰鬥資料。`);
  }
  if (!STAT_KEYS.every(key => Number.isFinite(stats[key]) && stats[key] > 0)) {
    throw new Error(`【${elf.name || elf.id || "未命名精靈"}】能力配置含有缺失或非法數值，請先修正資料。`);
  }
  return { ...elf, calculatedStats: stats, maxHp: stats.hp, currentHp: stats.hp };
}

/** 讀取損壞存檔仍讓使用者能開啟編輯器修復；保存與開局則使用嚴格版本。 */
export function normalizeStoredElfStats<T extends Partial<Elf>>(elf: T): T {
  try { return normalizeElfStats(elf); }
  catch (error) { console.warn("精靈資料未能重算，保留原始紀錄供修復：", error); return elf; }
}

export function getDefaultEvs(baseStats?: BaseStats): BaseStats {
  const isPhysical = (baseStats?.atk ?? 0) >= (baseStats?.spatk ?? 0);
  return isPhysical
    ? { hp: 255, atk: 255, def: 0, spatk: 0, spdef: 0, speed: 0 }
    : { hp: 255, atk: 0, def: 0, spatk: 255, spdef: 0, speed: 0 };
}

export function calculateElfStats(
  baseStats: BaseStats,
  level: number = 100,
  ivs?: BaseStats,
  evs?: BaseStats,
  natureModifiers?: { [key in keyof BaseStats]?: number },
  inscriptions?: { stats: BaseStats }[],
  guildBonuses?: BaseStats,
  hasAnnualBonus?: boolean
): BaseStats {
  const safeBase = baseStats || { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
  const finalIvs: BaseStats = ivs || { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 };
  const finalEvs: BaseStats = evs || getDefaultEvs(safeBase); // 本攻+體力 default
  const multipliers = natureModifiers || { hp: 1.0, atk: 1.0, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.0 };
  const finalGuild = guildBonuses || { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
  const annualMod = hasAnnualBonus ? 10 : 0;

  const effectiveInsc = getEffectiveInscriptions(inscriptions as any);
  const inscHp = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.hp || 0), 0);
  const inscAtk = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.atk || 0), 0);
  const inscDef = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.def || 0), 0);
  const inscSpAtk = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.spatk || 0), 0);
  const inscSpDef = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.spdef || 0), 0);
  const inscSpeed = effectiveInsc.reduce((sum, insc) => sum + (insc?.stats?.speed || 0), 0);

  const calcNonHp = (base: number = 0, iv: number, ev: number, multiplier: number, insc: number, guild: number) => {
    return Math.max(1, Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level / 100 + 5) * multiplier) + insc + guild + annualMod);
  };

  const calcHp = (base: number = 0, iv: number, ev: number, insc: number, guild: number) => {
    return Math.max(1, Math.floor((base * 2 + iv + Math.floor(ev / 4)) * level / 100 + 10 + level) + insc + guild + annualMod);
  };

  return {
    hp: calcHp(safeBase.hp, finalIvs.hp, finalEvs.hp, inscHp, finalGuild.hp),
    atk: calcNonHp(safeBase.atk, finalIvs.atk, finalEvs.atk, multipliers.atk ?? 1.0, inscAtk, finalGuild.atk),
    def: calcNonHp(safeBase.def, finalIvs.def, finalEvs.def, multipliers.def ?? 1.0, inscDef, finalGuild.def),
    spatk: calcNonHp(safeBase.spatk, finalIvs.spatk, finalEvs.spatk, multipliers.spatk ?? 1.0, inscSpAtk, finalGuild.spatk),
    spdef: calcNonHp(safeBase.spdef, finalIvs.spdef, finalEvs.spdef, multipliers.spdef ?? 1.0, inscSpDef, finalGuild.spdef),
    speed: calcNonHp(safeBase.speed, finalIvs.speed, finalEvs.speed, multipliers.speed ?? 1.0, inscSpeed, finalGuild.speed),
  };
}

