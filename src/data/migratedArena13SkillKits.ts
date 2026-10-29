// arena_13 龍錄天鋒 三技 Kit（DSH 20261017 第十批 legacyWrapped 拆解）。
// 舊 handler：tianfengRegistry TIANFENG_SKILLS 三鍵整份移除（規則3.3；法咒共鳴斬已於先前遷移）。
// 通用件（arenaShared.ts）：fifthPpDiff（第五技能PP差）；conditional_priority{perPPDiff}；
//   status_seq{count:'fifth_pp_diff'}；drain{perStageDown,ppDiffDouble}；stat_reverse{transfer,failClear}。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const at = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, role: KitEntry['role'] = 'attached'): KitEntry => ({
  codeId: 'effect_sequence', node, source: 'skill', role, order, customText: raw, params: { clause: { raw, trig, parsed: true, body } } });
const prio = (raw: string, order: number, params: any): KitEntry => ({
  codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order, customText: raw, params });

const yan = '■ 必中\n🎯 4 回合內免疫並反彈所有受到的異常狀態\n■ 自身第五技能目前 PP 每比對手第五技能多 1 點，此技能先制 +1\n🎯 並隨機附加【燒傷】【凍傷】【中毒】【麻痺】【害怕】【睡眠】其中一種異常狀態 1 回合\n> 未觸發時消除對手回合類效果\n🎯 施放本技能時，對手每具有 1 回合異常狀態，吸取其 60 點體力；自身先制等級高於 +3 時吸取效果翻倍';
const wan = '■ 必中\n■ 自身處於能力下降狀態時先制 +3\n🎯 自身每有 1 級能力下降，吸取對手 60 點體力；對手處於能力提升狀態時效果翻倍\n■ 攻擊時，將對手的能力提升視為對應的能力下降\n🎯 解除自身能力下降\n> 解除成功時 3 回合內免疫能力下降\n🎯 反轉對手能力提升\n> 反轉成功時自身附加相同能力提升；反轉失敗時消除對手能力提升';

export const MIGRATED_ARENA13_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['arena_13'], name: '艷羅劍典', description: yan, kit: [
    prop('■ 必中', 'sure_hit', true, 0),
    prio('■ 自身第五技能目前PP每比對手第五技能多1點，此技能先制+1', 1,
      { property: 'conditional_priority', value: 1, perPPDiff: true }),
    at('on_skill_use', 'use', '🎯 4 回合內免疫並反彈所有受到的異常狀態', [
      { acts: [a('immune_status_turns', { turns: 4, reflect: true, cls: '' })] },
    ], 2),
    at('on_skill_use', 'use', '🎯 並隨機附加燒傷／凍傷／中毒／麻痺／害怕／睡眠其中一種異常狀態1回合（每1點PP差一種）', [
      { acts: [a('status_seq', { list: ['燒傷', '凍傷', '中毒', '麻痺', '害怕', '睡眠'], chance: 100, side: 'opp', countFrom: 'fifth_pp_diff', turns: 1 })] },
    ], 3),
    at('on_skill_use', 'use', '> 未觸發時消除對手回合類效果', [
      { chain: 'fail', acts: [a('clear_turn', { side: 'opp' })] },
    ], 4),
    at('on_skill_use', 'use', '🎯 施放本技能時，對手每具有1回合異常狀態，吸取其60點體力；自身先制等級高於+3時吸取效果翻倍', [
      { acts: [a('drain', { flat: 60, perStatusTurns: 'opp', true: false, ppDiffDouble: true })] },
    ], 5),
  ] },
  // 敕赦千銘已由 migratedPowerTimingSkillKits 遷移（其他 AI 已完成；不重複收錄）。
  { elfIds: ['arena_13'], name: '萬蒼書帝錄', description: wan, kit: [
    prop('■ 必中', 'sure_hit', true, 0),
    prio('■ 自身處於能力下降狀態時先制+3', 1,
      { property: 'conditional_priority', value: 3, conditions: [c('stage', { side: 'self', kind: 'down' })] }),
    at('on_skill_use', 'use', '🎯 自身每有1級能力下降，吸取對手60點體力；對手處於能力提升狀態時效果翻倍', [
      { acts: [a('drain', { perStageDown: { amount: 60, doubleOnOppBoost: true }, true: false })] },
    ], 2),
    at('on_skill_use', 'use', '■ 攻擊時，將對手的能力提升視為對應的能力下降', [
      { acts: [a('ignore', { what: '對手提升視為下降' })] },
    ], 3),
    at('on_skill_use', 'use', '🎯 解除自身能力下降', [
      { acts: [a('stat_clear', { side: 'self', kind: 'down' })] },
      { chain: 'success', acts: [a('immune_statdown_turns', { turns: 3 })] },
    ], 4),
    at('on_skill_use', 'use', '🎯 反轉對手能力提升；成功時自身附加相同能力提升；失敗時消除對手能力提升', [
      { acts: [a('stat_reverse', { side: 'opp', kind: 'up', transfer: true, failClear: true })] },
    ], 5),
  ] },
];
