import type { Elf } from "../types";

export type ElfDisplayRank = "S" | "A" | "B" | "C";
/** 一般頁面的參考評級；不更動命運之輪卡池及兩個特殊模式流程。 */
export function getElfDisplayRank(elf: Elf): ElfDisplayRank {
  const name = elf.name || "";
  const text = [elf.description, elf.soulMark?.description, ...(elf.skills || []).map(s => s.description)].join("\n");
  // 文本明定的 C 級攔截優先於舊存檔中錯誤的 S 標籤。
  if (/命運之輪[^。\n]{0,40}(?:C\s*級|特殊效果|專屬攔截)/i.test(text) ||
    ["悲歌.索比拉特", "帝皇之盾", "天蓬元帥", "六界神王", "索比斯", "皮皮", "八戒"].some(n => name.includes(n))) return "C";
  if (elf.destinyRank) return elf.destinyRank;
  if (["聖靈譜尼", "人皇·帝辛", "眾神之父·奧丁", "次元龍", "混濁海妖.布林克克", "柯爾霍德", "聖光斯嘉麗", "變革·馬爾修斯", "星皇", "混沌魔君索倫森", "湮滅之主・咤克斯", "異境神霆·雷伊"].some(n => name.includes(n))) return "S";
  if (["鎮魂.巴弗洛", "冰魄·柯爾德", "混沌·布萊克", "蟲后·奧佩婭", "魔獅迪露", "星光·", "譜尼", "王·"].some(n => name.includes(n))) return "A";
  // 未經逐隻語意／強度驗證的精靈不因技能數量或第五技能而自動升 S。
  const total = Object.values(elf.baseStats || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total >= 680 ? "A" : "B";
}

export const DISPLAY_RANK_NOTE = "一般頁面參考評級，非實裝完成度；命運之輪特殊效果固定 C。未列名者按種族值暫評，不因技能數量升 S。特殊模式原卡池暫不改。";
