import { prdChance } from "../utils/prd";
import { BattleEventContext, EffectTiming } from "./types";

/**
 * 雷伊 (Ray) - B Rank
 * 魂印：雷
 */
export const handleRaySoulMark = (ctx: BattleEventContext, event: EffectTiming) => {
  if (event === EffectTiming.AFTER_ACTION) {
    // 每回合結束時有 100% 機率使對手麻痺
    ctx.addLog("⚡【雷】：雷神降世，萬雷奔騰！");
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
  }
};

/**
 * 蓋亞 (Gaia) - B Rank
 * 魂印：戰
 */
export const handleGaiaSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const currentHp = ctx.getPlayerState("currentHp");
  const maxHp = ctx.getPlayerState("maxHp");
  if (event === EffectTiming.BEFORE_DAMAGE) {
    // 當自身體力低於 50% 時，攻擊力提升 30%
    if (!extraData?.isIncoming && (currentHp / maxHp < 0.5)) {
      ctx.addLog("💥【戰】：戰神之怒，力量爆發！");
      extraData.increasePercent += 0.3;
    }
  }
};

/**
 * 卡修斯 (Cassius) - B Rank
 * 魂印：地
 */
export const handleCassiusSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  switch (event) {
    case EffectTiming.BEFORE_ACTION:
      // 每回合有 50% 機率免疫對手本回合的攻擊傷害
      if (prdChance("warriorRegistry:L39", 0.5)) {
        ctx.addLog("🌍【地】：大地庇護，免疫傷害！");
        ctx.setPlayerState("evasionActive", true);
      }
      break;
    case EffectTiming.BEFORE_SKILL:
      // 先出手則當回合對手技能無法造成攻擊傷害且附加效果失效，後出手則附加自身300點護盾
      if (extraData?.isFaster) {
        ctx.addLog("🌍【地】：極速壓制，封鎖對手攻勢！");
        ctx.setOpponentState("attackSkillInvalidTurns", 1);
        ctx.setOpponentState("attackSkillInvalidReason", "【地之極速壓制】");
      } else {
        ctx.addLog("🌍【地】：厚土屏障，獲得 300 點護盾！");
        ctx.setPlayerState("shield", (s: number) => (s || 0) + 300);
      }
      break;
  }
};

/**
 * 布萊克 (Black) - B Rank
 * 魂印：魔
 */
export const handleBlackSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 造成的攻擊傷害提升 50%
      if (!extraData?.isIncoming) {
        extraData.multiplier *= 1.5;
        ctx.addLog("🌙【魔】：黑夜的主宰，傷害提升 50%！", "effect");
      }
      break;
    case EffectTiming.FATAL_RESIST:
      // 本場戰鬥僅限一次，死亡時保留1點體力並消除對手回合類效果，同時100%令對手害怕
      if (!ctx.getPlayerState("blackFatalResist")) {
        ctx.addLog("🌙【魔】：夜魔涅槃，幽冥重生！");
        ctx.setPlayerState("blackFatalResist", true);
        ctx.self.currentHp = 1;
        ctx.setOpponentState("turnEffects", []);
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
        if (extraData) extraData.cancelFatal = true;
        return true;
      }
      return false;
  }
};

export const RAY_SKILLS = {
  "雷神天明閃": (ctx: BattleEventContext) => {
    if (prdChance("warriorRegistry:L88", 0.1)) {
      ctx.addLog("⚡【雷神天明閃】：觸發 4 倍傷害！");
      // 修改傷害倍率
    }
  }
};

export const GAIA_SKILLS = {
  "石破天驚": (ctx: BattleEventContext) => {
    ctx.addLog("💥【石破天驚】：消除對手護盾！");
    ctx.setOpponentState("shield", 0);
  }
};

export const CASSIUS_SKILLS = {
  "乾坤反轉": (ctx: BattleEventContext) => {
    ctx.addLog("🌍【乾坤反轉】：逆轉劣勢！");
    ctx.setPlayerState("statChanges", (stats: any) => {
      const newStats = { ...stats };
      for (const k in newStats) {
        if (newStats[k] < 0) newStats[k] = Math.abs(newStats[k]);
      }
      return newStats;
    });
  }
};

export const BLACK_SKILLS = {
  "雙重暗影": (ctx: BattleEventContext) => {
    ctx.addLog("🌙【雙重暗影】：幽冥之眼，看穿弱點！");
    ctx.applyStatChange(ctx.targetSide, { def: -1 });
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
  }
};
