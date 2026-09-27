import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";
import { isStatusActive } from "../utils/statusManager";

/**
 * 鎮魂·巴弗洛 (Baphomet)
 * 魂印：鎮、亂
 */
export const handleBaphometSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, setOpponentState, getOpponentState, addLog, applyPercentDamage } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.ROUND_END:
      // 每層【鎮】於回合結束消耗持有者 25% 最大體力
      const stacks = getOpponentState("baphometZhenStacks") || 0;
      if (stacks > 0) {
        addLog(`🔔 【鎮】：冥界鎮魂歌鳴響，消耗對手生命！`, "damage");
        applyPercentDamage(oppSide, 0.25 * stacks);
      }
      break;

    case EffectTiming.BEFORE_DAMAGE:
      // 當任一方處於混亂或窒息狀態時，自身抵擋所有攻擊技能傷害
      const selfConfused = isStatusActive(self, "confused") || getPlayerState("suffocating");
      const oppConfused = isStatusActive(ctx.target, "confused") || getOpponentState("suffocating");
      if ((selfConfused || oppConfused) && extraData?.isIncoming) {
        addLog(`🔔 【亂】：冥界共鳴觸發！抵擋了攻擊傷害！`, "effect");
        if (extraData) extraData.multiplier = 0;
      }
      break;
  }

  return false;
};

export const BAPHOMET_SKILLS: Record<string, BattleSkillHandler> = {
  "贖魂讚詩": (ctx) => {
    const { addLog, setOpponentState, applyStatusWithImmunityCheck } = ctx;
    addLog(`🎶 【贖魂讚詩】：消除對手回合類效果，並引發流血！`, "effect");
    setOpponentState("turnEffects", []);
    applyStatusWithImmunityCheck(ctx.targetSide, "流血", 2);
    setOpponentState("suffocatingTurns", 4);
  },
  "亂魂舞": (ctx) => {
    const { addLog, setPlayerState, applyStatusWithImmunityCheck, applyStatChange } = ctx;
    addLog(`💃 【亂魂舞】：狂亂舞動，陷入混亂以獲得更強大的力量！`, "effect");
    applyStatusWithImmunityCheck(ctx.actor, "混亂", 2);
    applyStatChange(ctx.actor, { atk: 2, speed: 2, accuracy: 2 });
  },
  "鎖魂曲": (ctx) => {
    const { addLog, clearTurnEffectsOf, applyStatChange } = ctx;
    addLog(`🎵 【鎖魂曲】：全場洗滌，粉碎一切屏障！`, "effect");
    clearTurnEffectsOf(ctx.actor);
    clearTurnEffectsOf(ctx.targetSide);
    applyStatChange(ctx.actor, { def: 0, spdef: 0 }); // 簡化：清除防禦
  }
};
