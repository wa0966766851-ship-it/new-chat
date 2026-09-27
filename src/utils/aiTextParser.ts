import { CardTemplateModule as AIEffectModule, REAL_CARD_EFFECT_MODULES as AI_EFFECT_REFERENCE_LIBRARY } from "../data/cardTemplates";
import { extractTemplateIdFromText } from "../effects/templateEngine";

/**
 * 結構化解析後的子條目
 */
export interface ParsedEffectClause {
  originalText: string;             // 原始文字片段
  matchedModule?: AIEffectModule;   // 成功映射到的現有效果資料庫模組
  matchedKeywords: string[];        // 識別到的關鍵字（如：傷害翻倍、恢復體力、屬性提升）
  isUnrecognized: boolean;          // 是否包含不識別/原創詞彙
  unrecognizedWords: string[];      // 不識別的暫存詞彙清單
  suggestedTemplate: string;        // 針對該句的標準分號模板化建議
  mappedEffectType: string;         // 映射的主特效類型
  mappedEffectDetail: string;       // 映射的參數細節
}

/**
 * 結構化 JSON 對象解析結果
 */
export interface ParsedEffectResult {
  rawInput: string;                 // 用戶輸入的原始文字
  clauses: ParsedEffectClause[];    // 解析出的結構化條目
  mappedModules: AIEffectModule[];  // 識別成功已映射到效果資料庫的模組清單
  unrecognizedTerms: string[];      // 針對不識別詞彙建立的暫存清單
  structuredTemplate: string;       // 組合與標準化後的賽爾號經典分號描述
  recommendedEffectType: string;    // 為精靈特性或技能推薦的核心 effectType
  recommendedEffectDetail: string;  // 推薦的核心 effectDetail
  isFullyMapped: boolean;           // 是否百分百相容現有效果庫
  templateSuggestions: string[];    // 模板化與邏輯計算建議清單
  recommendedTemplateId?: string;   // 公共模板引擎 ID 建議
  recommendedTemplateArgs?: any[];  // 公共模板引擎參數建議
}

// 關鍵字映射字典庫
const KEYWORD_MAPPING_RULES: {
  keywords: string[];
  targetModuleId: string;
  defaultEffectType: string;
  defaultEffectDetail: string;
  categoryName: string;
}[] = [
  {
    keywords: ["傷害翻倍", "翻倍", "傷害提升", "增傷", "造成傷害提升", "暴擊", "4倍"],
    targetModuleId: "sm_thunder_control",
    defaultEffectType: "damage_multiplier",
    defaultEffectDetail: "double_on_status",
    categoryName: "傷害倍率與增幅"
  },
  {
    keywords: ["恢復體力", "回血", "吸血", "吸取體力", "恢復自身", "滋養", "恢復最大體力", "恢復生命"],
    targetModuleId: "sm_hp_boost_heal",
    defaultEffectType: "heal",
    defaultEffectDetail: "heal_on_hit:20",
    categoryName: "生存續航與吸血"
  },
  {
    keywords: ["屬性提升", "全屬性+1", "全屬+1", "能力提升", "強化", "攻擊+1", "速度提升", "特攻+1", "全屬+2", "能力上升"],
    targetModuleId: "sk_full_stat_up",
    defaultEffectType: "stat_up",
    defaultEffectDetail: "all+1",
    categoryName: "屬性與能力強化"
  },
  {
    keywords: ["麻痺", "害怕", "睡眠", "冰封", "焚燼", "癱瘓", "控場", "異常狀態"],
    targetModuleId: "sm_thunder_control",
    defaultEffectType: "paralyze_chance",
    defaultEffectDetail: "paralyze:30",
    categoryName: "控場與異常賦予"
  },
  {
    keywords: ["免死", "殘留", "鎖血", "致命傷害", "保留1點體力", "意志殘留", "不死"],
    targetModuleId: "sm_fatal_survival",
    defaultEffectType: "status_immune",
    defaultEffectDetail: "fatal_survive:1",
    categoryName: "免死與生存保護"
  },
  {
    keywords: ["消除對手回合", "消強", "消除能力提升", "消除護盾", "清除回合", "清除護盾"],
    targetModuleId: "sk_clear_buffs",
    defaultEffectType: "none",
    defaultEffectDetail: "clear_opp_turns",
    categoryName: "消除強化與回合類效果"
  },
  {
    keywords: ["護盾", "吸收傷害", "抵擋傷害", "附加護盾"],
    targetModuleId: "sk_holy_shield",
    defaultEffectType: "shield",
    defaultEffectDetail: "shield:250",
    categoryName: "護盾與傷害吸收"
  },
  {
    keywords: ["先制", "先手", "必定先手", "先發制人"],
    targetModuleId: "sm_low_hp_boost",
    defaultEffectType: "speed_boost",
    defaultEffectDetail: "priority+1",
    categoryName: "先制行動權"
  },
  {
    keywords: ["精靈王特權", "不會出現微弱", "微弱時都變成普通", "微弱轉普通", "微弱變普通"],
    targetModuleId: "sk_king_privilege",
    defaultEffectType: "none",
    defaultEffectDetail: "king_privilege_no_weak",
    categoryName: "精靈王特權與克制判定"
  },
  {
    keywords: ["無視對手護盾", "無視護盾效果", "無視護盾", "破盾"],
    targetModuleId: "sk_ignore_shield",
    defaultEffectType: "none",
    defaultEffectDetail: "ignore_shield",
    categoryName: "護盾穿透與無視"
  },
  {
    keywords: ["寂殺之魄", "肅霜之禁", "極寒禁錮", "凝滯", "冰封", "凍傷", "減免不高於200"],
    targetModuleId: "sm_ice_king_soul",
    defaultEffectType: "custom",
    defaultEffectDetail: "ice_king_soul_reduct:60,jisha_marks:3,shuangjin_marks:200",
    categoryName: "冰王專屬印記與極寒控制"
  }
];

