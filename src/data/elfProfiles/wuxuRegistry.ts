import type { ElfDeconstructedProfile } from "../../effects/types";

export const WuxuDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'wuxu_liuren',
  name: '無序·六刃',
  soulMark: {
    wuxu_trait: {
      id: 'innate.wuxu_trait',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '專屬特性',
        description: '自身每次出戰時:\n>紀錄自身原始體力上限\n>令自身受到自身最大體力⅙的真實傷害\n>令對手受到對手最大體力⅙的真實傷害\n>>觸發成功則己方上隻出戰精靈恢復上述受到真實傷害總和，同時自身獲得上述受到真實傷害量6倍的臨時體力上限(下場後消失)\n>之後若對手主動/死亡切換精靈，或自身進入異常狀態則再次觸發出戰效果並將原臨時體力上限變為永久體力上限\n\n常駐效果:\n>自身恢復體力無法恢復/增加超過至自身原始體力上限\n>自身造成非真實傷害提升120%\n>>自身體力每降低0.1%，上述效果提升120%，體力低於最大體力½時效果翻倍\n>自身每次受到真實傷害時\n>>2回合內抵擋受到的所有技能傷害且受到的固定傷害、百分比傷害不超過60\n>>直至上述效果結束的下回合結束時自身是否存活不受當前體力值限制(下場後保留且剩餘回合數不因此下降)\n>自身每次使用技能時，恢復自身最大體力⅙並造成等量百分比傷害',
        combatLog: '🌑 無序之刃斬斷理性的邊界！原始體力極限轉化，六倍生命共鳴！'
      },
      mechanics: {
        trigger: 'ENTER_OR_SWITCH',
        recordOriginalMaxHp: true,
        selfTrueDamageMaxHpRatio: 1 / 6,
        enemyTrueDamageMaxHpRatio: 1 / 6,
        restorePreviousElfTrueDamageSum: true,
        tempMaxHpBoostRatio: 6,
        convertTempToPermMaxHpOnSwitchOrStatus: true,
        maxHpCapToOriginal: true,
        nonTrueDamageBoostBase: 1.2,
        nonTrueDamageBoostPer01HpLost: 1.2,
        doubleBoostIfHpBelowHalf: true,
        onTrueDamageTakenGuardTurns: 2,
        guardFixedPercentMax60: true,
        immortalUntilNextTurnEnd: true,
        onSkillUseHealMaxHpRatio: 1 / 6,
        onSkillUsePercentDamageRatio: 1 / 6
      }
    },
    trait_wuwo: {
      id: 'trait.wuwo',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '二代特質:無我',
        description: '每次受到異常狀態時立即轉化為平靜，若轉化的異常中帶有狂暴則轉化觸發後令自身平靜異常回合數翻倍',
        combatLog: '🧘 【無我】特質發動！異常轉化為平靜，萬念歸一！'
      },
      mechanics: {
        convertStatusToSerenity: true,
        doubleSerenityTurnsIfFurious: true
      }
    },
    trait_warrior: {
      id: 'trait.warrior',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '特質(二代):戰士',
        description: '戰鬥中始終被視為異能精靈\n自身戰鬥開始時與每次登場時獲得隱匿\n自身下場後若己方隱匿精靈不超過3個，則恢復下隻出戰精靈所有技能PP值並附加隱匿印記\n自身造成攻擊傷害時計算傷害始終以弱點傷害計算，計算弱點時若對方每存在1點護盾、1%傷害減少時弱點傷害則計算傷害時對手剩餘雙防值60%效果額外降低1%，最低降低至1\n自身攻擊克制倍數取技能擁有的屬性中攻擊對手的最優克制系別計算傷害\n自身攻擊無視對手攻擊免疫效果、傷害限制效果、免疫、抵擋、轉化傷害效果與護盾承傷效果',
        combatLog: '⚔️ 【戰士】特質激活！隱匿異能行者登場，弱點鎖定與絕對破防！'
      },
      mechanics: {
        treatAsAlienElf: true,
        enterGainConceal: true,
        switchOutInheritConcealAndRestorePP: true,
        alwaysWeaknessDamageWithShieldReduction: true,
        bestElementAdvantage: true,
        ignoreImmunityLimitShield: true
      }
    },
    trait_wuxu_apostle: {
      id: 'trait.wuxu_apostle',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '無序星魂使徒',
        description: '無序星魂使徒專屬：對異能精靈造成傷害翻倍且擊敗後令其消逝',
        combatLog: '🌑 【無序星魂使徒】威壓降臨！異能精靈傷害翻倍，終結消逝！'
      },
      mechanics: {
        doubleDamageToAlienElf: true,
        killAlienElfVanish: true
      }
    }
  },
  skills: {
    '終焉·六花斬': [
      {
        id: 'wuxu.skill5.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '終焉·六花斬',
          description: '必中\n自身處於異常狀態時先制+3且無視對手正先制效果\n雙方每有1個技能PP值不為滿則吸取對手1次66點體力(每次吸取體力獨立)，若吸取後對手體力未減少則該次改為汲取體力\n雙方每有1個技能PP值為滿則吸取對手1次66點體力(每次吸取體力獨立)，若吸取後對手體力未減少則該次改為汲取體力\n進行6次額外行動，每次行動依序以邪靈、戰鬥、邪靈.戰鬥、邪靈、戰鬥、邪靈.戰鬥為順序進行攻擊且每次造成66點技能傷害，額外行動期間不會造成傷害直到行動結束時對方所有精靈受到6次行動造成的傷害總和技能傷害，場下精靈死亡時令其消逝並轉化其能力值總和20%給予自身'
        },
        mechanics: {
          priority: 0,
          isFifthSkill: true,
          alwaysHit: true,
          statusPriorityBonus: 3,
          ignoreOpponentPriorityIfStatus: true,
          drainHpPerNotFullPpSkill: 66,
          fallbackToAbsorbIfNoReduction: true,
          drainHpPerFullPpSkill: 66,
          multiActionSequence: ['邪靈', '戰鬥', '邪靈.戰鬥', '邪靈', '戰鬥', '邪靈.戰鬥'],
          damagePerAction: 66,
          delayDamageUntilEndToAllEnemies: true,
          killOfffieldVanishAndAbsorb20PercentStats: true
        }
      }
    ],
    '狂刃無生': [
      {
        id: 'wuxu.skill1.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '狂刃無生',
          description: '必中\n消除敵我雙方回合類效果，消除成功則令雙方狂暴\n消除敵我雙方能力上升、下降狀態與護盾、護罩效果，消除成功則附加自身最大體力66%的百分比傷害\n自身每損失1點體力，則附加對手1點真實傷害，每損失6點，則額外附加6點真實傷害'
        },
        mechanics: {
          priority: 3,
          alwaysHit: true,
          clearAllTurnEffectsBothSides: true,
          inflictFuriousBothOnClear: true,
          clearAllStatStagesAndShieldsBothSides: true,
          percentDamageOnClearRatio: 0.66,
          trueDamagePerLostHp: 1,
          extraTrueDamagePer6LostHp: 6
        }
      }
    ],
    '靜刃止水': [
      {
        id: 'wuxu.skill2.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '靜刃止水',
          description: '必中\n該技能每有1點PP值則先制+1且技能連擊次數+1\n6回合內自身免疫並反彈所有異常狀態\n解除雙方所有異常狀態，解除成功則3回合對手所有技能附加效果失效且無法附加敵我雙方任一方異常狀態\n附加666點固定傷害'
        },
        mechanics: {
          target: 'OPPONENT',
          priority: 0,
          alwaysHit: true,
          priorityPlusPerPp: 1,
          comboPlusPerPp: 1,
          immuneAndReflectStatusTurns: 6,
          clearAllStatusBothSides: true,
          sealAdditionalEffectsAndStatusTurnsOnClear: 3,
          fixedDamage: 666
        }
      }
    ],
    '蟄刃復歸': [
      {
        id: 'wuxu.skill3.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '蟄刃復歸',
          description: '必中\n該技能每有1點PP值則先制+1且技能連擊次數+1\n令自身平靜，自身處於平靜狀態則攻擊、雙防、速度、命中+1\n5回合內自身恢復最大體力⅓並造成等量百分比傷害，自身體力低於最大體力½時恢復效果與造成百分比傷害翻倍\n下2回合自身使用技能先制+6\n下次死亡時，若下隻出戰己方精靈在場超過6回合則自身重生'
        },
        mechanics: {
          priority: 0,
          alwaysHit: true,
          priorityPlusPerPp: 1,
          comboPlusPerPp: 1,
          applySerenitySelf: true,
          statUpIfSerenity: { atk: 1, def: 1, spdef: 1, speed: 1, acc: 1 },
          healAndDamageTurns: 5,
          healRatio: 0.33,
          doubleHealAndDamageIfHpBelowHalf: true,
          nextPriorityTurns: 2,
          priorityBonus: 6,
          reviveOnNextDeathIfNextElfOnFieldOver6Turns: true
        }
      }
    ],
    '六刃碎界斷': [
      {
        id: 'wuxu.skill4.innate',
        effectClass: 'INNATE',
        flavor: {
          name: '六刃碎界斷',
          description: '必中\n該技能每有1點PP值則先制+1且技能連擊次數+3\n6回合內對手體力恢復量下降100%\n附加自身雙攻值總和66%的百分比傷害\n3回合內令對手雙防-1，未觸發則2回合內對手攻擊技能無效且當回合結束時受到當前雙防值總和66%的百分比傷害'
        },
        mechanics: {
          priority: 0,
          alwaysHit: true,
          priorityPlusPerPp: 1,
          comboPlusPerPp: 3,
          noHealOpponentTurns: 6,
          percentDamageBothAtkSumRatio: 0.66,
          statDownOpponentTurns: 3,
          statDown: { def: -1, spdef: -1 },
          fallbackNegateAtkTurnsOnMiss: 2,
          fallbackPercentDamageDefSumRatioOnMiss: 0.66
        }
      }
    ]
  }
};

