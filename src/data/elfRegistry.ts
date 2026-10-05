export const ELF_ID_MAPPING: Record<string, string> = {
  // 譜尼（序號 300；舊序號 1000 保留相容）
  "puni_base": "300",
  "300": "300",
  "1000": "300",

  // 聖靈譜尼
  "puni": "5000",
  "5000": "5000",

  // 1. 悲歌.索比拉特
  "sad_song_sobirat": "5001",
  "1001": "5001",

  // 2. 帝皇之盾
  "imperial_shield": "5002",
  "1002": "5002",

  // 3. 天蓬元帥八戒
  "marshal_bajie": "5003",
  "1003": "5003",

  // 4. 皮特薩拉羅
  "pitesalaluo": "5004",
  "1004": "5004",

  // 5. 布萊克
  "warrior_black": "5005",
  "default_3": "5005",
  "default_7": "5005",
  "1026": "5005",

  // 6. 星光·魔焰猩猩
  "starlight_monkey": "5006",
  "1005": "5006",

  // 7. 混濁海妖.布林克克
  "brinkk": "5007",
  "1006": "5007",
  "1033": "5007",

  // 8. 鎮魂.巴弗洛
  "default_8": "5008",
  "default_11": "5008",
  "1027": "5008",
  "1032": "5008",

  // 9. 誑獅魔軀.魔獅迪露
  "default_9": "5009",
  "default_12": "5009",
  "1028": "5009",

  // 10. 星光·魯斯王
  "starlight_rus": "5010",
  "1007": "5010",

  // 11. 星光·麗莎布布
  "starlight_lisa": "5011",
  "1008": "5011",

  // 12. 冰魄·柯爾德
  "ice_king_keld": "5012",
  "1009": "5012",
  "1034": "5012",

  // 13. 柯爾霍德
  "keerhode": "5013",
  "1010": "5013",

  // 14. 聖光斯嘉麗
  "holy_light_scarlett": "5014",
  "1011": "5014",
  "1035": "5014",

  // 15. 混沌·布萊克
  "chaos_blake": "5015",
  "1012": "5015",

  // 16. 變革·馬爾修斯
  "mars_reform": "5016",
  "1013": "5016",

  // 17. 人皇·帝辛
  "dixin": "5017",
  "1014": "5017",
  "1031": "5017",

  // 18. 蟲后·奧佩婭
  "opeia": "5018",
  "1015": "5018",

  // 19. 眾神之父·奧丁
  "odin": "5019",
  "1016": "5019",
  "1030": "5019",

  // 20. 皮皮
  "pipi": "5020",
  "default_24": "5020",
  "1029": "5020",

  // 21. 治癒.龍魂再臨 次元龍
  "default_22": "5021",
  "default_25": "5021",

  // 22. 無序.六刃
  "wuxu_liuren": "5022",
  "1017": "5022",

  // 23. 無序·蝕言
  "default_27": "5023",

  // 24. 湮滅之主・咤克斯
  "zhakesi": "5024",
  "1018": "5024",

  // 25. 恐懼的化身·咤克斯
  "zhakesi_fear": "5025",
  "1019": "5025",
  "1037": "5025",

  // 26. 無序.墜星
  "wuxu_zhuixing": "5026",
  "1020": "5026",

  // 27. 蓓麗安特
  "beliente": "5027",
  "1021": "5027",
  "1038": "5027",

  // 28. 怒濤·滄嵐
  "canglan": "5028",
  "1022": "5028",
  "1039": "5028",

  // 29. 異境神霆·雷伊
  "otherworld_thunder_rey": "5029",
  "5029": "5029",
  "holy_miles": "5030",
  "5030": "5030",
  "liujie": "5031",
  "5031": "5031",

  // 30. elf_source_files 新增精靈（先登記資料，效果依專屬 registry 逐條補全）
  "astral_aesfia": "5032",
  "5032": "5032",
  "星核寰宇·艾斯菲亞": "5032",
  "星核寰宇.艾斯菲亞": "5032",
  "astral_aesfig": "5033",
  "5033": "5033",
  "星軌重構·艾斯菲格": "5033",
  "星軌重構.艾斯菲格": "5033",
  "mogos_overlord": "5034",
  "5034": "5034",
  "邪靈主宰·摩哥斯": "5034",
  "邪靈主宰.摩哥斯": "5034",
};

