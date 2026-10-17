import { multiplyDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from "../../types";
import { isStatusActive } from "../../../utils/statusManager";
import { isAbnormal as isAbnormalHelper } from "../../../utils/battleHelpers";
import { combineSettlementCallbacks } from '../../../battle/settlementReceipt';
import { runSkillBlocks } from '../../../blocks/registry';
import { executeGenericSkillText } from '../../genericSkillText';

/**
 * 冰魄·柯爾德 (Keld) A級專屬註冊表 [冰]
 */

// 5013 魂印「凕」已遷移為真 Kit（migratedKeerhodeSoulKit.ts；DSH 20261017）——舊 handler 整份移除。
// 重要修正：舊 handler 混入 5012「冰」段落（歷史複製遺留）——Kit 僅表達凕原文，不帶 5012 行為。
export const handleKeerhodeSoulMark = (_ctx: any, _event: any, _extra?: any) => false;

export const KEERHODE_SKILLS: Record<string, BattleSkillHandler> = {
  // 「王·夜予寒吟」已遷移為真 Kit（migratedKeerhodeSkillKits.ts；DSH 20261017）——橋接移除。
  // 「傲視千川」屬於 5012 冰魄柯爾德，實作在 keld/registry.ts（此處舊副本會被載入順序覆蓋，已移除）。
  "凝寒止喧": (ctx) => {
    ctx.addLog(`❄️ 使用【凝寒止喧】：消除對手回合類效果，封印屬性技能！`, "effect");
    ctx.clearTurnEffectsOf(ctx.actor === "p1" ? "p2" : "p1", ctx.target);
    ctx.setOpponentState("sealPropertyTurns", 2);
  },
  "冰天花葬": (ctx) => {
    ctx.addLog(`❄️ 使用【冰天花葬】：5 回合免疫並反彈異常，吸取體力！`, "effect");
    ctx.setPlayerState("immuneAndReflectStatusTurns", 5);
    ctx.setPlayerState("drainHpTurns", 5);
  },
  "王·蒼銀之棺": (ctx) => {
    ctx.addLog(`❄️ 使用【王·蒼銀之棺】：雙方進入凝滯與凍傷狀態！`, "effect");
    ctx.setPlayerState("stagnationTurns", 3);
    ctx.setOpponentState("stagnationTurns", 3);
    ctx.applyStatusWithImmunityCheck(ctx.actor, "凍傷", 3);
    ctx.applyStatusWithImmunityCheck(ctx.actor === "p1" ? "p2" : "p1", "凍傷", 3);
  },
  "王·霜祲霞罰": (ctx) => {
    ctx.addLog(`❄️ 使用【王·霜祲霞罰】：無視護盾並反轉自身能力下降！`, "effect");
    ctx.setPlayerState("ignoreShield", true);
  }
};

export { KeerhodeDeconstructedProfile } from "../../../data/elfProfiles/keerhodeRegistry";
