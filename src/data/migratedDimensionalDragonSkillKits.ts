// 5021 治癒.龍魂再臨 次元龍 閱世 Kit：先制+3／對手回合類→增傷100%+消回合／
// 吸取提升→下2次屬性無效(未觸發→全屬性+1)／龍魂分支（覺醒時：無視對手正先制+增傷100%+無效分支）。
// 新 cond：dragon_soul（dimensionalDragonSoul 覺醒鍵）——龍魂此前僅在舊 handler 讀取。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 先制+3\n🎯 若對手處於回合類效果則傷害提升100%並消除回合類效果\n🎯 吸取對手能力提升狀態，吸取成功則令對手下2次屬性技能無效，若未觸發則令自身全屬性+1\n■ 龍魂：當自身處於龍魂時發動，此技能無視對手正先制等級，傷害額外提升100%，若此技能無效，消除回合類效果並令對手詛咒';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_DIMENSIONAL_DRAGON_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5021'], name: '閱世', description: raw, kit: [
    property('■ 先制+3', 'base_priority', 3, 0),
    sequence('若對手處於回合類效果則傷害提升100%並消除回合類效果', [
      { cond: [c('has_turn_effect', { side: 'opp' }, '對手處於回合類效果')], acts: [
        a('boost', { mult: 2, kind: '技能' }),
        a('clear_turn', { side: 'opp' }),
      ] },
    ], 1),
    sequence('吸取對手能力提升狀態，吸取成功則令對手下2次屬性技能無效，若未觸發則令自身全屬性+1', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('invalid_next', { kind: '屬性', uses: 2 })] },
      { chain: 'fail', acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1 })] },
    ], 2),
    // 龍魂無視對手正先制（先制判定前掛對手）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'innate', order: 3,
      customText: '龍魂：當自身處於龍魂時發動，此技能無視對手正先制等級',
      params: { property:'ignore_positive_priority',value:true,conditions:[c('dragon_soul', {}, '自身處於龍魂')] } },
    // 龍魂傷害額外提升100%（使用時）
    sequence('龍魂：當自身處於龍魂時發動，傷害額外提升100%', [
      { cond: [c('dragon_soul', {}, '自身處於龍魂')], acts: [
        a('boost', { mult: 2, kind: '技能' }),
      ] },
    ], 4),
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 5,
      customText: '龍魂：若此技能無效，消除回合類效果並令對手詛咒',
      params: { clause: { raw: '龍魂：若此技能無效，消除回合類效果並令對手詛咒', trig: 'on_invalid', parsed: true, body: [
        { cond: [c('dragon_soul', {}, '自身處於龍魂')], acts: [
          a('clear_turn', { side: 'opp' }),
          a('status', { side: 'opp', status: '詛咒', chance: 100, turns: 3 }),
        ] },
      ] } } },
  ] },
];

const decreeRaw = '■ 必中\n🎯 5回合內免疫並反彈異常狀態\n🎯 命中後令對手害怕，未觸發則為自身附加1篇詩章\n🎯 3回合內對手使用攻擊技能，使用攻擊技能後的下2回合屬性技能附加效果失效\n🎯 3回合內對手使用屬性技能後，自身吸取對手最大體力的1/3\n■ 龍魂：當自身處於龍魂時發動，對手處於異常狀態時自身免疫下2次異常狀態，對手不處於異常時，1回合內自身抵擋所有非真實傷害';

