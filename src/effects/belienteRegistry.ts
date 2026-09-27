import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

export const handleBelienteSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  switch (event) {
    case EffectTiming.ON_ENTRANCE:
      addLog(`✨ 【蓓】：星執解放，蓓麗安特守護己方！`, "effect");
      // 透過戰鬥註冊表狀態傳遞星執
      const regKey = actor === "p1" ? "p1RegistryState" : "p2RegistryState";
      ctx.setPlayerState("belienteStarBearer", true);
      break;

    case "BEFORE_SWITCH_OUT":
      if (getPlayerState("BelienteVaultTurns") > 0) {
        addLog(`✨ 【蓓】：星河祈願，為下一位同伴降下祝福！`, "effect");
        setPlayerState("nextElfStarGift", true);
        setPlayerState("BelienteVaultTurns", 0);
      }
      break;

    case EffectTiming.ROUND_END:
      if (getPlayerState("BelienteRegenTurns") > 0) {
        const regenAmt = Math.floor(self.maxHp / 2);
        applyHeal(actor, regenAmt);
        ctx.applyTrueDamage(oppSide, regenAmt, "星能沐浴");
        setPlayerState("BelienteRegenTurns", getPlayerState("BelienteRegenTurns") - 1);
      }
      break;
  }

  return false;
};

export const BELIENTE_SKILLS: Record<string, BattleSkillHandler> = {
  "星垂穹儀": (context) => {
    const { self, target, actor, setPlayerState, getPlayerState, addLog } = context;
    // ... (保持原有的技能邏輯，但確保符合規範)
    addLog(`✨ 【星垂穹儀】：星辰運轉，命運干涉！`, "effect");
    setPlayerState("ImmuneStatDebuffTurns", 5);
    setPlayerState("DmgToHealNextTurn", true);
    setPlayerState("BelienteVaultTurns", 1);
    // 🎯 反轉自身能力下降狀態，反轉成功則使對手隨機2個技能PP歸零
    const stages: Record<string, number> = { ...(self.statStages || {}) } as any;
    const neg = Object.keys(stages).filter(k => (stages[k] || 0) < 0);
    if (neg.length > 0) {
      const delta: Record<string, number> = {};
      neg.forEach(k => { delta[k] = -2 * stages[k]; });
      context.applyStatChange(actor, delta);
      const rnd = context.rng ?? Math.random;
      const idx = (target.skills || []).map((_, i) => i).filter(i => (target.skills[i].pp ?? 0) > 0);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.slice(0, 2).forEach(i => { target.skills[i].pp = 0; });
      addLog(`✨ 【星垂穹儀】：反轉自身能力下降狀態，令對手隨機 ${Math.min(2, idx.length)} 個技能 PP 歸零！`, "effect");
    }
  },
  "星河入眸": (context) => {
    const { self, setPlayerState, addLog } = context;
    addLog(`✨ 【星河入眸】：萬千星辰，皆入我眸！`, "effect");
    setPlayerState("BelienteRegenTurns", 4);
    setPlayerState("DodgeTurns", 5);
  }
};

