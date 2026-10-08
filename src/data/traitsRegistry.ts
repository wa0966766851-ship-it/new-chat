import { Elf } from '../types';
import { effectSourceViews } from '../battle/effectSources';

export interface AdvancedTraitMechanics {
  // 豪邁
  ignoreDefPercent?: number; // 忽略雙防比例，例如 0.5 (50%)

  // 投石者
  isStoneThrower?: boolean; // 是否為投石者
  forceSSSkillStonePower?: number; // 轉化技能石威力，例如 240
  mythologyWith4Stones?: boolean; // 攜帶4個技能石時獲得神話狀態 (免疫異常、能力下降、PP值無限)
  damageBoost4Stones?: number; // 攜帶4個技能石傷害提升，例如 0.5
  damageReduce4Stones?: number; // 攜帶4個技能石受傷減少，例如 0.5
  turnEndHeal4Stones?: number; // 回合結束恢復體力，例如 0.25
  stoneTypeMatchBoost?: boolean; // 技能石擁有本系加乘且 PP 上限 +10
  perfectStoneRate100?: boolean; // 完美技能石概率提升至 100%
  stoneUseOfffieldTrueDamagePercent?: number; // 每次使用技能石對對手背包精靈造成 25% * 克制倍數的真實傷害
  firstFatalSurviveAt1Hp?: boolean; // 遭受致死傷害時保留1點體力

  // 修復
  repairOnOtherDeriveStatus?: boolean; // 己方其他精靈受到任意衍化類異常時立即衍化並恢復 PP 與體力
  repairHealAmount?: number; // 修復恢復體力，例如 250
  repairPpRestore?: number; // 修復恢復 PP，例如 1

  // 咒術師
  cyberWraithSummon?: boolean; // 登場召喚賽博怨靈
  cyberWraithVanishOnSwitch?: boolean; // 自身下場後怨靈消逝
  wraithExistCurseNoReduce?: boolean; // 怨靈存在時自身詛咒回合數不減少
  cursePpTax?: number; // 詛咒狀態下選技能額外消耗 PP，例如 1
  wraithActionSpell?: boolean; // 行動階段發動 1 次魔咒
  wraithEndSpellIfNoSkill?: boolean; // 未選擇使用技能則發動 1 次滅靈魔咒
  wraithSubstituteDeathOnce?: boolean; // 存在怨靈時代替自身死亡 (保留 20% 體力，登場僅 1 次)
  wraithSubstituteDeathHpRatio?: number; // 替死保留體力比例，例如 0.2
  wraithSpellDamageDoubleAfterSub?: boolean; // 替死後怨靈額外行動對場下真實傷害翻倍

  // 無我
  convertStatusToSerenity?: boolean; // 受到異常時立即轉化為平靜
  doubleSerenityTurnsIfFurious?: boolean; // 若轉化的異常帶有狂暴則平靜回合數翻倍

  // 戰士
  alwaysAlienElf?: boolean; // 始終被視為異能精靈
  enterGainConceal?: boolean; // 登場獲得隱匿
  switchOutInheritConceal?: boolean; // 下場後若己方隱匿精靈不超過3個，則恢復下隻精靈PP並附加隱匿
  alwaysWeaknessDamage?: boolean; // 始終以弱點傷害計算 (對手較低雙防的 60%)
  weaknessShieldReductionPercent?: number; // 對手每有1點護盾、1%傷害減少，對手剩餘雙防降低 1% (最低降至1)
  bestElementAdvantage?: boolean; // 攻擊克制倍數取擁有的屬性中攻擊對手的最優克制系
  ignoreImmuneShieldEffects?: boolean; // 無視攻擊免疫、傷害限制、免疫、抵擋、轉化、護盾承傷效果

  // 無序星魂使徒
  doubleDamageToAlienElf?: boolean; // 對異能精靈造成傷害翻倍
  killAlienElfVanish?: boolean; // 擊敗異能精靈後令其消逝
}

export interface AdvancedTrait {
  name: string;
  category: '二代異能特質' | '專屬異能特質' | '特殊特質';
  description: string;
  mechanics: AdvancedTraitMechanics;
}

