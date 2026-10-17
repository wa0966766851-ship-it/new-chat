// 5032 星核寰宇·艾斯菲亞：星核幻舞（屬性技）Kit。
// 原文逐句對齊 descriptionSources；變思遷憶用 queue_extra_action + astral_select/damage_selected 組合，
// 全部數值/條件/範圍在 Kit 條目內表達（無專屬硬編碼）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';
import type { KitEntry } from '../effects/effectSystem.schema';

const c = (name: string, p: any) => ({ c: name, p, label: name });
const c3 = (name: string, p: any, label: string) => ({ c: name, p, label });

const raw = [
  '■ 必中',
  '🎯 全屬性+1，先出手時自身強化效果翻倍',
  '🎯 4回合內每回合恢復自身最大體力的1/3並造成對方等量百分比傷害，自身體力低於最大體力½時效果翻倍',
  '🎯 使自身下2次攻擊技能所造成的技能傷害提升150%',
  '🎯 下2回合對方所有技能先制-2',
  '■ 變思遷憶：對手處於回合類效果則行動階段結束時進行一次額外行動附加對方在場精靈的所有鄰位精靈附加50點超能系技能傷害，自身每有1個技能PP值不為滿則額外提升50點',
];

/** 行動階段結束（after_action）觸發的變思遷憶 kind2：對手回合類 → 額外行動打鄰位。 */
const memory2: KitEntry = {
  codeId: 'effect_sequence', node: 'after_action', source: 'skill', role: 'innate', order: 5, customText: raw[5],
  params: { clause: { raw: raw[5], marker: '■', trig: 'self_after_skill', parsed: true, body: [
    { cond: [c('has_turn_effect', { side: 'opp', neg: false })], acts: [
      a('queue_extra_action', { label: '變思遷憶', body: [
        { acts: [
          a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'adjacent', anchor: 'active', body: [
            { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50, perNonFullPp: { side: 'self', flat: 50 } })] },
          ] }) ,
        ] },
      ] }),
    ] },
  ] } },
};

export const MIGRATED_ASTRAL_AESFIA_KITS: ReviewedSequenceSkill[] = [{
  elfIds: ['5032'], name: '星核幻舞',
  description: raw.join('\r\n'),
  kit: [
    property(raw[0], 'sure_hit', true, 0),
    sequence(raw[1], [{ acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1, x2If: c('first', {}) })] }], 1),
    // 4回合：每回合結束先恢復結算（heal_then 恢復 1/3，低於½翻倍→2/3），
    // body 在實際恢復量結算後觸發——dmg_equal 以「實際恢復量」造等量百分比傷害（原文「等量」語意）。
    sequence(raw[2], [{ acts: [
      a('timed', { turns: 4, from: 'now', trig: 'self_skill', initial: true, body: [
        { live: true, cond: [c3('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '體力低於½')], acts: [
          a('heal_then', { side: 'self', ratio: 2 / 3, body: [
            { acts: [a('dmg_equal', { type: '百分比' })] },
          ] }),
        ], elseActs: [
          a('heal_then', { side: 'self', ratio: 1 / 3, body: [
            { acts: [a('dmg_equal', { type: '百分比' })] },
          ] }),
        ] },
      ] }),
    ] }], 2),
    sequence(raw[3], [{ acts: [a('dmg_mod_uses', { uses: 2, boost: 1.5, kind: '技能', attackOnly: true })] }], 3),
    sequence(raw[4], [{ acts: [a('prio_turns', { side: 'opp', v: -2, turns: 2 })] }], 4),
    memory2,
  ],
}];


