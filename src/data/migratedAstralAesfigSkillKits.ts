// 5033 星軌重構·艾斯菲格 五技 Kit：星軌念刃（multi_hit 10-20）、幻象帷幔、
// 心像重構、念力傾瀉、寰宇星軌陣。變思遷憶 kind0-4 全部 queue_extra_action 組合。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const c3 = (name: string, p: any, label: string) => ({ c: name, p, label });
const mem33 = (raw: string, cond: any[], body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'after_action', source: 'skill', role: 'innate', order, customText: raw,
  params: { clause: { raw, marker: '🎯', trig: 'self_after_skill', parsed: true, body: [
    { cond, acts: [a('queue_extra_action', { label: '變思遷憶', body })] },
  ] } },
});

const renken = ['■ 先制+3','■ 命中率100%','🎯 1回合做10-20次攻擊','🎯 消除對手能力提升狀態，消除成功則恢復自身全部體力','🎯 若對手不處於能力提升狀態則2回合內對手體力與PP值恢復量降低100%','🎯 命中後100%降低對方2點PP值，降低後若對手PP為0則當回合無法行動','🎯 變思遷憶：若對方不處於能力提升狀態，則行動階段結束時進行一次額外行動附加對方在場精靈50點超能系技能傷害，對手每有1個技能PP值不為滿則額外提升50點'];
const weiman = ['■ 必中','🎯 5回合內免疫並反彈所有異常狀態','🎯 解除自身能力下降狀態','🎯 3回合內每回合使用技能後吸取對手300點固定體力，若自身體力低於對手則吸取效果翻倍','🎯 下2回合自身所有技能先制+2','🎯 變思遷憶：對手處於回合類效果則行動階段結束時進行一次額外行動附加對方在場精靈的所有鄰位精靈附加50點超能系技能傷害，自身每有1個技能PP值不為滿則額外提升50點'];
const chonggou = ['■ 必中','🎯 全屬性+1，先出手時自身強化效果翻倍','🎯 4回合內每回合恢復自身最大體力的1/3並造成對方等量百分比傷害，自身體力低於最大體力½時效果翻倍','🎯 使自身下2回合的攻擊傷害翻倍','🎯 令對方下2次受到的攻擊必定為致命一擊','🎯 變思遷憶：自身處於回合類效果則行動階段結束時進行一次額外行動附加對方在場精靈的所有隔位精靈附加50點超能系技能傷害且PP值上限-1，降低後該目標精靈PP值每超出上限1點則轉化為額外附加該目標精靈1次50點超能系技能傷害'];
const nianli = ['■ 先制+1','■ 命中率100%','🎯 先出手則當回合對手施放的技能無效','🎯 後出手則恢復自身1/1體力','🎯 若打出致命一擊，則100%令對手睡眠，未觸發則附加對手300點真實傷害','🎯 若打出致命一擊，則令自身免疫下次受到的異常狀態（下場後保留且僅限自身）','🎯 變思遷憶：對手在場期間若PP值曾發生變化，則行動階段結束時進行一次額外行動附加對方出戰背包精靈中的首位精靈50點超能系技能傷害且所有技能PP值上限+1，同時恢復己方不在場精靈該目標精靈已損失PP值×30的體力值'];
const xingzhen = ['■ 必中','🎯 消除對手回合類效果，消除成功則使對方攻擊技能PP值歸零','🎯 為自身附加所有星附屬異常，每附加成功1項則額外令對方睡眠3回合，每附加1項失敗則額外令對方沉睡3回合','🎯 若自身處於異常狀態則使自身當次技能必定觸發變思遷憶且造成非真實傷害翻倍','🎯 未擊敗對手則下2回合自身所有技能先制+2','🎯 擊敗對手則對手下隻出戰精靈出戰前2回合內先制-2','🎯 變思遷憶：行動階段結束時進行一次額外行動附加對方末位精靈50點超能系技能傷害並分別使自身受到1點超能系技能傷害、固定傷害、百分比傷害、真實傷害，自身本場戰鬥均受到次數達到5次時額外附加5次目標精靈50點超能系技能傷害；自身處於異常狀態則清除自身本場戰鬥登場次數紀錄；令自身下5次觸發變思遷憶時則取消觸發條件'];

