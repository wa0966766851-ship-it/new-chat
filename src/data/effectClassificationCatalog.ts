/**
 * ============================================================================
 * 賽爾號對戰引擎 —— 技能效果分類與判定規範庫 (Effect Classification Catalog)
 * ============================================================================
 * 本檔案用於定義與規範所有技能效果、魂印特性、失效機制及傷害判定的標準分類。
 * 供戰鬥引擎 (BattleScreen / Effect Engine) 及精靈設定建庫時統一引用，
 * 嚴格遵循「去數值化（不預設數值，由實例參數動態指定）」與「風味邏輯分離」原則。
 */

// ==========================================
// 一、 三大效果基礎分類 (Effect Categories)
// ==========================================

export type MajorEffectCategory = 'A_CARRIED' | 'B_INNATE' | 'C_ADDITIONAL';

export interface EffectCategoryDefinition {
  code: MajorEffectCategory;
  name: string;
  triggerRequirement: string;
  respondsToAdditionalInvalid: boolean; // 是否會被「技能附加效果失效」影響
  description: string;
  examples: string[];
}

export const MAJOR_EFFECT_CATEGORIES: Record<MajorEffectCategory, EffectCategoryDefinition> = {
  A_CARRIED: {
    code: 'A_CARRIED',
    name: '攜帶類效果 (Carried / Passive Effects)',
    triggerRequirement: '攜帶後滿足特定條件（至少需在戰鬥開始或登場時觸發）即可生效。',
    respondsToAdditionalInvalid: false,
    description: '顧名思義，屬於精靈被動攜帶、常駐或條件式觸發的底層特性或特殊狀態。完全不響應「技能附加效果失效」。',
    examples: ['魂印常駐免疫', '登場時血量上限提升', '受擊時觸發被動回血/減傷']
  },
  B_INNATE: {
    code: 'B_INNATE',
    name: '固有類效果 (Innate / Pre-hit Effects)',
    triggerRequirement: '在技能命中判定前（使用成功前）就必須計算完畢並生效的效果。',
    respondsToAdditionalInvalid: false,
    description: '屬於技能固有的判定前置屬性或優先特權。不會被「技能附加效果失效」響應而失效；但遇到「技能固有效果失效」（或特定類型的固有失效）時則會失效。',
    examples: [
      '必中 (Always Hit)',
      '技能自帶先制或條件先制 (Priority Bonus)',
      '無視對手強化 / 弱化狀態 (Ignore Stat Buffs/Debuffs)',
      '附加於技能中的不受 PP 值限制效果',
      '將對手強化視為弱化（如1級或2級以上視為弱化）'
    ]
  },
  C_ADDITIONAL: {
    code: 'C_ADDITIONAL',
    name: '附加效果 (Additional / Post-hit Effects)',
    triggerRequirement: '技能命中後（使用成功後）或 技能無效（含 Miss 未命中）時才觸發的回合或一次性效果。',
    respondsToAdditionalInvalid: true,
    description: '技能自帶的追傷、狀態施加、強化弱化、消強、吸血等追加邏輯。此大類下的所有效果皆會響應「技能附加效果失效」而無效。',
    examples: [
      '僅使用成功時生效：技能命中成功後附加的燒傷、回血、提屬、消回合等。',
      '僅技能無效時生效：當技能 Miss 或被對手無效時，補償觸發的消回合、附加詛咒、回復 PP 等。'
    ]
  }
};

// ==========================================
// 二、 四大技能失效與防護機制 (Invalidation Types)
// ==========================================

export type InvalidationType = 'INNATE_INVALID' | 'ADDITIONAL_INVALID' | 'SKILL_INVALID' | 'ATTACK_IMMUNE';

export interface InvalidationDefinition {
  type: InvalidationType;
  name: string;
  affectsInnate: boolean;
  affectsAdditional: boolean;
  preventsHit: boolean;
  consumesImmunityCount: boolean; // 當對手進攻未造成傷害時，是否消耗次數
  description: string;
  criticalNotes: string[];
}

