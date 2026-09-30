import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { turnEffect } from "../battle/timers";

export const handleKeldSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 自身受到的非真實傷害額外減少 60%
      if (extraData?.isIncoming && extraData?.damageCategory !== "true") {
        const reduced = Math.floor(extraData.base * 0.6);
        extraData.multiplier *= 0.4;
        
        if (reduced < 200) {
          // 戰鬥階段結束時自身受到 25% 的真實傷害 (這裡暫記標記)
          setPlayerState("keldBacklash", true);
        } else {
          // 若不低於 200 點且自身擁有寂殺之魄則令對手凍傷 3 回合
          const souls = getPlayerState("keldSoulStacks") || 0;
          if (souls > 0) {
            ctx.applyStatusWithImmunityCheck(oppSide, "凍傷", 3);
          }
        }
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

    case EffectTiming.ROUND_END:
      if (getPlayerState("keldBacklash")) {
        const backlashDmg = Math.floor(self.maxHp * 0.25);
        applyTrueDamage(actor, backlashDmg, "冰魄反噬");
        setPlayerState("keldBacklash", false);
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

export { KeldDeconstructedProfile } from "../data/elfProfiles/keldRegistry";
