import type { Elf, Skill } from '../types';
import type { KitEntry } from '../effects/effectSystem.schema';
import { REVIEWED_SEQUENCE_SKILL_KITS } from './reviewedSequenceSkillKits';
import { MIGRATED_SEQUENCE_SKILL_KITS } from './migratedSequenceSkillKits';
// 5030 聖靈邁爾斯 技能「淨世洗禮頌」（DSH 20261018 第十三批；保底值翻倍裁定）
import { MIGRATED_HOLY_MILES_SKILL_KITS } from './migratedHolyMilesKits';
import { MIGRATED_ARENA12_SKILL_KITS } from './migratedArena12SkillKits';
import { MIGRATED_ARENA13_FENGHAO_SKILL_KIT } from './migratedArena13FenghaoKit';
import { MIGRATED_ARENA16_YOUMO_SKILL_KIT } from './migratedArena16YoumoKit';
import { MIGRATED_ARENA16_AIDA_SKILL_KIT } from './migratedArena16AidaKit';
import { MIGRATED_ARENA16_YARAN_SKILL_KIT } from './migratedArena16YaranKit';
import { MIGRATED_ARENA16_MONSTER_SKILL_KIT } from './migratedArena16MonsterKit';
import { MIGRATED_HAMO_YUTIANZHEN_SKILL_KIT } from './migratedHamoYutianzhenKit';
import { MIGRATED_HAMO_ELEMENTAL_SKILL_KITS } from './migratedHamoElementalKits';
import { MIGRATED_DIMENSIONAL_WANGSHI_SKILL_KIT } from './migratedDimensionalWangshiKit';
import { MIGRATED_FINAL_ODIN_RAVEN_KIT } from './migratedFinalOdinDeluBelienteKits';
import { MIGRATED_FINAL_MARS_SKILL_KITS } from './migratedFinalMarsLanDragonKits';
import { MIGRATED_ODIN_RAGNAROK_SKILL_KIT } from './migratedOdinRagnarokKit';
import { isLegacyWrappedKit } from '../blocks/ops/legacyHandler';

/** 人工逐句核對的第一批；不是以解析成功率批量切換。原文變更即停止套用。 */
export const REVIEWED_SKILL_KITS: { elfIds: string[]; name: string; description: string; kit: KitEntry[] }[] = [
  { name: '元素', description: '🎯 額外附加200點真實傷害', atom: 'extra_damage', params: { target: 'opponent', amount: 200, damageType: 'true' } },
  { name: '斷空破', description: '🎯 額外附加對手30點真實傷害', atom: 'extra_damage', params: { target: 'opponent', amount: 30, damageType: 'true' } },
  { name: '聖堂之門', description: '🎯 消除對方能力提升效果', atom: 'clear_stat', params: { target: 'opponent', type: 'buff' } },
  { name: '千烈虛光閃', description: '🎯 解除自身能力下降狀態', atom: 'clear_stat', params: { target: 'self', type: 'debuff' } },
  { name: '聖靈魔閃光', description: '🎯 附加對手等同於對方在場精靈最大體力1/8的百分比傷害', atom: 'extra_damage', params: { target: 'opponent', ratio: 1 / 8, damageType: 'percent' } },
].map(({ name, description, atom, params }) => ({ elfIds: ['300', '5000'], name, description,
  // 維持原手寫入口的使用時點。命中限定效果不得套用此模板。
  kit: [{ codeId: atom, params, node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: description }] }));

// 第二批保留技能庫原文；命中後異常不能搬到使用時。布萊克兩句沒有命中限定，維持使用節點。
REVIEWED_SKILL_KITS.push({ elfIds: ['5005'], name: '雙重暗影', description: '🎯 令對手防禦-1\n🎯 100%令對手進入害怕狀態',
  kit: [
    { codeId: 'stat_change', params: { target: 'opponent', def: -1 }, node: 'on_skill_use', source: 'skill', role: 'attached', order: 0, customText: '🎯 令對手防禦-1' },
    { codeId: 'apply_status', params: { target: 'opponent', status: '害怕', chance: 100, duration: 3 }, node: 'on_skill_use', source: 'skill', role: 'attached', order: 1, customText: '🎯 100%令對手進入害怕狀態' },
  ] });
for (const item of [
  { id: '5006', name: '火焰車', description: '命中後10%令對方燒傷。', status: '燒傷', chance: 10 },
  { id: '5006', name: '星光·火花', description: '命中後100%令對方燒傷。', status: '燒傷', chance: 100 },
  { id: '5010', name: '海嘯旋風', description: '命中後 10% 令對方凍傷', status: '凍傷', chance: 10 },
  { id: '5010', name: '星光·海嘯旋風', description: '命中後 100% 令對方凍傷', status: '凍傷', chance: 100 },
  { id: '5011', name: '星光·攻碎', description: '命中後100%令對方中毒。', status: '中毒', chance: 100 },
]) REVIEWED_SKILL_KITS.push({ elfIds: [item.id], name: item.name, description: item.description,
  kit: [{ codeId: 'apply_status', params: { target: 'opponent', status: item.status, chance: item.chance, duration: 3 },
    node: 'on_hit', source: 'skill', role: 'attached', order: 0, customText: item.description }] });

export function applyReviewedSkillKits(elf: Elf): Elf {
  const apply = (skill: Skill): Skill => {
    // 不覆蓋使用者已選模式／自訂積木；相同名稱但不同原句也不得套用。
    if (skill.effectMode && skill.effectMode !== 'auto' || skill.kit?.length) return skill;
    const reviewed = [...REVIEWED_SKILL_KITS,...REVIEWED_SEQUENCE_SKILL_KITS,...MIGRATED_SEQUENCE_SKILL_KITS,...MIGRATED_HOLY_MILES_SKILL_KITS,...MIGRATED_ARENA12_SKILL_KITS,...MIGRATED_ARENA13_FENGHAO_SKILL_KIT,...MIGRATED_ARENA16_YOUMO_SKILL_KIT,...MIGRATED_ARENA16_AIDA_SKILL_KIT,...MIGRATED_ARENA16_YARAN_SKILL_KIT,...MIGRATED_ARENA16_MONSTER_SKILL_KIT,...MIGRATED_HAMO_YUTIANZHEN_SKILL_KIT,...MIGRATED_HAMO_ELEMENTAL_SKILL_KITS,...MIGRATED_DIMENSIONAL_WANGSHI_SKILL_KIT,MIGRATED_FINAL_ODIN_RAVEN_KIT,...MIGRATED_FINAL_MARS_SKILL_KITS,...MIGRATED_ODIN_RAGNAROK_SKILL_KIT].find(item => item.elfIds.includes(String(elf.id)) &&
      item.name === skill.name && item.description === skill.description);
    return reviewed ? { ...skill, effectMode: isLegacyWrappedKit(reviewed.kit) ? 'registry' : 'kit', kit: structuredClone(reviewed.kit) } : skill;
  };
  return { ...elf, skills: elf.skills.map(apply), skillPool: elf.skillPool?.map(apply) };
}