MIGRATED_DIMENSIONAL_DRAGON_SKILL_KITS.push(
  { elfIds: ['5021'], name: '敕界歸元', description: decreeRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 5回合內免疫並反彈異常狀態
    sequence('5回合內免疫並反彈異常狀態', [
      { acts: [a('immune_status_turns', { turns: 5, reflect: true, cls: '' })] },
    ], 1),
    // 命中後令對手害怕；未觸發 → 自身附加1篇詩章
    sequence('命中後令對手害怕，未觸發則為自身附加1篇詩章', [
      { acts: [a('status', { side: 'opp', status: '害怕', chance: 100, turns: 3 })] },
      { chain: 'fail', acts: [
        a('resource_mark_add', { id: 'poem_chapter', name: '詩章', displayChar: '詩', unit: '篇', side: 'self',
          scope: 'elf', persistsOffField: true, amount: 1, snapshotKey: 'poemHpSnapshots',
          description: '紀錄持有者精靈的體力上限，當持有精靈死亡時轉移給存活的治癒.龍魂再臨次元龍。' }),
      ] },
    ], 2),
    // 3回合內對手使用攻擊技能 → 其後2回合屬性技能附加效果失效（掛對手）
    sequence('3回合內對手使用攻擊技能，使用攻擊技能後的下2回合屬性技能附加效果失效', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'opp_attack', skillKind: '攻擊', body: [
        { acts: [a('add_invalid_turns', { kind: '屬性', turns: 2, next: true })] },
      ] })] },
    ], 3),
    // 3回合內對手使用屬性技能後 → 自身吸取對手最大體力的1/3
    sequence('3回合內對手使用屬性技能後，自身吸取對手最大體力的1/3', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'opp_skill', skillKind: '屬性', body: [
        { acts: [a('drain', { ratio: 1 / 3, true: false })] },
      ] })] },
    ], 4),
    // 龍魂分支：對手異常→免疫下2次；對手無異常→1回合抵擋非真實
    sequence('龍魂：當自身處於龍魂時發動，對手處於異常狀態時自身免疫下2次異常狀態', [
      { cond: [c('dragon_soul', {}, '龍魂'), c('abnormal', { side: 'opp' }, '對手處於異常')], acts: [
        a('immune_status_count', { count: 2, reflect: false }),
      ] },
      { cond: [c('dragon_soul', {}, '龍魂'), c('abnormal', { side: 'opp', neg: true }, '對手不處於異常')], acts: [
        a('dmg_mod_turns', { side: 'self', dir: 'in', kind: '非真實', reduce: 1, turns: 1 }),
      ] },
    ], 5),
  ] },
);

const poemRaw = '■ 必中\n🎯 全屬性+1，自身持有詩章則效果翻倍，自身不存在詩章則為自身附加4篇詩章\n🎯 吸取對手最大體力的1/3，自身持有大於3篇詩章效果翻倍\n🎯 下2回合先制+2，自身先制等級大於0時提升為先制+3\n🎯 下2回合對手受到的攻擊傷害提升150%\n■ 龍魂：當自身處於龍魂時發動，對手每有1點PP值附加50點次元龍系技能傷害且下2回合對手無法主動切換精靈，雙方每存在1個PP值為滿的技能則翻倍1次';

MIGRATED_DIMENSIONAL_DRAGON_SKILL_KITS.push(
  { elfIds: ['5021'], name: '告命詩途', description: poemRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 全屬性+1（持有詩章翻倍）；不存在詩章 → +4篇詩章
    sequence('全屬性+1，自身持有詩章則效果翻倍，自身不存在詩章則為自身附加4篇詩章', [
      { acts: [a('stat', { side: 'self', stats: ['全屬性'], v: 1, chance: 100,
        x2If: c('has_mark', { side: 'self', name: 'poem_chapter' }, '持有詩章') })] },
      { cond: [c('has_mark', { side: 'self', name: 'poem_chapter', neg: true }, '不存在詩章')], acts: [
        a('resource_mark_add', { id: 'poem_chapter', name: '詩章', displayChar: '詩', unit: '篇', side: 'self',
          scope: 'elf', persistsOffField: true, amount: 4, snapshotKey: 'poemHpSnapshots',
          description: '紀錄持有者精靈的體力上限，當持有精靈死亡時轉移給存活的治癒.龍魂再臨次元龍。' }),
      ] },
    ], 1),
    // 吸取⅓；持有>3篇詩章翻倍（2/3）
    sequence('吸取對手最大體力的1/3，自身持有大於3篇詩章效果翻倍', [
      { cond: [c('mark_count', { side: 'self', id: 'poem_chapter', op: '高於', amount: 3 }, '詩章大於3篇')], acts: [
        a('drain', { ratio: 2 / 3, true: false }),
      ], elseActs: [
        a('drain', { ratio: 1 / 3, true: false }),
      ] },
    ], 2),
    // 下2回合先制+2；持有詩章（先制等級>0）提升為+3
    sequence('下2回合先制+2，自身先制等級大於0時提升為先制+3', [
      { cond: [c('action_priority', { side: 'self', op: '高於', amount: 0 }, '先制等級大於0')], acts: [
        a('prio_turns', { turns: 2, v: 3 }),
      ], elseActs: [
        a('prio_turns', { turns: 2, v: 2 }),
      ] },
    ], 3),
    // 下2回合對手受到的攻擊傷害提升150%
    sequence('下2回合對手受到的攻擊傷害提升150%', [
      { acts: [a('dmg_mod_turns', { side: 'opp', dir: 'taken', kind: '攻擊', boost: 1.5, turns: 2, next: true })] },
    ], 4),
    // 龍魂：對手每1點PP附加50點次元龍技能傷害（per 計數）＋雙方每滿PP技能翻倍1次（×2^n）＋2回合鎖切換
    sequence('龍魂：當自身處於龍魂時發動，對手每有1點PP值附加50點次元龍系技能傷害且下2回合對手無法主動切換精靈，雙方每存在1個PP值為滿的技能則翻倍1次', [
      { cond: [c('dragon_soul', {}, '龍魂')], acts: [
        a('dmg', { flat: 50, type: '技能', elem: '次元龍', appendToAttack: true, per: 'opp_pp_sum', doublePer: 'sides_full_pp_skills' }),
        a('no_switch', { turns: 2, next: true }),
      ] },
    ], 5),
  ] },
);

