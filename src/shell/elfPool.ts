import type { Elf } from "../types";
import { matchesElfQuery } from "../utils/elfSearch";

/**
 * 新版介面的精靈清單規則（單一來源）。
 * - 搜尋沿用全站契約（名稱、ID、屬性、魂印；空白為 AND；簡繁與標點正規化），不再各畫面自寫 name.includes。
 * - 不截斷數量：先前挑選器 slice(0,120) 會讓排在尾端的新精靈（匯入、階段競技場、新增精靈都追加在尾端）在清單變長後消失。
 */
export function filterShellElves<E extends Partial<Elf>>(elves: readonly E[], query: string, types: string[] = []): E[] {
  return elves.filter(e => matchesElfQuery(e, query, types));
}

const isCustom = (e: Partial<Elf>) => String(e.id ?? "").startsWith("custom_") || !!e.isCustom;
/** 階段競技場借用的精靈追加在清單尾端，但不是「新精靈」。 */
const isStagedArena = (e: Partial<Elf>) => String(e.id ?? "").startsWith("arena_");
const isNewCandidate = (e: Partial<Elf>) => !isCustom(e) && !isStagedArena(e);

/** 最新加入的內建精靈（清單尾端，不含自訂與階段競技場精靈）。 */
export function newestElfKeys(elves: readonly Elf[], count = 6): Set<string> {
  return new Set(elves.filter(isNewCandidate).slice(-count).map(e => String(e.id ?? e.name)));
}

/** 內建精靈新到舊；階段競技場精靈次之，自訂精靈最後（各自維持原相對順序）。 */
export function newestFirst<E extends Elf>(elves: readonly E[]): E[] {
  return [
    ...elves.filter(isNewCandidate).reverse(),
    ...elves.filter(e => !isCustom(e) && isStagedArena(e)),
    ...elves.filter(isCustom),
  ];
}
