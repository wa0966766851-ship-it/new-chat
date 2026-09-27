import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { REAL_CARD_EFFECT_MODULES as AI_EFFECT_REFERENCE_LIBRARY, TEMPLATE_GRAMMAR_GUIDELINES } from "./src/data/cardTemplates";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with AI Studio build metadata
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// 未設定 GEMINI_API_KEY 時，AI 端點直接回報停用（前端改用本地解析）
const AI_ENABLED = !!process.env.GEMINI_API_KEY;
app.get("/api/ai-status", (_req, res) => res.json({ enabled: AI_ENABLED }));
app.use(["/api/generate-elf", "/api/analyze-elf", "/api/parse-effect-text", "/api/dissect-tokens"], (req, res, next) => {
  if (AI_ENABLED) return next();
  res.status(503).json({ error: "AI 功能未啟用：專案根目錄 .env 未設定 GEMINI_API_KEY", aiDisabled: true });
});

const librarySummary = AI_EFFECT_REFERENCE_LIBRARY.map(m =>
  `-[${m.category}] 【${m.name}】(來源: ${m.source}) | 規範語法: "${m.standardSyntax}" | 底層映射: ${m.effectType} (${m.effectDetail})`
).join("\n");

// JSON Schema for Seer Elf Parse Request
const elfSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "精靈名稱，例如：雷伊" },
    type: { type: Type.STRING, description: "精靈屬性，必須是以下之一：草, 水, 火, 電, 地, 飛行, 光, 暗影, 聖靈, 普通, 戰鬥, 機械, 冰, 次元, 邪靈, 龍, 混沌, 神秘, 神靈" },
    baseStats: {
      type: Type.OBJECT,
      description: "精靈的六項基本種族值，自訂精靈已完全解除總和與單項數值上限限制，可根據用戶設定或故事設定生成任意超模或突破常理的數值",
      properties: {
        hp: { type: Type.INTEGER, description: "體力種族值" },
        atk: { type: Type.INTEGER, description: "攻擊種族值" },
        def: { type: Type.INTEGER, description: "防禦種族值" },
        spatk: { type: Type.INTEGER, description: "特攻種族值" },
        spdef: { type: Type.INTEGER, description: "特防種族值" },
        speed: { type: Type.INTEGER, description: "速度種族值" }
      },
      required: ["hp", "atk", "def", "spatk", "spdef", "speed"]
    },
    soulMark: {
      type: Type.OBJECT,
      description: "精靈的專屬特性（魂印被動效果）",
      properties: {
        name: { type: Type.STRING, description: "專屬特性名稱，例如：雷" },
        description: { type: Type.STRING, description: "嚴格符合規範化模板之詳細效果描述" },
        effectType: { type: Type.STRING, description: "主要效果類型，必須是以下之一：'paralyze_chance', 'burn_chance', 'heal_on_turn_end', 'damage_boost', 'shield', 'status_immune', 'speed_boost', 'none'" },
        effectValue: { type: Type.INTEGER, description: "效果數值，例如機率 30、回血百分比 20、增傷百分比 50 等" }
      },
      required: ["name", "description", "effectType", "effectValue"]
    },
    skills: {
      type: Type.ARRAY,
      description: "精靈的戰鬥技能清單，已完全解除4招數量限制，可依照需求生成任意數量（例如 4個、5個、6個或更多技能）。建議包含進攻技能與輔助屬性技能",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "技能名稱，例如：雷神天明閃" },
          type: { type: Type.STRING, description: "技能屬性，通常與精靈屬性相同或為普通系" },
          category: { type: Type.STRING, description: "技能分類，必須是以下之一：物理, 特殊, 屬性" },
          power: { type: Type.INTEGER, description: "技能威力，屬性技能威力為 0，物理/特殊技能威力通常在 80 到 160 之間" },
          pp: { type: Type.INTEGER, description: "技能PP值，通常在 5 到 30 之間" },
          description: { type: Type.STRING, description: "技能特效嚴格符合規範化語法之說明" },
          priority: { type: Type.INTEGER, description: "先制值，普通技能為 0。若為先手技能可為 1, 2, 3" },
          effectType: { type: Type.STRING, description: "主要特效類型，必須是以下之一：'none', 'stat_up', 'stat_down', 'heal', 'status_inflict', 'damage_multiplier', 'absorb'" },
          effectDetail: { type: Type.STRING, description: "特效具體細節，如：'atk+1', 'def-1', 'heal:30%', 'paralyze:30', 'double_damage:10'" }
        },
        required: ["name", "type", "category", "power", "pp", "description", "priority", "effectType", "effectDetail"]
      }
    },
    decompositionReport: {
      type: Type.OBJECT,
      description: "AI 效果解構與效果庫引用分析報告",
      properties: {
        decomposedTags: {
          type: Type.ARRAY,
          description: "從用戶文字中解構出的核心機制標籤，例如：['全屬強化', '低血增傷', '1血免死', '麻痺控場']",
          items: { type: Type.STRING }
        },
        referencedEffects: {
          type: Type.ARRAY,
          description: "分析中直接引用自現有系統效果庫的經典模組",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "引用模組名稱，例如：雷電麻痺控制模組" },
              source: { type: Type.STRING, description: "出處與來源，例如：雷伊被動引用" },
              syntax: { type: Type.STRING, description: "引用的規範化模板語法" }
            },
            required: ["name", "source", "syntax"]
          }
        },
        newCatalogedEffects: {
          type: Type.ARRAY,
          description: "目前庫存沒有、經 AI 規範化後新入庫自訂引用的效果",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "新入庫效果名稱" },
              syntax: { type: Type.STRING, description: "轉化為經典賽爾號規範化模板語法的文本" },
              reason: { type: Type.STRING, description: "為什麼需要新入庫及底層對應邏輯" }
            },
            required: ["name", "syntax", "reason"]
          }
        },
        templateSummary: {
          type: Type.STRING,
          description: "規範化重構總結：說明如何將用戶原文字重構為標準觸發式分號模板語法"
        }
      },
      required: ["decomposedTags", "referencedEffects", "newCatalogedEffects", "templateSummary"]
    }
  },
  required: ["name", "type", "baseStats", "soulMark", "skills", "decompositionReport"]
};

