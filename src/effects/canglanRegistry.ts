import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

export const handleCanglanSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, actor, setPlayerState, getPlayerState, addLog, applyHeal } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";
  const ownerId = (elf: any) => elf?.battleId || elf?.id;
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
      if (!extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        const water = markCount(actor, "blk_永恆之水", self);
        if (water > 0 && extraData?.increasePercent !== undefined) {
          extraData.increasePercent += water * 0.4;
        }
      }
      // 自身受到技能傷害減半
      if (extraData?.isIncoming && extraData?.damageCategory === "skill_attack") {
        extraData.multiplier *= 0.5;
        addLog(`🌊 【瀾】：水幕屏障，傷害減半！`, "effect");
      }
      break;

    case EffectTiming.AFTER_DAMAGE:
      // 每次受到技能傷害後恢復自身最大體力 1/3 並使自身抵擋下次受到的技能傷害
      if (extraData?.isIncoming && (extraData?.damageCategory === "skill_attack" || extraData?.damageType === "skill_attack")) {
        applyHeal(actor, Math.floor(self.maxHp / 3));
        setPlayerState("evasionActive", true);
        addLog(`🌊 【瀾】：潮汐復甦，並準備抵擋下次攻擊！`, "heal");
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
    const { addLog, self, target, actor, updateElf } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const selfShield = self.shield || 0;
    const selfBarrier = self.barrier || 0;
    const oppShield = target ? (target.shield || 0) : 0;
    const oppBarrier = target ? (target.barrier || 0) : 0;
    const totalConsumed = selfShield + selfBarrier + oppShield + oppBarrier;

    if (totalConsumed > 0) {
      self.shield = 0;
      self.barrier = 0;
      if (target) {
        target.shield = 0;
        target.barrier = 0;
      }
      if (updateElf) {
        updateElf(actor, { id: self.id, shield: 0, barrier: 0 });
        if (target) updateElf(oppSide, { id: target.id, shield: 0, barrier: 0 });
      }
      addLog(`🌊 【王·洛浦凌波】：消耗雙方全部護盾與護罩 (${totalConsumed} 點)！令對手下次技能無效！`, "effect");
    }
  },
  "王·深海之吻": (ctx) => {
    const { addLog, self, target, actor, updateElf, applyPinkDamage } = ctx;
    const oppSide = actor === "p1" ? "p2" : "p1";
    const selfOwner = self.battleId || self.id;
    const targetOwner = target.battleId || target.id;
    const hasWater = ctx.getMarks(actor).some(mark => mark.id === "blk_永恆之水" && mark.ownerBattleId === selfOwner && mark.count > 0);
    const hasTear = ctx.getMarks(oppSide).some(mark => mark.id === "blk_千秋一淚" && mark.ownerBattleId === targetOwner && mark.count > 0);
    if (hasTear) {
      const drain = Math.floor(self.maxHp * 0.25);
      const actual = applyPinkDamage(oppSide, drain, "王·深海之吻汲取", ctx.activeP1, ctx.activeP2, "percent");
      ctx.applyHeal(actor, actual);
    }
    const pct = hasWater ? 0.60 : 0.40;
    const baseDmg = Math.floor(self.maxHp * pct);
    const shieldGain = baseDmg;
    self.shield = (self.shield || 0) + shieldGain;
    if (updateElf) updateElf(actor, { id: self.id, shield: self.shield });

    const dealt = applyPinkDamage(oppSide, baseDmg, "王·深海之吻百分比傷害", ctx.activeP1, ctx.activeP2, "percent");
    if (hasWater) ctx.applyHeal(actor, dealt);
    addLog(`💋 【王·深海之吻】：附加 ${dealt} 點百分比傷害，並為自身附加 ${shieldGain} 點深海護盾！`, "effect");
  }
};

export { CanglanDeconstructedProfile } from "../data/elfProfiles/canglanRegistry";
