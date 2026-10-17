// 5031 六界神王 界·六神歸一 Kit：必中／無視對手護盾附加／消回合→疲憊(未觸發→麻痺)／
// 300護盾(後出手翻倍→600)／300固定傷害(先出手→400+等量恢復)。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n🎯 無視對手護盾任意附加效果\n🎯 消除對手回合類效果，消除成功則對手疲憊，未觸發則100%令對手麻痺\n🎯 為自身附加300點護盾，若後出手則附加效果翻倍\n🎯 附加對手300點固定傷害，若先出手則固定傷害提高100點並恢復自身等量體力';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_SIX_GODS_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5031'], name: '界·六神歸一', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 無視對手護盾任意附加效果
    sequence('無視對手護盾任意附加效果', [
      { acts: [a('ignore', { what: '護盾' })] },
    ], 1),
    // 消回合 → 成功→疲憊；未觸發→100%麻痺
    sequence('消除對手回合類效果，消除成功則對手疲憊，未觸發則100%令對手麻痺', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '疲憊', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('status', { side: 'opp', status: '麻痺', chance: 100, turns: 3 })] },
    ], 2),
    // 300 護盾；後出手 → 翻倍（600）
    sequence('為自身附加300點護盾，若後出手則附加效果翻倍', [
      { cond: [c('last', {}, '後出手')], acts: [
        a('shield', { flat: 600 }),
      ], elseActs: [
        a('shield', { flat: 300 }),
      ] },
    ], 3),
    // 300 固定傷害；先出手 → +100（400）並恢復等量體力
    sequence('附加對手300點固定傷害，若先出手則固定傷害提高100點並恢復自身等量體力', [
      { cond: [c('first', {}, '先出手')], acts: [
        a('dmg', { flat: 400, type: '固定' }),
        a('heal_equal', {}),
      ], elseActs: [
        a('dmg', { flat: 300, type: '固定' }),
      ] },
    ], 4),
  ] },
];
