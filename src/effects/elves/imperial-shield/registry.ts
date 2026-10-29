import { BattleEventContext, BattleSkillHandler, EffectTiming } from '../../types';

/**
 * 帝皇之盾 (Emperor's Shield) - ID 5002
 * 魂印：盾
 */
// 5002 魂印「盾」已遷移為真 Kit（migratedImperialShieldSoulKit.ts；DSH 20261018）——舊 handler 整份移除。
// 守護印記層數曲線與期限仍由 effects/guardianMarkRegistry ＋ 本目錄 battleRule 的通用規格承擔。
export const handleImperialShieldSoulMark = (_ctx: any, _event: any, _extra?: any) => false;

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
