// 5028 怒濤·滄嵐 滄海永存 Kit：必中／命中後80%冰封(未觸發→2回合攻擊100%束縛)／
// 恢復1/1(低於½時等量百分比傷害)／400護盾(同源不疊加；消失時對手400固定傷害+100%束縛)。
// 屬性技能無 ON_SKILL_HIT（先前實測）——「命中後」以 on_skill_use 表達。
// 「護盾消失時」走 watch{trig:'shield_broken'}（引擎 SHIELD_BROKEN 事件已接通）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n🎯 命中後80%使對手冰封，未觸發則下2回合攻擊有100%機率使對手束縛\n🎯 恢復自身最大體力的1/1，自身體力低於1/2時造成等量百分比傷害\n🎯 使自身獲得一個可以吸收400點傷害的護盾（相同來源不可疊加），護盾消失時對對手造成400點固定傷害且有100%的機率使對手束縛';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_CANGLAN_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5028'], name: '滄海永存', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 命中後（屬性技能＝使用時）80% 冰封；未觸發 → 2 回合內自身攻擊 100% 束縛
    sequence('命中後80%使對手冰封，未觸發則下2回合攻擊有100%機率使對手束縛', [
      { acts: [a('status', { side: 'opp', status: '冰封', chance: 80, turns: 3 })] },
      { chain: 'fail', acts: [a('timed', { turns: 2, from: 'now', trig: 'self_attack', body: [
        { acts: [a('status', { side: 'opp', status: '束縛', chance: 100, turns: 3 })] },
      ] })] },
    ], 1),
    // 恢復 1/1；體力低於 ½ 時造成等量百分比傷害
    sequence('恢復自身最大體力的1/1，自身體力低於1/2時造成等量百分比傷害', [
      { pre: true, cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 0.5 }, '自身體力低於½')], acts: [
        a('dmg', { base: '最大體力', of: 'self', ratio: 1, type: '百分比' }),
        a('heal', { side: 'self', ratio: 1 }),
      ], elseActs: [
        a('heal', { side: 'self', ratio: 1 }),
      ] },
    ], 2),
    // 400 護盾（同源不疊加）；消失時對手 400 固定傷害 + 100% 束縛
    sequence('使自身獲得一個可以吸收400點傷害的護盾（相同來源不可疊加），護盾消失時對對手造成400點固定傷害且有100%的機率使對手束縛', [
      { acts: [
        a('shield', { flat: 400 }),
        a('watch', { trig: 'shield_broken', body: [
          { acts: [
            a('dmg', { flat: 400, type: '固定' }),
            a('status', { side: 'opp', status: '束縛', chance: 100, turns: 3 }),
          ] },
        ] }),
      ] },
    ], 3),
  ] },
];

const kissRaw = '■ 必中\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時轉變為普通）\n■ 無視對手傷害限制效果\n■ 無視對手攻擊免疫效果\n🎯 消除對手回合類效果，消除成功100%令對手束縛、凍傷、冰封，若均觸發或任意一項未觸發、對手不存在回合類效果或回合類效果無法消除時令自身免疫下2次異常狀態\n🎯 將對手所處的異常狀態轉化為冰封，若對手不處於異常狀態則改為100%令對手冰封\n🎯 附加對手等同於自身最大體力值40%的百分比傷害並附加自身等量護盾（可疊加），自身存在永恆之水時比例改為60%且額外恢復自身等量體力，對手存在千秋一淚時則吸取前額外汲取對手等同於自身最大體力25%的體力';

