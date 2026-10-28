import { addDamageReduction } from '../battle/damageReduction';
import { BattleEventContext, EffectTiming } from "./types";
import { prdChance } from "../utils/prd";
import { isStatusActive } from "../utils/statusManager";

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
const dmgIn = (p: number): RelicHandler => (_c, event, extra) => { const comp = incomingAttack(event, extra); if (comp) addDamageReduction(comp, p); };
const onKillHeal = (p: number, label: string): RelicHandler => (ctx, event, extra) => {
  if (event === EffectTiming.BATTLE_PHASE_END && extra?.killedOpponent && alive(ctx)) { ctx.applyHeal(ctx.actor, pctHp(ctx, p)); ctx.addLog(`🪽 【${label}】：擊敗對手，恢復 ${Math.round(p * 100)}% 最大體力！`, "heal"); }
};
const roundStartStatus = (chance: number, status: string, label: string, turns = 1): RelicHandler => (ctx, event) => {
  if (event === EffectTiming.ROUND_START && alive(ctx) && prdChance(`${ctx.actor}:relic:${label}`, chance)) {
    if (ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, turns)?.success) ctx.addLog(`🕸️ 【${label}】：令對手${status} ${turns} 回合！`, "status");
  }
};

export const RelicEffectRegistry: Record<string, RelicHandler> = {
  // ── 既有藏品 ──
  dmg_reduction_bead: (_c, event, extra) => { const comp = incomingAny(event, extra); if (comp && comp.damageCategory !== "true") addDamageReduction(comp, 0.2); },
  justin_arm: dmgOut(0.3),
  silver_wing: dmgOut(0.4),
  six_wing: onKillHeal(0.4, "六翼獵手"),
  ray_wing: (_c, event, extra) => { if (event === EffectTiming.BEFORE_STATUS_APPLY && extra?.status === "麻痺") extra.prevented = true; },
  // ── 普通 ──
  rusted_gear: dmgOut(0.16),
  ash_charm: dmgIn(0.16),
  moth_wing: healEnd(0.08, "燈蛾翅膜"),
  bone_flute: (ctx, event) => {
    if (event === EffectTiming.ON_ENTRANCE && alive(ctx)) { ctx.applyStatChange(ctx.targetSide, { atk: -2, spatk: -2 }); ctx.addLog("🦴 【骨笛】：笛聲令對手攻擊、特攻 −2。", "effect"); }
  },
  dry_chalice: onKillHeal(0.2, "乾涸聖杯"),
  // ── 稀有 ──
  third_eye: (ctx, event, extra) => { const comp = outgoingAttack(event, extra); if (comp && hasAbnormal(ctx.target)) comp.increasePercent += 0.6; },
  web_spindle: roundStartStatus(0.4, "疲憊", "蛛網紡錘", 2),
  blood_watch: (ctx, event, extra) => { const comp = outgoingAttack(event, extra); if (comp && ctx.self.currentHp < ctx.self.maxHp / 2) comp.increasePercent += 0.7; },
  silver_stitch: (_c, event, extra) => { const comp = incomingAny(event, extra); if (comp && (comp.damageCategory === "fixed" || comp.damageCategory === "percent")) addDamageReduction(comp, 0.75); },
  tear_vial: (ctx, event) => {
    if (event === EffectTiming.ROUND_END && alive(ctx) && ctx.self.currentHp < ctx.self.maxHp / 3) { ctx.applyHeal(ctx.actor, pctHp(ctx, 0.3)); ctx.addLog("💧 【淚滴瓶】：恢復 30% 最大體力。", "heal"); }
  },
  // ── 傳說 ──
  eclipse_crown: (_c, event, extra, param) => { const comp = outgoingAttack(event, extra); if (comp && param > 0) comp.increasePercent += param / 100; },
  thousand_eyes: (ctx, event, extra) => {
    const comp = outgoingAttack(event, extra); if (!comp) return;
    const boosts = Object.values(ctx.target?.statStages || {}).reduce((s: number, v: any) => s + Math.max(0, Number(v) || 0), 0);
    comp.increasePercent += 0.4 + 0.1 * boosts;
  },
  faceless_mask: (ctx, event, extra) => {
    const comp = incomingAny(event, extra); if (comp && comp.damageCategory !== "true") addDamageReduction(comp, 0.6);
    loseEnd(0.06, "無面者面具")(ctx, event, extra, 0);
  },
  // ── 詛咒 ──
  curse_bone: loseEnd(0.06, "蝕骨詛咒"),
  curse_dud: dmgOut(-0.2),
  // ── 王座 ──
  black_sun: dmgOut(0.6),
  abyss_cradle: healEnd(0.16, "深淵搖籃"),
  pale_contract: dmgIn(0.4),

  // ── 章末首領：神話異常（既有 BOSS_ONLY 狀態：免疫能力下降與異常、PP 無限、所有技能必中；無回合數、下場保留） ──
  // 任一方首次出手時激活：首領自己出手走 BEFORE_ACTION，對手出手走 OPPONENT_ACTION（由引擎在出手流程開始時派發給非行動方）。
  boss_myth: (ctx, event) => {
    if ((event !== EffectTiming.BEFORE_ACTION && event !== EffectTiming.OPPONENT_ACTION) || !alive(ctx) || isStatusActive(ctx.self, "神話")) return;
    if (ctx.applyStatusWithImmunityCheck(ctx.actor, "神話", 999)?.success) ctx.addLog(`🌟 【${ctx.self?.name ?? "首領"}】的神話被喚醒：免疫能力下降與異常狀態、PP 無限、所有技能必中！`, "effect");
  },

  // ── 敵方詞綴 ──
  affix_frenzy: dmgOut(0.25),
  affix_armored: dmgIn(0.25),
  affix_regen: healEnd(0.08, "再生"),
  affix_hex: roundStartStatus(0.25, "害怕", "咒怨"),
  affix_sapping: (ctx, event) => {
    if (event === EffectTiming.ROUND_END && alive(ctx) && (ctx.target?.currentHp ?? 0) > 0) {
      const n = Math.max(1, Math.floor((ctx.target.maxHp || 0) * 0.05));
      ctx.applyFixedDamage(ctx.targetSide, n, "汲魂", { unscaled: true });
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

/** 星蝕回廊固定值倍率（"fixed_mul:3.16" 由回廊在開戰時寫入雙方遺物清單；沒有則為 1）。 */
export function fixedValueMul(relics: readonly string[] | undefined): number {
  for (const entry of relics || []) { const [id, v] = parse(entry); if (id === "fixed_mul" && v > 0) return v; }
  return 1;
}
export const hasRelic = (relics: readonly string[] | undefined, id: string) => !!relics?.some(r => parse(r)[0] === id);

/** 藏品對攻擊公式的靜態修正：物理攻擊額外無視對手防禦的比例（原寫在戰鬥引擎，2026-10-10 搬入）。 */
const RELIC_IGNORE_DEF: Record<string, { category: '物理' | '特殊'; percent: number }> = {
  dean_blade: { category: '物理', percent: 0.10 }, // 星際藏品【迪恩之刃】：物理攻擊無視防禦 10%（2026-10-24 翻倍）
};
export function relicIgnoreDefPercent(relics: readonly string[] | undefined, skillCategory: string): number {
  let total = 0;
  for (const entry of relics || []) {
    const def = RELIC_IGNORE_DEF[parse(entry)[0]];
    if (def && def.category === skillCategory) total += def.percent;
  }
  return total;
}