/**
 * 提取可能的原創/未識別詞彙 (如：「黑洞吞噬」、「虛空切割」、「魔軀枷鎖」等二字/四字名詞或特殊詞組)
 */
function extractUnrecognizedTerms(text: string, matchedKeywords: string[]): string[] {
  const unrecognized: string[] = [];
  // 移除常見助詞與已匹配關鍵字
  let cleanText = text;
  matchedKeywords.forEach(kw => {
    cleanText = cleanText.split(kw).join(" ");
  });
  
  // 簡單啟發式提取連續的中文字詞組作為未識別概念 (長度在 2~6 字之間的潛在專有名詞)
  const potentialTerms = cleanText.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const commonWords = [
    "每次", "回合", "開始", "結束", "使用", "攻擊", "技能", "造成", "如果", "若自身", "對手", 
    "效果", "自身", "當前", "最大", "體力", "擁有", "處於", "狀態", "成功", "必定", "降低", "無法", "期間", "為對手", "附加"
  ];

  potentialTerms.forEach(term => {
    if (!commonWords.includes(term) && !matchedKeywords.includes(term)) {
      // 若非常見基礎遊戲詞彙，即視為自訂未知概念
      if (term.length >= 2 && !unrecognized.includes(term)) {
        unrecognized.push(term);
      }
    }
  });

  return unrecognized;
}

/**
 * 本地智能文字解析器：將用戶描述轉化為結構化 JSON 對象
 * @param text 用戶輸入的文字描述
 * @returns 結構化的 ParsedEffectResult
 */
