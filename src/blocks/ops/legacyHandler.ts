// legacy_handler：把仍由舊專屬程式（技能 handler／魂印 handler／特質引擎）執行的定義，包成一個唯讀 Kit 區塊。
// 過渡用途（未拆解）：UI／稽核看得到、遷移進度可量測；執行仍只走原路徑，絕不雙重執行。
//
// 設計要點
// 1. 合約：legacy_handler{elf,key,kind}；一個 Kit 只能是單一 legacy_handler 動作（見 legacyActionIssue / isLegacyWrappedKit）。
// 2. 閘門：包裝定義的 effectRoute 恆為 'registry'（effectConnection 的通用例外），舊 handler 仍由原本路徑執行一次；
//    Kit 本身不經 runConnectedKit 執行。因此即使資料誤設 effectMode:'kit' 也不會把舊 handler 跳過。
// 3. 執行端（本檔 legacyHandlerOperations）：僅在「Kit 真的被當 kit 執行、舊路徑被關閉」（技能 effectMode==='kit'）時，
//    才依 elf+key 查註冊表呼叫原 handler；其餘情況視為舊路徑已執行，回傳 true、不再呼叫（避免雙重執行）。
// 本檔刻意不 import 戰鬥註冊表（避免與 runtime 循環）；解析器由 battleEventRegistry 啟動時注入。
import type { Act, Clause } from '../model';
import type { KitEntry } from '../../effects/effectSystem.schema';

export const LEGACY_HANDLER_OP = 'legacy_handler';
export const LEGACY_HANDLER_KINDS = ['skill', 'soul', 'trait', 'carry'] as const;
export type LegacyHandlerKind = typeof LEGACY_HANDLER_KINDS[number];
export const LEGACY_ACTION_FIELDS: Record<string, readonly string[]> = { [LEGACY_HANDLER_OP]: ['elf', 'key', 'kind'] };

/** 解析結果：skill 為可直接呼叫的函式；engine 表示由生命週期／特質引擎驅動（不可由 op 另行呼叫）。 */
export type LegacyHandlerTarget = { drive: 'call'; call: (ctx: any) => unknown } | { drive: 'engine' };
type Resolver = (elf: string, key: string, kind: LegacyHandlerKind) => LegacyHandlerTarget | null;
let resolver: Resolver | null = null;
export function setLegacyHandlerResolver(next: Resolver) { resolver = next; }
export function resolveLegacyHandler(elf: string, key: string, kind: LegacyHandlerKind) { return resolver ? resolver(elf, key, kind) : null; }
export function hasLegacyHandlerResolver() { return resolver !== null; }

const isKind = (v: unknown): v is LegacyHandlerKind => (LEGACY_HANDLER_KINDS as readonly string[]).includes(v as string);

/** 合約驗證（由 sequenceContract 在動作層呼叫）。非 legacy_handler 動作回傳 null。 */
export function legacyActionIssue(op: string, p: any, clause: any, stmt: any, depth: number, inMark: boolean): string | null {
  if (op !== LEGACY_HANDLER_OP) return null;
  if (depth > 0 || inMark) return '專屬機制包裝只能是最外層唯一動作';
  for (const k of ['elf', 'key']) if (typeof p?.[k] !== 'string' || !p[k] || p[k].length > 200) return '專屬機制包裝缺少 elf／key';
  if (!isKind(p.kind)) return '專屬機制包裝的 kind 不明';
  if (!Array.isArray(clause?.body) || clause.body.length !== 1 || clause.cond?.length || stmt.cond?.length || stmt.chain || stmt.elseActs?.length || stmt.acts.length !== 1)
    return '專屬機制包裝必須單獨成一個無條件動作，不得與其他動作混用';
  const wantTrig = p.kind === 'soul' || p.kind === 'trait' ? 'passive' : 'use';
  if (clause.trig !== wantTrig) return `專屬機制包裝（${p.kind}）需使用 ${wantTrig} 時點`;
  // 註冊表存在時必須找得到原 handler；啟動前（純資料打包）無註冊表，改由稽核腳本全量核對。
  if (resolver && !resolver(p.elf, p.key, p.kind)) return `找不到原專屬機制：${p.kind}／${p.key}`;
  return null;
}

/** 取出 Kit 詞條中的 legacy_handler 動作（單一動作的 effect_sequence），否則 null。 */
export function legacyActOf(entry: KitEntry | undefined): Act | null {
  if (!entry || entry.codeId !== 'effect_sequence') return null;
  const body = entry.params?.clause?.body;
  if (!Array.isArray(body) || body.length !== 1) return null;
  const acts = body[0]?.acts;
  return Array.isArray(acts) && acts.length === 1 && acts[0]?.op === LEGACY_HANDLER_OP && !body[0].elseActs?.length ? acts[0] : null;
}
/** 整份 Kit 都是單一 legacy_handler 包裝。 */
export function isLegacyWrappedKit(kit?: readonly KitEntry[] | null): boolean {
  return !!kit && kit.length === 1 && !!legacyActOf(kit[0]);
}
/** 供編輯器／檢視使用的子句（含顯示名稱）；非包裝回傳 null。 */
export function legacyWrappedClause(kit?: readonly KitEntry[] | null): Clause | null {
  return isLegacyWrappedKit(kit) ? (kit![0].params.clause as Clause) : null;
}
export const LEGACY_TOOLTIP = '此為原專屬程式包裝，尚未拆成通用積木，不可細調；執行仍由原機制完成。';

const running = new Set<string>();
/** 積木執行端（併入 runtime 的 OPS）。 */
export function legacyHandlerOperations() {
  return {
    [LEGACY_HANDLER_OP]: (ctx: any, p: any): boolean => {
      const kind = p?.kind as LegacyHandlerKind;
      const target = isKind(kind) ? resolveLegacyHandler(p.elf, p.key, kind) : null;
      if (!target) { ctx.addLog?.(`【效果待接通】專屬機制 ${p?.key}：找不到原 handler。`, 'effect'); return false; }
      // 舊路徑仍在運作（技能 effectMode 非 kit，或魂印／特質由生命週期驅動）＝已經執行過，不重複呼叫。
      if (target.drive !== 'call' || ctx.skill?.effectMode !== 'kit') return true;
      const guard = `${p.elf}\u0000${p.key}\u0000${p.kind}`;
      if (running.has(guard)) return true;
      running.add(guard);
      try { target.call(ctx); return true; } finally { running.delete(guard); }
    },
  };
}
