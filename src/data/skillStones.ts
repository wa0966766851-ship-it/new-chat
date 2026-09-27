import { Skill, Elf } from "../types";

export const SKILL_STONE_ATTRIBUTES = [
  "草", "水", "火", "飛行", "電", "機械", "地面", "普通", "冰", "超能", 
  "戰鬥", "光", "暗影", "神秘", "龍", "聖靈", "次元", "遠古", "邪靈", "自然", "蟲"
];

export const SKILL_STONE_GRADES = {
  'D': { power: 40, pp: 30, label: 'D級技能石' },
  'C': { power: 60, pp: 25, label: 'C級技能石' },
  'B': { power: 90, pp: 15, label: 'B級技能石' },
  'A': { power: 120, pp: 5, label: 'A級技能石' },
  'S': { power: 160, pp: 2, label: 'S級技能石' },
  'SS': { power: 240, pp: 1, label: 'SS級技能石 (投石者轉化)' },
};

export type SkillStoneGrade = keyof typeof SKILL_STONE_GRADES;

export interface SkillStoneEffectDef {
  id: string;
  name: string;
  description: string;
  chance: number; // e.g. 15 for 15%
  type: 'stat_up' | 'stat_down' | 'status' | 'special';
  detail: string; // e.g. "atk+1", "poisoned:2", etc.
  targetAttribute?: string; // If set, characteristic effect of this attribute
}

export const PERFECT_SKILL_STONE_EFFECTS: SkillStoneEffectDef[] = [
  // General Stat Boosting Effects (any attribute)
  { id: 'gen_atk_up', name: '攻擊提升', description: '15%機率自身攻擊屬性+1', chance: 15, type: 'stat_up', detail: 'atk+1' },
  { id: 'gen_spatk_up', name: '特攻提升', description: '15%機率自身特攻屬性+1', chance: 15, type: 'stat_up', detail: 'spatk+1' },
  { id: 'gen_def_up', name: '防禦提升', description: '15%機率自身防禦屬性+1', chance: 15, type: 'stat_up', detail: 'def+1' },
  { id: 'gen_spdef_up', name: '特防提升', description: '15%機率自身特防屬性+1', chance: 15, type: 'stat_up', detail: 'spdef+1' },
  { id: 'gen_speed_up', name: '速度提升', description: '15%機率自身速度屬性+1', chance: 15, type: 'stat_up', detail: 'speed+1' },
  { id: 'gen_acc_up', name: '命中提升', description: '15%機率自身命中屬性+1', chance: 15, type: 'stat_up', detail: 'accuracy+1' },

  // Attribute Characteristic Effects
  { id: 'attr_grass_poison', name: '草之毒蝕', description: '15%機率令對手中毒', chance: 15, type: 'status', detail: 'poisoned:2', targetAttribute: '草' },
  { id: 'attr_water_frost', name: '水之寒霜', description: '15%機率令對手凍傷', chance: 15, type: 'status', detail: 'frostbite:2', targetAttribute: '水' },
  { id: 'attr_fire_burn', name: '火之烈焰', description: '15%機率令對手燒傷', chance: 15, type: 'status', detail: 'burned:2', targetAttribute: '火' },
  { id: 'attr_flying_speed', name: '飛之氣流', description: '15%機率令對手速度屬性-1', chance: 15, type: 'stat_down', detail: 'speed-1', targetAttribute: '飛行' },
  { id: 'attr_electric_para', name: '電之驚雷', description: '10%機率令對手麻痹', chance: 10, type: 'status', detail: 'paralyzed:2', targetAttribute: '電' },
  { id: 'attr_mech_def', name: '機之破甲', description: '15%機率令對手雙防-1', chance: 15, type: 'stat_down', detail: 'def-1,spdef-1', targetAttribute: '機械' },
  { id: 'attr_ground_acc', name: '地之塵沙', description: '15%機率令對手命中-1', chance: 15, type: 'stat_down', detail: 'accuracy-1', targetAttribute: '地面' },
  { id: 'attr_normal_double', name: '普之爆發', description: '5%機率威力翻倍', chance: 5, type: 'special', detail: 'double_power', targetAttribute: '普通' },
  { id: 'attr_ice_frost', name: '冰之極寒', description: '15%機率令對手凍傷', chance: 15, type: 'status', detail: 'frostbite:2', targetAttribute: '冰' },
  { id: 'attr_psychic_conf', name: '超之幻象', description: '15%機率令對手混亂', chance: 15, type: 'status', detail: 'confused:2', targetAttribute: '超能' },
  { id: 'attr_fight_crit', name: '戰之鬥氣', description: '100%機率下回合致命一擊提升', chance: 100, type: 'special', detail: 'next_crit_up', targetAttribute: '戰鬥' },
  { id: 'attr_light_sleep', name: '光之催眠', description: '10%機率令對手睡眠', chance: 10, type: 'status', detail: 'sleep:2', targetAttribute: '光' },
  { id: 'attr_shadow_fear', name: '暗之恐懼', description: '10%機率令對手害怕', chance: 10, type: 'status', detail: 'feared:2', targetAttribute: '暗影' },
  { id: 'attr_mystery_fatigue', name: '秘之困頓', description: '10%機率令對方疲憊', chance: 10, type: 'status', detail: 'fatigued:2', targetAttribute: '神秘' },
  { id: 'attr_dragon_dmg', name: '龍之威壓', description: '5%機率附加200點真實傷害', chance: 5, type: 'special', detail: 'add_damage_200', targetAttribute: '龍' },
  { id: 'attr_holy_half', name: '聖之庇護', description: '10%機率一回合受到傷害減半', chance: 10, type: 'special', detail: 'half_damage_1turn', targetAttribute: '聖靈' },
  { id: 'attr_dim_para', name: '次之時空', description: '10%機率令對手癱瘓', chance: 10, type: 'status', detail: 'paralyzed_lock:2', targetAttribute: '次元' },
  { id: 'attr_ancient_bleed', name: '古之撕裂', description: '10%機率令對手流血', chance: 10, type: 'status', detail: 'bleeding:2', targetAttribute: '遠古' },
  { id: 'attr_evil_prio', name: '邪之詭速', description: '10%機率先制+1', chance: 10, type: 'special', detail: 'priority_plus_1', targetAttribute: '邪靈' },
  { id: 'attr_nature_pp', name: '自之生息', description: '10%機率恢復自己所有技能PP值1點', chance: 10, type: 'special', detail: 'restore_all_pp_1', targetAttribute: '自然' },
  { id: 'attr_bug_pp', name: '蟲之噬靈', description: '10%機率降低對手所有技能PP值1點，若因此對手PP值歸0則對手當回合無法行動', chance: 10, type: 'special', detail: 'reduce_opp_pp_1', targetAttribute: '蟲' }
];

