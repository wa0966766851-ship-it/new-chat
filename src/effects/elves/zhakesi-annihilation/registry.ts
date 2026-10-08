import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';
import { Elf } from '../../../types';

export const handleAnnihilationLordSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, setOpponentState, addLog, applyHeal, applyTrueDamage, applyStatChange } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // Helper for checking the presence of a mark
  const oppMarks = ctx.getMarks(oppSide) || [];
  const selfMarks = ctx.getMarks(actor) || [];

  switch (event) {
    case EffectTiming.ROUND_START: {
      // 1. 戰鬥開始時：獲得魔王咒怨（魔王咒怨初始 1 層，敵我背包每有 1 隻瞬殺額外獲得 1 層）
      const curseCalculated = getPlayerState("curseCalculated");
      if (!curseCalculated) {
        setPlayerState("curseCalculated", true);
        let extra = 0;
        const p1Team = ctx.getFullTeam("p1") || [];
        const p2Team = ctx.getFullTeam("p2") || [];
        const allElves = [...p1Team, ...p2Team];
        allElves.forEach(elf => {
          if (elf && elf.alienTraits?.generalTrait?.name === "瞬殺") {
            extra += 1;
          }
        });
        const initialLayers = 1 + extra;
        ctx.setMark({ id: "demon_grudge", name: "魔王咒怨", count: initialLayers, displayChar: "魔", description: "魔王咒怨：每層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%機率造成不低於對手最大體力的傷害，最高5層附加免疫控制" }, actor);
        addLog(`👿 【魔】：戰鬥開始！獲得 ${initialLayers} 層【魔王咒怨】（初始 1 層 + 敵我背包內 ${extra} 隻擁有【瞬殺】的精靈）！`, "effect");
      }

      // 2. 恐懼之花每回合開始使在場精靈進入害怕狀態
      const curTurn = getPlayerState("currentTurnNumber") || 0;
      const flowerTriggeredTurn = getPlayerState("flowerTriggeredTurn") || -1;
      if (flowerTriggeredTurn !== curTurn) {
        setPlayerState("flowerTriggeredTurn", curTurn);
        const hasFlower = oppMarks.some(m => m.id === "fear_flower");
        if (hasFlower) {
          addLog(`🌸 【恐懼之花】：令對手進入害怕狀態！`, "effect");
          ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
        }
      }
      break;
    }

    case EffectTiming.BEFORE_SKILL: {
      // 3. 對手使用技能時
      if (self.id === ctx.activeP1.id || self.id === ctx.activeP2.id) {
        if (self.currentHp >= self.maxHp) {
          // 滿體力：消除對手回合類效果與能力提升狀態
          addLog(`👿 【魔】：自身滿體力！消除對手回合類效果與能力提升狀態！`, "effect");
          ctx.clearTurnEffectsOf(oppSide);
          const oppElf = ctx.target;
          const nextStages = { ...oppElf.statStages };
          let changed = false;
          for (const [k, v] of Object.entries(nextStages)) {
            if ((v as number) > 0) {
              nextStages[k as any] = 0;
              changed = true;
            }
          }
          if (changed) {
            ctx.updateElf(oppSide, { id: oppElf.id, statStages: nextStages });
          }
        } else {
          // 不為滿體力：獲得等同於已損失體力值 50% 的護盾與護罩
          const lostHp = self.maxHp - self.currentHp;
          if (lostHp > 0) {
            const shieldVal = Math.floor(lostHp * 0.5);
            const initialShieldSum = (self.shield || 0) + (self.barrier || 0);
            setPlayerState("lordInitialShieldSum", initialShieldSum);

            self.shield = (self.shield || 0) + shieldVal;
            self.barrier = (self.barrier || 0) + shieldVal;
            ctx.updateElf(actor, { id: self.id, shield: self.shield, barrier: self.barrier });
            addLog(`👿 【魔】：未滿體力！獲得 ${shieldVal} 點護盾與護罩！`, "effect");
          }
        }
      }
      break;
    }

    case EffectTiming.ROUND_END: {
      // 4. 當回合戰鬥階段結束時：恢復回合開始時自身所擁有護盾、護罩之和的體力
      const initialShieldSum = getPlayerState("lordInitialShieldSum") || 0;
      if (initialShieldSum > 0) {
        applyHeal(actor, initialShieldSum);
        addLog(`👿 【魔】：戰鬥階段結束，魔王之魂甦醒！恢復回合開始時護盾與護罩之和的 ${initialShieldSum} 點體力！`, "heal");
        setPlayerState("lordInitialShieldSum", 0);
      }

      // 5. 萬念劫灰每回合結束吸血效果
      const drainHpTurns = getPlayerState("drainHpTurns") || 0;
      if (drainHpTurns > 0) {
        setPlayerState("drainHpTurns", drainHpTurns - 1);
        const isLowHp = self.currentHp < self.maxHp * 0.5;
        const ratio = isLowHp ? (2 / 3) : (1 / 3);
        const oppElf = ctx.target;
        
        const dmg = Math.floor(oppElf.maxHp * ratio);
        applyTrueDamage(oppSide, dmg, "萬念劫灰百分比傷害");
        applyHeal(actor, dmg);
        addLog(`🥀 【萬念劫灰】：吸取對手最大體力的 ${isLowHp ? "2/3" : "1/3"}（${dmg} 點體力）！`, "effect");
      }
      break;
    }

    case EffectTiming.ON_KILL: {
      // 6. 自身擊敗對手時：自身所有能力值提升 35 點並獲得 2 層魔王咒怨
      if (self.calculatedStats) {
        self.calculatedStats.atk = (self.calculatedStats.atk || 0) + 35;
        self.calculatedStats.def = (self.calculatedStats.def || 0) + 35;
        self.calculatedStats.spatk = (self.calculatedStats.spatk || 0) + 35;
        self.calculatedStats.spdef = (self.calculatedStats.spdef || 0) + 35;
        self.calculatedStats.speed = (self.calculatedStats.speed || 0) + 35;
        ctx.updateElf(actor, { id: self.id, calculatedStats: self.calculatedStats });
      }
      const grudge = selfMarks.find(m => m.id === "demon_grudge");
      const currentCount = grudge ? (grudge.count || 1) : 0;
      ctx.setMark({ id: "demon_grudge", name: "魔王咒怨", count: currentCount + 2, displayChar: "魔", description: "魔王咒怨：每層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%機率造成不低於對手最大體力的傷害，最高5層附加免疫控制" }, actor);
      addLog(`👿 【魔】：擊敗對手！自身所有能力值提升 35 點，【魔王咒怨】增加 2 層（目前：${currentCount + 2} 層）！`, "effect");
      break;
    }

    case EffectTiming.DEATH_NODE_1:
    case EffectTiming.DEATH_NODE_2: {
      // 7. 自身被擊敗時：令對手的體力上限減少 35%
      const oppElf = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
      if (oppElf) {
        const reduceAmt = Math.floor(oppElf.maxHp * 0.35);
        oppElf.maxHp = Math.max(1, oppElf.maxHp - reduceAmt);
        if (oppElf.currentHp > oppElf.maxHp) oppElf.currentHp = oppElf.maxHp;
        ctx.updateElf(oppSide, { id: oppElf.id, maxHp: oppElf.maxHp, currentHp: oppElf.currentHp });
        addLog(`💀 【湮滅之咒】：被擊敗之時，將萬念寂滅之咒種在對手【${oppElf.name}】身上！使其體力上限減少 35%（-${reduceAmt} 點）！`, "effect");
      }
      break;
    }
  }

  return false;
};

