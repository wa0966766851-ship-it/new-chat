import { BattleEventContext, EffectTiming } from "./types";
import { prdChance } from "../utils/prd";

/**
 * 星際探索（星蝕回廊）遺物與敵方詞綴的戰鬥效果。
 * 與套裝同一條派發通道：triggerSuitEffect（登場／回合開始／結束／戰鬥階段結束／傷害前）、傷害鉤子、異常附加前。
 * 遺物 id 可帶參數：「eclipse_crown:40」。面板類加成在開戰前套用，這裡只處理戰鬥中的效果。
 */
type RelicHandler = (ctx: BattleEventContext, event: EffectTiming, extraData: any, param: number) => void;

const isSkillAttack = (comp: any) => !comp?.damageCategory || comp.damageCategory === "skill_attack";
const outgoingAttack = (event: EffectTiming, extra: any) => event === EffectTiming.BEFORE_DAMAGE && extra?.damageComp && !extra.damageComp.isIncoming && isSkillAttack(extra.damageComp) ? extra.damageComp : null;
const incomingAttack = (event: EffectTiming, extra: any) => event === EffectTiming.BEFORE_DAMAGE && extra?.damageComp?.isIncoming && isSkillAttack(extra.damageComp) ? extra.damageComp : null;
const incomingAny = (event: EffectTiming, extra: any) => event === EffectTiming.BEFORE_DAMAGE && extra?.damageComp?.isIncoming ? extra.damageComp : null;
const alive = (ctx: BattleEventContext) => (ctx.self?.currentHp ?? 0) > 0;
const pctHp = (ctx: BattleEventContext, p: number) => Math.max(1, Math.floor((ctx.self?.maxHp || 0) * p));
const hasAbnormal = (elf: any) => !!elf && ((elf.battleStatus && elf.battleStatus !== "normal") || Object.values(elf.battleStatuses || {}).some((v: any) => Number(v) > 0));
const healEnd = (p: number, label: string): RelicHandler => (ctx, event) => {
  if (event === EffectTiming.ROUND_END && alive(ctx) && ctx.self.currentHp < ctx.self.maxHp) { ctx.applyHeal(ctx.actor, pctHp(ctx, p)); ctx.addLog(`🕯️ 【${label}】：恢復 ${Math.round(p * 100)}% 最大體力。`, "heal"); }
};
const loseEnd = (p: number, label: string): RelicHandler => (ctx, event) => {
  if (event === EffectTiming.ROUND_END && alive(ctx)) { ctx.adjustHp(ctx.actor, -pctHp(ctx, p)); ctx.addLog(`🩸 【${label}】：失去 ${Math.round(p * 100)}% 最大體力。`, "effect"); }
};
const dmgOut = (p: number): RelicHandler => (_c, event, extra) => { const comp = outgoingAttack(event, extra); if (comp) comp.increasePercent += p; };
const dmgIn = (p: number): RelicHandler => (_c, event, extra) => { const comp = incomingAttack(event, extra); if (comp) comp.decreasePercent += p; };
const onKillHeal = (p: number, label: string): RelicHandler => (ctx, event, extra) => {
  if (event === EffectTiming.BATTLE_PHASE_END && extra?.killedOpponent && alive(ctx)) { ctx.applyHeal(ctx.actor, pctHp(ctx, p)); ctx.addLog(`🪽 【${label}】：擊敗對手，恢復 ${Math.round(p * 100)}% 最大體力！`, "heal"); }
};
const roundStartStatus = (chance: number, status: string, label: string): RelicHandler => (ctx, event) => {
  if (event === EffectTiming.ROUND_START && alive(ctx) && prdChance(`${ctx.actor}:relic:${label}`, chance)) {
    if (ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, 1)?.success) ctx.addLog(`🕸️ 【${label}】：令對手${status} 1 回合！`, "status");
  }
};

