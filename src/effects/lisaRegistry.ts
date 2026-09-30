import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { getMaxPp } from '../utils/battleHelpers';

/**
 * 星光·麗莎布布 (Starlight Lisa) A級專屬註冊表 [麗]
 */

export const handleLisaSoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, getOpponentState, addLog, applyTrueDamage, applyPinkDamage, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 登場與常駐標記 (ON_ENTRANCE & BEFORE_SKILL)
  if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.BEFORE_SKILL) {
    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🌸 【芳】：登場無條件令對手進入 3 回合【星芳之纏】！`, "effect");
      setOpponentState("starFangTurns", 3);
    }

    // 減傷效果 (星芳之纏)
    if (event === EffectTiming.BEFORE_SKILL) {
      const fangTurns = getOpponentState("starFangTurns");
      if (fangTurns > 0) {
        // 如果當前行動者是對手
        if (extraData?.actor !== actor) {
          setOpponentState("damageTakenBoostTurns", 0); // 保留或作為標記
        }
      }
    }
  }

  // 2. 攻擊刷新與恢復 (AFTER_ACTION)
  if (event === EffectTiming.AFTER_ACTION && extraData?.actor === actor) {
    const isAttack = extraData?.skill?.category === "物理" || extraData?.skill?.category === "特殊";
    if (isAttack) {
      addLog(`🌸 【芳】：攻擊觸發繁花共鳴，對手【星芳之纏】刷新為 3 回合！`, "effect");
      setOpponentState("starFangTurns", 3);
    }
  }

  // 3. 標記觸發效果 (ON_DAMAGED)
  if (event === EffectTiming.ON_DAMAGED) {
    // 自身受擊弱化與真傷 (原有邏輯)
    if (extraData?.targetSide === actor) {
      const isAttack = extraData.category === "物理" || extraData.category === "特殊";
      if (isAttack) {
        const stats = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
        const s = stats[Math.floor(Math.random() * stats.length)];
        const current = target.statStages[s as keyof typeof target.statStages] || 0;
        target.statStages[s as keyof typeof target.statStages] = Math.max(-6, current - 1);
        addLog(`🌸 【麗】：受擊反震，令對手 【${s}】 等級 -1！`, "effect");
        
        const defSum = self.calculatedStats.def + self.calculatedStats.spdef;
        const dmg = Math.floor(defSum * 0.2);
        if (dmg > 0) {
          applyTrueDamage(oppSide, dmg, "麗之反震", activeP1, activeP2);
          addLog(`🌸 【麗】：受擊反震，附加自身雙防總和 20% 的真實傷害 (${dmg})！`, "damage");
        }
      }
    }

    // 對手受擊附加傷害 (星芳之纏)
    const fangTurns = getOpponentState("starFangTurns");
    if (fangTurns > 0 && extraData?.targetSide !== actor) {
      const bonusDmg = Math.floor(extraData.damage * 0.5);
      if (bonusDmg > 0) {
        addLog(`🌸 【星芳之纏】：花瓣纏繞，附加額外 ${bonusDmg} 點百分比傷害！`, "damage");
        applyPinkDamage(oppSide, bonusDmg, "星芳之纏", activeP1, activeP2, "百分比傷害");
        
        // 恢復對方在場精靈 (Lisa) 1 點 PP
        self.skills.forEach(s => { if (s.pp !== undefined && s.maxPp !== undefined) s.pp = Math.min(s.maxPp, s.pp + 1); });
        addLog(`🌸 【星芳之纏】：為【${self.name}】恢復了 1 點技能 PP！`, "heal");
      }

      // 天敵判定 (對手為火系)
      if (target.type === "火") {
        addLog(`🌸 【星芳之纏】：對手為火系，標記崩解並引發毀滅性反噬！`, "effect");
        setOpponentState("starFangTurns", 0);
        const trueDmg = Math.floor(extraData.damage);
        applyTrueDamage(oppSide, trueDmg, "星芳之纏反噬", activeP1, activeP2);
      }
    }
  }

  // 4. 回合結束恢復與標記遞減 (ROUND_END)
  if (event === EffectTiming.ROUND_END) {
    const fangTurns = getOpponentState("starFangTurns") || 0;
    if (fangTurns > 0) {
      setOpponentState("starFangTurns", fangTurns - 1);
    } else {
      // 標記結束時清除減傷狀態
      setOpponentState("nonTrueDamageReduction", 1.0);
    }

    const heal = Math.floor(self.maxHp * 0.25);
    self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
    
    const ppSkills = self.skills.filter(s => (s.pp || 0) < getMaxPp(s, self));
    if (ppSkills.length > 0) {
      const s = ppSkills[Math.floor(Math.random() * ppSkills.length)];
      s.pp = (s.pp || 0) + 1;
      addLog(`🌸 【麗】：神木之靈恢復了隨機技能 【${s.name}】 的 PP！`, "effect");
    }
    addLog(`🌸 【麗】：回合結束，恢復 1/4 體力 (${heal})！`, "heal");
  }

  return false;
};

export const LISA_SKILLS: Record<string, BattleSkillHandler> = {
  // 可以添加專屬技能邏輯
};

export { LisaDeconstructedProfile } from "../data/elfProfiles/lisaRegistry";