// API Endpoint for Elf Generation
app.post("/api/generate-elf", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "請提供有效的精靈描述文本" });
  }

  try {
    const systemInstruction = `
      你是一個《賽爾號》遊戲精靈設計師與架構工程師。
      你的任務是根據用戶提供的文字描述，將其解構並轉換成符合《賽爾號》經典對戰架構的結構化精靈資料（繁體中文）。
      
      ${TEMPLATE_GRAMMAR_GUIDELINES}
      
      【系統現有標準效果庫（可直接引用或擴充入庫）】：
      ${librarySummary}
      
      執行指南與注意事項：
      1. **雙屬性與第五技能**：
         - 嚴格識別雙屬性（如「聖靈.神秘」、「戰鬥.火」），在 type 欄位中原樣保留「.」分隔的雙屬性。
         - 對於技能組，必須區分「第五技能」（通常威力為160且isFifthSkill為true）。第五技能的屬性通常與精靈本系屬性一致。
      2. **條件、效果與印記的嚴格區分**：
         - 仔細梳理文本中的【觸發條件】（如「每次使用技能後」、「受到傷害時」、「體力低於1/2時」）、【核心效果】（如「附加對手最大體力1/3固傷」、「恢復所有體力」）與【印記】（如「星執者」、「恐懼之花」等專有名詞）。
         - 若出現帶有專有印記（Mark / Status）的描述，請清楚標示其運作機制，不可與一般增益或異常狀態混淆。
      3. **【極度重要】絕對不允許省略或簡化用戶的原版文本**：
         - 必須完整保留用戶設定的所有觸發條件（如「命中後」、「未擊敗對手則」、「體力低於1/2時」、「技能無效時」）、附加效果及限制。不能因為你要分類或排版就將其省略。
         - 若用戶的原始描述中包含了「無特殊定義單純是因為使用技能而附帶的倒數效果（即回合類效果）」與「沒通過使用技能而附帶的效果」，請如實保留其觸發邏輯，絕不可隨意刪減。
      4. 輸出語言必須為「繁體中文」（Traditional Chinese）。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `請將以下精靈文字描述解構、引用效果庫並轉換為規範化結構資料：\n\n${prompt}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: elfSchema,
        temperature: 0.5,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 沒有返回任何內容。");
    }

    const elfData = JSON.parse(response.text.trim());
    res.json({ success: true, data: elfData });
  } catch (error: any) {
    console.error("AI 生成精靈失敗:", error);
    res.status(500).json({ error: "AI 解析與生成精靈失敗，請重試", details: error.message });
  }
});

