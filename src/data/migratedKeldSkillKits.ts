// 5012 冰魄·柯爾德 凝寒止喧 Kit：先制+3（能力下降再+1）／消回合→屬性無效／
// 90 連擊（每 50 點肅霜之禁 +10 次；自身能力提升/下降時額外翻倍）／無效時冰封或附加失效。
// 新機制：multi_hit{perMarkHits}（印記計數連擊加成；doubleIf 陣列=任一滿足即翻倍 OR 語意）。
// 舊 keld handler 只做消回合——90 連擊/冰封全缺失，Kit 補齊。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 先制+3\n■ 自身處於能力下降時先制+1（總先制+4）\n🎯 消除對手回合類效果，消除成功則2回合內令對手使用的屬性技能無效\n🎯 連續攻擊對手90次，對手每有50點肅霜之禁則額外攻擊10次，自身處於能力提升/下降狀態時效果翻倍\n🎯 技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_KELD_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5012'], name: '凝寒止喧', description: raw, kit: [
    property('■ 先制+3', 'base_priority', 3, 0),
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '■ 自身處於能力下降時先制+1（總先制+4）',
      params: { property: 'conditional_priority', value: 1, conditions: [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降')] } },
    // 消除對手回合類效果，成功 → 2回合對手屬性技能無效
    sequence('消除對手回合類效果，消除成功則2回合內令對手使用的屬性技能無效', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('add_invalid_turns', { kind: '屬性', turns: 2 })] },
    ], 2),
    // 90 連擊；每 50 點肅霜之禁 +10 次；自身能力提升/下降（OR）時額外翻倍
    sequence('連續攻擊對手90次，對手每有50點肅霜之禁則額外攻擊10次，自身處於能力提升/下降狀態時效果翻倍', [
      { acts: [a('multi_hit', {
        min: 90, max: 90,
        perMarkHits: { side: 'opp', id: 'frost_ban', per: 50, extra: 10,
          doubleIf: [
            { c: 'stage', p: { side: 'self', kind: 'up' }, label: '自身能力提升' },
            { c: 'stage', p: { side: 'self', kind: 'down' }, label: '自身能力下降' },
          ] },
      })] },
    ], 3),
    // 技能無效時：消回合 → 100% 冰封；未觸發冰封 → 對手 2 回合攻擊附加效果失效
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 4,
      customText: '技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效',
      params: { clause: { raw: '技能無效時消除對手回合類效果，100%令對手冰封，未觸發冰封則2回合內對手攻擊技能附加效果失效', trig: 'on_invalid', parsed: true, body: [
        { acts: [a('clear_turn', { side: 'opp' }), a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 })] },
        { chain: 'fail', acts: [a('add_invalid_turns', { kind: '攻擊', turns: 2 })] },
      ] } } },
  ] },
];

const burialRaw = '■ 必中\n🎯 5回合內免疫並反彈所有受到的異常狀態\n🎯 100%使對手冰封，未觸發則對手雙防+1\n🎯 附加給對手並解除自身所處的異常狀態，解除成功令對手2回合內對手攻擊技能附加效果失效\n🎯 5回合內每回合吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手體力未減少則附加雙方150點真實傷害與2回合凍傷\n🎯 為對手附加自身攻擊值15%的肅霜之禁';