MIGRATED_CANGLAN_SKILL_KITS.push(
  { elfIds: ['5028'], name: '王·深海之吻', description: kissRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 攻擊不會出現微弱（微弱→普通）：引擎 typeMultiplier 微弱(0.5)提升至 1——查 skill_property 支援？
    // 無視對手傷害限制效果 / 無視對手攻擊免疫效果——查 ignore op：
    // 這三個 ■ 句是固有屬性，若 op 未支援則需保留 handler 或列待接通。先查：
    sequence('■ 無視對手傷害限制效果／無視對手攻擊免疫效果', [
      { acts: [
        a('ignore', { what: '傷害限制' }),
        a('ignore', { what: '攻擊免疫' }),
      ] },
    ], 2),
    // 消回合→三狀態；原文四分支均給免疫（舊 handler 裁定）→無條件免疫2次
    sequence('消除對手回合類效果，消除成功100%令對手束縛、凍傷、冰封，若均觸發或任意一項未觸發、對手不存在回合類效果或回合類效果無法消除時令自身免疫下2次異常狀態', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [
        a('status', { side: 'opp', status: '束縛', chance: 100, turns: 3 }),
        a('status', { side: 'opp', status: '凍傷', chance: 100, turns: 3 }),
        a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 }),
      ] },
      // 四分支均觸發免疫（含失敗與不可消除）——無條件
      { acts: [a('immune_status_count', { count: 2, reflect: false })] },
    ], 4),
    // 對手異常→轉化冰封；無異常→100%冰封
    sequence('將對手所處的異常狀態轉化為冰封，若對手不處於異常狀態則改為100%令對手冰封', [
      { cond: [c('abnormal', { side: 'opp' }, '對手處於異常')], acts: [
        a('convert_status', { side: 'opp', status: '冰封', turns: 3 }),
      ], elseActs: [
        a('status', { side: 'opp', status: '冰封', chance: 100, turns: 3 }),
      ] },
    ], 5),
    // 40%百分比+等量護盾；永恆之水→60%+恢復；千秋一淚→前置汲取25%
    sequence('附加對手等同於自身最大體力值40%的百分比傷害並附加自身等量護盾（可疊加），自身存在永恆之水時比例改為60%且額外恢復自身等量體力，對手存在千秋一淚時則吸取前額外汲取對手等同於自身最大體力25%的體力', [
      { cond: [c('has_mark', { side: 'opp', name: '千秋一淚' }, '對手存在千秋一淚')], acts: [
        a('drain', { ratio: 0.25, true: false }),
      ] },
      { cond: [c('has_mark', { side: 'self', name: '永恆之水' }, '自身存在永恆之水')], acts: [
        a('dmg', { base: '最大體力', of: 'self', ratio: 0.6, type: '百分比' }),
        a('shield_from_last', { ratio: 1 }),
        a('heal_equal', {}),
      ], elseActs: [
        a('dmg', { base: '最大體力', of: 'self', ratio: 0.4, type: '百分比' }),
        a('shield_from_last', { ratio: 1 }),
      ] },
    ], 6),
  ] },
);

const waveRaw = '■ 必中\n■ 若自身處於能力下降狀態時先制+3\n■ 將自身能力下降狀態視為同等級能力提升狀態\n🎯 反轉自身能力下降狀態，反轉成功則附加給對手等量能力下降狀態\n🎯 消耗敵我雙方全部護盾與護罩以令對手下次技能無效，每消耗1點則本次技能威力提升1點，並附加對手等同於雙方消耗量70%的百分比傷害';

MIGRATED_CANGLAN_SKILL_KITS.push(
  { elfIds: ['5028'], name: '王·洛浦凌波', description: waveRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 若自身處於能力下降 → 先制+3
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '■ 若自身處於能力下降狀態時先制+3',
      params: { property: 'conditional_priority', value: 3, conditions: [{ c: 'stage', p: { side: 'self', kind: 'down' }, label: '自身處於能力下降' }] } },
    // 將自身能力下降視為同等級能力提升（skill_property 固有查詢，公式前生效）
    { codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order: 2,
      customText: '■ 將自身能力下降狀態視為同等級能力提升狀態',
      params: { property: 'stage_view', value: 'self_down_as_up', conditions: [] } },
    // 反轉自身能力下降；成功 → 對手等量下降
    sequence('反轉自身能力下降狀態，反轉成功則附加給對手等量能力下降狀態', [
      { acts: [a('stat_reverse', { side: 'self', kind: 'down' })] },
      { chain: 'success', acts: [a('stat_apply_last', { side: 'opp', direction: 'opposite' })] },
    ], 3),
    // 消耗雙方全部護盾護罩（寫消耗量）→ 對手下次技能無效＋威力+消耗量＋對手消耗量70%百分比
    sequence('消耗敵我雙方全部護盾與護罩以令對手下次技能無效，每消耗1點則本次技能威力提升1點，並附加對手等同於雙方消耗量70%的百分比傷害', [
      { acts: [
        a('clear_shield', { side: 'both', kind: 'both' }),
        a('invalid_next', { kind: 'all', uses: 1 }),
        a('dmg_from_last', { ratio: 0.7, type: '百分比' }),
      ] },
    ], 4),
    // 威力+消耗量（modify_power 節點，讀同一 lastAmount）
    { codeId: 'effect_sequence', node: 'modify_power', source: 'skill', role: 'innate', order: 5,
      customText: '每消耗1點則本次技能威力提升1點',
      params: { clause: { raw: '每消耗1點則本次技能威力提升1點', trig: 'outgoing_power', parsed: true, body: [
        { acts: [a('power_from_last', { ratio: 1 })] },
      ] } } },
  ] },
);

