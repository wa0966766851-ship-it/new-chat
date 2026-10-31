import { applyStageViewAs } from './stageViewAs';
import { traitNames } from '../effects/traitEffects';
import { readStatPercent } from '../effects/soulProperty';
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
import { equipmentDamageFactors } from '../battle/damagePipeline';
import { hpPowerScale } from '../battle/actionDamageModifiers';
import {readIncomingPanelAttack} from '../battle/panelAttack';
import {activeResourceQueryRules} from '../battle/resourceQueryRules';
import {statusTypeMultiplier} from '../effects/statusMechanics';

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
  options?: { ignoreSpDefPercent?: number, ignoreDefPercent?: number, ignoreOppBuff?: boolean, hitCount?: number, critChanceBonus?: number, actionId?: number, inherentInvalid?: boolean },
  p1Title?: string,
  p2Title?: string,
  p1RegistryState?: any,
  p2RegistryState?: any,
  p1Marks?: Mark[],
  p2Marks?: Mark[]
) => {
  const fixedPowerAdd = Number((side === 'p1' ? p1RegistryState : p2RegistryState)?.powerAddThisAction) || 0;
  if (skill.category === "屬性" || !(skill.power + fixedPowerAdd > 0)) return { damage: 0, isCrit: false, typeMultiplier: 1.0, hitCount: 1, statResetApplied: null as "def" | "spdef" | null, formulaReplaced: false, equipmentMultiplier: 1 };
  
  const isPhys = skill.category === "物理";
  const suit = p1Suit && side === "p1" ? SUIT_CATALOG[p1Suit] : (p2Suit && side === "p2" ? SUIT_CATALOG[p2Suit] : undefined);
  const oppSuit = p1Suit && side === "p2" ? SUIT_CATALOG[p1Suit] : (p2Suit && side === "p1" ? SUIT_CATALOG[p2Suit] : undefined);

  let atk = isPhys ? actor.calculatedStats.atk : actor.calculatedStats.spatk;
  if(skill.resolvedAttackStats?.length)atk=skill.resolvedAttackStats.reduce((sum,key)=>sum+(actor.calculatedStats[key]||0),0);
  // 積木：計算傷害時令攻擊、特攻等於原本二者總和
  if ((side === "p1" ? p1RegistryState : p2RegistryState)?.blkAtkSpatkSum ||
    (side === 'p1' ? p1RegistryState : p2RegistryState)?.blkAtkSpAtkSum) atk = (actor.calculatedStats.atk || 0) + (actor.calculatedStats.spatk || 0);
  let def = isPhys ? target.calculatedStats.def : target.calculatedStats.spdef;
  // 公式能力視圖僅替換本次輸入，不改動任一持有者的能力點數。
  if(skill.resolvedCombatStats){atk=skill.resolvedCombatStats.attack;def=skill.resolvedCombatStats.defense;}
  // 臨時能力值（效果層設定於登錄狀態）：calcAtkDefMult＝自身雙攻／雙防在雙方計算傷害時的倍率；
  // opponentAtkPanelRatio＝對手攻擊時其最終攻擊／特攻變為面板原始值的比例（忽略能力等級）。
  const statRegA = side === "p1" ? p1RegistryState : p2RegistryState;
  const statRegT = side === "p1" ? p2RegistryState : p1RegistryState;
  const atkPanelRatio = readIncomingPanelAttack(statRegT,actor,options?.actionId) || (Number(statRegT?.opponentAtkPanelRatio) > 0 ? Number(statRegT.opponentAtkPanelRatio) : 0);
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
  
  const inherentInvalid=actor.isInherentInvalid || options?.inherentInvalid;
  const rawAtkS = skillStageView({statStages:actor.statStages,isInherentInvalid:inherentInvalid}, skill, isPhys ? 'atk' : 'spatk');
  const rawDefS = skillStageView({ statStages: target.statStages, isInherentInvalid: inherentInvalid }, skill, isPhys ? 'def' : 'spdef', true);

  const actorMarks = side === "p1" ? p1Marks : p2Marks;
  const oppSide = side === "p1" ? "p2" : "p1";
  const targetMarks = oppSide === "p1" ? p1Marks : p2Marks;

  const actorResourceRules=activeResourceQueryRules(actor,actorMarks||[]);
  const targetResourceRules=activeResourceQueryRules(target,targetMarks||[]);

  let atkS = rawAtkS;
  let defS = rawDefS;
  if (actor.treatOpponentBoostAsDoubleDrop && defS > 0) defS = -2 * defS;
  if (target.treatOpponentBoostAsDoubleDrop && atkS > 0) atkS = -2 * atkS;

  if(actorResourceRules.some(r=>r.selfDownAsUp)&&atkS<0)atkS=Math.abs(atkS);
  if(actorResourceRules.some(r=>r.oppUpAsDown)&&defS>0)defS=-defS;
  if(targetResourceRules.some(r=>r.selfDownAsUp)&&defS<0)defS=Math.abs(defS);
  if(targetResourceRules.some(r=>r.oppUpAsDown)&&atkS>0)atkS=-atkS;

  // 無視對手能力提升（列星安辰、魯斯王、積木「無視能力提升」等）；視為下降優先。
  const stageReg = side === "p1" ? p1RegistryState : p2RegistryState;
  // 2026-10-31：改用共用投影函式，與出手順序／其他屬性共用同一套「視為」規則。
  // ② 將對手能力提升視為同級下降；③ 將自身能力下降視為對手同級下降。
  {
    const v = applyStageViewAs(atkS, defS, {
      oppBoostAsDrop: !!stageReg?.oppBoostAsDropThisAction,
      selfDropAsOppDrop: !!stageReg?.selfDropAsOppDropThisAction,
    });
    atkS = v.atkS; defS = v.defS;
  }
  // 通用：「無視自身能力下降」（寂殺之魄1道等；行動鍵）——自身下降等級歸零。
  if (stageReg?.selfDropIgnoredThisAction && atkS < 0) atkS = 0;
  else if (options?.ignoreOppBuff && defS > 0) defS = 0;

  // 2026-10-31：無序·蝕言「修正敵方特殊攻擊計算公式」。
  // 官方：「自身最終特防值每有1點特防則對手選擇特殊攻擊時直到下回合結束時每次造成技能傷害時減少1%」
  // registry 在對手「選擇特殊攻擊」時寫入觸發回合；這裡比對回合數判斷是否仍在有效期。
  let shiyanOverride = 0;
  if (!isPhys) {
    // 從防守方隊伍找蝕言（存活且非消逝），讀它身上的觸發回合與最終特防。
    // 防守方是否有存活的蝕言（在場或後台皆可，官方為常駐）
    const tTeam2: any[] = ((side === "p1" ? p2Team : p1Team) || []) as any[];
    const tReg: any = side === "p1" ? p2RegistryState : p1RegistryState;
    const syElf = tTeam2.find((e: any) => String(e?.name || "").includes("蝕言") && Number(e?.currentHp) > 0 && !e?.isVanished);
    // 只在「對手本回合選擇特殊攻擊」時生效（每次重算都重新判定）。
    const oppChoseSpecial = !!(tReg?.shiyanOppSpecialThisAction);
    if (syElf && oppChoseSpecial) {
      const finalSpdef = Number(syElf?.calculatedStats?.spdef) || 0;
      const flat = Math.max(1, Math.floor(Number(actor.calculatedStats?.spatk) || 0));
      const reduce = Math.min(1, Math.max(0, finalSpdef / 100));
      shiyanOverride = Math.max(0, Math.floor(flat * (1 - reduce)));
    }
  }
  if (atkPanelRatio) atkS = 0; // 「最終」攻擊／特攻＝面板原始值×比例，不再套能力等級
  const formula = specialDamageFormula(actor, target, skill, (oppSide === 'p1' ? p1Team : p2Team) || [], atkS, calculateEffectiveStat(atk, atkS));
  // 公式替換：結果即總傷，不吃暴擊、也不乘連擊（使用者確認 2026-10-11）
  if (formula) return { ...formula, damage: Math.floor(formula.damage), hitCount: Math.max(1, Math.floor(options?.hitCount || 1)), formulaReplaced: true, equipmentMultiplier: 1 };

  // 積木：能力下降視為同級全屬性提升
  if (!atkPanelRatio && (side === "p1" ? p1RegistryState : p2RegistryState)?.blkStageAsBoost) atkS = Math.max(atkS, (side === "p1" ? p1RegistryState : p2RegistryState).blkStageAsBoost);
  const powerRegistry = side === 'p1' ? p1RegistryState : p2RegistryState;
  const powerMultiplier = (powerRegistry?.powerMultiplierThisAction ?? 1) * hpPowerScale(powerRegistry, actor, target, options?.actionId);
  const powerAdd = fixedPowerAdd;
  // 官方公式：[(等級×0.4+2)×威力×攻÷防÷50+2]×本系×克制 → 取整 → ×浮動(217~255)/255 → 取整 → ×暴擊 → 取整 → ×連擊次數。
  // 方括號內為整體不拆分（不先取整）；能力等級換算後的面板值已於 calculateEffectiveStat 取整。
  const levelFactor = (actor.level ?? 100) * 0.4 + 2;
  // 通用：弱點傷害（weakPointDefenseTurns，寫在攻擊方）＝以對手當前雙防值中較低者×比例（預設60%）作為防禦方數值
  let effDef = calculateEffectiveStat(def, defS);
  // 特質「戰士」：始終以弱點傷害計算；對方每 1 點護盾，60% 的比例再降 1%（最低 1%）。
  // 未實裝：原文「每 1% 傷害減少也降 1%」需要在公式前得知對方當次減傷，目前不計。
  const atkMech = getElfAdvancedMechanics(actor);
  if (Number(statRegA?.weakPointDefenseTurns) > 0 || atkMech.alwaysWeaknessDamage) {
    const otherKey = isPhys ? 'spdef' : 'def';
    const otherS = skillStageView({ statStages: target.statStages, isInherentInvalid: inherentInvalid }, skill, otherKey, true);
    const otherEff = calculateEffectiveStat(target.calculatedStats[otherKey], otherS);
    let ratio = Number(statRegA?.weakPointDefenseRatio) > 0 ? Number(statRegA.weakPointDefenseRatio) : 0.6;
    if (atkMech.alwaysWeaknessDamage && atkMech.weaknessShieldReductionPercent) ratio = Math.max(0, ratio - (Number(target.shield) || 0) * atkMech.weaknessShieldReductionPercent / 100);
    effDef = Math.max(1, Math.floor(Math.min(effDef, otherEff) * ratio));
  }
  // 通用特性「亂舞」：攻擊／特攻提升12%（能力值，屬公式輸入）
  // 通用特性「亂舞」：kit 模式改讀 soul_property.stat_percent；其餘舊路徑保留名字判定。
  const atkTraitMult = ((actor.trait?.name === "亂舞" && actor.trait?.effectMode !== 'kit') || traitNames(actor).includes("亂舞") ? 1.12 : 1) + readStatPercent(actor, isPhys ? 'atk' : 'spatk') / 100;
  const base = ((levelFactor * Math.floor(calculateEffectiveStat(atk, atkS) * atkTraitMult) * (skill.power + powerAdd) * powerMultiplier / Math.max(1, effDef)) / 50 + 2);
  
  const actorReg = side === "p1" ? p1RegistryState : p2RegistryState;
  // 通用：下N次攻擊的屬性克制計算改以指定屬性（attackTypeOverride 自身攻擊屬性／targetTypeOverride 對手屬性；attackTypeOverrideUses 次數）
  const typeOverrideActive = Number(actorReg?.attackTypeOverrideUses) > 0;
  const targetType = actorReg?.targetTypeThisAction || (typeOverrideActive && actorReg?.targetTypeOverride) || target.type;
  let typeMult = skill.resolvedTypeMultiplier ?? skillTypeMultiplier(actorReg, (typeOverrideActive && actorReg?.attackTypeOverride) || skill.type, targetType);
  // 特質「戰士」：克制倍數取技能擁有的屬性中對對手最優的系別
  if (atkMech.bestElementAdvantage && !(typeOverrideActive && actorReg?.attackTypeOverride)) {
    const parts = String(skill.type || '').replace(/系$/, '').split(/[.·・]/).filter(Boolean);
    for (const part of parts) typeMult = Math.max(typeMult, skillTypeMultiplier(actorReg, part, targetType));
  }
  if (actorReg?.minimumTypeMultiplierThisAction !== undefined) typeMult = Math.max(typeMult, actorReg.minimumTypeMultiplierThisAction);
  typeMult=statusTypeMultiplier(actor,typeMult);
  // 積木：克制倍數取指定屬性中最高者
  // 本系加成 1.5 倍：技能屬性（含雙屬性技能的任一屬性）為自身系別中含有的屬性
  const splitT = (t?: string) => (t || "").replace(/系$/, "").split(/[.·・]/).filter(Boolean);
  const actorTypes = splitT(actor.type);
  const stab = skill.resolvedForceStab || actorReg?.grantStabThisAction || (isStoneThrower(actor) && isSkillStone(skill)) || (skill.type && skill.type !== "無屬性" && splitT(skill.type).some(t => actorTypes.includes(t))) ? 1.5 : 1.0;
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
  
  // 套裝／稱號／刻印「傷害提升／減少X%」、寶石「傷害翻倍」不在公式內：由引擎在增傷／減傷層加入（battle/damagePipeline.ts）。
  const equipment = equipmentDamageFactors({ actor, target, skill, side, isCrit, p1Suit, p2Suit, p1Title, p2Title });

  const critResistPercent = target.resistances?.damageResist?.crit || 0;
  // 致命一擊倍率 = 2 ×（1 − 致命抗性）：無抗 2 倍、5% 1.9 倍、滿抗 35% 1.3 倍（只在這裡套用一次）
  const critBonusMultiplier = 2 * (1 - critResistPercent / 100);
  const hitCount = Math.max(1, Math.floor(options?.hitCount || 1));
  let final = Math.floor(base * stab * typeMult);
  final = Math.floor(final * roll / 255);
  if (isCrit) final = Math.floor(final * critBonusMultiplier);
  final = final * hitCount;
  
  let statResetApplied: "def" | "spdef" | null = null;
  if (isCrit) {
    if (isPhys && defS > 0) statResetApplied = "def";
    else if (!isPhys && defS > 0) statResetApplied = "spdef";
  }

  return { 
    damage: shiyanOverride > 0 ? shiyanOverride : Math.max(0, final), 
    isCrit, 
    typeMultiplier: typeMult,
    hitCount,
    statResetApplied,
    formulaReplaced: false,
    /** 套裝／稱號／刻印／寶石倍率（不含於 damage；供 AI 估算） */
    equipmentMultiplier: equipment.multiplier * (skill.skillStoneDamageMultiplier || 1),
  };
};
