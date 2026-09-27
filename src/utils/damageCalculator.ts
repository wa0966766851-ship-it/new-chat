import { Elf, Skill } from "../types";
import { calculateEffectiveStat, getTypeMatchup } from "./statCalculator";
import { SUIT_CATALOG } from "../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../data/titles";
import { Mark, getMark } from "../battle/marks";
import { critChanceBonus } from "../effects/traitEffects";
import { prdChance } from "./prd";

export const calculateDamage = (
  actor: Elf,
  target: Elf,
  skill: Skill,
  side: "p1" | "p2",
  p1Suit?: string,
  p2Suit?: string,
  randomValue: number = (217 + Math.random() * (255 - 217)) / 255,
  isCritOverride?: boolean,
  p1Team?: Elf[],
  p2Team?: Elf[],
  options?: { ignoreSpDefPercent?: number, ignoreDefPercent?: number, ignoreOppBuff?: boolean },
  p1Title?: string,
  p2Title?: string,
  p1RegistryState?: any,
  p2RegistryState?: any,
  p1Marks?: Mark[],
  p2Marks?: Mark[]
) => {
  if (skill.category === "屬性" || !skill.power) return { damage: 0, isCrit: false, typeMultiplier: 1.0 };
  
  const isPhys = skill.category === "物理";
  const suit = p1Suit && side === "p1" ? SUIT_CATALOG[p1Suit] : (p2Suit && side === "p2" ? SUIT_CATALOG[p2Suit] : undefined);
  const oppSuit = p1Suit && side === "p2" ? SUIT_CATALOG[p1Suit] : (p2Suit && side === "p1" ? SUIT_CATALOG[p2Suit] : undefined);

  let atk = isPhys ? actor.calculatedStats.atk : actor.calculatedStats.spatk;
  // 積木：計算傷害時令攻擊、特攻等於原本二者總和
  if ((side === "p1" ? p1RegistryState : p2RegistryState)?.blkAtkSpatkSum) atk = (actor.calculatedStats.atk || 0) + (actor.calculatedStats.spatk || 0);
  let def = isPhys ? target.calculatedStats.def : target.calculatedStats.spdef;
  
  if (oppSuit?.id === "nuclear_armor" && target.currentHp < target.maxHp / 3) {
    def *= 2;
  }
  
  let ignorePercent = 0;
  if (!isPhys && options?.ignoreSpDefPercent) {
    ignorePercent = Math.max(ignorePercent, options.ignoreSpDefPercent);
  }
  if (isPhys && options?.ignoreDefPercent) {
    ignorePercent = Math.max(ignorePercent, options.ignoreDefPercent);
  }
  if (options?.ignoreDefPercent) {
    ignorePercent = Math.max(ignorePercent, options.ignoreDefPercent);
  }
  if (suit?.effects?.ignoreDefSpdefPercent) {
    ignorePercent = Math.max(ignorePercent, suit.effects.ignoreDefSpdefPercent);
  }
  if (ignorePercent > 0) {
    def = Math.floor(def * (1 - ignorePercent));
  }

  if (suit?.effects?.ignoreDefSpdefFlat) {
    def = Math.max(0, def - suit.effects.ignoreDefSpdefFlat);
  }
  
  const rawAtkS = isPhys ? (actor.statStages?.atk || 0) : (actor.statStages?.spatk || 0);
  const rawDefS = isPhys ? (target.statStages?.def || 0) : (target.statStages?.spdef || 0);

  const actorMarks = side === "p1" ? p1Marks : p2Marks;
  const oppSide = side === "p1" ? "p2" : "p1";
  const targetMarks = oppSide === "p1" ? p1Marks : p2Marks;

  const actorPoemCount = getMark(actorMarks || [], "poem_chapter")?.count || 0;
  const targetPoemCount = getMark(targetMarks || [], "poem_chapter")?.count || 0;

  let atkS = rawAtkS;
  let defS = rawDefS;

  // 1:將對手能力提升視為同等級能力下降，自身能力下降視為同等級能力提升 (Poem >= 1)
  if (actorPoemCount >= 1) {
    if (atkS < 0) atkS = Math.abs(atkS);
    if (defS > 0) defS = -defS;
  }
  if (targetPoemCount >= 1) {
    if (defS < 0) defS = Math.abs(defS);
    if (atkS > 0) atkS = -atkS;
  }

  // Wuxu Shiyan (無序·蝕言) Off-field logic
  const oppTeam = oppSide === 'p1' ? p1Team : p2Team;
  const wuxuShiyan = oppTeam?.find(e => (e.name === "無序·蝕言" || e.name === "無序.蝕言") && e.currentHp > 0 && e.battleId !== target.battleId);
  
  if (wuxuShiyan && !isPhys) {
    // 修正敵方所有精靈特殊攻擊計算公式改為只能造成等同於特攻值的傷害
    // 然後若自身最終特防值每有1點特防則對手造成上述傷害時減少1%
    const wuxuSpDef = Math.ceil(wuxuShiyan.calculatedStats.spdef / 10);
    const baseDamage = calculateEffectiveStat(atk, atkS);
    const reduction = wuxuSpDef * 0.01;
    const finalDmg = Math.max(0, Math.floor(baseDamage * (1 - reduction)));
    
    return {
      damage: finalDmg,
      isCrit: false,
      typeMultiplier: 1.0
    };
  }
  
  // 積木：能力下降視為同級全屬性提升
  if ((side === "p1" ? p1RegistryState : p2RegistryState)?.blkStageAsBoost) atkS = Math.max(atkS, (side === "p1" ? p1RegistryState : p2RegistryState).blkStageAsBoost);
  const base = ((42 * calculateEffectiveStat(atk, atkS) * skill.power / calculateEffectiveStat(def, defS)) / 50 + 2);
  
  const actorReg = side === "p1" ? p1RegistryState : p2RegistryState;
  let typeMult = getTypeMatchup(skill.type, target.type);
  // 積木：克制倍數取指定屬性中最高者
  if (Array.isArray(actorReg?.blkTypeOverride) && (actorReg.blkTypeOverrideUses || 0) > 0) {
    typeMult = Math.max(...actorReg.blkTypeOverride.map((t: string) => getTypeMatchup(t, target.type)));
  }
  // 本系加成 1.5 倍：技能屬性（含雙屬性技能的任一屬性）為自身系別中含有的屬性
  const splitT = (t?: string) => (t || "").replace(/系$/, "").split(/[.·・]/).filter(Boolean);
  const actorTypes = splitT(actor.type);
  const stab = skill.type && skill.type !== "無屬性" && splitT(skill.type).some(t => actorTypes.includes(t)) ? 1.5 : 1.0;
  const mult = typeMult * stab * randomValue;

  const titleId = side === "p1" ? p1Title : p2Title;
  const title = titleId ? TITLE_CATALOG[titleId] : undefined;
  
  let suitCritBonus = suit?.effects?.critRateBonus || 0;
  if (suit?.effects?.critRateBonusPerStack) {
    const actorRegistryState = side === "p1" ? p1RegistryState : p2RegistryState;
    const stacks = Math.min(
      suit.effects.maxCritRateStacks || Infinity,
      actorRegistryState?.suitCritStacks || 0
    );
    suitCritBonus += stacks * suit.effects.critRateBonusPerStack;
  }

  const critChance = Math.max(0, Math.min(1, ((actor.critValue ?? 1) / 16) + suitCritBonus + ((title?.critBonus || 0) / 100) + critChanceBonus(actor, target)));
  const isCrit = isCritOverride !== undefined ? isCritOverride : prdChance(`crit:${side}:${actor.id}`, critChance);
  
  let suitDmgBonus = suit?.effects?.damageDealtMultiplier || 1.0;
  let titleDmgBonus = title?.effects?.damageDealtMultiplier || 1.0;
  let oppSuitDmgRed = oppSuit?.effects?.damageTakenMultiplier || 1.0;
  
  let inscDmgBonus = 1.0;
  if (actor.inscriptions && actor.inscriptions.some(insc => insc && (insc.id === "liuren_qianghua" || insc.name === "強化"))) {
    inscDmgBonus = 1.2;
  }

  const critResistPercent = target.resistances?.damageResist?.crit || 0;
  // 致命一擊倍率 = 2 ×（1 − 致命抗性）：無抗 2 倍、5% 1.9 倍、滿抗 35% 1.3 倍
  let critBonusMultiplier = 2 * (1 - critResistPercent / 100);
  if (isCrit && suit?.effects?.critDamageMultiplier) {
    critBonusMultiplier *= suit.effects.critDamageMultiplier;
  }
  const final = Math.floor(base * mult * (isCrit ? critBonusMultiplier : 1.0) * suitDmgBonus * titleDmgBonus * oppSuitDmgRed * inscDmgBonus);
  
  let statResetApplied: "def" | "spdef" | null = null;
  if (isCrit) {
    if (isPhys && defS > 0) statResetApplied = "def";
    else if (!isPhys && defS > 0) statResetApplied = "spdef";
  }

  return { 
    damage: Math.max(0, final), 
    isCrit, 
    typeMultiplier: typeMult,
    statResetApplied
  };
};
