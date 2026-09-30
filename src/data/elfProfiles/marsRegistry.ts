import type { ElfDeconstructedProfile } from "../../effects/types";

export const MarsDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'mars_reform',
  name: '變革·馬爾修斯',
  soulMark: {
    mech: {
      id: 'mark.mars_reform',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '械',
        description: '自身擁有堅壁、極速、毀滅三種機甲於在場期間協助自身戰鬥，不在場期間協助己方進行戰鬥，戰鬥開始時令自身技能中的PP值改為充能值且戰鬥中始終視為PP值為滿且為可選狀態(boss有效)\n\n登場時啟動堅壁機甲並與極速機甲組合，之後每次選擇使用第五技能時則吸取對手最大體力的⅓，若與極速機甲組合時則於使用技能後切換成與毀滅機甲進行組合，若與毀滅機甲組合時則於使用技能後切換成與極速機甲進行組合進行戰鬥(吸取體力效果boss無效，其餘Boss有效)\n\n戰鬥階段結束時，若自身本回合未選擇第五技能或第五技能無效，則下回合使用攻擊技能時消耗該技能所有充能值並汲取對手等同於15倍消耗值的體力值且當回合攻擊技能造成傷害提升150%(boss有效)\n\n堅壁機甲:己方馬爾修斯在場期間令其每回合首次受到異常狀態時解析、開始免疫並記錄該異常狀態直到戰鬥結束時；回合開始時附加等同於自身最大體力⅓的護盾與護罩且護盾與護罩存在時自身首次受到的非真實傷害減半1次；回合結束時恢復自身最大體力的⅓並附加對手等量百分比傷害，若護盾護罩消失時則額外提前觸發1次(回合結束時可再次觸發)；馬爾修斯不在場期間己方在場精靈免疫所有己解析並記錄的異常狀態，每回合結束時每存在1種異常紀錄則為馬爾修斯恢復1點充能值(下場後保留，堅壁機甲效果boss有效)\n\n極速機甲:己方馬爾修斯在場期間令其回合開始效果額外附加使用所有技能時先制額外+2(同時令己方變為被挑戰方)；先出手時攻擊傷害結算前使對手全屬性-1，馬爾修斯處於速度能力提升狀態時效果翻倍；後出手則下2回合對手先制效果失效且執行附加控制類異常效果時令堅壁機甲紀錄該異常；己方馬爾修斯不在場期間若對手先制等級高於己方在場精靈，則當回合結束時恢復自身技能1到5位中末位充能低於原PP值上限的技能至充能等於PP值上限且令對手下回合正先制效果失效(下場後保留)\n\n毀滅機甲:馬爾修斯在場期間令其所有攻擊技能威力提升100%，每次使用額外提升10%，最高170%；每次出手後若對手體力低於30%則消耗對手所有體力與該技能1點充能值以提升自身所有能力值30%；每次出手後若對手體力高於30%則消耗該技能1點充能值以附加對手最大體力30%的百分比傷害並恢復自身等量體力；己方馬爾修斯不在場期間若對方對敵我雙方任一方在場精靈執行消耗體力的效果，則消耗馬爾修斯隨機其中1個技能令本次消耗體力效果降低15%(下場後保留)\n\n（除變身特效與標註效果以外的所有效果boss無效）\n充能值:戰鬥開始時PP值等量充能值，此後充能值數量無視PP值上限，最低為0',
        combatLog: '⚙️ 變革·馬爾修斯啟動堅壁、極速、毀滅三大機甲！解析免疫一切異常！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        energySystem: true,
        mechaModes: ['堅壁', '極速', '毀滅'],
        analyzeAndImmuneStatus: true,
        shieldRatio: 0.33,
        priorityBonus: 2
      }
    }
  },
  skills: {
    '革新已至': [
      {
        id: 'mars.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '革新已至特效',
          description: '先制+3；無視對手免疫攻擊效果；無效對手下次攻擊技能；吸取對手能力提升狀態，吸取成功則下2回合對手受到攻擊時必定為致命一擊；吸取對手當前體力1/4，PP值為滿時吸取效果翻倍'
        },
        mechanics: { priority: 3, ignoreImmuneAttack: true, absorbBuffs: true, absorbHpRatio: 0.25 }
      }
    ],
    '源生壁壘': [
      {
        id: 'mars.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '源生壁壘特效',
          description: '此技能PP值為滿時當回合先制+3；3回合內自身使用技能對手每回合速度-2、命中-2，未觸發則2回合內對手無法主動切換精靈；4回合內對手每次使用攻擊技能時吸取對手最大體力1/3；4回合內對手使用攻擊技能時100%使對手癱瘓；抵擋下1次攻擊，抵擋成功則附加對手等量真實傷害並恢復自身等量體力'
        },
        mechanics: { priority: 0, debuffOnUseTurns: 3, drainOnOpponentAttackTurns: 4, paralyzeOnOpponentAttackTurns: 4, blockNextAttack: true }
      }
    ],
    '核心重構': [
      {
        id: 'mars.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '核心重構特效',
          description: '必中；解除自身異常狀態，解除成功則令堅壁機甲解析並記錄此異常狀態；5回合內自身使用技能恢復自身體力1/3並附加對手等量百分比傷害，自身體力低於1/2時效果翻倍；5回合內自身使用技能吸取對手350點固定體力，對手受到固定傷害後體力未減少則附加300點真實傷害；3回合內若對手使用攻擊技能則100%令對手隨機2個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身技能補充等量充能'
        },
        mechanics: { priority: 0, alwaysHit: true, clearStatusAndAnalyze: true, healAndDamageTurns: 5, healRatio: 0.33, absorbFixedHpTurns: 5, absorbFixedHp: 350 }
      }
    ],
    '王·肅正協議': [
      {
        id: 'mars.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·肅正協議特效',
          description: '必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；2回合內對手屬性技能附加效果失效且攻擊技能PP值消耗量提升20倍；造成技能傷害提升70%，每次使用則本次造成技能傷害額外提升35%，此技能PP值為滿時效果翻倍，最高170%，處於與毀滅機甲組合時上限變為300%；技能無效時，消除對手回合類效果，100%令對手癱瘓'
        },
        mechanics: { priority: 1, alwaysHit: true, kingPrivilegeNoWeak: true, sealStatusTurns: 2, increasePpCostTurns: 2, damageBoost: 0.7 }
      }
    ],
    '王·超限共頻': [
      {
        id: 'mars.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·超限共頻特效',
          description: '必中；此技能PP值為滿時無視自身能力下降狀態；消除雙方回合類效果，消除成功則令對手燒傷、麻痺、疲憊，任一種異常未觸發則令對手隨機1個技能PP值不為0的技能歸0並將降低的PP值總和轉變為自身充能未滿的技能等量充能；消除雙方能力上升、下降狀態、護盾與護罩，消除任意一項則吸取對手等同於對手最大體力70%的百分比傷害；3回合內對手體力恢復量下降100%；特攻+1、防禦+1、特防+1、速度+1、命中+1，自身技能中存在充能時效果翻倍，若存在技能中充能為0的技能則補充所有技能5點充能；5回合內免疫並反彈所有異常状态'
        },
        mechanics: { priority: 3, alwaysHit: true, isFifthSkill: true, clearAllTurnEffects: true, inflictMultipleStatus: ['燒傷', '麻痺', '疲憊'], clearAllStats: true, statUp: { spatk: 1, def: 1, spdef: 1, speed: 1, accuracy: 1 }, immuneAndReflectStatusTurns: 5 }
      }
    ]
  }
};

