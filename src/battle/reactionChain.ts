/**
 * 傷害因果鏈（2026-11-21 使用者規則：不設結算次數上限，改以「疏通」防止卡死）。
 *
 * 每個效果都記錄「引發它的反應者」清單（causeChain）：
 * - 出手（技能、道具等）本身是根：在根部要求的傷害，鏈是空的。
 * - 結算某個效果時，期間任何精靈「要求」的新傷害，都是對這個效果的反應：新傷害的鏈＝原鏈＋要求者。
 * - 受方的傷害前反應（減傷分流、汲取等）在這筆傷害的鏈底下執行，所以它要求的傷害也接在後面。
 * 同一條因果鏈裡，同一隻精靈只能反應一次：要求者已在鏈上時，這次要求不產生傷害。
 * （例：A 的傷害引發 B 反擊，B 的反擊引發 A 汲取，A 的汲取再引發 B 時，B 已在鏈上 → 停止。）
 * 結果：一次出手能引發的傷害筆數不設上限（扇出不限、無循環的長鏈也不限），但不可能形成無限互打。
 *
 * 模組層級狀態只在同步段內有效（呼叫端以 try/finally 還原），不跨 await。
 */
let parent: readonly string[] | null = null;
/** 正在處理哪隻精靈的傷害要求（同一要求內部的轉送，例如固定傷害改走真實傷害，不算第二次反應）。 */
let requesting: string | null = null;

/** 目前同步段所屬的因果鏈；null＝根部（不在任何效果結算或反應之中）。 */
export const currentCauseChain = (): readonly string[] | null => parent;

/** 在指定因果鏈下執行同步段（效果結算、傷害前反應）。 */
export function withCauseChain<T>(chain: readonly string[] | null | undefined, fn: () => T): T {
  const prev = parent, prevRequesting = requesting;
  parent = chain ?? [];
  requesting = null;
  try { return fn(); } finally { parent = prev; requesting = prevRequesting; }
}

/**
 * 某隻精靈要求造成傷害：回傳這筆傷害的因果鏈；drop＝要求者已在鏈上（同一條鏈裡第二次反應），不產生傷害。
 */
export function causeForDamageRequest(requester: string | undefined): { chain: readonly string[]; drop: boolean } {
  if (parent === null || !requester) return { chain: parent ?? [], drop: false };
  if (parent.includes(requester)) return { chain: parent, drop: true };
  return { chain: [...parent, requester], drop: false };
}

/** 以要求者身分執行一筆傷害要求：在這筆傷害的鏈底下跑傷害前反應；要求者已在鏈上時不產生傷害（回傳 0）。 */
export function guardDamageRequest<T>(requester: string, fn: () => T, dropped: T): T {
  if (!requester || requesting === requester) return fn();
  const cause = causeForDamageRequest(requester);
  if (cause.drop) return dropped;
  const prevParent = parent, prevRequesting = requesting;
  parent = cause.chain; requesting = requester;
  try { return fn(); } finally { parent = prevParent; requesting = prevRequesting; }
}
