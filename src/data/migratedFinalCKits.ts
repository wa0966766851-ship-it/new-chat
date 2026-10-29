import type { KitEntry } from '../effects/effectSystem.schema';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property } from './reviewedSequenceSkillKits';

// C 組（未接通 73 項）：5007 不淨者之約／深潛者盛宴、5018 蟲后之冠、5022/5023/5026 通用特性亂舞。
const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, o: Partial<KitEntry> & { marker?: string } = {}): KitEntry => {
  const { marker, ...rest } = o;
  return { codeId: 'effect_sequence', node, source: 'skill', role: 'attached', order, customText: raw,
    params: { clause: { raw, ...(marker ? { marker } : {}), trig, parsed: true, body } }, ...rest } as KitEntry;
};
const skillProp = (node: KitEntry['node'], raw: string, order: number, params: any): KitEntry =>
  ({ codeId: 'skill_property', node, source: 'skill', role: 'innate', order, customText: raw, params } as KitEntry);
const when = (raw: string, order: number, value: number, conditions: any[]) =>
  skillProp('modify_priority', raw, order, { property: 'base_priority', value, conditions });

const CROWN = [
  '■ 必中',
  '🎯 全屬性+1，雙方背包內每存在識別帶有蟲系或混沌系時強化效果額外+1',
  '🎯 若對手不蟲系則在執行前將對手轉變為蟲系，對手為蟲系則改為令對手下次技能無效',
  '🎯 5回合內每回合使用技能吸取對手最大體力的⅓，自身體力低於最大體力½時效果翻倍，自身體力高於最大體力½時額外恢復己方不在場精靈200點體力',
  '🎯 4回合內若自身使用技能則附加300點固定傷害，對手體力減少量低於200則額外汲取對手200點體力',
];
const FEAST = [
  '■ 必中',
  '■ 自身處於能力下降狀態時先制+3且使用技能不受PP值限制、將自身任意能力下降狀態視為至少2倍同等級的全屬性能力提升',
  '■ 造成傷害時取水系、混沌系、水.混沌、普通系中克制倍數最高者，未擊敗對手則延續至自身下2次自身造成技能傷害',
  '🎯 自身下2次技能無效時令本次技能額外造成對手當前體力¼的水系技能傷害且令對手100%漸凍1回合',
  '🎯 吸取對手300點體力，雙方每處於1種能力等級提升/下降狀態則額外吸取前額外吸取對手40點（每次視為獨立吸取1次），吸取後任意1次對手體力未因此減少則額外汲取對手當前體力¼',
  '🎯 3回合內自身造成技能傷害提升50%，雙方任一方處於異常狀態則效果翻倍',
];
const PACT = [
  '■ 必中',
  '◇ 攜帶此技能則自身死亡時，消耗對方額外精靈克塔亞特最大體力40%以令自身重生並解除所處異常狀態，若對手額外精靈克塔亞特體力不足則改為令其死亡以令自身重生',
  '🎯 5回合內自身免疫並反彈所有非附屬類異常狀態',
  '■ 對手為自身天敵時額外先制+3',
  '🎯 令對手全屬性-1、凍傷，任一項未觸發或均觸發則100%令對手冰封',
  '🎯 令自身100%狂暴',
  '🎯 下2回合對手所有技能先制-2，若對手當前速度高於自身則改為先制-3',
];
const DANCE = '攻擊/特攻提升 12% 且造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標';

