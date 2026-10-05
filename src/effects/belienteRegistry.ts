import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

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

    case "BEFORE_SWITCH_OUT":
      if (getPlayerState("BelienteVaultTurns") > 0) {
        addLog(`✨ 【蓓】：星河祈願，為下一位同伴降下祝福！`, "effect");
        setPlayerState("nextElfStarGift", true);
        setPlayerState("BelienteVaultTurns", 0);
      }
      break;

    case EffectTiming.ROUND_END:
      if (getPlayerState("BelienteRegenTurns") > 0) {
        const regenAmt = Math.floor(self.maxHp / 2);
        applyHeal(actor, regenAmt);
        ctx.applyTrueDamage(oppSide, regenAmt, "星能沐浴");
        setPlayerState("BelienteRegenTurns", getPlayerState("BelienteRegenTurns") - 1);
      }
      break;
  }

  return false;
};

export const BELIENTE_SKILLS: Record<string, BattleSkillHandler> = {
  "星垂穹儀": (context) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog } = context;
    // ... (保持原有的技能邏輯，但確保符合規範)
    addLog(`✨ 【星垂穹儀】：星辰運轉，命運干涉！`, "effect");
    setPlayerState("ImmuneStatDebuffTurns", 5);
    // 攻擊傷害轉體力是結算防護，不是攻擊免疫；被無視時不消耗。
    context.addTimerTo(actor, { id: 'beliente_damage_conversion', name: '星光倒流', kind: 'use_counter',
      source: 'skill', remaining: 1, tickAt: 'never', payload: { block: { absorbToHeal: true, kind: '攻擊' } } }, false);
    setPlayerState("BelienteVaultTurns", 1);
    // 🎯 反轉自身能力下降狀態，反轉成功則使對手隨機2個技能PP歸零
    const stages: Record<string, number> = { ...(self.statStages || {}) } as any;
    const neg = Object.keys(stages).filter(k => (stages[k] || 0) < 0);
    if (neg.length > 0) {
      const delta: Record<string, number> = {};
      neg.forEach(k => { delta[k] = -2 * stages[k]; });
      context.applyStatChange(actor, delta);
      const rnd = context.rng ?? Math.random;
      const idx = (target.skills || []).map((_, i) => i).filter(i => (target.skills[i].pp ?? 0) > 0);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.slice(0, 2).forEach(i => { target.skills[i].pp = 0; });
      addLog(`✨ 【星垂穹儀】：反轉自身能力下降狀態，令對手隨機 ${Math.min(2, idx.length)} 個技能 PP 歸零！`, "effect");
    }
  },
  "星河入眸": (context) => {
    const { self, setPlayerState, addLog } = context;
    addLog(`✨ 【星河入眸】：萬千星辰，皆入我眸！`, "effect");
    setPlayerState("BelienteRegenTurns", 4);
    setPlayerState("DodgeTurns", 5);
  }
};

export { BelienteDeconstructedProfile } from "../data/elfProfiles/belienteRegistry";