export function getNumericElfId(originalId: string, elfName: string): string {
  if (ELF_ID_MAPPING[originalId]) return ELF_ID_MAPPING[originalId];
  if (originalId && !isNaN(Number(originalId))) return originalId;
  return originalId;
}

export function applyElfOverrides(elf: any, defaultElves: any[]) {
  let updated = { ...elf };
  let needsRecalc = false;

  if (!updated.isCustom && (updated.name === "星光·魯斯王" || updated.id === "5010" || updated.id === "1007" || updated.id === "starlight_rus")) {
    updated.baseStats = { hp: 170, atk: 142, def: 114, spatk: 70, spdef: 114, speed: 135 };
    needsRecalc = true;
  }

  if (updated.name === "混濁海妖.布林克克" || updated.id === "5007" || updated.id === "1006" || updated.id === "brinkk") {
    if (updated.soulMark && (updated.soulMark.name === "契" || updated.soulMark.badgeChar === "契")) {
      updated.soulMark.name = "濁";
      updated.soulMark.badgeChar = "濁";
    }
  }

  const defMatch = defaultElves.find((de: any) => de.id === elf.id || de.name === elf.name);
  // 5029 是內建規則模板：舊版曾把「神明／雷神」合併成摘要並寫入 localStorage。
  // 載入時同步權威描述與機制欄位，但保留玩家自行調整的配裝、學習力與技能欄位。
  if (defMatch && (updated.id === "5029" || updated.name === "異境神霆·雷伊")) {
    updated = {
      ...updated,
      name: defMatch.name,
      type: defMatch.type,
      path: defMatch.path,
      category: defMatch.category,
      isAlienElf: defMatch.isAlienElf,
      soulMark: defMatch.soulMark,
      trait: defMatch.trait,
      alienTraits: defMatch.alienTraits,
      survivalRule: defMatch.survivalRule,
      artPresentation: defMatch.artPresentation,
      suppressAbnormalSideEffectsWhenParalyzed: defMatch.suppressAbnormalSideEffectsWhenParalyzed,
      ppLimitIgnoredWhenParalyzedTurns: defMatch.ppLimitIgnoredWhenParalyzedTurns,
      useAtkSpAtkSumForAttacks: defMatch.useAtkSpAtkSumForAttacks,
      treatOpponentBoostAsDoubleDrop: defMatch.treatOpponentBoostAsDoubleDrop,
      ownTurnEffectsUnclearable: defMatch.ownTurnEffectsUnclearable,
      collapseOpponentTurnEffectsToOne: defMatch.collapseOpponentTurnEffectsToOne,
      paralyzeBothOnOwnStatChangeTurns: defMatch.paralyzeBothOnOwnStatChangeTurns,
    };
  }
  // 內建巴弗洛曾被舊版隊伍快照保存成缺少「魂殤」定義的描述；
  // 僅同步內建精靈的權威文字，不覆蓋使用者自訂精靈。
  if (defMatch && !updated.isCustom && (updated.id === "5008" || updated.name === "鎮魂.巴弗洛")) {
    updated = {
      ...updated,
      description: defMatch.description,
      soulMark: defMatch.soulMark,
    };
  }
  if (defMatch && defMatch.alienTraits && !updated.alienTraits) {
    updated.alienTraits = defMatch.alienTraits;
    updated.isAlienElf = defMatch.isAlienElf || true;
  }

  if (updated.name === "湮滅之主・咤克斯" || updated.id === "5024" || updated.id === "1018" || updated.id === "zhakesi" || updated.soulMark?.name === "咤") {
    delete updated.alienTraits;
    delete updated.isAlienElf;
    delete updated.category;
    updated.isAlienElf = false;
  }

  return { updated, needsRecalc };
}
