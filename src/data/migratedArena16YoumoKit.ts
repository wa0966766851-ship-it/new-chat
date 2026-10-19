// arena_16 幽魔相嘯 技能 Kit（DSH 20261018 第十七批 legacyWrapped 拆解）。
// 舊 handler：staged-arena/dragonHealingRegistry.ts DRAGON_HEALING_SKILLS['幽魔相嘯'] 已空殼化。
// 時點：■ 自身處於能力下降時先制+3＝modify_priority 條件先制（prio_bonus）；
//       🎯＝使用時（on_skill_use）依序消除四類並分別觸發；> 為各自觸發條件；
//       ■ 技能無效時＝正式 on_invalid/self_invalid，僅 actual invalid，不含 Miss／閃避。
// 「赤龍下次附加傷害改為真實傷害」由可編輯儲存傷害動作於釋放時消耗。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'skill', role: 'attached', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

export const MIGRATED_ARENA16_YOUMO_SKILL_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['arena_16'],
  name: '幽魔相嘯',
  description: '■ 自身處於能力下降時先制 +3\n🎯 依序消除雙方的能力提升、能力下降、回合類效果及所有護盾效果；每一類只要任意一方成功被消除，便分別觸發：\n> 為雙方附加 3 回合附屬類異常【狂暴】\n> 下次【赤龍】附加傷害改為真實傷害\n> 恢復自身全部體力並對對手附加等同實際恢復量的百分比傷害（出手時自身體力低於一半則傷害翻倍）\n> 附加等同雙方被消除護盾與護罩總值的固定傷害\n■ 技能無效時，自身獲得 1 層【龍魂印記】',
  kit: [
    // 自身處於能力下降時先制+3（事中查詢）
    entry('modify_priority', 'modify_priority', '自身處於能力下降時先制 +3', [
      { cond: [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降')], acts: [a('prio_bonus', { v: 3 })] },
    ], 0),
    // 依序消除雙方能力提升、能力下降、回合類效果、護盾護罩；各類成功則分別觸發
    seq('🎯 依序消除雙方的能力提升、能力下降、回合類效果及所有護盾效果（各自成功才觸發對應效果）', [
      { acts: [a('stat_clear', { side: 'both', kind: 'up' })] },
      { chain: 'success', acts: [a('status', { side: 'both', status: '狂暴', chance: 100, turns: 3 })] },
      { acts: [a('stat_clear', { side: 'both', kind: 'down' })] },
      { chain: 'success', acts: [a('stored_damage_convert_next', { key: 'arena.red', type: '真實' })] },
      { acts: [a('clear_turn', { side: 'both' })] },
      { chain: 'success', cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 })], acts: [a('heal_then', { side: 'self', ratio: 1, body: [{ acts: [a('dmg_from_last', { ratio: 2, type: '百分比' })] }] })] },
      { chain: 'success', cond: [c('hp_ratio', { side: 'self', op: '不低於', ratio: 0.5 })], acts: [a('heal_then', { side: 'self', ratio: 1, body: [{ acts: [a('dmg_from_last', { ratio: 1, type: '百分比' })] }] })] },
      { acts: [a('clear_shield', { side: 'both', kind: 'both' })] },
      { chain: 'success', acts: [a('dmg_from_last', { ratio: 1, type: '固定' })] },
    ], 1),

    // 技能無效時：自身獲得 1 層【龍魂印記】
    {...entry('on_invalid', 'self_invalid', '■ 技能無效時，自身獲得 1 層【龍魂印記】', [
      { cond: [c('skill_invalid', {})], acts: [a('resource_mark_add', { id: 'arena.dragonSoulMark', name: '龍魂印記', displayChar: '魂', unit: '層', side: 'self', scope: 'elf', persistsOffField: true, amount: 1, maxCount: 99, description: '每次使用技能後：層數×已喚醒龍數次，每次150點龍系直接傷害' })] },
    ], 2), role: 'innate'},
  ],
}];
