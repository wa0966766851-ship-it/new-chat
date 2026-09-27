import { BattleEffect, EffectSubCategory } from './types';

// 效果庫：在這裡集中定義所有標準化的效果行為
export const EffectCatalog: Record<string, BattleEffect> = {
  // === 恢復類 ===
  HEAL_15_PERCENT: { id: 'HEAL_15_PERCENT', name: '基礎回血15%', type: 'HEAL', value: 15 },
  HEAL_30_PERCENT: { id: 'HEAL_30_PERCENT', name: '強力回血30%', type: 'HEAL', value: 30 },
  
  // === 傷害類 ===
  TRUE_DAMAGE_80: { id: 'TRUE_DAMAGE_80', name: '真實傷害80', type: 'TRUE_DAMAGE', value: 80 },
  TRUE_DAMAGE_100: { id: 'TRUE_DAMAGE_100', name: '真實傷害100', type: 'TRUE_DAMAGE', value: 100 },
  
  // === 狀態類 ===
  STATUS_BURN: { id: 'STATUS_BURN', name: '附加燒傷', type: 'STATUS_APPLY', value: '燒傷' },
  STATUS_FREEZE: { id: 'STATUS_FREEZE', name: '附加凍傷', type: 'STATUS_APPLY', value: '凍傷' },
  STATUS_POISON: { id: 'STATUS_POISON', name: '附加中毒', type: 'STATUS_APPLY', value: '中毒' },
  
  // === 能力提升類 ===
  STAT_ATK_UP_1: { id: 'STAT_ATK_UP_1', name: '攻擊+1', type: 'STAT_CHANGE', value: 'ATK_UP_1' },
  STAT_DEF_UP_1: { id: 'STAT_DEF_UP_1', name: '防禦+1', type: 'STAT_CHANGE', value: 'DEF_UP_1' },
  STAT_SPEED_UP_1: { id: 'STAT_SPEED_UP_1', name: '速度+1', type: 'STAT_CHANGE', value: 'SPEED_UP_1' },
  
  // === 特殊效果 ===
  DMG_AMP_50: { id: 'DMG_AMP_50', name: '傷害提升50%', type: 'DAMAGE_AMP', value: 0.5 },

  // === 增傷分類庫 (Damage Amplification Catalog) ===
  // 第 1 類增傷 (攻擊傷害)：同源加算，不同源乘算；魔軀枷鎖為獨立乘算
  DMG_TYPE1_SUIT_BASE: { id: 'DMG_TYPE1_SUIT_BASE', name: '第1類增傷：套裝基礎攻擊加成', type: 'DAMAGE_AMP', value: 0.0, category: 'FIXED' },
  DMG_TYPE1_SUIT_DARK_ANGEL: { id: 'DMG_TYPE1_SUIT_DARK_ANGEL', name: '第1類增傷：漆黑天使/皇帝戰鎧攻擊增幅', type: 'DAMAGE_AMP', value: 0.40, category: 'FIXED' },
  DMG_TYPE1_SUIT_SILVER_KNIGHT: { id: 'DMG_TYPE1_SUIT_SILVER_KNIGHT', name: '第1類增傷：銀翼騎士基礎攻擊增幅', type: 'DAMAGE_AMP', value: 0.30, category: 'FIXED' },
  DMG_TYPE1_SUIT_SILVER_KNIGHT_FIRST: { id: 'DMG_TYPE1_SUIT_SILVER_KNIGHT_FIRST', name: '第1類增傷：銀翼騎士先出手額外增幅', type: 'DAMAGE_AMP', value: 0.30, category: 'FIXED' },
  DMG_TYPE1_SUIT_MORNING_STAR: { id: 'DMG_TYPE1_SUIT_MORNING_STAR', name: '第1類增傷：晨曦之星攻擊增幅', type: 'DAMAGE_AMP', value: 0.10, category: 'FIXED' }, // 體力高於1/2效果翻倍 (0.20)
  DMG_TYPE1_SUIT_VENOM_ARMOR: { id: 'DMG_TYPE1_SUIT_VENOM_ARMOR', name: '第1類增傷：毒液戰甲當回合攻擊增幅', type: 'DAMAGE_AMP', value: 0.30, category: 'FIXED' },
  DMG_TYPE1_SUIT_SHADOW_JUDGMENT: { id: 'DMG_TYPE1_SUIT_SHADOW_JUDGMENT', name: '第1類增傷：影翼裁決基礎攻擊增幅', type: 'DAMAGE_AMP', value: 0.40, category: 'FIXED' },
  DMG_TYPE1_SUIT_SHADOW_SHIELD: { id: 'DMG_TYPE1_SUIT_SHADOW_SHIELD', name: '第1類增傷：影翼裁決每50點護罩額外增幅', type: 'DAMAGE_AMP', value: 0.10, category: 'FIXED' },
  DMG_TYPE1_SUIT_DESTINY_PER_STACK: { id: 'DMG_TYPE1_SUIT_DESTINY_PER_STACK', name: '第1類增傷：勝天之命每層勝天之力增幅', type: 'DAMAGE_AMP', value: 0.04, category: 'FIXED' },
  DMG_TYPE1_SUIT_FATE_DEFIER_STACK: { id: 'DMG_TYPE1_SUIT_FATE_DEFIER_STACK', name: '第1類增傷：逆命者戰甲每層攻擊額外增幅', type: 'DAMAGE_AMP', value: 0.10, category: 'FIXED' },
  DMG_TYPE1_SUIT_IMPERIAL_NEXT: { id: 'DMG_TYPE1_SUIT_IMPERIAL_NEXT', name: '第1類增傷：皇御神臨下1次攻擊增幅', type: 'DAMAGE_AMP', value: 0.40, category: 'FIXED' },
  DMG_TYPE1_TITLE_LINGLONG: { id: 'DMG_TYPE1_TITLE_LINGLONG', name: '第1類增傷：玲瓏稱號通用攻擊增幅（可與其他來源加算）', type: 'DAMAGE_AMP', value: 0.5, category: 'FIXED' },
  DMG_TYPE1_STATUS_STAR_BLESS: { id: 'DMG_TYPE1_STATUS_STAR_BLESS', name: '第1類增傷：星賜異常狀態增幅', type: 'DAMAGE_AMP', value: 0.3, category: 'FIXED' },
  DMG_TYPE1_STATUS_FURIOUS: { id: 'DMG_TYPE1_STATUS_FURIOUS', name: '第1類增傷：狂暴狀態增幅', type: 'DAMAGE_AMP', value: 1.0, category: 'FIXED' },
  DMG_TYPE1_DEMON_SHACKLES: { id: 'DMG_TYPE1_DEMON_SHACKLES', name: '第1類增傷：魔軀枷鎖每層獨立乘算', type: 'DAMAGE_AMP', value: 2.0, category: 'FIXED' }, // 描述為每層獨立乘算 (1 + 2.0 = 3倍/層)

  // 第 2 類增傷 (固定傷害與百分比傷害提升)
  DMG_TYPE2_FIXED_PERCENT_BOOST: { id: 'DMG_TYPE2_FIXED_PERCENT_BOOST', name: '第2類增傷：固定/百分比傷害提升30%', type: 'DAMAGE_AMP', value: 0.3, category: 'FIXED' },

  // 第 3 類增傷 (回合內技能傷害提升 / 條件式異常翻倍)
  DMG_TYPE3_SKILL_BOOST_50: { id: 'DMG_TYPE3_SKILL_BOOST_50', name: '第3類增傷：3回合內技能傷害提升50%', type: 'DAMAGE_AMP', value: 0.5, duration: 3, category: 'FIXED' },
  DMG_TYPE3_CONDITIONAL_DOUBLE: { id: 'DMG_TYPE3_CONDITIONAL_DOUBLE', name: '第3類增傷：異常條件式效果翻倍詞條', type: 'DAMAGE_AMP', value: 1.0, duration: 3, category: 'FIXED' },

  // === 減傷分類庫 (Damage Reduction Catalog) ===
  // 通用減傷 1 (攻擊傷害)：同源加算(例如套裝)，晨曦套裝是在目前最高減傷基礎上直接加算(減少10%/20%)；不同源互相乘算；最高為100%
  RED_TYPE1_SUIT_MORNING_STAR: { id: 'RED_TYPE1_SUIT_MORNING_STAR', name: '通用減傷1：晨曦之星攻擊減傷', type: 'DAMAGE_REDUCTION', value: 0.10, category: 'ATTACK' }, // 體力低於1/2時為20% (0.20)
  RED_TYPE1_SUIT_BERSERKER: { id: 'RED_TYPE1_SUIT_BERSERKER', name: '通用減傷1：狂戰士攻擊減傷', type: 'DAMAGE_REDUCTION', value: 0.15, category: 'ATTACK' }, // 狂暴時為30% (0.30)
  RED_TYPE1_SUIT_DESTINY: { id: 'RED_TYPE1_SUIT_DESTINY', name: '通用減傷1：天命每層減傷', type: 'DAMAGE_REDUCTION', value: 0.02, category: 'ATTACK' },
  RED_TYPE1_SOUL_FANG: { id: 'RED_TYPE1_SOUL_FANG', name: '通用減傷1：星光·麗莎布布魂印/星芳之纏', type: 'DAMAGE_REDUCTION', value: 0.50, category: 'ATTACK' },
  RED_TYPE1_HALF_DMG: { id: 'RED_TYPE1_HALF_DMG', name: '通用減傷1：傷害減半狀態', type: 'DAMAGE_REDUCTION', value: 0.50, category: 'ATTACK' },

  // 通用減傷 2 (固定傷害、百分比傷害)：同源加算，異源乘算，上限100%
  RED_TYPE2_SUIT_BERSERKER: { id: 'RED_TYPE2_SUIT_BERSERKER', name: '通用減傷2：狂戰士固定與百分比減傷', type: 'DAMAGE_REDUCTION', value: 0.15, category: 'FIXED_PERCENT' },
  RED_TYPE2_SUIT_DESTINY: { id: 'RED_TYPE2_SUIT_DESTINY', name: '通用減傷2：天命每層固定與百分比減傷', type: 'DAMAGE_REDUCTION', value: 0.02, category: 'FIXED_PERCENT' },
  RED_TYPE2_SUIT_SHADOW: { id: 'RED_TYPE2_SUIT_SHADOW', name: '通用減傷2：影翼裁決固定與百分比減傷基礎', type: 'DAMAGE_REDUCTION', value: 0.05, category: 'FIXED_PERCENT' },
  RED_TYPE2_STATUS_STAR_SUB: { id: 'RED_TYPE2_STATUS_STAR_SUB', name: '通用減傷2：星附屬狀態固定與百分比減傷', type: 'DAMAGE_REDUCTION', value: 0.30, category: 'FIXED_PERCENT' },
  RED_TYPE2_SOUL_REQUIEM: { id: 'RED_TYPE2_SOUL_REQUIEM', name: '通用減傷2：鎮魂歌/混亂窒息減免', type: 'DAMAGE_REDUCTION', value: 0.40, category: 'FIXED_PERCENT' },

  // 通用減傷 3 (技能傷害 - 包含攻擊傷害)：同源加算，異源乘算，上限100%
  RED_TYPE3_SKILL_CURSE: { id: 'RED_TYPE3_SKILL_CURSE', name: '通用減傷3：附屬詛咒/標記技能減傷', type: 'DAMAGE_REDUCTION', value: 0.30, category: 'SKILL' },

  // === 套裝與裝扮專屬特殊詞條庫 (Equipment & Suit Special Catalog) ===
  SHIELD_SUIT_DARK_ANGEL_BASE: { id: 'SHIELD_SUIT_DARK_ANGEL_BASE', name: '套裝護盾：漆黑天使首發精靈基礎護盾', type: 'HEAL', value: 300, category: 'FIXED' },
  FIXED_DMG_SUIT_MORNING_STAR: { id: 'FIXED_DMG_SUIT_MORNING_STAR', name: '套裝固傷：晨曦之星攻擊後附加固定傷害', type: 'FIXED_DAMAGE', value: 100, category: 'FIXED' },
  HEAL_SUIT_MORNING_STAR: { id: 'HEAL_SUIT_MORNING_STAR', name: '套裝恢復：晨曦之星受擊後恢復體力', type: 'HEAL', value: 100, category: 'FIXED' },
  TRUE_DMG_SUIT_ETERNAL_STARLIGHT: { id: 'TRUE_DMG_SUIT_ETERNAL_STARLIGHT', name: '套裝真傷：星光永恆下次使用攻擊技能附加真實傷害', type: 'TRUE_DAMAGE', value: 111, category: 'FIXED' },
  TRUE_DMG_SUIT_BERSERKER: { id: 'TRUE_DMG_SUIT_BERSERKER', name: '套裝真傷：狂暴者本次攻擊附加真實傷害', type: 'TRUE_DAMAGE', value: 115, category: 'FIXED' },
  TRUE_DMG_SUIT_FATE_DEFIER_STACK: { id: 'TRUE_DMG_SUIT_FATE_DEFIER_STACK', name: '套裝真傷：逆命者戰甲每次使用技能附加真實傷害', type: 'TRUE_DAMAGE', value: 10, category: 'FIXED' },
  PERCENT_DMG_SUIT_VENOM_ARMOR: { id: 'PERCENT_DMG_SUIT_VENOM_ARMOR', name: '套裝百分比：毒液戰甲附加對手最大體力百分比傷害', type: 'TRUE_DAMAGE', value: 0.15, category: 'FIXED' },
  PERCENT_DMG_SUIT_CORRUPTER: { id: 'PERCENT_DMG_SUIT_CORRUPTER', name: '套裝百分比：腐蝕者附加對手最大體力百分比傷害', type: 'TRUE_DAMAGE', value: 0.1667, category: 'FIXED' },
  PERCENT_DMG_SUIT_DESTINY: { id: 'PERCENT_DMG_SUIT_DESTINY', name: '套裝百分比：勝天之命每層附加百分比傷害', type: 'TRUE_DAMAGE', value: 0.04, category: 'FIXED' },
  PERCENT_DMG_SUIT_IMPERIAL: { id: 'PERCENT_DMG_SUIT_IMPERIAL', name: '套裝百分比：皇御神臨下回合附加最大體力百分比傷害', type: 'TRUE_DAMAGE', value: 0.15, category: 'FIXED' },

  // === 保底傷害庫 (Guaranteed Minimum Damage Catalog) ===
  // 保底傷害無視減傷、增傷、抵擋傷害、是否命中、是否持有無法造成傷害效果(相同來源以提升保底的除外)
  GUARANTEE_STATUS_FEIYONG: { id: 'GUARANTEE_STATUS_FEIYONG', name: '保底傷害：沸湧狀態受擊保底30%/50%', type: 'TRUE_DAMAGE', value: 0.30, category: 'GUARANTEE' }, // 致命一擊時 50% (0.50)
  GUARANTEE_DELU_MAX_HP: { id: 'GUARANTEE_DELU_MAX_HP', name: '保底傷害：魔獅迪露絕境破壞(不小於對手上限)', type: 'TRUE_DAMAGE', value: 1.0, category: 'GUARANTEE' },
  STATUS_DECAY_BOOST: { id: 'STATUS_DECAY_BOOST', name: '腐朽狀態：物理與特殊攻擊技能傷害提升30%', type: 'DAMAGE_AMP', value: 0.30, category: 'SKILL' },
  STATUS_DECAY_BONUS: { id: 'STATUS_DECAY_BONUS', name: '腐朽狀態：物理與特殊攻擊技能額外傷害150點', type: 'FIXED_DAMAGE', value: 150, category: 'SKILL' },

  // === 特殊技能機制類 (Special Skill Mechanics) ===
  IGNORE_PP_LIMIT: { id: 'IGNORE_PP_LIMIT', name: '選擇使用技能時不受PP值限制', type: 'SPECIAL_BUFF', value: 'UNLIMITED_PP' },
};

