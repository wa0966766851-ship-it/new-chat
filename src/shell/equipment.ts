/**
 * 裝備存取層 — 與 Legacy 共用同一份 localStorage
 *
 * Legacy 的寫法（StartScreen.tsx）：
 *   localStorage.setItem("seer_p1_suit", val)
 *   localStorage.setItem("seer_p1_eyewear", val)
 *   localStorage.setItem("seer_p1_title", val)
 *   （p2 同理）
 *
 * 這裡不另外設計格式，直接讀寫同一組 key。
 * 所以：Aegis 背包改裝備 → 切回 Legacy 立刻看到；反之亦然。
 *
 * 注意：這裡只負責「選哪一件」，實際的屬性加成計算仍在
 * src/utils/elfStats.ts（由 calculateElfStats 讀 elf 上的設定），
 * 兩邊共用同一套計算，不重複實作。
 */

export type EquipmentSlot = "suit" | "eyewear" | "title";
export type Side = "p1" | "p2";

const KEY = (side: Side, slot: EquipmentSlot) => `seer_${side}_${slot}`;

export interface EquipmentSet {
  suit: string;
  eyewear: string;
  title: string;
}

const EMPTY: EquipmentSet = { suit: "", eyewear: "", title: "" };

/** 讀取某一側的裝備（三個欄位一次拿） */
export function readEquipment(side: Side): EquipmentSet {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    return {
      suit: window.localStorage.getItem(KEY(side, "suit")) ?? "",
      eyewear: window.localStorage.getItem(KEY(side, "eyewear")) ?? "",
      title: window.localStorage.getItem(KEY(side, "title")) ?? "",
    };
  } catch {
    return { ...EMPTY };
  }
}

/** 寫入單一裝備（傳空字串 = 卸下） */
export function writeEquipment(side: Side, slot: EquipmentSlot, id: string): EquipmentSet {
  const next = { ...readEquipment(side), [slot]: id };
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(KEY(side, slot), id);
  } catch {
    // 寫入失敗時回傳實際存檔，避免畫面宣稱成功、開戰卻讀到舊裝備。
    return readEquipment(side);
  }
  return next;
}

/** 卸下單一裝備 */
export function clearEquipment(side: Side, slot: EquipmentSlot): EquipmentSet {
  return writeEquipment(side, slot, "");
}

/** 是否已裝備某件 */
export function isEquipped(side: Side, slot: EquipmentSlot, id: string): boolean {
  return readEquipment(side)[slot] === id;
}