export const ZHAKESI_ANNIHILATION_SKILLS: Record<string, BattleSkillHandler> = {
  "無限・虛數湮滅": (ctx) => {
    const { self, actor, addLog, applyHeal, applyPercentDamage } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`👿 【無限・虛數湮滅】：釋放虛數湮滅之波！`, "effect");

    // Helper for tryInstantKill
    const tryInstantKill = (chance: number, reason: string): boolean => {
      const actorMarks = ctx.getMarks(actor) || [];
      const hasSeed = actorMarks.some(m => m.id === "fear_seed");
      const hasFlower = actorMarks.some(m => m.id === "fear_flower");
      if (hasSeed || hasFlower) {
        addLog(`🦇 【恐懼限制】：處於恐懼狀態，無法觸發秒殺效果！`, "effect");
        return false;
      }
      const oppTeam = ctx.getFullTeam(oppSide) || [];
      const activeOpp = oppSide === "p1" ? ctx.activeP1 : ctx.activeP2;
      const isLordInBackpack = oppTeam.some(e => e.name.includes("湮滅之主") && e.id !== activeOpp?.id && e.currentHp > 0 && !e.isVanished);
      if (isLordInBackpack) {
        addLog(`🛡️ 【湮滅之主】：對手背包內的湮滅之主令秒殺效果失效！並為其凝聚魔王咒怨！`, "effect");
        const oppMarks = ctx.getMarks(oppSide) || [];
        const grudge = oppMarks.find(m => m.id === "demon_grudge");
        const count = grudge ? (grudge.count || 1) : 0;
        ctx.setMark({ id: "demon_grudge", name: "魔王咒怨", count: count + 1, displayChar: "魔", description: "魔王咒怨：每層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%機率造成不低於對手最大體力的傷害，最高5層附加免疫控制" }, oppSide);
        return false;
      }
      const roll = ctx.rng ? ctx.rng() : Math.random();
      if (roll < chance) {
        addLog(`💀 【秒殺觸發】：${reason}觸發成功！秒殺對手！`, "effect");
        const grudgeMark = actorMarks.find(m => m.id === "demon_grudge");
        if (grudgeMark && (grudgeMark.count || 0) >= 1) {
          addLog(`👿 【魔王咒怨】：連鎖反應！選擇對方所有體力與秒殺目標相同的精靈一同秒殺！`, "effect");
          const targetHp = ctx.target.currentHp;
          oppTeam.forEach(elf => {
            if (elf && elf.currentHp === targetHp && !elf.isVanished) {
              ctx.applyTrueDamage(oppSide, elf.currentHp, "咒怨連鎖秒殺");
            }
          });
        } else {
          ctx.applyTrueDamage(oppSide, ctx.target.currentHp, "秒殺");
        }
        return true;
      }
      return false;
    };

    // 1. 消除對手回合類效果，消除成功則令對手疲憊，未觸發則 100% 令對手詛咒
    const clearedTurns = ctx.clearTurnEffectsOf(oppSide);
    if (clearedTurns) {
      addLog(`👿 【無限・虛數湮滅】：消除對手回合類效果成功！令對手疲憊！`, "status");
      ctx.applyStatusWithImmunityCheck(oppSide, "疲憊", 1);
    } else {
      ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 1);
    }

    // 2. 消除對手能力提升狀態，消除成功則令對手害怕，未觸發則 100% 令對手詛咒
    const oppElf = ctx.target;
    const nextStages = { ...oppElf.statStages };
    let hasBuff = false;
    for (const [k, v] of Object.entries(nextStages)) {
      if ((v as number) > 0) {
        nextStages[k as any] = 0;
        hasBuff = true;
      }
    }
    if (hasBuff) {
      ctx.updateElf(oppSide, { id: oppElf.id, statStages: nextStages });
      addLog(`👿 【無限・虛數湮滅】：消除對手能力提升狀態成功！令對手害怕！`, "status");
      ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    } else {
      ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 1);
    }

    // 3. 2 回合內令對手使用的屬性技能無效
    ctx.setOpponentState("utilitySkillInvalidTurns", 2);
    ctx.setOpponentState("utilitySkillInvalidReason", "無限・虛數湮滅屬性封鎖");

    // 4. 恢復自身最大體力 1/1 並附加對手等量百分比傷害
    applyHeal(actor, self.maxHp);
    applyPercentDamage(oppSide, 1.0);
  },

  "沉寂・永夜悼亡": (ctx) => {
    const { self, actor, addLog, applyHeal } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`👿 【沉寂・永夜悼亡】：永夜降臨，萬物皆哀！`, "effect");

    // 1. 免疫下 2 次自身受到的異常狀態
    ctx.setPlayerState(`${actor}_immuneStatusCount`, 2);

    // 2. 100% 令對手詛咒，未觸發則恢復自身最大體力的 1/1 體力且 3 回合內自身受到的傷害不超過 200
    const res = ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 3);
    if (!res.success) {
      applyHeal(actor, self.maxHp);
      ctx.setPlayerState("dmgLimit200Turns", 3);
      addLog(`🛡️ 【沉寂・永夜悼亡】：對手免疫詛咒！自身體力全滿，且 3 回合內受到的攻擊傷害不超過 200！`, "effect");
    }

    // 3. 下 2 回合造成的攻擊傷害額外提升 150%
    ctx.setPlayerState("damageBoostTurns", 2);

    // 4. 3 回合內自身使用所有攻擊技能都附有 15% 的秒殺機率
    ctx.setPlayerState("instantKillChanceTurns", 3);
    ctx.setPlayerState("instantKillChance", 0.15);
  },

  "崩解・萬念劫灰": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`👿 【崩解・萬念劫灰】：崩解之劫，萬念皆灰！`, "effect");

    // 1. 全屬性 +1，自身處於能力提升狀態時強化效果翻倍
    const hasBuff = Object.values(self.statStages || {}).some(v => (v as number) > 0);
    const boost = hasBuff ? 2 : 1;
    ctx.applyStatChange(actor, { atk: boost, def: boost, spatk: boost, spdef: boost, speed: boost, accuracy: boost });
    addLog(`👿 【崩解・萬念劫灰】：強化！全屬性 +${boost}！`, "effect");

    // 2. 4 回合內每回合使用技能吸取對手最大體力的 1/3 (ROUND_END 中處理)
    ctx.setPlayerState("drainHpTurns", 4);

    // 3. 2 回合內令自身無效對手的攻擊技能
    ctx.setPlayerState("ignoreOppAttackTurns", 2);

    // 4. 下 2 回合攻擊忽略對手 34% 的雙防值
    ctx.setPlayerState("ignoreDefPercentTurns", 2);

    // 5. 下 2 回合令自身所有技能先制 +3
    ctx.setPlayerState("nextTurnPriority", 3);
  },

  "劫數・限界歸無": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`👿 【劫數・限界歸無】：限界破滅，萬物歸無！`, "effect");

    // 1. 反轉自身能力下降狀態，反轉成功則附加給對手等同的能力下降狀態
    const newSelfStages = { ...self.statStages };
    const oppStages = { ...ctx.target.statStages };
    let success = false;
    for (const [k, v] of Object.entries(newSelfStages)) {
      if ((v as number) < 0) {
        newSelfStages[k as any] = -(v as number);
        oppStages[k as any] = (oppStages[k as any] || 0) + (v as number);
        success = true;
      }
    }
    if (success) {
      ctx.updateElf(actor, { id: self.id, statStages: newSelfStages });
      ctx.updateElf(oppSide, { id: ctx.target.id, statStages: oppStages });
      addLog(`👿 【劫數・限界歸無】：成功反轉能力下降，並將等量下降狀態送給對手！`, "effect");
    }

    // 2. 令對方背包內(場上場下)體力上限最低的精靈體力上限提升至與自身相等並恢復等量體力，
    // 然後此精靈所有非體力上限的能力值減少提升的數值，最多減少100點且最多減少至1
    const oppTeam = ctx.getFullTeam(oppSide) || [];
    const livingOppElves = oppTeam.filter(e => !e.isVanished && e.currentHp > 0);
    if (livingOppElves.length > 0) {
      livingOppElves.sort((a, b) => a.maxHp - b.maxHp);
      const targetElf = livingOppElves[0];
      const diff = self.maxHp - targetElf.maxHp;
      if (diff > 0) {
        targetElf.maxHp = self.maxHp;
        targetElf.currentHp = Math.min(targetElf.maxHp, targetElf.currentHp + diff);
        const reduceAmt = Math.min(100, diff);
        if (targetElf.calculatedStats) {
          targetElf.calculatedStats.atk = Math.max(1, (targetElf.calculatedStats.atk || 120) - reduceAmt);
          targetElf.calculatedStats.def = Math.max(1, (targetElf.calculatedStats.def || 120) - reduceAmt);
          targetElf.calculatedStats.spatk = Math.max(1, (targetElf.calculatedStats.spatk || 120) - reduceAmt);
          targetElf.calculatedStats.spdef = Math.max(1, (targetElf.calculatedStats.spdef || 120) - reduceAmt);
          targetElf.calculatedStats.speed = Math.max(1, (targetElf.calculatedStats.speed || 120) - reduceAmt);
        }
        ctx.updateAnyElf(oppSide, targetElf.id, { maxHp: targetElf.maxHp, currentHp: targetElf.currentHp, calculatedStats: targetElf.calculatedStats });
        addLog(`👿 【劫數・限界歸無】：強制平衡！對手【${targetElf.name}】體力上限提升至 ${self.maxHp}，但其各項基礎屬性暴跌 ${reduceAmt} 點！`, "effect");
      }
    }

    // 3. 未擊敗對手則令對方場下陣亡的首位精靈消逝；擊敗對手則對方下隻出戰時精靈首回合先制效果失效
    const oppActive = ctx.target;
    if (oppActive.currentHp > 0) {
      const deadElf = oppTeam.find(e => e.currentHp === 0 && !e.isVanished);
      if (deadElf) {
        ctx.vanishElf(oppSide, deadElf);
        addLog(`👿 【劫數・限界歸無】：未擊敗對手！使對手場下陣亡的【${deadElf.name}】徹底消逝！`, "effect");
      }
    } else {
      ctx.setOpponentState("nextElfNoPriority", true);
      addLog(`👿 【劫數・限界歸無】：擊敗對手！對手下一隻出場精靈的首回合先制效果失效！`, "effect");
    }
  },

  "絕滅・萬物哀鳴": (ctx) => {
    const { self, actor, addLog, applyHeal, applyTrueDamage } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`👿 【絕滅・萬物哀鳴】：萬物歸於死寂，絕滅之聲響起！`, "effect");

    // 1. 恢復對方精靈的全部體力
    applyHeal(oppSide, ctx.target.maxHp);

    // 2. 消耗此技能的全部 PP 值並獲得等量的魔王咒怨
    const fifthSkill = self.skills.find(s => s.name === "絕滅・萬物哀鳴");
    const ppUsed = fifthSkill ? (fifthSkill.pp || 0) : 5;
    if (fifthSkill) {
      fifthSkill.pp = 0;
      ctx.updateElf(actor, { id: self.id, skills: self.skills });
    }

    const curMarks = ctx.getMarks(actor) || [];
    const grudge = curMarks.find(m => m.id === "demon_grudge");
    const currentCount = grudge ? (grudge.count || 1) : 0;
    const nextCount = currentCount + ppUsed;
    ctx.setMark({ id: "demon_grudge", name: "魔王咒怨", count: nextCount, displayChar: "魔", description: "魔王咒怨：每層受到的攻擊傷害減少5%、造成的攻擊傷害提升5%、自身攻擊有3%機率造成不低於對手最大體力的傷害，最高5層附加免疫控制" }, actor);
    addLog(`👿 【絕滅・萬物哀鳴】：恢復對手全體力，消耗全部 ${ppUsed} 點 PP，獲得等量魔王咒怨！現有層數：${nextCount}！`, "effect");

    // 3. 若魔王咒怨層數高於 5 則秒殺對手且本次造成的攻擊傷害不低於對方所有精靈體力上限之和
    if (nextCount > 5) {
      addLog(`👿 【絕滅・萬物哀鳴】：咒怨層數 > 5！觸發絕滅秒殺！`, "effect");
      const oppTeam = ctx.getFullTeam(oppSide) || [];
      const sumOppHp = oppTeam.reduce((acc, curr) => acc + curr.maxHp, 0);
      applyTrueDamage(oppSide, sumOppHp, "絕滅之哀");
      ctx.setOpponentState("nextElfCurse", true);
    }
  }
};

export { ZhakesiAnnihilationDeconstructedProfile } from "../../../data/elfProfiles/zhakesiAnnihilationRegistry";