export const MIGRATED_ASTRAL_AESFIG_SKILLS: ReviewedSequenceSkill[] = [
  { elfIds: ['5033'], name: '星軌念刃', description: renken.join('\r\n'), kit: [
    property(renken[0], 'base_priority', 3, 0),
    // 「命中率100%」＝固有命中率修正（非必中：仍可被閃避類效果作用於命中率的場景區分）。
    property(renken[1], 'base_accuracy', 100, 1),
    sequence(renken[2], [{ acts: [a('multi_hit', { min: 10, max: 20 })] }], 2),
    sequence(renken[3], [
      { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [a('heal', { side: 'self', ratio: 1 })] },
    ], 3),
    sequence(renken[4], [
      { cond: [c3('stage', { side: 'opp', kind: 'up', neg: true }, '對手不處於能力提升')], acts: [a('no_heal', { turns: 2, scope: 'all' })] },
    ], 4),
    sequence(renken[5], [{ acts: [a('pp_op', { side: 'opp', mode: 'reduce', amount: 2, stopIfEmpty: true })] }], 5),
    // 變思遷憶：原文「附加對方在場精靈50點」——目標是在場者本身（relation:'active'），非背包首位。
    mem33(renken[6], [c3('stage', { side: 'opp', kind: 'up', neg: true }, '對方不處於能力提升')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'active', anchor: 'active', body: [
          { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50, perNonFullPp: { side: 'opp', flat: 50 } })] },
        ] }),
      ] },
    ], 6),
  ] },
  { elfIds: ['5033'], name: '幻象帷幔', description: weiman.join('\r\n'), kit: [
    property(weiman[0], 'sure_hit', true, 0),
    sequence(weiman[1], [{ acts: [a('immune_status_turns', { turns: 5, reflect: true })] }], 1),
    sequence(weiman[2], [{ acts: [a('stat_clear', { side: 'self', kind: 'down' })] }], 2),
    sequence(weiman[3], [{ acts: [
      a('timed', { turns: 3, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('drain', { flat: 300, true: false })] },
        { cond: [c3('hp_cmp', { side: 'self', op: '低於' }, '自身體力低於對手')], acts: [a('drain', { flat: 300, true: false })] },
      ] }),
    ] }], 3),
    sequence(weiman[4], [{ acts: [a('prio_turns', { turns: 2, v: 2 })] }], 4),
    mem33(weiman[5], [c3('has_turn_effect', { side: 'opp' }, '對手處於回合類效果')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'adjacent', anchor: 'active', body: [
          { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50, perNonFullPp: { side: 'self', flat: 50 } })] },
        ] }),
      ] },
    ], 5),
  ] },
  { elfIds: ['5033'], name: '心像重構', description: chonggou.join('\r\n'), kit: [
    property(chonggou[0], 'sure_hit', true, 0),
    sequence(chonggou[1], [{ acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: c3('first', {}, '先出手') })] }], 1),
    // 4回合恢復1/3+等量百分比（低½翻倍）：heal_then×round_end 待接線（與 5032 幻舞同款申請）。
    // 在此之前用 stmt 級雙分支保底（恢復先行、等量百分比在結算後）——heal_then 放行後取代。
    sequence(chonggou[2], [{ acts: [
      a('timed', { turns: 4, from: 'now', trig: 'self_skill', initial: true, body: [
        { live: true, cond: [c3('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於½')], acts: [
          a('heal_then', { side: 'self', ratio: 2 / 3, body: [{ acts: [a('dmg_equal', { type: '百分比' })] }] }),
        ], elseActs: [
          a('heal_then', { side: 'self', ratio: 1 / 3, body: [{ acts: [a('dmg_equal', { type: '百分比' })] }] }),
        ] },
      ] }),
    ] }], 2),
    sequence(chonggou[3], [{ acts: [a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 1, turns: 2 })] }], 3),
    // 「令對方下2次受到的攻擊必定為致命一擊」——次數制（非回合制）。
    sequence(chonggou[4], [{ acts: [a('crit_received_uses', { uses: 2 })] }], 4),
    mem33(chonggou[5], [c3('has_turn_effect', { side: 'self' }, '自身處於回合類效果')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'separated', anchor: 'active', body: [
          { acts: [
            a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50 }),
            a('pp_max_offset_selected', { delta: -1, overflowDamage: true, overflowFlat: 50, overflowType: 'skill_extra_action', elem: '超能' }),
          ] },
        ] }),
      ] },
    ], 5),
  ] },
  { elfIds: ['5033'], name: '念力傾瀉', description: nianli.join('\r\n'), kit: [
    property(nianli[0], 'base_priority', 1, 0),
    property(nianli[1], 'base_accuracy', 100, 1),
    // 「當回合對手施放的技能無效」——本回合生效（next:false），非下回合。
    sequence(nianli[2], [
      { cond: [c3('first', {}, '先出手')], acts: [a('invalid_turns', { kind: '', turns: 1, next: false })] },
    ], 2),
    sequence(nianli[3], [
      { cond: [c3('last', {}, '後出手')], acts: [a('heal', { side: 'self', ratio: 1 })] },
    ], 3),
    { codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order: 4,
      customText: nianli[4] + '\r\n' + nianli[5],
      params: { clause: { raw: nianli[4] + '\r\n' + nianli[5], marker: '🎯', trig: 'after_hit', parsed: true, body: [
        { cond: [c3('crit', {}, '致命一擊')], acts: [
          a('status', { side: 'opp', status: '睡眠', chance: 100, turns: 3 }),
          a('immune_status_count', { count: 1, reflect: false }),
        ], elseActs: [a('dmg', { flat: 300, type: '真實' })] },
      ] } },
    },
    mem33(nianli[6], [c3('opp_pp_changed', {}, '對手PP曾變化')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'first', anchor: 'active', body: [
          { acts: [
            a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50 }),
            a('pp_max_offset_selected', { delta: 1 }),
            a('heal_selected_pp', { perLostPp: 30 }),
          ] },
        ] }),
      ] },
    ], 5),
  ] },
  { elfIds: ['5033'], name: '寰宇星軌陣', description: xingzhen.join('\r\n'), kit: [
    property(xingzhen[0], 'sure_hit', true, 0),
    sequence(xingzhen[1], [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('pp_op', { side: 'opp', mode: 'zero', kind: '攻擊' })] },
    ], 1),
    sequence(xingzhen[2], ['星賜','星哲','星贖','星佑','星護'].flatMap((s: string) => ([
      { acts: [a('status', { side: 'self', status: s, chance: 100, turns: 3 })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '睡眠', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('status', { side: 'opp', status: '沉睡', chance: 100, turns: 3 })] },
    ])), 2),
    sequence(xingzhen[3], [
      { cond: [c3('abnormal', { side: 'self' }, '自身處於異常')], acts: [
        a('dmg_mod', { dir: 'out', kind: '非真實', boost: 1 }),
        a('pending_counter', { key: 'astralForceMemoryUses', amount: 1, label: '當次必定觸發變思遷憶' }),
      ] },
    ], 3),
    { codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order: 4,
      customText: xingzhen[4] + '\r\n' + xingzhen[5],
      params: { clause: { raw: xingzhen[4] + '\r\n' + xingzhen[5], marker: '🎯', trig: 'after_hit', parsed: true, body: [
        { cond: [c3('nokill', {}, '未擊敗')], acts: [a('prio_turns', { v: 2, turns: 2 })] },
        { cond: [c3('kill', {}, '擊敗')], acts: [a('turn_key_set', { key: 'nextElfAstralPriority', turns: 2, side: 'opp', reason: '【寰宇星軌陣】', label: '下隻出戰先制失效' })] },
      ] } },
    },
    mem33(xingzhen[6], [], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'last', anchor: 'active', body: [
          { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50 })] },
        ] }),
        a('dmg', { flat: 1, type: '技能', elem: '超能', both: true }),
        a('dmg', { flat: 1, type: '固定', both: true }),
        a('dmg', { flat: 1, type: '百分比', both: true }),
        a('dmg', { flat: 1, type: '真實', both: true }),
      ] },
    ], 5),
  ] },
];
