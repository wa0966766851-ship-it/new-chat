import type { KitEntry } from '../effects/effectSystem.schema';
import type { Stmt } from '../blocks/model';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action, property, sequence } from './reviewedSequenceSkillKits';

const abnormal = { c: 'abnormal', p: { side: 'self', neg: false }, label: '自身處於異常狀態' };
const conditional = (name: 'sure_hit' | 'base_priority', value: boolean | number, order: number): KitEntry => ({
  ...property('■ 自身處於異常狀態時先制+1且必定命中', name, value, order),
  params: { property: name, value, conditions: [abnormal] },
});
const hit = (raw: string, body: Stmt[], order: number): KitEntry => ({ codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'after_hit', parsed: true, body } } });

/** 逐份完整原文比對；不存在專屬handler轉接或文字fallback。 */
export const MIGRATED_MONKEY_BAPHOMET_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5006'], name: '星光·冥想', description: '■ 必中\n🎯 4回合內免疫並反彈所有受到的異常狀態\n🎯 4回合內免疫能力下降狀態\n🎯 命中後100%使對手焚燼，未觸發則下2回合自身使用技能時有100%概率使對手害怕\n🎯 3回合內每回合攻擊附加自身攻擊和特攻總和50%的百分比傷害', kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('🎯 4回合內免疫並反彈所有受到的異常狀態', [{ acts: [action('immune_status_turns', { turns: 4, reflect: true, cls: '' })] }], 1),
    sequence('🎯 4回合內免疫能力下降狀態', [{ acts: [action('immune_statdown_turns', { turns: 4 })] }], 2),
    hit('🎯 命中後100%使對手焚燼，未觸發則下2回合自身使用技能時有100%概率使對手害怕', [
      { acts: [action('status', { side: 'opp', status: '焚燼', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [action('timed', { turns: 2, from: 'next', trig: 'self_skill', body: [{ acts: [action('status', { side: 'opp', status: '害怕', chance: 100, turns: 3 })] }] })] },
    ], 3),
    hit('🎯 3回合內每回合攻擊附加自身攻擊和特攻總和50%的百分比傷害', [{ acts: [action('timed', { turns: 3, from: 'now', trig: 'self_attack', body: [
      { acts: [action('dmg', { base: 'stat:攻擊和特攻', of: 'self', ratio: .5, type: '百分比' })] },
    ] })] }], 4),
  ] },
  { elfIds: ['5008'], name: '贖魂讚詩', description: '■ 自身處於異常狀態時先制+1且必定命中\n🎯 消除對手回合類效果，消除成功則對手流血\n🎯 將對手所處的異常狀態轉化為害怕\n🎯 4回合內若對手使用攻擊技能則進入窒息狀態', kit: [
    conditional('base_priority', 1, 0), conditional('sure_hit', true, 1),
    sequence('🎯 消除對手回合類效果，消除成功則對手流血', [
      { acts: [action('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [action('status', { side: 'opp', status: '流血', chance: 100, turns: 3 })] },
    ], 2),
    sequence('🎯 將對手所處的異常狀態轉化為害怕', [{ acts: [action('convert_status', { side: 'opp', status: '害怕', turns: 3 })] }], 3),
    hit('🎯 4回合內若對手使用攻擊技能則進入窒息狀態', [{ acts: [action('timed', { turns: 4, from: 'now', trig: 'opp_attack', body: [
      { acts: [action('status', { side: 'opp', status: '窒息', chance: 100, turns: 3 })] },
    ] })] }], 4),
  ] },
  { elfIds: ['5008'], name: '引魂咏', description: '■ 自身處於異常狀態時先制+1且必定命中\n🎯 若對手不處於異常狀態時造成傷害提升100%\n🎯 吸取對手最大體力25%，每次使用提升10%，最高50%\n🎯 技能無效時，消除對手回合類效果，100%令對手流血、窒息', kit: [
    conditional('base_priority', 1, 0), conditional('sure_hit', true, 1),
    sequence('🎯 若對手不處於異常狀態時造成傷害提升100%', [{ cond: [{ c: 'abnormal', p: { side: 'opp', neg: true }, label: '對手不處於異常狀態' }], acts: [action('boost', { mult: 2, kind: '攻擊' })] }], 2),
    sequence('🎯 吸取對手最大體力25%，每次使用提升10%，最高50%', [{ acts: [action('drain', { ratio: .25, true: false, rampInc: 10, rampCap: 50, rampStreak: false })] }], 3),
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 4, customText: '🎯 技能無效時，消除對手回合類效果，100%令對手流血、窒息', params: { clause: {
      raw: '🎯 技能無效時，消除對手回合類效果，100%令對手流血、窒息', marker: '🎯', trig: 'on_invalid', parsed: true,
      body: [{ acts: [action('clear_turn', { side: 'opp' }), action('status', { side: 'opp', status: '流血', chance: 100, turns: 3 }), action('status', { side: 'opp', status: '窒息', chance: 100, turns: 3 })] }],
    } } },
  ] },
  { elfIds: ['5006'], name: '衝頂', description: '（無特殊效果）', kit: [sequence('（無特殊效果）', [{ acts: [action('noop', {})] }], 0)] },
  ...[
    { name: '縮頭', stat: '防禦', description: '必中；技能使用成功時，100%改變自身防禦等級+1。' },
    { name: '熱量集合', stat: '特攻', description: '必中；技能使用成功時，100%改變自身特攻等級+1。' },
  ].map(({ name, stat, description }) => ({ elfIds: ['5006'], name, description, kit: [
    property('必中', 'sure_hit', true, 0), hit(description, [{ acts: [action('stat', { side: 'self', stats: [stat], v: 1, chance: 100 })] }], 1),
  ] })),
];
