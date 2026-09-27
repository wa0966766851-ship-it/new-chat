import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { Elf } from '../types';
import { clampSkillPp } from '../utils/battleHelpers';

export const handleFearIncarnationSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, setOpponentState, addLog, applyHeal, applyTrueDamage, applyStatChange } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // Helper for checking the presence of a mark
  const oppMarks = ctx.getMarks(oppSide) || [];
  const selfMarks = ctx.getMarks(actor) || [];

  switch (event) {
    case EffectTiming.ROUND_START: {
      // 1. 戰鬥開始時：為對手種下恐懼之種
      const seedPlanted = getPlayerState("seedPlanted");
      if (!seedPlanted) {
        setPlayerState("seedPlanted", true);
        ctx.setMark({
          id: "fear_seed",
          name: "恐懼之種",
          count: 1,
          displayChar: "種",
          description: "恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花",
          effects: {
            nonTrueDamageDealtMultiplier: 0.8,
            nonTrueDamageTakenMultiplier: 1.4,
            guaranteedMaxHpDamageChance: 0.20
          }
        }, oppSide);
        addLog(`🦇 【懼】：恐懼降臨！在對手【${ctx.target.name}】身上種下【恐懼之種】！`, "effect");
      }

      // 2. 登場或被害怕時提高恐懼之種層數 (對手換人登場)
      const lastOppId = getPlayerState("fearLastOppId");
      const currentOppId = ctx.target.id;
      if (lastOppId && lastOppId !== currentOppId) {
        const seedMark = oppMarks.find(m => m.id === "fear_seed");
        if (seedMark) {
          const nextCount = (seedMark.count || 1) + 1;
          if (nextCount >= 5) {
            ctx.clearMark("fear_seed", oppSide);
            ctx.setMark({
              id: "fear_flower",
              name: "恐懼之花",
              count: 1,
              displayChar: "花",
              description: "恐懼之花:持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果，每回合開始時恐懼之花會令在場精靈進入害怕狀態，造成非真實傷害降低50%，受到非真實傷害提升100%，每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害",
              effects: {
                nonTrueDamageDealtMultiplier: 0.5,
                nonTrueDamageTakenMultiplier: 2.0,
                guaranteedMaxHpDamageChance: 0.50
              }
            }, oppSide);
            addLog(`🌸 【恐懼蛻變】：對手精靈登場！【恐懼之種】達到 5 層，蛻變為【恐懼之花】！`, "effect");
          } else {
            ctx.setMark({
              id: "fear_seed",
              name: "恐懼之種",
              count: nextCount,
              displayChar: "種",
              description: "恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花",
              effects: {
                nonTrueDamageDealtMultiplier: 0.8,
                nonTrueDamageTakenMultiplier: 1.4,
                guaranteedMaxHpDamageChance: 0.20 + (nextCount - 1) * 0.02
              }
            }, oppSide);
            addLog(`🦇 【恐懼深淵】：對手精靈登場！【恐懼之種】提升至 ${nextCount} 層！`, "effect");
          }
        }
      }
      setPlayerState("fearLastOppId", currentOppId);

      // 3. 恐懼之花每回合開始令在場精靈進入害怕狀態
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

      // 4. 回合開始時：若自身滿體力則令對手 100% 害怕，未觸發則消除雙方能力上升、下降與回合類效果
      if (self.id === ctx.activeP1.id || self.id === ctx.activeP2.id) {
        if (self.currentHp >= self.maxHp) {
          addLog(`🦇 【懼】：自身體力全滿，釋放恐懼！`, "effect");
          const res = ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
          if (!res.success) {
            addLog(`🦇 【懼】：害怕被免疫！消除雙方能力變化與回合類效果！`, "effect");
            ctx.clearTurnEffectsOf("p1");
            ctx.clearTurnEffectsOf("p2");
            ctx.applyStatChange("p1", { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 });
            ctx.applyStatChange("p2", { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 });
          }
        }
      }
      break;
    }

    case EffectTiming.ROUND_END: {
      // 5. 自身存活在背包/場上時，每回合吸取所有精靈 20 點體力上限
      const p1Team = ctx.getFullTeam("p1") || [];
      const p2Team = ctx.getFullTeam("p2") || [];
      const allElves = [...p1Team, ...p2Team];
      let totalAbsorbed = 0;
      for (const elf of allElves) {
        if (elf.isVanished || elf.maxHp <= 1) continue;
        const reduceAmount = Math.min(20, elf.maxHp - 1);
        elf.maxHp -= reduceAmount;
        if (elf.currentHp > elf.maxHp) elf.currentHp = elf.maxHp;
        totalAbsorbed += reduceAmount;
        const teamSide = p1Team.some(e => e.id === elf.id) ? "p1" : "p2";
        ctx.updateElf(teamSide, { id: elf.id, maxHp: elf.maxHp, currentHp: elf.currentHp });
      }
      self.maxHp += totalAbsorbed;
      ctx.updateElf(actor, { id: self.id, maxHp: self.maxHp });
      addLog(`🦇 【懼】：魂印吸取！吸取敵我雙方所有精靈 20 點體力上限，自身體力上限增加 ${totalAbsorbed} 點！`, "effect");

      // 6. 自身在場上時，戰鬥階段結束恢復已損失體力 50% 的體力與 1 點 PP 值，同時對手受百分比傷害
      if (self.id === ctx.activeP1.id || self.id === ctx.activeP2.id) {
        const lostHp = self.maxHp - self.currentHp;
        if (lostHp > 0) {
          const healAmt = Math.floor(lostHp * 0.5);
          applyHeal(actor, healAmt);

          self.skills.forEach(s => {
            if (s.pp !== undefined) s.pp = clampSkillPp(s, s.pp + 1, self);
          });
          ctx.updateElf(actor, { id: self.id, skills: self.skills });

          const hpPercent = healAmt / self.maxHp;
          applyTrueDamage(oppSide, Math.floor(ctx.target.maxHp * hpPercent), "恐懼反哺百分比傷害");
          addLog(`🦇 【懼】：戰鬥階段結束，自身恢復損失體力的 50%（${healAmt} 點，+1 PP）！同時對手受到同等比例傷害！`, "heal");

          // 若對手體力未滿則全屬性-1且至少減至1，未觸發則對手下2回合無法切換
          const oppElf = ctx.target;
          if (oppElf.currentHp < oppElf.maxHp) {
            addLog(`🦇 【懼】：對手體力未滿！令對手全屬性下降 -1！`, "effect");
            applyStatChange(oppSide, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
          } else {
            addLog(`🦇 【懼】：對手體力全滿！封鎖其下 2 回合內無法切換精靈！`, "effect");
            ctx.setOpponentState("noSwitchTurns", 2);
          }
        }
      }

      // Decrement turn-based states
      const fearTurns = getPlayerState("skillFearTurns") || 0;
      if (fearTurns > 0) setPlayerState("skillFearTurns", fearTurns - 1);
      const damageBoostThisTurn = getPlayerState("damageBoostThisTurn");
      if (damageBoostThisTurn) setPlayerState("damageBoostThisTurn", 0);
      
      break;
    }

    case EffectTiming.AFTER_ACTION: {
      const fearTurns = getPlayerState("skillFearTurns") || 0;
      if (fearTurns > 0) {
        ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
        addLog(`🦇 【深淵凝視】：令對手陷入害怕狀態！`, "effect");
      }
      const priorityCount = getPlayerState("nextPriorityCount") || 0;
      if (priorityCount > 0) {
        setPlayerState("nextPriorityCount", priorityCount - 1);
      }
      const fixedCount = getPlayerState("nextAtkFixedDmgCount") || 0;
      if (fixedCount > 0 && ctx.skill?.category !== "屬性") {
        setPlayerState("nextAtkFixedDmgCount", fixedCount - 1);
      }
      break;
    }

    case EffectTiming.BEFORE_DAMAGE: {
      if (!extraData?.isIncoming) {
        // Attacking
        const fixedCount = getPlayerState("nextAtkFixedDmgCount") || 0;
        if (fixedCount > 0) {
          extraData.bonusFixed = (extraData.bonusFixed || 0) + 300;
          addLog(`🦇 【深淵凝視】：附加 300 點固定傷害！`, "effect");
        }
        const boost = getPlayerState("damageBoostThisTurn") || 0;
        if (boost > 0) {
          extraData.increasePercent = (extraData.increasePercent || 0) + boost;
          addLog(`🦇 【劫數・萬念歸墟】：當回合傷害提升 ${boost * 100}%！`, "effect");
        }
      } else {
        // Defending
        const hasShield = getPlayerState("shieldBlockNextAtk");
        if (hasShield) {
          extraData.multiplier = 0;
          setPlayerState("shieldBlockNextAtk", false);
          const dmg = Math.floor(ctx.target.maxHp / 3);
          ctx.applyTrueDamage(oppSide, dmg, "萬念歸墟反傷");
          addLog(`🦇 【劫數・萬念歸墟】：抵擋了本次攻擊，並對對手造成 ${dmg} 點真實傷害！`, "effect");
        }
      }
      break;
    }

    case EffectTiming.MODIFY_PRIORITY: {
      const priorityCount = getPlayerState("nextPriorityCount") || 0;
      if (priorityCount > 0 && extraData) {
        if (extraData.priorityComp) {
          extraData.priorityComp.bonus += 2;
        } else if (typeof extraData.bonus === "number") {
          extraData.bonus += 2;
        }
      }
      break;
    }

    case EffectTiming.ON_KILL: {
      const nextKillFear = getPlayerState("nextKillFearNextElf");
      if (nextKillFear) {
        setOpponentState("incomingElfFear", true);
        setPlayerState("nextKillFearNextElf", false);
      }
      break;
    }

    case "OPPONENT_SWITCH": {
      const incomingFear = ctx.getOpponentState("incomingElfFear");
      if (incomingFear) {
        ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
        addLog(`🦇 【懼噬・虛實逆寫】：對手新精靈首回合陷入害怕！`, "effect");
        setOpponentState("incomingElfFear", false);
      }
      break;
    }
  }

  return false;
};

