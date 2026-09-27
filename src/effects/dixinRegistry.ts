import { prdChance } from "../utils/prd";
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

export const handleDixinSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, addLog, applyHeal, applyTrueDamage, applyStatChange } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 1. 登場時：獲得 2 層八荒
  if (event === EffectTiming.ON_ENTRANCE) {
    let stacks = getPlayerState("dixinBahuangStacks") || 0;
    stacks += 2;
    setPlayerState("dixinBahuangStacks", Math.min(9, stacks));
    addLog(`👑 【荒】：帝威顯赫！八荒層數提升至 ${Math.min(9, stacks)}！`, "effect");
  }

  // 2. 回合結束時：增減八荒層數與觸發效果
  if (event === EffectTiming.ROUND_END) {
    let stacks = getPlayerState("dixinBahuangStacks") || 0;
    
    // 判定對方是否使用技能
    if (extraData?.opponentUsedSkill) {
      stacks = Math.max(0, stacks - 1);
    } else {
      stacks = Math.min(9, stacks + 1);
    }
    setPlayerState("dixinBahuangStacks", stacks);
    addLog(`👑 【荒】：八荒演變，當前層數：${stacks}`, "effect");

    // 觸發層數效果
    if (stacks >= 1) {
      // 攻擊威力提升 (由引擎判斷)
    }
    if (stacks >= 2) {
      const fixedDmg = stacks * 39;
      applyTrueDamage(oppSide, fixedDmg, "八荒固傷");
    }
    if (stacks >= 3) {
      const drainAmt = Math.floor(target.maxHp / 3);
      const actual = applyTrueDamage(oppSide, drainAmt, "八荒汲取");
      applyHeal(actor, actual);
    }
    if (stacks >= 5) {
      const healAmt = Math.floor(self.maxHp / 3);
      applyHeal(actor, healAmt);
      if (prdChance("dixinRegistry:L44", 0.5)) {
        setOpponentState("nextSkillInvalid", true);
        addLog(`👑 【荒】：天威壓制，對手下回合技能可能失效！`, "status");
      }
    }
  }

  // 擊敗對手時清空
  if (event === EffectTiming.BATTLE_PHASE_END && extraData?.killedOpponent) {
    setPlayerState("dixinBahuangStacks", 0);
    addLog(`👑 【荒】：塵埃落定，八荒層數歸零。`, "effect");
  }

  return false;
};

export const DIXIN_SKILLS: Record<string, BattleSkillHandler> = {
  "鹿台悲歌": (ctx) => {
    const { actor, addLog, applyStatChange, setPlayerState, getPlayerState } = ctx;
    addLog(`🏰 【鹿台悲歌】：全屬性提升！吸取生機！`, "effect");
    const stacks = getPlayerState("dixinBahuangStacks") || 0;
    const bonus = stacks > 3 ? 2 : 1;
    applyStatChange(actor, { atk: bonus, def: bonus, spatk: bonus, spdef: bonus, speed: bonus, accuracy: bonus });
    setPlayerState("dixinBahuangStacks", Math.min(9, stacks + 2));
  },
  "人皇御宇": (ctx) => {
    const { actor, addLog, setOpponentState, applyStatusWithImmunityCheck } = ctx;
    addLog(`📜 【人皇御宇】：降下臣服旨意！`, "effect");
    const res = applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "臣服", 3);
    if (!res.success) {
      addLog(`📜 【人皇御宇】：旨意受阻，轉化為星賜守護！`, "effect");
      setOpponentState("attackInvalidTurns", 2);
      setOpponentState("attackSkillInvalidTurns", 2);
      setOpponentState("attackSkillInvalidReason", "【人皇御宇】星賜守護");
    }
  },
  "帝怒傾天": (ctx) => {
    const { addLog, applyStatChange, target } = ctx;
    addLog(`🔥 【帝怒傾天】：無視一切防禦，傾天一擊！`, "effect");
    // 威力提升與固傷由引擎和魂印判斷
  }
};

