import type { ElfDeconstructedProfile } from "../../effects/types";

export const ChaosBlakeDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'chaos_blake',
  name: '混沌·布萊克',
  soulMark: {
    night: {
      id: 'mark.chaos_blake',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',      flavor: {
        name: '夜',
        description: '自身所有異常狀態免疫類效果始終無法免疫狂暴且狂暴無法被轉化為其他異常狀態；自身能力提升狀態被消除或吸取時，100%使對手害怕，未觸發則將自身受到的下1次異常狀態轉化為3回合的狂暴狀態；自身處於狂暴狀態時所有技能先制+1；對手使用屬性技能則自身免疫下1次受到的異常狀態且自身下1次攻擊技能無視對手傷害限制、傷害免疫、攻擊免疫效果；對手使用攻擊技能則自身有100%的機率閃避對手攻擊，若該效果觸發則下2次攻擊技能先制+2且造成的傷害提升50%，若該效果未觸發則回合結束時附加自身攻擊值50%的百分比傷害並回復等量體力值；自身死亡時100%的機率會殘留1點體力，同時回合結束時解除自身異常狀態，消除對手回合類效果並100%令對手詛咒，吸取對手最大體力1/3，使自身進入3回合的狂暴狀態(每場戰鬥最多觸發1次)',
        combatLog: '🌑 混沌·布萊克開啟【夜】之魂印！狂暴與閃避反擊的極限交鋒！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        cannotImmuneRage: true,
        fearOnBuffClear: true,
        ragePriorityBonus: 1,
        dodgeAttackChance: 1.0,
        reviveOnFatalOnce: true
      }
    }
  },
  skills: {
    '蒼茫幽魂舞': [
      {
        id: 'chaos_blake.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '蒼茫幽魂舞特效',
          description: '先制+1；先出手時對手當回合屬性技能無效；命中後使對手隨機的1個技能的PP值歸零；命中後100%使對手害怕，未觸發則使自身進入狂暴狀態；附加自身攻擊值30%的百分比傷害並恢復等量體力，若對手免疫百分比傷害，則附加等量真實傷害'
        },
        mechanics: { priority: 1, sealStatusIfFirst: true, ppZeroRandom: true, inflictFear: true, enterRageOnMiss: true, hpDamageRatio: 0.3 }
      }
    ],
    '狂影逆命沖': [
      {
        id: 'chaos_blake.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '狂影逆命沖特效',
          description: '使對手隨機的1個技能的PP值歸零；60%令對手害怕，每次使用概率增加10%，最高概率100%'
        },
        mechanics: { priority: 0, ppZeroRandom: true, inflictFearChance: 0.6 }
      }
    ],
    '孑然孤夢': [
      {
        id: 'chaos_blake.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '孑然孤夢特效',
          description: '必中；全屬性+1，對手處於異常狀態時強化狀態翻倍；4回合內吸取對手最大體力的1/3，自身體力低於1/2時吸取效果翻倍；若對手免疫百分比傷害，則附加250點真實傷害；下2回合打出致命一擊則吸取對手350點體力；下2回合自身所有技能先制+2且攻擊必定致命'
        },
        mechanics: { priority: 0, alwaysHit: true, allStatUp: 1, drainHpTurns: 4, drainHpRatio: 0.33, nextPriorityTurns: 2, priorityBonus: 2, nextCritTurns: 2 }
      }
    ],
    '暗耀明滅': [
      {
        id: 'chaos_blake.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '暗耀明滅特效',
          description: '必中；5回合內免疫並反彈除狂暴外所有受到的異常狀態；3回合內，對手使用攻擊技能則自身全屬性+1且對手兩回合內屬性技能無效；3回合內，對手使用屬性技能則對手全屬性-1且2回合內攻擊技能無法造成技能傷害且附加效果失效；3回合內若自身回合類效果被消除則吸取對手最大體力的1/3'
        },
        mechanics: { priority: 0, alwaysHit: true, immuneAndReflectExceptRageTurns: 5, buffOnOpponentAttackTurns: 3, debuffOnOpponentStatusTurns: 3 }
      }
    ],
    '夜·冥昭瞢闇': [
      {
        id: 'chaos_blake.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '夜·冥昭瞢闇特效',
          description: '必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則自身無效對方下1次攻擊技能；造成的傷害低於300則附加自身攻擊力與最大體力總和25%的百分比傷害，自身處於狂暴狀態則改為附加真實傷害；造成的傷害高於300則對手100%詛咒；擊敗對手則下回合開始使自身進入3回合狂暴狀態'
        },
        mechanics: { priority: 0, alwaysHit: true, isFifthSkill: true, kingPrivilegeNoWeak: true, clearOpponentTurnEffects: true, enterRageOnKillTurns: 3 }
      }
    ],
    '夜洛烏澤': [
      {
        id: 'chaos_blake.skill6.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '夜洛烏澤特效',
          description: '先制+3；必中；吸取對手能力提升狀態，吸取成功則自身下1回合必定先出手；將自身能力下降狀態反饋給對手，反饋成功則對手詛咒；出手時體力低於1/3時威力3倍'
        },
        mechanics: { priority: 3, alwaysHit: true, stealOpponentBuffs: true, nextTurnFirstIfStolen: true, reflectSelfDebuffs: true, curseOnReflect: true, triplePowerWhenHpLow: true }
      }
    ]
  }
};