// API Endpoint for Elf Analysis and Bug Fix
app.post("/api/analyze-elf", async (req, res) => {
  const { elf, description } = req.body;
  if (!elf || !description) {
    return res.status(400).json({ error: "請提供精靈資料與描述文本" });
  }

  try {
    const systemInstruction = `
      你是一個《賽爾號》遊戲精靈邏輯解構與效果庫實裝修復師。
      你的任務是根據用戶提供的精靈現有資料（JSON）以及其「希望實現的效果描述」（Text），
      將新描述解構，引用已有效果或將新效果標準化入庫，並實時修正配置。
      
      ${TEMPLATE_GRAMMAR_GUIDELINES}
      
      【系統現有標準效果庫】：
      ${librarySummary}
      
      執行規則：
      1. 嚴格解構用戶修改意圖，若是引用系統已有效果，優先採用其標準模板與底層邏輯映射。
      2. 若是自訂新功能，重構為經典《賽爾號》分號分隔語法入庫，同時優化技能或特性的 effectType 與 effectDetail。
      3. 在 decompositionReport 中完整列出解構標籤、引用的庫存效果、以及新入庫的標準化效果。
      4. 輸出語言必須為「繁體中文」。
      5. 嚴格保持該精靈原本所有的技能列表與基礎數值（PP、威力、命中、種族值），並將其 JSON 屬性 isCustom 設為 true。除非描述明確提及要增刪修改技能或調整數值，否則絕不可任意遺漏或重置。
      6. 所有的特性與技能文本描述都務必遵守經典賽爾號分號分隔語法，以確保前端排版與語意引擎正確執行。
         - **【極度重要】絕對不允許省略或簡化用戶的原版文本**：必須完整保留所有觸發條件（如「命中後」、「未擊敗對手則」、「體力低於1/2時」、「技能無效時」）、附加效果及限制。不能因為你要分類或排版就將其省略。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `請解構此精靈的新修改描述，引用效果庫並重新實裝配置：\n\n現有資料：${JSON.stringify(elf)}\n\n修改意圖與目標描述：${description}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: elfSchema,
        temperature: 0.3,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 沒有返回任何內容。");
    }

    const updatedElfData = JSON.parse(response.text.trim());
    res.json({ success: true, data: updatedElfData });
  } catch (error: any) {
    console.error("AI 分析精靈失敗:", error);
    res.status(500).json({ error: "AI 分析與修復失敗，請重試", details: error.message });
  }
});

// API Endpoint for AI Text Parser (將精靈描述轉化為結構化 JSON 對象)
const parseResultSchema = {
  type: Type.OBJECT,
  properties: {
    rawInput: { type: Type.STRING },
    clauses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING },
          matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          isUnrecognized: { type: Type.BOOLEAN },
          unrecognizedWords: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedTemplate: { type: Type.STRING },
          mappedEffectType: { type: Type.STRING },
          mappedEffectDetail: { type: Type.STRING }
        },
        required: ["originalText", "matchedKeywords", "isUnrecognized", "unrecognizedWords", "suggestedTemplate", "mappedEffectType", "mappedEffectDetail"]
      }
    },
    unrecognizedTerms: { type: Type.ARRAY, items: { type: Type.STRING } },
    structuredTemplate: { type: Type.STRING },
    recommendedEffectType: { type: Type.STRING },
    recommendedEffectDetail: { type: Type.STRING },
    isFullyMapped: { type: Type.BOOLEAN },
    templateSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["rawInput", "clauses", "unrecognizedTerms", "structuredTemplate", "recommendedEffectType", "recommendedEffectDetail", "isFullyMapped", "templateSuggestions"]
};

app.post("/api/parse-effect-text", async (req, res) => {
  let { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "請提供有效的文字描述" });
  }

  // Strip BOSS annotations
  text = text.replace(/[（(][^（()）]*[Bb][Oo][Ss][Ss][^（()）]*[)）]/g, "");

  try {
    const systemInstruction = `
      你是一個《賽爾號》遊戲效果語義深度解析與結構化 JSON 映射引擎。
      你的任務是將用戶輸入的精靈效果或技能文字描述，深度解析並轉化為符合結構化 JSON 規範的對象。
      
      ${TEMPLATE_GRAMMAR_GUIDELINES}
      
      【現有標準效果庫】：
      ${librarySummary}
      
      解析準則：
      1. 識別關鍵字（如：傷害翻倍、恢復體力、屬性提升、麻痺、免死、護盾等），映射到最合適的現有效果庫與底層 effectType/effectDetail。
      2. 對於不識別或原創的特殊詞彙（例如「黑洞吞噬」、「靈魂碎裂」等自訂概念），將其記錄到 unrecognizedTerms 暫存區，並為每句提供標準化的《賽爾號》觸發式分號語法建議 (suggestedTemplate)。
         - **【極度重要】絕對不允許省略或簡化用戶的原版文本**：在生成 suggestedTemplate 或解析過程時，必須完整保留用戶設定的所有觸發條件（如「命中後」、「未擊敗對手則」、「技能無效時」）、附加效果及限制。不能因為分類或排版就將其省略。
      3. 整合生成 structuredTemplate，確保引擎後續能夠順利引用與進行數值計算。
      4. 輸出語言必須為「繁體中文」。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `請將以下精靈效果描述轉化為結構化 JSON 對象，進行關鍵字庫存映射與自訂詞彙模板化：\n\n${text}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: parseResultSchema,
        temperature: 0.3,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 沒有返回任何內容。");
    }

    const parseResult = JSON.parse(response.text.trim());
    res.json({ success: true, data: parseResult });
  } catch (error: any) {
    console.error("AI 文本結構化解析失敗:", error);
    res.status(500).json({ error: "AI 文本結構化解析失敗", details: error.message });
  }
});

