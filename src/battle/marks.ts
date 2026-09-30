
export interface Mark {
  id: string;            // 唯一鍵，例如 "delu_shackles"
  displayChar: string;   // 徽章上顯示的字/短標籤，例如 "枷"
  count: number;         // 徽章旁的數字
  name: string;          // 詳細彈窗的標題，例如 "魔軀枷鎖"
  description: string;   // 詳細彈窗內文
  source: string;        // 來源標註，例如 "誑獅魔軀.魔獅迪露 / 獅"
  /** 以下欄位只供顯示與稽核使用，不參與既有戰鬥結算。 */
  unit?: "層" | "道" | "點" | "篇" | "枚" | "株" | "回合";
  maxCount?: number;
  remainingRounds?: number;
  clearable?: boolean;
  persistsOffField?: boolean;
  /** 陣營作用域必須明確宣告；下場保留本身不等於全隊共享。 */
  scope?: "elf" | "team";
  triggerNode?: string;
  polarity?: "positive" | "negative" | "neutral";
  iconTag?: string;
  effects?: {
    damageTakenIncreasePercentPerStack?: number; // 每層造成受到傷害提升的百分比(如0.02代表2%)
    nonTrueDamageDealtMultiplier?: number;   // 自身造成非真實傷害(固定/百分比/真實)的倍率，如0.8代表降低20%
    nonTrueDamageTakenMultiplier?: number;   // 自身受到非真實傷害的倍率，如1.4代表提升40%
    guaranteedMaxHpDamageChance?: number;    // 每次受到攻擊時，觸發"傷害不低於當前體力上限"的機率
    poemHpSnapshots?: number[];
    weightIncreasePercentPerStack?: number; // 每層體重 +X（2.0 = +200%）
    heightIncreasePercentPerStack?: number;
    weightMultiplier?: number;
    heightMultiplier?: number;              // 詩章清單，每個元素是該篇詩章產生當下的體力上限
    /** 回合結束時，每層按最大體力比例直接調整體力（不是傷害）。 */
    hpAdjustmentMaxHpRatioPerStack?: number;
    /** 積木印記定義的來源精靈。 */
    blkDef?: string;
    blkTurns?: number;
    [key: string]: any;
  };
  /** 精靈專屬印記的持有者；未填代表隊伍／陣營級印記。 */
  ownerBattleId?: string;
  /** 資源型佔位（例如尚未啟用的異能值）在0時仍需顯示。 */
  visibleWhenZero?: boolean;
}

/**
 * 已確認語意的印記顯示／層數規格。
 * 集中在此處可避免各 handler 忘記上限，或 UI 把「道／篇」一律顯示成「層」。
 */