const oathRaw = '■ 必中\n🎯 令自身特攻、防禦、特防、速度、命中+1，擁有護盾時強化效果翻倍\n🎯 5回合內免疫並反彈所有異常狀態，技能無效時改為使自身免疫並反彈下2次異常狀態\n🎯 下2回合攻擊傷害提升150%，技能無效時改為抵擋下次攻擊並附加500點護盾\n🎯 獲得1道永恆之水，若對手千秋一淚滴數高於自身永恆之水時額外獲得等同於差值的永恆之水，若道數為滿則令對手束縛，技能無效時獲得永恆之水道數翻倍且令對手進入束縛效果取消觸發條件\n🎯 下2回合自身所有技能先制+3，技能無效時改為自身下回合無視對手正先制效果';

MIGRATED_CANGLAN_SKILL_KITS.push(
  { elfIds: ['5028'], name: '永恆誓約', description: oathRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 特攻/防禦/特防/速度/命中+1，擁有護盾時翻倍
    sequence('令自身特攻、防禦、特防、速度、命中+1，擁有護盾時強化效果翻倍', [
      { acts: [a('stat', { side: 'self', stats: ['特攻', '防禦', '特防', '速度', '命中'], v: 1, chance: 100,
        x2If: { c: 'shield', p: { side: 'self' }, label: '擁有護盾' } })] },
    ], 1),
    // 5回合免疫反彈；無效時改為免疫並反彈下2次
    sequence('5回合內免疫並反彈所有異常狀態', [
      { acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] },
    ], 2),
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 3,
      customText: '技能無效時改為使自身免疫並反彈下2次異常狀態',
      params: { clause: { raw: '技能無效時改為使自身免疫並反彈下2次異常狀態', trig: 'on_invalid', parsed: true, body: [
        { acts: [a('immune_status_count', { count: 2, reflect: true })] },
      ] } } },
    // 下2回合攻傷+150%；無效時改為抵擋下次攻擊+500護盾
    sequence('下2回合攻擊傷害提升150%', [
      { acts: [a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '攻擊', boost: 1.5, turns: 2 })] },
    ], 4),
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 5,
      customText: '技能無效時改為抵擋下次攻擊並附加500點護盾',
      params: { clause: { raw: '技能無效時改為抵擋下次攻擊並附加500點護盾', trig: 'on_invalid', parsed: true, body: [
        { acts: [
          a('block_damage_uses', { uses: 1, kind: '技能', key: 'oath_block' }),
          a('shield', { flat: 500 }),
        ] },
      ] } } },
    // 永恆之水：+1道；對手淚>自身水→補差值；滿→對手束縛；無效時→翻倍+無條件束縛
    sequence('獲得1道永恆之水', [
      { acts: [
        a('resource_mark_add', { id: 'blk_永恆之水', name: '永恆之水', displayChar: '水', unit: '道', side: 'self',
          scope: 'elf', persistsOffField: true, amount: 1, maxCount: 8,
          description: '水之國度的祝福印記；王·深海之吻等效果依道數增強。' }),
        a('mark_gap_to_last', { sideA: 'self', idA: 'blk_永恆之水', sideB: 'opp', idB: 'blk_千秋一淚' }),
      ] },
      { chain: 'success', acts: [
        a('resource_mark_add', { id: 'blk_永恆之水', name: '永恆之水', displayChar: '水', unit: '道', side: 'self',
          scope: 'elf', persistsOffField: true, ratio: 1, maxCount: 8,
          description: '水之國度的祝福印記；王·深海之吻等效果依道數增強。' }),
      ] },
    ], 6),
    { codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 7,
      customText: '若道數為滿則令對手束縛',
      params: { clause: { raw: '若道數為滿則令對手束縛', trig: 'use', parsed: true, body: [
        { cond: [{ c: 'mark_count', p: { side: 'self', id: 'blk_永恆之水', op: '不小於', amount: 8 }, label: '永恆之水為滿' }], acts: [
          a('status', { side: 'opp', status: '束縛', chance: 100, turns: 3 }),
        ] },
      ] } } },
    // 下2回合先制+3；無效時改為下回合無視對手正先制
    sequence('下2回合自身所有技能先制+3', [
      { acts: [a('prio_turns', { turns: 2, v: 3 })] },
    ], 8),
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 9,
      customText: '技能無效時改為自身下回合無視對手正先制效果',
      params: { clause: { raw: '技能無效時改為自身下回合無視對手正先制效果', trig: 'on_invalid', parsed: true, body: [
        { acts: [a('no_pos_prio_turns', { turns: 1, next: true })] },
      ] } } },
  ] },
);
