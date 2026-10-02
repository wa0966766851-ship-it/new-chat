import { ElfDeconstructedProfile, DeconstructedEffectEntry } from './types';
import { PuniBaseDeconstructedProfile, ShenglingPuniDeconstructedProfile } from '../data/elfProfiles/puniRegistry';
import { LisaDeconstructedProfile } from '../data/elfProfiles/lisaRegistry';
import { MonkeyDeconstructedProfile } from '../data/elfProfiles/monkeyRegistry';
import { DixinDeconstructedProfile } from '../data/elfProfiles/dixinRegistry';
import { OpeiaDeconstructedProfile } from '../data/elfProfiles/opeiaRegistry';
import { OdinDeconstructedProfile } from '../data/elfProfiles/odinRegistry';
import { KeldDeconstructedProfile } from '../data/elfProfiles/keldRegistry';
import { KeerhodeDeconstructedProfile } from '../data/elfProfiles/keerhodeRegistry';
import { ScarlettDeconstructedProfile } from '../data/elfProfiles/scarlettRegistry';
import { MarsDeconstructedProfile } from '../data/elfProfiles/marsRegistry';
import { ChaosBlakeDeconstructedProfile } from '../data/elfProfiles/chaosBlakeRegistry';
import { ReyDeconstructedProfile, GaiaDeconstructedProfile, CassiusDeconstructedProfile, BlakeDeconstructedProfile } from '../data/elfProfiles/wargodsRegistry';
import { WuxuDeconstructedProfile, WuxuShiyanDeconstructedProfile, WuxuZhuixingDeconstructedProfile } from '../data/elfProfiles/wuxuRegistry';
import { ZhakesiFearDeconstructedProfile } from '../data/elfProfiles/zhakesiFearRegistry';
import { ZhakesiAnnihilationDeconstructedProfile } from '../data/elfProfiles/zhakesiAnnihilationRegistry';
import { BelienteDeconstructedProfile } from '../data/elfProfiles/belienteRegistry';
import { CanglanDeconstructedProfile } from '../data/elfProfiles/canglanRegistry';

/**
 * 風味指導指令 (Style Anchor)：
 * 1. 邏輯層 (mechanics)：保持嚴謹的技術結構與數據類型，提供戰鬥引擎精確計算。
 * 2. 敘事層 (flavor)：維持《賽爾號》原有的史詩遊戲語言風格（如『令精靈陷入...』、『自身體力不足時...』）。
 * 3. 結構分離：嚴禁將技術數值硬塞入遊戲描述文字中，維持雙層結構獨立性。
 */

