import { multiplyDamageReduction } from '../../../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';
import { turnEffect } from "../../../battle/timers";
import { combineSettlementCallbacks } from '../../../battle/settlementReceipt';

export const handleKeldSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 自身受到的非真實傷害額外減少 60%
      if (extraData?.isIncoming && extraData?.damageCategory !== "true" && !extraData.pure) {
        (extraData.beforeFinalDamage ||= []).push(() => {
          const before = Math.max(0, extraData.base * (1 + extraData.increasePercent) * Math.max(0, 1 - extraData.decreasePercent) * extraData.multiplier - (extraData.flatReduction || 0));
          const rate = multiplyDamageReduction(extraData, 0.4);
          if (!rate) return; // 被無視減傷時不誤觸發「以此法減少」的副作用。
          const after = Math.max(0, extraData.base * (1 + extraData.increasePercent) * Math.max(0, 1 - extraData.decreasePercent) * extraData.multiplier - (extraData.flatReduction || 0));
          const reduced = Math.max(0, Math.floor(before) - Math.floor(after));
          if (reduced <= 0) return;
          extraData.afterDamage = combineSettlementCallbacks(extraData.afterDamage, () => {
            if (reduced <= 200) setPlayerState('keldBacklashCount', (getPlayerState('keldBacklashCount') || 0) + 1);
            if (reduced >= 200 && (getPlayerState('keldSoulStacks') || 0) > 0) {
              const result = ctx.applyStatusWithImmunityCheck(oppSide, '凍傷', 3);
              if (!result.success) {
                ctx.clearTurnEffectsOf(oppSide);
                ctx.setNextTurns(oppSide, 'lockSwitchTurns', 2);
              }
            }
          });
        });
      }
      break;

    case EffectTiming.AFTER_DAMAGE:
      // 自身受到真實傷害時獲得 1 道寂殺之魄
      if (extraData?.isIncoming && extraData?.damageType === "true") {
        const souls = Math.min(3, (getPlayerState("keldSoulStacks") || 0) + 1);
        setPlayerState("keldSoulStacks", souls);
        ctx.setMark({
          id: "keld_soul",
          displayChar: "魄",
          count: souls,
          name: "寂殺之魄",
          description: "異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留。",
          source: "冰魄·柯爾德 / 冰"
        });
        addLog(`❄️ 【冰】：魂魄凝聚，寂殺之魄提升至 ${souls} 層！`, "effect");
      }
      break;

    case EffectTiming.BATTLE_PHASE_END:
      if (getPlayerState("keldBacklashCount")) {
        const backlashDmg = Math.floor(self.maxHp * 0.25) * getPlayerState('keldBacklashCount');
        applyTrueDamage(actor, backlashDmg, "冰魄反噬");
        setPlayerState("keldBacklashCount", 0);
      }
      break;

    case EffectTiming.FATAL_RESIST:
      if (extraData?.damageType === "true") {
        self.currentHp = 1;
        addLog(`❄️ 【冰】：受到致死真實傷害，強制存活恢復1點體力！`, "effect");
        return true;
      }
      return false;
  }

  return false;
};

export const KELD_SKILLS: Record<string, BattleSkillHandler> = {
  "傲視千川": (ctx) => {
    const { actor, addLog, applyStatChange } = ctx;
    addLog(`❄️ 【傲視千川】：寒氣凌人，凍結虛空！`, "effect");
    applyStatChange(actor, { atk: 1, def: 1, spatk: 1, spdef: 1, speed: 1, accuracy: 1 });
    
    // Migrate to Timer system
    const oppSide = actor === "p1" ? "p2" : "p1";
    ctx.addTimerTo(oppSide, turnEffect("keld_lock_switch", "傲視千川-封換", 2, {
      displayChar: "封",
      description: "下 2 回合無法主動切換精靈",
      payload: { lockSwitch: true }
    }), ctx.goesFirst === false);
    addLog(`❄️ 【傲視千川】：對手下 2 回合無法主動切換精靈！`, "effect");
  },
  "凝寒止喧": (ctx) => {
    const { addLog, clearTurnEffectsOf } = ctx;
    addLog(`❄️ 【凝寒止喧】：萬物肅靜，冰封一切！`, "effect");
    clearTurnEffectsOf(ctx.targetSide);
  }
};

export { KeldDeconstructedProfile } from "../../../data/elfProfiles/keldRegistry";