export const RelicEffectRegistry: Record<string, RelicHandler> = {
  // ── 既有藏品 ──
  dmg_reduction_bead: (_c, event, extra) => { const comp = incomingAny(event, extra); if (comp && comp.damageCategory !== "true") comp.decreasePercent += 0.1; },
  justin_arm: dmgOut(0.15),
  silver_wing: dmgOut(0.2),
  six_wing: onKillHeal(0.2, "六翼獵手"),
  ray_wing: (_c, event, extra) => { if (event === EffectTiming.BEFORE_STATUS_APPLY && extra?.status === "麻痺") extra.prevented = true; },
  // ── 普通 ──
  rusted_gear: dmgOut(0.08),
  ash_charm: dmgIn(0.08),
  moth_wing: healEnd(0.04, "燈蛾翅膜"),
  bone_flute: (ctx, event) => {
    if (event === EffectTiming.ON_ENTRANCE && alive(ctx)) { ctx.applyStatChange(ctx.targetSide, { atk: -1, spatk: -1 }); ctx.addLog("🦴 【骨笛】：笛聲令對手攻擊、特攻 −1。", "effect"); }
  },
  dry_chalice: onKillHeal(0.1, "乾涸聖杯"),
  // ── 稀有 ──
  third_eye: (ctx, event, extra) => { const comp = outgoingAttack(event, extra); if (comp && hasAbnormal(ctx.target)) comp.increasePercent += 0.3; },
  web_spindle: roundStartStatus(0.2, "疲憊", "蛛網紡錘"),
  blood_watch: (ctx, event, extra) => { const comp = outgoingAttack(event, extra); if (comp && ctx.self.currentHp < ctx.self.maxHp / 2) comp.increasePercent += 0.35; },
  silver_stitch: (_c, event, extra) => { const comp = incomingAny(event, extra); if (comp && (comp.damageCategory === "fixed" || comp.damageCategory === "percent")) comp.decreasePercent += 0.5; },
  tear_vial: (ctx, event) => {
    if (event === EffectTiming.ROUND_END && alive(ctx) && ctx.self.currentHp < ctx.self.maxHp / 3) { ctx.applyHeal(ctx.actor, pctHp(ctx, 0.15)); ctx.addLog("💧 【淚滴瓶】：恢復 15% 最大體力。", "heal"); }
  },
  // ── 傳說 ──
  eclipse_crown: (_c, event, extra, param) => { const comp = outgoingAttack(event, extra); if (comp && param > 0) comp.increasePercent += param / 200; },
  thousand_eyes: (ctx, event, extra) => {
    const comp = outgoingAttack(event, extra); if (!comp) return;
    const boosts = Object.values(ctx.target?.statStages || {}).reduce((s: number, v: any) => s + Math.max(0, Number(v) || 0), 0);
    comp.increasePercent += 0.2 + 0.05 * boosts;
  },
  faceless_mask: (ctx, event, extra) => {
    const comp = incomingAny(event, extra); if (comp && comp.damageCategory !== "true") comp.decreasePercent += 0.3;
    loseEnd(0.03, "無面者面具")(ctx, event, extra, 0);
  },
  // ── 詛咒 ──
  curse_bone: loseEnd(0.03, "蝕骨詛咒"),
  curse_dud: dmgOut(-0.1),
  // ── 王座 ──
  black_sun: dmgOut(0.3),
  abyss_cradle: healEnd(0.08, "深淵搖籃"),
  pale_contract: dmgIn(0.2),

  // ── 敵方詞綴 ──
  affix_frenzy: dmgOut(0.25),
  affix_armored: dmgIn(0.25),
  affix_regen: healEnd(0.08, "再生"),
  affix_hex: roundStartStatus(0.25, "害怕", "咒怨"),
  affix_sapping: (ctx, event) => {
    if (event === EffectTiming.ROUND_END && alive(ctx) && (ctx.target?.currentHp ?? 0) > 0) {
      const n = Math.max(1, Math.floor((ctx.target.maxHp || 0) * 0.05));
      ctx.applyFixedDamage(ctx.targetSide, n, "汲魂");
    }
  },
};

/** 拆出「id:參數」。 */
function parse(entry: string): [string, number] {
  const i = entry.indexOf(":");
  return i < 0 ? [entry, 0] : [entry.slice(0, i), Number(entry.slice(i + 1)) || 0];
}

export function runRelicEffects(relics: readonly string[] | undefined, ctx: BattleEventContext, event: EffectTiming, extraData?: any) {
  if (!relics?.length) return;
  for (const entry of relics) {
    const [id, param] = parse(entry);
    RelicEffectRegistry[id]?.(ctx, event, extraData, param);
  }
}

export const hasRelic = (relics: readonly string[] | undefined, id: string) => !!relics?.some(r => parse(r)[0] === id);