// JSON Schema for Token Dissect Analysis
const dissectResultSchema = {
  type: Type.OBJECT,
  properties: {
    rawText: { type: Type.STRING },
    tokens: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "拆解出來的單個詞彙或片語，例如 '在場期間'、'每次'、'受到'、'麻痺'" },
          type: { 
            type: Type.STRING, 
            description: "詞彙類型，必須為：timing (時點), condition (條件), connective (連接詞), effect (效果), other (其他/對手/己方/技能名稱等), unknown (其他不確定類型)" 
          }
        },
        required: ["text", "type"]
      }
    },
    clauses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "被動特性或技能子句標題，例如 '被動特性 1：能力繼承'" },
          trigger: { type: Type.STRING, description: "觸發時點 (Trigger)，如 '每次/受到/麻痺/時/後'" },
          condition: { type: Type.STRING, description: "觸發條件 (Condition)，若無則省略" },
          target: { type: Type.STRING, description: "生效目標 (Target)，如 '己方/在場精靈'" },
          actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "具體行為 (Actions) 列表，如 ['將/當前/所處/異常狀態/轉化/為/星贖']" },
          branch: { type: Type.STRING, description: "分支條件 (Branch)，若有則填寫" },
          branchActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "分支行為 (Branch Actions) 列表" },
          modifier: { type: Type.STRING, description: "動態修飾/縮減機制 (Modifier)" }
        },
        required: ["title", "trigger", "target", "actions"]
      }
    }
  },
  required: ["rawText", "tokens", "clauses"]
};

app.post("/api/dissect-tokens", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "請提供有效的文字描述" });
  }

  try {
    const systemInstruction = `
      你是一個專門對《賽爾號》精靈魂印特性與技能效果進行「語義分詞與實裝協定 (Semantic Tokenization Protocol)」的深度分析引擎。
      
      你的任務是：
      1. 將輸入的文字描述完全「細粒度拆解」為一連串的 Token 詞組流 (Token Flow)。每個詞組都必須精確分類。若輸入中含有斜線 '/'，應以此斜線作為強制分割邊界，但同樣需要判定其詞性。
      2. 詞組分類必須為以下之一：
         - "timing" (時點)：描述什麼時候觸發，如「每次」、「當回合」、「回合開始時」、「出手流程結束後」、「在場期間」等。
         - "condition" (條件)：描述觸發時的依賴條件，如「若」、「低於」、「每有」、「死亡」、「未觸發」等。
         - "connective" (連接詞)：如「時」、「後」、「且」、「或」、「則」、「為」、「將」等。
         - "effect" (效果)：具體的效果動作，如「轉化」、「消除」、「無法被消除」、「進行額外行動」、「造成...傷害」、「令對手失明」、「重生」等。
         - "other" (其他)：主體、客體、屬性、印記或特定數值名詞，如「所有能力值」、「己方」、「在場精靈」、「對方」、「斯嘉麗」、「燦界聖芒」等。
         - "unknown"：若無法確定則歸於此。
      
      3. 將拆解後的 Token 組合成多個「被動特性」或「語義子句 (Clauses)」，每個子句必須精確對齊為：
         - "title" (標題名稱)
         - "trigger" (觸發時點/Trigger)
         - "condition" (條件/Condition，可選)
         - "target" (目標/Target)
         - "actions" (行為/Actions 陣列)
         - "branch" (分支條件，可選)
         - "branchActions" (分支行為，可選)
         - "modifier" (動態縮減/Modifier，可選)
         
      【經典範例對齊標準】：
      若輸入為："所有能力值/己方/在場精靈/每次/受到/麻痺/時/將/當前/所處/異常狀態/轉化/為/星贖/且/當回合/直到/戰鬥階段/結束前/回合類效果/無法/被/消除/在場期間/每次/出手流程/結束/後(含/選擇/技能/因故/未能/出手/)進行/一/次/額外行動/造成/對方/等同於/最大體力/⅓/的/光系傷害/且/100%/令/對手/失明//未觸發/失明/或/對手/已處於/失明/則/消除/對手/回合類效果/且/令//下/2次/造成/的/攻擊傷害/提升/150%/；己方/死亡/4/回合/後/在/背包/內/重生/，己方/每/有/1層/燦界/聖芒/則/重生/所需/回合/降低/1回合/"
      你應當精準將其所有字詞切割，不漏掉任何一個字，並精確分類，且生成 4 個子句對齊。
      
      請確保對任何新輸入的文字都能做到同樣高水準的 100% 覆蓋拆解。輸出必須為繁體中文，且回傳格式必須嚴格符合指定的 JSON Schema。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `請對以下文本進行「語義分詞與實裝協定」深度解構分析：\n\n${text}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: dissectResultSchema,
        temperature: 0.2,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 沒有返回任何內容。");
    }

    const resultData = JSON.parse(response.text.trim());
    res.json({ success: true, data: resultData });
  } catch (error: any) {
    console.error("AI 語義分詞解構失敗:", error);
    res.status(500).json({ error: "AI 語義分詞解構失敗", details: error.message });
  }
});