export const BelienteDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'beliente',
  name: '蓓麗安特',
  soulMark: {
    bei_soul: {
      id: 'mark.bei_soul',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '蓓',
        description: '戰鬥開始時己方獲得星執：記錄蓓麗安特的異常抗性的所有最高項，己方所有精靈進入上述記錄的異常狀態時轉化為3回合星賜但失去全免抗性。蓓麗安特被擊敗/死亡時解放星執，消逝自身並化身為星執者，星執者的初始擁有等同於蓓麗安特本次登場時最大體力的能量，己方其他精靈被擊敗時，星執者額外獲得300點能量，失去所有能量後星執者消失。',
        combatLog: '星執解放，蓓麗安特化身星執者！'
      },
      mechanics: {
        target: 'SELF',
        maxStacks: 9999, // Energy storage
        recordResistance: true,
        transformToStarGiftOnStatus: true,
        starGiftDuration: 3,
        onDeathTransformToStarBearer: true
      }
    }
  },
  skills: {
    '曙天': [
      {
        id: '曙天.innate',
        effectClass: 'INNATE',
        flavor: { name: '曙光先制', description: '先制+3；必中；消除對手回合類效果。' },
        mechanics: { priority: 3, alwaysHit: true, clearTurnEffects: true }
      },
      {
        id: '曙天.onhit',
        effectClass: 'ON_HIT',
        flavor: { name: '束縛與吸取', description: '消除成功則 100% 令對手束縛，未觸發則本次造成的攻擊傷害翻倍；吸取對手能力提升狀態，成功則對手隨機 2 項技能 PP 值歸零；傷害大於 300 吸取最大體力 1/3，傷害小於 300 自身下 1 次攻擊先制+1。' },
        mechanics: { 
          target: 'OPPONENT', 
          inflictStatus: '束縛', 
          onFailDoubleDamage: true, 
          stealAndClearBuffs: true, 
          stealPpOnSuccess: 2, 
          thresholdDamage: 300, 
          absorbHpOnHighDamage: 0.33, 
          priorityBonusOnLowDamage: 1 
        }
      }
    ],
    '星垂穹儀': [
      {
        id: '星垂穹儀.innate',
        effectClass: 'INNATE',
        flavor: { name: '防禦強化', description: '必中；若自身處於能力下降狀態則先制+3；5回合內自身免疫受到的能力下降狀態；令自身下1次受到的攻擊傷害轉化為體力；反轉自身能力下降狀態，反轉成功則使對手隨機2個技能PP歸零；自身下次主動切換下場後令己方下只精靈出戰時抵擋下次受到的技能傷害、恢復300點體力並附加3回合星賜' },
        mechanics: { priority: 0, conditionalPriorityBonus: 3, immunity: '能力下降', duration: 5, alwaysHit: true }
      },
      {
        id: '星垂穹儀.onhit',
        effectClass: 'ON_HIT',
        flavor: { name: '能力反轉', description: '反轉自身能力下降狀態，成功則對手隨機 2 項技能 PP 歸零。' },
        mechanics: { target: 'SELF', reverseDebuffs: true, stealPpOnSuccess: 2 }
      }
    ],
    '星河入眸': [
      {
        id: '星河入眸.innate',
        effectClass: 'INNATE',
        flavor: { name: '全屬性提升', description: '必中；全屬性+2；3回合內自身能力提升狀態無法被消除或吸取；5回合內自身免疫並反彈所有受到的異常狀態；下2回合令自身使用所有技能先制+3。' },
        mechanics: { alwaysHit: true, allStatUp: 2, immunity: '全狀態', antiReflection: true, priorityBonus: 3, duration: 2 }
      },
      {
        id: '星河入眸.turn',
        effectClass: 'TURN',
        polarity: 'POSITIVE',
        flavor: { name: '閃避與恢復', description: '4回合內每回合使用技能恢復自身最大體力的 1/2 並造成等量百分比傷害；3回合內使用技能汲取對手 240 點體力；5回合內 100% 閃避對手的攻擊技能，效果結束後恢復自身所有技能 3 點 PP 值與 1/3 最大體力。' },
        mechanics: { duration: 4, healMaxHpPercent: 0.5, damageMirror: true, drainHp: 240, dodgeAttacks: true, onEndRecoverPp: 3, onEndRecoverHp: 0.33 }
      }
    ],
    '星祈·繞指星瀾': [
      {
        id: '星祈.effect',
        effectClass: 'ON_HIT',
        flavor: { name: '星祈天敵', description: '遇天敵先制+3；自身為天敵時威力翻倍並附加等同對手體力上限 100% 的真實傷害；消耗自身體力，己方下隻出戰精靈先手且獲得體力上限等量的能量。' },
        mechanics: { target: 'OPPONENT', conditionalPriorityBonus: 3, powerMultiplier: 2, trueDamagePercent: 1.0, consumeAllHp: true, nextElfGuaranteedFirst: true, nextElfEnergyGain: 'maxHp' }
      }
    ],
    '星執·浩邃星幕': [
      {
        id: '星執.innate',
        effectClass: 'INNATE',
        flavor: { name: '異常轉化', description: '必中；將對手所有異常狀態轉化為自身星執最高項異常，吸取對手最大體力 1/3；對手 3 回合內屬性技能無效；3 回合內使用技能後 100% 隨機附加 2 種弱化異常。' },
        mechanics: { alwaysHit: true, convertStatus: 'STAR_BEARER_RECORD', absorbMaxHpPercent: 0.33, sealUtilitySkills: 3, inflictWeakStatus: 2 }
      },
      {
        id: '第五.invalidation',
        effectClass: 'ON_HIT',
        flavor: { name: '擊敗特效', description: '當回合擊敗對手則令對手下隻登場精靈首次使用的技能所附加的效果失效。' },
        mechanics: { target: 'OPPONENT', skillEffectInvalidation: true }
      }
    ]
  }
};
