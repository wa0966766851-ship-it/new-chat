import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";
import { isStatusActive } from "../../../utils/statusManager";
import { bypassesAttackDefense } from '../../../battle/attackDefense';

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
      if ((selfConfused || oppConfused) && extraData?.isIncoming && !bypassesAttackDefense(extraData, 'block')) {
        addLog(`🔔 【亂】：冥界共鳴觸發！抵擋了攻擊傷害！`, "effect");
        if (extraData) extraData.multiplier = 0;
      }
      break;
  }

  return false;
};

// 已完整遷移技能由Kit唯一執行；保留魂印註冊，不再保留技能簡化分支。
export const BAPHOMET_SKILLS: Record<string, BattleSkillHandler> = {};
