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
 * 5015 混沌·布萊克 魂印「夜」（原文 elf_source_files 5015）。舊 handleChaosBlakeSoulMark 是另一個魂印「混」，只保留給舊 id 1012。
 * 未實作：能力提升被消除／吸取時的害怕與狂暴轉化（引擎沒有對應事件）、免疫類無法免疫狂暴（常駐規則）。
 */
export const handleChaosBlakeNightSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";
  const statuses = ctx.getStatuses?.(self) || {};
  const berserk = (statuses as any)["狂暴"] > 0;

  // 對手使用技能時
  if (event === EffectTiming.OPPONENT_ACTION && extraData?.skill) {
    if (extraData.skill.category === "屬性") {
      // 免疫下1次異常；下1次攻擊技能無視對手傷害限制、攻擊免疫
      setPlayerState(`${actor}_immuneStatusCount`, (Number(getPlayerState(`${actor}_immuneStatusCount`)) || 0) + 1);
      setPlayerState("blakeNextAttackBypass", true);
      addLog(`🌑 【夜】：對手使用屬性技能，免疫下1次異常且下次攻擊無視限制與免疫！`, "effect");
    } else {
      // 100% 閃避對手攻擊（必中技能不受閃避影響）
      ctx.addTimerTo(actor, { id: "blake_night_evade", name: "夜·閃避", kind: "round_counter", source: "soul" as any, remaining: 1, tickAt: "round_end",
        stackRule: "refresh", payload: { block: { evade: 100, kind: "攻擊" } } } as any, false);
    }
  }
  if (event === EffectTiming.OPPONENT_AFTER_ACTION && extraData && extraData.category && extraData.category !== "屬性") {
    if (extraData.failKind === "evade") {
      // 下2次攻擊技能先制+2且造成的傷害提升50%
      setPlayerState("blakeNightCharges", 2);
      setPlayerState("attackDamageBoostCharges", 2);
      setPlayerState("attackDamageBoostChargeRate", 0.5);
      addLog(`🌑 【夜】：閃避成功！下2次攻擊技能先制+2且傷害提升50%！`, "effect");
    } else {
      setPlayerState("blakeRoundEndSiphon", true);
    }
  }
  if (event === EffectTiming.MODIFY_PRIORITY && extraData?.priorityComp) {
    if (berserk) extraData.priorityComp.bonus += 1;
    if ((Number(getPlayerState("blakeNightCharges")) || 0) > 0 && ctx.skill && ctx.skill.category !== "屬性") extraData.priorityComp.bonus += 2;
  }
  if (event === EffectTiming.BEFORE_SKILL && ctx.skill && ctx.skill.category !== "屬性") {
    const n = Number(getPlayerState("blakeNightCharges")) || 0;
    if (n > 0) setPlayerState("blakeNightCharges", n - 1);
    if (getPlayerState("blakeNextAttackBypass")) {
      setPlayerState("blakeNextAttackBypass", false);
      setPlayerState("ignoreAttackImmunityThisAction", true);
      setPlayerState("ignoreDamageLimitThisAction", true);
    }
  }
  if (event === EffectTiming.ROUND_END) {
    if (getPlayerState("blakeRoundEndSiphon")) {
      setPlayerState("blakeRoundEndSiphon", false);
      // 未閃避：附加自身攻擊值50%的百分比傷害並回復等量體力
      const amt = Math.floor((self.calculatedStats?.atk || 0) * 0.5);
      if (amt > 0) { ctx.applyPinkDamage(oppSide, amt, "【夜】", undefined, undefined, "percent"); ctx.applyHeal(actor, amt); }
    }
    if (getPlayerState("blakeCleanseAtRoundEnd")) {
      setPlayerState("blakeCleanseAtRoundEnd", false);
      ctx.updateElf(actor, { id: self.id, battleStatuses: Object.fromEntries(Object.entries(self.battleStatuses || {}).filter(([k]) => k === "狂暴")) } as any);
    }
  }
  // 自身死亡時（每場戰鬥最多1次）：殘留1點體力、消除對手回合類效果、詛咒、吸取⅓、自身狂暴3回合，回合結束解除異常
  if (event === EffectTiming.FATAL_RESIST) {
    if (getPlayerState("blakeDeathUsed")) return false;
    setPlayerState("blakeDeathUsed", true);
    self.currentHp = 1;
    addLog(`🌑 【夜】：殘留 1 點體力！`, "effect");
    ctx.clearTurnEffectsOf(oppSide);
    ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 3);
    const drain = Math.floor((ctx.target?.maxHp || 0) / 3);
    if (drain > 0) ctx.applyPinkDamage(oppSide, drain, "【夜】吸取", undefined, undefined, "percent", { onSettled: (r: any) => ctx.applyHeal(actor, r.settledAmount) } as any);
    ctx.applyStatusWithImmunityCheck(actor, "狂暴", 3);
    setPlayerState("blakeCleanseAtRoundEnd", true);
    return true;
  }
  return false;
};

export const CHAOS_BLAKE_SKILLS: Record<string, BattleSkillHandler> = {
  // 可以添加專屬技能邏輯
};

export { ChaosBlakeDeconstructedProfile } from "../../../data/elfProfiles/chaosBlakeRegistry";
