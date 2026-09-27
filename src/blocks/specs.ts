// 各精靈的積木執行設定（逐隻對齊描述時在這裡登記）
// SKILL_MODE：技能名 → "blocks"（改用積木、不跑專屬程式）或 子句索引陣列（專屬程式＋指定子句用積木補）
// SOUL_MODE：精靈 id / 名稱 → "blocks"（魂印全部用積木）或 子句索引陣列（手寫魂印＋指定子句用積木補）
export const SKILL_MODE: Record<string, "blocks" | number[]> = {
  // 5003 天蓬元帥八戒
  "天河衝擊": "blocks", "殘軀鎖命": "blocks", "萬鈞鎮魂": "blocks", "混元護體": "blocks", "淨·天河倒懸": "blocks",
  // 5004 皮特薩拉羅
  "翎封禁之羽": "blocks", "翎萬羽歸宗": "blocks",
  // 5005 布萊克
  "雙重暗影": "blocks",
  // 5008 鎮魂.巴弗洛
  "贖魂讚詩": "blocks", "亂魂舞": "blocks", "鎖魂曲": "blocks",
  // 5007 混濁海妖·布林克克
  "深潛者盛宴": "blocks",
};
export const SOUL_MODE: Record<string, "blocks" | number[]> = {
  "5003": "blocks", // 天蓬元帥八戒
  "5004": "blocks", // 皮特薩拉羅
  "5005": "blocks", // 布萊克
  "5006": "blocks", // 星光·魔焰猩猩
  "5011": "blocks", // 星光·麗莎布布
  "5008": "blocks", // 鎮魂.巴弗洛
};
