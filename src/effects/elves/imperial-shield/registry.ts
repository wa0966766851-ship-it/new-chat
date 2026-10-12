import { BattleEventContext, BattleSkillHandler, EffectTiming } from '../../types';

/**
 * 帝皇之盾 (Emperor's Shield) - ID 5002
 * 魂印：盾
 */
export const handleImperialShieldSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const {
    self,
    actor,
    setPlayerState,
    getPlayerState,
    getOpponentState,
    setOpponentState,
    addLog,
    applyHeal,
    applyShield,
    applyStatChange,
    updateElf,
  } = ctx;

  const mySide = actor;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.ON_ENTRANCE: {
      if (!getPlayerState("empShieldInited")) {
        // 1. 登場時獲得自身最大體力1/3護盾
        const shieldAmount = Math.floor(self.maxHp / 3);
        updateElf(mySide, { shield: shieldAmount });
        addLog(`🎡【盾】：登場獲得自身最大體力 1/3 護盾 (${shieldAmount} 點)！`, "effect");

        setPlayerState("empShieldInited", true);
      }
      break;
    }

    case EffectTiming.ON_SWITCH_OUT: {
      setPlayerState("empShieldInited", false);
      break;
    }

    case EffectTiming.ROUND_START: {
      // 1. [有護盾] 回合開始令對手全屬性-1
      if (self.shield && self.shield > 0) {
        applyStatChange(oppSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
        addLog("🎡【盾】：自身擁有護盾，回合開始令對手全屬性 -1！", "effect");
      }

      break;
    }

    case EffectTiming.BEFORE_STATUS_APPLY: {
      if (extraData) {
        // 1. [有護盾] 回合開始免疫所有異常
        if (self.shield && self.shield > 0) {
          extraData.prevented = true;
          extraData.prevent = true;
          addLog("🎡【盾】：自身擁有護盾，免疫異常狀態！", "effect");
          return;
        }

        // 2. 帝永壁令免控次數
        const immuneCount = getPlayerState("emperorStatusImmuneCount") || 0;
        if (immuneCount > 0) {
          extraData.prevented = true;
          extraData.prevent = true;
          setPlayerState("emperorStatusImmuneCount", immuneCount - 1);
          addLog(`🎡【帝永壁令】：免控次數消耗，免疫了異常狀態！(剩餘 ${immuneCount - 1} 次)`, "effect");
        }
      }
      break;
    }

    case EffectTiming.BEFORE_DAMAGE: {
      // 2. 隨時拍下當前護盾的快照，確保陣亡時能正確捕捉剩餘護盾值
      setPlayerState("empShieldSnapshot", self.shield || 0);
      break;
    }

    case EffectTiming.BEFORE_ACTION: {
      setPlayerState("empShieldSnapshot", self.shield || 0);
      break;
    }

    case EffectTiming.MODIFY_PRIORITY: {
      if (extraData?.priorityComp) {
        // 1. 帝永壁令先制+2
        if (getPlayerState("emperorPriorityBoostTurns") > 0) {
          extraData.priorityComp.bonus += 2;
          addLog("🎡【帝永壁令】：先制提升，所有技能先制 +2！", "effect");
        }

        // 2. 盾碎同歸未消耗護盾下回合先制+3
        if (getPlayerState("emperorNextTurnPriorityBoost3")) {
          extraData.priorityComp.bonus += 3;
          addLog("🎡【盾碎同歸】：下回合先制爆發，所有技能先制 +3！", "effect");
          setPlayerState("emperorNextTurnPriorityBoost3", false);
        }
      }
      break;
    }

    case EffectTiming.AFTER_ACTION: {
      // 帝永壁令：4回合內每回合使用技能後恢復自身最大體力1/3，並將恢復量的50%轉化為護盾
      if ((getPlayerState("emperorWallTurns") || 0) > 0 && self.currentHp > 0) {
        const healAmount = Math.floor(self.maxHp / 3);
        const shieldAmount = Math.floor(healAmount * 0.5);
        applyHeal(mySide, healAmount);
        applyShield(mySide, shieldAmount);
        addLog(`🎡【帝永壁令】：使用技能後恢復 ${healAmount} 點體力，並將其中 50% 轉化為 ${shieldAmount} 點護盾！`, "heal");
      }
      // 清理吸血比例
      setPlayerState("vampireRatio", 0);
      break;
    }

    case EffectTiming.DEATH_NODE_1: {
      // 1. 被擊敗時剩餘護盾→守護印記給下一隻己方
      const shieldToTransfer = getPlayerState("empShieldSnapshot") || self.shield || 0;
      if (shieldToTransfer > 0) {
        setPlayerState("nextElfShield", shieldToTransfer);
        setPlayerState("nextElfGuardianMark", true);
        addLog(`🎡【盾】：陣亡轉移！將剩餘護盾值 ${shieldToTransfer} 點與守護印記傳遞給下一隻登場的己方精靈！`, "effect");
      }

      // 2. 被擊敗時消除對手能力提升
      const oppElf = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
      if (oppElf && oppElf.statStages) {
        let cleared = false;
        for (const key in oppElf.statStages) {
          if ((oppElf.statStages[key as keyof typeof oppElf.statStages] || 0) > 0) {
            oppElf.statStages[key as keyof typeof oppElf.statStages] = 0;
            cleared = true;
          }
        }
        if (cleared) {
          addLog("🎡【盾】：自身被擊敗，消除對手所有的能力提升狀態！", "effect");
          // 3. 消除成功則令對手2回合內攻擊技能PP消耗提升3倍
          setOpponentState("attackPpMultiplierTurns", 2);
          setOpponentState("attackPpMultiplierValue", 3);
          addLog("🎡【盾】：消除成功，令對手 2 回合內攻擊技能 PP 消耗提升 3 倍！", "effect");
        }
      }
      break;
    }

    case EffectTiming.ROUND_END: {
      // 遞減己方回合效果
      const wallTurnsLeft = getPlayerState("emperorWallTurns") || 0;
      if (wallTurnsLeft > 0) setPlayerState("emperorWallTurns", wallTurnsLeft - 1);
      const prioTurns = getPlayerState("emperorPriorityBoostTurns") || 0;
      if (prioTurns > 0) {
        setPlayerState("emperorPriorityBoostTurns", prioTurns - 1);
      }
      break;
    }
  }
};

