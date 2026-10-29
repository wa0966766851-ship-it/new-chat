import type { KitEntry } from '../effects/effectSystem.schema';
import type { Stmt } from '../blocks/model';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action, property, sequence } from './reviewedSequenceSkillKits';

const hit = (raw: string, body: Stmt[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } },
});
const down = { c: 'stage', p: { side: 'opp', kind: 'down' }, label: '對手處於能力下降' };

/** 初次命中啟動；持續期間每次已使用技能後觸發，不要求後續命中。 */
export const MIGRATED_RECURRING_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5006'], name: '星光·音速火拳', description: '■ 先制+3\n🎯 消除對手回合類效果，消除成功使對手下回合先制-3\n🎯 50%的概率造成傷害翻倍，對手處於能力下降狀態時概率翻倍', kit: [
    property('■ 先制+3', 'base_priority', 3, 0),
    sequence('🎯 消除對手回合類效果，消除成功使對手下回合先制-3', [
      { acts: [action('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [action('prio_turns', { side: 'opp', turns: 1, v: -3, attackOnly: false })] },
    ], 1),
    sequence('🎯 50%的概率造成傷害翻倍，對手處於能力下降狀態時概率翻倍', [
      { cond: [down], acts: [action('boost', { mult: 2, kind: '攻擊' })] },
      { cond: [{ ...down, p: { ...down.p, neg: true } }], acts: [action('boost', { mult: 2, kind: '攻擊', chance: 50 })] },
    ], 2),
  ] },
  { elfIds: ['5006'], name: '星光·覺醒', description: '■ 必中\n🎯 全屬性+1，先出手時自身強化效果翻倍\n🎯 4回合內每回合使用技能恢復自身最大體力的1/3並造成等量百分比傷害，自身體力低於最大體力1/2時效果翻倍\n🎯 下2回合造成的攻擊傷害額外提升150%\n🎯 下2回合令自身所有技能先制+2', kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 全屬性+1，先出手時自身強化效果翻倍', [{ acts: [action('stat', { side: 'self', stats: ['全屬性'], v: 1,
      x2If: { c: 'first', p: {}, label: '先出手' } })] }], 1),
    hit('🎯 4回合內每回合使用技能恢復自身最大體力的1/3並造成等量百分比傷害，自身體力低於最大體力1/2時效果翻倍', [{ acts: [action('timed', {
      turns: 4, from: 'now', trig: 'self_after_use', body: [{ acts: [
        action('heal', { side: 'self', ratio: 1 / 3, x2If: { c: 'hp_ratio', p: { side: 'self', op: '低於', ratio: .5 }, label: '自身體力低於一半' } }),
        action('dmg_equal', { type: '百分比' }),
      ] }],
    })] }], 2),
    sequence('🎯 下2回合造成的攻擊傷害額外提升150%', [{ acts: [action('dmg_mod_turns', { dir: 'out', kind: '攻擊', boost: 1.5, turns: 2, next: true })] }], 3),
    sequence('🎯 下2回合令自身所有技能先制+2', [{ acts: [action('prio_turns', { turns: 2, v: 2, attackOnly: false })] }], 4),
  ] },
  { elfIds: ['5006'], name: '星光·不滅之火', description: '■ 必中\n🎯 消除對手能力提升狀態，消除成功則附加400點固定傷害\n🎯 對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍\n🎯 若打出致命一擊則恢復自身所有體力\n🎯 3回合內每回合使用技能時附加400點固定傷害，附加後若對手體力未減少則附加400點真實傷害', kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 消除對手能力提升狀態，消除成功則附加400點固定傷害', [
      { acts: [action('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [action('dmg', { flat: 400, type: '固定' })] },
    ], 1),
    sequence('🎯 對手處於星火之灼時造成的攻擊傷害提升75%，若自身體力低於對手則效果翻倍', [
      { cond: [{ c: 'has_mark', p: { side: 'opp', name: '星火之灼' }, label: '星火之灼' }], acts: [action('boost', { mult: 1.75, kind: '攻擊', x2If: { c: 'hp_cmp', p: { side: 'self', op: '低於' }, label: '自身體力低於對手' } })] },
    ], 2),
    hit('🎯 若打出致命一擊則恢復自身所有體力', [{ cond: [{ c: 'crit', p: {}, label: '致命一擊' }], acts: [action('heal', { side: 'self', ratio: 1 })] }], 3),
    hit('🎯 3回合內每回合使用技能時附加400點固定傷害，附加後若對手體力未減少則附加400點真實傷害', [{ acts: [action('timed', { turns: 3, from: 'now', trig: 'self_after_use', body: [
      { acts: [action('dmg', { flat: 400, type: '固定' })] },
      { cond: [{ c: 'last_no_dmg', p: {}, label: '附加後體力未減少' }], acts: [action('dmg', { flat: 400, type: '真實' })] },
    ] })] }], 4),
  ] },
  { elfIds: ['5008'], name: '亂魂舞', description: '■ 必中\n🎯 令自身進入混亂，自身處於混亂則攻擊、速度、命中+2\n🎯 令對手100%窒息，未觸發則自身雙防+1\n🎯 4回合內自身使用技能恢復最大體力½並造成等量百分比傷害\n🎯 下2回合自身攻擊技能造成傷害提升100%\n🎯 下2回合自身所有技能先制+2', kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 令自身進入混亂，自身處於混亂則攻擊、速度、命中+2', [
      { acts: [action('status', { side: 'self', status: '混亂', turns: 3, chance: 100 })] },
      { live: true, cond: [{ c: 'has_status', p: { side: 'self', status: '混亂' }, label: '自身處於混亂' }], acts: [action('stat', { side: 'self', stats: ['攻擊', '速度', '命中'], v: 2, chance: 100 })] },
    ], 1),
    sequence('🎯 令對手100%窒息，未觸發則自身雙防+1', [
      { acts: [action('status', { side: 'opp', status: '窒息', turns: 3, chance: 100 })] },
      { chain: 'fail', acts: [action('stat', { side: 'self', stats: ['防禦', '特防'], v: 1, chance: 100 })] },
    ], 2),
    hit('🎯 4回合內自身使用技能恢復最大體力½並造成等量百分比傷害', [{ acts: [action('timed', { turns: 4, from: 'now', trig: 'self_after_use', body: [
      { acts: [action('heal', { side: 'self', ratio: .5 }), action('dmg_equal', { type: '百分比' })] },
    ] })] }], 3),
    sequence('🎯 下2回合自身攻擊技能造成傷害提升100%', [{ acts: [action('dmg_mod_turns', { turns: 2, next: true, kind: '攻擊', dir: 'out', boost: 1 })] }], 4),
    sequence('🎯 下2回合自身所有技能先制+2', [{ acts: [action('prio_turns', { turns: 2, attackOnly: false, v: 2 })] }], 5),
  ] },
  { elfIds: ['5006'], name: '星光·靈絕擊', description: '若對手處於能力下降狀態則造成傷害的100%恢復體力；若對手處於能力下降狀態則附加300點傷害。', kit: [
    sequence('若對手處於能力下降狀態則造成傷害的100%恢復體力', [{ cond: [down], acts: [action('vampire', { ratio: 1, kind: '攻擊' })] }], 0),
    hit('若對手處於能力下降狀態則附加300點傷害。', [{ cond: [down], acts: [action('dmg', { flat: 300, type: '固定' })] }], 1),
  ] },
];
