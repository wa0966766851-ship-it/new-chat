import { getTypeMatchup } from "../utils/statCalculator";
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';
import { createExtraElf } from '../utils/extraElf';
import { clampSkillPp } from '../utils/battleHelpers';
import { liurenSurvivalRule } from '../battle/survivalRules';

export const handleWuxuSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";

  // 無序·六刃 (Wuxu Liuren)
  if ((self.id || "").includes("liuren") || self.name.includes("六刃")) {
    const triggerEntranceEffect = () => {
      addLog(`🌑 【無序】：原始體力衝擊共鳴！`, "effect");
      const trueDmgSelf = Math.floor(self.maxHp / 6);
      const trueDmgOpp = Math.floor(ctx.target.maxHp / 6);
      applyTrueDamage(actor, trueDmgSelf, "無序反噬");
      applyTrueDamage(oppSide, trueDmgOpp, "無序衝擊");
      
      const totalTrueDmg = trueDmgSelf + trueDmgOpp;
      
      // 1. 己方上一隻出戰精靈恢復受到真實傷害總和 (兩者相加)
      const previousId = getPlayerState("previousActiveElfId");
      if (previousId) {
        const fullTeam = ctx.getFullTeam(actor);
        const prevElf = fullTeam.find(e => e.id === previousId);
        if (prevElf) {
          const healAmt = Math.min(totalTrueDmg, prevElf.maxHp - prevElf.currentHp);
          if (healAmt > 0) {
            const nextHp = prevElf.currentHp + healAmt;
            ctx.updateElf(actor, { id: prevElf.id, currentHp: nextHp });
            addLog(`🌑 【無序·六刃】：己方上一隻出戰精靈 【${prevElf.name}】 恢復了 ${healAmt} 點體力！`, "heal");
          }
        }
      }
      
      // 2. 自身獲得受到真實傷害量 6 倍的臨時體力上限 (下場後消失)
      // 若尚未轉為永久，且未進行過臨時加成，則加成
      const hasBoost = !!getPlayerState("wuxuTempMaxHpBoost");
      const isPermanent = !!getPlayerState("wuxuTempMaxHpBoostIsPermanent");
      if (!hasBoost && !isPermanent) {
        const boost = totalTrueDmg * 6;
        setPlayerState("wuxuTempMaxHpBoost", boost);
        setPlayerState("wuxuTempMaxHpBoostIsPermanent", false);
        ctx.updateElf(actor, { maxHp: self.maxHp + boost, currentHp: self.currentHp + boost, tempMaxHpBoost: boost });
        addLog(`🌑 【無序·六刃】：自身獲得 ${boost} 點臨時體力上限！`, "effect");
      } else if (hasBoost && !isPermanent) {
        // 再次觸發出戰效果：原臨時體力上限變為永久體力上限
        setPlayerState("wuxuTempMaxHpBoostIsPermanent", true);
        addLog(`🌑 【無序·六刃】：對手切換或自身異常，原臨時體力上限 ${getPlayerState("wuxuTempMaxHpBoost")} 變為永久體力上限！`, "effect");
      }
    };

    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🌑 【無序】：六刃出陣，原始體力共鳴！`, "effect");
      ctx.updateElf(actor, { isConcealed: true, survivalRule: liurenSurvivalRule() });
      if (!getPlayerState("wuxuLiurenOriginalMaxHp")) {
        setPlayerState("wuxuLiurenOriginalMaxHp", self.maxHp);
      }
      triggerEntranceEffect();
      setPlayerState("wuxuBoost", true);
    }

    if (event === "OPPONENT_SWITCH") {
      addLog(`🌑 【無序·六刃】：對手切換精靈，再次觸發出戰效果！`, "effect");
      triggerEntranceEffect();
    }

    if (event === "SELF_STATUS_APPLIED") {
      addLog(`🌑 【無序·六刃】：自身進入異常狀態，再次觸發出戰效果！`, "effect");
      triggerEntranceEffect();
    }

    if (event === EffectTiming.ON_SWITCH_OUT) {
      // 臨時上限下場後消失
      const tempBoost = getPlayerState("wuxuTempMaxHpBoost") || 0;
      const isPermanent = !!getPlayerState("wuxuTempMaxHpBoostIsPermanent");
      if (tempBoost > 0 && !isPermanent) {
        const nextMaxHp = Math.max(1, self.maxHp - tempBoost);
        const nextCurrentHp = Math.min(nextMaxHp, self.currentHp);
        ctx.updateElf(actor, { maxHp: nextMaxHp, currentHp: nextCurrentHp, tempMaxHpBoost: 0 });
        setPlayerState("wuxuTempMaxHpBoost", 0);
        addLog(`🌑 【無序·六刃】：臨時體力上限 (${tempBoost} 點) 下場後已消失！`, "effect");
      }

      const team = ctx.getEligibleTeam(actor);
      // 原文：「自身下場後若己方隱匿精靈不超過3個」
      // 這裡計算包含自己在內的所有隱匿精靈（因為此時尚未清除自己的隱匿）
      const concealCount = team.filter(e => e.isConcealed).length;
      if (concealCount <= 3 && extraData?.incomingElf) {
        addLog(`🌑 【隱匿傳承】：虛無之志傳遞給下一位！`, "effect");
        const nextElf = extraData.incomingElf;
        // 恢復下隻出戰精靈所有技能PP值
        const restoredSkills = nextElf.skills.map((s: any) => 
          s.pp !== undefined ? { ...s, pp: s.maxPp ?? s.pp } : s
        );
        // 附加隱匿印記，使用正規的 updateElf 進行更新（非作用中精靈，需指定 ID）
        ctx.updateElf(actor, { id: nextElf.id, skills: restoredSkills, isConcealed: true });
      }

      if (extraData?.incomingElf) {
        setPlayerState("wuxuBladeReviveTrackingElf", extraData.incomingElf.name);
        setPlayerState("wuxuBladeReviveTrackingTurns", 0);
        setPlayerState("wuxuBladeReviveTrackingActive", true);
        setPlayerState("clearOnSwitch", ["wuxuBladeReviveTrackingActive"]);
      }

      // 自己下場，清除隱匿狀態（避免背包內一直保持隱匿，依據通用的「下場清除」邏輯，但若有特殊需求可調整）
      ctx.updateElf(actor, { isConcealed: false });
    }
    
    if (event === EffectTiming.BEFORE_ACTION) {
      if (ctx.skill && ctx.skill.name === "安息契") {
        if (extraData?.ppCostComp) {
          extraData!.ppCostComp.extraAllSkills = 1;
        }
      }
    }

    if (event === EffectTiming.ON_PP_CONSUME) {
      const skillName = ctx.skill?.name;
      if (skillName === "安息契") {
        addLog(`🌑 【安息契】：消耗 PP 觸發！對手攻擊技能 PP 歸 0，且屬性技能被封印！`, "effect");
        const targetElf = ctx.target;
        const newOppSkills = targetElf.skills.map(s => 
          s.category !== "屬性" ? { ...s, pp: 0 } : s
        );
        ctx.updateElf(oppSide, { skills: newOppSkills });
        
        ctx.setOpponentState("oppUtilitySealedTurns", 2);
        setPlayerState("statusImmuneTurns", 2);

        const dmg = Math.floor(self.maxHp * 0.4);
        const oppHpRatio = targetElf.currentHp / targetElf.maxHp;
        const multiplier = oppHpRatio > 0.5 ? 2 : 1;
        const finalDmg = dmg * multiplier;
        
        const actual = ctx.applyPinkDamage(oppSide, finalDmg, "安息契百分比傷害", ctx.activeP1, ctx.activeP2, "percent");
        ctx.applyHeal(actor, actual);
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData?.damageComp && extraData.damageComp.isIncoming === false) {
      const damageComp = extraData.damageComp;
      if (self.trait?.name === "亂舞") {
        damageComp.multiplier = (damageComp.multiplier || 1.0) * 1.12;
      }
      
      const isNonTrue = damageComp.damageCategory === "skill_attack" || damageComp.damageCategory === "fixed" || damageComp.damageCategory === "percent";
      if (isNonTrue) {
        const hpLossPercent = (1 - self.currentHp / self.maxHp) * 100;
        const stacks = Math.floor(hpLossPercent / 0.1);
        let boost = 1.2 + stacks * 1.2;
        if (self.currentHp < self.maxHp / 2) boost *= 2;
        damageComp.multiplier = (damageComp.multiplier || 1.0) * boost;
      }
    }

    if (event === EffectTiming.AFTER_ACTION) {
      const healAmt = Math.floor(self.maxHp / 6);
      const originalMaxHp = getPlayerState("wuxuLiurenOriginalMaxHp") || self.maxHp;
      const cappedHealAmt = Math.min(healAmt, Math.max(0, originalMaxHp - self.currentHp));
      applyHeal(actor, cappedHealAmt);
      if (ctx.applyPinkDamage) {
        ctx.applyPinkDamage(oppSide, healAmt, "無序追擊", ctx.activeP1, ctx.activeP2, "percent");
      }
      
      if (self.trait?.name === "亂舞" && ctx.skill && ctx.skill.category !== "屬性") {
        const eligibleOppTeam = ctx.getEligibleTeam(oppSide);
        if (eligibleOppTeam.length > 0) {
          const randomTarget = eligibleOppTeam[Math.floor(Math.random() * eligibleOppTeam.length)];
          const offFieldDmg = Math.floor(ctx.skill.power || 0); // Estimate
          randomTarget.currentHp = Math.max(1, randomTarget.currentHp - offFieldDmg);
          addLog(`💥 【亂舞】特質發動！無序六刃的狂舞波及敵方備戰精靈 【${randomTarget.name}】，造成真實傷害！`, "effect");
        }
      }
    }

    if (event === EffectTiming.ON_DAMAGED && extraData?.damageType === "true") {
      ctx.applyDeathImmunity(actor, { guardTurns: 2, deathImmuneTurns: 3, fixedPercentCap: 60, preserveOffField: true });
      addLog(`🌑 【死亡條件不受體力限制】：無序·六刃觸發真實傷害庇護！(下場後保留效果且不因此降低效果回合數)`, "effect");
    }

    if (event === EffectTiming.ON_KILL && extraData?.defeatedElf) {
      const deadElf = extraData.defeatedElf;
      const isDeadAlien = deadElf.isAlienElf || (deadElf.soulMark?.trait_warrior); // Check if it's an alien elf
      if (isDeadAlien) {
        addLog(`🌑 【無序星魂使徒】：徹底終結了異能精靈 【${deadElf.name}】！`, "effect");
        ctx.vanishElf(oppSide, deadElf);
      }
    }

    if (event === EffectTiming.ROUND_END) {
      if (getPlayerState("wuxuBladeReviveTrackingActive")) {
        const trackedName = getPlayerState("wuxuBladeReviveTrackingElf");
        const activeElf = actor === "p1" ? ctx.activeP1 : ctx.activeP2;
        const stillOnField = activeElf && activeElf.name === trackedName && activeElf.currentHp > 0 && !activeElf.isVanished;

        if (!stillOnField) {
          setPlayerState("wuxuBladeReviveTrackingActive", false);
        } else {
          const turns = (getPlayerState("wuxuBladeReviveTrackingTurns") || 0) + 1;
          setPlayerState("wuxuBladeReviveTrackingTurns", turns);
          if (turns >= 6) {
            const fullTeam = ctx.getFullTeam(actor);
            const myIdx = fullTeam.findIndex(e => e.id === self.id);
            if (myIdx !== -1) {
              ctx.updateElf(actor, {
                id: self.id,
                currentHp: self.maxHp,
                isVanished: false
              });
              addLog(`⚔️ 【蟄刃復歸】：己方精靈已在場滿 6 回合，無序·六刃強制重生！`, "effect");
              setPlayerState("wuxuBladeReviveTrackingActive", false);
            }
          }
        }
      }
    }

    if (event === EffectTiming.MODIFY_PRIORITY && extraData?.priorityComp) {
      const skill = ctx.skill;
      if (skill && (skill.name === "靜刃止水" || skill.name === "蟄刃復歸" || skill.name === "六刃碎界斷")) {
        const realSkill = self.skills.find(sk => sk.name === skill.name);
        if (realSkill) {
          extraData.priorityComp.bonus += (realSkill.pp ?? 0);
        }
      }
    }
  }

  // 無序·蝕言 (Wuxu Shiyan)
  if ((self.id || "").includes("shiyan") || self.name.includes("蝕言")) {
    const wraithElf = ctx.getFullTeam(actor).find(e => e.name.includes("賽博怨靈") && !e.isVanished);
    const isWraithActive = !!(wraithElf && wraithElf.currentHp > 0);

    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🌑 【咒術師】：召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方！`, "effect");
      const adjustedSpdef = Math.ceil((self.calculatedStats?.spdef || self.baseStats?.spdef || 300) / 10);
      const newWraith = createExtraElf(self, {
        name: "賽博怨靈",
        type: "機械·暗影",
        maxHp: self.maxHp,
        currentHp: self.maxHp,
        baseStats: {
          ...self.baseStats,
          spdef: adjustedSpdef
        },
        badge: "👻",
        skills: [],
        soulMark: {
          name: "賽博怨靈（額外精靈）",
          description: "每次登場時，召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方（特防始終與無序·蝕言經過專屬特性調整過後的特防保持一致）；自身下場後則怨靈死亡並消逝；自身死亡時，若存在怨靈會代替自身死亡以保留無序·蝕言20%體力（每次登場僅觸發1次），且下一次出場時造成攻擊傷害翻倍；賽博怨靈存在時自身詛咒類異常回合數不會減少",
          effectType: "none",
          effectValue: 0
        }
      });
      ctx.addExtraElf(actor, newWraith);
      setPlayerState(`${actor}_cyberWraithActive`, true);
      setPlayerState(`${actor}_wraithSubUsed`, false);
      setPlayerState(`${actor}_wraithDamageDoubled`, false);
    }

    if (event === EffectTiming.ON_SWITCH_OUT) {
      if (wraithElf) {
        addLog(`🌑 【咒術師】：自身下場，賽博怨靈死亡並消逝...`, "effect");
        ctx.vanishElf(actor, wraithElf);
        setPlayerState(`${actor}_cyberWraithActive`, false);
      }
    }

    if (event === EffectTiming.FATAL_RESIST) {
      // 1. 賽博怨靈替死
      const subUsed = !!getPlayerState(`${actor}_wraithSubUsed`);
      if (wraithElf && !subUsed) {
        addLog(`👻 【咒術師】：賽博怨靈代替自身消散！以保留無序·蝕言最大體力20%！`, "effect");
        ctx.vanishElf(actor, wraithElf);
        setPlayerState(`${actor}_cyberWraithActive`, false);
        setPlayerState(`${actor}_wraithSubUsed`, true);
        setPlayerState(`${actor}_wraithDamageDoubled`, true);
        ctx.updateElf(actor, { currentHp: Math.floor(self.maxHp * 0.2) });
        return true;
      }

      // 2. 蟄刃復歸：重生
      const rebirthReady = !!getPlayerState(`${actor}_rebirthPending`);
      if (rebirthReady) {
        addLog(`🌑 【蟄刃復歸】：重生 (體力與PP值重置為100%)！`, "effect");
        setPlayerState(`${actor}_rebirthPending`, false);
        // 重生：體力與PP值重置為100%
        self.skills.forEach(s => { if (s.pp !== undefined) s.pp = s.maxPp ?? s.pp; });
        ctx.updateElf(actor, { currentHp: self.maxHp });
        return true;
      }
    }

    if (event === EffectTiming.BATTLE_PHASE_END) {
       // 若戰鬥階段結束時若未選擇使用技能則改為賽博怨靈於該階段發動1次滅靈魔咒
       const skillSelected = !!(actor === 'p1' ? ctx.activeP1.battleId : ctx.activeP2.battleId); // 這裡簡化判定
       // 實際上應該在 BattleScreen 傳入 extraData
       if (isWraithActive && extraData?.noSkillSelected) {
          addLog(`👻 【咒術師】：未選擇技能，賽博怨靈發動【滅靈魔咒】！`, "effect");
          // 呼叫 TraitsEngine 的邏輯（或在此實裝）
          // ... 邏輯已在 TraitsEngine 中，此處僅作為觸發標記或補充
       }
    }

    if (event === EffectTiming.ON_KILL && extraData?.defeatedElf) {
       const deadElf = extraData.defeatedElf;
       const isDeadAlien = deadElf.isAlienElf || (deadElf.soulMark?.trait_warrior);
       if (isDeadAlien) {
         addLog(`🌑 【無序星魂使徒】：徹底終結了異能精靈 【${deadElf.name}】！`, "effect");
         ctx.vanishElf(oppSide, deadElf);
       }
    }

    if (event === EffectTiming.ROUND_START) {
      // 只有蝕言自己是現役精靈時，詛咒才會生效（候補時不觸發）
      const isActive = ctx.activeP1?.battleId === self.battleId || ctx.activeP2?.battleId === self.battleId;
      if (isActive) {
        const statuses = ctx.getStatuses(self);
        if (!statuses['詛咒']) {
          addLog(`🌑 【蝕】：深淵詛咒蔓延！`, "effect");
          ctx.applyStatusWithImmunityCheck(actor, "詛咒", 3);
          ctx.applyStatusWithImmunityCheck(oppSide, "詛咒", 3);
        }
      }
    }

    if (event === EffectTiming.ROUND_END) {
      // 賽博怨靈存在時自身詛咒類異常回合數不會減少
      if (isWraithActive) {
         const pReg = actor === 'p1' ? 'p1RegistryState' : 'p2RegistryState';
         // 這裡需要手動補償回合數，因為系統會自動減 1
         const currentCurse = ctx.getPlayerState(`${actor}_curseTurns`) || 0;
         if (currentCurse > 0) {
           setPlayerState(`${actor}_curseTurns`, currentCurse + 1);
         }
      }

      // 戰鬥階段結束時: 將自身異常轉化為詛咒異常狀態且令自身詛咒回合數翻倍
      // (這裡模擬為 ROUND_END，若有專門的 BATTLE_PHASE_END 更好)
      const statuses = ctx.getStatuses(self);
      let foundStatus = false;
      Object.keys(statuses).forEach(s => {
        if (s !== '詛咒' && statuses[s] > 0) {
          foundStatus = true;
          // 清除其他異常（簡化邏輯：由系統每回合自然結算或此處清除）
        }
      });
      if (foundStatus || statuses['詛咒'] > 0) {
        const curseTurns = statuses['詛咒'] || 0;
        const newTurns = Math.max(3, curseTurns * 2);
        ctx.applyStatusWithImmunityCheck(actor, "詛咒", newTurns, true);
        addLog(`🌑 【蝕】：異常轉化，詛咒加劇！`, "effect");
      }
    }
  }

  // 無序·墜星 (Wuxu Zhuixing)
  if ((self.id || "").includes("zhuixing") || self.name.includes("墜星")) {
    if (event === EffectTiming.FATAL_RESIST) {
      const survived = !!getPlayerState(`${actor}_zhuixingSurvived`);
      if (!survived) {
        addLog(`☄️ 【豪邁/投石者】：遭受致死傷害時保留 1 點體力！`, "effect");
        setPlayerState(`${actor}_zhuixingSurvived`, true);
        ctx.updateElf(actor, { currentHp: 1 });
        return true;
      }
    }

    if (event === EffectTiming.AFTER_ACTION) {
      addLog(`☄️ 【墜】：星河降誕，恢復與壓制！`, "effect");
      self.skills.forEach(s => { if (s.pp !== undefined) s.pp = clampSkillPp(s, s.pp + 2, self); });
      ctx.applyStatusWithImmunityCheck(oppSide, "封屬", 2);
    }
    
    if (event === EffectTiming.ON_KILL && extraData?.defeatedElf) {
       const deadElf = extraData.defeatedElf;
       const isDeadAlien = deadElf.isAlienElf || (deadElf.soulMark?.trait_warrior);
       if (isDeadAlien) {
         addLog(`🌑 【無序星魂使徒】：徹底終結了異能精靈 【${deadElf.name}】！`, "effect");
         ctx.vanishElf(oppSide, deadElf);
       }
    }
  }

  return false;
};

