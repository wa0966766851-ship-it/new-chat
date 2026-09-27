import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

export const handleCanglanSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.ON_ENTRANCE: {
      addLog(`🌊 【瀾】：海神降臨，潮汐護佑！`, "effect");
      const oppShield = ctx.target ? (ctx.target.shield || 0) : 0;
      const selfShield = self.shield || 0;
      let totalShieldToAdd = 600;
      if (oppShield > 0 || selfShield > 0) {
        totalShieldToAdd += (oppShield + selfShield);
      }
      self.shield = (self.shield || 0) + totalShieldToAdd;
      setPlayerState("shieldAmount", self.shield);
      if (ctx.updateElf) ctx.updateElf(actor, { id: self.id, shield: self.shield });
      addLog(`🌊 【瀾】：獲得 ${totalShieldToAdd} 點水幕護盾！`, "effect");
      break;
    }

    case EffectTiming.BEFORE_DAMAGE:
      // 自身受到技能傷害減半
      if (extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        extraData.multiplier *= 0.5;
        addLog(`🌊 【瀾】：水幕屏障，傷害減半！`, "effect");
      }
      break;

    case EffectTiming.AFTER_DAMAGE:
      // 每次受到技能傷害後恢復自身最大體力 1/3 並使自身抵擋下次受到的技能傷害
      if (extraData?.isIncoming && extraData?.damageType === "skill_attack") {
        applyHeal(actor, Math.floor(self.maxHp / 3));
        setPlayerState("evasionActive", true);
        addLog(`🌊 【瀾】：潮汐復甦，並準備抵擋下次攻擊！`, "heal");
      }
      break;
  }

  return false;
};

export const CANGLAN_SKILLS: Record<string, BattleSkillHandler> = {
  "滄海永存": (ctx) => {
    const { addLog, applyHeal, setPlayerState, self, actor } = ctx;
    addLog(`🌊 【滄海永存】：海納百川，生生不息！`, "effect");
    applyHeal(actor, self.maxHp);
    self.shield = (self.shield || 0) + 400;
    setPlayerState("shieldAmount", (ctx.getPlayerState("shieldAmount") || 0) + 400);
    if (ctx.updateElf) ctx.updateElf(actor, { id: self.id, shield: self.shield });
    addLog(`🛡️ 【滄海永存】：獲得 400 點水流護盾！`, "effect");
  },
  "弱水三千": (ctx) => {
    const { addLog, clearTurnEffectsOf } = ctx;
    addLog(`🌊 【弱水三千】：弱水環繞，封印屬性！`, "effect");
    clearTurnEffectsOf(ctx.targetSide);
  },
  "永恆誓約": (ctx) => {
    const { addLog, self, actor, updateElf } = ctx;
    addLog(`🌊 【永恆誓約】：永恆屏障，誓約守護！`, "effect");
    self.shield = (self.shield || 0) + 500;
    if (updateElf) updateElf(actor, { id: self.id, shield: self.shield });
    addLog(`🛡️ 【永恆誓約】：獲得 500 點誓約護盾！`, "effect");
  },
  "王·洛浦凌波": (ctx) => {
    const { addLog, self, target, actor, updateElf } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const selfShield = self.shield || 0;
    const selfBarrier = self.barrier || 0;
    const oppShield = target ? (target.shield || 0) : 0;
    const oppBarrier = target ? (target.barrier || 0) : 0;
    const totalConsumed = selfShield + selfBarrier + oppShield + oppBarrier;

    if (totalConsumed > 0) {
      self.shield = 0;
      self.barrier = 0;
      if (target) {
        target.shield = 0;
        target.barrier = 0;
      }
      if (updateElf) {
        updateElf(actor, { id: self.id, shield: 0, barrier: 0 });
        if (target) updateElf(oppSide, { id: target.id, shield: 0, barrier: 0 });
      }
      addLog(`🌊 【王·洛浦凌波】：消耗雙方全部護盾與護罩 (${totalConsumed} 點)！令對手下次技能無效！`, "effect");
    }
  },
  "王·深海之吻": (ctx) => {
    const { addLog, self, target, actor, updateElf, applyPinkDamage } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const pct = 0.40;
    const baseDmg = Math.floor(self.maxHp * pct);
    const shieldGain = baseDmg;
    self.shield = (self.shield || 0) + shieldGain;
    if (updateElf) updateElf(actor, { id: self.id, shield: self.shield });

    const dealt = applyPinkDamage(oppSide, baseDmg, "王·深海之吻百分比傷害", ctx.activeP1, ctx.activeP2, "percent");
    addLog(`💋 【王·深海之吻】：附加 ${dealt} 點百分比傷害，並為自身附加 ${shieldGain} 點深海護盾！`, "effect");
  }
};