export const MARK_DEFINITIONS: Record<string, Partial<Mark>> = {
  "blk_魂殤": {
    displayChar: "殤", name: "魂殤", unit: "道", maxCount: 4,
    clearable: false, persistsOffField: false, triggerNode: "round_end", polarity: "negative",
    description: "上限4道；回合結束時每道令持有者體力調整減少最大體力的25%；下場後消失。",
  },
  "blk_永恆之水": {
    displayChar: "水", name: "永恆之水", unit: "道", maxCount: 8,
    clearable: false, persistsOffField: true, polarity: "positive",
  },
  "blk_千秋一淚": {
    displayChar: "淚", name: "千秋一淚", unit: "道", maxCount: 4,
    clearable: false, persistsOffField: true, polarity: "negative",
  },
  guardian_shield_mark: { unit: "層", maxCount: 4, clearable: false, polarity: "positive", triggerNode: "round_end" },
  poem_chapter: { unit: "篇", clearable: false, persistsOffField: true, polarity: "positive" },
  keld_soul: { unit: "道", maxCount: 3, clearable: false, persistsOffField: true, polarity: "positive" },
  delu_shackles: { unit: "道", maxCount: 5, clearable: false, persistsOffField: true, polarity: "negative" },
  tiwaz_rune: { unit: "枚", maxCount: 1, clearable: false, persistsOffField: true, polarity: "positive" },
  bahuang_mark: {
    displayChar: "荒", name: "八荒", unit: "層", maxCount: 9,
    clearable: false, persistsOffField: true, polarity: "positive",
    description: "帝辛專屬層數；最高9層，各層解鎖效果依魂印描述結算。",
  },
  fumo_mark: {
    displayChar: "伏", name: "伏魔印記", unit: "層",
    clearable: false, persistsOffField: true, polarity: "positive",
    description: "帝辛專屬印記；計算已解鎖的八荒效果時，依層數強化效果，但不能提前解鎖高層效果。",
  },
  duomo_mark: {
    displayChar: "墮", name: "墮魔印記", unit: "層",
    clearable: false, persistsOffField: true, polarity: "negative",
    description: "帝辛附加給對手的印記；八荒達到指定層數後會強化相關效果。",
  },
  rey_alien_energy: {
    displayChar: "異", name: "異能值", unit: "點",
    clearable: false, persistsOffField: true, polarity: "neutral", visibleWhenZero: true,
    description: "異能值系統預留欄位；目前只顯示數值，不產生任何戰鬥效果。",
  },
  scarlett_holy_light: { scope: "team", unit: "層", maxCount: 3, clearable: false, persistsOffField: true, polarity: "positive" },
  // 魔王咒怨是「達到5層」而非「上限5層」；部分技能明確要求高於5層，不能截斷。
  demon_grudge: { scope: "team", persistsOffField: true, unit: "層", clearable: false, polarity: "positive" },
  fear_seed: { scope: "team", persistsOffField: true, unit: "層", maxCount: 5, clearable: false, polarity: "negative" },
  fear_flower: { scope: "team", persistsOffField: true, unit: "株", maxCount: 1, clearable: false, polarity: "negative" },
};

export function normalizeMark(mark: Mark): Mark {
  const def = MARK_DEFINITIONS[mark.id] || {};
  const maxCount = mark.maxCount ?? def.maxCount;
  const count = Math.max(0, Math.min(maxCount ?? Number.POSITIVE_INFINITY, mark.count));
  return {
    scope: "elf",
    persistsOffField: false,
    ...def,
    ...mark,
    count,
    effects: { ...(def.effects || {}), ...(mark.effects || {}) },
  };
}

/**
 * 設置印記。若 id 已存在則覆蓋，否則新增。
 */
export function setMark(marks: Mark[], mark: Mark): Mark[] {
  const normalized = normalizeMark(mark);
  // 精靈專屬印記以「印記 id + 持有者」為鍵；同隊兩隻精靈可各自持有同名印記。
  // 未指定持有者者仍是陣營級印記，維持舊版以 id 覆蓋的行為。
  const idx = marks.findIndex(m => m.id === mark.id && (
    mark.ownerBattleId ? m.ownerBattleId === mark.ownerBattleId : !m.ownerBattleId
  ));
  if (idx === -1) return [...marks, normalized];
  const next = [...marks];
  next[idx] = normalized;
  return next;
}

/**
 * 清除指定 id 的印記。
 */
export function clearMark(marks: Mark[], id: string, ownerBattleId?: string): Mark[] {
  return marks.filter(m => m.id !== id || (ownerBattleId !== undefined && m.ownerBattleId !== ownerBattleId));
}

/**
 * 取得指定 id 的印記。
 */
export function getMark(marks: Mark[], id: string, ownerBattleId?: string): Mark | undefined {
  return marks.find(m => m.id === id && (ownerBattleId === undefined || m.ownerBattleId === ownerBattleId));
}

/** 陣營級印記適用於全隊；帶持有者的印記只套用到該精靈。 */
export function markAppliesToElf(mark: Pick<Mark, "ownerBattleId">, elf?: { battleId?: string; id?: string }): boolean {
  if (!mark.ownerBattleId) return true;
  if (!elf) return false;
  return mark.ownerBattleId === (elf.battleId || elf.id);
}

/** 在知道目標精靈的附加邊界完成綁定，避免各魂印漏填持有者。 */
export function bindMarkToElf(mark: Mark, elf: { battleId?: string; id?: string }): Mark {
  const normalized = normalizeMark(mark);
  return normalized.scope === "team" && !mark.ownerBattleId
    ? normalized
    : { ...normalized, ownerBattleId: mark.ownerBattleId || elf.battleId || elf.id };
}
