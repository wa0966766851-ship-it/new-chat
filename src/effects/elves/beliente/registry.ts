import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';

export const handleBelienteSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.ON_ENTRANCE:
      addLog(`✨ 【蓓】：星執解放，蓓麗安特守護己方！`, "effect");
      // 透過戰鬥註冊表狀態傳遞星執
      const regKey = actor === "p1" ? "p1RegistryState" : "p2RegistryState";
      ctx.setPlayerState("belienteStarBearer", true);
      break;

    // 星河入眸：4回合內每回合使用技能時恢復最大體力½並造成等量百分比傷害（過去誤在回合結束造成真實傷害）
    case EffectTiming.BEFORE_SKILL:
      if (getPlayerState("BelienteRegenTurns") > 0 && !getPlayerState("BelienteRegenUsedThisTurn")) {
        setPlayerState("BelienteRegenUsedThisTurn", true);
        const regenAmt = Math.floor(self.maxHp / 2);
        applyHeal(actor, regenAmt);
        ctx.applyPinkDamage(oppSide, regenAmt, "星能沐浴", undefined, undefined, "percent");
      }
      break;

    case EffectTiming.ROUND_END:
      setPlayerState("BelienteRegenUsedThisTurn", false);
      if (getPlayerState("BelienteRegenTurns") > 0) {
        setPlayerState("BelienteRegenTurns", getPlayerState("BelienteRegenTurns") - 1);
      }
      break;
  }

  return false;
};

export const BELIENTE_SKILLS: Record<string, BattleSkillHandler> = {
  "星河入眸": (context) => {
    const { self, setPlayerState, addLog } = context;
    addLog(`✨ 【星河入眸】：萬千星辰，皆入我眸！`, "effect");
    setPlayerState("BelienteRegenTurns", 4);
    setPlayerState("DodgeTurns", 5);
  }
};

export { BelienteDeconstructedProfile } from "../../../data/elfProfiles/belienteRegistry";