export const ADVANCED_TRAITS_REGISTRY: Record<string, AdvancedTrait> = {
  豪邁: {
    name: '豪邁',
    category: '二代異能特質',
    description: '自身攻擊時忽略對手 50% 雙防值。',
    mechanics: {
      ignoreDefPercent: 0.5
    }
  },
  投石者: {
    name: '投石者',
    category: '二代異能特質',
    description: '戰鬥中被視為異能精靈；技能位可攜帶4種不同屬性的技能石且使用任意技能石時轉化為使用同屬系的SS級技能石，威力變為240；若自身攜帶4個技能石技能則在戰鬥中擁有神話(免疫異常狀態、能力下降狀態、PP值無限)且造成攻擊傷害提升50%，受到攻擊傷害降低50%且戰鬥階段結束時恢復自身最大體力25%；裝備的技能石擁有本系加乘且PP值上限+10；若該技能石為完美技能石則機率效果觸發概率提升為100%；每次使用技能石時令對手背包內所有精靈受到傷害值25%*該技能石對受到傷害精靈當前克制倍數的真實傷害；遭受致死傷害時保留1點體力。',
    mechanics: {
      isStoneThrower: true,
      forceSSSkillStonePower: 240,
      mythologyWith4Stones: true,
      damageBoost4Stones: 0.5,
      damageReduce4Stones: 0.5,
      turnEndHeal4Stones: 0.25,
      stoneTypeMatchBoost: true,
      perfectStoneRate100: true,
      stoneUseOfffieldTrueDamagePercent: 0.25,
      firstFatalSurviveAt1Hp: true
    }
  },
  修復: {
    name: '修復',
    category: '二代異能特質',
    description: '己方其他精靈受到任意衍化類異常時，當回合戰鬥階段時會立即衍化並恢復自身與該精靈所有技能1點PP值與250點體力。',
    mechanics: {
      repairOnOtherDeriveStatus: true,
      repairHealAmount: 250,
      repairPpRestore: 1
    }
  },
  咒術師: {
    name: '咒術師',
    category: '二代異能特質',
    description: '戰鬥中被視為異能精靈；每次登場時召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方，下場後則怨靈死亡並消逝。常駐效果：賽博怨靈存在時自身詛咒類異常回合數不會減少；自身選擇技能時：若自身處於詛咒類狀態則選擇技能時消耗該技能1點PP值並由賽博怨靈於行動階段發動1次魔咒；若戰鬥階段結束時若未選擇使用技能則改為賽博怨靈於該階段發動1次滅靈魔咒；自身死亡時若存在怨靈會代替自身死亡以保留20%體力，此後賽博怨靈額外行動對敵方場下造成真實傷害翻倍。',
    mechanics: {
      cyberWraithSummon: true,
      cyberWraithVanishOnSwitch: true,
      wraithExistCurseNoReduce: true,
      cursePpTax: 1,
      wraithActionSpell: true,
      wraithEndSpellIfNoSkill: true,
      wraithSubstituteDeathOnce: true,
      wraithSubstituteDeathHpRatio: 0.2,
      wraithSpellDamageDoubleAfterSub: true
    }
  },
  無我: {
    name: '無我',
    category: '二代異能特質',
    description: '每次受到異常狀態時立即轉化為平靜，若轉化的異常中帶有狂暴則轉化觸發後令自身平靜異常回合數翻倍。',
    mechanics: {
      convertStatusToSerenity: true,
      doubleSerenityTurnsIfFurious: true
    }
  },
  戰士: {
    name: '戰士',
    category: '二代異能特質',
    description: '戰鬥中始終被視為異能精靈；自身戰鬥開始時與每次登場時獲得隱匿；自身下場後若己方隱匿精靈不超過3個，則恢復下隻出戰精靈所有技能PP值並附加隱匿印記；自身造成攻擊傷害時計算傷害始終以弱點傷害計算，計算弱點時若對方每存在1點護盾、1%傷害減少時弱點傷害則計算傷害時對手剩餘雙防值60%效果額外降低1%，最低降低至1；自身攻擊克制倍數取技能擁有的屬性中攻擊對手的最優克制系別計算傷害；自身攻擊無視對手攻擊免疫效果、傷害限制效果、免疫、抵擋、轉化傷害效果與護盾承傷效果。',
    mechanics: {
      alwaysAlienElf: true,
      enterGainConceal: true,
      switchOutInheritConceal: true,
      alwaysWeaknessDamage: true,
      weaknessShieldReductionPercent: 1.0,
      bestElementAdvantage: true,
      ignoreImmuneShieldEffects: true
    }
  },
  無序星魂使徒: {
    name: '無序星魂使徒',
    category: '專屬異能特質',
    description: '對異能精靈造成傷害翻倍且擊敗後令其消逝。',
    mechanics: {
      doubleDamageToAlienElf: true,
      killAlienElfVanish: true
    }
  }
};