export const WuxuShiyanDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'wuxu_shiyan',
  name: '無序·蝕言',
  soulMark: {
    shiyan_mark: {
      id: 'innate.shiyan_mark',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '專屬特性:蝕',
        description: '回合開始時:\n>若自身不處於詛咒狀態則令敵我雙方進入3回合詛咒異常狀態\n戰鬥階段結束時:\n>將自身異常轉化為詛咒異常狀態且令自身詛咒回合數翻倍\n常駐效果:\n>若自身在背包內且存活\n>>將自身與己方其他所有場下精靈特防值直接調整為自身特防值/10(餘數無條件進位)\n>>修正敵方所有精靈特殊攻擊計算公式改為只能造成等同於特攻值的傷害\n>>>然後若自身最終特防值每有1點特防則對手造成上述傷害時減少1%\n>自身死亡時，還原對手特殊攻擊計算公式',
        combatLog: '🌑 【蝕言】魂印發動！無序之蝕蔓延，雙方陷入深淵詛咒！'
      },
      mechanics: {
        turnStartCurseBothTurns: 3,
        turnEndConvertStatusToCurseDoubleTurns: true,
        offfieldSpdefDivide10ToTeam: true,
        enemySpatkFormulaOverride: true,
        restoreFormulaOnDeath: true
      }
    },
    trait_repair_curser: {
      id: 'trait.repair_curser',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '二代特質:修復 / 咒術師',
        description: '【修復】\n己方其他精靈受到任意衍化類異常時，當回合戰鬥階段時會立即衍化並恢復自身與該精靈所有技能1點PP值與250點體力\n\n【咒術師】\n>戰鬥中被視為異能精靈\n每次登場時:\n>召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方(特防始終與無序·蝕言經過專屬特性調整過後的特防保持一致)\n>自身下場後則怨靈死亡並消逝\n常駐效果:\n>賽博怨靈存在時自身詛咒類異常回合數不會減少\n自身選擇技能時:\n>若自身處於任一種詛咒類狀態則選擇技能時消耗該技能1點PP值\n>>賽博怨靈於行動階段發動1次魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成所選技能威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>若戰鬥階段結束時若未選擇使用技能則改為賽博怨靈於該階段發動1次滅靈魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成技能中威力最高者的威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>自身死亡時\n>>若存在怨靈會代替自身死亡以保留無序·蝕言20%體力(每次登場僅觸發1次)\n>>此後賽博怨靈執行上述效果中額外行動時對敵方場下造成真實傷害比例翻倍',
        combatLog: '👻 【咒術師】特質發動！賽博怨靈降臨，替死防禦與咒術共鳴！'
      },
      mechanics: {
        treatAsAlienElf: true,
        summonCyberWraithOnEnter: true,
        cyberWraithEqualStats: true,
        killCyberWraithOnSwitchOut: true,
        noCurseTurnReduceIfWraithExists: true,
        consume1PpIfCurseWhenSelectSkill: true,
        wraithCastSpellOnAction: true,
        wraithCastDeathSpellIfNoSkillSelected: true,
        wraithSubstituteDeathKeep20HpOnce: true,
        wraithSubstituteDeathKeepHpRatioOnce: 0.2,
        wraithOfffieldTrueDamageDoubleAfterSub: true
      }
    },
    trait_wuxu_apostle: {
      id: 'trait.wuxu_apostle',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '無序星魂使徒',
        description: '無序星魂使徒專屬：對異能精靈造成傷害翻倍且擊敗後令其消逝',
        combatLog: '🌑 【無序星魂使徒】威壓降臨！異能精靈傷害翻倍，終結消逝！'
      },
      mechanics: {
        doubleDamageToAlienElf: true,
        killAlienElfVanish: true
      }
    }
  },
  skills: {
    '影契·噬滅': [
      {
        id: 'wuxu.shiyan.skill1',
        effectClass: 'INNATE',
        flavor: {
          name: '影契·噬滅',
          description: '對手處於能力提升狀態時先制+1並將對手能力提升狀態視為能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>消除雙方回合類效果、能力提升、下降狀態\n>100%令雙方同時進入害怕、詛咒異常狀態\n>令對手全屬性-1\n>吸取對手最大體力¼，自身體力低於最大體力½時效果翻倍'
        },
        mechanics: {
          priority: 3,
          priorityPlus1IfOpponentBuffed: true,
          statStageReverseIfOpponentBuffed: true,
          onPpConsume: {
            clearAllTurnEffectsBothSides: true,
            clearAllStatStagesBothSides: true,
            inflictFearAndCurseBothSides: true,
            statDownOpponentAll: 1,
            absorbMaxHpRatio: 0.25,
            doubleAbsorbIfHpBelowHalf: true
          }
        }
      }
    ],
    '械律·置換': [
      {
        id: 'wuxu.shiyan.skill2',
        effectClass: 'INNATE',
        flavor: {
          name: '械律·置換',
          description: '雙方擁有護盾、護罩時先制+1並將對手能力提升狀態視為能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>消除雙方護盾、護罩效果並吸取對手等同於消除量70%的體力\n>恢復自身所有技能PP值\n>偷取對手150藥劑並立即使用\n>下2回合對手無法主動切換精靈'
        },
        mechanics: {
          priority: 3,
          priorityPlus1IfShieldsPresent: true,
          statStageReverseIfOpponentBuffed: true,
          onPpConsume: {
            clearShieldsBothSidesAndAbsorb70Percent: true,
            restoreAllPp: true,
            stealAndUsePotion150: true,
            disableOpponentSwitchTurns: 2
          }
        }
      }
    ],
    '血稅迴轉': [
      {
        id: 'wuxu.shiyan.skill3',
        effectClass: 'INNATE',
        flavor: {
          name: '血稅迴轉',
          description: '攜帶此技能則該技能每次PP值被消耗時:\n>令自身雙防、速度、命中+2，雙攻-1\n>4回合內每回合吸取對手最大體力⅓，自身體力低於最大體力½時吸取效果翻倍，對手體力為減少則恢復己方所有不在場精靈200點體力\n>3回合內使用技能附加300點固定傷害，對手體力未減少則附加300點真實傷害\n>下2回合自身所有技能先制+2'
        },
        mechanics: {
          priority: 1,
          onPpConsume: {
            statChangeSelf: { def: 2, spdef: 2, speed: 2, accuracy: 2, atk: -1, spatk: -1 },
            turnAbsorbMaxHpRatio: 0.33,
            turnAbsorbDuration: 4,
            doubleAbsorbIfHpBelowHalf: true,
            healOfffieldIfOpponentHpNotReduced: 200,
            addFixedDamageTurns: 3,
            fixedDamageAmount: 300,
            trueDamageIfOpponentHpNotReduced: 300,
            nextPriorityBonusTurns: 2,
            nextPriorityBonusAmount: 2
          }
        }
      }
    ],
    '啟蟄·冥土荒蕪': [
      {
        id: 'wuxu.shiyan.skill4',
        effectClass: 'INNATE',
        flavor: {
          name: '啟蟄·冥土荒蕪',
          description: '攜帶此技能則該技能每次PP值被消耗時:\n>令對手100%腐朽，未觸發則100%癱瘓\n>3回合內對手使用攻擊技能則隨機進入2種異常狀態\n>3回合內對手使用屬性技能則下2回合攻擊技能無法造成傷害且附加效果失效\n>3回合內自身免疫能力下降狀態'
        },
        mechanics: {
          priority: 0,
          onPpConsume: {
            inflictDecayOrParalyze: true,
            opponentAttackSkillRandom2StatusTurns: 3,
            opponentAttributeSkillSealDamageTurns: 3,
            immuneStatDownTurns: 3
          }
        }
      }
    ],
    '安息契': [
      {
        id: 'wuxu.shiyan.skill5',
        effectClass: 'INNATE',
        flavor: {
          name: '安息契',
          description: '將自身能力下降狀態視為對手處於同等級能力下降狀態\n攜帶此技能則該技能每次PP值被消耗時:\n>令對手所有攻擊技能PP值歸0\n>2回合內對手屬性技能無效且無法附加自身異常狀態\n>額外消耗自身所有技能1點PP值\n>附加自身最大體力40%的百分比傷害並恢復自身等量體力，對手體力高於最大體力½時效果翻倍\n>下次擊敗對手時100%令對手下隻出戰精靈詛咒'
        },
        mechanics: {
          priority: -1,
          isFifthSkill: true,
          mirrorSelfStatDownToOpponent: true,
          onPpConsume: {
            zeroOpponentAttackSkillsPp: true,
            sealOpponentAttributeSkillsAndStatusTurns: 2,
            extraConsumeSelfAllPp: 1,
            percentDamageMaxHpRatio: 0.4,
            healSameAsPercentDamage: true,
            doubleIfOpponentHpAboveHalf: true,
            nextKillCurseOpponentNextElf: true
          }
        }
      }
    ]
  }
};

