import type { ElfDeconstructedProfile } from "../../effects/types";

export const OdinDeconstructedProfile: ElfDeconstructedProfile = {
  id: "odin",
  name: "眾神之父·奧丁",
  soulMark: {
    duel: {
      id: "odin_soulmark_duel",
      effectClass: "SOUL_MARK",
      flavor: {
        name: "ᛏ 戰神符文與神聖決鬥",
        description: "登場時為背包末位精靈附加 ᛏ 符文，登場觸發決鬥與全能力 +20%；雙方無法附加控制類異常與主動切換。",
        combatLog: "⚡ 【眾神之父·奧丁】降臨！神聖決鬥戰場展開！"
      },
      mechanics: {}
    }
  },
  skills: {
    'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ': [
      {
        id: 'odin.gungnir',
        effectClass: 'SKILL',
        flavor: {
          name: 'ᚷᚢᚾᚷᚾᛁᚱ ᚦᚱᛖᚢᛗᚨᛞᚱ',
          description: '先制+3；必中；解除自身能力下降狀態，解除成功則恢復自身全部體力；消除對手能力提升狀態，消除成功則100%令對手害怕；吸取對手最大體力¼，自身體力低於最大體力½時吸取效果翻倍'
        },
        mechanics: {}
      }
    ],
    'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ': [
      {
        id: 'odin.yggdrasil',
        effectClass: 'SKILL',
        flavor: {
          name: 'ᛉᛖᛚᛃᚨ ᛟᚾ ᛁᚷᚷᛞᚱᚨᛋᛁᛚ',
          description: '必中；使自身全屬性+1，自身體力高於對手時強化效果翻倍；5回合內自身使用技能吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，吸取後對手體力未減少則附加對手300點真實傷害；2回合內對手體力恢復量降低100%；下2回合自身所有技能先制+2'
        },
        mechanics: {}
      }
    ],
    'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ': [
      {
        id: 'odin.hugin',
        effectClass: 'SKILL',
        flavor: {
          name: 'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ',
          description: '必中；100%令對手臣服，未觸發則回合結束時消除對手回合類效果；100%令對手狂信，觸發成功則下次異常回合結束時消除對手信仰對象並附加對手ᛏ符文並於附加後降低對手能力值30%；3回合內自身造成技能傷害提升100%，在場雙方每存在一個無法主動切換精靈效果則額外提升50%；直接附加對手300點遠古系傷害，若造成傷害為微弱則下2回合對手無法主動切換精靈'
        },
        mechanics: {}
      }
    ],
    'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ': [
      {
        id: 'odin.ansuz',
        effectClass: 'SKILL',
        flavor: {
          name: 'ᛟᛞᛁᚾᛋ ᚨᚾᛋᚢᛉ',
          description: '必中；無視對手免疫攻擊效果，無視成功則自身下次攻擊無視對手免疫攻擊效果；免疫下次受到的攻擊；消除對手回合類效果，消除成功則100%令對手臣服，未觸發則2回合內對手無法主動切換精靈；使自身攻擊、速度、命中+1，對手雙攻、雙防、速度-1，執行後任一項未觸發或均觸發則吸取對手最大體力20%；場上存在異常狀態時，當回合造成傷害提升75%'
        },
        mechanics: {}
      }
    ],
    'ᚱᚨᚷᚾᚨᚱᛟᚲ': [
      {
        id: 'odin.ragnarok',
        effectClass: 'SKILL',
        flavor: {
          name: 'ᚱᚨᚷᚾᚨᚱᛟᚲ',
          description: '必中；場上每激活2種符文則自身當回合額外先制+1；剝離雙方當前的所有符文，並為自身附加ᛏ符文；消除雙方能力上升、下降狀態、護盾、護罩、次數類效果與當前在場回合數紀錄；下次擊敗對手時，對手下1隻出戰精靈出戰時將下次擁有符文時同步當前激活狀態；下次被對手擊敗時，己方下1隻出戰精靈出戰時自身將處於激活狀態的符文附加給技能位序相同的技能'
        },
        mechanics: {}
      }
    ]
  }
};