/**
 * 根據名稱獲取異能特質定義
 */
export function getAdvancedTrait(name: string): AdvancedTrait | undefined {
  if (!name) return undefined;
  
  // 支援包含斜線、空格等多個特質的拆分
  // 例如 "豪邁 / 投石者" -> 匹配 "豪邁" 或 "投石者"
  const cleanName = name.trim();
  if (ADVANCED_TRAITS_REGISTRY[cleanName]) {
    return ADVANCED_TRAITS_REGISTRY[cleanName];
  }
  
  // 嘗試局部匹配
  for (const key of Object.keys(ADVANCED_TRAITS_REGISTRY)) {
    if (cleanName.includes(key)) {
      return ADVANCED_TRAITS_REGISTRY[key];
    }
  }
  return undefined;
}

/**
 * 判斷精靈是否擁有特定進階特質，並獲取其合併後的 mechanics 參數
 */
export function getElfAdvancedMechanics(elf: Elf): AdvancedTraitMechanics {
  if (!elf) return {};
  return Object.assign({}, ...effectSourceViews(elf).map(nativeAdvancedMechanics));
}
function nativeAdvancedMechanics(elf: Elf): AdvancedTraitMechanics {
  const merged: AdvancedTraitMechanics = {};
  if (!elf) return merged;
  
  // 1. 從精靈的 alienTraits 屬性中提取
  const traitsToInquire: string[] = [];
  if (elf.alienTraits) {
    if (elf.alienTraits.gen2Trait?.name) {
      traitsToInquire.push(...elf.alienTraits.gen2Trait.name.split(/[\s/·]+/));
    }
    if (elf.alienTraits.exclusiveTrait?.name) {
      traitsToInquire.push(...elf.alienTraits.exclusiveTrait.name.split(/[\s/·]+/));
    }
    for (const trait of [...(elf.alienTraits.exclusiveTraits || []), elf.alienTraits.alienTrait, elf.alienTraits.generalTrait]) {
      if (trait?.name) traitsToInquire.push(...trait.name.split(/[\s/·]+/));
    }
  }
  
  // 2. 輔助檢查解構 Profile 中是否定義了對應的 mechanics 標記
  // 例如，如果 elf 的名稱是無序三刃或擁有特定戰士/咒術師魂印，也可以直接關聯
  const clean = (str: string) => str.replace(/[·\.\s]/g, '');
  const elfName = clean(elf.name);
  
  if (elfName.includes('蝕言') || elf.id === 'wuxu_shiyan') {
    traitsToInquire.push('修復', '咒術師', '無序星魂使徒');
  }
  if (elfName.includes('六刃') || elf.id === 'wuxu_liuren') {
    traitsToInquire.push('無我', '戰士', '無序星魂使徒');
  }
  if (elfName.includes('墜星') || elf.id === 'wuxu_zhuixing') {
    traitsToInquire.push('豪邁', '投石者', '無序星魂使徒');
  }
  
  // 3. 遍歷並合併對應的 mechanics 屬性
  const uniqueTraits = Array.from(new Set(traitsToInquire.map(t => t.trim()).filter(Boolean)));
  for (const t of uniqueTraits) {
    const tDef = getAdvancedTrait(t);
    if (tDef) {
      Object.assign(merged, tDef.mechanics);
    }
  }
  
  return merged;
}
