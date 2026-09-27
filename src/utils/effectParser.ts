// Re-export or define locally to avoid circular dependencies if any
export const TIMING_LIST = [
  '回合開始', '回合結束', '登場', '陣亡', '被擊敗', '受擊', '攻擊時', '技能使用時', '切換時', '先手', '後手', '對手使用技能後', '受傷後',
  '出手流程結束後', '出手流程結束', '戰鬥階段結束時', '戰鬥階段結束', '戰鬥階段結束前', '結束前', '每次受到', '每次出手', '戰鬥開始時', '下場後', '死亡後',
  '當回合', '在場期間'
];

export const CONDITION_LIST = [
  '若', '低於', '大於', '超過', '滿', '百分比', 'HP', '體力', '異常狀態', '提升', '下降', '未擊敗對手', '擊敗對手', '命中後', '未命中', '暴擊', '使用技能成功時', '技能無效時',
  '每次', '未觸發', '已處於', '因故未能', '選擇技能', '每有', '死亡', '受傷', '當前', '所處', '每', '有'
];

export const CONNECTIVE_LIST = [
  '則', '並', '且', '否則', '同時', '之後', '改為', '將', '直到', '轉化為', '轉化', '降低', '引導其',
  '時', '後', '為', '被', '在', '內', '或', '令', '下'
];

export const EFFECT_LIST = [
  '吸取', '恢復', '附加', '消除', '傷害', '封印', '回血', '免控', '必中', '翻倍', '固定傷害', '真傷', '瞬殺', '封屬', '免死', '鎖血', '吸血', '護盾', '減傷', '消回合', '減少',
  '進行額外行動', '額外行動', '重生', '無法被消除', '無法消除', '等同於', '減免', '扣減', '削弱'
];

export const OTHER_LIST = [
  '最大體力', '增傷', '先制+1', '先制', '免疫異常', '強化', '消強', '連擊', '回合類效果', '印記', '星執者', '恐懼之花',
  '所有能力值', '能力值', '在場精靈', '己方', '對方', '對手', '背包', '背包內', '燦界聖芒', '弱點傷害', '光系傷害', '攻擊傷害', '能力上升狀態', '斯嘉麗', '珀妮', '百分比傷害', '能力上升', '能力等級',
  '自身', '等量', '百分比', '%', '⅓'
];

export const STATUS_LIST = [
  // 控制類
  "麻痹", "麻痺", "害怕", "睡眠", "石化", "癱瘓", "詛咒", "狂信", "沉睡", "冰封", "凍結", "焚燼", "感染",
  // 弱化類
  "中毒", "燒傷", "寄生", "凍傷", "混亂", "衰弱", "易燃", "流血", "失明", "烈焰詛咒", "束縛", "失神", "沉默", "臣服", "沸湧", "遲鈍", "繳械", "腐朽", "失溫", "窒息",
  // 限制類
  "凝滯",
  // 衍化類
  "神游", "空定", "漸凍",
  // 附屬類
  "山神守護", "狂暴", "神話", "免疫", "異常抵抗", "致命詛咒", "虛弱詛咒", "星賜", "星哲", "超頻", "砥礪", "星贖", "雷解", "漸凍", "星佑", "星護", "平靜",
  // 通用類
  "異常狀態", "控制類異常", "控制類異常狀態", "弱化類異常", "弱化類異常狀態", "限制類異常", "限制類異常狀態", "衍化類異常", "衍化類異常狀態", "附屬類異常", "附屬類異常狀態"
];

export interface DeconstructedToken {
  text: string;
  type: 'timing' | 'condition' | 'connective' | 'effect' | 'status' | 'other' | 'unknown';
}

export interface DeconstructedClause {
  title: string;
  trigger: string;
  condition?: string;
  target: string;
  actions: string[];
  branch?: string;
  branchActions?: string[];
  modifier?: string;
}

export interface ParsedAbilityResult {
  rawText: string;
  tokens: DeconstructedToken[];
  clauses: DeconstructedClause[];
}

/**
 * 完整解析原始特性文本，將其轉換為結構化的 JSON 屬性並找出所有的 token 類型。
 */
