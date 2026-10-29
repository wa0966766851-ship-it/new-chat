import type { Elf } from "../types";
import { SEER_TYPES } from "./statCalculator";
import { matchesElfQuery, normalizeElfSearch } from "./elfSearch";
import { getElfDisplayRank, type ElfDisplayRank } from "./elfDisplayRank";
import { fifthSkillSlot } from "../battle/skillSlot";
import { newestElfKeys, newestFirst } from "../shell/elfPool";

/**
 * 精靈清單篩選／排序的單一來源：首頁背包、星蝕回廊、新版 UI 的挑選器與圖鑑都走這裡（ElfFilterBar / useElfFilter）。
 * 搜尋沿用全站契約 matchesElfQuery；屬性、分級、特徵與排序在其上疊加（皆為 AND）。
 */
export type ElfTypeMode = "all" | "any";
export type ElfTypeKind = "any" | "single" | "dual";
export type ElfFlag = "new" | "fifth" | "custom" | "inTeam";
export type ElfSortKey = "default" | "id" | "name" | "total" | "newest";

export interface ElfFilterSpec {
  query: string;
  /** 已選屬性（可多選） */
  types: string[];
  /** all＝需同時具備所有已選屬性（複合）；any＝符合其一即可 */
  typeMode: ElfTypeMode;
  /** 單屬性／雙屬性（含兩種以上） */
  kind: ElfTypeKind;
  ranks: ElfDisplayRank[];
  flags: ElfFlag[];
  sort: ElfSortKey;
  desc: boolean;
}
export const DEFAULT_ELF_FILTER: ElfFilterSpec = { query: "", types: [], typeMode: "all", kind: "any", ranks: [], flags: [], sort: "default", desc: false };

export const ELF_RANKS: readonly ElfDisplayRank[] = ["S", "A", "B", "C"];
export const ELF_FLAG_LABEL: Record<ElfFlag, string> = { new: "新精靈", fifth: "有第五技能", custom: "自訂精靈", inTeam: "已編入" };
export const ELF_FLAG_HINT: Record<ElfFlag, string> = {
  new: "清單尾端最新加入的內建精靈", fifth: "技能列含第五技能標記", custom: "自訂（custom_）或標記為自訂的精靈", inTeam: "已在目前隊伍中",
};
export const ELF_SORT_LABEL: Record<ElfSortKey, string> = { default: "預設", id: "編號", name: "名稱", total: "種族值總和", newest: "新增順序" };

const KNOWN = [...SEER_TYPES].sort((a, b) => b.length - a.length);
/** 屬性字串拆成各屬性：「地面.戰鬥」「混沌·暗影」→ 兩項；「次元龍」→ 次元＋龍。 */
export function elfTypeParts(type: unknown): string[] {
  const out: string[] = [];
  for (const tok of String(type ?? "").normalize("NFKC").split(/[.·・‧、/／+＋\s]+/).filter(Boolean)) {
    if ((SEER_TYPES as readonly string[]).includes(tok)) { out.push(tok); continue; }
    const pieces: string[] = []; let rest = normalizeElfSearch(tok);
    while (rest) { const hit = KNOWN.find(k => rest.startsWith(normalizeElfSearch(k))); if (!hit) { pieces.length = 0; break; } pieces.push(hit); rest = rest.slice(normalizeElfSearch(hit).length); }
    out.push(...(pieces.length ? pieces : [tok]));
  }
  return [...new Set(out)];
}

const isCustom = (e: Partial<Elf>) => String(e.id ?? "").startsWith("custom_") || !!e.isCustom;
export const elfBaseTotal = (e: Partial<Elf>) => Object.values(e.baseStats || {}).reduce((s: number, v) => s + (Number(v) || 0), 0);
const idNumber = (e: Partial<Elf>) => { if (isCustom(e)) return Number.MAX_SAFE_INTEGER; const n = Number((Number(e.seerId)>0 ? e.seerId : undefined) ?? String(e.id ?? "").replace(/\D/g, "")); return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER; };

export interface ElfFilterContext {
  /** 「新精靈」的鍵；省略時由傳入清單推算 */
  fresh?: ReadonlySet<string>;
  /** 「已編入」的鍵（id 或名稱） */
  inTeam?: ReadonlySet<string>;
}
const keyOf = (e: Partial<Elf>) => String(e.id ?? e.name);

export function elfFilterActiveCount(s: ElfFilterSpec): number {
  return s.types.length + (s.kind !== "any" ? 1 : 0) + s.ranks.length + s.flags.length;
}

export function matchesElfSpec(e: Elf, s: ElfFilterSpec, ctx: ElfFilterContext & { fresh: ReadonlySet<string> }): boolean {
  if (!matchesElfQuery(e, s.query)) return false;
  const parts = elfTypeParts(e.type);
  if (s.types.length) {
    const has = (t: string) => parts.some(part=>normalizeElfSearch(part)===normalizeElfSearch(t));
    if (!(s.typeMode === "all" ? s.types.every(has) : s.types.some(has))) return false;
  }
  if (s.kind === "single" && parts.length !== 1) return false;
  if (s.kind === "dual" && parts.length < 2) return false;
  if (s.ranks.length && !s.ranks.includes(getElfDisplayRank(e))) return false;
  return s.flags.every(f =>
    f === "new" ? ctx.fresh.has(keyOf(e)) :
    f === "fifth" ? fifthSkillSlot(e.skills || []) >= 0 :
    f === "custom" ? isCustom(e) :
    !!ctx.inTeam?.has(keyOf(e)) || !!ctx.inTeam?.has(String(e.name)));
}

/** 篩選＋排序。list 應為完整清單（「新精靈」與「新增順序」以它的尾端為準）。 */
export function applyElfFilter<E extends Elf>(list: readonly E[], s: ElfFilterSpec, opts: ElfFilterContext = {}): E[] {
  const fresh = opts.fresh ?? newestElfKeys(list);
  let out = list.filter(e => matchesElfSpec(e, s, { ...opts, fresh }));
  if (s.sort === "default") return out;
  if (s.sort === "newest") {
    const order = new Map(newestFirst(list).map((e, i) => [e, i]));
    out = [...out].sort((a, b) => order.get(a)! - order.get(b)!);
  } else {
    const cmp = s.sort === "id" ? (a: E, b: E) => idNumber(a) - idNumber(b)
      : s.sort === "name" ? (a: E, b: E) => String(a.name).localeCompare(String(b.name), "zh-Hant")
      : (a: E, b: E) => elfBaseTotal(a) - elfBaseTotal(b);
    out = [...out].sort(cmp);
  }
  return s.desc ? out.reverse() : out;
}
