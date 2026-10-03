import { queueActionPowerMultiplier } from '../battle/actionDamageModifiers';
import { BattleEventContext, EffectTiming } from './types';
import { prdPercent } from '../utils/prd';
import { statusChanceBlocked } from '../battle/statusChanceRules';

// 定義模板執行器型別
export type TemplateEffectExecutor = (args: any[], ctx: BattleEventContext) => void;

// 使用戰鬥內的種子亂數（可重現），無則退回 Math.random
const roll = (ctx: BattleEventContext) => (ctx.rng ? ctx.rng() : Math.random());
void roll;
// 機率判定一律走偽隨機（每個「精靈 × 技能 × 效果位置」各自計數）
const chanceOf = (ctx: BattleEventContext, tag: string, percent: number) =>
  prdPercent(`${ctx.actor}:${ctx.self?.id}:${ctx.skill?.name ?? ""}:${tag}`, percent);


// 能力等級：透過 updateElf 寫回（不可直接改 ctx.self / ctx.target 物件）
const resetStages = (ctx: BattleEventContext, side: "p1" | "p2", pick: (v: number) => boolean): boolean => {
  const elf = side === ctx.actor ? ctx.self : ctx.target;
  const stages: Record<string, number> = { ...(elf.statStages as any) };
  let changed = false;
  for (const key in stages) {
    const val = stages[key];
    if (typeof val === 'number' && pick(val)) { stages[key] = 0; changed = true; }
  }
  if (changed) ctx.updateElf(side, { statStages: stages as any });
  return changed;
};