// ───────── 5032 其餘技能（Round 22 批） ─────────
const memoryEntry = (raw: string, cond: any[], body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', node: 'after_action', source: 'skill', role: 'innate', order, customText: raw,
  params: { clause: { raw, marker: '■', trig: 'self_after_skill', parsed: true, body: [
    { cond, acts: [a('queue_extra_action', { label: '變思遷憶', body })] },
  ] } },
});
const pulseRaw = ['■ 先制+3','🎯 消除對手回合類效果，消除成功則使對方屬性技能PP值歸零','🎯 若對手不處於回合類效果則吸取對手最大體力⅓','🎯 2回合內對手體力與PP值恢復量降低100%','🎯 命中後100%降低對方2點PP值，降低後若對手PP為0則當回合無法行動','■  變思遷憶：若對方不處於能力提升狀態，則行動階段結束時進行一次額外行動附加對方在場精靈50點超能系技能傷害，對手每有1個技能PP值不為滿則額外提升50點'];
const mistRaw = ['■ 必中','🎯 5回合內免疫並反彈所有異常狀態','🎯 解除自身能力下降狀態，若出手時自身不處於能力下降狀態則100%令對手疲憊','🎯 3回合內每回合使用技能後吸取對手300點固定體力，若吸取後對方體力未減少則附加對方300點真實傷害','■ 變思遷憶：自身處於回合類效果則行動階段結束時進行一次額外行動附加對方在場精靈的所有隔位精靈附加50點超能系技能傷害且PP值上限-1，降低後該目標精靈PP值每超出上限1點則轉化為額外附加該目標精靈1次50點超能系技能傷害'];
const meteorRaw = ['■ 先制+1','🎯 若對方任意能力值高於自身，則將自身能力值提升至與對方相同，每差1點則附加對方1點固定傷害','🎯 3回合內，對方所受技能傷害1/4會以固定傷害形式反彈給自己，此固定傷害無法大於自身體力上限-1','🎯 3回合內，若自身受到固定傷害則100%令對手睡眠','🎯 3回合內，若自身未受到固定傷害則100%令對手沉睡','■ 變思遷憶：對手在場期間若PP值曾發生變化，則行動階段結束時進行一次額外行動附加對方出戰背包精靈中的首位精靈50點超能系技能傷害且所有技能PP值上限+1，同時恢復己方不在場精靈該目標精靈已損失PP值×30的體力值'];

