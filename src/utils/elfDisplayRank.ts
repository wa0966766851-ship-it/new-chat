import type { Elf } from "../types";

export type ElfDisplayRank = "S" | "A" | "B" | "C";

/**
 * 分級規則表：唯一來源。getElfDisplayRank／explainElfDisplayRank 與介面上的規則說明
 * （destinyRankMeta.describeRankRule）都讀這張表，不得在別處複製名單或門檻。
 */
export const DISPLAY_RANK_RULES = {
  /** 文本明定的命運之輪 C 級（攔截）標記，優先於舊存檔的 S 標籤。 */
  cTextLabel: "命運之輪…C 級／特殊效果／專屬攔截",
  cTextPattern: /命運之輪[^。\n]{0,40}(?:C\s*級|特殊效果|專屬攔截)/i,
  cNames: ["悲歌.索比拉特", "帝皇之盾", "天蓬元帥", "六界神王", "索比斯", "皮皮", "八戒"],
  sNames: ["聖靈譜尼", "人皇·帝辛", "眾神之父·奧丁", "次元龍", "混濁海妖.布林克克", "柯爾霍德", "聖光斯嘉麗", "變革·馬爾修斯", "星皇", "混沌魔君索倫森", "湮滅之主・咤克斯", "異境神霆·雷伊"],
  aNames: ["鎮魂.巴弗洛", "冰魄·柯爾德", "混沌·布萊克", "蟲后·奧佩婭", "魔獅迪露", "星光·", "譜尼", "王·"],
  /** 使用者 2026-10-18 裁定：皮特薩拉羅為 B 級（未列名精靈不得因種族值 735 誤升 A/S）。 */
  bNames: ["皮特薩拉羅"],
  /** 未列名精靈：種族值總和達此門檻為 A，否則 B。 */
  aTotalThreshold: 680,
} as const;

export type DisplayRankSource = "text-c" | "name-c" | "preset" | "name-s" | "name-a" | "name-b" | "total-a" | "total-b";

/** 回傳評級與判定來源（圖紙模式顯示用）；規則沒有第二份拷貝。 */
export function explainElfDisplayRank(elf: Elf): { rank: ElfDisplayRank; source: DisplayRankSource } {
  const R = DISPLAY_RANK_RULES;
  const name = elf.name || "";
  const text = [elf.description, elf.soulMark?.description, ...(elf.skills || []).map(s => s.description)].join("\n");
  // 文本明定的 C 級攔截優先於舊存檔中錯誤的 S 標籤。
  if (R.cTextPattern.test(text)) return { rank: "C", source: "text-c" };
  if (R.cNames.some(n => name.includes(n))) return { rank: "C", source: "name-c" };
  if (elf.destinyRank) return { rank: elf.destinyRank, source: "preset" };
  if (R.sNames.some(n => name.includes(n))) return { rank: "S", source: "name-s" };
  if (R.aNames.some(n => name.includes(n))) return { rank: "A", source: "name-a" };
  // 未經逐隻語意／強度驗證的精靈不因技能數量或第五技能而自動升 S。
  if (R.bNames.some(n => name.includes(n))) return { rank: "B", source: "name-b" };
  const total = Object.values(elf.baseStats || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total >= R.aTotalThreshold ? { rank: "A", source: "total-a" } : { rank: "B", source: "total-b" };
}

/** 一般頁面的參考評級；不更動命運之輪卡池及兩個特殊模式流程。 */
export function getElfDisplayRank(elf: Elf): ElfDisplayRank {
  return explainElfDisplayRank(elf).rank;
}

export const DISPLAY_RANK_NOTE = "一般頁面參考評級，非實裝完成度；命運之輪特殊效果固定 C。未列名者按種族值暫評，不因技能數量升 S。特殊模式原卡池暫不改。";
