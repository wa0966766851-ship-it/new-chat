import { BattleEventContext, EffectTiming } from "../../types";
import { isAbnormal } from "../../../utils/battleHelpers";

/**
 * 帝皇之盾 (Imperial Shield) - C Rank
 * 魂印：盾
 */
export const handleImperialShieldSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const self = ctx.self;
  const opp = ctx.target;

  switch (event) {
    case EffectTiming.ON_ENTRANCE:
      // 登場時獲得自身最大體力1/3的護盾
      const shieldVal = Math.floor(self.maxHp / 3);
      ctx.setPlayerState("shield", (ctx.getPlayerState("shield") || 0) + shieldVal);
      ctx.addLog(`🎡【盾】：皇權之威，獲得了 ${shieldVal} 點守護護盾！`, "heal");
      break;

    case EffectTiming.BEFORE_SKILL:
      // 回合開始時自身擁有護盾則免疫所有異常狀態並令對手全屬性-1
      const currentShield = ctx.getPlayerState("shield") || 0;
      if (currentShield > 0) {
        ctx.addLog("🎡【盾】：聖盾守護，免疫能力下降與異常，並削弱對手！", "effect");
        ctx.applyStatChange(ctx.targetSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
        
        // 免疫異常：將狀態重置
        if (isAbnormal(self)) {
          self.battleStatus = "normal";
          self.battleStatuses = {};
          self.effects = [];
          ctx.addLog("🎡【盾】：聖盾光輝驅散了異常狀態！", "status");
        }
      }
      break;

    case EffectTiming.DEATH_NODE_1:
      // 自身被擊敗時將剩餘護盾值轉化為守護印記附加給下一隻登場的己方精靈
      const remainingShield = ctx.getPlayerState("shield") || 0;
      if (remainingShield > 0) {
        ctx.setPlayerState("nextElfGuardMark", {
          value: remainingShield,
          reduction: 0.25,
          turns: 4
        });
        ctx.addLog(`🎡【盾】：餘輝守護，將 ${remainingShield} 點護盾能量轉化為守護印記！`, "effect");
      }
      // 消除對手能力提升狀態並令對手 2 回合內進入疲憊
      opp.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      ctx.applyStatusWithImmunityCheck(ctx.targetSide, "疲憊", 2);
      ctx.addLog("🎡【盾】：聖盾崩裂，消除了對手能力提升並封鎖其行動！", "effect");
      break;
  }
};

/**
 * 天蓬元帥八戒 (Marshal Bajie) - C Rank
 * 魂印：淨
 */
export const handleBajieSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const self = ctx.self;
  const opp = ctx.target;

  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 自身受到攻擊時消除對手能力提升狀態
      if (extraData?.isIncoming) {
        opp.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
        ctx.addLog("🎡【淨】：萬法皆空，消除對手能力提升！", "effect");
      }
      // 自身體力高於1/2時受到攻擊傷害減少25%，低於1/2時減少50%
      if (extraData?.isIncoming) {
        const ratio = self.currentHp / self.maxHp;
        const reduction = ratio > 0.5 ? 0.25 : 0.5;
        if (extraData.damage) {
          extraData.damage *= (1 - reduction);
          ctx.addLog(`🎡【淨】：金剛不壞！受到的傷害減少 ${reduction * 100}%！`, "effect");
        }
      }
      break;

    case EffectTiming.AFTER_ACTION:
      // 回合結束時自身體力低於1/4則恢復自身最大體力1/3並令對手全屬性-1
      if (self.currentHp / self.maxHp < 0.25) {
        const healVal = Math.floor(self.maxHp / 3);
        self.currentHp = Math.min(self.maxHp, self.currentHp + healVal);
        ctx.applyStatChange(ctx.targetSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
        ctx.addLog(`🎡【淨】：八戒食糧，恢復 ${healVal} 點體力並令對手全屬性下降！`, "heal");
      }
      break;

    case EffectTiming.DEATH_NODE_1:
      ctx.addLog("🎡【淨】：淨壇使者功德圓滿，回歸天庭！", "defeat");
      break;
  }
};

/**
 * 六界神王 (Liujie God King) - C Rank
 * 魂印：界
 */
export const handleLiujieSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const self = ctx.self;
  const opp = ctx.target;

  switch (event) {
    case EffectTiming.DEATH_NODE_1:
      ctx.addLog("🎡【界】：神王隕落，萬界同悲！", "defeat");
      opp.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      ctx.clearTurnEffectsOf(ctx.targetSide);
      
      // 令對手受到等量致命傷真實傷害
      ctx.applyTrueDamage(ctx.targetSide, 300, "界·同歸", ctx.activeP1, ctx.activeP2);
      break;
  }
};

export const LIUJIE_SKILLS = {
  "界・裁決之劍": (ctx: BattleEventContext) => {
    ctx.addLog("【界・裁決之劍】：諸神的裁決！傷害 +150 點！", "effect");
    ctx.applyFixedDamage(ctx.targetSide, 150);
  }
};

export const IMPERIAL_SHIELD_SKILLS = {
  "盾碎同歸": (ctx: BattleEventContext) => {
    const { self, addLog, applyStatChange } = ctx;
    const shield = ctx.getPlayerState("shield") || 0;
    addLog(`【盾碎同歸】：引爆護盾能量 (${shield})！`, "effect");
    if (shield > 0) {
      const drainCount = Math.floor(shield / 100);
      ctx.addLog(`將扣除對手隨機技能 ${drainCount} 點 PP！`, "effect");
      ctx.setPlayerState("shield", 0);
    } else {
      applyStatChange(ctx.actor, { atk: 2, def: 2, spatk: 2, spdef: 2, speed: 2, accuracy: 2 });
    }
  }
};

export const BAJIE_SKILLS = {
  "天河衝擊": (ctx: BattleEventContext) => {
    ctx.addLog("【天河衝擊】：震撼乾坤的一擊！", "effect");
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "禁療", 2);
  }
};