// 1. 核心模板效果註冊表 (第一階段黃金骨幹)
export const TEMPLATE_EFFECTS: Record<string, TemplateEffectExecutor> = {
  // 0001: 給予對方損傷的一半會回覆自己的體力
  "0001": (args, ctx) => {
    const ratio = args[0] !== undefined ? Number(args[0]) : 0.5;
    ctx.setPlayerState("vampireRatio", ratio);
  },

  // 0002: 對方體力小於1/2時威力加倍
  "0002": (args, ctx) => {
    if (ctx.target.currentHp < ctx.target.maxHp / 2) {
      const multiplier = args[0] !== undefined ? Number(args[0]) : 2;
      // 不改動技能物件本身（避免威力永久累乘），改用本次行動的傷害倍率
      queueActionPowerMultiplier(ctx, multiplier);
      ctx.addLog(`⚡ 【威能突破】：對手體力已低於 1/2，技能威力提升至 ${multiplier} 倍！`, "effect");
    }
  },

  // 0003: 解除自身的能力下降狀態（BOSS有效）
  "0003": (args, ctx) => {
    if (resetStages(ctx, ctx.actor, v => v < 0)) {
      ctx.addLog(`🛡️ 【淨化】：成功解除了自身所有的能力下降狀態！`, "status");
    }
  },

  // 0004: 技能使用成功時，{1}%改變自身{0}等級{2}（BOSS有效）
  // args 格式: [屬性名, 機率, 變化等級] 例如 ["atk", 100, 1]
  "0004": (args, ctx) => {
    const statName = args[0] || "atk";
    const chance = args[1] !== undefined ? Number(args[1]) : 100;
    const level = args[2] !== undefined ? Number(args[2]) : 1;

    if (chanceOf(ctx, "L54", chance)) {
      ctx.applyStatChange(ctx.actor, { [statName]: level });
      ctx.addLog(`📈 【能力提升】：自身【${translateStat(statName)}】等級提升了 ${level} 級！`, "status");
    }
  },

  // 0005: 技能使用成功時，{1}%改變對手{0}等級{2}（BOSS有效）
  // args 格式: [屬性名, 機率, 變化等級] 例如 ["def", 100, -1]
  "0005": (args, ctx) => {
    const statName = args[0] || "def";
    const chance = args[1] !== undefined ? Number(args[1]) : 100;
    const level = args[2] !== undefined ? Number(args[2]) : -1;

    if (chanceOf(ctx, "L67", chance)) {
      ctx.applyStatChange(ctx.targetSide, { [statName]: level });
      ctx.addLog(`📉 【能力降低】：對手【${translateStat(statName)}】等級下降了 ${Math.abs(level)} 級！`, "status");
    }
  },

  // 0010: 命中後{0}%令對方麻痺
  "0010": (args, ctx) => {
    const chance = args[0] !== undefined ? Number(args[0]) : 100;
    if (!statusChanceBlocked(ctx, chance) && chanceOf(ctx, "L76", chance)) {
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 2);
      if (res.success) {
        ctx.addLog(`⚡ 【異常狀態】：使對手陷入了【麻痺】狀態！`, "status");
      }
    }
  },

  // 0011: 命中後{0}%令對方中毒（BOSS有效）
  "0011": (args, ctx) => {
    const chance = args[0] !== undefined ? Number(args[0]) : 100;
    if (!statusChanceBlocked(ctx, chance) && chanceOf(ctx, "L87", chance)) {
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "中毒", 3);
      if (res.success) {
        ctx.addLog(`🤢 【異常狀態】：使對手陷入了【中毒】狀態！`, "status");
      }
    }
  },

  // 0012: 命中後{0}%令對方燒傷（BOSS有效）
  "0012": (args, ctx) => {
    const chance = args[0] !== undefined ? Number(args[0]) : 100;
    if (!statusChanceBlocked(ctx, chance) && chanceOf(ctx, "L98", chance)) {
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "燒傷", 3);
      if (res.success) {
        ctx.addLog(`🔥 【異常狀態】：使對手陷入了【燒傷】狀態！`, "status");
      }
    }
  },

  // 0029: 額外附加{0}點固定傷害（BOSS有效）
  "0029": (args, ctx) => {
    const amount = args[0] !== undefined ? Number(args[0]) : 100;
    ctx.applyFixedDamage(ctx.targetSide, amount, "額外固傷");
  },

  // 0033: 消除對手能力提升狀態（BOSS有效）
  "0033": (args, ctx) => {
    if (resetStages(ctx, ctx.targetSide, v => v > 0)) {
      ctx.addLog(`✨ 【消強】：成功消除了對手所有的能力提升狀態！`, "status");
    }
  },

  // 0043: 恢復自身最大體力的1/{0}
  "0043": (args, ctx) => {
    const denominator = args[0] !== undefined ? Number(args[0]) : 4;
    const amount = Math.floor(ctx.self.maxHp / denominator);
    ctx.applyHeal(ctx.actor, amount);
    ctx.addLog(`💚 【治療】：恢復了最大體力的 1/${denominator}（+${amount}）！`, "heal");
  },

  // 0466: 恢復{0}點體力
  "0466": (args, ctx) => {
    const amount = args[0] !== undefined ? Number(args[0]) : 100;
    ctx.applyHeal(ctx.actor, amount);
    ctx.addLog(`💚 【治療】：直接恢復了 ${amount} 點體力！`, "heal");
  },

  // 0481: 下{0}回合自身攻擊先制+{1}
  "0481": (args, ctx) => {
    const turns = args[0] !== undefined ? Number(args[0]) : 1;
    const priority = args[1] !== undefined ? Number(args[1]) : 1;
    ctx.setPlayerState("nextTurnPriority", priority);
    ctx.addLog(`⏳ 【先制特權】：下 ${turns} 回合自身的攻擊技能先制 +${priority}！`, "effect");
  },

  // 0008: 技能命中時，接下來 {0} 回合每回合恢復 {1} 點體力
  "0008": (args, ctx) => {
    const turns = args[0] !== undefined ? Number(args[0]) : 3;
    const amount = args[1] !== undefined ? Number(args[1]) : 100;
    ctx.setPlayerState("hpHealPerTurnTurns", turns);
    ctx.setPlayerState("hpHealPerTurnAmount", amount);
    ctx.addLog(`💚 【再生宣告】：使自身在接下來的 ${turns} 回合內，每回合恢復 ${amount} 點體力！`, "heal");
  },

  // 0009: 技能命中時，接下來 {0} 回合每回合使對手受到 {1} 點固定傷害
  "0009": (args, ctx) => {
    const turns = args[0] !== undefined ? Number(args[0]) : 3;
    const amount = args[1] !== undefined ? Number(args[1]) : 150;
    ctx.setOpponentState("hpLossPerTurnTurns", turns);
    ctx.setOpponentState("hpLossPerTurnAmount", amount);
    ctx.addLog(`🥀 【能量衰竭】：使對手在接下來的 ${turns} 回合內，每回合受到 ${amount} 點固定傷害！`, "effect");
  },

  // 0015: 命中後{0}%令對方害怕
  "0015": (args, ctx) => {
    const chance = args[0] !== undefined ? Number(args[0]) : 100;
    if (!statusChanceBlocked(ctx, chance) && chanceOf(ctx, "L163", chance)) {
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 2);
      if (res.success) {
        ctx.addLog(`😱 【異常狀態】：使對手陷入了【害怕】狀態！`, "status");
      }
    }
  },

  // 0016: 命中後{0}%令對方冰封
  "0016": (args, ctx) => {
    const chance = args[0] !== undefined ? Number(args[0]) : 100;
    if (!statusChanceBlocked(ctx, chance) && chanceOf(ctx, "L174", chance)) {
      const res = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "冰封", 2);
      if (res.success) {
        ctx.addLog(`❄️ 【異常狀態】：使對手陷入了【冰封】狀態！`, "status");
      }
    }
  },

  // 0030: 減少對手所有的技能 PP 值 {0} 點
  "0030": (args, ctx) => {
    const amount = args[0] !== undefined ? Number(args[0]) : 2;
    ctx.applyStatChange(ctx.targetSide, {}, { all: -amount });
    ctx.addLog(`📉 【扣除 PP】：扣減了對手所有技能的 PP 值 ${amount} 點！`, "effect");
  },

  // 0051: 恢復自身所有技能的 PP 值 {0} 點
  "0051": (args, ctx) => {
    const amount = args[0] !== undefined ? Number(args[0]) : 2;
    ctx.applyStatChange(ctx.actor, {}, { all: amount });
    ctx.addLog(`📈 【PP 恢復】：恢復了自身所有技能的 PP 值 ${amount} 點！`, "heal");
  },

  // 0056: 將自身能力下降狀態轉移給對手
  "0056": (args, ctx) => {
    const selfStages: Record<string, number> = { ...(ctx.self.statStages as any) };
    const oppStages: Record<string, number> = { ...(ctx.target.statStages as any) };
    let transferred = false;
    for (const key in selfStages) {
      const val = selfStages[key];
      if (typeof val === 'number' && val < 0) {
        oppStages[key] = Math.max(-6, (oppStages[key] || 0) + val);
        selfStages[key] = 0;
        transferred = true;
      }
    }
    if (transferred) {
      ctx.updateElf(ctx.actor, { statStages: selfStages as any });
      ctx.updateElf(ctx.targetSide, { statStages: oppStages as any });
      ctx.addLog(`🔄 【弱化轉移】：成功將自身受到的所有能力下降狀態轉移給對手！`, "status");
    }
  },

  // 0080: 技能命中時，下回合自身的技能必定致命一擊
  "0080": (args, ctx) => {
    ctx.setPlayerState("nextTurnCrit", true);
    ctx.addLog(`⚡ 【暴擊預備】：凝聚能量！下回合自身的攻擊技能必定致命一擊！`, "effect");
  },

  // 0101: 附加 {0} 點傷害吸收護盾
  "0101": (args, ctx) => {
    const amount = args[0] !== undefined ? Number(args[0]) : 300;
    ctx.applyShield(ctx.actor, amount);
    ctx.addLog(`🛡️ 【護盾】：為自身附加了可吸收 ${amount} 點傷害的護盾！`, "status");
  }
};

