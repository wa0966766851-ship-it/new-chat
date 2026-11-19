import { activeAlienTrait } from '../data/elfGroups';
import { resolveGeneralTrait } from '../data/generalTraitKits';
import { battleTypeParts } from '../utils/typeQuery';
import {instantKillChance} from '../battle/instantKillChance';
import {recipientPrdChance} from '../battle/recipientEffectChance';
import { addDamageReduction, multiplyDamageReduction } from '../battle/damageReduction';
/**
 * 通用特性（generalTrait）與異能（alienTrait）的戰鬥效果
 *
 * 過去這兩類特性只能在編輯器裡選擇、在介面上顯示，戰鬥引擎完全沒有讀取（除了「亂舞」「瞬殺」少數被個別魂印引用）。
 * 這裡依 src/data/generalTraits.ts、src/data/alienTraits.ts 的描述逐條實作，資料驅動、不依精靈名稱判斷。
 *
 * 精準／迴避：由命中判定處理（genericSkillText.computeHitChance）。
 */
import { Elf, Skill } from "../types";
import { effectSourceViews } from '../battle/effectSources';
import type { BattleEventContext, DamageComputation } from './types';
import { prdChance } from "../utils/prd";
import { bypassesAttackDefense } from '../battle/attackDefense';

type Rng = () => number;
type Log = (text: string) => void;

export function traitNames(elf: Elf | undefined | null): string[] {
  if (!elf) return [];
  const names: string[] = [];
  const append = (source: Elf) => {
    for (const trait of [resolveGeneralTrait(source.trait), resolveGeneralTrait(source.alienTraits?.generalTrait), activeAlienTrait(source)]) {
      if (trait?.name && trait.effectMode !== 'kit' && trait.effectMode !== 'description' && !names.includes(trait.name)) names.push(trait.name);
    }
  };
  if (elf.illusion) effectSourceViews(elf).forEach(append);
  else if (elf.trait || elf.alienTraits) append(elf);
  return names;
}
const has = (elf: Elf | undefined | null, name: string) => traitNames(elf).includes(name);

// 屬性強化特性：技能屬性含該系別時威力 +14%
const TYPE_BOOST: Record<string, string> = {
  葉綠: "草", 流水: "水", 炎火: "火", 飛空: "飛行", 蓄電: "電", 機能: "機械", 碎裂: "地面", 平衡: "普通",
  冰霜: "冰", 魔幻: "超能", 戰意: "戰鬥", 光環: "光", 黑夜: "暗影", 奇異: "神秘", 威嚴: "龍", 聖靈: "聖靈",
};
/** 屬性通用特性增幅技能威力，與技能傷害的增減乘區分開。 */
export function traitPowerMultiplier(elf: Elf, skill: Skill): number {
  let multiplier = 1;
  let types: string[] | undefined;
  for (const name of traitNames(elf)) {
    const type = TYPE_BOOST[name];
    if (type && (types ??= battleTypeParts(skill.type)).includes(type)) multiplier += .14;
  }
  return multiplier;
}

// 對手處於某異常時 5% 威力翻倍
const STATUS_DOUBLE: Record<string, string> = {
  灼熱: "燒傷", 霜襲: "凍傷", 毒攻: "中毒", 殘忍: "麻痺", 恐懼: "害怕", 困頓: "睡眠", 操控: "疲憊", 落石: "石化",
};
// 致命一擊時 5% 附加異常
const CRIT_STATUS: Record<string, string> = {
  灼燒: "燒傷", 霜凍: "凍傷", 毒傷: "中毒", 麻痺: "麻痺", 膽怯: "害怕", 睡意: "睡眠", 疲憊: "疲憊", 石化: "石化",
};
// 受到物理攻擊（普通攻擊）時 8% 令對手異常
const ON_PHYS_HIT_STATUS: Record<string, string> = {
  帶電: "麻痺", 中毒: "中毒", 高熱: "燒傷", 冰冷: "凍傷", 陰森: "害怕", 睡眠: "睡眠",
};
// 受到特殊攻擊時 14% 降低對手能力
const ON_SPEC_HIT_DEBUFF: Record<string, string> = { 反抗: "atk", 反駁: "def", 忽略: "spatk", 草率: "spdef", 慌張: "speed" };
// 受到任何攻擊時 14% 提升自身能力
const ON_ANY_HIT_BUFF: Record<string, string> = { 反擊: "atk", 抵抗: "def", 反攻: "spatk", 堅韌: "spdef", 借風: "speed" };
// 自身攻擊 8% 附加異常
const ON_ATTACK_STATUS: Record<string, { status: string; cat: "物理" | "特殊" }> = {
  火熱: { status: "燒傷", cat: "特殊" }, 極寒: { status: "凍傷", cat: "特殊" },
  顫慄: { status: "害怕", cat: "物理" }, 靜電: { status: "麻痺", cat: "物理" },
};

