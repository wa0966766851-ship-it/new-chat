// 5018 蟲后·奧佩婭 毒噬魂絲 Kit：必中／先制+3／對手提升視為下降（stage_view）／
// 吸取提升→成功→沉默／對手未提升→全屬性-1／吸取⅓（>½翻倍）／無效時恢復½＋下2次視為蟲系。
// 通用 op：stat_steal（chain）、stage_view{opp_up_as_down}、attack_type_view_uses{targetType}（修正舊 handler
// 的 opeiaTreatInsectAttacks 走 targetTypeThisAction 專屬鍵——Kit 走通用 targetTypeOverride 引擎讀取端）。
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const raw = '■ 必中\n■ 先制+3\n■ 將對手能力提升狀態視為能力下降狀態\n🎯 吸取對手能力提升狀態，吸取成功則100%令對手沉默\n🎯 若對手不處於能力提升狀態則全屬性-1\n🎯 吸取對手最大體力⅓，對手體力高於最大體力½時效果翻倍\n🎯 技能無效時，恢復自身最大體力½，下2次攻擊將對手視為蟲系';

const c = (name: string, p: any, label?: string) => ({ c: name, p, label: label || name });

export const MIGRATED_OPEIA_SKILL_KITS: ReviewedSequenceSkill[] = [
  { elfIds: ['5018'], name: '毒噬魂絲', description: raw, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    property('■ 先制+3', 'base_priority', 3, 1),
    // 對手能力提升視為能力下降：僅影響本技能的傷害計算視圖，不改真實等級。
    { codeId: 'skill_property', node: 'before_damage', source: 'skill', role: 'innate', order: 2,
      customText: '■ 將對手能力提升狀態視為能力下降狀態',
      params: { property: 'stage_view', value: 'opp_up_as_down', conditions: [] } },
    // 吸取對手能力提升狀態（成功 → 沉默）
    sequence('吸取對手能力提升狀態，吸取成功則100%令對手沉默', [
      { acts: [a('stat_steal', { mode: '吸取' })] },
      { chain: 'success', acts: [a('status', { side: 'opp', status: '沉默', chance: 100, turns: 3 })] },
    ], 3),
    // 對手不處於能力提升狀態 → 全屬性 -1
    sequence('若對手不處於能力提升狀態則全屬性-1', [
      { cond: [c('stage', { side: 'opp', kind: 'up', neg: true }, '對手未處於能力提升')], acts: [
        a('stat', { side: 'opp', stats: ['全屬性'], v: -1 }),
      ] },
    ], 4),
    // 吸取對手最大體力⅓，對手體力高於½時翻倍
    sequence('吸取對手最大體力⅓，對手體力高於最大體力½時效果翻倍', [
      { acts: [a('drain', { ratio: 1 / 3, true: false, x2If: c('hp_ratio', { side: 'opp', op: '高於', ratio: 0.5 }, '對手體力高於½') })] },
    ], 5),
    // 技能無效時：恢復自身最大體力½，下2次攻擊將對手視為蟲系（通用 targetTypeOverride 引擎讀取端）
    { codeId: 'effect_sequence', node: 'on_invalid', source: 'skill', role: 'attached', order: 6,
      customText: '技能無效時，恢復自身最大體力½，下2次攻擊將對手視為蟲系',
      params: { clause: { raw: '技能無效時，恢復自身最大體力½，下2次攻擊將對手視為蟲系', trig: 'on_invalid', parsed: true, body: [
        { acts: [
          a('heal', { side: 'self', ratio: 0.5 }),
          a('attack_type_view_uses', { uses: 2, targetType: '蟲' }),
        ] },
      ] } } },
  ] },
];

// ─── 王·鏽腑喰心（DSH 20261017 第四批 legacyWrapped 拆解）───
// 舊 handler：opeiaAttackSkills.opeiaRustAttack/finishOpeiaAttack＋opeia 魂印側的
// entrance 疊層／switch_out 重置。通用件：entrance_stack_buff／entrance_reset（ops/entranceStack.ts）＋
// no_resist（微弱→普通，既有 op）＋ignoreSpDefPercentUntilSwitch（既有讀取端）。
const rawWfsx = '■ 必中\n■ 自身處於能力下降狀態時先制+3\n■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）\n🎯 使用技能後附加400點固定傷害並解除能力下降狀態\n🎯 消除對手回合類效果，消除成功則己方免疫下1次所受到的異常狀態\n🎯 自身本次戰鬥自身每登場一次，則自身直到下場前額外先制+1且忽略對手特防值25%，忽略特防值時對手特防值不低於1，下場前自身未擊敗任何對手則重置雙方登場紀錄\n🎯 1回合內對手體力恢復量下降100%且受到攻擊時額外受到對手最大體力30%的真實傷害（綁定對手）';