// 輔助翻譯函數
export function translateStat(stat: string): string {
  const mapping: Record<string, string> = {
    hp: "體力",
    atk: "攻擊",
    def: "防禦",
    spatk: "特攻",
    spdef: "特防",
    speed: "速度",
    accuracy: "命中"
  };
  return mapping[stat] || stat;
}

// 根據描述動態執行或利用 templateId 執行
export function executeTemplateEffect(templateId: string, args: any[], ctx: BattleEventContext): boolean {
  if (TEMPLATE_EFFECTS[templateId]) {
    TEMPLATE_EFFECTS[templateId](args, ctx);
    return true;
  }
  return false;
}

export function extractTemplateIdFromText(desc: string): { templateId: string, args: any[] } | null {
  if (!desc) return null;

  // 匹配 0001
  if (desc.includes("給予對方損傷的一半會回覆自己的體力") || desc.includes("給予對方損傷的一半會回復自己的體力") || desc.includes("將所受傷害的一半恢復")) {
    return { templateId: "0001", args: [0.5] };
  }
  
  // 匹配 0002
  if (desc.includes("對方體力小於1/2時威力加倍") || desc.includes("對手體力小於1/2時威力加倍")) {
    return { templateId: "0002", args: [2] };
  }

  // 匹配 0003
  if (desc.includes("解除自身的能力下降狀態") || desc.includes("清除自身能力下降")) {
    return { templateId: "0003", args: [] };
  }

  // 匹配 0004
  const statUpMatch = desc.match(/(機率)?\s*(100|[1-9]\d?)%\s*(機率)?\s*令對手\s*(攻擊|防禦|特攻|特防|速度|命中|閃避|全屬性)\s*([+-]\d+)/);
  if (statUpMatch && !desc.includes("自身")) { // 簡化版
    // Note: this relies on stat translating
  }
  
  // 匹配 0008 (例如 "接下來 3 回合每回合恢復 100 點體力")
  const delayedHealMatch = desc.match(/(?:接下來|持續)\s*(\d+)\s*回合.*每回合(?:恢復|回復)\s*(\d+)\s*點體力/) || desc.match(/每回合(?:恢復|回復)\s*(\d+)\s*點體力.*(?:接下來|持續)\s*(\d+)\s*回合/);
  if (delayedHealMatch) {
    const isFirstFormat = desc.includes("每回合");
    let turns, amount;
    if (desc.match(/(?:接下來|持續)\s*(\d+)\s*回合.*每回合/)) {
      turns = parseInt(delayedHealMatch[1], 10);
      amount = parseInt(delayedHealMatch[2], 10);
      return { templateId: "0008", args: [turns, amount] };
    } else {
      amount = parseInt(delayedHealMatch[1], 10);
      turns = parseInt(delayedHealMatch[2], 10);
      return { templateId: "0008", args: [turns, amount] };
    }
  }

  // 匹配 0009 (例如 "接下來 3 回合每回合使對手受到 150 點固定傷害")
  const delayedDmgMatch = desc.match(/(?:接下來|持續)\s*(\d+)\s*回合.*每回合.*對手受到\s*(\d+)\s*點固定傷害/) || desc.match(/每回合.*對手受到\s*(\d+)\s*點固定傷害.*(?:接下來|持續)\s*(\d+)\s*回合/);
  if (delayedDmgMatch) {
    if (desc.match(/(?:接下來|持續)\s*(\d+)\s*回合.*每回合/)) {
      const turns = parseInt(delayedDmgMatch[1], 10);
      const amount = parseInt(delayedDmgMatch[2], 10);
      return { templateId: "0009", args: [turns, amount] };
    } else {
      const amount = parseInt(delayedDmgMatch[1], 10);
      const turns = parseInt(delayedDmgMatch[2], 10);
      return { templateId: "0009", args: [turns, amount] };
    }
  }

  // 匹配 0015 (例如 "50%機率使對手害怕")
  const fearMatch = desc.match(/(\d+)%\s*機率(?:使對手|令對方)害怕/) || desc.match(/害怕.*(\d+)%\s*機率/);
  if (fearMatch) {
    const chance = parseInt(fearMatch[1], 10);
    return { templateId: "0015", args: [chance] };
  }

  // 匹配 0016 (例如 "40%機率使對手冰封")
  const frozenMatch = desc.match(/(\d+)%\s*機率(?:使對手|令對方)冰封/) || desc.match(/冰封.*(\d+)%\s*機率/);
  if (frozenMatch) {
    const chance = parseInt(frozenMatch[1], 10);
    return { templateId: "0016", args: [chance] };
  }

  // 匹配 0030 (例如 "減少對手所有技能 2 點 PP")
  const subPpMatch = desc.match(/(?:減少|扣除)對手.*(?:PP|pp|技能)\s*(\d+)\s*點/);
  if (subPpMatch) {
    const amount = parseInt(subPpMatch[1], 10);
    return { templateId: "0030", args: [amount] };
  }

  // 匹配 0051 (例如 "恢復自身所有技能 2 點 PP")
  const addPpMatch = desc.match(/(?:恢復|恢復自身).*(?:PP|pp|技能)\s*(\d+)\s*點/);
  if (addPpMatch) {
    const amount = parseInt(addPpMatch[1], 10);
    return { templateId: "0051", args: [amount] };
  }

  // 匹配 0056 (例如 "將自身能力下降狀態轉移給對手")
  if (desc.includes("將自身能力下降狀態轉移給對手") || desc.includes("自身能力下降狀態雙倍轉移")) {
    return { templateId: "0056", args: [] };
  }

  // 匹配 0080 (例如 "下回合自身技能必定致命一擊")
  if (desc.includes("下回合自身的技能必定致命一擊") || desc.includes("下回合自身技能必定致命一擊") || desc.includes("下回合必定暴擊")) {
    return { templateId: "0080", args: [] };
  }

  // 匹配 0101 (例如 "附加 300 點傷害吸收護盾")
  const shieldMatch = desc.match(/附加\s*(\d+)\s*點(?:傷害吸收)?護盾/);
  if (shieldMatch) {
    const amount = parseInt(shieldMatch[1], 10);
    return { templateId: "0101", args: [amount] };
  }
  
  return null;
}