export function getPerfectEffectsForAttribute(attr: string): SkillStoneEffectDef[] {
  return PERFECT_SKILL_STONE_EFFECTS.filter(e => !e.targetAttribute || e.targetAttribute === attr);
}

export function createSkillStone(
  type: string, 
  grade: SkillStoneGrade, 
  category: '物理' | '特殊' = '物理', 
  isPerfect: boolean = false,
  customEffectId?: string
): Skill {
  const gradeDef = SKILL_STONE_GRADES[grade] || SKILL_STONE_GRADES['S'];
  let perfectEffect: SkillStoneEffectDef | undefined;

  if (isPerfect) {
    if (customEffectId) {
      perfectEffect = PERFECT_SKILL_STONE_EFFECTS.find(e => e.id === customEffectId);
    }
    if (!perfectEffect) {
      const available = getPerfectEffectsForAttribute(type);
      perfectEffect = available[0] || PERFECT_SKILL_STONE_EFFECTS[0];
    }
  }

  const baseDesc = `造成${category}攻擊傷害`;
  const fullDesc = isPerfect && perfectEffect ? `${baseDesc}；使用時${perfectEffect.description}` : baseDesc;

  return {
    name: `${type}石之力-${grade}`,
    type: type,
    category: category,
    power: grade === 'SS' ? 240 : gradeDef.power,
    pp: gradeDef.pp,
    accuracy: 100,
    isSureHit: false,
    description: fullDesc,
    priority: 0,
    effectType: isPerfect ? 'skill_stone_perfect' : 'skill_stone',
    effectDetail: isPerfect && perfectEffect ? perfectEffect.id : '',
    isSkillStone: true,
    skillStoneGrade: grade,
    isPerfectSkillStone: isPerfect,
    skillStoneEffect: isPerfect && perfectEffect ? perfectEffect.id : undefined,
  };
}

/** 投石者使用技能石時轉化為同屬系 SS 級（威力 240、機率 100%）；PP 仍由原技能石扣除 */
export function toSSStone(skill: Skill, ssText?: Record<string, string>): Skill {
  if (!skill?.isSkillStone || skill.skillStoneGrade === "SS") return skill;
  const name = skill.name.replace(/-[A-Z]+$/, "") + "-SS";
  const desc = ssText?.[name] || (skill.description || "").replace(/\d+%機率/g, "100%機率").replace(/（[^）]*投石者[^）]*）/g, "");
  return { ...skill, name, power: 240, skillStoneGrade: "SS", description: desc };
}

export function isStoneThrower(elf?: Elf): boolean {
  if (!elf) return false;
  const nameMatch = elf.name === "無序.墜星" || elf.name === "無序·墜星" || elf.id === "wuxu_zhuixing";
  const traitMatch = elf.alienTraits?.gen2Trait?.name?.includes("投石者") || Boolean(elf.trait_stone_thrower) || false;
  const soulMatch = Boolean(elf.soulMark?.trait_wuxu_apostle || elf.soulMark?.trait_stone_thrower || elf.soulMark?.name === "無序星魂使徒");
  return nameMatch || traitMatch || soulMatch;
}

export function hasStoneThrowerMythic(elf?: Elf, mode: 'PVP' | 'PVE' = 'PVE'): boolean {
  if (!elf) return false;
  if (!isStoneThrower(elf)) return false;
  const stoneCount = (elf.skills || []).filter(s => s.isSkillStone).length;
  return stoneCount >= 4;
}
