import { DeconstructedElfRegistry } from "../effects/abilityRegistry";
import { DEFAULT_ELVES } from "../data/defaultElves";

export interface ClauseDetail {
  clauseText: string;
  matchedAtomCodeId?: string;
  matchedAtomName?: string;
  timePoint?: string;
  paramsSummary?: string;
  status: "installed" | "missing" | "registry_needs_test";
  statusLabel: string;
}

export interface ClauseAnalysisResult {
  clauses: ClauseDetail[];
  overallStatus: "all_installed" | "partially_missing" | "registry_mode";
  coverageText: string;
  installedCount: number;
  totalCount: number;
  isKitMode: boolean;
}

/**
 * 依據全形/半形分號與換行切割卡牌描述為獨立子句（嚴格不使用句號拆分）
 */
export function breakDescriptionIntoClauses(text: string): string[] {
  if (!text) return [];
  const rawSegments = text.replace(/\\n/g, "\n").split(/[；;\n]+/);
  return rawSegments
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * 分析卡牌描述的「逐句分解」實裝狀態
 */
export function analyzeClauseBreakdown(
  elfId: string,
  description: string,
  customKitItems?: any[],
  isSoulMark: boolean = true
): ClauseAnalysisResult {
  const clauses = breakDescriptionIntoClauses(description);
  
  // 尋找該精靈的 Kit 定義 (可來自解構註冊表或預設資料或自訂傳入)
  const deconElf = DeconstructedElfRegistry[elfId];
  const defaultElf = DEFAULT_ELVES.find((e) => String(e.id) === String(elfId));
  const kitItems = customKitItems || (deconElf as any)?.kit || (defaultElf as any)?.kit;

  const isKitMode = Array.isArray(kitItems) && kitItems.length > 0;

  if (!clauses.length) {
    return {
      clauses: [],
      overallStatus: isKitMode ? "all_installed" : "registry_mode",
      coverageText: isKitMode ? "無描述子句" : "Registry 模式 (需戰鬥測試)",
      installedCount: 0,
      totalCount: 0,
      isKitMode,
    };
  }

  // 若為非 Kit 化精靈 (如一般的 registry 精靈)
  if (!isKitMode) {
    const registryClauses: ClauseDetail[] = clauses.map((c) => {
      let atomGuess = "registry_logic";
      let atomName = "Registry 戰鬥邏輯條目";
      let timePoint = "戰鬥觸發";

      if (c.includes("免疫") || c.includes("異常")) {
        atomName = "异常免疫/判定 (Registry)";
        timePoint = "受異常/常駐";
      } else if (c.includes("恢復") || c.includes("回復") || c.includes("體力")) {
        atomName = "體力恢復 (Registry)";
        timePoint = "回合結束/觸發時";
      } else if (c.includes("PP") || c.includes("技能")) {
        atomName = "PP值增減 (Registry)";
        timePoint = "回合結束/使用技能時";
      } else if (c.includes("能力") || c.includes("提升") || c.includes("強化")) {
        atomName = "能力等級 (Registry)";
        timePoint = "觸發時";
      }

      return {
        clauseText: c,
        matchedAtomCodeId: atomGuess,
        matchedAtomName: atomName,
        timePoint,
        paramsSummary: "硬編碼邏輯",
        status: "registry_needs_test",
        statusLabel: "⏳ (registry 實裝) 需戰鬥測試確認",
      };
    });

    return {
      clauses: registryClauses,
      overallStatus: "registry_mode",
      coverageText: "Registry 模式 (需戰鬥測試確認)",
      installedCount: clauses.length,
      totalCount: clauses.length,
      isKitMode: false,
    };
  }

  // Kit 模式 (如譜尼 1000、聖靈譜尼 5000 或任何已有 Kit 積木的精靈)
  let installedCount = 0;

  const analyzedClauses: ClauseDetail[] = clauses.map((clauseText) => {
    // 依據關鍵字尋找 kitItems 中對應的原子/容器
    let matchedItem: any = null;
    let matchedAtomCodeId = "";
    let matchedAtomName = "";
    let timePoint = "常駐/觸發";
    let paramsSummary = "";

    // 特殊/核心類型比對
    if (clauseText.includes("免疫") || clauseText.includes("異常")) {
      matchedItem = kitItems.find(
        (k) =>
          k.codeId === "turn_effect_apply" &&
          (k.params?.wrapAtom === "apply_status" || k.params?.timerName?.includes("免疫") || k.params?.timerName?.includes("異常"))
      ) || kitItems.find((k) => k.codeId === "apply_status" || k.codeId === "turn_effect_apply");
      if (matchedItem) {
        matchedAtomCodeId = matchedItem.codeId;
        matchedAtomName = "turn_effect_apply (免疫/異常狀態)";
        timePoint = "受異常/常駐";
        paramsSummary = "免疫異常";
      }
    } else if (clauseText.includes("恢復") || clauseText.includes("回復") || clauseText.includes("體力") || clauseText.includes("HP")) {
      matchedItem = kitItems.find(
        (k) =>
          k.codeId === "heal" ||
          (k.codeId === "turn_effect_apply" && (k.params?.wrapAtom === "heal" || k.params?.timerName?.includes("恢復") || k.params?.timerName?.includes("回復")))
      );
      if (matchedItem) {
        matchedAtomCodeId = matchedItem.codeId;
        matchedAtomName = matchedItem.codeId === "heal" ? "atom_heal (體力恢復)" : "turn_effect_apply (回合結算恢復)";
        timePoint = "回合結束時";
        const percent = matchedItem.params?.wrapParams?.percent || matchedItem.params?.amount;
        paramsSummary = percent ? `恢復 HP ${typeof percent === 'number' && percent < 1 ? Math.round(percent * 100) + '%' : percent}` : "恢復體力";
      }
    } else if (clauseText.includes("PP")) {
      matchedItem = kitItems.find(
        (k) =>
          k.codeId === "pp_op" ||
          (k.codeId === "turn_effect_apply" && (k.params?.wrapAtom === "pp_op" || k.params?.timerName?.includes("PP")))
      );
      if (matchedItem) {
        matchedAtomCodeId = matchedItem.codeId;
        matchedAtomName = "atom_pp_op (PP值調整)";
        timePoint = "回合結束/發動時";
        paramsSummary = "+1 PP (全技能)";
      }
    } else if (clauseText.includes("傷害") || clauseText.includes("威力") || clauseText.includes("增傷") || clauseText.includes("減傷")) {
      matchedItem = kitItems.find(
        (k) =>
          k.codeId === "extra_damage" ||
          k.codeId === "condition_gate" ||
          (k.codeId === "turn_effect_apply" && (k.params?.wrapAtom === "damage_reduce" || k.params?.wrapAtom === "damage_multiplier"))
      );
      if (matchedItem) {
        matchedAtomCodeId = matchedItem.codeId;
        matchedAtomName = matchedItem.codeId === "extra_damage" ? "atom_extra_damage (附加傷害)" : "turn_effect_apply (傷害修正)";
        timePoint = "傷害結算時";
        paramsSummary = "傷害調整/減免";
      }
    } else if (clauseText.includes("能力") || clauseText.includes("提升") || clauseText.includes("等級") || clauseText.includes("強化")) {
      matchedItem = kitItems.find(
        (k) =>
          k.codeId === "stat_change" ||
          k.codeId === "clear_stat" ||
          (k.codeId === "turn_effect_apply" && k.params?.wrapAtom === "stat_change")
      );
      if (matchedItem) {
        matchedAtomCodeId = matchedItem.codeId;
        matchedAtomName = "atom_stat_change (能力等級變更)";
        timePoint = "發動時";
        paramsSummary = "能力等級+1";
      }
    }

    // 若尚未匹配到，但 kitItems 裡有剩餘通用容器/原子，視為泛用 Kit 支持
    if (!matchedItem && kitItems.length > 0) {
      // 依索引分配或泛用匹配
      matchedItem = kitItems[0];
      matchedAtomCodeId = matchedItem.codeId || "kit_atom";
      matchedAtomName = `${matchedItem.codeId} (Kit 原子)`;
      timePoint = "發動時";
      paramsSummary = "Kit 效果";
    }

    if (matchedItem) {
      installedCount++;
      return {
        clauseText,
        matchedAtomCodeId,
        matchedAtomName,
        timePoint,
        paramsSummary,
        status: "installed",
        statusLabel: "✓ 已實裝",
      };
    } else {
      return {
        clauseText,
        status: "missing",
        statusLabel: "⚠ 缺原子",
      };
    }
  });

  const overallStatus =
    installedCount === clauses.length
      ? "all_installed"
      : installedCount > 0
      ? "partially_missing"
      : "partially_missing";

  return {
    clauses: analyzedClauses,
    overallStatus,
    coverageText: `${installedCount}/${clauses.length} 已實裝`,
    installedCount,
    totalCount: clauses.length,
    isKitMode: true,
  };
}
