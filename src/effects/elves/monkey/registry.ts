import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';

/**
 * 星光·魔焰猩猩 (Starlight Monkey) A級專屬註冊表 [焰]
 */

export const handleMonkeySoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, getOpponentState, addLog, applyTrueDamage, applyPinkDamage, applyStatusWithImmunityCheck, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 登場與常駐標記 (ON_ENTRANCE & BEFORE_SKILL)
  if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.BEFORE_SKILL) {
    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🔥 【灼】：登場無條件令對手進入 3 回合【星火之灼】！`, "effect");
      setOpponentState("starfireBurnTurns", 3);
    }

    // 恢復減少效果 (星火之灼)
    if (event === EffectTiming.BEFORE_SKILL) {
      // 這裡可以設置一個 flag 讓後續的恢復效果無效
      // 但在當前框架下，可能需要在 applyHeal 時檢查
    }
  }

  // 2. 真實傷害與恢復 (AFTER_ACTION)
  if (event === EffectTiming.AFTER_ACTION && extraData?.actor === actor) {
    const isAttack = extraData?.skill?.category === "物理" || extraData?.skill?.category === "特殊";
    if (isAttack) {
      // 刷新標記
      addLog(`🔥 【灼】：攻擊觸發烈焰爆燃，對手【星火之灼】刷新為 3 回合！`, "effect");
      setOpponentState("starfireBurnTurns", 3);

      // 原有邏輯：真實傷害
      let ratio = 0.15;
      if (target.currentHp <= target.maxHp / 2) {
        ratio = 0.3;
        addLog(`🔥 【灼】：對手體力不高於 1/2，真實傷害效果翻倍！`, "effect");
      }
      const dmg = Math.floor(target.currentHp * ratio);
      if (dmg > 0) {
        applyTrueDamage(oppSide, dmg, "焰之灼燒", activeP1, activeP2);
        addLog(`🔥 【灼】：攻擊附加對手當前體力 ${ratio * 100}% 的真實傷害 (${dmg})！`, "damage");
      }
    }
  }

  // 3. 標記觸發效果 (ON_DAMAGED)
  if (event === EffectTiming.ON_DAMAGED) {
    // 自身受擊恢復 (原有邏輯)
    if (extraData?.targetSide === actor) {
      self.currentHp = Math.min(self.maxHp, self.currentHp + 150);
      self.skills.forEach(s => {
        if (s.pp !== undefined && s.maxPp !== undefined) s.pp = Math.min(s.maxPp, s.pp + 1);
      });
      addLog(`🔥 【灼】：受到傷害，恢復 150 點體力與 1 點技能 PP！`, "heal");
    }

    // 對手受擊附加傷害 (星火之灼)
    const burnTurns = getOpponentState("starfireBurnTurns");
    if (burnTurns > 0 && extraData?.targetSide !== actor) {
      const bonusDmg = Math.floor(extraData.damage * 0.5);
      if (bonusDmg > 0) {
        addLog(`🔥 【星火之灼】：星火引爆，附加額外 ${bonusDmg} 點百分比傷害！`, "damage");
        applyPinkDamage(oppSide, bonusDmg, "星火之灼", activeP1, activeP2, "百分比傷害");
      }

      // 天敵判定 (對手為水系)
      if (target.type === "水") {
        addLog(`🔥 【星火之灼】：對手為水系，標記崩解並引發毀滅性反噬！`, "effect");
        setOpponentState("starfireBurnTurns", 0);
        const trueDmg = Math.floor(extraData.damage);
        applyTrueDamage(oppSide, trueDmg, "星火之灼反噬", activeP1, activeP2);
      }
    }
  }

  // 4. 回合結束與標記遞減 (ROUND_END)
  if (event === EffectTiming.ROUND_END) {
    const burnTurns = getOpponentState("starfireBurnTurns") || 0;
    if (burnTurns > 0) {
      setOpponentState("starfireBurnTurns", burnTurns - 1);
    }
  }

  // 5. 死亡特攻 (DEATH_NODE_1)
  if (event === EffectTiming.DEATH_NODE_1) {
    addLog(`🔥 【焰】：魔焰燃盡，最後的詛咒！`, "effect");
    // 隨機 2 個技能 PP 歸 0
    const ppSkills = target.skills.filter(s => (s.pp || 0) > 0);
    for (let i = 0; i < 2 && ppSkills.length > 0; i++) {
      const idx = Math.floor(Math.random() * ppSkills.length);
      const s = ppSkills.splice(idx, 1)[0];
      s.pp = 0;
      addLog(`🔥 【焰】：令對手技能 【${s.name}】 PP 歸 0！`, "effect");
    }
    // 隨機 2 項屬性 -2
    const stats = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
    for (let i = 0; i < 2; i++) {
      const s = stats[Math.floor(Math.random() * stats.length)];
      const current = target.statStages[s as keyof typeof target.statStages] || 0;
      target.statStages[s as keyof typeof target.statStages] = Math.max(-6, current - 2);
      addLog(`🔥 【焰】：令對手 【${s}】 等級 -2！`, "effect");
    }
  }

  return false;
};

export const MONKEY_SKILLS: Record<string, BattleSkillHandler> = {
  // 可以添加專屬技能邏輯
};

export { MonkeyDeconstructedProfile } from "../../../data/elfProfiles/monkeyRegistry";