MIGRATED_KELD_SKILL_KITS.push(
  { elfIds: ['5012'], name: '冰天花葬', description: burialRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 5回合內免疫並反彈所有受到的異常狀態
    sequence('5回合內免疫並反彈所有受到的異常狀態', [
      { acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] },
    ], 1),
    // 100%冰封；未觸發則對手雙防+1
    sequence('100%使對手冰封，未觸發則對手雙防+1', [
      { acts: [a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [a('stat', { side: 'opp', stats: ['防禦', '特防'], v: 1 })] },
    ], 2),
    // （將冰封）附加給對手並解除自身異常；解除成功→對手2回合攻擊附加失效
    sequence('附加給對手並解除自身所處的異常狀態，解除成功令對手2回合內對手攻擊技能附加效果失效', [
      { acts: [
        a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 }),
        a('cure_status', { side: 'self', cls: '' }),
      ] },
      { chain: 'success', acts: [a('add_invalid_turns', { kind: '攻擊', turns: 2 })] },
    ], 3),
    // 5回合每回合吸取⅓（低於½翻倍）；未減少→雙方150真傷+2回合凍傷
    sequence('5回合內每回合吸取對手最大體力的1/3，吸取體力時若自身體力低於最大體力的1/2則吸取效果翻倍，對手體力未減少則附加雙方150點真實傷害與2回合凍傷', [
      { acts: [a('timed', { turns: 5, from: 'now', trig: 'self_skill', initial: true, body: [
        { acts: [a('drain', { ratio: 1 / 3, true: false, x2If: c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '自身體力低於½') })] },
        { cond: [c('last_no_dmg', {}, '對手體力未減少')], acts: [
          a('dmg', { flat: 150, type: '真實', both: true }),
          a('status', { side: 'opp', status: '凍傷', chance: 100, turns: 2 }),
        ] },
      ] })] },
    ], 4),
    // 為對手附加自身攻擊值15%的肅霜之禁（stat_to_last→resource_mark_add）
    sequence('為對手附加自身攻擊值15%的肅霜之禁', [
      { acts: [
        a('stat_to_last', { side: 'self', stat: 'atk', ratio: 0.15 }),
        a('resource_mark_add', { id: 'frost_ban', name: '肅霜之禁', displayChar: '禁', unit: '點', side: 'opp',
          scope: 'elf', persistsOffField: true, ratio: 1,
          description: '造成的技能傷害無法超過點數；觸發或主動下場減少200點。' }),
      ] },
    ], 5),
  ] },
);

const coffinRaw = '■ 必中\n■ 無視自身負先制等級\n🎯 消除敵我雙方回合類效果並同時進入3回合凝滯，自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力\n🎯 敵我雙方同時進入3回合凍傷，自身凍傷狀態解除或是結束時則恢復自身所有技能PP值\n🎯 若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效';

MIGRATED_KELD_SKILL_KITS.push(
  { elfIds: ['5012'], name: '王·蒼銀之棺', description: coffinRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 無視自身負先制等級（本次行動最終先制 <0 時視為 0；引擎結算端讀取）
    { codeId: 'effect_sequence', node: 'modify_priority', source: 'skill', role: 'innate', order: 1,
      customText: '■ 無視自身負先制等級',
      params: { clause: { raw: '無視自身負先制等級', trig: 'modify_priority', parsed: true, body: [
        { acts: [{ op: 'ignore_negative_priority', p: {}, label: '無視自身負先制' }] },
      ] } } },
    // 消除敵我雙方回合類效果並同時進入3回合凝滯；自身凝滯/凍傷解除或結束時恢復全部體力
    sequence('消除敵我雙方回合類效果並同時進入3回合凝滯，自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力', [
      { acts: [
        a('clear_turn', { side: 'both' }),
        a('status', { side: 'both', status: '凝滯', chance: 100, turns: 3 }),
      ] },
    ], 2),
    { codeId: 'effect_sequence', node: 'on_status_ended', source: 'skill', role: 'attached', order: 3,
      customText: '自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力',
      params: { clause: { raw: '自身凝滯、凍傷狀態解除或是結束時則恢復自身所有體力', trig: 'status_end', parsed: true, body: [
        { cond: [c('event_status', { statuses: ['凝滯', '凍傷'] }, '自身凝滯或凍傷結束')], acts: [
          a('heal', { side: 'self', ratio: 1 }),
        ] },
      ] } } },
    // 敵我雙方同時進入3回合凍傷；自身凍傷解除或結束時恢復所有技能PP值
    sequence('敵我雙方同時進入3回合凍傷', [
      { acts: [a('status', { side: 'both', status: '凍傷', chance: 100, turns: 3 })] },
    ], 4),
    { codeId: 'effect_sequence', node: 'on_status_ended', source: 'skill', role: 'attached', order: 5,
      customText: '自身凍傷狀態解除或是結束時則恢復自身所有技能PP值',
      params: { clause: { raw: '自身凍傷狀態解除或是結束時則恢復自身所有技能PP值', trig: 'status_end', parsed: true, body: [
        { cond: [c('event_status', { statuses: ['凍傷'] }, '自身凍傷結束')], acts: [
          a('pp_op', { side: 'self', mode: 'recover' }),
        ] },
      ] } } },
    // 若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效
    sequence('若對手處於凍傷狀態則1回合內100%令對手使用的技能附加效果失效', [
      { cond: [c('has_status', { side: 'opp', status: '凍傷' }, '對手處於凍傷')], acts: [
        a('add_invalid_turns', { kind: 'all', turns: 1 }),
      ] },
    ], 6),
  ] },
);
