import type { ElfDeconstructedProfile } from "../../effects/types";

export const LisaDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'starlight_lisa',
  name: '星光·麗莎布布',
  soulMark: {
    fang_mark: {
      id: 'innate.fang_mark',
      effectClass: 'INNATE',
      flavor: {
        name: '魂印·芳',
        description: '每次登場時，若自身為對手天敵則為對手附加3回合的星芳之纏，自身每次使用攻擊後附加3回合的星芳之纏；回合開始時，若自身體力高於對手則當回合受到的非真實傷害減少50%，若自身體力低於對手則回合結束後恢復自身最大體力的35%。',
        combatLog: '🌸 繁花盛開！【芳】之魂印發動，星芳之纏纏繞對手！'
      },
      mechanics: {
        target: 'OPPONENT',
        applyMarkOnEnter: '星芳之纏',
        applyMarkOnAttack: '星芳之纏',
        markDuration: 3,
        damageReduction50IfHighHp: true,
        nonTrueDamageReduction50IfHighHp: true,
        turnEndHealMaxHpPercentIfLowHp: 0.35
      }
    },
    starlight_fang_mark: {
      id: 'mark.starlight_fang',
      effectClass: 'MARK',
      polarity: 'NEGATIVE',
      flavor: {
        name: '星芳之纏',
        description: '持有者造成的非真實傷害額外減少50%；每次受到攻擊傷害後擁有者額外受到傷害值50%的百分比傷害並恢復對方在場精靈1點PP值，若對手為火系則星芳之纏消失並額外附加傷害值100%的真實傷害。',
        combatLog: '🌸 星芳之纏緊束對手，大幅削弱其非真實傷害並引發侵蝕與反噬！'
      },
      mechanics: {
        target: 'OPPONENT',
        reduceDamageDealtPercent: 0.5,
        reduceNonTrueDamageDealtPercent: 0.5,
        bonusPercentDamageOnHitPercent: 0.5,
        restorePpOnHit: 1,
        fireTypeOverrideTrueDamageMultiplier: 1.0
      }
    }
  },
  skills: {
    '撞擊': [
      {
        id: 'lisa.zhuangji',
        effectClass: 'INNATE',
        flavor: { name: '基礎物理攻擊', description: '（無特殊效果）' },
        mechanics: {}
      }
    ],
    '縮頭': [
      {
        id: 'lisa.suotou',
        effectClass: 'ON_HIT',
        flavor: { name: '防禦提升', description: '技能使用成功時，100%改變自身防禦等級+1。' },
        mechanics: { target: 'SELF', statUp: { def: 1 } }
      }
    ],
    '吸取': [
      {
        id: 'lisa.xiqu',
        effectClass: 'ON_HIT',
        flavor: { name: '微量吸血', description: '給予對方損傷的一半會回復自己的體力。' },
        mechanics: { target: 'SELF', lifestealPercent: 0.5 }
      }
    ],
    '疾風刃': [
      {
        id: 'lisa.jifengren',
        effectClass: 'INNATE',
        flavor: { name: '高爆擊切削', description: '（無特殊效果）' },
        mechanics: {}
      }
    ],
    '詛咒': [
      {
        id: 'lisa.zuzhou',
        effectClass: 'ON_HIT',
        flavor: { name: '攻防轉變', description: '技能使用成功時，100%改變自身攻擊等級+1；技能使用成功時，100%改變自身防禦等級+1；技能使用成功時，100%改變自身速度等級-1。' },
        mechanics: { target: 'SELF', statUp: { atk: 1, def: 1 }, statDown: { speed: 1 } }
      }
    ],
    '星光·究極吸取': [
      {
        id: 'lisa.star_jiuji.innate',
        effectClass: 'INNATE',
        flavor: { name: '先制+3', description: '先制+3。' },
        mechanics: { priority: 3 }
      },
      {
        id: 'lisa.star_jiuji.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '吸強加盾與強烈吸血', description: '吸取對手能力提升狀態，吸取成功則為自身附加300點護盾；造成傷害的100%恢復自身體力，若對手處於異常狀態則附加等量百分比傷害；吸取對手240點體力。', combatLog: '🌸 星光·究極吸取！汲取強化並化作護盾，狂暴吸血！' },
        mechanics: { target: 'OPPONENT', stealBuffs: true, shieldOnStealSuccess: 300, lifestealPercent: 1.0, bonusPercentDamageIfStatus: true, lifestealFixed: 240 }
      }
    ],
    '強力吸取': [
      {
        id: 'lisa.qiangli',
        effectClass: 'ON_HIT',
        flavor: { name: '強力吸血', description: '給予對方損傷的一半會回復自己的體力。' },
        mechanics: { target: 'SELF', lifestealPercent: 0.5 }
      }
    ],
    '寄生種子': [
      {
        id: 'lisa.jisheng',
        effectClass: 'TURN',
        polarity: 'NEGATIVE',
        flavor: { name: '寄生吸血', description: '5回合吸取對方最大體力的1/8（對草系無效）。', combatLog: '寄生種子植入對手體內，持續吸取生命轉為己用！' },
        mechanics: { duration: 5, target: 'OPPONENT', inflictStatus: '寄生', immuneType: '草' }
      }
    ],
    '捨身撞擊': [
      {
        id: 'lisa.sheshen',
        effectClass: 'ON_HIT',
        flavor: { name: '輕微反噬', description: '對方所受傷害的1/4會反彈給自己。' },
        mechanics: { target: 'SELF', recoilPercent: 0.25 }
      }
    ],
    '星光·攻碎': [
      {
        id: 'lisa.star_gongsui',
        effectClass: 'ON_HIT',
        flavor: { name: '必中毒', description: '命中後100%令對方中毒。' },
        mechanics: { target: 'OPPONENT', inflictStatus: '中毒', chance: 100 }
      }
    ],
    '星光·花草護體': [
      {
        id: 'lisa.star_huacao',
        effectClass: 'ON_HIT',
        flavor: { name: '雙防強化與壓制', description: '技能使用成功時，100%改變自身防禦等級+2；技能使用成功時，100%改變自身特防等級+2；技能使用成功時，100%改變對手攻擊等級-1；技能使用成功時，100%改變對手特攻等級-1。' },
        mechanics: { target: 'SELF', statUp: { def: 2, spdef: 2 }, opponentStatDown: { atk: 1, spatk: 1 } }
      }
    ],
    '星光·粉末擊打': [
      {
        id: 'lisa.star_fenmo',
        effectClass: 'ON_HIT',
        flavor: { name: '寄生或中毒與追傷', description: '命中後100%使對手寄生，未觸發則附加自身最大體力值1/4的百分比傷害；命中則100%使對手中毒，未觸發則附加200點固定傷害。', combatLog: '🌸 粉末擊打散落，對手同時遭受寄生與劇毒侵襲！' },
        mechanics: { target: 'OPPONENT', inflictStatus: '寄生', fallbackPercentDamageMaxHp: 0.25, inflictStatus2: '中毒', fallbackFixedDamage: 200 }
      }
    ],
    '星光·光合作用': [
      {
        id: 'lisa.star_guanghe.innate',
        effectClass: 'INNATE',
        flavor: { name: '必中', description: '必中。' },
        mechanics: { alwaysHit: true }
      },
      {
        id: 'lisa.star_guanghe.turn',
        effectClass: 'TURN',
        polarity: 'POSITIVE',
        flavor: { name: '光合庇護與吸能', description: '4回合內免疫並反彈所有受到的異常狀態；4回合內每回合使用技能恢復自身最大體力的1/2並造成等量百分比傷害；3回合內每回合使用技能則造成傷害前隨機吸取對手3項能力值-1；3回合內對手使用技能消耗的PP值變為3倍。', combatLog: '✨ 星光·光合作用！麗莎布布展開了強大的繁花領域！' },
        mechanics: { duration: 4, reflectStatusDuration: 4, healAndDamageDuration: 4, healMaxHpPercent: 0.5, stealRandomStatsDuration: 3, stealStatsCount: 3, ppCostMultiplierDuration: 3, ppCostMultiplier: 3 }
      }
    ],
    '星光·捨身撞擊': [
      {
        id: 'lisa.star_sheshen',
        effectClass: 'ON_HIT',
        flavor: { name: '強力反噬', description: '對方所受傷害的1/2會反彈給自己。' },
        mechanics: { target: 'SELF', recoilPercent: 0.5 }
      }
    ],
    '星光·花草能量': [
      {
        id: 'lisa.star_nengliang.innate',
        effectClass: 'INNATE',
        flavor: { name: '必中與全屬性強化', description: '必中；全屬性+1，自身當前體力高於對手時強化效果翻倍。' },
        mechanics: { alwaysHit: true, allStatUp: 1, doubleIfHighHp: true }
      },
      {
        id: 'lisa.star_nengliang.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '防護與回血', description: '若自身體力高於對手則獲得400點護盾，若自身體力低於對手則恢復自身最大體力的1/2；抵擋下1次對手的攻擊。', combatLog: '🌸 花草能量湧動，獲得護盾與絕對防禦！' },
        mechanics: { target: 'SELF', shieldIfHighHp: 400, healPercentIfLowHp: 0.5, blockNextAttack: true }
      },
      {
        id: 'lisa.star_nengliang.turn',
        effectClass: 'TURN',
        polarity: 'POSITIVE',
        flavor: { name: '花草固傷', description: '3回合內使用技能附加200點固定傷害，若自身體力高於對手則效果翻倍。' },
        mechanics: { duration: 3, target: 'SELF', turnBonusFixedDamage: 200, doubleFixedIfHighHp: true }
      }
    ],
    '星光·飛葉風暴': [
      {
        id: 'lisa.star_feiye.innate',
        effectClass: 'INNATE',
        flavor: { name: '必中', description: '必中。' },
        mechanics: { alwaysHit: true }
      },
      {
        id: 'lisa.star_feiye.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '淨化回滿與減傷追傷', description: '解除自身能力下降狀態，解除成功則恢復自身所有體力；1回合內受到物理攻擊和特殊攻擊傷害減少50%；附加對手已損失體力35%的百分比傷害。', combatLog: '🌪️ 飛葉風暴席捲！解除弱化滿血復活，並對對手造成殘血追殺！' },
        mechanics: { target: 'OPPONENT', clearSelfDebuffs: true, healMaxIfCleared: true, damageReductionDuration: 1, damageReductionPercent: 0.5, bonusPercentDamageLostHp: 0.35 }
      }
    ],
    '星光·金光綠葉': [
      {
        id: 'lisa.star_jinguang.innate',
        effectClass: 'INNATE',
        flavor: { name: '必中', description: '必中。' },
        mechanics: { alwaysHit: true }
      },
      {
        id: 'lisa.star_jinguang.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '消回合轉傷與PP吸取', description: '消除對手回合類效果，消除成功則下回合受到的傷害轉化為自身體力；降低對手所有PP一點，並恢復自身所有PP一點；對手處於星海之浸時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍；附加200點固定傷害，每次使用額外附加100點，最高400點，遇到天敵時效果翻倍。', combatLog: '✨ 星光·金光綠葉！消除庇護化傷為醫，對標記目標釋放毀滅衝擊！' },
        mechanics: { target: 'OPPONENT', clearTurnEffects: true, convertDamageToHealNextTurnOnSuccess: true, drainAllPp: 1, bonusDamageIfMarkedPercent: 0.75, doubleBonusIfLowHp: true, stackingFixedDamage: { base: 200, step: 100, max: 400, doubleIfAdvantage: true } }
      }
    ]
  }
};

