// 各精靈的積木執行設定（逐隻對齊描述時在這裡登記）
// SKILL_MODE：技能名 → "blocks"（改用積木、不跑專屬程式）或 子句索引陣列（專屬程式＋指定子句用積木補）
// SOUL_MODE：精靈 id / 名稱 → "blocks"（魂印全部用積木）或 子句索引陣列（手寫魂印＋指定子句用積木補）
export const SKILL_MODE: Record<string, "blocks" | number[]> = {
  // 5003 天蓬元帥八戒
  "天河衝擊": "blocks", "殘軀鎖命": "blocks", "萬鈞鎮魂": "blocks", "混元護體": "blocks", "淨·天河倒懸": "blocks",
  // 5004 皮特薩拉羅（主技能 5/5 全解析；千鳥俱寂／翎羽風暴／千翎破陣無專屬 handler，本來就走積木，此處明確鎖定）
  "翎封禁之羽": "blocks", "翎萬羽歸宗": "blocks", "千鳥俱寂": "blocks", "翎羽風暴": "blocks", "千翎破陣": "blocks",
  // 5005 布萊克（主技能 5/5 全解析；夜魔之球／幽冥頓悟／狂夜屠戮／夜魔神襲無專屬 handler，本來就走積木，此處明確鎖定）
  "雙重暗影": "blocks", "夜魔之球": "blocks", "幽冥頓悟": "blocks", "狂夜屠戮": "blocks", "夜魔神襲": "blocks",
  // 5006 星光·魔焰猩猩
  "星光·音速火拳": "blocks", "星光·冥想": "blocks", "星光·不滅之火": "blocks", "星光·覺醒": "blocks", "星光·魔焰裂空": "blocks",
  // 5008 鎮魂.巴弗洛（主技能 5/5 全解析；引魂咏／訣別無專屬 handler，本來就走積木，此處明確鎖定）
  "贖魂讚詩": "blocks", "亂魂舞": "blocks", "鎖魂曲": "blocks", "引魂咏": "blocks", "訣別": "blocks",
  // 5007 混濁海妖·布林克克（深潛者盛宴已積木化；其餘 4 技走舊 BRINKK_SKILLS handler，維持 handler，不登記）
  "深潛者盛宴": "blocks",
  // 5011 星光·麗莎布布（技能 25/25 全解析，無專屬 handler，本來就走積木；此處明確登記鎖定）
  "星光·究極吸取": "blocks", "星光·光合作用": "blocks", "星光·花草能量": "blocks", "星光·飛葉風暴": "blocks", "星光·金光綠葉": "blocks",
};
export const SOUL_MODE: Record<string, "blocks" | number[]> = {
  "5003": "blocks", // 天蓬元帥八戒
  "5004": "blocks", // 皮特薩拉羅
  "5005": "blocks", // 布萊克
  "5006": "blocks", // 星光·魔焰猩猩
  "5011": "blocks", // 星光·麗莎布布
  "5008": "blocks", // 鎮魂.巴弗洛
  // 5007 混濁海妖.布林克克：魂印含額外精靈克塔亞特與消逝規則（0/11 未解析），維持 handler/fallback，不登記
};