export const IMPERIAL_SHIELD_SKILLS: Record<string, BattleSkillHandler> = {
  "帝永壁令": (ctx) => {
    const { self, actor, setPlayerState, addLog, applyStatChange } = ctx;
    addLog("【帝永壁令】：帝心不渝，永壁不倒！", "effect");

    // 1. 全屬性+1 [若自身處於能力提升狀態，強化效果翻倍，即全屬性+2]
    let hasBoost = false;
    if (self.statStages) {
      for (const key in self.statStages) {
        if ((self.statStages[key as keyof typeof self.statStages] || 0) > 0) {
          hasBoost = true;
          break;
        }
      }
    }
    const boostAmt = hasBoost ? 2 : 1;
    applyStatChange(actor, { atk: boostAmt, def: boostAmt, spatk: boostAmt, spdef: boostAmt, speed: boostAmt, accuracy: boostAmt });
    addLog(`【帝永壁令】：自身全屬性提升 ${boostAmt} 級！`, "effect");

    // 2. 4回合每回合恢復1/3最大體力，恢復量的50%轉護盾
    setPlayerState("emperorWallTurns", 4);
    addLog("【帝永壁令】：獲得 4 回合「帝壁壁令」，每回合恢復最大體力 1/3，並將恢復量的 50% 轉化為護盾！", "effect");

    // 3. 免疫下2次異常
    setPlayerState("emperorStatusImmuneCount", 2);
    addLog("【帝永壁令】：附加 2 次異常狀態免疫效果！", "effect");

    // 4. 下2回合所有技能先制+2
    setPlayerState("emperorPriorityBoostTurns", 2);
    addLog("【帝永壁令】：附加 2 回合所有技能先制 +2 效果！", "effect");
  },

  "盾碎同歸": (ctx) => {
    const { self, target, actor, addLog, setPlayerState, applyStatChange } = ctx;
    const currentShield = self.shield || 0;

    // 1. 消耗自身全部護盾值
    self.shield = 0;
    ctx.updateElf(actor, { shield: 0 });
    addLog(`【盾碎同歸】：護盾粉碎！消耗了全部 ${currentShield} 點護盾值！`, "effect");

    if (currentShield > 0) {
      // 2. 每消耗100護盾令對手隨機1技能PP歸零
      const numSkillsToDrain = Math.floor(currentShield / 100);
      if (numSkillsToDrain > 0 && target.skills && target.skills.length > 0) {
        const availableSkills = [...target.skills].filter(s => s.pp !== undefined && s.pp > 0);
        let drainedCount = 0;
        for (let i = 0; i < numSkillsToDrain; i++) {
          if (availableSkills.length === 0) break;
          const randIdx = Math.floor(ctx.rng ? ctx.rng() * availableSkills.length : Math.random() * availableSkills.length);
          const skillToDrain = availableSkills[randIdx];

          const origSkill = target.skills.find(s => s.name === skillToDrain.name);
          if (origSkill) {
            origSkill.pp = 0;
            drainedCount++;
          }
          availableSkills.splice(randIdx, 1);
        }
        if (drainedCount > 0) {
          addLog(`【盾碎同歸】：每消耗 100 護盾觸發，令對手隨機 ${drainedCount} 個技能 PP 歸零！`, "effect");
        }
      }
    } else {
      // 3. [護盾消耗為0] 自身全屬性+2且下回合先制+3
      applyStatChange(actor, { atk: 2, def: 2, spatk: 2, spdef: 2, speed: 2, accuracy: 2 });
      setPlayerState("emperorNextTurnPriorityBoost3", true);
      addLog("【盾碎同歸】：未消耗任何護盾值！自身全屬性 +2 且下回合先制 +3！", "effect");
    }
  }
};
