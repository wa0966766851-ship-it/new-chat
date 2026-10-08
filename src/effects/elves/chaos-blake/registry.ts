import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';
import { isStatusActive } from '../../../utils/statusManager';

/**
 * 混沌·布萊克 (Chaos Blake) A級專屬註冊表 [混]
 */

export const handleChaosBlakeSoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, getOpponentState, setOpponentState, addLog, applyTrueDamage, applyStatusWithImmunityCheck, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 回合開始 (ROUND_START): 處理混亂、疲憊補償
  if (event === EffectTiming.ROUND_START) {
    const isConfused = isStatusActive(self, "confused");
    const isExhausted = isStatusActive(self, "exhausted") || isStatusActive(self, "tired"); // 假設有這些狀態
    
    if (isConfused || isExhausted) {
      addLog(`🌑 【混】：處於混亂/疲憊狀態，激發混沌之力！`, "effect");
      // 清空對手隨機 1 項技能 PP
      const ppSkills = target.skills.filter(s => (s.pp || 0) > 0);
      if (ppSkills.length > 0) {
        const s = ppSkills[Math.floor(Math.random() * ppSkills.length)];
        s.pp = 0;
        addLog(`🌑 【混】：令對手隨機技能 【${s.name}】 PP 歸 0！`, "effect");
      }
      // 吸取對手 1/3 最大體力
      const drain = Math.floor(target.maxHp / 3);
      self.currentHp = Math.min(self.maxHp, self.currentHp + drain);
      applyTrueDamage(oppSide, drain, "混沌吸取", activeP1, activeP2);
      addLog(`🌑 【混】：吸取對手 1/3 最大體力 (${drain})！`, "heal");
    }

    // 記錄回合開始時的體力，用於計算變動值
    setPlayerState("hpAtRoundStart", self.currentHp);
    setOpponentState("hpAtRoundStart", target.currentHp);
  }

  // 5015 原文沒有「低血完全免傷／先制+3」，移除複製舊魂印帶入的額外防禦。

  // 4. 使用技能後 (AFTER_ACTION): 體力變動值 20% 真實傷害
  if (event === EffectTiming.AFTER_ACTION && extraData?.actor === actor) {
    const selfStart = getPlayerState("hpAtRoundStart") || self.currentHp;
    const oppStart = getOpponentState("hpAtRoundStart") || target.currentHp;
    
    const selfChange = Math.abs(self.currentHp - selfStart);
    const oppChange = Math.abs(target.currentHp - oppStart);
    
    const totalChange = selfChange + oppChange;
    const bonusDmg = Math.min(2000, Math.floor(totalChange * 0.2));
    
    if (bonusDmg > 0) {
      applyTrueDamage(oppSide, bonusDmg, "混沌變動傷害", activeP1, activeP2);
      addLog(`🌑 【混】：混沌共鳴，附加體力變動值 20% 的真實傷害 (${bonusDmg})！`, "damage");
    }

    // 行動後清除先制加成
    if (getPlayerState("chaosBlakePriorityNextTurn")) {
       setPlayerState("chaosBlakePriorityNextTurn", 0);
    }
  }
  

  return false;
};

export const CHAOS_BLAKE_SKILLS: Record<string, BattleSkillHandler> = {
  // 可以添加專屬技能邏輯
};

export { ChaosBlakeDeconstructedProfile } from "../../../data/elfProfiles/chaosBlakeRegistry";
