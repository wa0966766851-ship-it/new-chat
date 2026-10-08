import type { Skill } from '../../../types';
import { runDixinFormation } from './formation';
import { abilityKeys, abilityLevels, absorbBoosts, currentElf } from '../../semanticOperations';
import { prdChance } from "../../../utils/prd";
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from '../../types';

export const handleDixinSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, addLog, applyHeal, applyPinkDamage, applyTrueDamage, applyStatChange } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";
  const active = actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  const isActive = (active.battleId || active.id) === (self.battleId || self.id);
  runDixinFormation(ctx, event, extraData);
  if (event === EffectTiming.BEFORE_DAMAGE && !extraData?.isIncoming && isActive && ctx.skill?.name === '帝怒傾天'
    && !self.isInherentInvalid && (getPlayerState('dixinBahuangStacks') || 0) >= 3) {
    const comp = extraData.damageComp || extraData;
    comp.reductionPolicy = { ...comp.reductionPolicy, attenuation: 0 };
  }
  if (!isActive && [EffectTiming.ROUND_END, EffectTiming.BATTLE_PHASE_END, EffectTiming.MODIFY_POWER].includes(event as EffectTiming)) return false;
  if (event === EffectTiming.ROUND_START) setPlayerState('dixinOpponentUsedSkill', false);
  if (event === EffectTiming.OPPONENT_ACTION) setPlayerState('dixinOpponentUsedSkill', true);
  if (event === EffectTiming.OPPONENT_ACTION && extraData?.skill?.category === '屬性' && dixinTimer(ctx, 'dixin_yuyu')) {
    ctx.addTimerTo(oppSide, { id: 'dixin_yuyu_attack_seal', name: '人皇御宇', kind: 'turn_effect', source: 'skill', remaining: 1, tickAt: 'round_end', pendingActivation: true,
      payload: { block: { addInvalid: '攻擊' }, preventAttackDamage: true } }, false);
  }
  const ownerId = (elf: any) => elf?.battleId || elf?.id;
  const addOwnedMark = (
    side: "p1" | "p2",
    elf: any,
    id: "fumo_mark" | "duomo_mark",
    name: string,
    displayChar: string,
    delta = 1,
  ) => {
    const existing = ctx.getMarks(side).find(mark => mark.id === id && mark.ownerBattleId === ownerId(elf));
    const count = (existing?.count || 0) + delta;
    ctx.setMark({ id, name, displayChar, count, ownerBattleId: ownerId(elf), description: "" }, side);
    return count;
  };
  const syncBahuangMark = (count: number) => { ctx.setMark({
    id: "bahuang_mark",
    displayChar: "荒",
    count,
    name: "八荒",
    ownerBattleId: self.battleId || self.id,
    description: "帝辛專屬層數；最高9層，各層解鎖效果依魂印描述結算。",
  }, actor); runDixinFormation(ctx, 'CHECK_FORMATION'); };

  // 1. 登場時：獲得 2 層八荒
  if (event === EffectTiming.ON_ENTRANCE) {
    let stacks = getPlayerState("dixinBahuangStacks") || 0;
    stacks += 2;
    setPlayerState("dixinBahuangStacks", Math.min(9, stacks));
    syncBahuangMark(Math.min(9, stacks));
    addLog(`👑 【荒】：帝威顯赫！八荒層數提升至 ${Math.min(9, stacks)}！`, "effect");
  }

  // 對方主動換上新精靈時：八荒 +2，並把墮魔印記掛在該隻新上場精靈身上。
  if (event === "OPPONENT_SWITCH" && extraData?.switchingSide === oppSide) {
    const stacks = Math.min(9, (getPlayerState("dixinBahuangStacks") || 0) + 2);
    setPlayerState("dixinBahuangStacks", stacks);
    syncBahuangMark(stacks);
    const duomo = addOwnedMark(oppSide, target, "duomo_mark", "墮魔印記", "墮");
    addLog(`👑 【荒】：對手主動切換，八荒提升至 ${stacks} 層並附加第 ${duomo} 層【墮魔印記】！`, "effect");
  }

  // 2. 回合結束時：增減八荒層數與觸發效果
  if (event === EffectTiming.ROUND_END) {
    let stacks = getPlayerState("dixinBahuangStacks") || 0;
    
    // 判定對方是否使用技能
    if ((getPlayerState('dixinOpponentUsedSkill') || extraData?.opponentUsedSkill) && !dixinTimer(ctx, 'dixin_nine_lock')) {
      stacks = Math.max(0, stacks - 1);
    } else if (!getPlayerState('dixinOpponentUsedSkill') && !extraData?.opponentUsedSkill) {
      stacks = Math.min(9, stacks + 1);
    }
    setPlayerState("dixinBahuangStacks", stacks);
    syncBahuangMark(stacks);
    addLog(`👑 【荒】：八荒演變，當前層數：${stacks}`, "effect");

    if (stacks >= 7) {
      const fumo = ctx.getMarks(actor).find(m => m.id === "fumo_mark" && m.ownerBattleId === ownerId(self))?.count || 0;
      const duomo = ctx.getMarks(oppSide).find(m => m.id === "duomo_mark" && m.ownerBattleId === ownerId(target))?.count || 0;
      ctx.updateElf(actor, { barrier: (self.barrier || 0) + fumo * dixinEffectFactor(ctx) });
      absorbBoosts(ctx, false, duomo * dixinEffectFactor(ctx));
    }
    // 觸發層數效果
    if (stacks >= 3) {
      const ppDrain = 2 * dixinEffectFactor(ctx);
      const skills = target.skills.map(skill => {
        const cur = skill.currentPp ?? skill.pp ?? 0;
        const next = Math.max(0, cur - ppDrain);
        return { ...skill, currentPp: next, pp: next };
      });
      ctx.updateElf(oppSide, { skills });
      ctx.updateElf(actor, { skills: self.skills.map(skill => ({ ...skill, pp: Math.min(skill.maxPp ?? skill.pp, (skill.pp || 0) + ppDrain) })) });
      const drainAmt = Math.floor(target.maxHp / 3) * dixinEffectFactor(ctx);
      const actual = applyPinkDamage(oppSide, drainAmt, "八荒吸取", undefined, undefined, 'percent');
      applyHeal(actor, actual);

    }
    if (stacks >= 5) {
      const healAmt = (Math.floor(self.maxHp / 3) + Math.floor(Math.max(0, self.maxHp - self.currentHp) / 3)) * dixinEffectFactor(ctx);
      applyHeal(actor, healAmt);
      if (prdChance("dixinRegistry:L44", 0.5)) {
        setOpponentState("nextSkillInvalid", true);
        addLog(`👑 【荒】：天威壓制，對手下回合技能可能失效！`, "status");
      }
    }
  }

  if (event === EffectTiming.ROUND_END && dixinTimer(ctx, 'dixin_yuyu')) {
    const n = ctx.applyPinkDamage(oppSide, Math.floor(target.maxHp / 3), '人皇御宇·吸取', undefined, undefined, 'percent');
    applyHeal(actor, n);
  }

  if (event === EffectTiming.MODIFY_POWER && !extraData?.isIncoming && extraData?.skill?.category !== "屬性") {
    const stacks = getPlayerState("dixinBahuangStacks") || 0;
    if (stacks >= 1) extraData.powerComp.power *= 1 + stacks * 0.13 * dixinEffectFactor(ctx);
  }
  if (event === EffectTiming.AFTER_ACTION && ctx.skill && ctx.isHit !== false) {
    const stacks = getPlayerState("dixinBahuangStacks") || 0;
    if (stacks >= 2) ctx.applyFixedDamage(oppSide, stacks * 39 * dixinEffectFactor(ctx), "八荒固傷");
  }
  if (event === EffectTiming.OPPONENT_DAMAGE && ["八荒吸取", "人皇御宇·吸取"].includes(extraData?.label) && extraData?.hpReduced <= 0) {
    applyTrueDamage(oppSide, 300, "八荒吸取未生效");
    addOwnedMark(actor, self, "fumo_mark", "伏魔印記", "伏");
  }
  if (event === EffectTiming.MODIFY_PRIORITY && extraData?.priorityComp && !self.isInherentInvalid) {
    const stacks = getPlayerState("dixinBahuangStacks") || 0;
    if (ctx.skill?.name === "人皇御宇" && stacks >= 3) extraData.priorityComp.bonus += 3;
    if (ctx.skill?.name === "玄鳥天命") extraData.priorityComp.bonus += stacks;
    if (ctx.skill?.name === "帝怒傾天") {
      if (abilityLevels(self, false)) extraData.priorityComp.bonus += 3;
      if (abilityLevels(target, true)) extraData.priorityComp.bonus += 3;
    }
  }
  // 擊敗對手時清空
  if (event === EffectTiming.BATTLE_PHASE_END && extraData?.killedOpponent) {
    setPlayerState("dixinBahuangStacks", 0);
    ctx.clearMark("bahuang_mark", actor);
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
    const drained = ctx.applyPinkDamage(ctx.targetSide, stacks * 139, "鹿台悲歌·吸取", undefined, undefined, "fixed");
    ctx.applyHeal(actor, drained);
    ctx.addTimerTo(actor, { id: "dixin_lutai_priority", name: "鹿台悲歌", source: "skill", kind: "turn_effect", remaining: 2, tickAt: "round_end", pendingActivation: true, payload: { block: { prio: 2 } } }, ctx.moveIndex === 1);
    ctx.applyStatusWithImmunityCheck(actor, "狂暴", 3);
    setPlayerState("dixinBahuangStacks", Math.min(9, stacks + 2));
    ctx.setMark({
      id: "bahuang_mark", displayChar: "荒", count: Math.min(9, stacks + 2), name: "八荒",
      ownerBattleId: ctx.self.battleId || ctx.self.id,
      description: "帝辛專屬層數；最高9層，各層解鎖效果依魂印描述結算。",
    }, actor);
    runDixinFormation(ctx, 'CHECK_FORMATION');
  },
  "九鼎震八荒": (ctx) => {
    if (ctx.getPlayerState('dixinNineUsed')) return;
    ctx.setPlayerState('dixinNineUsed', true);
    ctx.setPlayerState('dixinBahuangStacks', 9);
    ctx.addTimerTo(ctx.actor, { id: 'dixin_nine_lock', name: '九鼎震八荒', kind: 'turn_effect', source: 'skill',
      remaining: 9, tickAt: 'round_end' }, false);
    ctx.setMark({ id: 'bahuang_mark', name: '八荒', displayChar: '荒', count: 9, description: '九鼎震八荒成功後附加9層八荒。', ownerBattleId: ctx.self.battleId || ctx.self.id });
    runDixinFormation(ctx, 'CHECK_FORMATION');
  },
  "人皇御宇": (ctx) => {
    const { actor, addLog, setOpponentState, applyStatusWithImmunityCheck } = ctx;
    addLog(`📜 【人皇御宇】：降下臣服旨意！`, "effect");
    const res = applyStatusWithImmunityCheck(actor === "p1" ? "p2" : "p1", "臣服", 3);
    if (!res.success) {
      addLog(`📜 【人皇御宇】：旨意受阻，轉化為星賜守護！`, "effect");
      applyStatusWithImmunityCheck(actor, "星賜", 3);
      setOpponentState("attackInvalidTurns", 2);
      setOpponentState("attackSkillInvalidTurns", 2);
      setOpponentState("attackSkillInvalidReason", "【人皇御宇】星賜守護");
    }
    ctx.addTimerTo(actor, { id: 'dixin_yuyu', name: '人皇御宇', source: 'skill', kind: 'turn_effect', remaining: 4, tickAt: 'round_end' }, ctx.moveIndex === 1);
  },
  "帝怒傾天": (ctx) => {
    const { addLog, applyStatChange, target } = ctx;
    addLog(`🔥 【帝怒傾天】：無視一切防禦，傾天一擊！`, "effect");
    ctx.applyFixedDamage(ctx.targetSide, abilityLevels(ctx.self, false) * 60, "帝怒傾天");
  }
};

export { DixinDeconstructedProfile } from "../../../data/elfProfiles/dixinRegistry";

function dixinEffectFactor(ctx: BattleEventContext): number {
  if ((ctx.getPlayerState("dixinBahuangStacks") || 0) < 8) return 1;
  const has = (side: "p1" | "p2", id: string, elf: any) => ctx.getMarks(side).some(m => m.id === id && m.count > 0 && m.ownerBattleId === (elf.battleId || elf.id));
  return (has(ctx.actor, "fumo_mark", ctx.self) ? 2 : 1) * (has(ctx.targetSide, "duomo_mark", ctx.target) ? 2 : 1);
}
function dixinTimer(ctx: BattleEventContext, id: string): boolean {
  return ((ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers) || []).some(t => t.id === id && t.remaining > 0 && !t.pendingActivation && (!t.ownerBattleId || t.ownerBattleId === (ctx.self.battleId || ctx.self.id)));
}
export const DIXIN_DAMAGE_TRANSFORMS = {
  "帝怒傾天": (ctx: BattleEventContext, skill: Skill): Skill => ctx.self.isInherentInvalid ? skill : {
    ...skill, power: (skill.power || 0) + abilityLevels(ctx.target, true) * 30,
  },
};
