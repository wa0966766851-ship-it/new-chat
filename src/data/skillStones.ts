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
/** 可裝備的等級；SS僅是投石者出招時的轉化，不是背包装備項目。 */
export const EQUIPPABLE_STONE_GRADES: SkillStoneGrade[] = ['D', 'C', 'B', 'A', 'S'];

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
  { id: 'attr_normal_double', name: '普之爆發', description: '5%機率攻擊傷害翻倍', chance: 5, type: 'special', detail: 'double_power', targetAttribute: '普通' },
  { id: 'attr_ice_frost', name: '冰之極寒', description: '15%機率令對手凍傷', chance: 15, type: 'status', detail: 'frostbite:2', targetAttribute: '冰' },
  { id: 'attr_psychic_conf', name: '超之幻象', description: '15%機率令對手混亂', chance: 15, type: 'status', detail: 'confused:2', targetAttribute: '超能' },
  { id: 'attr_fight_crit', name: '戰之鬥氣', description: '使用後1回合致命一擊機率增加1/16', chance: 100, type: 'special', detail: 'next_crit_up', targetAttribute: '戰鬥' },
  { id: 'attr_light_sleep', name: '光之催眠', description: '10%機率令對手睡眠', chance: 10, type: 'status', detail: 'sleep:2', targetAttribute: '光' },
  { id: 'attr_shadow_fear', name: '暗之恐懼', description: '10%機率令對手害怕', chance: 10, type: 'status', detail: 'feared:2', targetAttribute: '暗影' },
  { id: 'attr_mystery_fatigue', name: '秘之困頓', description: '10%機率令對方疲憊', chance: 10, type: 'status', detail: 'fatigued:2', targetAttribute: '神秘' },
  { id: 'attr_dragon_dmg', name: '龍之威壓', description: '5%機率附加200點固定傷害', chance: 5, type: 'special', detail: 'add_damage_200', targetAttribute: '龍' },
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
  customEffectId?: string,
  ruleset: 'standard' | 'project' = 'standard'
): Skill {
  if (!SKILL_STONE_ATTRIBUTES.includes(type) || !SKILL_STONE_GRADES[grade]) throw new Error('技能石屬性或等級無效');
  const gradeDef = SKILL_STONE_GRADES[grade];
  let perfectEffect: SkillStoneEffectDef | undefined;

  if (isPerfect) {
    if (customEffectId) {
      perfectEffect = getPerfectEffectsForAttribute(type).find(e => e.id === customEffectId);
      if (!perfectEffect) throw new Error('該效果不適用此屬性技能石');
    }
    if (!perfectEffect) {
      const available = getPerfectEffectsForAttribute(type);
      perfectEffect = available[0] || PERFECT_SKILL_STONE_EFFECTS[0];
    }
  }

  const baseDesc = `造成${category}攻擊傷害`;
  const fullDesc = isPerfect && perfectEffect ? `${baseDesc}；${stoneEffectDescription(perfectEffect, ruleset)}` : baseDesc;

  return {
    name: `${type}石之力-${grade}`,
    type: type,
    category: category,
    power: grade === 'SS' ? 240 : gradeDef.power,
    pp: gradeDef.pp,
    maxPp: gradeDef.pp,
    accuracy: 100,
    isSureHit: false,
    description: fullDesc,
    priority: 0,
    effectType: isPerfect ? 'skill_stone_perfect' : 'skill_stone',
    effectDetail: isPerfect && perfectEffect ? perfectEffect.id : '',
    isSkillStone: true,
    skillStoneRuleset: ruleset,
    skillStoneGrade: grade,
    isPerfectSkillStone: isPerfect,
    skillStoneEffect: isPerfect && perfectEffect ? perfectEffect.id : undefined,
  };
}

/** 投石者使用技能石時轉化為同屬系 SS 級（威力 240、機率 100%）；PP 仍由原技能石扣除 */
export function toSSStone(skill: Skill, ssText?: Record<string, string>): Skill {
  if (!isSkillStone(skill) || skill.skillStoneGrade === "SS") return skill;
  const name = skill.name.replace(/-[A-Z]+$/, "") + "-SS";
  // 保留玩家選定的效果；普通石不憑空新增效果。SS 的 PP 從原級技能扣除。
  const desc = (skill.description || "").replace(/\d+%機率/g, "100%機率").replace(/（[^）]*投石者[^）]*）/g, "");
  return { ...skill, name, power: 240, skillStoneOriginalGrade: stoneGrade(skill), maxPp: stoneBasePp(skill), skillStoneGrade: "SS", description: desc };
}

export function isSkillStone(skill?: Skill): boolean {
  return !!skill && (skill.isSkillStone === true || skill.skillStoneGrade !== undefined || /石之力-(?:SS|S|A|B|C|D)$/.test(skill.name));
}

/** 普通招式沿用名稱；技能石同名但物特、普通／完美、特效及規則不同，不能合併。 */
export function skillConfigurationKey(skill: Skill): string {
  if (!isSkillStone(skill)) return skill.name;
  return JSON.stringify([skill.name, skill.type, skill.category, stoneGrade(skill),
    !!skill.isPerfectSkillStone, skill.isPerfectSkillStone ? skill.skillStoneEffect || skill.effectDetail || '' : '',
    skill.skillStoneRuleset || 'standard']);
}

export function stoneGrade(skill: Skill): SkillStoneGrade {
  return skill.skillStoneOriginalGrade || skill.skillStoneGrade || (skill.name.match(/-(SS|S|A|B|C|D)$/)?.[1] as SkillStoneGrade) || 'S';
}

