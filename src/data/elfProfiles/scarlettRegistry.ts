import type { ElfDeconstructedProfile } from "../../effects/types";

export const ScarlettDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'holy_light_scarlett',
  name: '聖光斯嘉麗',
  soulMark: {
    can: {
      id: 'mark.holy_light_scarlett',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '燦',
        description: '燦: 戰鬥開始時，珀妮作為額外精靈加入己方與斯嘉麗共同作戰；自身每次受到非真實傷害降低至原始傷害的⅓，每次降低成功則令己方附加1層燦界聖芒，同時恢復最大體力1/3於當回合結束時造成對手等同於恢復量的百分比傷害，之後自身下場後，則1回合內令己方下隻出戰精靈登場前1回合獲得上述降低傷害效果與回合結束時恢復效果，每有1層燦界聖芒則延長1回合；自身使用技能時令自身特攻、速度+2、命中+1並附加對手特防、速度-2、命中-1，對手使用技能時令對手雙攻、速度-2、命中-1並附加自身雙防、速度、命中+1，前述效果執行時若雙方能力等級變化不高於10則2回合內自身攻擊技能計算傷害時以弱點傷害計算並附加對手星贖1回合，已存在星贖則改為回合數+1。(珀妮:光系額外精靈，所有能力值均為斯嘉麗⅓，己方在場精靈每次受到麻痺時後將當前所處異常狀態轉化為星贖且當回合直到戰鬥階段結束前回合類效果無法被消除；斯嘉麗在場期間每次出手流程結束後(含斯嘉麗選擇技能因故未能出手)進行一次額外行動造成對方等同於最大體力⅓的光系傷害且100%令對手失明，未觸發失明或對手已處於失明則消除對手回合類效果且令斯嘉麗下2次造成的攻擊傷害提升150%；己方斯嘉麗死亡4回合後在背包內重生，己方每有1層燦界聖芒則重生所需回合降低1回合。燦界聖芒:己方在場精靈每次受到失明後將當前所處異常狀態轉化為星贖且直到戰鬥階段結束前能力上升狀態無法被消除；己方戰鬥階段結束時敵我雙方每有1回合星贖則己方在場精靈控制類異常狀態的回合數降低燦界聖芒層數2倍，異常回合數最高降至1回合；對方技能戰鬥階段結束時敵我雙方每有1回合星贖降低對手等同於燦界聖芒層數所有技能等量技能PP值，最多降低至1點PP值，若對手被降低後PP值不大於1時額外令對手PP值該技能PP值上限歸1(上限3層，下場後保留)。弱點傷害:計算傷害以對手當前雙防值中較低者的60%作為對手的防禦值或特防值計算)',
        combatLog: '✨ 聖光斯嘉麗與摯友珀妮攜手降臨！聖靈之芒照耀宇宙，開啟燦界聖芒！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        damageReductionToThird: true,
        healRatio: 0.33,
        summonPuniPartner: true,
        statBoostOnUse: true,
        statDebuffOnOpponentUse: true,
        weaknessDamageCalculation: true
      }
    }
  },
  skills: {
    '純白聖翎': [
      {
        id: 'scarlett.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '純白聖翎特效',
          description: '先制+3；消除對手能力提升狀態，消除成功則令對手所有攻擊技能PP值歸0；3回合內對手屬性技能無效且使用後令該技能PP值歸0；技能無效時恢復自身最大體力½且下次受到異常狀態時轉化為星贖'
        },
        mechanics: { priority: 3, clearOpponentBuffs: true, ppZeroOnClear: true, sealStatusTurns: 3, healOnMissRatio: 0.5 }
      }
    ],
    '晨曦昭世': [
      {
        id: 'scarlett.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '晨曦昭世特效',
          description: '先制+1；必中；5回合內自身免疫並反彈所有異常狀態；4回合內，自身使用技能則附加對手等同於自身最大體力20%的真實傷害；2回合內自身免疫受到的攻擊，雙方每存在異常狀態1回合則額外延長1回合；3回合內，自身回合類效果被消除時令敵我雙方星贖，已存在星贖則改為回合數+2，未觸發則敵方下2回合無法主動切換精靈'
        },
        mechanics: { priority: 1, alwaysHit: true, immuneAndReflectStatusTurns: 5, trueDamageTurns: 4, trueDamageRatio: 0.2, immuneAttacksTurns: 2 }
      }
    ],
    '暮光舞動': [
      {
        id: 'scarlett.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '暮光舞動特效',
          description: '必中；令自身特攻、雙防、速度+2、命中+1；5回合內自身使用技能恢復自身最大體力1/3並造成等量百分比傷害，自身體力低於最大體力½時效果翻倍；將對手屬性變為暗影系，若對手識別屬性為暗影系則令對手下次技能無效；下2回合自身所有技能先制+2；技能無效時，下2次攻擊將對手視為暗影系，自身攻擊視為光系'
        },
        mechanics: { priority: 0, alwaysHit: true, statUp: { spatk: 2, def: 2, spdef: 2, speed: 2, accuracy: 1 }, healAndDamageTurns: 5, healRatio: 0.33, changeOpponentType: '暗影', nextPriorityTurns: 2, priorityBonus: 2 }
      }
    ],
    '王·凰歌盡霄': [
      {
        id: 'scarlett.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·凰歌盡霄特效',
          description: '必中；自身處於能力下降時當回合先制+3；與對手交換自身低於對手的能力等級，交換成功則令自身無效下次對手的攻擊技能且當回合與下次造成攻擊傷害提升150%；技能威力提升75%，敵我雙方每有1個技能當前PP值低於1時提升30%；吸取對手等同於當回合自身造成攻擊傷害100%的體力'
        },
        mechanics: { priority: 0, alwaysHit: true, swapLowerStats: true, powerBoostRatio: 0.75, absorbDamageRatio: 1.0 }
      }
    ],
    '王·聖璨天潔': [
      {
        id: 'scarlett.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '王·聖璨天潔特效',
          description: '必中；攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）；消除對手回合類效果，消除成功則對手麻痺，未觸發則自身免疫下1次受到的異常狀態；附加自身最大體力30%的百分比傷害並恢復等量體力，恢復體力時若自身體力低於最大體力的1/3則恢復效果和百分比傷害翻倍；附加對手最大體力1/3的百分比傷害，未擊敗對手則恢復自身等量體力值'
        },
        mechanics: { priority: 0, alwaysHit: true, isFifthSkill: true, kingPrivilegeNoWeak: true, clearOpponentTurnEffects: true, inflictParalysisOnClear: true, hpDamageRatio: 0.3, healRatio: 0.3 }
      }
    ]
  }
};