const gospelRaw = '■ 必中\n🎯 若自身處於能力下降先制+3並使對手下次攻擊技能無效\n🎯 未擊敗對手下2回合先制+2\n■ 龍魂：當自身處於龍魂時發動，雙方技能每有1點PP值附加50點次元龍系技能傷害，對方PP值均為滿時效果翻倍；下次擊敗對手恢復全部體力和PP值';

MIGRATED_DIMENSIONAL_DRAGON_SKILL_KITS.push(
  { elfIds: ['5021'], name: '神懺福音之章', description: gospelRaw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // 若自身處於能力下降 → 先制+3 並使對手下次攻擊技能無效
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '若自身處於能力下降先制+3',
      params: { property: 'conditional_priority', value: 3, conditions: [{ c: 'stage', p: { side: 'self', kind: 'down' }, label: '自身處於能力下降' }] } },
    sequence('若自身處於能力下降，使對手下次攻擊技能無效', [
      { cond: [c('stage', { side: 'self', kind: 'down' }, '自身處於能力下降')], acts: [
        a('invalid_next', { kind: '攻擊', uses: 1 }),
      ] },
    ], 2),
    // 未擊敗對手 → 下2回合先制+2
    sequence('未擊敗對手下2回合先制+2', [
      { acts: [a('watch', { trig: 'not_killed', body: [
        { acts: [a('prio_turns', { turns: 2, v: 2 })] },
      ] })] },
    ], 3),
    // 龍魂：雙方每1點PP附加50點次元龍技能傷害；對方PP均滿時×2；下次擊敗→恢復全部體力與PP
    sequence('龍魂：當自身處於龍魂時發動，雙方技能每有1點PP值附加50點次元龍系技能傷害，對方PP值均為滿時效果翻倍', [
      { cond: [c('dragon_soul', {}, '龍魂')], acts: [
        a('dmg', { flat: 50, type: '技能', elem: '次元龍', per: 'sides_pp_sum',
          x2If: { c: 'skill_pp_all', p: { side: 'opp' }, label: '對方PP均為滿' } }),
      ] },
    ], 4),
    { codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'attached', order: 5,
      customText: '龍魂：下次擊敗對手恢復全部體力和PP值',
      params: { clause: { raw: '龍魂：下次擊敗對手恢復全部體力和PP值', trig: 'use', parsed: true, body: [
        { cond: [c('dragon_soul', {}, '龍魂')], acts: [
          a('watch', { trig: 'kill', body: [
            { acts: [
              a('heal', { side: 'self', ratio: 1 }),
              a('pp_op', { side: 'self', mode: 'recover' }),
            ] },
          ] }),
        ] },
      ] } } },
  ] },
);