export const DeconstructedElfRegistry: Record<string, ElfDeconstructedProfile> = {
  // ==========================================
  // 1️⃣ 鎮魂·巴弗洛 (Baphomet)
  // ==========================================
  baphomet: {
    id: 'baphomet',
    name: '鎮魂·巴弗洛',
    soulMark: {
      soul_dirge: {
        id: 'mark.soul_dirge',
        effectClass: 'MARK',
        polarity: 'NEGATIVE',
        flavor: {
          name: '鎮',
          description: '每層於回合結束消耗持有者 25% 最大體力，最多疊加 4 層，下場時消失。',
          combatLog: '回蕩於冥界的鎮魂歌聲響起，奪走對手的生機！'
        },
        mechanics: {
          maxStacks: 4,
          target: 'OPPONENT',
          hpConsumePercent: 0.25,
          removeOnSwitch: true
        }
      },
      chaos_suffocate_trigger: {
        id: 'innate.chaos_suffocate',
        effectClass: 'INNATE',
        flavor: {
          name: '亂魂·窒息共振',
          description: '當任一方處於混亂或窒息狀態時，自身抵擋所有攻擊技能傷害；自身受到異常狀態時自動轉化為混亂。',
          combatLog: '冥界共鳴觸發！巴弗洛化解了襲來的攻擊！'
        },
        mechanics: {
          target: 'SELF',
          blockAttackDamage: true,
          statusConvertFromAny: '混亂'
        }
      }
    },
    skills: {
      '贖魂讚詩': [
        {
          id: 'shuhun.priority',
          effectClass: 'INNATE',
          flavor: { name: '先制特效', description: '先制+3；自身處於異常狀態時先制額外+1且技能必定命中。' },
          mechanics: { priority: 3, conditionalPriorityBonus: 1, conditionalAlwaysHit: true }
        },
        {
          id: 'shuhun.clear_turn',
          effectClass: 'ON_HIT',
          flavor: { name: '消除回合與流血', description: '消除對手回合類效果，成功消除則令對手陷入流血狀態。', combatLog: '讚詩消散了對手的庇護，並引發流血！' },
          mechanics: { target: 'OPPONENT', clearTurnEffects: true, inflictStatusOnClear: '流血' }
        },
        {
          id: 'shuhun.convert_fear',
          effectClass: 'ON_HIT',
          flavor: { name: '恐懼轉化', description: '將對手當前身上的異常狀態強制轉化為害怕狀態。', combatLog: '靈魂的恐懼蔓延，對手陷入害怕！' },
          mechanics: { target: 'OPPONENT', convertStatusTo: '害怕' }
        },
        {
          id: 'shuhun.suffocate_curse',
          effectClass: 'TURN',
          polarity: 'NEGATIVE',
          flavor: { name: '窒息咒縛', description: '4回合內，若對手使用攻擊技能，則使對手 100% 陷入窒息狀態。', combatLog: '對手四周的空氣被封鎖，呼吸開始停滯！' },
          mechanics: { duration: 4, target: 'OPPONENT', triggerOnOpponentAttack: '窒息' }
        }
      ],
      '亂魂舞': [
        {
          id: 'luanhun.priority',
          effectClass: 'INNATE',
          flavor: { name: '先制與必中', description: '先制+1；技能必定命中。' },
          mechanics: { priority: 1, alwaysHit: true }
        },
        {
          id: 'luanhun.self_chaos',
          effectClass: 'ON_HIT',
          flavor: { name: '狂舞混亂', description: '令自身陷入混亂狀態；若自身已處於混亂狀態，則大幅提升自身攻擊、速度與命中等級。', combatLog: '巴弗洛踏上狂亂的舞步，魔力沸騰！' },
          mechanics: { target: 'SELF', inflictStatus: '混亂', statsBonusIfAlreadyAffected: { atk: 2, speed: 2, acc: 2 } }
        },
        {
          id: 'luanhun.suffocate_or_def',
          effectClass: 'ON_HIT',
          flavor: { name: '窒息與防禦', description: '令對手 100% 陷入窒息狀態；若未成功觸發，則提升自身防禦與特防等級。' },
          mechanics: { target: 'OPPONENT', inflictStatus: '窒息', fallbackStatBoost: { def: 1, spdef: 1 } }
        },
        {
          id: 'luanhun.regen_turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '狂亂吸血', description: '4回合內，自身每次使用技能時恢復最大體力的 50%，並對對手造成等量的百分比傷害。' },
          mechanics: { duration: 4, target: 'SELF', healMaxPercentOnSkill: 50, mirrorDamagePercent: true }
        }
      ],
      '鎖魂曲': [
        {
          id: 'suohun.priority',
          effectClass: 'INNATE',
          flavor: { name: '追擊必中', description: '先制+1，必定命中；若對手處於護盾或護罩狀態，先制額外+2。' },
          mechanics: { priority: 1, alwaysHit: true, shieldPriorityBonus: 2 }
        },
        {
          id: 'suohun.clear_all',
          effectClass: 'ON_HIT',
          flavor: { name: '粉碎屏障', description: '消除敵我雙方所有的回合類效果、能力提升狀態與護盾/護罩，並對對手造成等同自身速度值 50% 的百分比傷害。' },
          mechanics: { target: 'BOTH', clearAllTurnEffects: true, clearAllBuffs: true, clearShields: true, speedBasedPercentDamage: 0.5 }
        },
        {
          id: 'suohun.immune_turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '靈魂守護', description: '4回合內，自身免疫一切控制類異常狀態。' },
          mechanics: { duration: 4, target: 'SELF', immuneCategory: '控制類' }
        },
        {
          id: 'suohun.pp_curse',
          effectClass: 'TURN',
          polarity: 'NEGATIVE',
          flavor: { name: '枯竭詛咒', description: '3回合內，對手技能 PP 消耗提升 20 倍；戰鬥結束時，對手受到等同於已損失 PP * 10 的固定傷害。' },
          mechanics: { duration: 3, target: 'OPPONENT', ppDrainMultiplier: 20, endBattlePpDamageRatio: 10 }
        }
      ]
    }
  },

  // ==========================================
  // 2️⃣ 混濁海妖·布林克克 (Brinkk)
  // ==========================================
  brinkk: {
    id: 'brinkk',
    name: '混濁海妖·布林克克',
    soulMark: {
      cthyaat_mark: {
        id: 'mark.cthyaat',
        effectClass: 'MARK',
        polarity: 'POSITIVE',
        flavor: {
          name: '克塔亞特烙印',
          description: '戰鬥開始時，克塔亞特作為額外精靈加入敵方；自身在場期間，對手每次受到真實傷害時直接增加自身等量體力並令自身本場戰鬥造成非真實傷害提升4%(最多疊加32次)；自身位於場下期間，對手每次受到真實傷害時消耗自身當前體力⅛以令自身本場戰鬥受到非真實傷害降低4%(最多疊加16次，執行時若判斷體力可降為0時不執行)；回合開始時，若場上存在本次在場期間不大於2回合或在場超過8回合以上的精靈，則自身體力上限提升20%並恢復自身全部體力與pp值；克塔亞特:水系額外精靈，加入時複製己方所有精靈能力值的總和一半作為自身能力值；己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次(n=本次在場期間所受到真實傷害次數)；己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼；本場戰鬥結束時，令己方所有已死亡精靈與隨機1隻背包內存活精靈消逝，自身不計入勝負計算時的精靈數判定；自身死亡時消逝，並令己方所有精靈失去自身當前體力上限⅛的體力上限',
          combatLog: '深海古神克塔亞特在虛空中甦醒！'
        },
        mechanics: {
          maxStacks: 32,
          target: 'SELF',
          cloneStatsRatio: 0.5,
          stackOnTrueDamageDealt: true
        }
      }
    },
    skills: {
      '溺咒之握': [
        {
          id: 'nizhou.priority',
          effectClass: 'INNATE',
          flavor: { name: '深流之速', description: '先制+3。' },
          mechanics: { priority: 3 }
        },
        {
          id: 'nizhou.steal_buffs',
          effectClass: 'ON_HIT',
          flavor: { name: '逆轉洋流', description: '吸取並反轉對手的全能力提升狀態為弱化。', combatLog: '海妖逆轉了洋流，將對手的力量據為己有！' },
          mechanics: { target: 'OPPONENT', stealAndReverseBuffs: true }
        },
        {
          id: 'nizhou.convert_freeze',
          effectClass: 'ON_HIT',
          flavor: { name: '寒刺轉化', description: '將對手的凍傷狀態轉化為冰封；若轉化成功，附加對手最大體力 1/8 的真實傷害。' },
          mechanics: { target: 'OPPONENT', convertStatusFrom: '凍傷', convertStatusTo: '冰封', convertSuccessTrueDamagePercent: 0.125 }
        }
      ],
      '癡愚之觸': [
        {
          id: 'chiyu.priority',
          effectClass: 'INNATE',
          flavor: { name: '混沌先制', description: '先制+3。' },
          mechanics: { priority: 3 }
        },
        {
          id: 'chiyu.clear_turn',
          effectClass: 'ON_HIT',
          flavor: { name: '消除與侵蝕', description: '消除對手回合類效果，消除成功則附加等同於對手最大體力 20% 的真實傷害。', combatLog: '癡愚之觸瓦解了對手的防線，造成真實侵蝕！' },
          mechanics: { target: 'OPPONENT', clearTurnEffects: true, clearSuccessTrueDamagePercent: 0.2 }
        },
        {
          id: 'chiyu.inflict_status',
          effectClass: 'ON_HIT',
          flavor: { name: '劇毒與感染', description: '命中後 100% 令對方陷入中毒狀態；若未觸發或被免疫，則 100% 令對手陷入感染狀態。', combatLog: '混沌邪毒蔓延，對手受到了不可逆轉的感染！' },
          mechanics: { target: 'OPPONENT', inflictStatus: '中毒', fallbackStatus: '感染' }
        },
        {
          id: 'chiyu.negate_turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '癡愚封鎖', description: '3回合內，若對手使用技能時不處於控制類異常狀態，則無效對手下一次攻擊；觸發無效成功則額外無效對手下一次攻擊。', combatLog: '癡愚之觸形成的混沌力場封鎖了對手的行動！' },
          mechanics: { duration: 3, target: 'OPPONENT', negateNextAttackIfNotControlled: true, extraNegateOnSuccess: 1 }
        }
      ],
      '深海働哭': [
        {
          id: 'shenhai.always_hit',
          effectClass: 'INNATE',
          flavor: { name: '深淵之喚', description: '必定命中。' },
          mechanics: { alwaysHit: true }
        },
        {
          id: 'shenhai.buff_all',
          effectClass: 'ON_HIT',
          flavor: { name: '古神狂暴', description: '提升自身攻擊、防禦、特防、速度與命中等級各 2 級；同時汲取對手當前體力的 1/4。' },
          mechanics: { target: 'SELF', stats: ['atk', 'def', 'spdef', 'speed', 'acc'], statChange: 2, drainCurrentHpPercent: 0.25 }
        },
        {
          id: 'shenhai.drain_turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '無盡海噬', description: '5回合內，自身使用技能時吸取對手最大體力的 1/3；自身體力低於最大體力1/2時吸取翻倍，吸取後對手體力未減少則附加300點真實傷害。' },
          mechanics: { duration: 5, target: 'SELF', drainMaxHpPercent: 1 / 3, doubleIfSelfHpBelow: 0.5, noHpLossTrueDamage: 300 }
        }
      ],
      '不淨者之約': [
        {
          id: 'bujing.enemy_priority', effectClass: 'INNATE',
          flavor: { name: '天敵先制', description: '對手為自身天敵時額外先制+3。' },
          mechanics: { priorityIfNaturalEnemy: 3 }
        },
        {
          id: 'bujing.always_hit',
          effectClass: 'INNATE',
          flavor: { name: '不淨必定命中', description: '必定命中。' },
          mechanics: { alwaysHit: true }
        },
        {
          id: 'bujing.rebirth',
          effectClass: 'ON_DEATH',
          flavor: { name: '古神替死契約', description: '攜帶此技能則自身死亡時，消耗對方額外精靈克塔亞特最大體力40%以令自身重生並解除所處異常狀態，若對手額外精靈克塔亞特體力不足則改為令其死亡以令自身重生。' },
          mechanics: { target: 'SELF', reviveWithCthyaat: true }
        },
        {
          id: 'bujing.immune',
          effectClass: 'TURN',
          flavor: { name: '異常免彈', description: '5回合內自身免疫並反彈所有非附屬類異常狀態。' },
          mechanics: { duration: 5, target: 'SELF', immuneAndReflectStatus: true }
        }
      ],
      '深潛者盛宴': [
        {
          id: 'shengqian.always_hit',
          effectClass: 'INNATE',
          flavor: { name: '深潛必定命中', description: '必定命中。' },
          mechanics: { alwaysHit: true }
        },
        {
          id: 'shengqian.feast',
          effectClass: 'INNATE_AND_ATTACHED',
          flavor: { name: '深潛者盛宴', description: '固有：能力下降時先制+3、不受PP限制，並將下降視為至少2倍同級全屬性提升；傷害克制取水、混沌、水.混沌、普通中的最高值。附加：下2次技能無效時造成水系技能傷害並漸凍，以及吸取與3回合技能增傷。' },
          mechanics: { target: 'SELF', boostOnDebuff: true, bestTypeMatchup: ['水', '混沌', '水.混沌', '普通'], damageBoostTurns: 3 }
        }
      ]
    }
  },

  // ==========================================
  // 3️⃣ 聖靈譜尼 (Saintly Puni)
  // ==========================================
  puni: ShenglingPuniDeconstructedProfile,
  puni_base: PuniBaseDeconstructedProfile,

  // ==========================================
  // 4️⃣ 魔獅迪露 (Demon Lion Delu)
  // ==========================================
  delu: {
    id: 'delu',
    name: '魔獅迪露',
    soulMark: {
      demon_shackles: {
        id: 'mark.demon_shackles',
        effectClass: 'MARK',
        polarity: 'NEUTRAL',
        flavor: {
          name: '魔軀枷鎖',
          description: '每有1道則受到攻擊傷害與重量提升200%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道(下場後保留)。',
          combatLog: '魔力激盪，1道魔軀枷鎖轉移到了對手身上！'
        },
        mechanics: {
          maxStacks: 5,
          target: 'SELF',
          damageTakenIncreasePerStack: 2.0,
          weightIncreasePerStack: 2.0,
          transferOnTrueDamage: 1,
          keepOnSwitch: true
        }
      }
    },
    skills: {}
  },

  // ==========================================
  // 5️⃣ 星光·魯斯王 (Starlight King of Rus)
  // ==========================================
  starlight_rus: {
    id: 'starlight_rus',
    name: '星光·魯斯王',
    soulMark: {
      sea_mark: {
        id: 'innate.sea_mark',
        effectClass: 'INNATE',
        flavor: {
          name: '海',
          description: '每次登場時，若自身為對手天敵則為對手附加 3 回合的星海之浸；自身每次使用攻擊後附加 3 回合的星海之浸。自身所有技能必定打出致命一擊。每場戰鬥限 1 次，自身受到致死傷害時，若自身的等級為 100 則消除對手能力提升狀態、回合類效果並恢復全部體力值、PP 值，然後獲得等同於自身體力值的護盾、護罩。',
          combatLog: '🌊 汪洋怒濤激盪！【海】之魂印發動，星海之浸湧向對手！'
        },
        mechanics: {
          target: 'OPPONENT',
          alwaysCrit: true,
          applyMarkOnEnterIfAdvantage: '星海之浸',
          applyMarkOnAttack: '星海之浸',
          markDuration: 3
        }
      },
      starlight_sea_mark: {
        id: 'mark.starlight_sea',
        effectClass: 'MARK',
        polarity: 'NEGATIVE',
        flavor: {
          name: '星海之浸',
          description: '持有者使用的屬性技能無效，每次受到攻擊傷害後擁有者額外受到傷害值 50% 的百分比傷害，若對手為草系則星海之浸消失並額外附加傷害值 100% 的真實傷害（BOSS 有效）。',
          combatLog: '🌊 星海之浸吞噬了對手，引發強烈海嘯侵蝕！'
        },
        mechanics: {
          target: 'OPPONENT',
          disableUtilitySkills: true,
          bonusDamagePercentOnHit: 0.5,
          grassTypeOverrideTrueDamage: 1.0
        }
      }
    },
    skills: {
      '閃擊': [
        {
          id: 'rus.shanji',
          effectClass: 'INNATE',
          flavor: { name: '先制+1', description: '先制+1。' },
          mechanics: { priority: 1 }
        }
      ],
      '玩水': [],
      '克制': [
        {
          id: 'rus.kezhi.p',
          effectClass: 'INNATE',
          flavor: { name: '先制-6', description: '先制-6；將所受的傷害 2 倍反饋給對手。' },
          mechanics: { priority: -6 }
        },
        {
          id: 'rus.kezhi.hit',
          effectClass: 'ON_HIT',
          flavor: { name: '雙倍反彈', description: '將所受的傷害 2 倍反饋給對手。' },
          mechanics: { target: 'OPPONENT', reflectDamageRatio: 2.0 }
        }
      ],
      '水流噴射': [
        {
          id: 'rus.shuilu',
          effectClass: 'INNATE',
          flavor: { name: '先制+1', description: '先制+1。' },
          mechanics: { priority: 1 }
        }
      ],
      '虛張聲勢': [
        {
          id: 'rus.xuzhang',
          effectClass: 'INNATE',
          flavor: { name: '必中防禦強化', description: '必中；技能使用成功時，100% 改變自身防禦等級+2。' },
          mechanics: { alwaysHit: true, statUp: { def: 2 } }
        }
      ],
      '星光·閃擊': [
        {
          id: 'rus.star_shanji.innate',
          effectClass: 'INNATE',
          flavor: { name: '先制+3', description: '先制+3。' },
          mechanics: { priority: 3 }
        },
        {
          id: 'rus.star_shanji.clear',
          effectClass: 'ON_HIT',
          flavor: { name: '消強與壓制', description: '消除對手能力提升狀態，消除成功則 2 回合內對手造成的攻擊傷害不超過 200 點，若對手不處於能力提升狀態則 2 回合內對手所有體力恢復效果減少 50%。' },
          mechanics: { target: 'OPPONENT', clearBuffs: true, limitDamageOnSuccess: 200, reduceHealOnFail: 0.5, duration: 2 }
        },
        {
          id: 'rus.star_shanji.turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '星光護佑', description: '2 回合內免疫所有受到的異常狀態；2 回合內免疫能力下降狀態。' },
          mechanics: { duration: 2, immuneStatus: true, immuneDebuff: true }
        }
      ],
      '海嘯旋風': [
        {
          id: 'rus.haixiao',
          effectClass: 'ON_HIT',
          flavor: { name: '凍傷觸發', description: '命中後 10% 令對方凍傷。' },
          mechanics: { target: 'OPPONENT', inflictStatus: '凍傷', chance: 10 }
        }
      ],
      '劍舞': [
        {
          id: 'rus.jianwu',
          effectClass: 'INNATE',
          flavor: { name: '必中攻擊強化', description: '必中；技能使用成功時，100% 改變自身攻擊等級+2。' },
          mechanics: { alwaysHit: true, statUp: { atk: 2 } }
        }
      ],
      '龍之牙': [],
      '星光·海嘯旋風': [
        {
          id: 'rus.star_haixiao',
          effectClass: 'ON_HIT',
          flavor: { name: '絕對凍傷', description: '命中後 100% 令對方凍傷。' },
          mechanics: { target: 'OPPONENT', inflictStatus: '凍傷', chance: 100 }
        }
      ],
      '星光·劍舞': [
        {
          id: 'rus.star_jianwu',
          effectClass: 'ON_HIT',
          flavor: { name: '星光劍舞強化', description: '技能使用成功時，100% 改變自身攻擊等級+2；技能使用成功時，100% 改變自身速度等級+2；技能使用成功時，100% 改變自身命中等級+2。' },
          mechanics: { statUp: { atk: 2, speed: 2 } }
        }
      ],
      '星光·克制': [
        {
          id: 'rus.star_kezhi.innate',
          effectClass: 'INNATE',
          flavor: { name: '先制與必中', description: '先制-6；必中。' },
          mechanics: { priority: -6, alwaysHit: true }
        },
        {
          id: 'rus.star_kezhi.hit',
          effectClass: 'ON_HIT',
          flavor: { name: '反彈與減傷', description: '反彈 2 倍的傷害給對手並使自身恢復等量體力；造成的傷害低於 200 則自身下 1 次受到的傷害降低 300 點。' },
          mechanics: { target: 'OPPONENT', reflectDamageRatio: 2.0, lifestealRatio: 1.0, damageReductionThreshold: 200, damageReductionValue: 300 }
        }
      ],
      '星光·水天一色': [
        {
          id: 'rus.star_shuitian.innate',
          effectClass: 'INNATE',
          flavor: { name: '必中與回血', description: '必中；恢復自身最大體力的 1/1，自身體力低於 1/2 時造成等量固定傷害。' },
          mechanics: { alwaysHit: true, healPercent: 1.0, lowHpFixedDamageRatio: 1.0 }
        },
        {
          id: 'rus.star_shuitian.turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '水天防護與增傷', description: '4 回合內免疫並反彈所有受到的異常狀態；解除自身能力下降效果，解除成功則下 2 回合先制+2；3 回合內受到攻擊則對手下回合受到的傷害翻倍。' },
          mechanics: { duration: 4, reflectStatus: true, clearDebuffSpeedUp: 2, vulnerabilityOnHitDuration: 3 }
        }
      ],
      '星光·驚濤駭浪': [
        {
          id: 'rus.star_jingtao',
          effectClass: 'ON_HIT',
          flavor: { name: '淨化與冰封', description: '解除自身所處的異常狀態，解除成功令對手冰封。' },
          mechanics: { target: 'OPPONENT', clearSelfStatus: true, inflictStatusOnSuccess: '冰封' }
        }
      ],
      '星光·隨風逐浪': [
        {
          id: 'rus.star_suifeng.innate',
          effectClass: 'INNATE',
          flavor: { name: '必中與全屬性強化', description: '必中；全屬性+1，自身當前體力高於最大體力的 1/2 時強化效果翻倍。' },
          mechanics: { alwaysHit: true, allStatUp: 1, doubleIfHighHp: true }
        },
        {
          id: 'rus.star_suifeng.turn',
          effectClass: 'TURN',
          polarity: 'POSITIVE',
          flavor: { name: '逐浪爆發', description: '下 2 回合自身造成的攻擊傷害翻倍；下 2 回合攻擊忽略對手 25% 的雙防值；下 2 回合若自身選擇使用技能則無視對手能力提升狀態。' },
          mechanics: { duration: 2, doubleDamage: true, ignoreDefPercent: 0.25, ignoreOpponentBuffs: true }
        }
      ],
      '星光·排山倒海': [
        {
          id: 'rus.star_paishan.innate',
          effectClass: 'INNATE',
          flavor: { name: '破盾與吸血', description: '無視對手攻擊免疫效果；無視對手護盾效果；給對手造成傷害時，傷害數值的 50% 恢復自身體力。' },
          mechanics: { ignoreImmunity: true, ignoreShield: true, lifestealPercent: 0.5 }
        },
        {
          id: 'rus.star_paishan.hit',
          effectClass: 'ON_HIT',
          flavor: { name: '冰封或壓制', description: '命中後 50% 使對手冰封，未觸發則對手下 2 回合先制-2。' },
          mechanics: { target: 'OPPONENT', inflictStatus: '冰封', chance: 50, fallbackDebuff: { priority: -2, duration: 2 } }
        }
      ],
      '星光·浪打千擊': [
        {
          id: 'rus.star_fifth.innate',
          effectClass: 'INNATE',
          flavor: { name: '必中五至十連擊', description: '必中；1 回合做 5~10 次攻擊；附加自身最大體力 20% 的百分比傷害，每次使用增加 10%，最高 40%。' },
          mechanics: { alwaysHit: true, multiHit: [5, 10], scalingPercentDamage: { base: 0.2, step: 0.1, max: 0.4 } }
        },
        {
          id: 'rus.star_fifth.hit',
          effectClass: 'ON_HIT',
          flavor: { name: '連擊強化與消回合', description: '每次攻擊都有 20% 的幾率令自身攻擊+1，速度+1，命中+1；消除對手回合類效果，消除成功則對手 2 回合內攻擊技能 MISS；對手處於星火之灼時造成的攻擊傷害提升 75%，若自身體力低於對手則效果翻倍。' },
          mechanics: { target: 'OPPONENT', chanceStatUpPerHit: { chance: 20, stats: { atk: 1, speed: 1 } }, clearTurnEffects: true, missOnSuccessDuration: 2, burnDamageBoost: 0.75 }
        }
      ],
      '星光·怒濤狂湧': [
        {
          id: 'rus.star_alt_fifth',
          effectClass: 'INNATE',
          flavor: { name: '必中消強吸血', description: '必中；消除對手能力提升狀態，消除成功則對手2回合內無法使用屬性技能；造成的傷害50%恢復自身體力。' },
          mechanics: { alwaysHit: true, clearBuffs: true, sealUtilityOnSuccess: 2, lifestealPercent: 0.5 }
        }
      ]
    }
  },

  // ==========================================
  // 6️⃣ 星光·麗莎布布 (Starlight Lisa Bubu)
  // ==========================================
  starlight_lisa: LisaDeconstructedProfile,

  // ==========================================
  // 7️⃣ 星光·魔焰猩猩 (Starlight Inferno Monkey)
  // ==========================================
  starlight_monkey: MonkeyDeconstructedProfile,

  // ==========================================
  // 9️⃣ 蟲后·奧佩婭 (Opeia)
  // ==========================================
  opeia: OpeiaDeconstructedProfile,

  // ==========================================
  // 8️⃣ 人皇·帝辛 (Renhuang Dixin)
  // ==========================================
  dixin: DixinDeconstructedProfile,
  renhuang_dixin: DixinDeconstructedProfile,

  // ==========================================
  // 🔟 眾神之父·奧丁 (Odin)
  // ==========================================
  odin: OdinDeconstructedProfile,

  // ==========================================
  // 1️⃣1️⃣ 冰魄·柯爾德 (Ice King Keld)
  // ==========================================
  ice_king_keld: KeldDeconstructedProfile,

  // ==========================================
  // 1️⃣2️⃣ 柯爾霍德 (Keerhode)
  // ==========================================
  keerhode: KeerhodeDeconstructedProfile,

  // ==========================================
  // 1️⃣3️⃣ 聖光斯嘉麗 (Holy Light Scarlett)
  // ==========================================
  holy_light_scarlett: ScarlettDeconstructedProfile,

  // ==========================================
  // 1️⃣4️⃣ 變革·馬爾修斯 (Mars Reform)
  // ==========================================
  mars_reform: MarsDeconstructedProfile,

  // ==========================================
  // 1️⃣5️⃣ 混沌·布萊克 (Chaos Blake)
  // ==========================================
  chaos_blake: ChaosBlakeDeconstructedProfile,

  // ==========================================
  // 1️⃣6️⃣ 戰神聯盟 (War Gods: Rey, Gaia, Cassius, Blake)
  // ==========================================
  default_0: ReyDeconstructedProfile,
  default_1: GaiaDeconstructedProfile,
  default_2: CassiusDeconstructedProfile,
  default_3: BlakeDeconstructedProfile,

  // ==========================================
  // 1️⃣7️⃣ 無序·六刃, 蝕言 與 墜星 (Wuxu series)
  // ==========================================
  wuxu_liuren: WuxuDeconstructedProfile,
  wuxu_shiyan: WuxuShiyanDeconstructedProfile,
  wuxu_zhuixing: WuxuZhuixingDeconstructedProfile,

  // ==========================================
  // 1️⃣8️⃣ 恐懼的化身·咤克斯 (Zhakesi Fear) & 湮滅之主・咤克斯
  // ==========================================
  zhakesi_fear: ZhakesiFearDeconstructedProfile,
  zhakesi_annihilation: ZhakesiAnnihilationDeconstructedProfile,

  // ==========================================
  // 1️⃣9️⃣ 蓓麗安特 (Beliente)
  // ==========================================
  beliente: BelienteDeconstructedProfile,

  // ==========================================
  // 2️⃣0️⃣ 怒濤·滄嵐 (Canglan)
  // ==========================================
  canglan: CanglanDeconstructedProfile
};