// 語義分詞與動態自動解析機制 (Semantic Tokenization Protocol)
export function parseAndExecuteTemplate(ctx: BattleEventContext): boolean {
  const sk = ctx.skill;
  if (!sk) return false;

  // 1. 如果技能已經在對象中顯式指定了 templateId 且在註冊表中
  if (sk.templateId && TEMPLATE_EFFECTS[sk.templateId]) {
    executeTemplateEffect(sk.templateId, sk.templateArgs || [], ctx);
    return true;
  }

  // 2. 自動語義正則與關鍵字提取 (對齊玩家大表的自然語言模式)
  const desc = sk.description || "";
  const match = extractTemplateIdFromText(desc);
  if (match && TEMPLATE_EFFECTS[match.templateId]) {
    executeTemplateEffect(match.templateId, match.args, ctx);
    return true;
  }

  // 匹配 0004 (保留舊的複雜解析，或是以後也移到 extractTemplateIdFromText)
  const statUpMatch = desc.match(/(機率)?\s*(100|[1-9]\d?)%\s*(機率)?\s*令對手\s*(攻擊|防禦|特攻|特防|速度|命中|閃避|全屬性)\s*([+-]\d+)/);
  if (statUpMatch && !desc.includes("自身")) { // 簡化版
    let chance = 100;
    if (statUpMatch[2]) {
      chance = parseInt(statUpMatch[2], 10);
    }
    const statName = statUpMatch[4];
    const statVal = parseInt(statUpMatch[5], 10);
    
    // Reverse mapping
    const reverseMap: Record<string, string> = {
      "攻擊": "atk", "防禦": "def", "特攻": "spatk", "特防": "spdef", "速度": "speed", "命中": "accuracy", "全屬性": "all"
    };
    
    const internalStat = reverseMap[statName] || statName;
    if (internalStat) {
      if (statVal > 0) {
        TEMPLATE_EFFECTS["0004"]([internalStat, chance, statVal], ctx);
      } else {
        TEMPLATE_EFFECTS["0005"]([internalStat, chance, statVal], ctx);
      }
      return true;
    }
  }

  // 匹配 0010, 0011, 0012 等
  const statusMatch = desc.match(/(100|[1-9]\d?)%\s*(機率)?\s*令對手(麻痺|中毒|燒傷|害怕|睡眠|冰封)/);
  if (statusMatch) {
    const chance = parseInt(statusMatch[1], 10);
    const statusType = statusMatch[3];
    if (statusType === "麻痺") {
      TEMPLATE_EFFECTS["0010"]([chance], ctx);
      return true;
    } else if (statusType === "中毒") {
      TEMPLATE_EFFECTS["0011"]([chance], ctx);
      return true;
    } else if (statusType === "燒傷") {
      TEMPLATE_EFFECTS["0012"]([chance], ctx);
      return true;
    }
  }

  return false;
}