const hasStatus = (ctx: BattleEventContext, elf: Elf, status: string) => {
  const st = ctx.getStatuses ? ctx.getStatuses(elf) : {};
  return ((st as any)?.[status] || 0) > 0;
};

export function rollStatusTraitPower(ctx: BattleEventContext, skill: Skill): number {
  if (skill.category === '屬性') return 1;
  const { self, target } = ctx;
  let multiplier = 1;
  for (const name of traitNames(self)) {
    const status = STATUS_DOUBLE[name];
    if (!status || !hasStatus(ctx, target, status) || !prdChance(`${self.id}>${target.id}:trait:L88`, .05)) continue;
    multiplier *= 2;
    ctx.addLog(`🔥 【${name}】：對手處於${status}，威力翻倍！`, 'effect');
  }
  return multiplier;
}

/** 致命一擊率修正（加在 damageCalculator 的 critChance 上） */
export function critChanceBonus(actor: Elf, target: Elf): number {
  let b = 0;
  if (has(actor, "會心")) b += 0.2;
  if (has(target, "免爆")) b -= 0.2;
  return b;
}

/** 偷襲：3% 本次攻擊先制 +1 */
export function priorityBonus(elf: Elf, skill: Skill | null, rng: Rng): number {
  if (!skill || skill.category === "屬性") return 0;
  return has(elf, "偷襲") && prdChance(`${elf?.id}:trait:L65`, 0.03) ? 1 : 0;
}

/** 技能傷害計算階段（攻守雙方特性） */
export function modifySkillDamage(
  actor: Elf, target: Elf, skill: Skill | undefined, comp: DamageComputation, log: Log,
) {
  if (comp.pure) return;
  const isPhys = skill?.category === '物理';
  const isSpec = skill?.category === '特殊';
  const isAttack = isPhys || isSpec;
  // ── 攻方
  for (const n of traitNames(actor)) {
    if (n === "強襲" && isPhys) comp.increasePercent += 0.08;
    if (n === "精神" && isSpec) comp.increasePercent += 0.08;
    if (n === "強化") comp.increasePercent += 0.2;
    if ((n === "強攻" && isPhys) || (n === "強念" && isSpec)) {
      if (prdChance(`${actor?.id}>${target?.id}:trait:L84`, 0.14)) { comp.bonusAfterReduction = (comp.bonusAfterReduction || 0) + 80; log(`💪 【${n}】：技能傷害額外 +80！`); }
    }
    if (isAttack && n === "重傷" && prdChance(`${actor?.id}>${target?.id}:trait:L86`, 0.3)) { comp.multiplier *= 2; log(`💥 【重傷】：本次攻擊傷害翻倍！`); }

  }
  // ── 守方
  for (const n of traitNames(target)) {
    if (n === "堅硬") addDamageReduction(comp, 0.14);
    if (isAttack && n === "吸收" && prdChance(`${actor?.id}>${target?.id}:trait:L93`, 0.14)) { comp.flatReduction = (comp.flatReduction || 0) + 60 * (comp.reductionPolicy?.attenuation ?? 1); log(`🛡️ 【吸收】：受到的技能傷害降低 60 點！`); }
    if (n === "守護" && prdChance(`${actor?.id}>${target?.id}:trait:L94`, 0.03)) { multiplyDamageReduction(comp, 0.5); log(`🛡️ 【守護】：受到的技能傷害減半！`); }
    if (isAttack && (n === '虛無' || n === '抵擋') && !bypassesAttackDefense(comp, 'block') && ((n === "虛無" && prdChance(`${actor?.id}>${target?.id}:trait:L95`, 0.08)) || (n === "抵擋" && prdChance(`${actor?.id}>${target?.id}:trait:L95`, 0.03)))) { comp.multiplier = 0; log(`🛡️ 【${n}】：完全抵擋了本次攻擊！`); }
  }
}

