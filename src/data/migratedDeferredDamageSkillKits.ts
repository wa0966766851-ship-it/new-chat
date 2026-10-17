import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
const hp = (op: string, ratio: number) => ({ c: 'hp_ratio', p: { side: 'self', op, ratio }, label: `自身體力${op}${ratio * 100}%` });

/** 附加傷害沿用既有使用時快照、行動後結算；不借用精靈專屬state。 */
export const MIGRATED_DEFERRED_DAMAGE_SKILL_KITS: ReviewedSequenceSkill[] = [{
  elfIds: ['5018'], name: '王.噬心毒蝕',
  description: '■ 必中\n■ 先制-1\n■ 自身體力低於200時必定先手\n🎯 自身體力低於最大體力½時技能傷害提升2倍，體力低於最大體力⅓時技能傷害提升3倍\n🎯 附加對手已損失體力50%的百分比傷害\n🎯 附加自身已損失體力50%的百分比傷害',
  kit: [
    property('■ 必中', 'sure_hit', true, 0), property('■ 先制-1', 'base_priority', -1, 1),
    { ...property('■ 自身體力低於200時必定先手', 'forced_first', true, 2), params: {
      property: 'forced_first', value: true, conditions: [{ c: 'hp_value', p: { side: 'self', op: '低於', amount: 200 }, label: '自身體力低於200點' }],
    } },
    sequence('🎯 自身體力低於最大體力½時技能傷害提升2倍，體力低於最大體力⅓時技能傷害提升3倍', [
      { cond: [hp('低於', 1 / 3)], acts: [a('boost', { mult: 3, kind: '技能', power: false })] },
      { cond: [hp('不低於', 1 / 3), hp('低於', .5)], acts: [a('boost', { mult: 2, kind: '技能', power: false })] },
    ], 3),
    sequence('🎯 附加對手已損失體力50%的百分比傷害', [{ acts: [a('dmg_after_action', { base: '已損失體力', of: 'opp', ratio: .5, type: '百分比' })] }], 4),
    sequence('🎯 附加自身已損失體力50%的百分比傷害', [{ acts: [a('dmg_after_action', { base: '已損失體力', of: 'self', ratio: .5, type: '百分比' })] }], 5),
  ],
}];