export const INVALIDATION_MECHANISMS: Record<InvalidationType, InvalidationDefinition> = {
  INNATE_INVALID: {
    type: 'INNATE_INVALID',
    name: '固有效果失效 (Innate Effect Invalidation)',
    affectsInnate: true,
    affectsAdditional: false,
    preventsHit: false,
    consumesImmunityCount: false,
    description: '使對手技能中在「命中前生效」的固有類效果不生效（可針對特定類型，如：必中失效、先制失效等）。',
    criticalNotes: [
      '若對手的必中固有效果被此機制無效，則該技能需重新進行一般的命中率判定。',
      '僅干擾命中前的固有判定，不影響命中後附加效果的正常發揮。'
    ]
  },
  ADDITIONAL_INVALID: {
    type: 'ADDITIONAL_INVALID',
    name: '附加效果失效 (Additional Effect Invalidation)',
    affectsInnate: false,
    affectsAdditional: true,
    preventsHit: false,
    consumesImmunityCount: false,
    description: '使技能命中後（或未命中時）的附加效果（分類 C）不生效。常搭配「對手無法造成攻擊/技能傷害」等防護效果共同施展。',
    criticalNotes: [
      '【易混淆重要概念辨析】：【屬性技能附加效果失效】 vs 【屬性技能無效】！',
      '1. 「屬性技能附加效果失效」：僅讓對方屬性技能的附加強化/弱化/回血等附加效果不生效，但對方施展該技能本身不算失敗（其固有效果或觸發計數仍可運作）。',
      '2. 「屬性技能無效」：直接封鎖並判定對方的屬性技能未命中/失效，無法產生任何作用。'
    ]
  },
  SKILL_INVALID: {
    type: 'SKILL_INVALID',
    name: '技能無效類 (Skill Invalidation)',
    affectsInnate: false,
    affectsAdditional: true,
    preventsHit: true,
    consumesImmunityCount: false,
    description: '直接無效對方的攻擊技能 / 對方攻擊 / 屬性技能。在此狀態下，對手技能判定為未命中（Miss / Invalid）。',
    criticalNotes: [
      '必中效果在此機制下面對無效化時也無效，因此也搭配了「技能固有效果失效」中的必中類型技能無效。',
      '未被干擾的其他「固有效果」（例如先制出手判定）仍可在技能判定前正常執行，但最終命中判定為無效。',
      '因為技能無效未命中，不造成技能傷害，因此不會消耗防守方身上的「抵擋攻擊傷害 / 免疫攻擊傷害 / 轉化攻擊傷害」等傷害防護次數。'
    ]
  },
  ATTACK_IMMUNE: {
    type: 'ATTACK_IMMUNE',
    name: '攻擊免疫類 (Attack Immunity)',
    affectsInnate: false,
    affectsAdditional: true,
    preventsHit: true,
    consumesImmunityCount: false,
    description: '免疫受到的攻擊效果。防守方處於此狀態時，進攻方的攻擊技能將未命中。',
    criticalNotes: [
      '可被對方技能中的「無視攻擊免疫效果」響應並貫穿。',
      '若為「次數型免疫攻擊」，當被對手無視或該次攻擊未命中時，不消耗免疫次數。',
      '必中效果在此也無效（包含必中固有效果失效）。',
      '【獨立性聲明】：此效果和「抵擋受到的攻擊傷害」、「免疫受到的攻擊傷害」、「轉化受到的攻擊傷害」屬於完全不同且互相獨立的系統！因未命中故不受到攻擊傷害，但仍可能受引擎判定規則受到「技能傷害」。'
    ]
  }
};

// ==========================================
// 三、 傷害大分類與判定引擎 (Damage Classifications)
// ==========================================

export type DamageCategory = 'ATTACK_DAMAGE' | 'SKILL_DAMAGE';

export interface DamageCategoryDefinition {
  category: DamageCategory;
  name: string;
  isSubsetOfSkillDamage: boolean;
  definition: string;
  includedSources: string[];
}

export const DAMAGE_CATEGORIES: Record<DamageCategory, DamageCategoryDefinition> = {
  ATTACK_DAMAGE: {
    category: 'ATTACK_DAMAGE',
    name: '攻擊傷害 (Attack Damage)',
    isSubsetOfSkillDamage: true,
    definition: '進攻方使用攻擊技能（物理攻擊 / 特殊攻擊），在成功命中目標後，基於雙方攻防能力值與威力計算所造成的直接傷害。',
    includedSources: ['普通物理攻擊', '普通特殊攻擊', '暴擊傷害（若為攻擊技能命中）']
  },
  SKILL_DAMAGE: {
    category: 'SKILL_DAMAGE',
    name: '技能傷害 (Skill Damage - Universal)',
    isSubsetOfSkillDamage: false,
    definition: '最大的傷害分類大類。除了攻擊傷害屬於技能傷害之外，其他由技能機制直接引發、不受常規攻防減免制約的傷害皆屬於此類。',
    includedSources: [
      '攻擊傷害（攻擊技能造成的傷害）',
      '屬性技能直接造成的固定或百分比傷害',
      '保底傷害（Guaranteed Minimum Damage）',
      '技能附加的追加真實傷害（True Damage）',
      '即使攻擊技能未命中 / 或是使用屬性技能，依條件觸發的追傷與扣血判定'
    ]
  }
};