export function parseEffectDescriptionLocal(text: string): ParsedEffectResult {
  // Strip BOSS annotations
  const cleanText = text.replace(/[（(][^（()）]*[Bb][Oo][Ss][Ss][^（()）]*[)）]/g, "");
  const rawInput = cleanText.trim();
  if (!rawInput) {
    return {
      rawInput,
      clauses: [],
      mappedModules: [],
      unrecognizedTerms: [],
      structuredTemplate: "",
      recommendedEffectType: "none",
      recommendedEffectDetail: "",
      isFullyMapped: true,
      templateSuggestions: ["請輸入精靈效果或技能描述，AI 將自動轉化為結構化 JSON 對象。"]
    };
  }

  // 1. 切割子句（依照分號與換行，嚴格不使用句號）
  const segments = rawInput
    .split(/[;；\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const clauses: ParsedEffectClause[] = [];
  const mappedModulesMap = new Map<string, AIEffectModule>();
  const unrecognizedTermsSet = new Set<string>();
  const templateSuggestions: string[] = [];

  segments.forEach(segment => {
    let matchedModule: AIEffectModule | undefined = undefined;
    const matchedKeywords: string[] = [];
    let mappedEffectType = "none";
    let mappedEffectDetail = "";

    // A. 比對關鍵字映射庫
    for (const rule of KEYWORD_MAPPING_RULES) {
      for (const kw of rule.keywords) {
        if (segment.includes(kw)) {
          matchedKeywords.push(kw);
          const mod = AI_EFFECT_REFERENCE_LIBRARY.find(m => m.id === rule.targetModuleId);
          if (mod) {
            matchedModule = mod;
            mappedModulesMap.set(mod.id, mod);
            mappedEffectType = mod.effectType;
            mappedEffectDetail = mod.effectDetail;
          } else {
            mappedEffectType = rule.defaultEffectType;
            mappedEffectDetail = rule.defaultEffectDetail;
          }
        }
      }
    }

    // B. 若關鍵字沒命中，再比對現有效果資料庫的全名或 tags
    if (!matchedModule) {
      for (const mod of AI_EFFECT_REFERENCE_LIBRARY) {
        if (segment.includes(mod.name) || mod.tags.some(tag => segment.includes(tag))) {
          matchedModule = mod;
          mappedModulesMap.set(mod.id, mod);
          matchedKeywords.push(...mod.tags.filter(tag => segment.includes(tag)));
          mappedEffectType = mod.effectType;
          mappedEffectDetail = mod.effectDetail;
          break;
        }
      }
    }

    // C. 檢查是否有未知/原創詞彙
    const unrec = extractUnrecognizedTerms(segment, matchedKeywords);
    const isUnrecognized = unrec.length > 0 && matchedKeywords.length === 0;
    unrec.forEach(w => unrecognizedTermsSet.add(w));

    // D. 構建模板化建議
    let suggestedTemplate = segment;
    if (!segment.endsWith("；") && !segment.endsWith(";")) {
      suggestedTemplate = segment + "；";
    }

    if (matchedModule) {
      suggestedTemplate = `[引用庫存-${matchedModule.name}]: ${matchedModule.standardSyntax}`;
    } else if (isUnrecognized) {
      const term = unrec[0] || "未知機制";
      suggestedTemplate = `回合開始時：觸發自訂機制【${term}】，令自身造成的傷害提升 50% 且附加 ${term} 標記；（已暫存至未識別詞典）`;
      templateSuggestions.push(`偵測到原創未識別詞彙「${term}」，已建立暫存，建議標準化為觸發式分號模板以利後續邏輯計算。`);
    }

    clauses.push({
      originalText: segment,
      matchedModule,
      matchedKeywords: Array.from(new Set(matchedKeywords)),
      isUnrecognized,
      unrecognizedWords: unrec,
      suggestedTemplate,
      mappedEffectType,
      mappedEffectDetail
    });
  });

  const mappedModules = Array.from(mappedModulesMap.values());
  const unrecognizedTerms = Array.from(unrecognizedTermsSet);
  const isFullyMapped = unrecognizedTerms.length === 0 && clauses.every(c => c.matchedModule || c.matchedKeywords.length > 0);

  // 2. 決定推薦的 effectType 與 effectDetail
  let recommendedEffectType = "none";
  let recommendedEffectDetail = "";
  if (mappedModules.length > 0) {
    recommendedEffectType = mappedModules[0].effectType;
    recommendedEffectDetail = mappedModules[0].effectDetail;
  } else if (clauses.length > 0 && clauses[0].mappedEffectType !== "none") {
    recommendedEffectType = clauses[0].mappedEffectType;
    recommendedEffectDetail = clauses[0].mappedEffectDetail;
  }

  // 3. 組合標準化模板
  const structuredTemplate = clauses
    .map(c => c.suggestedTemplate.replace(/^\[引用庫存-[^\]]+\]:\s*/, ""))
    .join("") || rawInput + "；";

  if (mappedModules.length > 0) {
    templateSuggestions.unshift(`成功映射到 ${mappedModules.length} 個系統標準效果模組（例如：${mappedModules.map(m => m.name).join("、")}），可直接參與戰鬥引擎數值與邏輯計算。`);
  }

  // 4. 偵測是否符合公共模板引擎 (Semantic Template Engine)
  const templateMatch = extractTemplateIdFromText(rawInput);
  let recommendedTemplateId = undefined;
  let recommendedTemplateArgs = undefined;
  if (templateMatch) {
    recommendedTemplateId = templateMatch.templateId;
    recommendedTemplateArgs = templateMatch.args;
    templateSuggestions.unshift(`【公共模板引擎】: 偵測到匹配的公共模板 ${templateMatch.templateId}，已自動推薦。`);
  }

  return {
    rawInput,
    clauses,
    mappedModules,
    unrecognizedTerms,
    structuredTemplate,
    recommendedEffectType,
    recommendedEffectDetail,
    isFullyMapped,
    templateSuggestions,
    recommendedTemplateId,
    recommendedTemplateArgs
  };
}

/**
 * 深度 AI 智能文字解析 API 調用器
 * 調用後端 /api/parse-effect-text，若失敗則降級到 parseEffectDescriptionLocal
 */
export async function parseEffectDescriptionWithAI(text: string): Promise<ParsedEffectResult> {
  const cleanText = text.replace(/[（(][^（()）]*[Bb][Oo][Ss][Ss][^（()）]*[)）]/g, "");
  const localResult = parseEffectDescriptionLocal(cleanText);
  try {
    const res = await fetch("/api/parse-effect-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const data = json.data as ParsedEffectResult;
      const templateMatch = extractTemplateIdFromText(text);
      if (templateMatch) {
        data.recommendedTemplateId = templateMatch.templateId;
        data.recommendedTemplateArgs = templateMatch.args;
        if (!data.templateSuggestions) data.templateSuggestions = [];
        data.templateSuggestions.unshift(`【公共模板引擎】: 偵測到匹配的公共模板 ${templateMatch.templateId}，已自動推薦。`);
      }
      return data;
    }
  } catch (error) {
    console.warn("AI 深度文字解析 API 調用失敗或處於離線環境，已使用本地智能關鍵字映射引擎。", error);
  }
  return localResult;
}
