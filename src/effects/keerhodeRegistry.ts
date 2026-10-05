import { multiplyDamageReduction } from '../battle/damageReduction';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from "./types";
import { isStatusActive } from "../utils/statusManager";
import { isAbnormal as isAbnormalHelper } from "../utils/battleHelpers";
import { combineSettlementCallbacks } from '../battle/settlementReceipt';

/**
 * 冰魄·柯爾德 (Keld) A級專屬註冊表 [冰]
 */

export const handleKeerhodeSoulMark = (context: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, getOpponentState, setOpponentState, addLog, applyPinkDamage, applyTrueDamage, applyStatusWithImmunityCheck, clearTurnEffectsOf, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 回合開始時/行動前：處理先制與無視能力
  if (event === EffectTiming.BEFORE_ACTION) {
    const stacks = getPlayerState("keldSoulStacks") || 0;
    const isAbnormal = isAbnormalHelper(self);
    
    // 寂殺之魄：無視先制等級
    if (stacks > 0) {
      const oppPriority = extraData?.priority || 0;
      const ignoreLimit = isAbnormal ? stacks * 3 : stacks;
      if (oppPriority <= ignoreLimit && oppPriority > 0) {
        addLog(`❄️ 【寂殺】：無視對手不高於 ${ignoreLimit} 級的先制等級！`, "effect");
        if (extraData) extraData.priority = 0;
      }
    }

    // 無視對手能力提升 (常駐)
    // 這部分通常在傷害計算邏輯中處理，這裡僅作日誌或狀態標記
    
    // 疊層效果：無視下降 -> 視為對手下降
    if (stacks >= 2) {
      addLog(`❄️ 【寂殺】：視為對手能力下降與自身能力上升！`, "effect");
      // 邏輯在傷害計算時生效
    } else if (stacks >= 1) {
      addLog(`❄️ 【寂殺】：無視自身能力下降！`, "effect");
    }
  }

  // 凕：高傷害才減少60%；不能沿用5012的無條件冰魂減傷。
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const comp = extraData?.damageComp || extraData;
    if (comp?.isIncoming && !comp.pure && comp.damageCategory !== "true") {
      (comp.beforeFinalDamage ||= []).push(() => {
      if (comp.pure) return;
      const before = Math.max(0, comp.base * (1 + comp.increasePercent) * Math.max(0, 1 - comp.decreasePercent) * comp.multiplier - (comp.flatReduction || 0));
      if (before >= self.currentHp / 3) {
        multiplyDamageReduction(comp, 0.4);
        const after = Math.max(0, comp.base * (1 + comp.increasePercent) * Math.max(0, 1 - comp.decreasePercent) * comp.multiplier - (comp.flatReduction || 0));
        const points = Math.max(0, Math.floor(before) - Math.floor(after));
        if (points > 0) {
          const previous = context.getMarks(oppSide).find(m => m.id === 'frost_glow' && m.ownerBattleId === (target.battleId || target.id));
          context.setMark({ id: 'frost_glow', name: '霜寒幽光', displayChar: '霜', count: (previous?.count || 0) + points,
            ownerBattleId: target.battleId || target.id, persistsOffField: true,
            description: '受到固定／百分比傷害超過霜寒幽光點數10%時減半。',
            effects: { thresholdDamageReduction: { thresholdRatio: 0.1, multiplier: 0.5, damageTypes: ['fixed', 'percent'] } } }, oppSide);
        }
        addLog(`❄️ 【凕】：本次非真實傷害降低，附加${points}點霜寒幽光。`, 'effect');
      } else {
        comp.afterDamage = combineSettlementCallbacks(comp.afterDamage, receipt => {
          const amount = Math.floor(receipt.settledAmount * 0.6);
          if (amount <= 0) return;
          context.applyTrueDamage(oppSide, amount, '凕·低傷汲取', undefined, undefined, {
            onSettled: r => context.applyHeal(actor, r.settledAmount),
          });
        });
      }
      });
    }
  }

  // 3. 受到傷害後 (ON_DAMAGED)
  if (event === EffectTiming.ON_DAMAGED) {
    const { category, amount } = extraData;
    if (category === "真實傷害") {
      const stacks = Math.min(3, (getPlayerState("keldSoulStacks") || 0) + 1);
      setPlayerState("keldSoulStacks", stacks);
      addLog(`❄️ 【寂殺】：受到真實傷害，獲得 1 道寂殺之魄 (目前 ${stacks} 層)！`, "effect");
      
      const heal = amount * 2;
      self.currentHp = Math.min(self.maxHp, self.currentHp + heal);
      addLog(`❄️ 【冰】：汲取受傷 2 倍體力 (${heal})！`, "heal");
      
      // 致死真實傷害強制存活
      if (self.currentHp <= 0) {
        self.currentHp = 1;
        addLog(`❄️ 【冰】：受到致死真實傷害，強制存活並恢復 1 點體力！`, "effect");
      }
    }
  }

  // 4. 使用技能後 (AFTER_ACTION)
  if (event === EffectTiming.AFTER_ACTION) {
    const isAttack = extraData?.skill?.category === "物理" || extraData?.skill?.category === "特殊";
    if (isAttack) {
      const oppHasBuff = Object.values(target.statStages || {}).some(v => v > 0);
      if (oppHasBuff) {
        addLog(`❄️ 【冰】：對手處於能力提升，觸發 100% 冰封！`, "effect");
        applyStatusWithImmunityCheck(oppSide, "冰封", 1);
      } else {
        const currentBan = getOpponentState("frostBanAmount") || 0;
        setOpponentState("frostBanAmount", Math.min(200, currentBan + 200));
        addLog(`❄️ 【肅霜】：附加 200 點肅霜之禁！`, "effect");
      }
    }
  }

  // 5. 回合結束 (ROUND_END)
  if (event === EffectTiming.ROUND_END) {
    const reduction = getPlayerState("lastReducedDmg") || 0;
    const stacks = getPlayerState("keldSoulStacks") || 0;

    if (reduction > 0) {
      if (reduction <= 200) {
        const recoil = Math.floor(self.maxHp * 0.25);
        applyTrueDamage(actor, recoil, "冰(減傷過低反噬)", activeP1, activeP2);
        addLog(`❄️ 【冰】：減傷不高於 200，自身受到 25% 真實傷害！`, "damage");
      } else if (stacks > 0) {
        addLog(`❄️ 【冰】：減傷不低於 200 且擁有寂殺之魄，令對手凍傷！`, "effect");
        const success = applyStatusWithImmunityCheck(oppSide, "凍傷", 3);
        if (!success) {
          addLog(`❄️ 【冰】：未觸發凍傷，消除對手回合類效果且下 2 回合無法切換！`, "effect");
          clearTurnEffectsOf(oppSide, target);
          setOpponentState("lockSwitchTurns", 2);
        }
      }
    }

    // 肅霜之禁衰減
    const frostBan = getOpponentState("frostBanAmount") || 0;
    if (frostBan > 0) {
      const decay = 200 - (stacks * 50);
      setOpponentState("frostBanAmount", Math.max(0, frostBan - Math.max(0, decay)));
    }
    
    setPlayerState("lastReducedDmg", 0);
  }

  if (event === "ON_STATUS_ENDED") {
     const statusName = extraData?.status;
     if (statusName === "凍傷" || statusName === "frostbite" || statusName === "stagnation") {
        addLog(`❄️ 【王·蒼銀之棺】：凍傷或凝滯狀態解除，恢復自身所有體力！`, "heal");
        context.applyHeal(actor, self.maxHp);
     }
  }

  if (event === EffectTiming.ROUND_END) {
     const st = getPlayerState("stagnationTurns") || 0;
     if (st > 0) {
        if (st === 1) {
           addLog(`❄️ 【王·蒼銀之棺】：凝滯狀態結束，恢復自身所有體力！`, "heal");
           context.applyHeal(actor, self.maxHp);
        }
        setPlayerState("stagnationTurns", st - 1);
     }
  }

  return false;
};