export const MIGRATED_ASTRAL_AESFIA_SKILLS_2: ReviewedSequenceSkill[] = [
  { elfIds: ['5032'], name: '星核脈衝', description: pulseRaw.join('\r\n'), kit: [
    property(pulseRaw[0], 'base_priority', 3, 0),
    sequence(pulseRaw[1], [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('pp_op', { side: 'opp', mode: 'zero', kind: '屬性' })] },
    ], 1),
    sequence(pulseRaw[2], [
      { cond: [c3('has_turn_effect', { side: 'opp', neg: true }, '對手不處於回合類效果')], acts: [a('drain', { ratio: 1 / 3, true: false })] },
    ], 2),
    sequence(pulseRaw[3], [{ acts: [a('no_heal', { turns: 2, scope: 'all' })] }], 3),
    sequence(pulseRaw[4], [{ acts: [a('pp_op', { side: 'opp', mode: 'reduce', amount: 2, stopIfEmpty: true })] }], 4),
    memoryEntry(pulseRaw[5], [c3('stage', { side: 'opp', kind: 'up', neg: true }, '對方不處於能力提升')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'active', anchor: 'active', body: [
          { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50, perNonFullPp: { side: 'opp', flat: 50 } })] },
        ] }),
      ] },
    ], 5),
  ] },
  { elfIds: ['5032'], name: '星霧迷境', description: mistRaw.join('\r\n'), kit: [
    property(mistRaw[0], 'sure_hit', true, 0),
    sequence(mistRaw[1], [{ acts: [a('immune_status_turns', { turns: 5, reflect: true })] }], 1),
    sequence(mistRaw[2], [
      { live: true, cond: [c3('stage', { side: 'self', kind: 'down', neg: true }, '出手時不處於能力下降')], acts: [a('status', { side: 'opp', status: '疲憊', chance: 100, turns: 3 })], elseActs: [a('stat_clear', { side: 'self', kind: 'down' })] },
    ], 2),
    sequence(mistRaw[3], [{ acts: [
      a('timed', { turns: 3, from: 'now', trig: 'self_after_use', body: [
        { acts: [a('drain', { flat: 300, true: false })] },
        { chain: 'fail', acts: [a('dmg', { flat: 300, type: '真實' })] },
      ] }),
    ] }], 3),
    memoryEntry(mistRaw[4], [c3('has_turn_effect', { side: 'self' }, '自身處於回合類效果')], [
      { acts: [
        a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'separated', anchor: 'active', body: [
          { acts: [
            a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50 }),
            a('pp_max_offset_selected', { delta: -1, overflowDamage: true, overflowFlat: 50, overflowType: 'skill_extra_action', elem: '超能' }),
          ] },
        ] }),
      ] },
    ], 4),
  ] },
  { elfIds: ['5032'], name: '殞星衝擊', description: meteorRaw.join('\r\n'), kit: [
    property(meteorRaw[0], 'base_priority', 1, 0),
    sequence(meteorRaw[1], [
      { acts: [a('stat_match', { stats: ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] })] },
      // 「每差1點則附加對方1點固定傷害」：差值總和由 stat_match 寫入 lastAmount，以 dmg_from_last 讀取。
      // 原本 flat:0 是佔位值，實際造成 0 傷害（死條款）。
      { chain: 'success', acts: [a('dmg_from_last', { ratio: 1, type: '固定' })] },
    ], 1),
    sequence(meteorRaw[2], [{ acts: [a('reflect_skill_quarter', { turns: 3 })] }], 2),
    sequence(meteorRaw[3], [{ acts: [
      a('timed', { turns: 3, from: 'now', trig: 'damaged_fixed', body: [
        { acts: [a('status', { side: 'opp', status: '睡眠', chance: 100, turns: 3 })] },
      ] }),
    ] }], 3),
    sequence(meteorRaw[4], [{ acts: [
      a('timed', { turns: 3, from: 'now', trig: 'round_end', body: [
        { cond: [c3('no_damage_kind', { kind: '固定' }, '本回合未受到固定傷害')], acts: [a('status', { side: 'opp', status: '沉睡', chance: 100, turns: 3 })] },
      ] }),
    ] }], 4),
    memoryEntry(meteorRaw[5], [c3('opp_pp_changed', {}, '對手PP曾變化')], [
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
];


// ───────── 寰宇幻影閃（第五技，Round 23） ─────────
const flashRaw = ['■ 必中','🎯 消除對手能力提升狀態，消除成功則恢復自身所有技能PP值','🎯 自身每處於1項星附屬異常則額外附加1次對方在場精靈等同於雙方所有場下精靈已損失PP值總和×10的真實傷害並解除自身異常狀態','🎯 若自身不處於異常狀態則使自身當次技能必定觸發變思遷憶且造成非真實傷害翻倍','🎯 未擊敗對手則下2回合自身所有技能先制+2','🎯 擊敗對手則對手下隻出戰精靈出戰前2回合內先制效果失效','■ 變思遷憶：行動階段結束時進行一次額外行動附加對方末位精靈50點超能系技能傷害並分別使自身受到1點超能系技能傷害、固定傷害、百分比傷害、真實傷害，自身本場戰鬥均受到次數達到5次時額外附加5次目標精靈50點超能系技能傷害；自身不處於異常狀態則清除自身本場戰鬥登場次數紀錄與自身在場紀錄令自身下次出戰節點結算時觸發出戰效果；令自身下5次觸發變思遷憶時則取消觸發條件'];

export const MIGRATED_ASTRAL_AESFIA_FLASH: ReviewedSequenceSkill[] = [{
  elfIds: ['5032'], name: '寰宇幻影閃', description: flashRaw.join('\r\n'), kit: [
    property(flashRaw[0], 'sure_hit', true, 0),
    sequence(flashRaw[1], [
      { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [a('pp_op', { side: 'self', mode: 'recover' })] },
    ], 1),
    sequence(flashRaw[2], [
      // 每處於一項星附屬 → 1 次真傷（等量繼承 bench_pp_lost_sum 的 lastAmount）；全部附加後才解除。
      { cond: [c3('has_status', { side: 'self', status: '星賜' }, '星賜')], acts: [a('bench_pp_lost_sum', { mult: 10 }), a('dmg_from_last', { ratio: 1, type: '真實' })] },
      { cond: [c3('has_status', { side: 'self', status: '星哲' }, '星哲')], acts: [a('bench_pp_lost_sum', { mult: 10 }), a('dmg_from_last', { ratio: 1, type: '真實' })] },
      { cond: [c3('has_status', { side: 'self', status: '星贖' }, '星贖')], acts: [a('bench_pp_lost_sum', { mult: 10 }), a('dmg_from_last', { ratio: 1, type: '真實' })] },
      { cond: [c3('has_status', { side: 'self', status: '星佑' }, '星佑')], acts: [a('bench_pp_lost_sum', { mult: 10 }), a('dmg_from_last', { ratio: 1, type: '真實' })] },
      { cond: [c3('has_status', { side: 'self', status: '星護' }, '星護')], acts: [a('bench_pp_lost_sum', { mult: 10 }), a('dmg_from_last', { ratio: 1, type: '真實' })] },
      { cond: [c3('abnormal', { side: 'self' }, '有星附屬被附加過')], acts: [a('cure_status', { side: 'self', cls: '' })] },
    ], 2),
    sequence(flashRaw[3], [
      { cond: [c3('abnormal', { side: 'self', neg: true }, '自身不處於異常狀態')], acts: [
        a('dmg_mod', { dir: 'out', kind: '非真實', boost: 1 }),
        a('pending_counter', { key: 'astralForceMemoryUses', amount: 1, label: '當次必定觸發變思遷憶' }),
      ] },
    ], 3),
    { codeId: 'effect_sequence', node: 'on_hit', source: 'skill', role: 'attached', order: 4,
      customText: flashRaw[4] + '\r\n' + flashRaw[5],
      params: { clause: { raw: flashRaw[4] + '\r\n' + flashRaw[5], marker: '🎯', trig: 'after_hit', parsed: true, body: [
        { cond: [c3('nokill', {}, '未擊敗對手')], acts: [a('prio_turns', { v: 2, turns: 2 })] },
        { cond: [c3('kill', {}, '擊敗對手')], acts: [
          a('turn_key_set', { key: 'nextElfAstralPriority', turns: 2, side: 'opp', reason: '【寰宇幻影閃】', label: '下隻出戰先制失效' }),
        ] },
      ] } },
    },
    { codeId: 'effect_sequence', node: 'after_action', source: 'skill', role: 'innate', order: 5, customText: flashRaw[6],
      params: { clause: { raw: flashRaw[6], marker: '■', trig: 'self_after_skill', parsed: true, body: [
        { acts: [a('queue_extra_action', { label: '變思遷憶', body: [
          { acts: [
            a('astral_select', { side: 'opp', scope: 'team', state: 'any', relation: 'last', anchor: 'active', body: [
              { acts: [a('damage_selected', { type: 'skill_extra_action', elem: '超能', flat: 50 })] },
            ] }),
            a('dmg', { flat: 1, type: '技能', elem: '超能', both: true }),
            a('dmg', { flat: 1, type: '固定', both: true }),
            a('dmg', { flat: 1, type: '百分比', both: true }),
            a('dmg', { flat: 1, type: '真實', both: true }),
          ] },
        ] })] },
      ] } },
    },
  ],
}];