const entryW = (node: any, trig: string, text: string, body: any[], order: number, role: any = 'attached'): any => ({
  codeId: 'effect_sequence', node, source: 'skill', role, order, customText: text,
  params: { clause: { raw: text, marker: '🎯', trig, parsed: true, body } },
});

MIGRATED_OPEIA_SKILL_KITS.push({
  elfIds: ['5018'], name: '王·鏽腑喰心', description: rawWfsx, kit: [
    property('■ 必中', 'sure_hit', true, 0),
    // ■ 自身處於能力下降狀態時先制+3（條件先制）
    { codeId: 'skill_property', node: 'modify_priority', source: 'skill', role: 'attached', order: 1,
      customText: '■ 自身處於能力下降狀態時先制+3',
      params: { property: 'conditional_priority', value: 3, conditions: [c('stage', { side: 'self', kind: 'down' })] } },
    // ■ 攻擊時造成的傷害不會出現微弱（no_resist：微弱→普通）
    { codeId: 'effect_sequence', node: 'on_skill_use', source: 'skill', role: 'innate', order: 2,
      customText: '■ 攻擊時造成的傷害不會出現微弱（克制關係為微弱時都變成普通）',
      params: { clause: { raw: '■ 攻擊時造成的傷害不會出現微弱', marker: '■', trig: 'use', parsed: true, body: [
        { acts: [a('no_resist', {})] },
      ] } } },
    // 🎯 使用技能後附加400點固定傷害並解除能力下降狀態（技能使用後＝成功後）
    entryW('after_action', 'self_after_skill', '🎯 使用技能後附加400點固定傷害並解除能力下降狀態', [
      { acts: [a('dmg', { flat: 400, type: '固定' }), a('stat_clear', { side: 'self', kind: 'down' })] },
    ], 3),
    // 🎯 消除對手回合類效果，消除成功則己方免疫下1次所受到的異常狀態
    sequence('🎯 消除對手回合類效果，消除成功則己方免疫下1次所受到的異常狀態', [
      { acts: [a('clear_turn', { side: 'opp' })] },
      { chain: 'success', acts: [a('immune_status_count', { count: 1, reflect: false })] },
    ], 4),
    // 🎯 每登場一次：直到下場前額外先制+1且忽略對手特防25%（特防不低於1；下場未擊敗則重置雙方紀錄）
    //   使用時取得＋每次登場刷新（role 攜帶；重複觸發覆蓋同鍵）。
    entryW('on_skill_use', 'use', '🎯 自身本次戰鬥自身每登場一次，則自身直到下場前額外先制+1且忽略對手特防值25%（忽略時特防不低於1）', [
      { acts: [a('entrance_stack_buff', { perEntry: 1, ignoreSpDef: 0.25 })] },
    ], 5),
    entryW('on_entered', 'entrance', '🎯 每次登場時刷新登場疊層（先制+1×次數、忽略特防25%×次數，直到下場）並重置擊敗旗標', [
      { acts: [a('entrance_reset', { clearHistory: false, bothSides: false, clearKillFlag: true }), a('entrance_stack_buff', { perEntry: 1, ignoreSpDef: 0.25 })] },
    ], 6, 'carried'),
    // 擊敗旗標（通用計數器）＋下場未擊敗→重置雙方登場紀錄（含疊層與特防忽略）
    entryW('on_kill', 'kill', '🎯 擊敗對手時記錄（下場重置判讀用）', [
      { acts: [a('pending_counter', { key: 'killsSinceEntrance', amount: 1, label: '本次登場擊敗' })] },
    ], 7, 'carried'),
    entryW('on_switch_out', 'switch_out', '🎯 下場前自身未擊敗任何對手則重置雙方登場紀錄（含疊層與特防忽略）', [
      { cond: [c('player_state', { key: 'killsSinceEntrance', equals: 0, fallback: 0 }, '本次登場未擊敗')], acts: [
        a('entrance_reset', { clearHistory: true, bothSides: true, clearKillFlag: true }),
      ] },
    ], 8, 'carried'),
    // 🎯 1回合內對手體力恢復量下降100%且受到攻擊時額外受到對手最大體力30%的真實傷害（綁定對手）
    sequence('🎯 1回合內對手體力恢復量下降100%且受到攻擊時額外受到對手最大體力30%的真實傷害（綁定對手）', [
      { acts: [
        a('recovery_reduce_turns', { side: 'opp', ratio: 1, turns: 1, includePotions: false, next: false }),
        // 受擊附加30%真傷：原廠先後手規則（next:'auto'——先出手＝當回合可觸發；後出手＝補償+1回合；20261017 使用者澄清）
        a('attack_received_true_turns', { turns: 1, ratio: 0.3, next: 'auto' }),
      ] },
    ], 9),
  ],
});