export const KEERHODE_SKILLS: Record<string, BattleSkillHandler> = {
  "傲視千川": (ctx) => {
    ctx.addLog(`❄️ 使用【傲視千川】：全屬性提升！對手受傷翻倍且無法切換！`, "effect");
    ctx.setOpponentState("damageTakenBoostTurns", 2);
    ctx.setOpponentState("lockSwitchTurns", 2);
  },
  "凝寒止喧": (ctx) => {
    ctx.addLog(`❄️ 使用【凝寒止喧】：消除對手回合類效果，封印屬性技能！`, "effect");
    ctx.clearTurnEffectsOf(ctx.actor === "p1" ? "p2" : "p1", ctx.target);
    ctx.setOpponentState("sealPropertyTurns", 2);
  },
  "冰天花葬": (ctx) => {
    ctx.addLog(`❄️ 使用【冰天花葬】：5 回合免疫並反彈異常，吸取體力！`, "effect");
    ctx.setPlayerState("immuneAndReflectStatusTurns", 5);
    ctx.setPlayerState("drainHpTurns", 5);
  },
  "王·蒼銀之棺": (ctx) => {
    ctx.addLog(`❄️ 使用【王·蒼銀之棺】：雙方進入凝滯與凍傷狀態！`, "effect");
    ctx.setPlayerState("stagnationTurns", 3);
    ctx.setOpponentState("stagnationTurns", 3);
    ctx.applyStatusWithImmunityCheck(ctx.actor, "凍傷", 3);
    ctx.applyStatusWithImmunityCheck(ctx.actor === "p1" ? "p2" : "p1", "凍傷", 3);
  },
  "王·霜祲霞罰": (ctx) => {
    ctx.addLog(`❄️ 使用【王·霜祲霞罰】：無視護盾並反轉自身能力下降！`, "effect");
    ctx.setPlayerState("ignoreShield", true);
  }
};

export { KeerhodeDeconstructedProfile } from "../data/elfProfiles/keerhodeRegistry";
