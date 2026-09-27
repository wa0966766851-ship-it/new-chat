import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { turnEffect } from "../battle/timers";

export const handleKeldSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.BEFORE_DAMAGE:
      // 自身受到的非真實傷害額外減少 60%
      if (extraData?.isIncoming && extraData?.damageCategory !== "true") {
        const reduced = Math.floor(extraData.base * 0.6);
        extraData.multiplier *= 0.4;
        
        if (reduced < 200) {
          // 戰鬥階段結束時自身受到 25% 的真實傷害 (這裡暫記標記)
          setPlayerState("keldBacklash", true);
        } else {
          // 若不低於 200 點且自身擁有寂殺之魄則令對手凍傷 3 回合
          const souls = getPlayerState("keldSoulStacks") || 0;
          if (souls > 0) {
            ctx.applyStatusWithImmunityCheck(oppSide, "凍傷", 3);
          }
        }
      }
      break;

    case EffectTiming.AFTER_DAMAGE:
      // 自身受到真實傷害時獲得 1 道寂殺之魄
      if (extraData?.isIncoming && extraData?.damageType === "true") {
        const souls = Math.min(3, (getPlayerState("keldSoulStacks") || 0) + 1);
        setPlayerState("keldSoulStacks", souls);
        ctx.setMark({
          id: "keld_soul",
          displayChar: "魄",
          count: souls,
          name: "寂殺之魄",
          description: "異常狀態時無視對手不高於層數的先制（異常時3倍），最高3層下場保留。",
          source: "冰魄·柯爾德 / 冰"
        });
        addLog(`❄️ 【冰】：魂魄凝聚，寂殺之魄提升至 ${souls} 層！`, "effect");
      }
      break;

    case EffectTiming.ROUND_END:
      if (getPlayerState("keldBacklash")) {
        const backlashDmg = Math.floor(self.maxHp * 0.25);
        applyTrueDamage(actor, backlashDmg, "冰魄反噬");
        setPlayerState("keldBacklash", false);
      }
      break;

    case EffectTiming.FATAL_RESIST:
      if (extraData?.damageType === "true") {
        self.currentHp = 1;
        addLog(`❄️ 【冰】：受到致死真實傷害，強制存活恢復1點體力！`, "effect");
        return true;
      }
      return false;
  }

  return false;
};

export const KELD_SKILLS: Record<string, BattleSkillHandler> = {
  "傲視千川": (ctx) => {
    const { actor, addLog, applyStatChange } = ctx;
    addLog(`❄️ 【傲視千川】：寒氣凌人，凍結虛空！`, "effect");
    applyStatChange(actor, { atk: 1, def: 1, spatk: 1, spdef: 1, speed: 1, accuracy: 1 });
    
    // Migrate to Timer system
    const oppSide = actor === "p1" ? "p2" : "p1";
    ctx.addTimerTo(oppSide, turnEffect("keld_lock_switch", "傲視千川-封換", 2, {
      displayChar: "封",
      description: "下 2 回合無法主動切換精靈",
      payload: { lockSwitch: true }
    }), ctx.goesFirst === false);
    addLog(`❄️ 【傲視千川】：對手下 2 回合無法主動切換精靈！`, "effect");
  },
  "凝寒止喧": (ctx) => {
    const { addLog, clearTurnEffectsOf } = ctx;
    addLog(`❄️ 【凝寒止喧】：萬物肅靜，冰封一切！`, "effect");
    clearTurnEffectsOf(ctx.targetSide);
  }
};

export const KeldDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'ice_king_keld',
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
        trigger: 'BATTLE_START',
        damageReduction: 0.6,
        maxSoulStacks: 3,
        frostBanLimit: 200,
        ignoreOpponentBuffs: true,
        reviveOnFatalTrueDamage: true
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