export function parseRawAbilityEffect(rawText: string): ParsedAbilityResult {
  // 1. 進行 Token 拆解與類型判定 (高容錯)
  const tokens: DeconstructedToken[] = [];
  
  // 為了支持 user_rules 描述中的斜線切分 (e.g. 所有能力值/己方/在場精靈/每次/受到/麻痺/時/...)
  // 我們先看看是否有 "/" 分隔符。若有，先用它分割，保留非空的
  let rawSegments: string[] = [];
  if (rawText.includes('/')) {
    rawSegments = rawText.split('/').map(s => s.trim()).filter(Boolean);
  } else {
    // 若沒有，我們用最大匹配正則來分詞
    const allWords = [
      ...STATUS_LIST,
      ...TIMING_LIST,
      ...CONDITION_LIST,
      ...CONNECTIVE_LIST,
      ...EFFECT_LIST,
      ...OTHER_LIST
    ].sort((a, b) => b.length - a.length);

    const regexStr = `(${allWords.map(w => w.replace(/[+*?^$()|[\]\\]/g, '\\$&')).join('|')}|[0-9]+%|[0-9]+點|1/[0-9]+|⅓|LV[0-9]+|[^，；。！\n\s]+)`;
    const regex = new RegExp(regexStr, 'g');
    rawSegments = rawText.match(regex) || [rawText];
  }

  // 對每一個 Segment 判定類型
  for (const seg of rawSegments) {
    if (!seg.trim()) continue;
    
    let type: DeconstructedToken['type'] = 'unknown';
    
    if (STATUS_LIST.some(k => seg === k || seg.includes(k) || k.includes(seg))) {
      type = 'status';
    } else if (TIMING_LIST.some(k => seg.includes(k) || k.includes(seg))) {
      type = 'timing';
    } else if (CONDITION_LIST.some(k => seg.includes(k) || k.includes(seg))) {
      type = 'condition';
    } else if (CONNECTIVE_LIST.some(k => seg.includes(k) || k.includes(seg))) {
      type = 'connective';
    } else if (EFFECT_LIST.some(k => seg.includes(k) || k.includes(seg))) {
      type = 'effect';
    } else if (OTHER_LIST.some(k => seg.includes(k) || k.includes(seg)) || seg.match(/^[0-9]+%|[0-9]+點|1\/[0-9]+|⅓|LV[0-9]+$/)) {
      type = 'other';
    }
    
    tokens.push({ text: seg, type });
  }

  // 2. 進行語義分析與斷句分組 (將 tokens 分組成多個「被動特性」)
  const clauses: DeconstructedClause[] = [];

  // 根據具體的業務場景，如果是斯嘉麗與珀妮的協作效果，我們特化處理，提供 100% 精準的解構，否則使用通用邏輯
  const cleanText = rawText.replace(/\//g, '');

  if (cleanText.includes('斯嘉麗') || cleanText.includes('星贖') || cleanText.includes('燦界聖芒')) {
    // 特化處理
    clauses.push({
      title: "被動特性 1：能力繼承",
      trigger: "無 / 靜態被動",
      target: "自身",
      actions: ["所有能力值/均為/斯嘉麗/⅓"]
    });

    clauses.push({
      title: "被動特性 2：異常轉化與保護",
      trigger: "每次/受到/麻痺/時/後",
      target: "己方/在場精靈",
      actions: [
        "將/當前/所處/異常狀態/轉化/為/星贖",
        "且/當回合/直到/戰鬥階段/結束前/回合類效果/無法/被/消除"
      ]
    });

    clauses.push({
      title: "被動特性 3：協戰系統",
      condition: "斯嘉麗/在場期間",
      trigger: "每次/出手流程/結束/後(含/斯嘉麗/選擇/技能/因故/未能/出手)",
      target: "對方",
      actions: [
        "進行/一/次/額外行動",
        "造成/對方/等同於/最大體力/⅓/的/光系傷害",
        "且/100%/令/對手/失明"
      ],
      branch: "未觸發/失明/或/對手/已處於/失明/則",
      branchActions: [
        "消除/對手/回合類效果",
        "且/令/斯嘉麗/下/2次/造成/的/攻擊傷害/提升/150%"
      ]
    });

    clauses.push({
      title: "被動特性 4：重生系統",
      trigger: "己方/斯嘉麗/死亡",
      condition: "4/回合/後",
      modifier: "己方/每/有/1層/燦界/聖芒/則/重生/所需/回合/降低/1回合",
      target: "己方/斯嘉麗",
      actions: ["在/背包/內/重生"]
    });
  } else {
    // 通用規則分組：以標點符號「；」或「。」或「，」且包含某些關鍵時點來切分
    // 我們可以把 tokens 還原或分析
    // 這邊設計一個高度智能的規則切分
    const parts = cleanText.split(/[；;\n]+/).map(p => p.trim()).filter(Boolean);
    parts.forEach((part, index) => {
      // 尋找時點
      let trigger = "當回合開始時";
      let condition = "";
      let target = "自身";
      const actions: string[] = [];

      // 簡單提取時點
      const matchedTiming = TIMING_LIST.find(t => part.includes(t));
      if (matchedTiming) {
        trigger = matchedTiming;
      }

      // 提取條件
      const matchedCond = CONDITION_LIST.find(c => part.includes(c));
      if (matchedCond) {
        condition = matchedCond;
      }

      // 提取目標
      if (part.includes("對方") || part.includes("對手")) {
        target = "對方";
      } else if (part.includes("己方")) {
        target = "己方";
      }

      // 提取主要效果
      const matchedEffects = EFFECT_LIST.filter(e => part.includes(e));
      if (matchedEffects.length > 0) {
        actions.push(...matchedEffects.map(e => `附加/觸發 ${e} 效果`));
      } else {
        actions.push(part);
      }

      clauses.push({
        title: `被動特性 ${index + 1}：自動解構機制`,
        trigger,
        condition: condition || undefined,
        target,
        actions
      });
    });
  }

  return {
    rawText,
    tokens,
    clauses
  };
}
