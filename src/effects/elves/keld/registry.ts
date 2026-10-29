import { multiplyDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';
import { combineSettlementCallbacks } from '../../../battle/settlementReceipt';

// 5012 魂印「冰」已遷移為真 Kit（migratedKeldSoulKit.ts；DSH 20261017）——舊 handler 整份移除（規則3.3）。
// 全部子句由 Kit 通用件表達：incoming_reduction_branch／backlash_percent／resource_mark_add(keld_soul)／
// drain{event_damage}／event_damage_type+survive／ignore 層數矩陣／first_hit 冰封-肅霜／
// damage_cap_by_mark／opp_priority_ceiling{perMark}。
export const handleKeldSoulMark = (_ctx: any, _event: any, _extra?: any) => false;

export const KELD_SKILLS: Record<string, BattleSkillHandler> = {
  "凝寒止喧": (ctx) => {
    const { addLog, clearTurnEffectsOf } = ctx;
    addLog(`❄️ 【凝寒止喧】：萬物肅靜，冰封一切！`, "effect");
    clearTurnEffectsOf(ctx.targetSide);
  }
};

export { KeldDeconstructedProfile } from "../../../data/elfProfiles/keldRegistry";
