import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
const c = (name: string, p: any) => ({ c: name, p, label: name });

const raw = [
  '■ 必中',
  '■ 先制+1',
  '🎯 消耗自身全部體力',
  '🎯 以令下次被擊敗時黯痕回合數+1',
  '🎯 附加對手300點固定傷害',
  '🎯 若對手因此被擊敗則自身保留1點體力',
];

/** 影之牢籠（5001 悲歌.索比拉特）：體力降為1（消耗全部）、待觸發黯痕計數、300固傷、同歸保留1。 */
const at = (node: KitEntry['node'], trig: string, r: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'attached', order, customText: r,
  params: { clause: { raw: r, marker: '🎯', trig, parsed: true, body } },
});

export const MIGRATED_SOBIRAT_CAGE_KIT: ReviewedSequenceSkill[] = [{
  elfIds: ['5001'], name: '影之牢籠',
  description: raw.join('\n'),
  kit: [
    property(raw[0], 'sure_hit', true, 0),
    property(raw[1], 'base_priority', 1, 1),
    sequence(raw[2], [{ acts: [a('hp_set', { side: 'self', value: 1 })] }], 2),
    sequence(raw[3], [{ acts: [a('pending_counter', { key: 'sobiratScarBonus', amount: 1, label: '下次被擊敗時黯痕回合數+1' })] }], 3),
    sequence(raw[4], [{ acts: [a('dmg', { flat: 300, type: '固定' })] }], 4),
    at('on_hit', 'after_hit', raw[5], [
      { cond: [c('kill', {})], acts: [a('hp_set', { side: 'self', value: 1 })] },
    ], 5),
  ],
}];
