import { prdChance } from "../utils/prd";
import { BattleEventContext, EffectTiming } from "./types";
import { getTypeMatchup } from "../utils/statCalculator";

export const SuitEffectRegistry: Record<string, (ctx: BattleEventContext, event: EffectTiming, extraData?: any) => any> = {
  morning_star: (ctx, event, extraData) => {
    // 晨曦之星戰甲：體力高於 1/2 時效果翻倍；低於 1/2 時效果翻倍
    if (event === EffectTiming.ROUND_START) {
      const self = ctx.self;
      const isAbnormal = self.effects && self.effects.length > 0;
      const regKey = ctx.actor === "p1" ? "p1RegistryState" : "p2RegistryState";
      if (!isAbnormal) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), morningStarIgnoreSpeed: true });
        ctx.addLog(`✨ 【晨曦之星戰甲】：回合開始時不處於異常狀態，當回合忽略對手 10 點速度！`, "effect");
      } else {
        const state = { ...ctx.getPlayerState(regKey) };
        delete state.morningStarIgnoreSpeed;
        ctx.setPlayerState(regKey, state);
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp) {
      const self = ctx.self;
      if (extraData?.damageComp.isIncoming) {
        // 受到的攻擊傷害減少10%
        let reduction = 0.1;
        if (self.currentHp < self.maxHp / 2) reduction *= 2;
        extraData!.damageComp.decreasePercent += reduction;
      } else {
        // 造成的攻擊傷害提升10%
        let boost = 0.1;
        if (self.currentHp > self.maxHp / 2) boost *= 2;
        extraData!.damageComp.increasePercent += boost;
      }
    }
    
    if (event === EffectTiming.AFTER_ACTION) {
      const self = ctx.self;
      const side = ctx.actor;
      if (ctx.skill?.category !== "屬性") {
        let fixedDmg = 100;
        if (self.currentHp > self.maxHp / 2) fixedDmg *= 2;
        ctx.applyFixedDamage(ctx.targetSide, fixedDmg, "【晨曦之星戰甲】");
      }
      
      // Opponent attack recover hp
      // This part is complex because it triggers on opponent's turn. 
      // Handled via SuitEffectRegistry[oppSuit] during opponent's AFTER_ACTION.
      if (extraData?.damageComp?.isIncoming && extraData!.damageComp?.base > 0) {
         let heal = 100;
         if (self.currentHp < self.maxHp / 2) heal *= 2;
         ctx.applyHeal(side, heal);
      }
    }
  },
  silver_knight: (ctx, event, extraData) => {
    // 銀翼騎士套裝：先出手時傷害再額外提升30%
    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp && !extraData!.damageComp.isIncoming) {
      if (ctx.goesFirst) {
        extraData!.damageComp.increasePercent += 0.3;
      }
    }
  },
  future_armor: (ctx, event, extraData) => {
    // 未來戰甲：背包內每死亡1隻精靈則自身攻擊命中後有1%的機率瞬殺對手。
    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      const team = ctx.actor === "p1" ? ctx.p1FullTeam : ctx.p2FullTeam;
      const deadCount = team.filter(e => e.currentHp <= 0).length;
      if (deadCount > 0) {
        const chance = deadCount * 0.01;
        if (prdChance("suitEffectRegistry:L70", chance)) {
          ctx.addLog(`⚡ 【未來戰甲】：觸發瞬殺效果！`, "effect");
          ctx.adjustHp(ctx.targetSide, -ctx.target.maxHp);
        }
      }
    }
  },
  nuclear_armor: (ctx, event, extraData) => {
    // 受到攻擊傷害時反彈對方在場精靈等同於傷害值15%百分比傷害
    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性" && extraData!.damageComp?.damageCategory === "skill_attack") {
      ctx.applyPercentDamage(ctx.targetSide, 0.15);
      const reflectDmg = Math.floor(ctx.target.maxHp * 0.15);
      ctx.addLog(`☢️ 【核能機甲】：反彈對手等同於對方最大體力 15% 的百分比傷害 (${reflectDmg} 點)！`, "damage");
    }
    // 自身體力低於最大體力1/3時，計算攻擊技能所造成的技能傷害時最終雙防值提升至基礎值的2倍
    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性" && extraData!.damageComp?.damageCategory === "skill_attack") {
      if (ctx.self.currentHp < ctx.self.maxHp / 3) {
        ctx.addLog(`🛡️ 【核能機甲】：體力低於1/3，雙防值計算時提升至2倍！`, "effect");
      }
    }
  },
  void_traveler: (ctx, event, extraData) => {
    // 使用屬性技能後有20%機率令對手隨機進入一種異常狀態3回合
    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category === "屬性") {
      if (prdChance("suitEffectRegistry:L94", 0.2)) {
        const statuses = ["燒傷", "冰封", "麻痺", "中毒", "害怕", "疲憊"];
        const status = statuses[Math.floor(ctx.rng() * statuses.length)];
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, 3);
        ctx.addLog(`🌀 【虛空旅者】：屬性技能觸發異常判定，使對手進入${status}狀態3回合！`, "effect");
      }
    }
  },
  crystal_barrier: (ctx, event, extraData) => {
    // 水晶之盾套裝: 每次受到超過250點的技能傷害時，有20%機率抵擋本次技能傷害
    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming && extraData!.damageComp.damageCategory === "skill_attack") {
      if (extraData?.damageComp.base > 250 && prdChance("suitEffectRegistry:L105", 0.2)) {
        extraData!.damageComp.multiplier = 0;
        ctx.addLog(`💎 【水晶之盾】：抵擋本次技能傷害！`, "effect");
      }
    }
  },
  shadow_slayer: (ctx, event, extraData) => {
    // 影之獵殺者: 自身先出手時，本次攻擊技能必定命中，且額外附加自身最大體力15%的百分比傷害
    if (ctx.goesFirst && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      if (event === EffectTiming.BEFORE_SKILL) {
        ctx.isHit = true;
      }
      if (event === EffectTiming.AFTER_ACTION) {
        ctx.applyPercentDamage(ctx.targetSide, 0.15);
        ctx.addLog(`👤 【影之獵殺者】：先出手附加自身最大體力15%的百分比傷害！`, "damage");
      }
    }
  },
  corrupter: (ctx, event, extraData) => {
    // 對方（攻擊我方的一方）使用攻擊技能，判定麻痺或百分比傷害，兩者都套用在對方身上
    if (event === EffectTiming.AFTER_ACTION && extraData?.isIncoming && extraData?.skill?.category !== "屬性") {
      const result = ctx.applyStatusWithImmunityCheck(ctx.targetSide, "麻痺", 1);
      if (!result.success) {
        ctx.applyPercentDamage(ctx.targetSide, 1 / 6);
        ctx.addLog(`☠️ 【腐蝕者套裝】：麻痺未觸發，附加對手最大體力1/6的百分比傷害！`, "damage");
      }
    }
  },
  starlight_guardian: (ctx, event, extraData) => {
    // 星光守護者: 每回合恢復100體力，體力低於1/2時翻倍。
    if (event === EffectTiming.ROUND_END) {
      let heal = 100;
      if (ctx.self.currentHp < ctx.self.maxHp / 2) heal *= 2;
      ctx.applyHeal(ctx.actor, heal);
      ctx.addLog(`✨ 【星光守護者】：恢復了 ${heal} 點體力！`, "heal");
    }
  },
  abyssal_walker: (ctx, event, extraData) => {
    // 深淵漫步者: 每回合結束後恢復5%最大體力。
    if (event === EffectTiming.ROUND_END) {
      const heal = Math.floor(ctx.self.maxHp * 0.05);
      if (heal > 0) {
        ctx.applyHeal(ctx.actor, heal);
        ctx.addLog(`🌀 【深淵漫步者】：恢復了 5% 的體力(${heal})！`, "heal");
      }
    }
  },
  destiny_armor: (ctx, event, extraData) => {
    // 天命神臨戰甲 (destiny_armor): 勝天之力，最多10層。
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
    let stacks = ctx.getPlayerState(regKey)?.destinyStacks || 0;

    if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.AFTER_ACTION) {
      if (stacks < 10) {
        stacks++;
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), destinyStacks: stacks });
        ctx.addLog(`⭐ 【天命神臨】：累積了一層勝天之力（當前 ${stacks} 層）`, "effect");
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp) {
      if (extraData?.damageComp.isIncoming) {
        // 固定與百分比減傷 2% * stacks
        if (extraData?.damageComp.damageCategory === "fixed" || extraData!.damageComp.damageCategory === "percent") {
          extraData!.damageComp.decreasePercent += 0.02 * stacks;
        }
      } else {
        // 增傷 4% * stacks
        extraData!.damageComp.increasePercent += 0.04 * stacks;
      }
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      const damage = extraData?.finalDamage || 0;
      if (damage < 300) {
        const absorb = Math.floor(ctx.target.maxHp * 0.02 * stacks);
        ctx.applyPinkDamage(ctx.targetSide, absorb, "【天命神臨】吸取");
        ctx.applyHeal(side, absorb);
      } else {
        const bonus = Math.floor(damage * 0.04 * stacks);
        ctx.applyPinkDamage(ctx.targetSide, bonus, "【天命神臨】附加");
      }
    }
  },
  imperial_armor: (ctx, event, extraData) => {
    // 皇御神臨戰甲 (imperial_armor)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.ON_ENTRANCE) {
      ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialFirstTurn: true });
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp && extraData!.damageComp.isIncoming) {
      if (ctx.getPlayerState(regKey)?.imperialFirstTurn) {
        ctx.addLog(`👑 【皇御神臨】：首回合受擊回血 1/4`, "effect");
        ctx.applyHeal(side, Math.floor(ctx.self.maxHp / 4));
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialFirstTurn: false });
      }
    }

    if (event === EffectTiming.AFTER_ACTION) {
      if (extraData?.damageComp?.isIncoming) {
        const damage = extraData?.finalDamage || 0;
        if (damage < 300 && damage > 0) {
          ctx.applyFixedDamage(ctx.targetSide, 300, "【皇御神臨】反震");
        } else if (damage >= 300) {
          ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialNextBoost: true });
        }
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialTakenDmgThisTurn: true });
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp && !extraData!.damageComp.isIncoming) {
      if (ctx.getPlayerState(regKey)?.imperialNextBoost) {
        extraData!.damageComp.increasePercent += 0.4;
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialNextBoost: false });
      }
    }

    if (event === EffectTiming.ROUND_END) {
      if (!ctx.getPlayerState(regKey)?.imperialTakenDmgThisTurn) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialNextFixed: true });
      }
      ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialTakenDmgThisTurn: false });
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      if (ctx.getPlayerState(regKey)?.imperialNextFixed) {
        const fixed = Math.floor(ctx.self.maxHp * 0.15);
        ctx.applyPinkDamage(ctx.targetSide, fixed, "【皇御神臨】靜守之威");
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), imperialNextFixed: false });
      }
    }
  },
  berserker: (ctx, event, extraData) => {
    // 狂暴者套裝 (berserker)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
    const isBerserk = ctx.getPlayerState(regKey)?.isBerserk;

    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming) {
      if (isBerserk) extraData!.damageComp.increasePercent += 1.0;
      if (prdChance("suitEffectRegistry:L249", 0.15)) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), berserkExecute: true });
      } else {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), isBerserk: true });
        ctx.addLog(`😡 【狂暴者】：進入狂暴狀態！`, "effect");
      }
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming) {
      if (ctx.getPlayerState(regKey)?.berserkExecute) {
        ctx.addLog(`💀 【狂暴者】：觸發秒殺判定！`, "effect");
        ctx.adjustHp(ctx.targetSide, -ctx.target.maxHp);
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), berserkExecute: false });
      } else {
        ctx.applyTrueDamage(ctx.targetSide, 115, "【狂暴者】");
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming) {
      const reduction = isBerserk ? 0.3 : 0.15;
      extraData!.damageComp.decreasePercent += reduction;
    }

    if (event === EffectTiming.BEFORE_SKILL && isBerserk) {
      if (extraData?.ppCostComp) {
        extraData!.ppCostComp.multiplier = 0;
        ctx.addLog(`😡 【狂暴者】：狂暴狀態下使用技能不消耗PP！`, "effect");
      }
    }

    if (event === EffectTiming.ROUND_END) {
      const mult = isBerserk ? 2 : 1;
      ctx.applyHeal(side, Math.floor(ctx.self.maxHp * 0.15 * mult));
      ctx.applyStatChange(side, {}, { all: 1 * mult });
      ctx.addLog(`💤 【狂暴者】：回合結束恢復體力與 PP`, "heal");
    }
  },
  fate_defier: (ctx, event, extraData) => {
    // 逆命者戰甲 (fate_defier)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.BEFORE_SKILL) {
      const typeMult = getTypeMatchup(ctx.skill?.type || "無屬性", ctx.target.type);
      if (typeMult > 1.0 && extraData!.ppCostComp) {
        extraData!.ppCostComp.multiplier = 0;
        ctx.addLog(`🛡️ 【逆命者戰甲】：克制倍數高於1倍，本次技能不消耗PP！`, "effect");
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming) {
      const typeMult = getTypeMatchup(ctx.skill?.type || "無屬性", ctx.target.type);
      if (typeMult < 1.0) {
        extraData!.damageComp.multiplier = 1.0;
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), fateDefierAbsorb: true });
      } else if (typeMult > 1.0) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), fateDefierTired: true });
      }
      
      const accumulated = ctx.getPlayerState(regKey)?.fateDefierAccumulatedBoost || 0;
      extraData!.damageComp.increasePercent += accumulated;
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming) {
      if (ctx.getPlayerState(regKey)?.fateDefierAbsorb) {
        ctx.applyPinkDamage(ctx.targetSide, Math.floor(ctx.target.maxHp * 0.1), "【逆命者】吸取");
        ctx.applyHeal(side, Math.floor(ctx.target.maxHp * 0.1));
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), fateDefierAbsorb: false });
      }
      if (ctx.getPlayerState(regKey)?.fateDefierTired) {
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "疲憊", 1);
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), fateDefierTired: false });
      }
      
      if (ctx.skill?.category !== "屬性") {
        const fixedExtra = ctx.getPlayerState(regKey)?.fateDefierFixedExtra || 0;
        if (fixedExtra > 0) {
          ctx.applyTrueDamage(ctx.targetSide, fixedExtra, "【逆命者戰甲】附加真實傷害");
        }
      }
    }

    if (event === EffectTiming.ROUND_END) {
      const boostStacks = Math.min(10, (ctx.getPlayerState(regKey)?.fateDefierBoostStacks || 0) + 1);
      ctx.setPlayerState(regKey, {
        ...ctx.getPlayerState(regKey),
        fateDefierBoostStacks: boostStacks,
        fateDefierAccumulatedBoost: boostStacks * 0.1,
        fateDefierFixedExtra: boostStacks * 10
      });
      ctx.addLog(`⚔️ 【逆命者戰甲】：戰鬥階段結束，全隊攻擊額外傷害提升至 ${boostStacks * 10}%，附加真實傷害提升至 ${boostStacks * 10} 點！`, "effect");
    }
  },
  shadow_judgment: (ctx, event, extraData) => {
    // 影翼裁決套裝 (shadow_judgment)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.ON_ENTRANCE) {
      ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), shadowJudgmentFirst: true });
    }

    if (event === EffectTiming.AFTER_ACTION && extraData!.damageComp?.isIncoming) {
      if (ctx.getPlayerState(regKey)?.shadowJudgmentFirst) {
        const lost = ctx.self.maxHp - ctx.self.currentHp;
        const lostPercent = Math.floor((lost / ctx.self.maxHp) * 10);
        const shield = Math.min(300, lostPercent * 50);
        if (shield > 0) {
          ctx.applyShield(side, shield);
          ctx.addLog(`🛡️ 【影翼裁決】：獲得 ${shield} 點護罩！`, "effect");
        }
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), shadowJudgmentFirst: false });
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming) {
      const shield = ctx.self.shield || 0;
      if (shield > 0) {
        const boost = Math.min(0.4, Math.floor(shield / 50) * 0.1);
        extraData!.damageComp.increasePercent += boost;
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming) {
      if (extraData?.damageComp.damageCategory === "fixed" || extraData!.damageComp.damageCategory === "percent") {
        const shield = ctx.self.shield || 0;
        if (shield === 0) {
          const lostHpPercent = (ctx.self.maxHp - ctx.self.currentHp) / ctx.self.maxHp;
          const reduction = 0.05 + Math.floor(lostHpPercent / 0.15) * 0.05;
          extraData!.damageComp.decreasePercent += Math.min(0.25, reduction);
        }
      }
    }
  },
  eternal_starlight: (ctx, event, extraData) => {
    // 星光永恆套裝 (eternal_starlight)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming) {
      // 忽略對手雙攻值 11%
      extraData!.damageComp.multiplier *= 0.89;
      
      if (!ctx.goesFirst) {
        // 對手先出手（自己後出手）→ 附加星賜
        const hasStatus = (ctx.self.effects || []).length > 0;
        if (hasStatus) {
           ctx.addLog(`✨ 【星光永恆】：將異常狀態轉化為【星賜】`, "effect");
        }
        ctx.applyStatusWithImmunityCheck(side, '星賜', 3);
      } else {
        // 對手後出手（自己先出手）→ 附加星哲
        const hasStatus = (ctx.self.effects || []).length > 0;
        if (hasStatus) {
           ctx.addLog(`✨ 【星光永恆】：將異常狀態轉化為【星哲】`, "effect");
        }
        ctx.applyStatusWithImmunityCheck(side, '星哲', 3);
      }
    }

    if (event === EffectTiming.ROUND_END) {
      const selfEffects = ctx.self.effects || [];
      const n = selfEffects.length;
      if (n > 0) {
        const nextEffects = selfEffects.map(e => ({ ...e, duration: e.duration !== undefined ? Math.max(1, e.duration - n) : undefined }));
        ctx.updateElf(side, { effects: nextEffects });
        ctx.addLog(`✨ 【星光永恆】：自身處於 ${n} 種異常狀態，異常回合數減少 ${n} 回合（最低減至1回合）！`, "effect");
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), starlightNextSleepTurns: n + 1 });
      } else {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), starlightNextAttackBonus: true });
        ctx.addLog(`✨ 【星光永恆】：自身無異常狀態，下次攻擊技能將附加111點真實傷害！`, "effect");
      }
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      if (ctx.getPlayerState(regKey)?.starlightNextAttackBonus) {
        ctx.applyTrueDamage(ctx.targetSide, 111, "【星光永恆】111點真實傷害");
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), starlightNextAttackBonus: false });
        ctx.addLog(`✨ 【星光永恆】：攻擊附加了111點真實傷害！`, "damage");
      }
    }

    if (event === EffectTiming.BEFORE_ACTION) {
      const sleepTurns = ctx.getPlayerState(regKey)?.starlightNextSleepTurns;
      if (sleepTurns) {
        ctx.applyStatusWithImmunityCheck(ctx.targetSide, "沉睡", sleepTurns);
        ctx.addLog(`✨ 【星光永恆】：令對手進入【沉睡】異常狀態 ${sleepTurns} 回合！`, "effect");
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), starlightNextSleepTurns: undefined });
      }
    }
  },
  holy_sanctuary: (ctx, event, extraData) => {
    // 聖芒佑界套裝 (holy_sanctuary)
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.ON_ENTRANCE) {
      const res = ctx.self.resistances;
      if (res) {
        const crit = res.damageResist?.crit || 0;
        const fixed = res.damageResist?.fixed || 0;
        const percent = res.damageResist?.percent || 0;
        const statusMax = Math.max(0, ...(res.statusResist?.slots || []).map(s => s.rate || 0)) + (res.statusResist?.allImmune ? 5 : 0);

        const items = [
          { key: "crit", name: "致命一擊抗性", val: crit },
          { key: "fixed", name: "固定傷害抗性", val: fixed },
          { key: "percent", name: "百分比傷害抗性", val: percent },
          { key: "status", name: "異常狀態抗性", val: statusMax },
        ];
        items.sort((a, b) => b.val - a.val);

        if (items[0].val > items[1].val) {
          const highestKey = items[0].key;
          const nextRes = {
            damageResist: {
              crit: highestKey === "crit" ? 100 : 0,
              fixed: highestKey === "fixed" ? 100 : 0,
              percent: highestKey === "percent" ? 100 : 0,
            },
            statusResist: {
              allImmune: highestKey === "status",
              selectedStatuses: res.statusResist?.selectedStatuses || [],
              slots: (res.statusResist?.slots || []).map(s => ({
                ...s,
                rate: highestKey === "status" ? 100 : 0,
              })),
            },
          };
          ctx.updateElf(side, { resistances: nextRes });
          ctx.addLog(`✨ 【聖芒佑界】：抗性重分配！最高項【${items[0].name}】提升至 100%，其餘項減少至 0%！`, "effect");
        }
      }
    }

    if (event === EffectTiming.BEFORE_STATUS_APPLY) {
      // 自身進入的異常狀態最高為2回合
      if (extraData?.duration > 2) extraData.duration = 2;
    }

    if (event === EffectTiming.ON_STATUS_IMMUNIZED) {
      const ratio = ctx.getPlayerState(regKey)?.holySanctuaryHealRatio ?? 0.3;
      if (ratio > 0) {
        ctx.applyHeal(side, Math.floor(ctx.self.maxHp * ratio));
        ctx.addLog(`✨ 【聖芒佑界】：觸發免疫抗性，恢復體力！`, "heal");
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), holySanctuaryHealRatio: Math.max(0, ratio - 0.05) });
      }
    }
  },
  sky_cloud: (ctx, event, extraData) => {
    // 天光雲影戰甲 (sky_cloud): 登場回合必定爆擊；攻擊後附加效果。
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.ON_ENTRANCE) {
      ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), nextTurnCrit: true });
      ctx.addLog(`✨ 【天光雲影】：登場回合獲得【必中致命一擊】！`, "effect");
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming) {
      const isCrit = extraData?.isCrit || false;
      const finalDamage = extraData?.finalDamage || 0;
      
      if (isCrit || finalDamage === 0) {
        // 令對手當回合體力恢復效果減少75%
        const oppRegKey = ctx.targetSide === "p1" ? "p1RegistryState" : "p2RegistryState";
        ctx.setPlayerState(oppRegKey, { 
          ...ctx.getPlayerState(oppRegKey),
          healReduction: 0.75 
        });
        ctx.addLog(`✨ 【天光雲影】：使對手治療效果降低 75%！`, "effect");
      }
      if (!isCrit || finalDamage === 0) {
        const bonus = Math.floor((ctx.target.maxHp - ctx.target.currentHp) * 0.25);
        if (bonus > 0) {
          ctx.applyPinkDamage(ctx.targetSide, bonus, "【天光雲影】附加");
        }
      }
    }
  },
  venom_armor: (ctx, event, extraData) => {
    // 毒液戰甲 (venom_armor): 遊戲首回合降對手全隊屬性與治療；命中附加百分比傷害，未觸發則增傷。
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";
    const oppSide = ctx.targetSide;
    const oppRegKey = oppSide === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.ROUND_START || event === EffectTiming.ON_ENTRANCE) {
      if (!ctx.getPlayerState(regKey)?.venomArmorGameStartApplied) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), venomArmorGameStartApplied: true });
        
        // 令對手背包內精靈本場戰鬥防禦值-15%、特防值-15%、速度-10%
        const oppTeam = ctx.getFullTeam(oppSide);
        oppTeam.forEach(elf => {
          if (elf.calculatedStats) {
            const nextStats = {
              ...elf.calculatedStats,
              def: Math.floor(elf.calculatedStats.def * 0.85),
              spdef: Math.floor(elf.calculatedStats.spdef * 0.85),
              speed: Math.floor(elf.calculatedStats.speed * 0.90),
            };
            ctx.updateAnyElf(oppSide, elf.battleId || elf.id, { calculatedStats: nextStats });
          }
        });

        // 令對手在場精靈恢復體力時恢復效果減少 30%（體力藥劑除外）
        ctx.setPlayerState(oppRegKey, {
          ...ctx.getPlayerState(oppRegKey),
          healReduction: 0.30
        });

        ctx.addLog(`☣️ 【毒液戰甲】：遊戲首回合，對手全隊防禦-15%、特防-15%、速度-10%，且在場精靈治療效果減少 30%！`, "effect");
      }
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      if (prdChance("suitEffectRegistry:L565", 0.3)) {
        const bonus = Math.floor(ctx.target.maxHp * 0.15);
        ctx.applyPinkDamage(ctx.targetSide, bonus, "【毒液戰甲】百分比");
        ctx.setPlayerState(regKey, { 
          ...ctx.getPlayerState(regKey),
          venomTriggered: true 
        });
      } else {
        ctx.setPlayerState(regKey, { 
          ...ctx.getPlayerState(regKey),
          venomTriggered: false 
        });
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming) {
       if (ctx.getPlayerState(regKey)?.venomTriggered === false) {
          extraData!.damageComp.increasePercent += 0.3;
       }
    }
  },
  space_time: (ctx, event, extraData) => {
    // 時空戰甲套裝 (space_time)
    if (event === EffectTiming.ROUND_START) {
      const currentChance = 0.10 + (ctx.getPlayerState("spaceTimeBonusChance") || 0);
      if (prdChance("suitEffectRegistry:L590", currentChance)) {
        ctx.setPlayerState("spaceTimeStatusImmuneThisRound", true);
        ctx.addLog(`✨ 【時空戰甲】：每回合免疫判定成功！本回合免疫異常狀態！`, "effect");
      } else {
        ctx.setPlayerState("spaceTimeStatusImmuneThisRound", false);
        ctx.setPlayerState("spaceTimeNextDmgReduce", true);
        const nextChance = Math.min(0.30, currentChance + 0.05);
        ctx.setPlayerState("spaceTimeBonusChance", nextChance - 0.10);
        ctx.addLog(`✨ 【時空戰甲】：每回合免疫判定失敗，本回合受到的下1次傷害減少30%，且本次戰鬥免疫機率提升至 ${(nextChance * 100).toFixed(0)}%！`, "effect");
      }
    }

    if (event === EffectTiming.BEFORE_STATUS_APPLY) {
      if (ctx.getPlayerState("spaceTimeStatusImmuneThisRound")) {
        extraData.prevented = true;
        ctx.addLog(`✨ 【時空戰甲】：受「時空戰甲」免疫保護，防止了異常狀態！`, "effect");
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && extraData!.damageComp?.isIncoming) {
      if (ctx.getPlayerState("spaceTimeNextDmgReduce")) {
        extraData!.damageComp.decreasePercent = (extraData!.damageComp.decreasePercent || 0) + 0.3;
        ctx.setPlayerState("spaceTimeNextDmgReduce", false);
        ctx.addLog(`✨ 【時空戰甲】：使本次受到的傷害減少 30%！`, "effect");
      }
    }

    if (event === EffectTiming.AFTER_ACTION && extraData?.isIncoming && extraData?.skill?.category !== "屬性") {
      const absorb = Math.floor(ctx.target.currentHp / 5);
      if (absorb > 0) {
        ctx.applyPinkDamage(ctx.targetSide, absorb, "【時空戰甲】吸取");
        ctx.applyHeal(ctx.actor, absorb);
      }
    }
  },
  proud_peak: (ctx, event, extraData) => {
    // 笑傲巔峰套裝 (proud_peak): 爆擊機率遞增，未爆擊造成傷害前附加百分比傷害。
    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      const isCrit = extraData!.damageComp?.isCrit || false;
      if (!isCrit) {
        const bonus = Math.floor(ctx.self.maxHp * 0.13);
        ctx.addLog(`✨ 【笑傲巔峰】：本次攻擊未觸發致命一擊，造成傷害前附加自身最大體力 13% 的百分比傷害（${bonus} 點）！`, "effect");
        ctx.applyPinkDamage(ctx.targetSide, bonus, "【笑傲巔峰】附加");
      }
    }

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming && ctx.skill?.category !== "屬性") {
      const regKey = ctx.actor === "p1" ? "p1RegistryState" : "p2RegistryState";
      const stacks = ctx.getPlayerState(regKey)?.suitCritStacks || 0;
      if (stacks < 3) {
        ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), suitCritStacks: stacks + 1 });
        ctx.addLog(`✨ 【笑傲巔峰】：使用攻擊技能，致命一擊機率提升 1/16（當前額外提升 ${(stacks + 1)}/16）！`, "effect");
      }
    }
  },
  phoenix_wings: (ctx, event, extraData) => {
    // 浴火之翼套裝 (phoenix_wings): 命中附加百分比傷害（疊加）；屬性技能後增傷。
    const side = ctx.actor;
    const regKey = side === "p1" ? "p1RegistryState" : "p2RegistryState";

    if (event === EffectTiming.AFTER_ACTION && !extraData!.damageComp?.isIncoming) {
      if (ctx.skill?.category !== "屬性") {
        let stacks = ctx.getPlayerState(regKey)?.phoenixPercentStacks || 0;
        const bonus = Math.floor(ctx.target.maxHp * 0.05 * (stacks + 1));
        ctx.applyPinkDamage(ctx.targetSide, bonus, "【浴火之翼】附加");
        if (stacks < 6) {
          ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), phoenixPercentStacks: stacks + 1 });
        }
      } else {
        let boostStacks = ctx.getPlayerState(regKey)?.phoenixBoostStacks || 0;
        if (boostStacks < 3) {
          ctx.setPlayerState(regKey, { ...ctx.getPlayerState(regKey), phoenixBoostStacks: boostStacks + 1 });
          ctx.addLog(`🔥 【浴火之翼】：提升 10% 攻擊傷害（當前疊加 ${boostStacks + 1} 次）`, "effect");
        }
      }
    }

    if (event === EffectTiming.BEFORE_DAMAGE && !extraData!.damageComp?.isIncoming) {
      const boostStacks = ctx.getPlayerState(regKey)?.phoenixBoostStacks || 0;
      extraData!.damageComp.increasePercent += 0.1 * boostStacks;
    }
  }
};