/** 原級 PP 只存一次；舊 S 石的 12/22/99 不再被當成基礎上限。 */
export function stoneBasePp(skill: Skill): number {
  return SKILL_STONE_GRADES[stoneGrade(skill)].pp;
}

export function stoneIconUrl(attr: string, grade: SkillStoneGrade): string | undefined {
  const typeIndex = SKILL_STONE_ATTRIBUTES.indexOf(attr), gradeIndex = ['D', 'C', 'B', 'A', 'S'].indexOf(grade);
  return typeIndex < 0 || gradeIndex < 0 ? undefined : `/seer/skill-stones/${1100001 + typeIndex * 5 + gradeIndex}.png`;
}

export function distinctStoneCount(elf: Elf): number {
  return new Set(elf.skills.slice(0, 4).filter(isSkillStone).map(s => s.type)).size;
}

export function stoneEffect(skill?: Skill): SkillStoneEffectDef | undefined {
  if (!isSkillStone(skill) || !skill?.isPerfectSkillStone) return undefined;
  return getPerfectEffectsForAttribute(skill.type).find(e => e.id === (skill.skillStoneEffect || skill.effectDetail));
}

export function stoneEffectDescription(effect: SkillStoneEffectDef, ruleset: 'standard' | 'project'): string {
  if (ruleset === 'project' && effect.id === 'attr_dragon_dmg') return '使用時5%機率附加200點真實傷害';
  if (ruleset === 'project' && effect.id === 'attr_normal_double') return '使用時5%機率威力翻倍';
  const duration = effect.type === 'status' ? (ruleset === 'standard' && !effect.detail.startsWith('fatigued') ? 3 : Number(effect.detail.split(':')[1])) : undefined;
  return (effect.type === 'status' || effect.id === 'attr_dragon_dmg' ? '命中後' : '技能使用成功時') + effect.description + (duration ? `（${duration}回合）` : '');
}

/** 不破壞其他槽位：有衝突時拒絕；更換前把舊技能留在技能池。 */
export function equipSkillStone(elf: Elf, stone: Skill, slot: number): { skills: Skill[]; skillPool: Skill[] } {
  if (!Number.isInteger(slot) || slot < 0 || slot > 3 || slot > elf.skills.length || elf.skills[slot]?.isFifthSkill) throw new Error('只能替換常規技能槽，不能覆蓋第五技能');
  if (!isSkillStone(stone) || stone.skillStoneGrade === 'SS') throw new Error('SS 石僅在戰鬥中由投石者轉化');
  const others = elf.skills.filter((s, i) => i !== slot && isSkillStone(s));
  if (!isStoneThrower(elf) && others.length) throw new Error('常規精靈最多一顆技能石；請選擇原技能石槽位更換');
  if (others.some(s => s.type === stone.type)) throw new Error('投石者不能裝備重複屬性的技能石');
  const skills = [...elf.skills], skillPool = [...(elf.skillPool || [])];
  const old = skills[slot];
  if (old && !skillPool.some(s => skillConfigurationKey(s) === skillConfigurationKey(old))) skillPool.push(old);
  skills[slot] = stone;
  validateSkillStoneLoadout(elf, skills);
  return { skills, skillPool };
}

/** 生成入口及預備池替換入口共用，避免從技能池繞過限制。 */
export function validateSkillStoneLoadout(elf: Pick<Elf, 'id' | 'name' | 'alienTraits' | 'soulMark' | 'trait_stone_thrower'>, skills: Skill[]): void {
  const stones = skills.filter(isSkillStone);
  if (skills.some((s, i) => isSkillStone(s) && (i >= 4 || s.isFifthSkill))) throw new Error('技能石只能佔前四個普通技能槽');
  // 裝備等級不能拿戰鬥轉化的 originalGrade 當作兜底，否則SS會被誤放行。
  if (stones.some(s => !EQUIPPABLE_STONE_GRADES.includes(s.skillStoneGrade || (s.name.match(/-(SS|S|A|B|C|D)$/)?.[1] as SkillStoneGrade) || 'S'))) throw new Error('最高只能裝備S級技能石；SS由投石者戰鬥時轉化');
  if (stones.some(s => !SKILL_STONE_ATTRIBUTES.includes(s.type) || !['物理', '特殊'].includes(s.category))) throw new Error('技能石必須為有效單屬性的物理或特殊技能');
  if (stones.some(s => s.isPerfectSkillStone && !stoneEffect(s))) throw new Error('完美技能石缺少該屬性的合法效果');
  if (!isStoneThrower(elf as Elf) && stones.length > 1) throw new Error('一般精靈最多裝備一個技能石；請替換原技能石槽位');
  if (isStoneThrower(elf as Elf) && new Set(stones.map(s => s.type)).size !== stones.length) throw new Error('投石者不能裝備重複屬性的技能石');
}

export function isStoneThrower(elf?: Elf): boolean {
  if (!elf) return false;
  const nameMatch = elf.name === "無序.墜星" || elf.name === "無序·墜星" || elf.id === "wuxu_zhuixing";
  const traitMatch = elf.alienTraits?.gen2Trait?.name?.includes("投石者") || Boolean(elf.trait_stone_thrower) || false;
  // 無序星魂使徒是三隻共用特質，不代表三隻都是投石者。
  const soulMatch = Boolean(elf.soulMark?.trait_stone_thrower);
  return nameMatch || traitMatch || soulMatch;
}

export function hasStoneThrowerMythic(elf?: Elf, mode: 'PVP' | 'PVE' = 'PVE'): boolean {
  if (!elf) return false;
  if (!isStoneThrower(elf)) return false;
  return distinctStoneCount(elf) >= 4;
}
