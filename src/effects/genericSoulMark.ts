/**
 * 自訂／AI 生成精靈的魂印（soulMark.effectType + effectValue）
 * 這些精靈沒有手寫的魂印 handler，過去魂印只是顯示文字、戰鬥中完全沒有作用。
 */
import { BattleEventContext, EffectTiming } from "./types";
import { prdPercent } from "../utils/prd";

export function runGenericSoulMark(ctx: BattleEventContext, event: EffectTiming, extraData: any, elf: any): any {
  const sm = elf?.soulMark;
  const type = String(sm?.effectType || "none");
  const value = Number(sm?.effectValue || 0);
  if (type === "none") return undefined;
  const side = ctx.actor;
  const active = side === "p1" ? ctx.activeP1 : ctx.activeP2;
  const isActive = !!active && active.id === elf.id;
  const label = `【${sm?.name || "魂印"}】`;

  switch (type) {
    case "paralyze_chance":
    case "burn_chance": {
      if (event !== EffectTiming.AFTER_ACTION || !isActive) return;
      if (!ctx.skill || ctx.skill.category === "屬性") return;
      if (!prdPercent(`${side}:${elf.id}:soulmark:${type}`, value)) return;
      const status = type === "paralyze_chance" ? "麻痺" : "燒傷";
      if (ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, 2).success) ctx.addLog(`✨ ${label}：令對手陷入【${status}】！`, "status");
      return;
    }
    case "heal_on_turn_end": {
      if (event !== EffectTiming.ROUND_END || !isActive || elf.currentHp <= 0) return;
      const amt = Math.floor((elf.maxHp * value) / 100);
      if (amt > 0) { ctx.applyHeal(side, amt); ctx.addLog(`💚 ${label}：回合結束恢復 ${amt} 點體力！`, "heal"); }
      return;
    }
    case "damage_boost": {
      if (event !== EffectTiming.BEFORE_DAMAGE || !isActive) return;
      const comp = extraData?.damageComp;
      if (comp && comp.isIncoming === false) comp.increasePercent = (comp.increasePercent || 0) + value / 100;
      return;
    }
    case "shield": {
      if (event !== EffectTiming.ON_ENTRANCE || !isActive) return;
      if (value > 0) { ctx.applyShield(side, value); ctx.addLog(`🛡️ ${label}：獲得 ${value} 點護盾！`, "effect"); }
      return;
    }
    case "status_immune": {
      if (event !== EffectTiming.BEFORE_STATUS_APPLY || !isActive || !extraData) return;
      extraData.prevented = true;
      ctx.addLog(`🛡️ ${label}：免疫了【${extraData.status}】！`, "effect");
      return;
    }
    case "speed_boost": {
      if (event !== EffectTiming.ON_ENTRANCE || !isActive) return;
      const stages = value > 0 && value <= 6 ? value : 1;
      ctx.applyStatChange(side, { speed: stages });
      return;
    }
  }
  return undefined;
}