export const DixinDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'dixin',
  name: '人皇·帝辛',
  soulMark: {
    huang_mark: {
      id: 'innate.huang_mark',
      effectClass: 'INNATE',
      flavor: {
        name: '魂印·荒',
        description: '登場時自身獲得2層八荒，若對方上回合主動切換則額外獲得2層；回合結束時對方當回合若使用技能則失去1層八荒，若對方當回合未使用技能則獲得1層八荒，若對方主動切換精靈時則額外獲得2層八荒並附加墮魔印記；自身擊敗對手時消除自身所有的八荒層數；八荒層數效果（同時獲得該層及以下所有效果）：1層：每有1層自身攻擊威力提升13%；2層：每有1層技能附加39點固傷；3層：回合結束吸取對手所有技能2點PP與1/3最大體力，若被免疫百分比傷害則改為造成300點真實傷害並自身獲得1層伏魔印記；5層：回合結束恢復自身1/3最大體力與已損失體力1/3，並有50%機率使對手下回合技能失效；7層：回合結束獲得等同於自身伏魔印記層數的防禦護罩，並吸取對手等同於對方墮魔印記層數的能力提升狀態；8層：若對手持有墮魔印記，上述效果翻倍；若自身持有伏魔印記，計算八荒層數時視為翻倍（僅強化已解鎖效果，無法提前解鎖高層效果）；9層：當達到9層時觸發誅魔天陣，持續9回合；誅魔天陣：期間對方每次受到任意傷害時體力始終無法高於上次受到傷害前，自身受非真實傷害降低等同於對方已損失體力(可降低至0)；天陣正常結束關閉時，自身體力降為1、清空所有技能PP且1回合內自身無法主動切換精靈',
        combatLog: '👑 帝威顯赫！【荒】之魂印凝聚人皇氣魄，震懾八荒！'
      },
      mechanics: {
        target: 'SELF',
        maxStacks: 9,
        enterGainStacks: 2,
        enterBonusStacksIfOpponentSwitched: 2,
        turnEndLoseStackIfOpponentUsedSkill: 1,
        turnEndGainStackIfOpponentIdle: 1,
        turnEndGainStackIfOpponentSwitched: 2,
        turnEndApplyMarkIfOpponentSwitched: '墮魔印記',
        onKillClearStacks: true,
        stack1AttackBoostPerStackPercent: 13,
        stack2FixedDamagePerStack: 39,
        stack3DrainPpAll: 2,
        stack3DrainMaxHpPercent: 0.33,
        stack3ImmuneFallbackTrueDamage: 300,
        stack3ImmuneFallbackGrantMark: '伏魔印記',
        stack5HealMaxHpPercent: 0.33,
        stack5HealLostHpPercent: 0.33,
        stack5DisableOpponentNextSkillChance: 50,
        stack7ShieldPerFumoStack: true,
        stack7StealBuffsPerDuomoStack: true,
        stack8DoubleEffectsIfDuomo: true,
        stack8DoubleStacksCalculationIfFumo: true,
        stack9TriggerZhumoArrayDuration: 9,
        zhumoArraySealLostHp: true,
        zhumoArrayDamageReductionEqualSealedHp: true,
        zhumoArrayEndHpTo1: true,
        zhumoArrayEndClearPp: true,
        zhumoArrayEndLockSwitchTurns: 1
      }
    },
    bahuang_stacks: {
      id: 'mark.bahuang',
      effectClass: 'MARK',
      polarity: 'POSITIVE',
      flavor: {
        name: '八荒',
        description: '每層提升自身攻擊威力13%與技能附加39點固傷；疊加高層解鎖吸血、PP吸取、技能失效與誅魔天陣等無上神威',
        combatLog: '⚡ 八荒之力匯聚，人皇帝威愈加鼎盛！'
      },
      mechanics: {
        maxStacks: 9,
        target: 'SELF',
        keepOnSwitch: true
      }
    },
    fumo_mark: {
      id: 'mark.fumo',
      effectClass: 'MARK',
      polarity: 'POSITIVE',
      flavor: {
        name: '伏魔印記',
        description: '持有者在計算八荒層數效果時視為翻倍（僅強化已解鎖效果，無法提前解鎖高層效果），7層時轉化為等量防禦護罩',
        combatLog: '🔥 伏魔印記加身，神威效果加倍！'
      },
      mechanics: {
        target: 'SELF',
        doubleStackEffects: true
      }
    },
    duomo_mark: {
      id: 'mark.duomo',
      effectClass: 'MARK',
      polarity: 'NEGATIVE',
      flavor: {
        name: '墮魔印記',
        description: '對手持有此印記時，八荒8層以上效果對其翻倍；7層時將被吸取等同於印記層數的能力提升狀態',
        combatLog: '💀 墮魔印記烙印，對手陷入人皇天威之下！'
      },
      mechanics: {
        target: 'OPPONENT',
        amplifyBahuangEffects: true
      }
    },
    zhumo_array: {
      id: 'mark.zhumo_array',
      effectClass: 'TURN',
      polarity: 'POSITIVE',
      flavor: {
        name: '誅魔天陣',
        description: '持續9回合；期間對方每次受到任意傷害時體力始終無法高於上次受到傷害前，自身受非真實傷害降低等同於對方已損失體力(可降低至0)；天陣正常結束關閉時，自身體力降為1、清空所有技能PP且1回合內自身無法主動切換精靈',
        combatLog: '🌌 誅魔天陣展開！八荒禁錮，天地震懾！'
      },
      mechanics: {
        duration: 9,
        target: 'SELF',
        sealOpponentLostHp: true,
        reduceDamageBySealedHp: true,
        endPenaltyHp1: true,
        endPenaltyClearPp: true,
        endPenaltyLockSwitch: 1
      }
    }
  },
  skills: {
    '鹿台悲歌': [
      {
        id: 'dixin.lutai.innate',
        effectClass: 'INNATE',
        flavor: { name: '鹿台悲歌', description: '（無特殊效果）' },
        mechanics: {
          category: '物理',
          type: '遠古',
          accuracy: 100
        }
      },
      {
        id: 'dixin.lutai.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '鹿台悲歌', description: '全屬性+1，若當前八荒大於3層則效果翻倍；吸取對手等同於自身八荒層數×139點體力；附加自身2層八荒', combatLog: '鹿台悲歌起，人皇吸取生機與天地靈氣！' },
        mechanics: {
          target: 'SELF',
          allStatUp: 1,
          allStatUpBonusIfStackGt: { stack: 3, bonus: 1, mark: '八荒' },
          drainHpByStackMult: { mark: '八荒', mult: 139 },
          grantStacks: { mark: '八荒', count: 2 }
        }
      },
      {
        id: 'dixin.lutai.turn',
        effectClass: 'TURN',
        polarity: 'POSITIVE',
        flavor: { name: '先制與狂暴', description: '下2回合自身先制+2；為自身附加3回合狂暴狀態', combatLog: '悲歌響徹鹿台，人皇進入狂暴姿態！' },
        mechanics: {
          priorityBoostTurn: { duration: 2, val: 2 },
          applyStatusSelf: { status: '狂暴', duration: 3 }
        }
      }
    ],
    '人皇御宇': [
      {
        id: 'dixin.yuyu.innate',
        effectClass: 'INNATE',
        flavor: { name: '先制特效', description: '必中；當八荒大於等於3層時，此技能先制+3' },
        mechanics: {
          category: '屬性',
          type: '無屬性',
          accuracy: 100,
          priorityBonusIfStackGte: { stack: 3, bonus: 3, mark: '八荒' }
        }
      },
      {
        id: 'dixin.yuyu.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '臣服與星賜壓制', description: '令對手附加3回合臣服，若未觸發則為自身附加3回合星賜狀態並使對手下2回合攻擊技能無效', combatLog: '人皇降下旨意，令天威莫敢不服！' },
        mechanics: {
          target: 'OPPONENT',
          inflictStatus: '臣服',
          duration: 3,
          fallbackSelfStatus: { status: '星賜', duration: 3 },
          fallbackOpponentAttackInvalid: 2
        }
      },
      {
        id: 'dixin.yuyu.turn',
        effectClass: 'TURN',
        polarity: 'NEGATIVE',
        flavor: { name: '檢定與生命吸取', description: '4回合內對手使用屬性技能時令對手下回合攻擊技能命中效果失效且無法造成技能傷害；4回合內每回合結束時吸取對手1/3最大體力，若對方未受到百分比傷害則附加300點真實傷害且附加自身1層伏魔印記', combatLog: '帝辛立下天道檢定，吸取天地生機！' },
        mechanics: {
          target: 'OPPONENT',
          duration: 4,
          inspectAttributeSkillPenalty: { missNextAttack: true, noDamageNextAttack: true },
          turnEndDrainMaxHpPercent: 0.33,
          fallbackTrueDamage: 300,
          fallbackGrantMark: '伏魔印記'
        }
      }
    ],
    '帝怒傾天': [
      {
        id: 'dixin.dinu.innate',
        effectClass: 'INNATE',
        flavor: { name: '固有神威', description: '必中；自身處於能力下降狀態時先制+3；對手處於能力提升狀態時先制+3；當八荒大於等於3層時，攻擊無視對手傷害降低、減少效果；將對手能力提升效果視為能力下降；將自身能力下降效果視為能力提升；對手每有1級能力提升此技能威力提升30點' },
        mechanics: {
          category: '物理',
          type: '遠古',
          accuracy: 100,
          alwaysHit: true,
          priorityBonusIfSelfDebuffed: 3,
          priorityBonusIfOpponentBuffed: 3,
          ignoreDefIfStackGte: { stack: 3, mark: '八荒' },
          ignoreDamageReductionIfStackGte: { stack: 3, mark: '八荒' },
          invertOpponentBuffs: true,
          invertSelfDebuffs: true,
          powerBoostPerOpponentBuffLevel: 30
        }
      },
      {
        id: 'dixin.dinu.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '固定傷害', description: '自身每有1級能力下降此技能附加對手60點固定傷害', combatLog: '天子一怒，乾坤顛倒，威能毀天滅地！' },
        mechanics: {
          target: 'OPPONENT',
          fixedDamagePerSelfDebuffLevel: 60
        }
      }
    ],
    '玄鳥天命': [
      {
        id: 'dixin.xuanniao.innate',
        effectClass: 'INNATE',
        flavor: { name: '玄鳥先制', description: '自身每有1層八荒則當回合額外先制+1' },
        mechanics: {
          category: '物理',
          type: '遠古',
          accuracy: 100,
          priorityPerStack: { mark: '八荒', bonus: 1 }
        }
      },
      {
        id: 'dixin.xuanniao.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '消回合與控制', description: '附加自身2層八荒；消除對手回合類效果，成功消除時令對手疲憊，未觸發則100%令對手害怕', combatLog: '天命玄鳥降下神罰，破除對手庇護！' },
        mechanics: {
          target: 'OPPONENT',
          grantStacks: { mark: '八荒', count: 2 },
          clearTurnEffects: true,
          statusOnClearSuccess: '疲憊',
          statusOnClearFail: '害怕'
        }
      },
      {
        id: 'dixin.xuanniao.turn',
        effectClass: 'TURN',
        polarity: 'NEGATIVE',
        flavor: { name: '禁療咒縛', description: '1回合內令對手體力恢復量降低100%', combatLog: '天命封印了對手的氣息，使其無法療傷！' },
        mechanics: {
          target: 'OPPONENT',
          duration: 1,
          disableHeal: true
        }
      }
    ],
    '九鼎震八荒': [
      {
        id: 'dixin.jiuding.innate',
        effectClass: 'INNATE',
        flavor: { name: '九鼎固有', description: '必中；此技能使用成功後效果每場戰鬥只能生效一次，此後該技能失去必中效果且命中率歸0，但選擇該技能時令對方當回合先制-4' },
        mechanics: {
          category: '物理',
          type: '遠古',
          accuracy: 100,
          alwaysHit: true,
          isFifthSkill: true,
          oncePerBattle: true
        }
      },
      {
        id: 'dixin.jiuding.hit',
        effectClass: 'ON_HIT',
        flavor: { name: '九鼎神威', description: '使用後附加自身9層八荒，且9回合內自身八荒層數不再減少；攜帶此技能且使用成功後效果存在時若擊敗對手，會立刻關閉誅魔天陣並觸發關閉懲罰效果；技能無效時，消除對方回合類效果，100%令對方神遊', combatLog: '🔥 九鼎共鳴，八荒震動！人皇施展無上神威！' },
        mechanics: {
          grantStacks: { mark: '八荒', count: 9 },
          lockStackReductionDuration: 9,
          onKillCloseZhumoArrayAndTriggerPenalty: true
        }
      }
    ]
  }
};
