import { BattleEventContext, BattleSkillHandler, EffectTiming } from "./types";
import { isStatusActive } from "../utils/statusManager";

/**
 * 蟲后·奧佩婭 (Opeia) A級專屬註冊表 [后]
 */

export const handleOpeiaSoulMark = (context: BattleEventContext, event: EffectTiming, extraData?: any) => {
  const { self, target, actor, setPlayerState, getPlayerState, addLog, applyTrueDamage, applyStatusWithImmunityCheck, activeP1, activeP2 } = context;
  const oppSide = actor === "p1" ? "p2" : "p1";

  const isHighStat = (elf: any) => {
    const stats = elf.baseStats || {};
    const sum = (stats.hp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.spatk || 0) + (stats.spdef || 0) + (stats.speed || 0);
    return sum >= 700;
  };

  // 1. 登場效果 (ON_ENTRANCE) / 檢查蟲類 (BEFORE_ACTION)
  if (event === EffectTiming.ON_ENTRANCE || event === EffectTiming.BEFORE_ACTION) {
    const selfIsInsect = isHighStat(self);
    const targetIsInsect = isHighStat(target);
    
    if (selfIsInsect) setPlayerState("isInsect", true);
    if (targetIsInsect) context.setOpponentState("isInsect", true);
    
    if (event === EffectTiming.ON_ENTRANCE) {
      addLog(`🦋 【后】：萬蟲之母降臨，令場上所有強大精靈 (總和>=700) 視為昆蟲類！`, "effect");
    }
  }

  // 2. 減傷邏輯 (BEFORE_DAMAGE)
  if (event === EffectTiming.BEFORE_DAMAGE) {
    const isInsect = getPlayerState("isInsect");
    if (extraData?.isIncoming && isInsect && extraData.damageCategory !== "true") {
      const reduction = Math.floor(extraData.base * 0.5);
      extraData.decreasePercent += 0.5;
      addLog(`🦋 【昆蟲類】：受到的攻擊傷害減少 50% (${reduction})！`, "effect");
    }
  }

  // 3. 真實傷害 (AFTER_ACTION)
  if (event === EffectTiming.AFTER_ACTION) {
    const isInsect = getPlayerState("isInsect");
    const isAttack = extraData?.skill?.category === "物理" || extraData?.skill?.category === "特殊";
    if (isInsect && isAttack) {
      applyTrueDamage(oppSide, 200, "昆蟲類附加傷害", activeP1, activeP2);
      addLog(`🦋 【昆蟲類】：攻擊附加 200 點真實傷害！`, "damage");
    }
  }

  // 4. 其他邏輯 (可擴展...)
  // 自身使用技能不消耗 PP (常駐)
  if (event === EffectTiming.BEFORE_SKILL && extraData?.actor === actor) {
    // 邏輯在 BattleScreen 處理 PP 扣除前檢查
  }

  return false;
};

export const OPEIA_SKILLS: Record<string, BattleSkillHandler> = {
  "毒噬魂絲": (ctx) => {
    const { target, addLog, applyPinkDamage } = ctx;
    addLog(`🕸️ 使用【毒噬魂絲】：吸取對手最大體力 1/3！`, "damage");
    const drain = Math.floor(target.maxHp / 3);
    applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", drain, "毒噬魂絲", ctx.activeP1, ctx.activeP2, "百分比傷害");
  },
  "蟲群庇護": (ctx) => {
    const { self, addLog } = ctx;
    addLog(`🛡️ 使用【蟲群庇護】：5 回合內免疫並反彈所有異常狀態！`, "status");
    ctx.setPlayerState("immuneStatusTurns", 5);
  },
  "蟲后之冠": (ctx) => {
    const { addLog } = ctx;
    addLog(`👑 使用【蟲后之冠】：全屬性提升！`, "effect");
  },
  "王.噬心毒蝕": (ctx) => {
    const { target, addLog, applyPinkDamage } = ctx;
    addLog(`💔 使用【王.噬心毒蝕】：附加對手已損失體力 50% 的傷害！`, "damage");
    const bonus = Math.floor((target.maxHp - target.currentHp) * 0.5);
    applyPinkDamage(ctx.actor === "p1" ? "p2" : "p1", bonus, "噬心毒蝕", ctx.activeP1, ctx.activeP2, "百分比傷害");
  },
  "王·鏽腑喰心": (ctx) => {
    const { addLog } = ctx;
    addLog(`⚔️ 使用【王·鏽腑喰心】：忽視對手 25% 特防！`, "effect");
  }
};

export { OpeiaDeconstructedProfile } from "../data/elfProfiles/opeiaRegistry";
