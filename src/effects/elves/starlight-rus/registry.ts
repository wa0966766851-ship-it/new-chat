import { prdChance } from "../../../utils/prd";
import { BattleEventContext, BattleSkillHandler, EffectTiming } from "../../types";

/**
 * 星光·魯斯王 (Starlight Rousu King) A級專屬註冊表 [海]
 * 嚴格對齊文本描述機制
 */

export const handleStarlightRusSoulMark = (_context: BattleEventContext, _event: EffectTiming, _extraData?: any) => {
  // 5010 魂印「海」已遷真 Kit（migratedGroup5SeaSoulKit.ts；DSH 20261018 組 5）——規則3.3 空殼化。
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
    // 「下2回合」：本回合不生效，之後 2 個回合
    ctx.setNextTurns?.("self", "dmgDoubleTurns", 2);
    ctx.setNextTurns?.("self", "ignoreDef25Turns", 2);
    ctx.setNextTurns?.("self", "ignoreOppBuffTurns", 2);
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
    ctx.applySkillTypeDamage(oppSide, want, "克制", { ignoreBlock: true, ignoreLimit: true, floor: want, node: "attack_damage" });
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
    setPlayerState("attackHitCountThisAction", hits);
    // 連擊屬於變威力：每擊 20% 強化先於傷害計算結算，再以結算後能力等級計算（單次計算×連擊次數）。
    let boosts = 0;
    for (let i = 0; i < hits; i++) if (prdChance(`${actor}:rus:wave-boost`, 0.2)) boosts++;
    if (boosts > 0) {
      applyStatChange(actor, { atk: boosts, speed: boosts, accuracy: boosts });
      addLog(`🌊 【星光·浪打千擊】：${hits} 擊中 ${boosts} 次觸發，攻擊、速度、命中 +${boosts}！`, "effect");
    }

    // 2. 消除回合類效果
    if (clearTurnEffectsOf(oppSide, target)) {
      setOpponentState("missTurns", 2);
      addLog(`🌊 【星光·浪打千擊】：消回合成功，對手 2 回合內攻擊技能 MISS！`, "effect");
    }

    // 3. 增傷判定
    const isBurning = ctx.getOpponentState("starfireBurnTurns") > 0;
    if (isBurning) {
      let multiplier = 1.75;
      if (self.currentHp < target.currentHp) {
        multiplier = 2.5; 
        addLog(`🌊 【星光·浪打千擊】：對手處於狀態中且自身體力較低，傷害大幅提升至 250%！`, "effect");
      } else {
        addLog(`🌊 【星光·浪打千擊】：對手處於狀態中，傷害提升至 175%！`, "effect");
      }
      setPlayerState("rusAttackMultiplier", multiplier);
    }

    // 4. 百分比傷害附加
    const count = (getPlayerState("langdaCount") || 0) + 1;
    setPlayerState("langdaCount", count);
    const ratio = Math.min(0.4, 0.2 + (count - 1) * 0.1);
    setPlayerState("rusPendingPercentDamage", Math.floor(self.maxHp * ratio));
  }
};
