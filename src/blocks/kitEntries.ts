import { ATOMS } from "../effects/effectRunner";
import type { KitEntry } from "../effects/effectSystem.schema";

/** 單獨匯出，避免畫布僅為分類詞條就載入整份編輯器及資料庫。 */
export const isBlocklyEntry = (entry: KitEntry) =>
  !!entry && entry.codeId !== "custom" && entry.codeId in ATOMS;