// Alias mapping for fallback IDs and naming variations
DeconstructedElfRegistry['canglan'] = CanglanDeconstructedProfile;
DeconstructedElfRegistry['canglan_base'] = CanglanDeconstructedProfile;
DeconstructedElfRegistry['怒濤.滄嵐'] = CanglanDeconstructedProfile;
DeconstructedElfRegistry['怒濤·滄嵐'] = CanglanDeconstructedProfile;
DeconstructedElfRegistry['滄嵐'] = CanglanDeconstructedProfile;
DeconstructedElfRegistry['無序.六刃'] = DeconstructedElfRegistry['wuxu_liuren'];
DeconstructedElfRegistry['無序.墜星'] = DeconstructedElfRegistry['wuxu_zhuixing'];
DeconstructedElfRegistry['無序·墜星'] = DeconstructedElfRegistry['wuxu_zhuixing'];
DeconstructedElfRegistry['墜星'] = DeconstructedElfRegistry['wuxu_zhuixing'];
DeconstructedElfRegistry['恐懼的化身.咤克斯'] = DeconstructedElfRegistry['zhakesi_fear'];
DeconstructedElfRegistry['恐懼的化身·咤克斯'] = DeconstructedElfRegistry['zhakesi_fear'];
DeconstructedElfRegistry['湮滅之主・咤克斯'] = DeconstructedElfRegistry['zhakesi_annihilation'];
DeconstructedElfRegistry['湮滅之主·咤克斯'] = DeconstructedElfRegistry['zhakesi_annihilation'];
DeconstructedElfRegistry['湮滅之主.咤克斯'] = DeconstructedElfRegistry['zhakesi_annihilation'];
DeconstructedElfRegistry['湮滅之主'] = DeconstructedElfRegistry['zhakesi_annihilation'];
DeconstructedElfRegistry['無序.蝕言'] = DeconstructedElfRegistry['wuxu_shiyan'];
DeconstructedElfRegistry['無序·蝕言'] = DeconstructedElfRegistry['wuxu_shiyan'];
DeconstructedElfRegistry['蝕言'] = DeconstructedElfRegistry['wuxu_shiyan'];
DeconstructedElfRegistry['default_7'] = DeconstructedElfRegistry['baphomet'];
DeconstructedElfRegistry['鎮魂.巴弗洛'] = DeconstructedElfRegistry['baphomet'];
DeconstructedElfRegistry['warrior_black'] = DeconstructedElfRegistry['default_3'];
DeconstructedElfRegistry['布萊克'] = DeconstructedElfRegistry['default_3'];
DeconstructedElfRegistry['default_8'] = DeconstructedElfRegistry['delu'];
DeconstructedElfRegistry['誑獅魔軀.魔獅迪露'] = DeconstructedElfRegistry['delu'];
DeconstructedElfRegistry['puni_base'] = PuniBaseDeconstructedProfile;
DeconstructedElfRegistry['譜尼'] = PuniBaseDeconstructedProfile;
DeconstructedElfRegistry['聖靈譜尼'] = ShenglingPuniDeconstructedProfile;
DeconstructedElfRegistry['蓓麗安特'] = DeconstructedElfRegistry['beliente'];

