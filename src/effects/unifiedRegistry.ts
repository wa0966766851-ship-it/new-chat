import { EffectPolarity } from "./types";

export type EffectSource = 'skill' | 'soulmark' | 'mechanic' | 'item';

export interface UnifiedTurnEffect {
  key: string;
  name: string;
  source: EffectSource;
  isClearable: boolean;
  polarity: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  tickOnActionEnd: boolean;
  tickOnRoundEnd: boolean;
  description?: string;
}

export const TURN_EFFECT_REGISTRY: Record<string, UnifiedTurnEffect> = {
  "p1DeepSeaTurns": {
    key: "p1DeepSeaTurns",
    name: "深海守護",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DamageBoostTurns": {
    key: "p1DamageBoostTurns",
    name: "傷害提升",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ImmuneReflectTurns": {
    key: "p1ImmuneReflectTurns",
    name: "免疫反彈",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1OppPriorityDebuffTurns": {
    key: "p1OppPriorityDebuffTurns",
    name: "對手先制降低",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1IdiocyDebuffTurns": {
    key: "p1IdiocyDebuffTurns",
    name: "白痴/愚蠢弱化",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HalfDmgTurns": {
    key: "p1HalfDmgTurns",
    name: "減傷50%",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BaphometDebuffTurns": {
    key: "p1BaphometDebuffTurns",
    name: "巴風特印記",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniHolyLightTurns": {
    key: "p1PuniHolyLightTurns",
    name: "聖光印記",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1PuniStealBuffTurns": {
    key: "p1PuniStealBuffTurns",
    name: "偷強回合",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1PuniNoHealTurns": {
    key: "p1PuniNoHealTurns",
    name: "無法恢復",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluNonTrueDmgBoostTurns": {
    key: "p1DeluNonTrueDmgBoostTurns",
    name: "非真傷提升",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluFatalResistTurns": {
    key: "p1DeluFatalResistTurns",
    name: "致命抗性",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1StarSeaImmersionTurns": {
    key: "p1StarSeaImmersionTurns",
    name: "星海之浸",
    source: "soulmark",
    isClearable: false,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1StarFangTurns": {
    key: "p1StarFangTurns",
    name: "星牙",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1StarFireBurnTurns": {
    key: "p1StarFireBurnTurns",
    name: "星火燒傷",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniPropInvalidTurns": {
    key: "p1PuniPropInvalidTurns",
    name: "屬性失效",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1PuniDamageAmplifyTurns": {
    key: "p1PuniDamageAmplifyTurns",
    name: "受傷翻倍",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1PuniPriorityBoostTurns": {
    key: "p1PuniPriorityBoostTurns",
    name: "先制提升",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1PuniXuanMieTurns": {
    key: "p1PuniXuanMieTurns",
    name: "旋滅裂空",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniShengMingHealTurns": {
    key: "p1PuniShengMingHealTurns",
    name: "生命恢復",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniShengJieMissTurns": {
    key: "p1PuniShengJieMissTurns",
    name: "聖潔必避",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniShengGuangQiTurns": {
    key: "p1PuniShengGuangQiTurns",
    name: "聖光致命",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PuniXuWuActiveTurns": {
    key: "p1PuniXuWuActiveTurns",
    name: "虛無避傷",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1AttackSkillInvalidTurns": {
    key: "p1AttackSkillInvalidTurns",
    name: "攻擊無效",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluFinalBuffTurns": {
    key: "p1DeluFinalBuffTurns",
    name: "獅子終極強化",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DeluImmuneStatusTurns": {
    key: "p1DeluImmuneStatusTurns",
    name: "獅子免疫異常",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluDamageBoostTurns": {
    key: "p1DeluDamageBoostTurns",
    name: "獅子傷害提升",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluPriorityBoostTurns": {
    key: "p1DeluPriorityBoostTurns",
    name: "獅子先制提升",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluImmuneReflectTurns": {
    key: "p1DeluImmuneReflectTurns",
    name: "獅子免疫彈傷",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1DeluDmgCapHealTurns": {
    key: "p1DeluDmgCapHealTurns",
    name: "獅子傷害鎖血",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DeluDrainHpSkillTurns": {
    key: "p1DeluDrainHpSkillTurns",
    name: "獅子技能吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1ShuangdongVampireTurns": {
    key: "p1ShuangdongVampireTurns",
    name: "霜凍吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BingtianVampireTurns": {
    key: "p1BingtianVampireTurns",
    name: "冰天吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SealSupportTurns": {
    key: "p1SealSupportTurns",
    name: "屬性技能封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SealBonusTurns": {
    key: "p1SealBonusTurns",
    name: "附加效果封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HanyeVampireTurns": {
    key: "p1HanyeVampireTurns",
    name: "寒夜吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HanyeTrueDmgTurns": {
    key: "p1HanyeTrueDmgTurns",
    name: "寒夜真傷",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DodgeTurns": {
    key: "p1DodgeTurns",
    name: "閃避",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1XingshuTurns": {
    key: "p1XingshuTurns",
    name: "星贖",
    source: "soulmark",
    isClearable: false,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ScarlettWeaknessTurns": {
    key: "p1ScarlettWeaknessTurns",
    name: "斯嘉麗弱點",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ScarlettInheritTurns": {
    key: "p1ScarlettInheritTurns",
    name: "斯嘉麗繼承",
    source: "soulmark",
    isClearable: false,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChenxiTrueDmgTurns": {
    key: "p1ChenxiTrueDmgTurns",
    name: "晨曦真傷",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MuguangVampireTurns": {
    key: "p1MuguangVampireTurns",
    name: "暮光吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MuguangLightTurns": {
    key: "p1MuguangLightTurns",
    name: "暮光視為光暗影",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsCoreReconstructTurns": {
    key: "p1MarsCoreReconstructTurns",
    name: "核心重構",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsCoreReconstructPPStealTurns": {
    key: "p1MarsCoreReconstructPPStealTurns",
    name: "核心重構吸PP",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsSourceBarrierTurns": {
    key: "p1MarsSourceBarrierTurns",
    name: "起源屏障",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsSourceBarrierStealTurns": {
    key: "p1MarsSourceBarrierStealTurns",
    name: "起源屏障充能",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsNoWeakTurns": {
    key: "p1MarsNoWeakTurns",
    name: "無微弱",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsImmuneReflectTurns": {
    key: "p1MarsImmuneReflectTurns",
    name: "免疫反彈",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1MarsIgnoreOppPriorityTurns": {
    key: "p1MarsIgnoreOppPriorityTurns",
    name: "無視先制",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhumoArrayTurns": {
    key: "p1ZhumoArrayTurns",
    name: "誅魔陣",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1BahuangLockTurns": {
    key: "p1BahuangLockTurns",
    name: "八荒鎖魂",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1YuyuInspectTurns": {
    key: "p1YuyuInspectTurns",
    name: "虞羽巡視",
    source: "soulmark",
    isClearable: false,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1ZhaogeTurns": {
    key: "p1ZhaogeTurns",
    name: "朝歌",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1WuxuTrueDmgGuardTurns": {
    key: "p1WuxuTrueDmgGuardTurns",
    name: "無序真傷護衛",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuImmortalTurns": {
    key: "p1WuxuImmortalTurns",
    name: "無序不朽",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuImmuneReflectTurns": {
    key: "p1WuxuImmuneReflectTurns",
    name: "無序免疫彈控",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuSealAddTurns": {
    key: "p1WuxuSealAddTurns",
    name: "無序附加失效",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuNoStatusBothTurns": {
    key: "p1WuxuNoStatusBothTurns",
    name: "無序雙方免控",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuHealDmgTurns": {
    key: "p1WuxuHealDmgTurns",
    name: "無序受擊恢復",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuNextPriorityTurns": {
    key: "p1WuxuNextPriorityTurns",
    name: "無序下回先制",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuNoAtkOppTurns": {
    key: "p1WuxuNoAtkOppTurns",
    name: "無序無法攻擊對手",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuShiyanAbsorbTurns": {
    key: "p1WuxuShiyanAbsorbTurns",
    name: "蝕言吸血",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1WuxuShiyanFixedDmgTurns": {
    key: "p1WuxuShiyanFixedDmgTurns",
    name: "蝕言真傷",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ShiyanRandomStatusTurns": {
    key: "p1ShiyanRandomStatusTurns",
    name: "蝕言隨機異常",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ShiyanSealAttrTurns": {
    key: "p1ShiyanSealAttrTurns",
    name: "蝕言屬性封鎖",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhuixingImmuneStatusTurns": {
    key: "p1ZhuixingImmuneStatusTurns",
    name: "追星免疫異常",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiDmgLimit200Turns": {
    key: "p1ZhakesiDmgLimit200Turns",
    name: "札克斯200鎖傷",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiDmgBoost150Turns": {
    key: "p1ZhakesiDmgBoost150Turns",
    name: "札克斯增傷150",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiSelfDmgBoost150Turns": {
    key: "p1ZhakesiSelfDmgBoost150Turns",
    name: "札克斯自身增傷",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiInstaKill15Turns": {
    key: "p1ZhakesiInstaKill15Turns",
    name: "札克斯1.5倍秒殺",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiAbsorb33Turns": {
    key: "p1ZhakesiAbsorb33Turns",
    name: "札克斯1/3吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiNegateAttackTurns": {
    key: "p1ZhakesiNegateAttackTurns",
    name: "札克斯攻擊無效",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiIgnoreDef34Turns": {
    key: "p1ZhakesiIgnoreDef34Turns",
    name: "札克斯無視防禦",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiPriorityPlus3Turns": {
    key: "p1ZhakesiPriorityPlus3Turns",
    name: "札克斯先制+3",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiFrighten25Turns": {
    key: "p1ZhakesiFrighten25Turns",
    name: "札克斯懼怕25",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiShieldMaxTurns": {
    key: "p1ZhakesiShieldMaxTurns",
    name: "札克斯最大護盾",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiNoPropSkillTurns": {
    key: "p1ZhakesiNoPropSkillTurns",
    name: "札克斯屬性封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiAbsorbMaxHpTurns": {
    key: "p1ZhakesiAbsorbMaxHpTurns",
    name: "札克斯最大吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearNoHealAndNoPropAddTurns": {
    key: "p1FearNoHealAndNoPropAddTurns",
    name: "畏懼無法恢復屬性",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearImmuneReflectTurns": {
    key: "p1FearImmuneReflectTurns",
    name: "畏懼免彈傷",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearFrighten3Turns": {
    key: "p1FearFrighten3Turns",
    name: "畏懼隨機懼怕",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearDmgLimit280Turns": {
    key: "p1FearDmgLimit280Turns",
    name: "畏懼280鎖傷",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearAbsorb5Turns": {
    key: "p1FearAbsorb5Turns",
    name: "畏懼5回合吸血",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearNoSwitch2Turns": {
    key: "p1FearNoSwitch2Turns",
    name: "畏懼無法切換",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeJieranTurns": {
    key: "p1ChaosBlakeJieranTurns",
    name: "桀驁不馴",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeJieranCritHealTurns": {
    key: "p1ChaosBlakeJieranCritHealTurns",
    name: "桀驁暴擊恢復",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeJieranPriorityCritTurns": {
    key: "p1ChaosBlakeJieranPriorityCritTurns",
    name: "桀驁先制暴擊",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeAnyaoyTurns": {
    key: "p1ChaosBlakeAnyaoyTurns",
    name: "暗耀明滅",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeAnyaoyImmuneReflectTurns": {
    key: "p1ChaosBlakeAnyaoyImmuneReflectTurns",
    name: "暗耀免疫彈傷",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ChaosBlakeNoDamageTurns": {
    key: "p1ChaosBlakeNoDamageTurns",
    name: "無法造成傷害",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1NoSwitchTurns": {
    key: "p1NoSwitchTurns",
    name: "無法主動切換",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1NingzhiTurns": {
    key: "p1NingzhiTurns",
    name: "凝滯",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1OppAttributeFailChanceTurns": {
    key: "p1OppAttributeFailChanceTurns",
    name: "屬性失敗機率",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelienteDoubleEffectTurns": {
    key: "p1BelienteDoubleEffectTurns",
    name: "貝連特雙倍效果",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelienteOrbitTurns": {
    key: "p1BelienteOrbitTurns",
    name: "貝連特星軌",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelienteRegenTurns": {
    key: "p1BelienteRegenTurns",
    name: "貝連特回血",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelienteBuffLockTurns": {
    key: "p1BelienteBuffLockTurns",
    name: "星河守護",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelientePriorityTurns": {
    key: "p1BelientePriorityTurns",
    name: "星河之速",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BelienteWeakenTurns": {
    key: "p1BelienteWeakenTurns",
    name: "星宿弱化附加",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SealPropertyTurns": {
    key: "p1SealPropertyTurns",
    name: "屬性封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DarkScarTurns": {
    key: "p1DarkScarTurns",
    name: "黯痕",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BajieGuardianTurns": {
    key: "p1BajieGuardianTurns",
    name: "天蓬御守",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1PiteFeatherAuraTurns": {
    key: "p1PiteFeatherAuraTurns",
    name: "迅風羽衣",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DimensionalDmgImmuneTurns": {
    key: "p1DimensionalDmgImmuneTurns",
    name: "次元傷害免疫",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1ImmuneStatusTurns": {
    key: "p1ImmuneStatusTurns",
    name: "免疫異常狀態",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ImmuneStatDebuffTurns": {
    key: "p1ImmuneStatDebuffTurns",
    name: "免疫能力下降",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1ZhakesiReflectCritTurns": {
    key: "p1ZhakesiReflectCritTurns",
    name: "札克斯反彈暴擊",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HealToShieldTurns": {
    key: "p1HealToShieldTurns",
    name: "護盾轉化",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HealTurns": {
    key: "p1HealTurns",
    name: "體力恢復",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1TrueDamageTurns": {
    key: "p1TrueDamageTurns",
    name: "真實傷害",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1DmgCapTurns": {
    key: "p1DmgCapTurns",
    name: "傷害限制",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1CounterDmgTurns": {
    key: "p1CounterDmgTurns",
    name: "反擊傷害",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1HealToDmgTurns": {
    key: "p1HealToDmgTurns",
    name: "恢復轉傷害",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1AttackParalyzeTurns": {
    key: "p1AttackParalyzeTurns",
    name: "攻擊麻痺",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SurviveTurns": {
    key: "p1SurviveTurns",
    name: "不死效果",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1FearSkillTurns": {
    key: "p1FearSkillTurns",
    name: "技能驚恐",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SealHealTurns": {
    key: "p1SealHealTurns",
    name: "恢復封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1SealAttackTurns": {
    key: "p1SealAttackTurns",
    name: "攻擊封鎖",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1TookDmgBoostTurns": {
    key: "p1TookDmgBoostTurns",
    name: "受傷增幅",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1StatusReflectTurns": {
    key: "p1StatusReflectTurns",
    name: "異常彈回",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1BindTurns": {
    key: "p1BindTurns",
    name: "束縛",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1GuardianMarkTurns": {
    key: "p1GuardianMarkTurns",
    name: "守護印記",
    source: "skill",
    isClearable: true,
    polarity: "NEGATIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1UnclearableImmuneTurns": {
    key: "p1UnclearableImmuneTurns",
    name: "無法消除免控",
    source: "soulmark",
    isClearable: false,
    polarity: "NEGATIVE",
    tickOnActionEnd: true,
    tickOnRoundEnd: false
  },
  "p1CanglanDmgHalfTurns": {
    key: "p1CanglanDmgHalfTurns",
    name: "瀾禦",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1CanglanPriorityTurns": {
    key: "p1CanglanPriorityTurns",
    name: "技能先制",
    source: "skill",
    isClearable: true,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1CanglanDmgBoostTurns": {
    key: "p1CanglanDmgBoostTurns",
    name: "傷害增強",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: true
  },
  "p1CanglanImmuneReflectStatusTurns": {
    key: "p1CanglanImmuneReflectStatusTurns",
    name: "免疫反彈異常",
    source: "soulmark",
    isClearable: false,
    polarity: "POSITIVE",
    tickOnActionEnd: false,
    tickOnRoundEnd: false
  },
  "p1CanglanWater": {
    key: "p1CanglanWater",
    name: "永恆之水",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: false
  },
  "p1CanglanTear": {
    key: "p1CanglanTear",
    name: "千秋一淚",
    source: "skill",
    isClearable: true,
    polarity: "NEUTRAL",
    tickOnActionEnd: false,
    tickOnRoundEnd: false
  }
};

export const getEffectMetadata = (key: string): UnifiedTurnEffect | undefined => {
  return TURN_EFFECT_REGISTRY[key];
};
