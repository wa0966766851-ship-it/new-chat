import { clearStatuses } from './semanticOperations';
import { StatusRegistry } from './statusRegistry';
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
          setPlayerState(`wuxuComboPp:${skill.name}`, realSkill.pp ?? 0); // 使用前 PP，供連擊次數
        }
      }
    }
  }

  // 無序·蝕言 (Wuxu Shiyan)
  if ((self.id || "").includes("shiyan") || self.name.includes("蝕言")) {
    if (event === EffectTiming.ENFORCE || event === EffectTiming.ON_ENTRANCE) {
      const originals: Record<string, number> = getPlayerState('shiyanOriginalSpdef') || {};
      const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      if (self.currentHp > 0 && !self.isVanished) {
        const original = originals[self.battleId || self.id] ?? self.calculatedStats.spdef;
        const adjusted = Math.ceil(original / 10);
        for (const e of ctx.getFullTeam(actor)) {
          if (e !== self && (e.battleId || e.id) === (active.battleId || active.id)) continue;
          const id = e.battleId || e.id;
          originals[id] ??= e.calculatedStats.spdef;
          if (e.calculatedStats.spdef !== adjusted) ctx.updateAnyElf(actor, id, { calculatedStats: { ...e.calculatedStats, spdef: adjusted } });
        }
        setPlayerState('shiyanOriginalSpdef', originals);
      } else {
        for (const e of ctx.getFullTeam(actor)) {
          const original = originals[e.battleId || e.id];
          if (original !== undefined) ctx.updateAnyElf(actor, e.battleId || e.id, { calculatedStats: { ...e.calculatedStats, spdef: original } });
        }
        setPlayerState('shiyanOriginalSpdef', {});
      }
    }
    const wraithElf = ctx.getFullTeam(actor).find(e => e.name.includes("賽博怨靈") && !e.isVanished);
    const isWraithActive = !!(wraithElf && wraithElf.currentHp > 0);

    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🌑 【咒術師】：召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方！`, "effect");
      const adjustedSpdef = Math.ceil((getPlayerState('shiyanOriginalSpdef')?.[self.battleId || self.id] ?? self.calculatedStats.spdef) / 10);
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

    if (event === EffectTiming.BEFORE_STATUS_TICK && isWraithActive && /詛咒|curse/i.test(extraData?.status || '')) extraData.skipTick = true;
    if (event === EffectTiming.BATTLE_PHASE_END) {
      const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      if ((active.battleId || active.id) !== (self.battleId || self.id) || self.currentHp <= 0) return false;
      const statuses = ctx.getStatuses(self);
      const oldCurse = statuses['詛咒'] || 0;
      const convertible = Object.entries(statuses).filter(([name,n]) => n > 0 && name !== '詛咒' && StatusRegistry[name] && !StatusRegistry[name].categories.includes('AUXILIARY'));
      if (convertible.length || oldCurse > 0) {
        // 先確認新異常附加成功，再移除舊異常，避免免疫時吞掉原狀態。
        const turns = oldCurse > 0 ? oldCurse * 2 : 6;
        if (ctx.applyStatusWithImmunityCheck(actor, '詛咒', turns).success) {
          const names = new Set(convertible.map(([name])=>name));
          clearStatuses(ctx, actor, self, name=>names.has(name));
          setPlayerState(actor + '_curseTurns', turns);
        }
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
        // 在場：六次按序以各自系別單獨結算（每次管線只乘一次正確克制）。
        // 舊寫法先 total（含六系克制）再 elem:"普通" 進管線，會被普通系克制二次污染。
        for (let i = 0; i < seq.length; i++) {
          c.applySkillTypeDamage(opp, 66, `終焉·六花斬(${i + 1}/6·${seq[i]})`, { elem: seq[i], category: "skill_extra_action" });
        }
        const active: any = opp === "p1" ? c.activeP1 : c.activeP2;
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
    const ppAtUse = Number(ctx.getPlayerState(`wuxuComboPp:蟄刃復歸`) ?? (currentPp + 1));
    const comboHits = 1 + ppAtUse * 1; // 「每有1點PP值則技能連擊次數+1」
    ctx.setPlayerState("attackHitCountThisAction", comboHits);
    addLog(`🧘 【蟄刃復歸】連擊！使用時 PP ${ppAtUse}，連擊 ${comboHits} 次！`, "effect");

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
    const ppAtUse = Number(ctx.getPlayerState(`wuxuComboPp:靜刃止水`) ?? (currentPp + 1));
    const comboHits = 1 + ppAtUse * 1; // 「每有1點PP值則技能連擊次數+1」
    ctx.setPlayerState("attackHitCountThisAction", comboHits);
    addLog(`🧘 【靜刃止水】連擊！使用時 PP ${ppAtUse}，連擊 ${comboHits} 次！`, "effect");

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
    const ppAtUse = Number(ctx.getPlayerState(`wuxuComboPp:六刃碎界斷`) ?? (currentPp + 1));
    const comboHits = 1 + ppAtUse * 3; // 「每有1點PP值則技能連擊次數+3」
    ctx.setPlayerState("attackHitCountThisAction", comboHits);
    addLog(`⚔️ 【六刃碎界斷】連擊！使用時 PP ${ppAtUse}，連擊 ${comboHits} 次！`, "effect");

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

export { WuxuDeconstructedProfile } from "../data/elfProfiles/wuxuRegistry";

export { WuxuShiyanDeconstructedProfile } from "../data/elfProfiles/wuxuRegistry";

export { WuxuZhuixingDeconstructedProfile } from "../data/elfProfiles/wuxuRegistry";