export const ZHAKESI_FEAR_SKILLS: Record<string, BattleSkillHandler> = {
  "懼噬・恐源浸染": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const oppElf = ctx.target;
    addLog(`🦇 【懼噬・恐源浸染】：引爆恐怖源泉！`, "effect");

    const hasOppBuff = Object.values(oppElf.statStages || {}).some(v => (v as number) > 0);
    if (hasOppBuff) {
      addLog(`恢复自身全部體力！`, "heal");
      ctx.applyHeal(actor, self.maxHp);

      const oppStages = { ...oppElf.statStages };
      let inverted = false;
      for (const [k, v] of Object.entries(oppStages)) {
        if ((v as number) > 0) {
          oppStages[k as any] = -(v as number);
          inverted = true;
        }
      }
      if (inverted) {
        ctx.updateElf(oppSide, { id: oppElf.id, statStages: oppStages });
      } else {
        ctx.clearTurnEffectsOf(oppSide);
      }
    } else {
      const oppStages = { ...oppElf.statStages };
      for (const [k, v] of Object.entries(oppStages)) {
        if ((v as number) > 0) oppStages[k as any] = 0;
      }
      ctx.updateElf(oppSide, { id: oppElf.id, statStages: oppStages });
    }

    ctx.setOpponentState("noHealTurns", 3);
    ctx.setOpponentState("utilitySkillAddEffectInvalidTurns", 3);
  },

  "深淵凝視": (ctx) => {
    const { actor, addLog } = ctx;
    addLog(`🦇 【深淵凝視】：凝視無盡的恐懼深淵！`, "effect");

    ctx.setPlayerState(`${actor}_immuneAndReflectStatusTurns`, 5);
    ctx.setPlayerState("skillFearTurns", 3);
    ctx.setPlayerState("nextAtkFixedDmgCount", 3);
    ctx.setPlayerState("damageBoostTurns", 2);
  },

  "幽幕折返": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const oppElf = ctx.target;
    addLog(`🦇 【幽幕折返】：遁入幽幕之中！`, "effect");

    ctx.setPlayerState(`${actor}_immuneAndReflectStatusCount`, 2);
    const isShenling = oppElf.type?.includes("神靈");
    const boost = isShenling ? 1 : 2;
    ctx.applyStatChange(actor, { atk: boost, def: boost, spatk: boost, spdef: boost, speed: boost, accuracy: boost });

    ctx.setPlayerState("drainHpTurns", 5);
    ctx.setOpponentState("next2AtkInvalid", 2);
    ctx.setPlayerState("nextTurnPriority", 2);
    ctx.setPlayerState("nextPriorityCount", 3);
    ctx.setPlayerState("ignoreSpDefCount", 3);
  },

  "懼噬.虛實逆寫": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const oppElf = ctx.target;
    addLog(`🦇 【懼噬.虛實逆寫】：逆寫虛與實的境界！`, "effect");

    const newSelfStages = { ...self.statStages };
    let inverted = false;
    for (const [k, v] of Object.entries(newSelfStages)) {
      if ((v as number) < 0) {
        newSelfStages[k as any] = -(v as number);
        inverted = true;
      }
    }
    if (inverted) {
      ctx.updateElf(actor, { id: self.id, statStages: newSelfStages });
      addLog(`反轉自身能力下降！令對手害怕！`, "status");
      ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    } else {
      const oppStages = { ...oppElf.statStages };
      for (const [k, v] of Object.entries(newSelfStages)) {
        if ((v as number) > 0) {
          oppStages[k as any] = -(v as number);
        }
      }
      ctx.updateElf(oppSide, { id: oppElf.id, statStages: oppStages });
    }

    let diffCount = 0;
    let sameCount = 0;
    const keys = ["atk", "def", "spatk", "spdef", "speed", "accuracy"];
    keys.forEach(k => {
      const selfLvl = self.statStages?.[k as any] || 0;
      const oppLvl = oppElf.statStages?.[k as any] || 0;
      if (selfLvl === oppLvl) sameCount++;
      else diffCount++;
    });

    if (diffCount > 0) {
      const drainAmt = diffCount * 120;
      ctx.applyTrueDamage(oppSide, drainAmt, "虛實逆寫汲取");
      ctx.applyHeal(actor, drainAmt);
    }

    ctx.setPlayerState("nextKillFearNextElf", true);
  },

  "劫數.萬念歸墟": (ctx) => {
    const { self, actor, addLog } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    addLog(`🦇 【劫數.萬念歸墟】：大劫降臨，萬物皆歸於虛無！`, "effect");

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
        ctx.setMark({ id: "demon_grudge", name: "魔王咒怨", count: count + 1, displayChar: "咒", description: "湮滅之主令秒殺效果失效時所凝聚的咒怨層數，持有方下次秒殺觸發成功時會引發連鎖反應，令對方所有體力與秒殺目標相同的精靈一同秒殺" }, oppSide);
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

    const cleared = ctx.clearTurnEffectsOf(oppSide);
    if (cleared) {
      addLog(`消除對手回合類效果成功！令對手害怕！`, "status");
      ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    } else {
      ctx.setPlayerState("damageBoostThisTurn", 1.5);
    }

    const oppElf = ctx.target;
    const drain = Math.floor(oppElf.maxHp / 3);
    ctx.applyTrueDamage(oppSide, drain, "萬念歸墟吸血");
    ctx.applyHeal(actor, drain);

    const fearRes = ctx.applyStatusWithImmunityCheck(oppSide, "害怕", 1);
    const oppHasFear = oppElf.effects?.some(e => e.name === "害怕");
    if (!fearRes.success || oppHasFear) {
      tryInstantKill(0.30, "萬念歸墟 30% 秒殺機率");
    }

    ctx.setPlayerState("shieldBlockNextAtk", true);
  }
};