export const WuxuZhuixingDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'wuxu_zhuixing',
  name: '無序·墜星',
  soulMark: {
    zhuixing_mark: {
      id: 'innate.zhuixing_mark',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '專屬特性:墜',
        description: '自身使用攻擊技能後:\n>令對手2回合內屬性技能無效\n>自身恢復造成傷害100%的體力值\n>2回合內自身免疫控制類異常狀態\n>附加對手已損失體力50%的百分比傷害\n>恢復自身所有技能2點PP值\n對手受到技能傷害時:\n>若背包內每有一隻精靈體力不為滿，則自身下次攻擊技能威力額外提升25%',
        combatLog: '☄️ 【墜星】魂印發動！極光穿梭碎星漫天，傷害與控制絕對封印！'
      },
      mechanics: {
        afterAttackSealAttributeTurns: 2,
        afterAttackHealDamage100: true,
        afterAttackImmuneControlTurns: 2,
        afterAttackLossHpPercentDamage: 0.5,
        afterAttackRestoreAllPp: 2,
        onDamageTakenPackNotFullHpBoostPower: 0.25
      }
    },
    trait_bold_thrower: {
      id: 'trait.bold_thrower',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '二代特質:豪邁 / 投石者',
        description: '【豪邁】自身攻擊時忽略對手50%雙防值。\n【投石者】戰鬥中被視為異能精靈；技能位可攜帶4種不同屬性的技能石且使用任意技能石時轉化為使用同屬系的SS級技能石，威力變為240；若自身攜帶4個技能石技能則在戰鬥中擁有神話(免疫異常狀態、能力下降狀態、PP值無限)且造成攻擊傷害提升50%，受到攻擊傷害降低50%且戰鬥階段結束時恢復自身最大體力25%；裝備的技能石擁有本系加乘且PP值上限+10；若該技能石為完美技能石則機率效果觸發概率提升為100%；每次使用技能石時令對手背包內所有精靈受到傷害值25%*該技能石對受到傷害精靈當前克制倍數的真實傷害；遭受致死傷害時保留1點體力。',
        combatLog: '☄️ 【豪邁/投石者】星河降誕，不屈戰神隕星重擊！'
      },
      mechanics: {
        treatAsAlienElf: true,
        ignoreDefPercent: 0.5,
        isStoneThrower: true,
        forceSSSkillStonePower: 240,
        mythologyWith4Stones: true,
        damageBoost4Stones: 0.5,
        damageReduce4Stones: 0.5,
        turnEndHeal4Stones: 0.25,
        stoneTypeMatchBoost: true,
        perfectStoneRate100: true,
        stoneUseOfffieldTrueDamagePercent: 0.25,
        firstFatalSurviveAt1Hp: true
      }
    },
    trait_wuxu_apostle: {
      id: 'trait.wuxu_apostle',
      effectClass: 'INNATE',
      polarity: 'POSITIVE',
      flavor: {
        name: '無序星魂使徒',
        description: '無序星魂使徒專屬：對異能精靈造成傷害翻倍且擊敗後令其消逝',
        combatLog: '🌑 【無序星魂使徒】威壓降臨！異能精靈傷害翻倍，終結消逝！'
      },
      mechanics: {
        doubleDamageToAlienElf: true,
        killAlienElfVanish: true
      }
    }
  },
  skills: {}
};

