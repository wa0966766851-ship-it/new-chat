/**
 * 戰鬥百科「BOSS 類」異常的子分類（依性質；每條只屬一類）。
 * 涵蓋全部 BOSS_ONLY 狀態：免疫、神話與 36 條原廠首領特性（src/data/bossTraits.ts）。
 * 新增 BOSS 特性時必須在此歸類，測試會檢查「不漏、不重複」。
 */
export interface BossStatusGroup { id: string; label: string; hint: string; members: readonly string[] }

export const BOSS_STATUS_GROUPS: readonly BossStatusGroup[] = [
  { id: "defense", label: "防禦／免疫類", hint: "減傷、閃避、擋下或無效化對手的攻擊與技能",
    members: ["免疫", "特性·減傷", "特性·致盲", "特性·封魔", "特性·格擋", "特性·技能無效", "特性·戒備", "特性·堅毅", "特性·免傷", "特性·反傷", "特性·硬化"] },
  { id: "offense", label: "攻擊強化類", hint: "提高傷害、致命一擊與追加傷害",
    members: ["特性·增傷", "特性·要害探尋", "特性·鎖定", "特性·秒殺", "特性·鋒銳", "特性·進化"] },
  { id: "disrupt", label: "干擾／削弱類", hint: "削弱、驅散、吸取對手的能力，或施加異常與限制",
    members: ["特性·腐化", "特性·強化", "特性·弱化", "特性·驅散", "特性·消除強化", "特性·嫉妒", "特性·貪婪", "特性·消除回合", "特性·減PP", "特性·施加異常"] },
  { id: "sustain", label: "續航／恢復類", hint: "回復體力、吸血、提高體力上限或復活",
    members: ["特性·恢復", "特性·吸血", "特性·生命汲取", "特性·癒合", "特性·暴食", "特性·復甦"] },
  { id: "speed", label: "速度／先制類", hint: "先制與先手",
    members: ["特性·迅捷", "特性·疾行"] },
  { id: "special", label: "特殊機制類", hint: "改變戰鬥規則的獨特機制",
    members: ["神話", "特性·覺醒", "特性·系別變化"] },
];

const GROUP_OF: Record<string, string> = Object.fromEntries(BOSS_STATUS_GROUPS.flatMap(g => g.members.map(m => [m, g.id])));
export const bossGroupOf = (status: string): string | undefined => GROUP_OF[status];
