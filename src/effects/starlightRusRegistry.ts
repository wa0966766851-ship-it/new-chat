import { prdChance } from "../utils/prd";
import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";

/**
 * 星光·魯斯王 (Starlight Rousu King) A級專屬註冊表 [海]
 * 嚴格對齊文本描述機制
 */

export const handleStarlightRusSoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, getOpponentState, addLog, applyStatusWithImmunityCheck, clearTurnEffectsOf, activeP1, activeP2, applyPinkDamage, applyTrueDamage } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 登場與常駐標記
  if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.BEFORE_ACTION || event === EffectTiming.BEFORE_SKILL) {
    // 必定致命一擊
    // alwaysCritical moved to BEFORE_SKILL
    
    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🌊 【海】：登場無條件令對手進入 3 回合【星海之浸】！`, "effect");
      setOpponentState("starSeaSoakTurns", 3); setOpponentState("utilitySkillInvalidTurns", 3); setOpponentState("utilitySkillInvalidReason", "星海之浸：屬性技能失效");
    }

    // 自身所有技能必定打出致命一擊
    if (event === EffectTiming.BEFORE_SKILL) {
      setPlayerState("nextTurnCrit", true);
    }
  }

  // 回合開始：清空「本回合所受技能傷害」紀錄（供【克制】反饋使用）
  if (event === EffectTiming.ROUND_START) {
    setPlayerState("rusSkillDmgTakenThisTurn", 0);
  }

  // 2. 攻擊後效果
  // AFTER_ACTION 只派發給行動方本身（無 extraData），以 ctx.skill 判斷是否為攻擊
  if (event === EffectTiming.AFTER_ACTION) {
    const usedSkill = extraData?.skill || context.skill;
    const isAttack = usedSkill?.category === "物理" || usedSkill?.category === "特殊";
    if (isAttack) {
      addLog(`🌊 【海】：攻擊觸發星海漫溢，對手【星海之浸】回合刷新為 3！`, "effect");
      setOpponentState("starSeaSoakTurns", 3); setOpponentState("utilitySkillInvalidTurns", 3); setOpponentState("utilitySkillInvalidReason", "星海之浸：屬性技能失效");
    }
  }

  // 3. 標記觸發效果 (ON_DAMAGED)
  // 自身受到技能傷害：記錄本回合所受技能傷害（【克制】反饋用）
  if (event === EffectTiming.ON_DAMAGED && extraData?.targetSide === actor) {
    const dt = String(extraData?.damageType || "");
    if ((dt === "skill_attack" || dt === "skill") && (extraData?.damage || 0) > 0) {
      setPlayerState("rusSkillDmgTakenThisTurn", (getPlayerState("rusSkillDmgTakenThisTurn") || 0) + Math.floor(extraData.damage));
    }
  }
  if (event === EffectTiming.ON_DAMAGED && extraData?.targetSide !== actor) {
    const soakTurns = getOpponentState("starSeaSoakTurns");
    if (soakTurns > 0) {
      const dmgVal = Math.floor(extraData?.damage || 0);
      // 持有者每次受到攻擊傷害後額外受到傷害值100%的百分比傷害，並恢復對方在場精靈等量體力與1點所有技能PP值
      if (dmgVal > 0) {
        addLog(`🌊 【星海之浸】：附加額外 ${dmgVal} 點百分比傷害！`, "damage");
        applyPinkDamage(oppSide, dmgVal, "星海之浸", activeP1, activeP2, "百分比傷害");
        context.applyHeal(actor, dmgVal);
        self.skills.forEach(s => { if (s.pp !== undefined && s.maxPp !== undefined) s.pp = Math.min(s.maxPp, s.pp + 1); });
        addLog(`🌊 【星海之浸】：為【${self.name}】恢復 ${dmgVal} 點體力與所有技能 1 點 PP！`, "heal");
      }

      // 若對手為草系則星海之浸消失並額外附加傷害值100%的真實傷害，並恢復對方在場精靈等量體力與所有技能全部PP值
      if (target.type === "草") {
        addLog(`🌊 【星海之浸】：對手為草系，星海之浸消失！`, "effect");
        setOpponentState("starSeaSoakTurns", 0); setOpponentState("utilitySkillInvalidTurns", 0);
        if (dmgVal > 0) {
          applyTrueDamage(oppSide, dmgVal, "星海之浸", activeP1, activeP2);
          context.applyHeal(actor, dmgVal);
        }
        self.skills.forEach(s => { if (s.pp !== undefined && s.maxPp !== undefined) s.pp = s.maxPp; });
        addLog(`🌊 【星海之浸】：【${self.name}】恢復 ${dmgVal} 點體力與所有技能全部 PP！`, "heal");
      }
    }
  }

  // 4. 回合結束與標記遞減 (ROUND_END)
  if (event === EffectTiming.ROUND_END) {
    const soakTurns = getOpponentState("starSeaSoakTurns") || 0;
    if (soakTurns > 0) {
      setOpponentState("starSeaSoakTurns", soakTurns - 1); setOpponentState("utilitySkillInvalidTurns", soakTurns - 1);
    }
  }

  // 5. 致命抗性
  if (event === EffectTiming.FATAL_RESIST) {
    const used = getPlayerState("rusFatalResistUsed");
    if (!used && self.level === 100) {
      setPlayerState("rusFatalResistUsed", true);
      addLog(`🌊 【海】：觸發死地重生！消除對手強化與回合類效果，體力與 PP 全部恢復！`, "effect");
      // 消除對手能力提升狀態（僅提升，下降保留）
      const st = target.statStages as Record<string, number>;
      Object.keys(st).forEach(k => { if ((st[k] || 0) > 0) st[k] = 0; });
      clearTurnEffectsOf(oppSide, target);
      self.currentHp = self.maxHp;
      self.skills.forEach(s => {
        if (s.pp !== undefined && s.maxPp !== undefined) s.pp = s.maxPp;
      });
      self.shield = self.maxHp;
      self.barrier = self.maxHp;
      addLog(`🌊 【海】：獲得等同於自身體力值的護盾與護罩 (${self.maxHp})！`, "effect");
      return true;
    }
  }

  return false;
};

export const STARLIGHT_RUS_SKILLS: Record<string, BattleSkillHandler> = {
  "星光·閃擊": (ctx) => {
    const { self, target, setPlayerState, setOpponentState, addLog } = ctx;
    const hasBuff = Object.values(target.statStages).some(v => (v as number) > 0);
    if (hasBuff) {
      target.statStages = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      setOpponentState("damageLimit200Turns", 2);
      addLog(`🌊 【星光·閃擊】：消強成功，對手 2 回合內造成傷害不超過 200 點！`, "effect");
    } else {
      setOpponentState("healReduce50Turns", 2);
      addLog(`🌊 【星光·閃擊】：對手無強化，其體力恢復效果減少 50%！`, "effect");
    }
    setPlayerState("immuneStatusTurns", 2);
    setPlayerState("immuneStatDownTurns", 2);
    addLog(`🌊 【星光·閃擊】：2 回合內自身免疫異常狀態與能力下降！`, "effect");
  },

  "星光·隨風逐浪": (ctx) => {
    const { self, setPlayerState, addLog } = ctx;
    const bonus = self.currentHp > self.maxHp / 2 ? 2 : 1;
    const stages = self.statStages;
    ["atk", "def", "spatk", "spdef", "speed", "accuracy"].forEach(k => {
      stages[k as keyof typeof stages] = Math.min(6, (stages[k as keyof typeof stages] || 0) + bonus);
    });
    setPlayerState("dmgDoubleTurns", 2);
    setPlayerState("ignoreDef25Turns", 2);
    setPlayerState("ignoreOppBuffTurns", 2);
    addLog(`🌊 【星光·隨風逐浪】：全屬性+${bonus}，進入傷害翻倍、穿防與無視強化狀態！`, "effect");
  },

  "克制": (ctx) => {
    // ■ 先制-6（資料欄位）
    // ■ 無視對手抵擋傷害效果、無視對手傷害限制效果：反饋以直接技能傷害結算，不經主技能傷害流程的抵擋／上限判定
    // 🎯 將本次所受的技能傷害2倍以技能傷害形式反饋給對手（不小於本次所受技能傷害2倍）
    const { actor, addLog, getPlayerState, self, target } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const taken = Math.floor(getPlayerState("rusSkillDmgTakenThisTurn") || 0);
    if (taken <= 0) {
      addLog(`🌊 【克制】：本回合未受到技能傷害，無可反饋的傷害。`, "effect");
      return;
    }
    const want = taken * 2;
    addLog(`🌊 【克制】：將本回合所受的 ${taken} 點技能傷害 2 倍反饋給對手！`, "effect");
    ctx.applySkillTypeDamage(oppSide, want, "克制", { ignoreBlock: true, ignoreLimit: true, floor: want });
  },

  "星光·排山倒海": (ctx) => {
    const { setOpponentState, setPlayerState, addLog, actor, applyStatusWithImmunityCheck } = ctx;
    // 🎯 無視對手攻擊免疫效果（描述解析於 attackImmunity）與護盾效果（本次行動旗標）
    setPlayerState("ignoreImmunityAndShield", true);
    // 🎯 給對手造成傷害時，傷害數值的50%恢復自身體力
    setPlayerState("vampireRatio", 0.5);
    // 🎯 命中後100%使對手冰封，未觸發則對手下2回合先制-2
    const res = applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "冰封", 2);
    if (!res?.success) {
      setOpponentState("priorityBoostTurns", 3);
      setOpponentState("priorityBoostValue", -2);
      setOpponentState("priorityBoostAttackOnly", false);
      addLog(`🌊 【星光·排山倒海】：未觸發冰封，令對手下 2 回合先制-2！`, "effect");
    }
  },

  "星光·浪打千擊": (ctx) => {
    const { self, target, setPlayerState, setOpponentState, addLog, getPlayerState, applyPinkDamage, actor, activeP1, activeP2, clearTurnEffectsOf, applyStatChange } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";

    // 1. 必中、5~10次攻擊模擬
    const hits = Math.floor((ctx.rng ?? Math.random)() * 6) + 5;
    addLog(`🌊 【星光·浪打千擊】：展開了 ${hits} 次連環打擊！`, "effect");
    for (let i = 0; i < hits; i++) {
      if (prdChance("starlightRusRegistry:L167", 0.2)) {
        applyStatChange(actor, { atk: 1, speed: 1, accuracy: 1 });
      }
    }

    // 2. 消除回合類效果
    if (clearTurnEffectsOf(oppSide, target)) {
      setOpponentState("missTurns", 2);
      addLog(`🌊 【星光·浪打千擊】：消回合成功，對手 2 回合內攻擊技能 MISS！`, "effect");
    }

    // 3. 增傷判定
    const isBurning = ctx.getOpponentState("starfireBurnTurns") > 0 || ctx.getOpponentState("starSeaSoakTurns") > 0;
    if (isBurning) {
      let multiplier = 1.75;
      if (self.currentHp < target.currentHp) {
        multiplier = 2.5; 
        addLog(`🌊 【星光·浪打千擊】：對手處於狀態中且自身體力較低，傷害大幅提升至 250%！`, "effect");
      } else {
        addLog(`🌊 【星光·浪打千擊】：對手處於狀態中，傷害提升至 175%！`, "effect");
      }
      setPlayerState("skillDamageBoost", multiplier);
    }

    // 4. 百分比傷害附加
    const count = (getPlayerState("langdaCount") || 0) + 1;
    setPlayerState("langdaCount", count);
    const ratio = Math.min(0.4, 0.2 + (count - 1) * 0.1);
    applyPinkDamage(oppSide, Math.floor(self.maxHp * ratio), "【星光·浪打千擊】百分比傷害", activeP1, activeP2, "百分比傷害");
  }
};
