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

/**
 * 5015 混沌·布萊克 魂印「夜」——已遷移為真 Kit（migratedNightSoulKit.ts；DSH 20261018 第十一批·第一波）。
 * 舊 handleChaosBlakeSoulMark 是另一個魂印「混」（舊 id 1012），維持原狀。
 */
export const handleChaosBlakeNightSoulMark = (_ctx: BattleEventContext, _event: EffectTiming | string, _extraData?: any) => {
  // 5015 魂印「夜」已整份遷移為真 Kit（src/data/migratedNightSoulKit.ts；DSH 20261018 第十一批·第一波）。
  // 舊 handler 語意由積木承接：狂暴主權（statusSovereignty）、消強反應（stat_boost_cleared）、狂暴先制、
  // 屬性技免疫與無視、被動閃避（soul_property evade）、閃避充能／未閃避吸取（fail_kind）、死亡分支（fatal once）。
  // 保留匯出名僅供舊引用解析；不再執行任何戰鬥行為。
  return false;
};

export const CHAOS_BLAKE_SKILLS: Record<string, BattleSkillHandler> = {
  // 可以添加專屬技能邏輯
};

export { ChaosBlakeDeconstructedProfile } from "../../../data/elfProfiles/chaosBlakeRegistry";
