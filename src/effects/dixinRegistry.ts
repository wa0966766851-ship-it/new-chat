import { prdChance } from "../utils/prd";
import { BattleEventContext, BattleSkillHandler, EffectTiming, ElfDeconstructedProfile } from './types';

export const handleDixinSoulMark = (ctx: BattleEventContext, event: EffectTiming | string, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, setOpponentState, addLog, applyHeal, applyPinkDamage, applyTrueDamage, applyStatChange } = ctx;
  const oppSide = actor === "p1" ? "p2" : "p1";
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
  const syncBahuangMark = (count: number) => ctx.setMark({
    id: "bahuang_mark",
    displayChar: "荒",
    count,
    name: "八荒",
    ownerBattleId: self.battleId || self.id,
    description: "帝辛專屬層數；最高9層，各層解鎖效果依魂印描述結算。",
  }, actor);

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
    if (extraData?.opponentUsedSkill) {
      stacks = Math.max(0, stacks - 1);
    } else {
      stacks = Math.min(9, stacks + 1);
    }
    setPlayerState("dixinBahuangStacks", stacks);
    syncBahuangMark(stacks);
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
      for (const skill of target.skills || []) {
        const cur = skill.currentPp ?? skill.pp ?? 0;
        const next = Math.max(0, cur - 2);
        skill.currentPp = next;
        skill.pp = next;
      }
      const drainAmt = Math.floor(target.maxHp / 3);
      const actual = applyPinkDamage(oppSide, drainAmt, "八荒汲取");
      applyHeal(actor, actual);
      if (actual <= 0) {
        applyTrueDamage(oppSide, 300, "八荒汲取未生效");
        const fumo = addOwnedMark(actor, self, "fumo_mark", "伏魔印記", "伏");
        addLog(`👑 【荒】：百分比吸取未使對手失去體力，改為300點真實傷害並獲得第 ${fumo} 層【伏魔印記】！`, "effect");
      }
    }
    if (stacks >= 5) {
      const healAmt = Math.floor(self.maxHp / 3) + Math.floor(Math.max(0, self.maxHp - self.currentHp) / 3);
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
    setPlayerState("dixinBahuangStacks", Math.min(9, stacks + 2));
    ctx.setMark({
      id: "bahuang_mark", displayChar: "荒", count: Math.min(9, stacks + 2), name: "八荒",
      ownerBattleId: ctx.self.battleId || ctx.self.id,
      description: "帝辛專屬層數；最高9層，各層解鎖效果依魂印描述結算。",
    }, actor);
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

export { DixinDeconstructedProfile } from "../data/elfProfiles/dixinRegistry";
