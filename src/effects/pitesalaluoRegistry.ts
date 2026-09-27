import { BattleEventContext, EffectTiming } from "./types";

/**
 * 皮特薩拉羅 (Pitesalaluo) - B Rank
 * 魂印：翎
 */
export const handlePitesalaluoSoulMark = (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const currentHp = ctx.getPlayerState("currentHp");
  const maxHp = ctx.getPlayerState("maxHp");
  const oppStats = ctx.getOpponentState("statChanges");

  switch (event) {
    case EffectTiming.BEFORE_SKILL:
      // 自身使用攻擊技能時100%機率令對手麻痺
      if (extraData?.skill?.category !== '屬性') {
        ctx.addLog("🎡【翎】：漫天羽翎，封鎖對手行動！");
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
      }
      break;

    case EffectTiming.AFTER_ACTION:
      // 對手處於能力下降狀態時額外附加對手最大體力1/3的百分比傷害
      const hasDebuff = oppStats ? Object.values(oppStats).some(v => (v as number) < 0) : false;
      if (hasDebuff) {
        ctx.addLog("🎡【翎】：乘勝追擊，羽之重壓！");
        ctx.applyPercentDamage(ctx.targetSide, 1/3);
      }

      // 回合結束時自身體力低於1/2則消除對手回合類效果並令對手全屬性-1
      if (currentHp / maxHp < 0.5) {
        ctx.addLog("🎡【翎】：逆境中的反擊，羽翼扇動！");
        ctx.setOpponentState("turnEffects", []);
        ctx.applyStatChange(ctx.targetSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
      }
      break;

    case EffectTiming.FATAL_RESIST:
      // 自身首次受到致命傷害時保留1點體力並令對手進入麻痺狀態
      if (!ctx.getPlayerState("pitesalaluoFatalResist")) {
        ctx.addLog("🎡【翎】：最後的羽翼守護，致命抗性觸發！");
        ctx.setPlayerState("pitesalaluoFatalResist", true);
        ctx.self.currentHp = 1;
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
        if (extraData) extraData.cancelFatal = true;
        return true;
      }
      return false;

    case EffectTiming.DEATH_NODE_1:
      // 自身被擊敗時消除對手回合類效果，然後依次令對手進入麻痺、害怕、癱瘓狀態
      ctx.addLog("🎡【翎】：凋零之舞，最後的詛咒！");
      ctx.setOpponentState("turnEffects", []);
      ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
      ctx.applyStatusWithImmunityCheck(ctx.targetSide, "害怕", 1);
      ctx.applyStatusWithImmunityCheck(ctx.targetSide, "癱瘓", 1);
      break;
    
    case EffectTiming.ROUND_START:
      // 自身位於背包時對方切換登場有100%機率進入麻痺
      // 這種「場下生效」的邏輯需要主循環在切換精靈時主動遍歷背包
      break;
  }
};

export const PITESALALUO_SKILLS = {
  "翎封禁之羽": (ctx: BattleEventContext) => {
    ctx.addLog("【翎封禁之羽】：禁忌的羽毛！");
    ctx.setOpponentState("statChanges", { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, acc: 0, eva: 0 });
    // 消除成功則令對手麻痺 (簡化)
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
  },
  "翎萬羽歸宗": (ctx: BattleEventContext) => {
    ctx.addLog("【翎萬羽歸宗】：萬羽齊鳴，天崩地裂！");
    ctx.setOpponentState("turnEffects", []);
    ctx.applyStatusWithImmunityCheck(ctx.targetSide, "疲憊", 1);
  }
};
