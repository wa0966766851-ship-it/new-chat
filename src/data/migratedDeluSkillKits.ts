// 5009 誑獅魔軀.魔獅迪露 劫盡歸塵 Kit（DSH 20261017 接線；counter_spend 新通用 op）。
// 行為對齊舊 handler（delu/registry.ts：消回合/三異常/一次性痊癒/免疫回饋/隨機PP歸零）＋文本補實
// （「技能無效時」分支舊 handler 未實作，依原廠語意＝miss/閃避/免疫一併觸發）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });
const at = (node: any, trig: string, text: string, body: any[], order: number): KitEntryLike => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'attached', order, customText: text,
  params: { clause: { raw: text, marker: '🎯', trig, parsed: true, body } },
});
/** 跨回合攜帶監控：attached 只在本次使用行動中生效；持續監控（免疫成功／異常結束）需 carried（connectedEffects 選槽過濾）。 */
const carried = (node: any, trig: string, text: string, body: any[], order: number): KitEntryLike => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'carried', order, customText: text,
  params: { clause: { raw: text, marker: '🎯', trig, parsed: true, body } },
});
type KitEntryLike = { codeId: 'effect_sequence'; node: any; source: 'skill'; role: 'attached' | 'carried' | 'innate'; order: number; customText: string; params: { clause: { raw: string; marker: string; trig: string; parsed: boolean; body: any[] } } };

const raw = '■ 先制+2\n■ 必中\n🎯 消除雙方回合類效果並為雙方附加中毒、凍傷、燒傷\n🎯 上述任意異常結束或解除時自身恢復全部體力\n🎯 令己方免疫下2次異常狀態，免疫成功則在場精靈恢復自身最大體力⅓並造成等量百分比傷害\n🎯 令對手隨機3個不為0的技能PP值歸0\n🎯 技能無效時，消除對手回合類效果，100%令對手感染';

export const MIGRATED_DELU_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5009'], name: '劫盡歸塵', description: raw,
    kit: [
      // ■ 先制+2／■ 必中（固有屬性）
      property('■ 先制+2', 'base_priority', 2, 0),
      property('■ 必中', 'sure_hit', true, 1),
      // 🎯 消除雙方回合類效果並為雙方附加中毒、凍傷、燒傷
      sequence('消除雙方回合類效果並為雙方附加中毒、凍傷、燒傷', [
        { acts: [
          a('clear_turn', { side: 'both' }),
          a('status', { side: 'both', status: '中毒', turns: 2, chance: 100 }),
          a('status', { side: 'both', status: '凍傷', turns: 2, chance: 100 }),
          a('status', { side: 'both', status: '燒傷', turns: 2, chance: 100 }),
        ] },
      ], 2),
      // 🎯 上述任意異常結束或解除時自身恢復全部體力（持有者視角同舊 handler；本場一次）
      // 跨回合監控：role 攜帶（carried）——attached 只在本次使用行動中生效（connectedEffects 選槽過濾）。
      carried('on_status_ended', 'status_end', '上述任意異常結束或解除時自身恢復全部體力', [
        { cond: [c('event_status', { statuses: ['中毒', '凍傷', '燒傷'] }, '上述任意異常')], acts: [
          a('once', { key: 'delu_jjgc_statusEndHeal', body: [{ acts: [a('heal', { side: 'self', ratio: 1 })] }] }),
        ] },
      ], 3),
      // 🎯 令己方免疫下2次異常狀態（回饋計數同步建檔）
      sequence('令己方免疫下2次異常狀態，免疫成功則在場精靈恢復自身最大體力⅓並造成等量百分比傷害', [
        { acts: [
          a('immune_status_count', { count: 2, reflect: false }),
          a('pending_counter', { key: 'delu_jjgc_immuneHealCharges', amount: 2, label: '劫盡歸塵·免疫回饋' }),
        ] },
      ], 4),
      // 🎯 免疫成功：花用回饋計數 → 恢復⅓ → 等量百分比傷害（次數用盡即停）
      // 跨回合監控：role 攜帶（carried）——免疫發生在任何時點（含非本技能行動中）。
      carried('on_status_immunized', 'status_immune', '免疫成功則在場精靈恢復自身最大體力⅓並造成等量百分比傷害', [
        { acts: [
          a('counter_spend', { key: 'delu_jjgc_immuneHealCharges', amount: 1, label: '劫盡歸塵·免疫回饋', body: [
            { acts: [a('heal', { side: 'self', ratio: 1 / 3 })] },
            { acts: [a('dmg_from_last', { ratio: 1, type: '百分比' })] },
          ] }),
        ] },
      ], 5),
      // 🎯 令對手隨機3個不為0的技能PP值歸0
      sequence('令對手隨機3個不為0的技能PP值歸0', [
        { acts: [a('pp_zero_random', { count: 3 })] },
      ], 6),
      // 🎯 技能無效時，消除對手回合類效果，100%令對手感染
      at('on_invalid', 'on_invalid', '技能無效時，消除對手回合類效果，100%令對手感染', [
        { acts: [
          a('clear_turn', { side: 'opp' }),
          a('status', { side: 'opp', status: '感染', turns: 2, chance: 100 }),
        ] },
      ], 7),
    ],
  },
];

