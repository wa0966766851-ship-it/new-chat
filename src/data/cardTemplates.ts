import blockTemplatesData from "./block_templates_from_cards.json";

export interface CardTemplateItem {
  id: string;
  template: string; // 例如: "額外附加{0}點傷害"
  raw: string;      // 例如: "額外附加30點傷害"
  sampleParams: string[];
  category: string;
}

export interface CardTemplateModule {
  id: string;
  name: string;
  category: "soul_mark" | "skill_effect" | "boost" | "control" | "survival" | "general";
  source: string;
  triggerTime: string;
  standardSyntax: string;
  effectType: string;
  effectDetail: string;
  tags: string[];
  sampleParams: string[];
  rawText: string;
}

// 整理並匯出 733 個真實卡牌文字範本清單
const rawTemplates = blockTemplatesData.templates as Record<string, { sampleParams: string[]; raw: string }>;

export const CARD_TEMPLATE_ITEMS: CardTemplateItem[] = Object.entries(rawTemplates).map(([templateKey, val], index) => {
  let category = "general";
  if (templateKey.includes("傷害") || templateKey.includes("威力") || templateKey.includes("致命")) {
    category = "boost";
  } else if (templateKey.includes("害怕") || templateKey.includes("麻痺") || templateKey.includes("睡眠") || templateKey.includes("異常") || templateKey.includes("控制")) {
    category = "control";
  } else if (templateKey.includes("恢復") || templateKey.includes("護盾") || templateKey.includes("免疫") || templateKey.includes("減傷")) {
    category = "survival";
  } else if (templateKey.includes("印記") || templateKey.includes("登場") || templateKey.includes("回合開始") || templateKey.includes("常駐")) {
    category = "soul_mark";
  }

  return {
    id: `tpl_${index + 1}`,
    template: templateKey,
    raw: val.raw,
    sampleParams: val.sampleParams || [],
    category,
  };
});

// 提供相容 `AIEffectModule` 結構的真實卡牌模組列表，取自 733 個真實範本
export const REAL_CARD_EFFECT_MODULES: CardTemplateModule[] = CARD_TEMPLATE_ITEMS.map((item, index) => {
  let triggerTime = "技能使用時";
  if (item.template.includes("回合開始")) triggerTime = "回合開始時";
  else if (item.template.includes("戰鬥開始")) triggerTime = "戰鬥開始時";
  else if (item.template.includes("登場")) triggerTime = "登場時";
  else if (item.template.includes("受到攻擊") || item.template.includes("被擊敗")) triggerTime = "受到傷害時";
  else if (item.template.includes("回合結束")) triggerTime = "回合結束時";

  let catType: "soul_mark" | "skill_effect" | "boost" | "control" | "survival" | "general" = "skill_effect";
  if (item.category === "soul_mark") catType = "soul_mark";
  else if (item.category === "boost") catType = "boost";
  else if (item.category === "control") catType = "control";
  else if (item.category === "survival") catType = "survival";

  return {
    id: item.id,
    name: item.template.length > 25 ? item.template.substring(0, 25) + "..." : item.template,
    category: catType,
    source: "真實卡牌庫",
    triggerTime,
    standardSyntax: item.template,
    effectType: item.category,
    effectDetail: item.sampleParams.length > 0 ? `參數預設: ${item.sampleParams.join(", ")}` : "無固定參數",
    tags: ["真實卡牌", item.category, ...item.sampleParams],
    sampleParams: item.sampleParams,
    rawText: item.raw,
  };
});

/**
 * 依關鍵字搜尋真實卡牌描述模組
 */
export function searchCardTemplates(query: string): CardTemplateModule[] {
  if (!query || query.trim() === "") return REAL_CARD_EFFECT_MODULES;
  const q = query.toLowerCase().trim();
  return REAL_CARD_EFFECT_MODULES.filter(m => 
    m.name.toLowerCase().includes(q) ||
    m.standardSyntax.toLowerCase().includes(q) ||
    m.rawText.toLowerCase().includes(q) ||
    m.tags.some(t => t.toLowerCase().includes(q))
  );
}

export const TEMPLATE_GRAMMAR_GUIDELINES = [
  "所有積木與效果描述 100% 來自 30 隻精靈之真實卡牌文字範本。",
  "使用 {0}, {1} 作為參數佔位符，絕無 AI 虛構或自編無效語法。",
  "參數值域由真實卡牌出現過的數值範圍自動綁定。",
];
