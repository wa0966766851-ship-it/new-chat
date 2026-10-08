import { multiplyDamageReduction, addDamageReduction } from '../../../battle/damageReduction';
import { abilityKeys, currentElf, clearStatuses } from '../../semanticOperations';
import { sameStatus } from '../../statusIdentity';
import type { Skill } from '../../../types';
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';

export const handleCanglanSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";
  const ownerId = (elf: any) => elf?.battleId || elf?.id;
  const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  if (ownerId(active) !== ownerId(self) && [EffectTiming.ROUND_START, EffectTiming.ROUND_END, EffectTiming.BEFORE_SKILL, EffectTiming.AFTER_ACTION].includes(event as EffectTiming)) return false;
  const markCount = (side: "p1" | "p2", id: string, elf: any) =>
    ctx.getMarks(side).find(mark => mark.id === id && mark.ownerBattleId === ownerId(elf))?.count || 0;
  const setOwnedMark = (side: "p1" | "p2", elf: any, id: "blk_永恆之水" | "blk_千秋一淚", count: number) => {
    const isWater = id === "blk_永恆之水";
    ctx.setMark({
      id,
      displayChar: isWater ? "水" : "淚",
      count,
      name: isWater ? "永恆之水" : "千秋一淚",
      ownerBattleId: ownerId(elf),
      description: isWater
        ? "最多8道；每道使攻擊傷害提升40%，並參與護盾保留與重生效果。"
        : "最多4道；依道數降低恢復量，並逐步使減傷、護盾附帶效果與技能傷害免疫失效。",
    }, side);
  };
  const addOwnedMark = (side: "p1" | "p2", elf: any, id: "blk_永恆之水" | "blk_千秋一淚", amount: number) => {
    const max = id === "blk_永恆之水" ? 8 : 4;
    const next = Math.min(max, markCount(side, id, elf) + amount);
    setOwnedMark(side, elf, id, next);
    return next;
  };

  switch (event) {
    case EffectTiming.ON_ENTRANCE: {
      addLog(`🌊 【瀾】：海神降臨，潮汐護佑！`, "effect");
      const oppShield = ctx.target ? (ctx.target.shield || 0) : 0;
      const selfShield = self.shield || 0;
      let totalShieldToAdd = 600;
      if (oppShield > 0 || selfShield > 0) {
        totalShieldToAdd += (oppShield + selfShield);
      }
      self.shield = (self.shield || 0) + totalShieldToAdd;
      setPlayerState("shieldAmount", self.shield);
      if (ctx.updateElf) ctx.updateElf(actor, { id: self.id, shield: self.shield });
      addLog(`🌊 【瀾】：獲得 ${totalShieldToAdd} 點水幕護盾！`, "effect");
      break;
    }

    case EffectTiming.BEFORE_DAMAGE:
      // 回合開始時：雙方每存在100點護盾 → 直到下回合結束，每次受到固定／百分比傷害額外減半一次（n 次即 ×0.5^n），
      // 且減半後傷害不超過雙方當前護盾值總和的 1/3（下場後保留）。
      if (extraData?.isIncoming && (extraData?.damageCategory === "fixed" || extraData?.damageCategory === "percent")) {
        const n = Number(getPlayerState("canglanShieldHalves") || 0);
        if (n > 0 && Number(getPlayerState("canglanShieldHalvesLeft") || 0) > 0) {
          for (let i = 0; i < n; i++) multiplyDamageReduction(extraData, 0.5);
          const shields = (self.shield || 0) + (ctx.target?.shield || 0);
          extraData.limit = Math.min(extraData.limit ?? Infinity, Math.floor(shields / 3));
          addLog(`🌊 【瀾】：固定／百分比傷害減半 ${n} 次！`, "effect");
        }
      }
      if (!extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        const water = markCount(actor, "blk_永恆之水", self);
        if (water > 0 && extraData?.increasePercent !== undefined) {
          extraData.increasePercent += water * 0.4;
        }
      }
      // 自身受到技能傷害減半
      if (extraData?.isIncoming && String(extraData?.damageCategory).startsWith("skill")) {
        multiplyDamageReduction(extraData, 0.5);
        addLog(`🌊 【瀾】：水幕屏障，傷害減半！`, "effect");
      }
      break;

    case EffectTiming.ON_DAMAGED:
      // 每次受到技能傷害後恢復自身最大體力 1/3 並使自身抵擋下次受到的技能傷害
      if (extraData?.targetSide === actor && String(extraData?.damageType).startsWith("skill") && extraData?.hpReduced > 0) {
        setPlayerState("canglanTookSkillDamage", true);
        applyHeal(actor, Math.floor(self.maxHp / 3));
        setPlayerState("blockAttackCount", (getPlayerState("blockAttackCount") || 0) + 1);
        addLog(`🌊 【瀾】：潮汐復甦，並準備抵擋下次攻擊！`, "heal");
      }
      break;

    case EffectTiming.ROUND_START: {
      setPlayerState("canglanTookSkillDamage", false);
      const steps = Math.floor(((self.shield || 0) + (ctx.target?.shield || 0)) / 100);
      const prevLeft = Number(getPlayerState("canglanShieldHalvesLeft") || 0);
      const prevN = prevLeft > 0 ? Number(getPlayerState("canglanShieldHalves") || 0) : 0;
      if (steps > 0) { setPlayerState("canglanShieldHalves", Math.max(steps, prevN)); setPlayerState("canglanShieldHalvesLeft", 2); }
    }
      if (getPlayerState("canglanCureNextRound")) {
        clearStatuses(ctx, actor, self, name => name !== "normal");
        setPlayerState("canglanCureNextRound", false);
      }
      break;
    case EffectTiming.MODIFY_PRIORITY:
      if (extraData?.priorityComp) {
        if ((self.shield || 0) > 0 || (ctx.target.shield || 0) > 0) extraData.priorityComp.bonus += 1;
        if (!self.isInherentInvalid && ctx.skill?.name === '王·洛浦凌波' && Object.values(self.statStages || {}).some(n => n < 0)) extraData.priorityComp.bonus += 3;
      }
      break;
    case EffectTiming.ROUND_END:
      if (Number(getPlayerState("canglanShieldHalvesLeft") || 0) > 0) setPlayerState("canglanShieldHalvesLeft", Number(getPlayerState("canglanShieldHalvesLeft")) - 1);
      if (!getPlayerState("canglanTookSkillDamage")) {
        const n = ctx.applyPinkDamage(oppSide, Math.floor(ctx.target.maxHp / 3), "瀾·吸取", undefined, undefined, "percent");
        applyHeal(actor, n);
        setPlayerState("canglanCureNextRound", true);
      }
      break;
    case EffectTiming.BEFORE_SKILL: {
      const anyShield = (self.shield || 0) > 0 || (ctx.target.shield || 0) > 0;
      const anyoneWithoutShield = (self.shield || 0) <= 0 || (ctx.target.shield || 0) <= 0;
      if (ctx.skill?.category !== "屬性") {
        const gained = 1 + (anyShield ? 1 : 0);
        const water = addOwnedMark(actor, self, "blk_永恆之水", gained);
        addLog(`🌊 【瀾】：使用攻擊技能，獲得 ${gained} 道【永恆之水】（目前 ${water}/8）！`, "effect");
      }
      if (anyoneWithoutShield) {
        if (extraData?.ppCostComp) extraData.ppCostComp.multiplier = 0;
        setPlayerState("canglanAddTearAfterAction", true);
      }
      break;
    }

    case EffectTiming.AFTER_ACTION:
      if (getPlayerState("canglanAddTearAfterAction")) {
        const tears = addOwnedMark(oppSide, ctx.target, "blk_千秋一淚", 1);
        setPlayerState("canglanAddTearAfterAction", false);
        addLog(`💧 【瀾】：場上存在無護盾者，對手獲得1道【千秋一淚】（目前 ${tears}/4）！`, "effect");
      }
      break;

    case EffectTiming.FATAL_RESIST: {
      const water = markCount(actor, "blk_永恆之水", self);
      const tears = markCount(oppSide, "blk_千秋一淚", ctx.target);
      if (water >= 2 && tears >= 1) {
        setOwnedMark(actor, self, "blk_永恆之水", water - 2);
        setOwnedMark(oppSide, ctx.target, "blk_千秋一淚", tears - 1);
        self.currentHp = Math.max(1, self.maxHp);
        self.battleStatus = "normal";
        self.battleStatusDuration = 0;
        self.battleStatuses = {};
        addLog(`🌊 【永恆之水】：消耗2道永恆之水與對手1道千秋一淚，解除異常並重生！`, "effect");
        return true;
      }
      return false;
    }
  }

  return false;
};