/**
 * 查詢特定精靈的解構詞條（支援以 ID 或精靈中文名稱查找）
 */
export function getDeconstructedProfile(elfIdOrName: string): ElfDeconstructedProfile | undefined {
  if (!elfIdOrName) return undefined;
  if (DeconstructedElfRegistry[elfIdOrName]) return DeconstructedElfRegistry[elfIdOrName];

  const clean = (str: string) => str.replace(/[·\.\s]/g, '');
  const targetClean = clean(elfIdOrName);

  if (targetClean === '鎮魂巴弗洛') return DeconstructedElfRegistry['baphomet'];
  if (targetClean === '誑獅魔軀魔獅迪露' || targetClean === '魔獅迪露') return DeconstructedElfRegistry['delu'];
  if (targetClean === '無序六刃' || targetClean === '六刃') return DeconstructedElfRegistry['wuxu_liuren'];
  if (targetClean === '無序蝕言' || targetClean === '蝕言') return DeconstructedElfRegistry['wuxu_shiyan'];
  if (targetClean === '無序墜星' || targetClean === '墜星') return DeconstructedElfRegistry['wuxu_zhuixing'];
  if (targetClean === '恐懼的化身咤克斯' || targetClean === '咤克斯' || targetClean === '恐懼化身') return DeconstructedElfRegistry['zhakesi_fear'];

  return Object.values(DeconstructedElfRegistry).find(p => {
    if (!p || !p.name || !p.id) return false;
    const pName = clean(p.name);
    const pId = clean(p.id);
    return pName === targetClean || pId === targetClean ||
           targetClean.includes(pName) || pName.includes(targetClean) ||
           targetClean.includes(pId) || pId.includes(targetClean);
  });
}