// ==========================================
// 四、 特殊終結機制分類與嚴格定義 (Execution Mechanics)
// ==========================================

export type ExecutionMechanicType = 'GUARANTEED_MINIMUM_DAMAGE' | 'INSTA_KILL' | 'SELF_DESTRUCT';

export interface ExecutionMechanicDefinition {
  type: ExecutionMechanicType;
  name: string;
  definition: string;
  coreMechanism: string;
  isTrueKill: boolean;
  bypassesDefenses: boolean;
}

export const EXECUTION_MECHANICS: Record<ExecutionMechanicType, ExecutionMechanicDefinition> = {
  GUARANTEED_MINIMUM_DAMAGE: {
    type: 'GUARANTEED_MINIMUM_DAMAGE',
    name: '保底傷害 (Guaranteed Minimum Damage)',
    definition: '本質上是一個「傷害替代機制」，將當次造成的紅字傷害替換為等同於對手當前剩餘體力值的紅字傷害。',
    coreMechanism: '受所有常規戰鬥機制（增傷、減傷、抗性、護盾、技能免傷、彈傷）影響。並非為了補足體力而追加的額外傷害。',
    isTrueKill: false,
    bypassesDefenses: false
  },
  INSTA_KILL: {
    type: 'INSTA_KILL',
    name: '秒殺 / 瞬殺 (Insta-kill / Execute)',
    definition: '真正意義上的秒殺機制，必須包含「體力修正（補償粉傷）」成分。',
    coreMechanism: '結算常規傷害後若不足以擊殺，系統發動粉傷形式的「體力修正」補償剩餘血量。無視傷害限制、免疫、抗性及部分免死。',
    isTrueKill: true,
    bypassesDefenses: true
  },
  SELF_DESTRUCT: {
    type: 'SELF_DESTRUCT',
    name: '自爆 (Self-destruct)',
    definition: '主動消耗自身100%體力的機制。',
    coreMechanism: '直接調整體力，不涉及先打出傷害，無視除「免疫死亡」外的復活與兩命機制。',
    isTrueKill: true, // It is a true kill to oneself
    bypassesDefenses: true // Bypasses normal revivals
  }
};

// ==========================================
// 五、 去數值化與模組入庫規範 (De-numericalization Standard)
// ==========================================

/**
 * 甚麼是「去數值化」？
 * 不在底層效果模板（Effect Template / Catalog）中預設死代碼數值（例如固定寫死 30% 機率、50 點傷害、2 回合），
 * 而是將「效果邏輯架構」與「數值參數 (Mechanics Parameters)」完全分離。
 *
 * 【優勢】：
 * 1. 同一個「低血增傷模組」可以同時用於戰鬥系被動（低於50%增傷50%）與其他精靈（低於40%增傷100%），只需傳入不同配置。
 * 2. 入庫精靈配置時，數值明確記錄在 JSON / TypeScript 物件中，方便平衡性調整與技能改版。
 */
export interface ParameterizedEffectSchema<TParams = Record<string, number | string | boolean>> {
  schemaId: string;
  effectClass: MajorEffectCategory;
  name: string;
  descriptionTemplate: (params: TParams) => string;
  requiredParamKeys: (keyof TParams)[];
}

export const PARAMETERIZED_SCHEMAS_EXAMPLE: Record<string, ParameterizedEffectSchema<any>> = {
  LOW_HP_DAMAGE_BOOST: {
    schemaId: 'LOW_HP_DAMAGE_BOOST',
    effectClass: 'A_CARRIED',
    name: '條件低血增傷與先制提速',
    descriptionTemplate: (p: { hpThreshold: number; dmgBoostPct: number; priorityBonus: number }) =>
      `若自身當前體力低於最大體力的 ${p.hpThreshold}%，則造成的攻擊傷害提升 ${p.dmgBoostPct}% 且技能先制 +${p.priorityBonus}；`,
    requiredParamKeys: ['hpThreshold', 'dmgBoostPct', 'priorityBonus']
  },
  DISPEL_AND_SEAL: {
    schemaId: 'DISPEL_AND_SEAL',
    effectClass: 'C_ADDITIONAL',
    name: '消除強化並封鎖屬性',
    descriptionTemplate: (p: { sealTurns: number; atkDebuffLevel: number }) =>
      `消除對手能力提升狀態，消除成功則對手 ${p.sealTurns} 回合內無法使用屬性技能；若對手不處於能力提升狀態，則令對手攻擊等級 -${p.atkDebuffLevel}；`,
    requiredParamKeys: ['sealTurns', 'atkDebuffLevel']
  }
};