export const CANGLAN_SKILLS: Record<string, BattleSkillHandler> = {
  "滄海永存": (ctx) => {
    const { addLog, applyHeal, setPlayerState, self, actor } = ctx;
    addLog(`🌊 【滄海永存】：海納百川，生生不息！`, "effect");
    applyHeal(actor, self.maxHp);
    self.shield = (self.shield || 0) + 400;
    setPlayerState("shieldAmount", (ctx.getPlayerState("shieldAmount") || 0) + 400);
    if (ctx.updateElf) ctx.updateElf(actor, { id: self.id, shield: self.shield });
    addLog(`🛡️ 【滄海永存】：獲得 400 點水流護盾！`, "effect");
  },
  "弱水三千": (ctx) => {
    const { addLog, clearTurnEffectsOf } = ctx;
    addLog(`🌊 【弱水三千】：弱水環繞，封印屬性！`, "effect");
    clearTurnEffectsOf(ctx.targetSide);
  },
  "永恆誓約": (ctx) => {
    const { addLog, self, actor, updateElf } = ctx;
    addLog(`🌊 【永恆誓約】：永恆屏障，誓約守護！`, "effect");
    self.shield = (self.shield || 0) + 500;
    if (updateElf) updateElf(actor, { id: self.id, shield: self.shield });
    addLog(`🛡️ 【永恆誓約】：獲得 500 點誓約護盾！`, "effect");
    const owner = self.battleId || self.id;
    const opponent = ctx.target;
    const oppOwner = opponent.battleId || opponent.id;
    const waterMark = ctx.getMarks(actor).find(mark => mark.id === "blk_永恆之水" && mark.ownerBattleId === owner);
    const tearMark = ctx.getMarks(ctx.targetSide).find(mark => mark.id === "blk_千秋一淚" && mark.ownerBattleId === oppOwner);
    const currentWater = waterMark?.count || 0;
    const targetWater = Math.max(currentWater + 1, tearMark?.count || 0);
    ctx.setMark({
      id: "blk_永恆之水", displayChar: "水", count: Math.min(8, targetWater), name: "永恆之水",
      ownerBattleId: owner, description: "最多8道；每道使攻擊傷害提升40%，並參與護盾保留與重生效果。",
    }, actor);
  },
  "王·洛浦凌波": (ctx) => {
    const { self, target, actor, targetSide } = ctx;
    const stages = { ...self.statStages };
    const transfer: Record<string, number> = {};
    for (const key of abilityKeys) if ((stages[key] || 0) < 0) {
      transfer[key] = stages[key]; stages[key] = -stages[key];
    }
    if (Object.keys(transfer).length) {
      ctx.updateElf(actor, { statStages: stages });
      ctx.applyStatChange(targetSide, transfer);
    }
    const consumed = (self.shield || 0) + (self.barrier || 0) + (target.shield || 0) + (target.barrier || 0);
    ctx.setPlayerState("canglanConsumedProtection", consumed);
    if (consumed > 0) {
      ctx.updateElf(actor, { shield: 0, barrier: 0 });
      ctx.updateElf(targetSide, { shield: 0, barrier: 0 });
      ctx.setOpponentState("nextSkillInvalid", true);
      ctx.setOpponentState("nextSkillInvalidReason", "【王·洛浦凌波】");
      ctx.applyPinkDamage(targetSide, Math.floor(consumed * 0.7), "王·洛浦凌波", undefined, undefined, "percent");
    }
  },
  "王·深海之吻": (ctx) => {
    const { self, target, actor, targetSide } = ctx;
    const cleared = ctx.clearTurnEffectsOf(targetSide, target);
    if (cleared) for (const status of ["束縛", "凍傷", "冰封"]) ctx.applyStatusWithImmunityCheck(targetSide, status, 3);
    // 原文的全部成功／任意失敗／不存在／不可清除四分枝均給免疫。
    ctx.setPlayerState("blkImmuneStatusCount", (ctx.getPlayerState("blkImmuneStatusCount") || 0) + 2);
    const before = ctx.getStatuses(currentElf(ctx, targetSide, target));
    const frozen = ctx.applyStatusWithImmunityCheck(targetSide, "冰封", 3);
    if (frozen.success) clearStatuses(ctx, targetSide, target, name => name !== "normal" && !sameStatus(name, "冰封") && (before[name] || 0) > 0);
    const owner = self.battleId || self.id, foe = target.battleId || target.id;
    const water = ctx.getMarks(actor).some(m => m.id === "blk_永恆之水" && m.ownerBattleId === owner && m.count > 0);
    const tear = ctx.getMarks(targetSide).some(m => m.id === "blk_千秋一淚" && m.ownerBattleId === foe && m.count > 0);
    if (tear) ctx.applyAbsorb(targetSide, Math.floor(self.maxHp / 4), "王·深海之吻·汲取");
    const amount = Math.floor(self.maxHp * (water ? 0.6 : 0.4));
    ctx.applyPinkDamage(targetSide, amount, "王·深海之吻", undefined, undefined, "percent");
    const latest = currentElf(ctx, actor, self);
    ctx.updateElf(actor, { shield: (latest.shield || 0) + amount });
    if (water) ctx.applyHeal(actor, amount);
  }
};

export const CANGLAN_DAMAGE_TRANSFORMS = {
  "王·洛浦凌波": (ctx: BattleEventContext, skill: Skill): Skill => {
    const consumed = ctx.getPlayerState("canglanConsumedProtection") || 0;
    ctx.setPlayerState("canglanConsumedProtection", 0);
    return { ...skill, power: (skill.power || 0) + consumed };
  },
};

export { CanglanDeconstructedProfile } from "../../../data/elfProfiles/canglanRegistry";