// ── 賽爾號圖片資源：public/seer → 使用者資料夾(pet/、系/) → 本機快取 → 遠端(SeerAPI/seer-unity-assets，下載後快取)
const SEER_REMOTE = "https://raw.githubusercontent.com/SeerAPI/seer-unity-assets/main/newseer/assets/art/ui/assets";
const seerMisses = new Set<string>();
function isPng(file: string): boolean {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  } catch { return false; }
}
function fetchBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 8000 }, (r) => {
      if (r.statusCode !== 200) { r.resume(); resolve(null); return; }
      const chunks: Buffer[] = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => resolve(Buffer.concat(chunks)));
      r.on("error", () => resolve(null));
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}
app.get("/seer/:kind/:file", async (req, res) => {
  const { kind } = req.params;
  const file = path.basename(decodeURIComponent(req.params.file));
  const root = process.cwd();
  const send = (p: string) => { res.setHeader("Cache-Control", "public, max-age=604800"); res.sendFile(p); };
  if (!/\.png$/i.test(file)) { res.status(404).end(); return; }
  if (kind === "xi") {
    // public/seer/xi 放縮小過的版本（原圖過大時），其次才是使用者「系」資料夾
    for (const p of [path.join(root, "public", "seer", "xi", file), path.join(root, "系", file)]) if (isPng(p)) return send(p);
    res.status(404).end(); return;
  }
  if (!["head", "body", "type", "abnormal", "buff"].includes(kind) || !(/^\d+\.png$/.test(file) || (kind === "type" && file === "prop.png"))) { res.status(404).end(); return; }
  // 官方資源優先（public/seer → 快取 → 遠端）；使用者 pet/ 資料夾僅在官方取不到時使用（舊版編號可能對不上）
  const cacheFile = path.join(root, ".seer-cache", kind, file);
  for (const p of [path.join(root, "public", "seer", kind, file), cacheFile]) if (isPng(p)) return send(p);
  const userPet = kind === "head" ? path.join(root, "pet", file) : "";
  const key = `${kind}/${file}`;
  if (seerMisses.has(key)) { if (userPet && isPng(userPet)) return send(userPet); res.status(404).end(); return; }
  const remote = `${SEER_REMOTE}/${kind === "type" ? "pettype" : (kind === "abnormal" || kind === "buff") ? "battleeffect/" + kind : "pet/" + kind}/${file}`;
  const buf = await fetchBuffer(remote);
  if (!buf || buf[0] !== 0x89 || buf[1] !== 0x50) { seerMisses.add(key); if (userPet && isPng(userPet)) return send(userPet); res.status(404).end(); return; }
  try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, buf); } catch {}
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800");
  res.end(buf);
});

// Setup Vite Dev Server / Static Files Serve
async function startServer() {
  app.use("/images", express.static(path.join(process.cwd(), "images")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

app.post("/api/get-title", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "未知標題";
    res.json({ title });
  } catch (error) {
    res.json({ title: "無法取得標題" });
  }
});

startServer();