export const ZhakesiFearDeconstructedProfile: ElfDeconstructedProfile = {
  id: 'zhakesi_fear',
  name: '恐懼的化身·咤克斯',
  soulMark: {
    fear: {
      id: 'mark.zhakesi_fear',
      effectClass: 'MARK',
      polarity: 'NEUTRAL',
      flavor: {
        name: '懼',
        description: '自身存活在出戰背包內時(自身在場時也生效)，每回合吸取敵我雙方所有精靈20點體力上限附加給自身，最多吸取至該精靈體力上限為1；戰鬥開始時為對手種下恐懼之種；回合開始時，若自身滿體力則令對手100%害怕，未觸發則消除雙方能力上升、下降狀態與回合類效果；戰鬥階段結束時，恢復自身已損失體力50%的體力值與1點PP值，同時對手受到等同於自身恢復量百分比傷害，若對手體力未滿則額外令對手全屬性-1且至少減至1，未觸發則對手下2回合無法主動切換精靈；\n恐懼之種:持有方所有精靈均無法附加害怕異常與觸發秒殺效果且每次受到害怕異常時當回合免疫害怕異常狀態但所選擇的技能PP值歸0且當回合若因此PP值為0時則無法行動，造成非真實傷害降低20%，受到非真實傷害提升40%，每次受到對手的攻擊時有20%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害，每次己方精靈登場或受到害怕狀態時提高1層，每有1層則上述機率提高2%，最高5層，達到5層時轉變為恐懼之花\n恐懼之花:持有方所有精靈均無法附加給敵我雙方任一方異常異常狀態與觸發秒殺效果，每回合開始時恐懼之花會令在場精靈進入害怕狀態，造成非真實傷害降低50%，受到非真實傷害提升100%，每次受到對手的攻擊時有50%機率受到攻擊傷害不低於自身當前體力上限，觸發成功則當回合無法恢復體力並受到等同於己方體力上限的真實傷害',
        combatLog: '🦇 【懼】之魂印啟動！恐懼的化身降臨，為對手種下【恐懼之種】！'
      },
      mechanics: {
        trigger: 'BATTLE_START',
        absorbMaxHpPerTurn: 20,
        plantFearSeed: true,
        fullHpFearOrDispelBoth: true,
        endTurnHealLostHp50AndPP: true,
        seedToFlowerMaxLayers: 5
      }
    }
  },
  skills: {}
};
