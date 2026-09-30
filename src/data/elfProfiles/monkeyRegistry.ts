import type { ElfDeconstructedProfile } from "../../effects/types";

export const MonkeyDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'starlight_monkey',
  name: '星光·魔焰猩猩',
  soulMark: {
    burn_mark: {
      id: 'innate.burn_mark',
      effectClass: 'INNATE',
      flavor: {
        name: '魂印·灼',
        description: '每次登場時，若自身為對手天敵則為對手附加3回合的星火之灼；自身每次使用攻擊後附加3回合的星火之灼；自身使用物理/特殊攻擊技能時則計算傷害時令攻擊、特攻等於原本二者總和；自身使用物理攻擊後恢復自身最大體力的1/3並造成等量百分比傷害，自身使用特殊攻擊後附加自身最大體力1/3的百分比傷害並於附加後恢復自身等同於附加成功量的體力，每次觸發時恢復自身所有技能1點PP值。',
        combatLog: '🔥 烈焰咆哮！【灼】之魂印發動，星火之灼吞噬對手！'
      },
      mechanics: {
        target: 'OPPONENT',
        applyMarkOnEnterIfAdvantage: '星火之灼',
        applyMarkOnAttack: '星火之灼',
        markDuration: 3,
        sumAttackAndSpatkOnAttack: true,
        physAttackHealMaxHpPercentAndDamage: 0.33,
        specAttackDamageMaxHpPercentAndHeal: 0.33,
        restoreAllPpOnTrigger: 1
      }
    },
    starlight_fire_mark: {
      id: 'mark.starlight_fire',
      effectClass: 'MARK',
      polarity: 'NEGATIVE',
      flavor: {
        name: '星火之灼',
        description: '持有者體力恢復效果減少100%，每次受到攻擊傷害後擁有者額外受到傷害值50%的百分比傷害，若對手為水系則星火之灼消失並額外附加傷害值100%的真實傷害。',
        combatLog: '🔥 星火之灼焚燒對手，阻絕一切治癒並引發熾烈引爆！'
      },
      mechanics: {
        target: 'OPPONENT',
        reduceHealEffectivenessPercent: 1.0,
        bonusPercentDamageOnHitPercent: 0.5,
        waterTypeOverrideTrueDamageMultiplier: 1.0
      }
    }
  },
  skills: {
    '衝頂': [
      {
        id: 'monkey.chongding',
        effectClass: 'INNATE',
        flavor: { name: '基礎物理攻擊', description: '（無特殊效果）' },
        mechanics: {}
      }
    ],
    '縮頭': [
      {
        id: 'monkey.suotou',
        effectClass: 'ON_HIT',
        flavor: { name: '防禦提升', description: '技能使用成功時，100%改變自身防禦等級+1。' },
        mechanics: { target: 'SELF', statUp: { def: 1 } }
      }
    ],
    '灰燼': [
      {
        id: 'monkey.huijin',
        effectClass: 'ON_HIT',
        flavor: { name: '連續加成', description: '連續使用每次威力增加20，最高威力150。' },
        mechanics: { target: 'OPPONENT', consecutivePowerBonus: { step: 20, max: 150 } }
      }
    ],
    '火花': [
      {
        id: 'monkey.huohua',
        effectClass: 'ON_HIT',
        flavor: { name: '燒傷機率', description: '命中後10%令對方燒傷。' },
        mechanics: { target: 'OPPONENT', statusChance: { status: 'burned', chance: 10 } }
      }
    ],
    '隔絕': [
      {
        id: 'monkey.gejue',
        effectClass: 'ON_HIT',
        flavor: { name: '火系減免', description: '5回合本方受到的火系傷害減半。' },
        mechanics: { target: 'SELF', elementDamageReduction: { element: '火', percent: 0.5, turns: 5 } }
      }
    ],
    '星光·音速火拳': [
      {
        id: 'monkey.yinsu',
        effectClass: 'INNATE',
        flavor: { name: '先制+3與消回合減速', description: '先制+3；消除對手回合類效果，消除成功使對手下回合先制-3；50%的概率造成傷害翻倍，對手處於能力下降狀態時概率翻倍。', combatLog: '🔥 音速爆燃！音速火拳消除回合並減速對手！' },
        mechanics: { priority: 3, clearTurnEffects: true, reducePriorityNextTurnOnSuccess: 3, damageDoubleChance: 50, doubleChanceIfDebuffed: true }
      }
    ],
    '火環': [
      {
        id: 'monkey.huohuan',
        effectClass: 'INNATE',
        flavor: { name: '基礎特殊攻擊', description: '（無特殊效果）' },
        mechanics: {}
      }
    ],
    '熱量集合': [
      {
        id: 'monkey.reliang',
        effectClass: 'ON_HIT',
        flavor: { name: '特攻提升', description: '技能使用成功時，100%改變自身特攻等級+1。' },
        mechanics: { target: 'SELF', statUp: { spatk: 1 } }
      }
    ],
    '火焰車': [
      {
        id: 'monkey.huoyanche',
        effectClass: 'ON_HIT',
        flavor: { name: '燒傷機率', description: '命中後10%令對方燒傷。' },
        mechanics: { target: 'OPPONENT', statusChance: { status: 'burned', chance: 10 } }
      }
    ],
    '星光·火花': [
      {
        id: 'monkey.star_huohua',
        effectClass: 'ON_HIT',
        flavor: { name: '必中燒傷', description: '命中後100%令對方燒傷。', combatLog: '🔥 星光·火花！無數星火點燃，對手陷入100%燒傷狀態！' },
        mechanics: { target: 'OPPONENT', statusChance: { status: 'burned', chance: 100 } }
      }
    ],
    '星光·壓迫': [
      {
        id: 'monkey.star_yapo',
        effectClass: 'ON_HIT',
        flavor: { name: '大幅弱化或扣血', description: '命中後3回合內每回合使對手攻擊-2、特攻-2、速度-2、命中-2，若未觸發則減少對手最大體力的1/3。', combatLog: '💫 星光·壓迫！釋放重力場全面壓制敵方能力！' },
        mechanics: { target: 'OPPONENT', multiTurnDebuff: { turns: 3, stats: { atk: -2, spatk: -2, speed: -2, accuracy: -2 }, fallbackMaxHpDamagePercent: 0.33 } }
      }
    ],
    '星光·靈絕擊': [
      {
        id: 'monkey.star_lingjue',
        effectClass: 'ON_HIT',
        flavor: { name: '弱化吸血與固傷', description: '若對手處於能力下降狀態則造成傷害的100%恢復體力；若對手處於能力下降狀態則附加300點傷害。', combatLog: '🔥 星光·靈絕擊！鎖定弱點，狂暴吸血並追加致命固傷！' },
        mechanics: { target: 'OPPONENT', lifesteal100IfDebuffed: true, bonusDamageIfDebuffed: 300 }
      }
    ],
    '星光·冥想': [
      {
        id: 'monkey.star_mingxiang',
        effectClass: 'ON_HIT',
        flavor: { name: '免控免降與焚燼反擊', description: '4回合內免疫並反彈所有受到的異常狀態；4回合內免疫能力下降狀態；命中後100%使對手焚燼，未觸發則下2回合自身使用技能時有100%概率使對手害怕；3回合內每回合攻擊附加自身攻擊和特攻總和50%的百分比傷害。', combatLog: '✨ 星光·冥想！冥火庇護全身，進入絕對無敵與恐懼領域！' },
        mechanics: { target: 'SELF', immuneAndReflectStatusTurns: 4, immuneDebuffTurns: 4, inflictStatusOrNextTurnsFear: { status: 'incinerated', turns: 2, fallbackStatus: 'feared' }, bonusPercentDamageSumAtkSpatkTurns: { turns: 3, percent: 0.5 } }
      }
    ],
    '星光·不滅之火': [
      {
        id: 'monkey.star_bumie',
        effectClass: 'ON_HIT',
        flavor: { name: '消強固傷與星火增傷', description: '消除對手能力提升狀態，消除成功則附加400點固定傷害；對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍；若打出致命一擊則恢復自身所有體力；3回合內每回合使用技能時附加400點固定傷害，附加後若對手體力未減少則附加400點真實傷害。', combatLog: '🔥 星光·不滅之火！永恆火焰灼燒，破壞一切增益並追加重度固傷與真傷！' },
        mechanics: { target: 'OPPONENT', clearOpponentBuffs: true, bonusFixedDamageOnClear: 400, bonusDamageIfMarkedPercent: 0.75, doubleBonusIfLowHp: true, healMaxOnCrit: true, multiTurnFixedOrTrueDamage: { turns: 3, fixedDamage: 400, trueDamageIfNoHpLoss: 400 } }
      }
    ],
    '星光·覺醒': [
      {
        id: 'monkey.star_juexing',
        effectClass: 'ON_HIT',
        flavor: { name: '全強加成與極致增傷先制', description: '全屬性+1，先出手時自身強化效果翻倍；4回合內每回合使用技能恢復自身最大體力的1/3並造成等量百分比傷害，自身體力低於最大體力1/2時效果翻倍；下2回合造成的攻擊傷害額外提升150%；下2回合令自身所有技能先制+2。', combatLog: '💥 星光·覺醒！魔焰怒吼，全屬性激增並獲得毀滅性的傷害與先制加持！' },
        mechanics: { target: 'SELF', statUpAll: 1, doubleStatUpIfFirst: true, turnHealAndPercentDamage: { turns: 4, percent: 0.33, doubleIfLowHp: true }, nextTurnsDamageBoost: { turns: 2, percent: 1.5 }, nextTurnsPriorityBoost: { turns: 2, value: 2 } }
      }
    ],
    '星光·絕命火焰': [
      {
        id: 'monkey.star_jueming',
        effectClass: 'ON_HIT',
        flavor: { name: '反轉弱化與秒殺焚燼', description: '反轉自身能力下降狀態；出手時自身不處於能力下降狀態則恢復自身所有技能2點PP值；2回合內將受到的攻擊傷害轉化為自身體力；15%秒殺對手，若對手處於燒傷狀態，則提升至30%概率秒殺對手；下次擊敗對手時，令對方下隻出戰精靈出戰時進入焚燼狀態。', combatLog: '🔥 星光·絕命火焰！置之死地而後生，致命烈焰帶來即死判決！' },
        mechanics: { target: 'OPPONENT', reverseSelfDebuffs: true, restorePpIfNotDebuffed: 2, convertDamageToHealTurns: 2, oneHitKoChance: { base: 15, ifBurned: 30 }, inflictIncineratedOnNextOpponentOnKill: true }
      }
    ],
    '星光·魔焰裂空': [
      {
        id: 'monkey.star_liekong.innate',
        effectClass: 'INNATE',
        flavor: { name: '第五技能必中', description: '必中。' },
        mechanics: { alwaysHit: true }
      },
      {
        id: 'monkey.star_liekong.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '消強回血與星火增傷穿防', description: '消除對手能力提升狀態，消除成功後恢復400點體力；對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍；3回合內每次直接攻擊都會使對手防禦和特防-1；未擊敗對手則己方下2次攻擊技能必定打出致命一擊；2回合對方屬性技能無效。', combatLog: '💥 星光·魔焰裂空！撕裂天際的終極火星一擊，破滅一切並封鎖屬性！' },
        mechanics: { target: 'OPPONENT', clearOpponentBuffs: true, healOnClear: 400, bonusDamageIfMarkedPercent: 0.75, doubleBonusIfLowHp: true, multiTurnDefSpdefDebuffOnHit: { turns: 3, value: -1 }, nextTurnsCritIfNoKill: 2, disableOpponentUtilityTurns: 2 }
      }
    ]
  }
};