export const MIGRATED_FINAL_C_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5018'], name: '蟲后之冠', description: CROWN.join('\n'), kit: [
    property(CROWN[0], 'sure_hit', true, 0),
    entry('on_skill_use', 'use', CROWN[1], [
      { acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
      { acts: [a('roster_query', { sides: ['self', 'opp'], types: ['蟲', '混沌'], filter: 'any', scope: 'team' })] },
      { chain: 'success', acts: [a('stat_by_last', { side: 'self', stats: ['全屬性'] })] },
    ], 2, { }),
    // 「執行前」：使用技能前置時點，早於強化計數（新轉成蟲系的在場者也納入背包計數）。
    entry('before_skill', 'before_skill', CROWN[2], [
      { cond: [c('type_is', { side: 'opp', type: '蟲', neg: true }, '對手不是蟲系')],
        acts: [a('change_type', { side: 'opp', type: '蟲', untilSwitch: true })],
        elseActs: [a('invalid_next', { kind: 'all', uses: 1 })] },
    ], 1),
    entry('on_skill_use', 'use', CROWN[3], [
      { acts: [a('timed', { turns: 5, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('drain', { ratio: 1 / 3, x2If: c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '自身體力低於½') })] },
        { cond: [c('hp_ratio', { side: 'self', op: '高於', ratio: 0.5 }, '自身體力高於½')],
          acts: [a('heal_collection', { side: 'self', scope: 'bench', amount: 200 })] },
      ] })] },
    ], 3),
    entry('on_skill_use', 'use', CROWN[4], [
      { acts: [a('timed', { turns: 4, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('dmg', { flat: 300, type: '固定' })] },
        { cond: [c('last_hp_lost', { op: '低於', amount: 200 }, '對手體力減少量低於200')],
          acts: [a('drain', { flat: 200, true: true })] },
      ] })] },
    ], 4),
  ] },
  { elfIds: ['5007'], name: '深潛者盛宴', description: FEAST.join('\n'), kit: [
    property(FEAST[0], 'sure_hit', true, 0),
    when(FEAST[1], 1, 3, [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降狀態')]),
    skillProp('on_skill_selected', FEAST[1], 2, { property: 'ignore_pp_limit', value: true, conditions: [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降狀態')] }),
    skillProp('before_damage', FEAST[1], 3, { property: 'stage_view', value: 'self_down_as_double_up', conditions: [] }),
    entry('on_skill_use', 'use', FEAST[2], [
      { acts: [a('type_best_of', { types: ['水', '混沌', '水.混沌', '普通'], extend: 2 })] },
    ], 4, { role: 'innate', marker: '■' }),
    entry('on_skill_use', 'use', FEAST[3], [
      { acts: [a('timed_uses', { uses: 2, trig: 'self_invalid', body: [
        { acts: [a('dmg', { base: '當前體力', of: 'opp', ratio: 0.25, type: '技能', elem: '水' }), a('status', { side: 'opp', status: '漸凍', chance: 100, turns: 1 })] },
      ] })] },
    ], 5),
    entry('on_skill_use', 'use', FEAST[4], [
      { acts: [a('drain_repeat_independent', { flat: 300, repeat: { per: 'stage_kinds_both', amount: 40 }, fallback: { ratioCur: 0.25 } })] },
    ], 6),
    entry('on_skill_use', 'use', FEAST[5], [
      // 「雙方任一方處於異常狀態則效果翻倍」每次造成傷害時動態判定（異常解除即回到50%），不凍結施放當下的狀態。
      { acts: [a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '技能', boost: 0.5, turns: 3, doubleIfAnyStatus: true })] },
    ], 7),
  ] },
  { elfIds: ['5007'], name: '不淨者之約', description: PACT.join('\n'), kit: [
    property(PACT[0], 'sure_hit', true, 0),
    entry('self_fatal', 'fatal', PACT[1], [
      { acts: [a('consume_extra_hp', { name: '克塔亞特', ratio: 0.4 })] },
      { chain: 'success', acts: [a('survive', {}), a('heal', { side: 'self', ratio: 1 }), a('cure_status', { side: 'self' })] },
    ], 1, { role: 'carried', marker: '◇' }),
    entry('on_skill_use', 'use', PACT[2], [
      { acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '非附屬類' })] },
    ], 2),
    when(PACT[3], 3, 3, [c('enemy', { above: 1 }, '對手為自身天敵')]),
    entry('on_skill_use', 'use', PACT[4], [
      { acts: [a('stat', { side: 'opp', stats: ['全屬性'], v: -1 })] },
      { acts: [a('status', { side: 'opp', status: '凍傷', chance: 100, turns: 3 })] },
      // 「任一項未觸發或均觸發」涵蓋所有結果，等價於無條件。
      { acts: [a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 })] },
    ], 4),
    entry('on_skill_use', 'use', PACT[5], [
      { acts: [a('status', { side: 'self', status: '狂暴', chance: 100, turns: 3 })] },
    ], 5),
    entry('on_skill_use', 'use', PACT[6], [
      { cond: [c('speed_cmp', { side: 'opp', op: '高於' }, '對手當前速度高於自身')],
        acts: [a('prio_turns', { turns: 2, v: -3, side: 'opp', next: true })],
        elseActs: [a('prio_turns', { turns: 2, v: -2, side: 'opp', next: true })] },
    ], 6),
  ] },
];

export const MIGRATED_FINAL_C_TRAIT_KITS = [{
  kind: 'trait' as const, elfIds: ['5022', '5023', '5026'], name: '亂舞', description: DANCE, kit: [
    { codeId: 'soul_property', source: 'mechanic', role: 'innate', node: 'passive_always', order: 0, customText: '攻擊/特攻提升 12%',
      params: { property: 'stat_percent', stats: ['atk', 'spatk'], percent: 12 } } as KitEntry,
    { codeId: 'effect_sequence', source: 'mechanic', role: 'innate', node: 'after_action', order: 1, customText: '造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標',
      params: { clause: { raw: '造成技能傷害時隨機選擇對方任意場下精靈/額外精靈作為增加一個攻擊目標', trig: 'self_after_attack', parsed: true, body: [
        { cond: [c('event_hit', {}, '本次攻擊命中')], acts: [a('extra_random_target', { pool: ['foe_bench', 'foe_extra'], count: 1 })] },
      ] } } } as KitEntry,
  ],
}];

