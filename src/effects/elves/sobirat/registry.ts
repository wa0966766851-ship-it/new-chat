import { BattleEventContext, BattleSkillHandler, EffectTiming } from '../../types';

/**
 * 悲歌·索比拉特 (Sad Song Sobirat) - C Rank
 * 魂印：黯
 */
export const handleSobiratSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, getOpponentState, setOpponentState, addLog, applyHeal, applyStatusWithImmunityCheck, applyTrueDamage, clearTurnEffectsOf } = ctx;
  const isSelfActor = actor === (self === ctx.activeP1 ? "p1" : "p2");

  switch (event) {
    case EffectTiming.ON_ENTRANCE: {
      // Initialize states safely
      setPlayerState("sobiratScarBonus", getPlayerState("sobiratScarBonus") || 0);
      break;
    }

    case EffectTiming.ROUND_START: {
      break;
    }

    case EffectTiming.BEFORE_ACTION: {
      // 2回合內100%閃避對手攻擊技能
      const evasionTurns = getPlayerState("sobiratEvasionTurns") || 0;
      if (evasionTurns > 0) {
        setPlayerState("evasionActive", true);
      } else {
        setPlayerState("evasionActive", false);
      }
      break;
    }

    case EffectTiming.MODIFY_PRIORITY: {
      // 下 2 回合所有技能先制+2
      if (extraData?.priorityComp && getPlayerState("sobiratPriorityBoostTurns") > 0) {
        extraData.priorityComp.bonus += 2;
        addLog("🎡【陰世遊靈】：幽靈疾速，技能先制+2！", "effect");
      }
      break;
    }

    case EffectTiming.BEFORE_STATUS_APPLY: {
      // 幽冥噬魂: 5 回合免疫並反彈所有異常
      if (getPlayerState("sobiratStatusReflectTurns") > 0 && extraData) {
        addLog("✨【幽冥噬魂】：幽影彈控，反彈異常狀態！", "effect");
        applyStatusWithImmunityCheck(ctx.targetSide, extraData.status, extraData.duration);
        extraData.prevented = true;
        extraData.prevent = true;
      }
      break;
    }

    case EffectTiming.ON_DAMAGED: {
      // 自身每次受到技能傷害時令對手進入害怕狀態，
      // 未觸發則當回合結束時吸取對手所有技能1點PP值。
      const dmg = extraData?.amount || 0;
      if (dmg > 0) {
        addLog("🎡【黯】：受擊觸發，使對手面臨恐懼！", "effect");
        const success = applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
        if (!success.success) {
          setPlayerState("sobiratDrainPP", true);
        }
        setPlayerState("damagedThisTurn", true);
      }
      break;
    }

    case EffectTiming.AFTER_ACTION: {
      // 陰世遊靈：4回合內每回合使用技能後恢復自身最大體力1/2
      if (isSelfActor && getPlayerState("sobiratHealTurns") > 0 && self.currentHp > 0) {
        const healAmt = Math.floor(self.maxHp / 2);
        applyHeal(actor, healAmt);
        addLog(`🎡【陰世遊靈】：使用技能後恢復最大體力 1/2 (${healAmt}點)！`, "heal");
      }
      if (isSelfActor) {
        // 下3回合自身攻擊技能附加250真實傷害
        if (getPlayerState("sobiratTrueDamageTurns") > 0 && ctx.skill && ctx.skill.category !== "屬性") {
          addLog("🎡【陰世遊靈】：攻擊附加幽冥真傷 250 點！", "effect");
          applyTrueDamage(ctx.targetSide, 250, "陰世遊靈");
        }

        // 3 回合內自身使用技能則 100% 令對手害怕
        if (getPlayerState("sobiratFearSkillTurns") > 0 && ctx.skill) {
          addLog("🎡【幽冥噬魂】：自身使用技能，威懾對手！", "effect");
          applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
        }

        // 3 回合內對手使用攻擊技能時 100% 令對手束縛
        // Note: checking if opponent used an attack skill this turn.
        // We can check if getOpponentState("usedAttackSkillThisTurn") is true, or we check in a more direct way:
        // Since we are in AFTER_ACTION of the current actor (isSelfActor is true), 
        // the opponent's action is handled when they are the actor.
        // So we can handle the opponent's side of AFTER_ACTION!
      } else {
        // Here actor is the opponent
        // 3 回合內對手使用攻擊技能時 100% 令對手束縛
        if (getPlayerState("sobiratBindTurns") > 0 && ctx.skill && ctx.skill.category !== "屬性") {
          addLog("🎡【幽冥噬魂】：對手使用攻擊技能，遭受陰影枷鎖束縛！", "effect");
          applyStatusWithImmunityCheck(ctx.targetSide, "束縛", 1);
        }

        // 3 回合內自身攻擊技能無效時消除對手回合類效果
        // Here opponent is the actor, wait: "自身攻擊技能無效時消除對手回合類效果"
        // This is when SOBIRAT (the self) used an attack skill and it failed. So it is handled when isSelfActor is true!
      }

      if (isSelfActor) {
        // 3 回合內自身攻擊技能無效時消除對手回合類效果
        // How do we detect "攻擊技能無效"?
        // In the simulator, if a skill's category is not "屬性", and no damage is dealt, it is considered invalid/evaded/blocked.
        // We can check if extraData?.damageComp?.isIncoming is false and we dealt 0 damage.
        // To be extremely robust, we can also check if the opponent has evasionActive or immuneAll active!
        if (getPlayerState("sobiratDispelOnFailedTurns") > 0 && ctx.skill && ctx.skill.category !== "屬性") {
          const oppState = getOpponentState("evasionActive") || getOpponentState("immuneAll");
          if (oppState) {
            addLog("🎡【幽冥噬魂】：自身攻擊無效，消除對手回合類效果！", "effect");
            clearTurnEffectsOf(ctx.targetSide);
          }
        }
      }
      break;
    }

    case EffectTiming.ROUND_END: {
      if (getPlayerState("sobiratHealTurns") > 0) setPlayerState("sobiratHealTurns", getPlayerState("sobiratHealTurns") - 1);
      // 1. "未觸發(害怕)則當回合結束時吸取對手所有技能1點PP值"
      if (getPlayerState("sobiratDrainPP")) {
        addLog("🎡【黯】：幽冥迴響，吸取對手所有技能 1 點 PP！", "effect");
        const oppElf = ctx.target;
        if (oppElf && oppElf.skills) {
          oppElf.skills.forEach(s => {
            if (s.pp !== undefined) s.pp = Math.max(0, s.pp - 1);
          });
        }
        setPlayerState("sobiratDrainPP", false);
      }

      // 2. "回合結束若自身未受到技能傷害，則下次被擊敗時黯痕回合數+1"
      if (!getPlayerState("damagedThisTurn")) {
        const current = getPlayerState("sobiratScarBonus") || 0;
        setPlayerState("sobiratScarBonus", current + 1);
        addLog("🎡【黯】：靜謐之夜，下次被擊敗時附加的【黯痕】回合數提升 1 回合！", "effect");
      }
      setPlayerState("damagedThisTurn", false); // reset
      break;
    }

    case EffectTiming.FATAL_RESIST: {
      if (getPlayerState("sobiratSurviveTurns") > 0) {
        self.currentHp = 1;
        addLog("✨【不死意志】：體力歸零！觸發免死金身，保留 1 點體力！", "effect");
        setPlayerState("sobiratSurviveTurns", 0); // Consume the survivor block
        return true;
      }
      break;
    }

    case EffectTiming.DEATH_NODE_1: {
      // 自身被擊敗時：消除對手回合類效果與能力提升狀態並附加黯痕印記
      addLog("🎡【黯】：靈魂寂滅，釋放最後的恐懼！", "defeat");
      
      const oppElf = ctx.target;
      if (oppElf) {
        oppElf.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      }
      clearTurnEffectsOf(ctx.targetSide);

      const baseDuration = 3;
      const bonus = getPlayerState("sobiratScarBonus") || 0;
      const duration = baseDuration + bonus;
      // 最終規格 A1-1：觸發後清空待觸發層數，避免重複累加到下一次
      setPlayerState("sobiratScarBonus", 0);

      setOpponentState("DarkScarTurns", duration);
      applyStatusWithImmunityCheck(ctx.targetSide, "黯痕", duration);
      addLog(`🎡【黯痕】：對手被附加了 ${duration} 回合的【黯痕】印記！(期間受擊傷害翻倍，造成的百分比/固傷減半，技能傷害不超1點)`, "status");

      // Interceptor: 悲歌護盾
      addLog("🎡【悲歌護盾】：自身被擊敗，為下一隻登場精靈附加 400 點護罩與 4 回合異常免疫！", "effect");
      setPlayerState("nextElfShield", 400);
      setPlayerState("nextElfImmunityTurns", 4);
      break;
    }
  }

  return false;
};

