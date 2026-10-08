import { specialDamageFormula } from '../effects/specialDamageFormulaRegistry';
import { skillTypeMultiplier } from '../battle/skillTypeOverride';
import { Elf, Skill } from "../types";
import { calculateEffectiveStat, getTypeMatchup } from "./statCalculator";
import { SUIT_CATALOG } from "../data/suitsAndEyewears";
import { TITLE_CATALOG } from "../data/titles";
import { Mark, getMark } from "../battle/marks";
import { critChanceBonus } from "../effects/traitEffects";
import { prdChance } from "./prd";
import { skillStageView } from '../battle/skillStageView';
import { isStoneThrower, isSkillStone } from '../data/skillStones';
import { getElfAdvancedMechanics } from '../data/traitsRegistry';

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
  options?: { ignoreSpDefPercent?: number, ignoreDefPercent?: number, ignoreOppBuff?: boolean, hitCount?: number, critChanceBonus?: number },
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
  if ((side === "p1" ? p1RegistryState : p2RegistryState)?.blkAtkSpatkSum ||
    (side === 'p1' ? p1RegistryState : p2RegistryState)?.blkAtkSpAtkSum) atk = (actor.calculatedStats.atk || 0) + (actor.calculatedStats.spatk || 0);
  let def = isPhys ? target.calculatedStats.def : target.calculatedStats.spdef;
  // 臨時能力值（效果層設定於登錄狀態）：calcAtkDefMult＝自身雙攻／雙防在雙方計算傷害時的倍率；
  // opponentAtkPanelRatio＝對手攻擊時其最終攻擊／特攻變為面板原始值的比例（忽略能力等級）。
  const statRegA = side === "p1" ? p1RegistryState : p2RegistryState;
  const statRegT = side === "p1" ? p2RegistryState : p1RegistryState;
  const atkPanelRatio = Number(statRegT?.opponentAtkPanelRatio) > 0 ? Number(statRegT.opponentAtkPanelRatio) : 0;
  if (Number(statRegA?.calcAtkDefMult) > 0) atk = atk * Number(statRegA.calcAtkDefMult);
  if (Number(statRegT?.calcAtkDefMult) > 0) def = def * Number(statRegT.calcAtkDefMult);
  if (atkPanelRatio) atk = (isPhys ? actor.calculatedStats.atk : actor.calculatedStats.spatk) * atkPanelRatio;
  
  if (oppSuit?.id === "nuclear_armor" && target.currentHp < target.maxHp / 3) {
    def *= 2;
  }
  
  let ignorePercent = 0;
  ignorePercent = Math.max(ignorePercent, getElfAdvancedMechanics(actor).ignoreDefPercent || 0);
  if (!isPhys && options?.ignoreSpDefPercent) {
    ignorePercent = Math.max(ignorePercent, options.ignoreSpDefPercent);
  }
  if (!isPhys && statRegA?.ignoreSpDefPercentUntilSwitch) {
    ignorePercent = Math.max(ignorePercent, Math.min(1, statRegA.ignoreSpDefPercentUntilSwitch));
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
    def = Math.max(1, Math.floor(def * (1 - ignorePercent)));
  }

  if (suit?.effects?.ignoreDefSpdefFlat) {
    def = Math.max(0, def - suit.effects.ignoreDefSpdefFlat);
  }
  
  const rawAtkS = skillStageView(actor, skill, isPhys ? 'atk' : 'spatk');
  const rawDefS = skillStageView({ statStages: target.statStages, isInherentInvalid: actor.isInherentInvalid }, skill, isPhys ? 'def' : 'spdef', true);

  const actorMarks = side === "p1" ? p1Marks : p2Marks;
  const oppSide = side === "p1" ? "p2" : "p1";
  const targetMarks = oppSide === "p1" ? p1Marks : p2Marks;

  const actorPoemCount = getMark(actorMarks || [], "poem_chapter")?.count || 0;
  const targetPoemCount = getMark(targetMarks || [], "poem_chapter")?.count || 0;

  let atkS = rawAtkS;
  let defS = rawDefS;
  if (actor.treatOpponentBoostAsDoubleDrop && defS > 0) defS = -2 * defS;
  if (target.treatOpponentBoostAsDoubleDrop && atkS > 0) atkS = -2 * atkS;

  // 1:將對手能力提升視為同等級能力下降，自身能力下降視為同等級能力提升 (Poem >= 1)
  if (actorPoemCount >= 1) {
    if (atkS < 0) atkS = Math.abs(atkS);
    if (defS > 0) defS = -defS;
  }
  if (targetPoemCount >= 1) {
    if (defS < 0) defS = Math.abs(defS);
    if (atkS > 0) atkS = -atkS;
  }

  // 無視對手能力提升（列星安辰、魯斯王、積木「無視能力提升」等）；視為下降優先。
  const stageReg = side === "p1" ? p1RegistryState : p2RegistryState;
  if (stageReg?.oppBoostAsDropThisAction && defS > 0) defS = -defS;
  else if (options?.ignoreOppBuff && defS > 0) defS = 0;
  // 將自身能力下降視為對手的能力下降
  if (stageReg?.selfDropAsOppDropThisAction && atkS < 0) { defS = Math.max(-6, defS + atkS); atkS = 0; }

  if (atkPanelRatio) atkS = 0; // 「最終」攻擊／特攻＝面板原始值×比例，不再套能力等級
  const formula = specialDamageFormula(actor, target, skill, (oppSide === 'p1' ? p1Team : p2Team) || [], atkS, calculateEffectiveStat(atk, atkS));
  if (formula) { const n = Math.max(1, Math.floor(options?.hitCount || 1)); return n > 1 ? { ...formula, damage: Math.floor(formula.damage) * n, hitCount: n } : formula; }

  // 積木：能力下降視為同級全屬性提升
  if ((side === "p1" ? p1RegistryState : p2RegistryState)?.blkStageAsBoost) atkS = Math.max(atkS, (side === "p1" ? p1RegistryState : p2RegistryState).blkStageAsBoost);
  const powerMultiplier = (side === "p1" ? p1RegistryState : p2RegistryState)?.powerMultiplierThisAction ?? 1;
  // 官方公式：[(等級×0.4+2)×威力×攻÷防÷50+2]×本系×克制 → 取整 → ×浮動(217~255)/255 → 取整 → ×暴擊 → 取整 → ×連擊次數。
  // 方括號內為整體不拆分（不先取整）；能力等級換算後的面板值已於 calculateEffectiveStat 取整。
  const levelFactor = (actor.level ?? 100) * 0.4 + 2;
  // 通用：弱點傷害（weakPointDefenseTurns，寫在攻擊方）＝以對手當前雙防值中較低者×比例（預設60%）作為防禦方數值
  let effDef = calculateEffectiveStat(def, defS);
  if (Number(statRegA?.weakPointDefenseTurns) > 0) {
    const otherKey = isPhys ? 'spdef' : 'def';
    const otherS = skillStageView({ statStages: target.statStages, isInherentInvalid: actor.isInherentInvalid }, skill, otherKey, true);
    const otherEff = calculateEffectiveStat(target.calculatedStats[otherKey], otherS);
    const ratio = Number(statRegA?.weakPointDefenseRatio) > 0 ? Number(statRegA.weakPointDefenseRatio) : 0.6;
    effDef = Math.max(1, Math.floor(Math.min(effDef, otherEff) * ratio));
  }
  const base = ((levelFactor * calculateEffectiveStat(atk, atkS) * skill.power * powerMultiplier / Math.max(1, effDef)) / 50 + 2);
  
  const actorReg = side === "p1" ? p1RegistryState : p2RegistryState;
  // 通用：下N次攻擊的屬性克制計算改以指定屬性（attackTypeOverride 自身攻擊屬性／targetTypeOverride 對手屬性；attackTypeOverrideUses 次數）
  const typeOverrideActive = Number(actorReg?.attackTypeOverrideUses) > 0;
  const targetType = actorReg?.targetTypeThisAction || (typeOverrideActive && actorReg?.targetTypeOverride) || target.type;
  let typeMult = skillTypeMultiplier(actorReg, (typeOverrideActive && actorReg?.attackTypeOverride) || skill.type, targetType);
  if (actorReg?.minimumTypeMultiplierThisAction !== undefined) typeMult = Math.max(typeMult, actorReg.minimumTypeMultiplierThisAction);
  // 積木：克制倍數取指定屬性中最高者
  // 本系加成 1.5 倍：技能屬性（含雙屬性技能的任一屬性）為自身系別中含有的屬性
  const splitT = (t?: string) => (t || "").replace(/系$/, "").split(/[.·・]/).filter(Boolean);
  const actorTypes = splitT(actor.type);
  const stab = actorReg?.grantStabThisAction || (isStoneThrower(actor) && isSkillStone(skill)) || (skill.type && skill.type !== "無屬性" && splitT(skill.type).some(t => actorTypes.includes(t))) ? 1.5 : 1.0;
  // 浮動取整數 217~255
  const roll = Math.max(217, Math.min(255, Math.round(randomValue * 255)));

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

  const critChance = Math.max(0, Math.min(1, ((actor.critValue ?? 1) / 16) + suitCritBonus + ((title?.critBonus || 0) / 100) + critChanceBonus(actor, target) + Number(options?.critChanceBonus || 0)));
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
  const hitCount = Math.max(1, Math.floor(options?.hitCount || 1));
  let final = Math.floor(base * stab * typeMult);
  final = Math.floor(final * roll / 255);
  if (isCrit) final = Math.floor(final * critBonusMultiplier);
  for (const m of [suitDmgBonus, titleDmgBonus, oppSuitDmgRed, inscDmgBonus]) if (m !== 1) final = Math.floor(final * m);
  final = Math.floor(final * (skill.skillStoneDamageMultiplier || 1)) * hitCount;
  
  let statResetApplied: "def" | "spdef" | null = null;
  if (isCrit) {
    if (isPhys && defS > 0) statResetApplied = "def";
    else if (!isPhys && defS > 0) statResetApplied = "spdef";
  }

  return { 
    damage: Math.max(0, final), 
    isCrit, 
    typeMultiplier: typeMult,
    hitCount,
    statResetApplied
  };
};