// ─── 辟冥·鎮獄斷（DSH 20261017 第三批 legacyWrapped 拆解）───
// 舊 handler 只實作「消提升→三異常／未擊敗→下次先制+2」兩句；其餘 ■ 句依原文補實：
// 無視正先制（ignore_positive_priority）、雙攻總和（atk_sum_calc＋power_add_stat 新通用 op）、
// 特攻/攻擊分支（stat_cmp 新通用條件）、180 閾值雙方真傷（last_hp_lost＋dmg{both}）。
const rawBmsy = '■ 必中\n■ 無視對手正先制效果\n■ 計算攻擊傷害時雙攻值視為二者之和且技能威力提升其總和的18.7%\n■ 特攻不小於攻擊時先制額外+1且無視對手傷害限制效果\n■ 攻擊不少於特攻則無視對手免疫效果並吸取對手等同於自身體力0.0187%的體力\n■ 對手體力減少量低於180時則附加雙方187點真實傷害\n🎯 消除對手能力提升狀態，消除成功則對手100%感染、冰封、焚燼\n🎯 未擊敗對手則自身下次使用技能額外先制+2';

const atB = (node: any, trig: string, text: string, body: any[], order: number): KitEntryLike => ({
  codeId: 'effect_sequence', node, source: 'skill', role: 'attached', order, customText: text,
  params: { clause: { raw: text, marker: '🎯', trig, parsed: true, body } },
});
const innateB = (trig: string, text: string, body: any[], order: number): KitEntryLike => ({
  codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'innate', order, customText: text,
  params: { clause: { raw: text, marker: '■', trig, parsed: true, body } },
});

MIGRATED_DELU_SKILL_KITS.push({
  elfIds: ['5009'], name: '辟冥·鎮獄斷', description: rawBmsy, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // ■ 無視對手正先制效果（固有查詢；先制結算時讀取）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'innate', order: 1,
      customText: '■ 無視對手正先制效果',
      params: { property: 'ignore_positive_priority', value: true, conditions: [] } },
    // ■ 計算攻擊傷害時雙攻值視為二者之和（傷害公式讀取鍵）＋威力提升其總和的18.7%（power_add_stat 新通用 op）
    innateB('use', '■ 計算攻擊傷害時雙攻值視為二者之和', [{ acts: [a('atk_sum_calc', {})] }], 2),
    { codeId: 'effect_sequence', node: 'modify_power', source: 'skill', role: 'innate', order: 3,
      customText: '■ 技能威力提升雙攻值總和的18.7%',
      params: { clause: { raw: '■ 技能威力提升雙攻值總和的18.7%', marker: '■', trig: 'outgoing_power', parsed: true, body: [
        { acts: [a('power_add_stat', { stats: ['atk', 'spatk'], ratio: 0.187 })] },
      ] } } },
    // ■ 特攻不小於攻擊時先制額外+1（條件先制）且無視對手傷害限制效果（stat_cmp 新通用條件）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 4,
      customText: '■ 特攻不小於攻擊時先制額外+1',
      params: { property: 'conditional_priority', value: 1, conditions: [
        c('stat_cmp', { side: 'self', statA: 'spatk', statB: 'atk', op: '不小於' }),
      ] } },
    innateB('use', '■ 特攻不小於攻擊時無視對手傷害限制效果', [
      { cond: [c('stat_cmp', { side: 'self', statA: 'spatk', statB: 'atk', op: '不小於' })], acts: [a('ignore', { what: '傷害限制' })] },
    ], 5),
    // ■ 攻擊不少於特攻則無視對手免疫效果並吸取對手等同於自身體力0.0187%的體力（固定傷害＋等量回復＝吸取）
    innateB('use', '■ 攻擊不少於特攻則無視對手免疫效果並吸取對手等同於自身體力0.0187%的體力', [
      { cond: [c('stat_cmp', { side: 'self', statA: 'atk', statB: 'spatk', op: '不小於' })], acts: [
        a('ignore', { what: '攻擊免疫' }),
        a('dmg', { base: '最大體力', of: 'self', ratio: 0.000187, type: '固定' }),
        a('heal_equal', {}),
      ] },
    ], 6),
    // ■ 對手體力減少量低於180時則附加雙方187點真實傷害（last_hp_lost 條件＋dmg{both}）
    atB('on_hit', 'after_hit', '■ 對手體力減少量低於180時則附加雙方187點真實傷害', [
      { cond: [c('dmg_cmp', { op: '低於', v: 180 })], acts: [a('dmg', { flat: 187, type: '真實', both: true })] },
    ], 7),
    // 🎯 消除對手能力提升狀態，消除成功則對手100%感染、冰封、焚燼
    sequence('🎯 消除對手能力提升狀態，消除成功則對手100%感染、冰封、焚燼', [
      { acts: [a('stat_clear', { side: 'opp', kind: 'up' })] },
      { chain: 'success', acts: [
        a('status', { side: 'opp', status: '感染', turns: 2, chance: 100 }),
        a('status', { side: 'opp', status: '冰封', turns: 2, chance: 100 }),
        a('status', { side: 'opp', status: '焚燼', turns: 2, chance: 100 }),
      ] },
    ], 8),
    // 🎯 未擊敗對手則自身下次使用技能額外先制+2（prio_next 次數型先制）
    atB('on_not_killed', 'not_killed', '🎯 未擊敗對手則自身下次使用技能額外先制+2', [
      { acts: [a('prio_next', { uses: 1, v: 2 })] },
    ], 9),
  ],
});