export const SOBIRAT_SKILLS: Record<string, BattleSkillHandler> = {
  "黯索魂噬": (ctx) => {
    const { self, target, addLog, clearTurnEffectsOf, applyStatusWithImmunityCheck, applyStatChange } = ctx;
    addLog("【黯索魂噬】：消強消回合，幽暗黑影索魂噬魄！", "effect");
    
    // 消回合 (B / Inherent)
    const cleared = clearTurnEffectsOf(ctx.targetSide);
    
    // 消強 (B / Inherent)
    let hasBuff = false;
    for (const key in target.statStages) {
      if ((target.statStages[key as keyof typeof target.statStages] || 0) > 0) {
        hasBuff = true;
        target.statStages[key as keyof typeof target.statStages] = 0;
      }
    }

    // C / Additional
    if (cleared) {
      const res = applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
      if (res.success) {
        addLog("【黯索魂噬】：消除回合效果成功！令對手進入害怕 1 回合！", "status");
      }
    }

    if (hasBuff) {
      applyStatChange(ctx.targetSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
      addLog("【黯索魂噬】：消強成功！令對手全屬性 -1！", "effect");
    }
  },

  "陰世遊靈": (ctx) => {
    const { self, actor, setPlayerState, getPlayerState, addLog, applyStatChange } = ctx;
    addLog("【陰世遊靈】：陰冷迷霧，遊魂出世！", "effect");

    // 全屬性+1
    applyStatChange(actor, { atk: 1, def: 1, spatk: 1, spdef: 1, speed: 1, accuracy: 1 });

    // 4 回合內每回合恢復自身最大體力 1/2 (綁己方)
    setPlayerState("sobiratHealTurns", 4);
    addLog("【陰世遊靈】：附加 4 回合每回合恢復最大體力 1/2 的幽靈復甦效果！", "effect");

    // 下 3 回合自身攻擊技能附加 250 真實傷害 (綁己方)
    setPlayerState("sobiratTrueDamageTurns", 3);
    addLog("【陰世遊靈】：附加 3 回合攻擊技能附加 250 真實傷害的效果！", "effect");

    // 下 2 回合所有技能先制+2 (綁己方)
    setPlayerState("sobiratPriorityBoostTurns", 2);
    addLog("【陰世遊靈】：附加 2 回合所有技能先制+2的效果！", "effect");
  },

  "影之牢籠": (ctx) => {
    const { self, addLog, applyFixedDamage, setPlayerState, getPlayerState } = ctx;
    addLog("【影之牢籠】：影之枷鎖，將自身生命與陰影同化！自身體力降為 1 點！", "effect");
    
    // 消耗自身全部體力，自身體力降為 1 點
    self.currentHp = 1;

    // 令下次被擊敗時黯痕回合數+1
    const currentBonus = getPlayerState("sobiratScarBonus") || 0;
    setPlayerState("sobiratScarBonus", currentBonus + 1);
    addLog("【影之牢籠】：下次被擊敗時【黯痕】回合數提升 1 回合！", "effect");

    // 附加對手 300 固定傷害
    applyFixedDamage(ctx.targetSide, 300);
  },

  "幽冥噬魂": (ctx) => {
    const { setPlayerState, addLog } = ctx;
    addLog("【幽冥噬魂】：幽冥之力爆發，靈魂震撼！", "effect");

    // 5 回合免疫並反彈所有異常
    setPlayerState("sobiratStatusReflectTurns", 5);
    addLog("【幽冥噬魂】：附加 5 回合異常免疫且反彈效果！", "effect");

    // 3 回合內自身使用技能則 100% 令對手害怕
    setPlayerState("sobiratFearSkillTurns", 3);
    addLog("【幽冥噬魂】：附加 3 回合自身使用技能時令對手害怕效果！", "effect");

    // 3 回合內對手使用攻擊技能時 100% 令對手束縛
    setPlayerState("sobiratBindTurns", 3);
    addLog("【幽冥噬魂】：附加 3 回合對手使用攻擊技能時令對手束縛效果！", "effect");

    // 3 回合內自身攻擊技能無效時消除對手回合類效果
    setPlayerState("sobiratDispelOnFailedTurns", 3);
    addLog("【幽冥噬魂】：附加 3 回合自身攻擊技能無效時消除對手回合類效果！", "effect");
  },

  "黯·萬魂歸寂": (ctx) => {
    const { clearTurnEffectsOf, setPlayerState, addLog } = ctx;
    addLog("【黯·萬魂歸寂】：萬魂哀鳴，冥河封鎖！", "effect");

    // 消除對手回合類效果 (B / Inherent)
    const cleared = clearTurnEffectsOf(ctx.targetSide);

    // [消除成功] -> 對手 2 回合屬性技能無效 (C / Additional)
    if (cleared) {
      ctx.setOpponentState("sealPropertyTurns", 3); // 3 turns (ticks down on round end, so 2 active combat turns)
      ctx.setOpponentState("utilitySkillInvalidTurns", 2);
      ctx.setOpponentState("utilitySkillInvalidReason", "冥河封鎖");
      addLog("【黯·萬魂歸寂】：消除回合效果成功！對手 2 回合內屬性技能失效！", "status");
    }

    // 自身獲得 3 回合免死 (不滅意志)
    setPlayerState("sobiratSurviveTurns", 3);
    addLog("【黯·萬魂歸寂】：自身獲得 3 回合不滅意志（若體力歸零則強制存活保留 1 點體力）！", "status");
  }
};