/** 技能攻擊命中並造成傷害後（攻方 ctx 與守方 ctx） */
export function afterSkillHit(
  actor: Elf, target: Elf, skill: Skill, damage: number, isCrit: boolean,
  actorCtx: BattleEventContext, targetCtx: BattleEventContext, rng: Rng
) {
  if (damage <= 0) return;
  const aSide = actorCtx.actor, tSide = targetCtx.actor;
  const isPhys = skill.category === "物理";
  const isSpec = skill.category === "特殊";
  // ── 攻方
  for (const n of traitNames(actor)) {
    const oa = ON_ATTACK_STATUS[n];
    if (oa && skill.category === oa.cat && recipientPrdChance(actorCtx,tSide,`${actor?.id}>${target?.id}:trait:L111`, 0.08)) {
      if (actorCtx.applyStatusWithImmunityCheck(tSide, oa.status, 2).success) actorCtx.addLog(`✨ 【${n}】：令對手陷入【${oa.status}】！`, "status");
    }
    const cs = CRIT_STATUS[n];
    if (cs && isCrit && recipientPrdChance(actorCtx,tSide,`${actor?.id}>${target?.id}:trait:L115`, 0.05)) {
      if (actorCtx.applyStatusWithImmunityCheck(tSide, cs, 2).success) actorCtx.addLog(`✨ 【${n}】：致命一擊令對手陷入【${cs}】！`, "status");
    }
    if (n === "吸血") {
      const heal = Math.floor(damage * 0.11);
      if (heal > 0) { actorCtx.applyHeal(aSide, heal); actorCtx.addLog(`🩸 【吸血】：恢復了 ${heal} 點體力！`, "heal"); }
    }
    if (n === "絕命" && recipientPrdChance(actorCtx,tSide,`${actor?.id}>${target?.id}:trait:L122`, 0.01)) { actorCtx.applyFixedDamage(tSide, 500, "絕命"); actorCtx.addLog(`☠️ 【絕命】：附加 500 點固定傷害！`, "effect"); }
    if (n === "切割" && recipientPrdChance(actorCtx,tSide,`${actor?.id}>${target?.id}:trait:L123`, 0.03)) {
      actorCtx.addTimerTo(tSide, {
        id: 'trait:切割', name: '切割', kind: 'round_counter', source: 'trait', remaining: 3, tickAt: 'round_end',
        scope: 'elf', stackRule: 'refresh',
        description: '每回合結束時受到 50 點真實傷害。',
        payload: { block: { src: '切割', sourceKind: 'trait', trig: 'round_end',
          body: [{ acts: [{ op: 'dmg', label: '切割', p: { side: 'self', flat: 50, type: '真實' } }] }] } },
      }, false);
      actorCtx.addLog('🔪 【切割】：3 回合內對手每回合受到 50 點真實傷害！', 'effect');
    }

    if (n === "瞬殺" && skill.category !== "屬性" && instantKillChance(actorCtx,'trait:instant_kill',7)) {
      actorCtx.applyInstantKill?.(tSide,'瞬殺');
    }
  }
  // ── 守方
  for (const n of traitNames(target)) {
    const ps = ON_PHYS_HIT_STATUS[n];
    if (ps && isPhys && recipientPrdChance(targetCtx,aSide,`${actor?.id}>${target?.id}:trait:L152`, 0.08)) {
      if (targetCtx.applyStatusWithImmunityCheck(aSide, ps, 2).success) targetCtx.addLog(`✨ 【${n}】：受擊令對手陷入【${ps}】！`, "status");
    }
    const deb = ON_SPEC_HIT_DEBUFF[n];
    if (deb && isSpec && recipientPrdChance(targetCtx,aSide,`${actor?.id}>${target?.id}:trait:L156`, 0.14)) targetCtx.applyStatChange(aSide, { [deb]: -1 });
    const buf = ON_ANY_HIT_BUFF[n];
    if (buf && prdChance(`${actor?.id}>${target?.id}:trait:L158`, 0.14)) targetCtx.applyStatChange(tSide, { [buf]: 1 });
    if (n === "反彈" && recipientPrdChance(targetCtx,aSide,`${actor?.id}>${target?.id}:trait:L159`, 0.45)) { targetCtx.applyFixedDamage(aSide, 110, "反彈"); targetCtx.addLog(`🔁 【反彈】：反彈 110 點固定傷害！`, "effect"); }
  }
}

/** 穿越 1/8 體力門檻時擲一次；歸零交由原有免死入口。 */
export function recoverAtCriticalHp(ctx: BattleEventContext, before: number, after: number) {
  const { self, actor } = ctx;
  if (after <= 0 || after > self.maxHp / 8 || before <= self.maxHp / 8 || !has(self, '回神')) return;
  if (!prdChance(`${actor}:${self.id}:trait:L166`, .08)) return;
  if (ctx.applyHealToElf) ctx.applyHealToElf(actor, self.battleId || self.id, self.maxHp - after);
  else ctx.applyHeal(actor, self.maxHp - after);
}

/** 致死判定：頑強（8% 保留 2 體力）、回神（8% 體力回滿） */
export function traitFatalResist(ctx: BattleEventContext, side: "p1" | "p2", elf: Elf, rng: Rng): boolean {
  const names = traitNames(elf);
  if (names.includes("回神") && prdChance(`${side}:${elf?.id}:trait:L166`, 0.08)) {
    ctx.updateElf(side, { currentHp: elf.maxHp });
    ctx.addLog(`✨ 【回神】：瀕死之際體力回滿！`, "heal");
    return true;
  }
  if (names.includes("頑強") && prdChance(`${side}:${elf?.id}:trait:L171`, 0.08)) {
    ctx.updateElf(side, { currentHp: 2 });
    ctx.addLog(`💪 【頑強】：承受致死攻擊，餘下 2 點體力！`, "effect");
    return true;
  }
  return false;
}