export const CanglanDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'canglan',
  name: '怒濤·滄嵐',
  soulMark: {
    canglan_soul: {
      id: 'mark.canglan_soul',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '瀾',
        description: '登場時為自身附加600點護盾，若登場前場上精靈存在護盾則額外複製雙方護盾總和並附加給自身；回合開始時場上精靈中存在擁有護盾者則當回合自身所有技能先制+1且雙方每存在100點護盾則直到下回合結束時每次受到固定傷害、百分比傷害額外減半一次且減半後傷害無法超過護盾值的1/3；雙方護盾值每次發生變化時，每達到100則附加給1道對手千秋一淚；自身使用攻擊技能時附加給自身1道永恆之水，若場上存在擁有護盾者則額外附加給自身1道永恆之水，場上存在不擁有護盾者則自身使用技能不受PP值限制、不消耗技能PP值且當回合技能使用後附加給對手1道千秋一淚；自身受到技能傷害減半，且每次受到技能傷害後恢復自身最大體力1/3並使自身抵擋下次受到的技能傷害；回合結束時若自身未受到技能傷害則吸取對手最大體力1/3且下回合開始時解除自身所處的異常狀態；'
      },
      mechanics: {
        baseShield: 600,
        copyShieldSumOnSwitchIn: true,
        priorityBonusOnShield: 1,
        shieldDamageHalvingPer100: true,
        statusOnShieldChange: '千秋一淚',
        waterOnAttack: 1,
        waterOnAttackWithShield: 1,
        unlimitedPpOnNoShield: true,
        tearOnNoShield: 1,
        halveSkillDamage: true,
        recoverHpOnSkillDamage: 0.33,
        blockNextSkillDmgOnDamage: true,
        absorbHpOnNoDamage: 0.33,
        cureStatusOnNoDamage: true
      }
    }
  },
  skills: {
    '滄海永存': [
      {
        id: '滄海永存.onhit',
        effectClass: 'ON_HIT',
        flavor: {
          name: '滄海永存',
          description: '必中；命中後80%使對手冰封，未觸發則下2回合攻擊有100%機率使對手束縛；恢復自身最大體力的1/1，自身體力低於1/2時造成等量百分比傷害；使自身獲得一個可以吸收400點傷害的護盾（相同來源不可疊加），護盾消失時對對手造成400點固定傷害且有100%的機率使對手束縛'
        },
        mechanics: {
          alwaysHit: true,
          freezeChance: 0.8,
          bindChanceOnFail: 1.0,
          bindTurnsOnFail: 2,
          healPercent: 1.0,
          conditionalPercentDamageOnLowHp: true,
          shieldAmount: 400,
          shieldExpireDamage: 400,
          shieldExpireBindChance: 1.0
        }
      }
    ],
    '弱水三千': [
      {
        id: '弱水三千.onhit',
        effectClass: 'ON_HIT',
        flavor: {
          name: '弱水三千',
          description: '先制+3；必中；吸取並反轉對手能力提升狀態；令對手全屬性-1，未觸發則令對手冰封；附加等同於對方最大體力值40%百分比傷害並恢復自身體力，自身體力低於最大體力1/2時效果翻倍；3回合內對手屬性技能無效'
        },
        mechanics: {
          priority: 3,
          alwaysHit: true,
          stealAndReverseBuffs: true,
          debuffAll: 1,
          freezeOnDebuffFail: true,
          percentDamage: 0.4,
          percentDamageDoubleOnLowHp: true,
          sealUtilitySkillsDuration: 3
        }
      }
    ],
    '永恆誓約': [
      {
        id: '永恆誓約.onhit',
        effectClass: 'ON_HIT',
        flavor: {
          name: '永恆誓約',
          description: '必中；令自身特攻、防禦、特防、速度、命中+1，擁有護盾時強化效果翻倍；5回合內免疫並反彈所有異常狀態，技能無效時改為使自身免疫並反彈下2次異常狀態；下2回合攻擊傷害提升150%，技能無效時改為抵擋下次攻擊並附加500點護盾；獲得1道永恆之水，若對手千秋一淚滴數高於自身永恆之水時額外獲得等同於差值的永恆之水，若道數為滿則令對手束縛，技能無效時獲得永恆之水道數翻倍且令對手進入束縛效果取消觸發條件；下2回合自身所有技能先制+3，技能無效時改為自身下回合無視對手正先制效果'
        },
        mechanics: {
          alwaysHit: true,
          spatkUp: 1,
          defUp: 1,
          spdefUp: 1,
          speedUp: 1,
          accuracyUp: 1,
          doubleStatUpOnShield: true,
          statusImmunityAndReflectionDuration: 5,
          statusImmunityAndReflectionOnFailCount: 2,
          damageBoostDuration: 2,
          damageBoostPercent: 150,
          damageBlockOnFail: true,
          shieldOnFail: 500,
          waterGain: 1,
          waterMatchTear: true,
          bindOnMaxWater: true,
          waterDoubleOnFail: true,
          bindOnFail: true,
          priorityBonusDuration: 2,
          priorityBonus: 3,
          ignorePositivePriorityOnFail: true
        }
      }
    ],
    '王·洛浦凌波': [
      {
        id: '王·洛浦凌波.onhit',
        effectClass: 'ON_HIT',
        flavor: {
          name: '王·洛浦凌波',
          description: '必中；若自身處於能力下降狀態時先制+3；將自身能力下降狀態視為同等級能力提升狀態；反轉自身能力下降狀態，反轉成功則附加給對手等量能力下降狀態；消耗敵我雙方全部護盾與護罩以令對手下次技能無效，每消耗1點則本次技能威力提升1點，並附加對手等同於雙方消耗量70%的百分比傷害'
        },
        mechanics: {
          alwaysHit: true,
          priorityBonusOnDebuff: 3,
          treatDebuffsAsBuffs: true,
          reverseDebuffsAndApplyToOpponent: true,
          consumeAllShields: true,
          negateNextSkillOnShieldConsume: true,
          powerBonusPerShieldConsumed: 1,
          percentDamagePercentOfShieldConsumed: 0.70
        }
      }
    ],
    '王·深海之吻': [
      {
        id: '王·深海之吻.onhit',
        effectClass: 'ON_HIT',
        flavor: {
          name: '王·深海之吻',
          description: '必中；攻擊時造成的傷害不會出現微弱(克制關係為微弱時轉變為普通)；無視對手傷害限制效果；無視對手攻擊免疫效果；消除對手回合類效果，消除成功100%令對手束縛、凍傷、冰封，若均觸發或任意一項未觸發、對手不存在回合類效果或回合類效果無法消除時令自身免疫下2次異常狀態；將對手所處的異常狀態轉化為冰封，若對手不處於異常狀態則改為100%令對手冰封；附加對手自身最大體力值40%的百分比傷害並附加自身等量護盾(可疊加)，自身存在永恆之水時比例改為60%且額外恢復自身等量體力，對手存在千秋一淚時則吸取前額外汲取對手等同於自身最大體力 25% 的體力'
        },
        mechanics: {
          alwaysHit: true,
          noWeakMatchup: true,
          ignoreDamageLimits: true,
          ignoreAttackImmunity: true,
          clearTurnEffects: true,
          statusOnClearSuccess: ['束縛', '凍傷', '冰封'],
          statusImmunityOnClearFailCount: 2,
          convertAllStatusToFreeze: true,
          freezeIfNoStatus: true,
          percentDamageBase: 0.40,
          shieldFromPercentDamage: true,
          percentDamageWithWater: 0.60,
          healFromPercentDamageWithWater: true,
          drainHpWithTear: true,
          extraDrainHpPercent: 0.25,
          isFifthSkill: true
        }
      }
    ]
  }
};
