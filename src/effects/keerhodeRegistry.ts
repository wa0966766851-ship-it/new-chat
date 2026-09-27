import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from "./types";
import { isStatusActive } from "../utils/statusManager";
import { isAbnormal as isAbnormalHelper } from "../utils/battleHelpers";

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

  // 2. 傷害減免與肅霜之禁 (BEFORE_DAMAGE)
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const isIncoming = extraData?.isIncoming;
    
    // 肅霜之禁：限制對手傷害
    if (isIncoming) {
      const frostBan = getOpponentState("frostBanAmount") || 0;
      if (frostBan > 0 && extraData.base > frostBan) {
        addLog(`❄️ 【肅霜】：對手造成的傷害無法超過肅霜之禁的點數 (${frostBan})！`, "effect");
        extraData.limit = Math.min(extraData.limit || Infinity, frostBan);
      }

      if (extraData.damageCategory !== "true") {
        const reduction = Math.floor(extraData.base * 0.6);
        extraData.decreasePercent += 0.6;
        setPlayerState("lastReducedDmg", reduction);
        addLog(`❄️ 【冰】：常駐減傷 60% (減少了 ${reduction} 點)！`, "effect");
      }
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

export const KeerhodeDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'keerhode',
  name: '冰魄·柯爾德',
  soulMark: {
    ice: {
      id: 'mark.ice_king',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '冰',
        description: '常駐效果：自身受到的非真實傷害額外減少60%，若以此法減少的傷害值不高於200點則戰鬥階段結束時自身受到25%的真實傷害；若不低於200點且自身擁有寂殺之魄則令對手凍傷3回合，未觸發則消除對手回合類效果且下2回合對手無法主動切換精靈；自身受到真實傷害時獲得1道寂殺之魄，汲取對手受到傷害值2倍的體力值；受到致死真實傷害時自身強制存活並恢復自身1點體力；自身無視對手的能力提升效果，若存在1道寂殺之魄額外無視自身能力下降，存在2道改為視為對手能力下降與自身能力上升並觸發對應效果，存在3道攻擊時無視對手傷害限制、免疫攻擊且對手1回合內回血下降100%；自身使用攻擊技能後：若對手處於能力提升狀態100%令對手冰封，未觸發附加200點肅霜之禁。寂殺之魄：異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留；肅霜之禁：造成的技能傷害無法超過點數，觸發或主動下場減少200點，對手每有寂殺之魄減少效果下降50點，最高200點（boss無效）。',
        combatLog: '❄️ 冰魄·柯爾德展開極寒領域！寒氣凝聚成【寂殺之魄】與【肅霜之禁】！'
      },
      mechanics: {
        trigger: 'ON_DAMAGE_TAKEN',
        damageReduction: 0.6,
        nightStacksMax: 3
      }
    }
  },
  skills: {
    '傲視千川': [
      {
        id: 'keld.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '傲視千川特效',
          description: '必中；全屬性+1，對手處於冰封狀態時強化效果翻倍；下2回合對手受到的傷害提高100%；下2回合自身所有技能先制+2；下2回合對手無法主動切換精靈'
        },
        mechanics: { priority: 0, alwaysHit: true, allStatUp: 1, damageTakenBonusTurns: 2, damageTakenBonus: 1.0, nextPriorityTurns: 2, priorityBonus: 2, lockSwitchTurns: 2 }
      }
    ],
    '凝寒止喧': [
      {
        id: 'keld.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '凝寒止喧特效',
          description: '先制+3；自身處於能力下降時先制+1（總先制+4）；消除對手回合類效果，消除成功則2回合內令對手使用的屬性技能無效；連續攻擊對手90次，對手每有50點肅霜之禁則額外攻擊10次，自身處於能力提升/下降狀態時效果翻倍；技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效'
        },
        mechanics: { priority: 3, clearOpponentTurnEffects: true, sealStatusTurns: 2, multiHit: 90, inflictFreezeOnMiss: true }
      }
    ],
    '冰天花葬': [
      {
        id: 'keld.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '冰天花葬特效',
          description: '必中；5回合內免疫並反彈所有受到的異常狀態；100%使對手冰封，未觸發則對手雙防+1；附加給對手並解除自身所處的異常狀態，解除成功令對手2回合內對手攻擊技能附加效果失效；5回合內每回合吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手體力未減少則附加雙方150點真實傷害與2回合凍傷；為對手附加自身攻擊值15%的肅霜之禁'
        },
        mechanics: { priority: 0, alwaysHit: true, immuneAndReflectStatusTurns: 5, inflictFreeze: true, drainHpTurns: 5, drainHpRatio: 0.33 }
      }
    ],
    '王·蒼銀之棺': [
      {
        id: 'keld.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·蒼銀之棺特效',
          description: '必中；無視自身負先制等級；消除敵我雙方回合類效果並同時進入3回合凝滯，自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力；敵我雙方同時進入3回合凍傷，自身凍傷狀態解除或是結束時則恢復自身所有技能PP值；若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效'
        },
        mechanics: { priority: 0, alwaysHit: true, clearAllTurnEffects: true, inflictStagnationTurns: 3, inflictFrostbiteTurns: 3 }
      }
    ],
    '王·霜祲霞罰': [
      {
        id: 'keld.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·霜祲霞罰特效',
          description: '必中；無視對手護盾效果；若自身處於能力下降狀態則先制+3；【精靈王特權】攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；反轉自身能力下降狀態，反轉成功則免疫下1次受到的異常狀態；附加自身最大體力40%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/2則恢復效果和百分比傷害翻倍'
        },
        mechanics: { priority: 0, alwaysHit: true, isFifthSkill: true, ignoreShield: true, kingPrivilegeNoWeak: true, reverseDebuff: true, hpDamageRatio: 0.4, healRatio: 0.4 }
      }
    ]
  }
};
