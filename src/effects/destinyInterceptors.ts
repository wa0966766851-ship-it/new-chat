import { BattleEventContext, EffectTiming } from "./types";

/**
 * 命運之輪專屬攔截效果註冊表
 */
export const handleDestinyInterceptor = (ctx: BattleEventContext, event: EffectTiming) => {
  const rank = ctx.getPlayerState("destinyRank");
  const effect = ctx.getPlayerState("interceptorEffect");
  const maxHp = ctx.getPlayerState("maxHp");

  if (rank !== 'C' || !effect) return;

  if (event === EffectTiming.ON_ENTRANCE && effect.type === 'on_enter') {
    ctx.addLog(effect.triggerLog, "effect");
    
    switch (effect.id) {
      case 'block_attack':
        // 使對手當前精靈下 1 回合無法使用攻擊技能
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "封技", 1);
        break;
      case 'pp_chain':
        // 消耗對手所有技能 2 點 PP 上限與當前 PP
        ctx.setOpponentState("skills", (skills: any[]) => 
          skills.map((s: any) => ({ ...s, pp: Math.max(0, s.pp - 2) }))
        );
        break;
    }
  }

  if (event === EffectTiming.DEATH_NODE_1 && effect.type === 'on_death') {
    ctx.addLog(effect.triggerLog, "effect");

    switch (effect.id) {
      case 'dirge_shield':
        // 陣亡時，為我方下一隻出場精靈賦予等同於自身最大體力 80% 的精靈護罩，並免疫異常 2 回合
        const shieldVal = Math.floor(maxHp * 0.8);
        ctx.setPlayerState("nextElfShield", shieldVal);
        ctx.setPlayerState("nextElfImmunityTurns", 2);
        break;
      case 'soul_reaper':
        // 陣亡時，對擊殺自身的敵方精靈造成其最大體力 35% 的真實傷害，並使其先制-2 持續 3 回合
        const oppMaxHp = ctx.getOpponentState("maxHp");
        ctx.applyTrueDamage(ctx.targetSide, Math.floor(oppMaxHp * 0.35), "索魂同歸", ctx.activeP1, ctx.activeP2);
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "衰弱", 3); // 用衰弱模擬先制降低
        break;
      case 'hero_blessing':
        // 陣亡時，化作英靈庇護，使我方全體存活精靈全屬性等級 +1，並恢復 30% 體力
        ctx.addLog("🎡【英靈祝福】：戰友們，繼續戰鬥吧！");
        // 由於 Context 主要是針對當前在場精靈，全隊效果可能需要特殊處理
        // 這裡暫時只處理當前在場的（如果有的話，通常陣亡後會換人）
        // 實際上應該在切換精靈時應用
        ctx.setPlayerState("teamBlessingPending", true);
        break;
    }
  }
};