export const WUXU_SKILLS: Record<string, BattleSkillHandler> = {
  "終焉·六花斬": (ctx) => {
    const { self, actor, target, targetSide, addLog } = ctx;
    addLog(`🌑 【終焉·六花斬】：穿透虛空的六重連斬！`, "effect");
    // 🎯 雙方每有1個技能（PP值為滿／不為滿）吸取對手1次66點體力（每次獨立），吸取後對手體力未減少則該次改為汲取
    const n = (self.skills || []).length + (target.skills || []).length;
    for (let i = 0; i < n; i++) {
      const dealt = ctx.applyPinkDamage(targetSide, 66, "吸取", undefined, undefined, "percent");
      if (dealt > 0) ctx.applyHeal(actor, dealt);
      else ctx.applyAbsorb(targetSide, 66);
    }
    // 🎯 進行6次額外行動（邪靈→戰鬥→邪靈.戰鬥→邪靈→戰鬥→邪靈.戰鬥），每次66點技能傷害；行動期間不造成傷害，
    //    行動結束時對方所有精靈受到6次總和的技能傷害；場下精靈死亡時令其消逝並轉化其能力值總和20%給予自身
    const seq = ["邪靈", "戰鬥", "邪靈.戰鬥", "邪靈", "戰鬥", "邪靈.戰鬥"];
    ctx.queueExtraAction?.(actor, {
      label: "終焉·六花斬 ×6",
      run: (c) => {
        const opp = c.actor === "p1" ? "p2" : "p1";
        const total = (elf: any) => seq.reduce((a, t) => a + Math.floor(66 * getTypeMatchup(t, elf.type)), 0);
        const active: any = opp === "p1" ? c.activeP1 : c.activeP2;
        c.applySkillTypeDamage(opp, total(active), "終焉·六花斬", { elem: "普通", category: "skill_extra_action" });
        for (const m of c.getFullTeam(opp) as any[]) {
          if (!m || m === active || (m.battleId && m.battleId === active?.battleId) || m.currentHp <= 0 || m.isConcealed) continue;
          const hp = Math.max(0, m.currentHp - total(m));
          c.updateAnyElf(opp, m.battleId, { currentHp: hp } as any);
          c.addLog(`🌑 【終焉·六花斬】：場下【${m.name}】受到 ${total(m)} 點技能傷害！`, "damage");
          if (hp <= 0) {
            c.vanishElf(opp, m);
            const cs: any = (c.self as any).calculatedStats || {};
            const ms: any = m.calculatedStats || {};
            const next: any = { ...cs };
            for (const k of ["atk", "def", "spatk", "spdef", "speed"]) next[k] = (cs[k] || 0) + Math.floor((ms[k] || 0) * 0.2);
            c.updateElf(c.actor, { calculatedStats: next } as any);
            c.addLog(`🌑 【終焉】：【${m.name}】消逝，其能力值 20% 轉化給自身！`, "effect");
          }
        }
      },
    });
  },
  "狂刃無生": (ctx) => {
    ctx.addLog(`🌑 【狂刃無生】：洗滌萬物，唯餘狂氣！`, "effect");
    
    // ... (existing code for 狂刃無生)
    const c1 = ctx.clearTurnEffectsOf("p1");
    const c2 = ctx.clearTurnEffectsOf("p2");
    if (c1 || c2) {
      ctx.applyStatusWithImmunityCheck("p1", "furious", 3);
      ctx.applyStatusWithImmunityCheck("p2", "furious", 3);
    }
    const clearStatsAndShields = (side: "p1" | "p2") => {
      const target = side === "p1" ? ctx.activeP1 : ctx.activeP2;
      const stages = target.statStages || { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 };
      const hasStats = Object.values(stages).some(v => v !== 0);
      const hasShields = (target.shield || 0) > 0 || (target.barrier || 0) > 0;
      if (hasStats) {
        ctx.applyStatChange(side, { atk: -stages.atk, def: -stages.def, spatk: -stages.spatk, spdef: -stages.spdef, speed: -stages.speed, accuracy: -stages.accuracy });
      }
      if (hasShields) ctx.updateElf(side, { shield: 0, barrier: 0 });
      return hasStats || hasShields;
    };
    const s1 = clearStatsAndShields("p1");
    const s2 = clearStatsAndShields("p2");
    if (s1 || s2) ctx.applyPercentDamage(ctx.targetSide, 0.66);
    const lostHp = ctx.self.maxHp - ctx.self.currentHp;
    if (lostHp > 0) {
      const extra = Math.floor(lostHp / 6) * 6;
      ctx.applyTrueDamage(ctx.targetSide, lostHp + extra, "狂刃無生");
    }
  },
  "蟄刃復歸": (ctx) => {
    ctx.addLog(`🌑 【蟄刃復歸】：於蟄伏中甦醒，命運的迴旋！`, "effect");
    const { actor, self, addLog, setPlayerState, applyStatusWithImmunityCheck, applyStatChange } = ctx;

    // 1. 輸出動態連擊日誌
    const activeSkill = self.skills.find(s => s.name === "蟄刃復歸");
    const currentPp = activeSkill ? (activeSkill.pp ?? 0) : 5;
    const comboHits = currentPp + 1;
    addLog(`🧘 【蟄刃復歸】連擊！當前 PP 值為 ${currentPp}，觸發了 ${comboHits} 次連續回復與共鳴！`, "effect");

    // 令自身平靜
    const isSerene = self.battleStatus === "平靜" || (self.battleStatuses && self.battleStatuses["平靜"] > 0);
    applyStatusWithImmunityCheck(actor, "平靜", 3);

    // 自身處於平靜狀態則攻擊、雙防、速度、命中+1
    if (isSerene) {
      applyStatChange(actor, { atk: 1, def: 1, spdef: 1, speed: 1, accuracy: 1 });
      addLog(`🧘 【蟄刃復歸】：因自身已處於平靜狀態，激發潛能全屬性提升！`, "effect");
    }

    // 2. 5回合內自身恢復最大體力⅓並造成等量百分比傷害，自身體力低於最大體力½時恢復效果與造成百分比傷害翻倍
    setPlayerState(`${actor}_healAndDamageTurns`, 5);
    addLog(`⏳ 【蟄刃復歸】：激活 5 回合每回合生命恢復與百分比傷害效果！`, "status");

    // 3. 下2回合自身使用技能先制+6
    setPlayerState(`${actor}_nextPriorityTurns`, 2);
    setPlayerState(`${actor}_nextTurnPriority`, 6);
    addLog(`⚡ 【蟄刃復歸】：下 2 回合自身的技能先制 +6！`, "status");

    // 4. 下次死亡時，若下隻出戰己方精靈在場超過6回合則自身重生
    setPlayerState(`${actor}_rebirthPending`, true);
    addLog(`🌌 【蟄刃復歸】：已與深淵簽訂重生契約！下次死亡時，若下隻出戰精靈在場超過 6 回合則重生！`, "effect");
  },
  "靜刃止水": (ctx) => {
    ctx.addLog(`🧘 【靜刃止水】：澄澈如鏡，萬念皆空！`, "effect");
    const { actor, targetSide, self, target, addLog, setPlayerState } = ctx;

    // 1. 輸出動態連擊日誌
    const activeSkill = self.skills.find(s => s.name === "靜刃止水");
    const currentPp = activeSkill ? (activeSkill.pp ?? 0) : 5;
    const comboHits = currentPp + 1;
    addLog(`🧘 【靜刃止水】連擊！當前 PP 值為 ${currentPp}，觸發了 ${comboHits} 次連續斬擊！`, "effect");

    // 6回合內自身免疫並反彈所有異常狀態
    setPlayerState(`${actor}_immuneAndReflectStatusTurns`, 6);
    addLog(`🛡️ 【靜刃止水】：自身獲得 6 回合免疫並反彈所有異常狀態效果！`, "status");

    // 2. 解除雙方所有異常狀態
    const checkHasStatus = (elf: any) => {
      if (elf.battleStatus && elf.battleStatus !== "normal") return true;
      if (elf.battleStatuses && Object.keys(elf.battleStatuses).filter(k => k !== "normal" && k !== "平靜").length > 0) return true;
      if (elf.effects && elf.effects.length > 0) return true;
      return false;
    };

    const selfHas = checkHasStatus(self);
    const oppHas = checkHasStatus(target);
    const clearedAny = selfHas || oppHas;

    if (selfHas) {
      ctx.updateElf(actor, { battleStatus: "normal", battleStatusDuration: 0, battleStatuses: {}, effects: [] });
      addLog(`✨ 【靜刃止水】：解除了自身所有的異常狀態與狀態效果！`, "status");
    }
    if (oppHas) {
      ctx.updateElf(targetSide, { battleStatus: "normal", battleStatusDuration: 0, battleStatuses: {}, effects: [] });
      addLog(`✨ 【靜刃止水】：解除了對手所有的異常狀態與狀態效果！`, "status");
    }

    if (clearedAny) {
      const oppSide = actor === "p1" ? "p2" : "p1";
      // 3回合對手所有技能附加效果失效
      setPlayerState(`${oppSide}_sealSkillAdditionalEffects`, 3);
      // 無法附加敵我雙方任一方異常狀態
      setPlayerState(`p1_preventStatusInflict`, 3);
      setPlayerState(`p2_preventStatusInflict`, 3);
      addLog(`🧘 【靜刃止水】：異常解除成功！使對手 3 回合內所有技能附加效果失效，且雙方 3 回合內無法被附加任何異常狀態！`, "effect");
    } else {
      addLog(`🧘 【靜刃止水】：雙方均無異常狀態可解除。`, "effect");
    }

    // 3. 附加666點固定傷害
    ctx.applyFixedDamage(targetSide, 666, "靜刃止水");
  },
  "六刃碎界斷": (ctx) => {
    ctx.addLog(`⚔️ 【六刃碎界斷】：萬界破碎，六刃絕空！`, "effect");
    const { actor, targetSide, self, target, addLog, setPlayerState, applyStatChange } = ctx;

    // 1. 輸出動態連擊日誌
    const activeSkill = self.skills.find(s => s.name === "六刃碎界斷");
    const currentPp = activeSkill ? (activeSkill.pp ?? 0) : 5;
    const comboHits = currentPp + 3;
    addLog(`⚔️ 【六刃碎界斷】連擊！當前 PP 值為 ${currentPp}，觸發了 ${comboHits} 次空間破碎斬！`, "effect");

    // 6回合內對手體力恢復量下降100%
    setPlayerState(`${targetSide}_noHealTurns`, 6);
    setPlayerState(`${targetSide}_noHealReason`, "受【六刃碎界斷】限制");
    addLog(`🚫 【六刃碎界斷】：使對手 6 回合內體力恢復量下降 100%！`, "status");

    // 2. 附加自身雙攻值總和66%的百分比傷害
    const atk = self.calculatedStats?.atk || self.baseStats.atk;
    const spatk = self.calculatedStats?.spatk || self.baseStats.spatk;
    const sumAtk = atk + spatk;
    const extraDmg = Math.floor(sumAtk * 0.66);
    ctx.applyTrueDamage(targetSide, extraDmg, "六刃碎界斷");

    // 3. 3回合內令對手雙防-1
    const beforeDef = target.statStages?.def || 0;
    applyStatChange(targetSide, { def: -1, spdef: -1 });
    const afterDef = target.statStages?.def || 0;
    
    if (afterDef < beforeDef) {
      addLog(`📉 【六刃碎界斷】：對手防禦、特防下降 -1 階！`, "effect");
    } else {
      // 未觸發則2回合內對手攻擊技能無效且當回合結束時受到當前雙防值總和66%的百分比傷害
      setPlayerState(`${targetSide}_attackInvalidTurns`, 2);
      setPlayerState(`${targetSide}_attackSkillInvalidTurns`, 2);
      setPlayerState(`${targetSide}_attackSkillInvalidReason`, "【六刃碎界斷】");
      const def = target.calculatedStats?.def || target.baseStats.def;
      const spdef = target.calculatedStats?.spdef || target.baseStats.spdef;
      const sumDef = def + spdef;
      const extraDmgDef = Math.floor(sumDef * 0.66);
      ctx.applyTrueDamage(targetSide, extraDmgDef, "六刃碎界斷(未下降防禦補償)");
      addLog(`🛡️ 【六刃碎界斷】：對手防禦未成功下降！觸發補償：對手 2 回合內攻擊技能無效，並受到當前雙防總和 66% (${extraDmgDef} 點) 的百分比傷害！`, "effect");
    }
  },
  "安息契": (ctx) => {
    ctx.addLog(`🌑 【安息契】：靈魂的終焉協定。`, "effect");
    const { actor, self, targetSide, applyTrueDamage } = ctx;
    const amt = Math.floor(self.maxHp * 0.4);
    const actual = applyTrueDamage(targetSide, amt, "安息契");
    ctx.applyHeal(actor, actual);
  },
};

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

