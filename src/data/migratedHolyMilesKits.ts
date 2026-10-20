// 5030 聖靈邁爾斯（holy-miles）魂印「聖」＋技能「淨世洗禮頌」真 Kit
// （DSH 20261018 第十三批 legacyWrapped 拆解；同批完成＝規則3.4 整份轉換）。
// 舊 handler：src/effects/elves/holy-miles/registry.ts handleHolyMilesSoulMark／HOLY_MILES_SKILLS 已空殼化。
// 使用者裁定（2026-10-17）：淨世洗禮頌「技能無效時效果翻倍1次」＝**保底值翻倍**（非整體傷害翻倍），
//   描述已於 2026-10-18 改寫入文（「保底值額外翻倍」「保底值再翻倍」）。
// 通用件（blocks/ops/holyMiles.ts，DSH 本批建）：
//   hp_steps{side,of,base,cap}（「每有最大體力10%」階梯計數，寫 st.lastAmount）
//   incoming_halve_per_mark{id}（受到非真實傷害依印記層數 0.5^count 乘性逐次減半）
//   repeat_body{from,key,cap,body}（依 lastAmount 迴圈執行——天佑「額外執行1次」）
//   entry_state_snapshot／entry_state_restore（登場狀態快照／還原）
//   death_source_reflect{ratio}（被擊敗時死亡來源等量真實傷害）
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a, property as prop, sequence as seq } from './reviewedSequenceSkillKits';
import type { ReviewedSequenceSkill } from './reviewedSequenceSkillKits';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } } });

const HALVES = 'holyHalves';
const skillEntry = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, role: 'innate' | 'attached' = 'attached'): KitEntry => ({
  ...entry(node, trig, raw, body, order), source: 'skill', role,
});
const pending = a('resource_mark_add', { id: 'holyCleansePending', name: '四象待解除', displayChar: '象', unit: '層', side: 'self', scope: 'elf', persistsOffField: false, amount: 1, maxCount: 1, description: '下次回合開始解除控制與弱化異常並令對手正先制失效' });
const extraPending = (conditions: any[]) => ({ live: true, cond: [...conditions, c('abnormal', { side: 'self' })], acts: [pending] });

// ───────── 魂印「聖」─────────
export const MIGRATED_HOLY_MILES_SOUL_KIT: ReviewedSequenceSkill & { kind: 'soul' } = {
  kind: 'soul',
  elfIds: ['5030'],
  name: '聖',
  description: '【四象】自身專屬特性中每次額外執行效果觸發時若自身同時處於異常狀態則下次執行回合開始時效果則額外解除其中的控制類、弱化類異常且當回合對手先制效果失效；\n【八荒】自身每次受到非真實傷害時減半1次，回合開始時自身每有最大體力10%的當前體力值則額外減半1次；\n【天佑】回合結束時恢復自身最大體力10%並造成對手等量百分比傷害，自身已損失體力每有最大體力10%則額外執行1次；\n【聖怒】自身使用攻擊技能時吸取對手等同於自身最大體力10%的體力值，若對手受到百分比傷害後體力未減少則本回合受到攻擊技能所造成的技能傷害翻倍1次，對方所有精靈中體力比例最高的精靈最大體力每有10%的當前體力值則額外翻倍1次。',
  kit: [
    // 【四象】專屬特性額外執行時處於異常 → 下次回合開始時額外解除控制／弱化類異常＋當回合對手先制失效。
    //   以印記旗標（cleansPending）記錄「待解除」，回合開始兌現（原文時點：下次執行回合開始時效果）。
    entry('round_start', 'round_start', '【四象】若上次額外執行時自身處於異常，則本次回合開始額外解除控制類、弱化類異常且當回合對手先制效果失效', [
      { cond: [c('mark_count', { side: 'self', id: 'holyCleansePending', op: '不小於', amount: 1 }, '有待解除的異常')], acts: [
        a('cure_status', { side: 'self', cls: '控制類' }),
        a('cure_status', { side: 'self', cls: '弱化類' }),
        a('no_pos_prio_turns', { turns: 1 }),
        a('resource_mark_remove', { id: 'holyCleansePending', side: 'self', scope: 'elf' }),
      ] },
    ], 0),
    // 【八荒】回合開始：halves 印記＝1＋floor(當前體力/最大體力×10)（滿血＝11 層→實際以 1+10 計）
    entry('round_start', 'round_start', '【八荒】回合開始時自身每有最大體力10%的當前體力值則額外減半1次（每次受到非真實傷害減半1次）', [
      { acts: [
        a('hp_steps', { side: 'self', basis: 'current', base: 1, cap: 11 }),
        a('resource_mark_set', { id: HALVES, name: '八荒減半', displayChar: '荒', unit: '層', side: 'self', scope: 'elf', persistsOffField: false, fromLastAmount: true, description: '受到非真實傷害時逐次減半的層數' }),
      ] },
    ], 1),
    // 【八荒】受到非真實傷害：依印記層數乘性逐次減半
    entry('before_damage', 'incoming_nontrue', '【八荒】自身每次受到非真實傷害時減半1次（依層數逐次減半）', [
      { acts: [a('incoming_halve_per_mark', { id: HALVES })] },
      { ...extraPending([c('mark_count', { side: 'self', id: HALVES, op: '不小於', amount: 2 })]), chain: 'success' },
    ], 2),
    // 【天佑】回合結束：恢復10%最大體力＋等量百分比傷害；已損失體力每有10%額外執行1次
    entry('round_end', 'round_end', '【天佑】回合結束時恢復自身最大體力10%並造成對手等量百分比傷害，自身已損失體力每有最大體力10%則額外執行1次', [
      { acts: [a('hp_steps', { side: 'self', basis: 'lost', base: 1, cap: 11 })] },
      extraPending([c('last_amount', { op: '不小於', amount: 2 })]),
      { acts: [a('repeat_body', { from: 'lastAmount', cap: 11, body: [
        { acts: [a('heal', { side: 'self', ratio: 0.1 })] },
        { acts: [a('dmg', { base: '最大體力', of: 'self', ratio: 0.1, type: '百分比' })] },
      ] })] },
    ], 3),
    // 【聖怒】使用攻擊技能：吸取對手等同自身最大體力10%
    entry('before_skill', 'before_skill', '【聖怒】自身使用攻擊技能時吸取對手等同於自身最大體力10%的體力值', [
      { cond: [c('skill_kind', { kind: '攻擊' })], acts: [a('drain', { ratio: 0.1, ofSelf: true })] },
    ], 4),
    // 【聖怒】對手受百分比傷害後體力未減少 → 本回合攻擊技能傷害翻倍1次；對方體力比例最高的精靈每10%額外1次
    entry('on_opponent_settlement', 'opp_damage_settled', '【聖怒】若對手受到百分比傷害後體力未減少則本回合受到攻擊技能所造成的技能傷害翻倍1次，對方體力比例最高的精靈最大體力每有10%額外翻倍1次', [
      { cond: [c('event_damage_kind', { kind: '百分比' }), c('event_hp_unchanged', {})], acts: [
        a('hp_steps', { side: 'opp', basis: 'current', base: 1, cap: 11, scope: 'teamMax' }),
        a('damage_multiplier_steps', { base: 2, kind: '攻擊' }),
      ] },
      extraPending([c('event_damage_kind', { kind: '百分比' }), c('event_hp_unchanged', {}), c('last_amount', { op: '不小於', amount: 2 })]),
    ], 5),
  ],
};

// ───────── 技能「淨世洗禮頌」─────────
export const MIGRATED_HOLY_MILES_SKILL_KITS: ReviewedSequenceSkill[] = [{
  elfIds: ['5030'],
  name: '淨世洗禮頌',
  description: '■ 先制+4\n■ 必中\n■ 本次造成技能傷害不少於280，對方在場精靈體力每有10%則保底值額外翻倍1次，技能無效時保底值再翻倍1次\n🎯 給對手造成技能傷害時，傷害數值的100%恢復自身體力，若對手處於異常狀態則附加對手等量百分比傷害\n🎯 3回合內若對手使用屬性技能100%燒傷',
  kit: [
    prop('先制+4', 'base_priority', 4, 0),
    prop('必中', 'sure_hit', true, 1),
    // 保底不少於280；對方在場精靈體力每有10%則保底值額外翻倍1次（施放時快照）；技能無效時保底值再翻倍1次
    skillEntry('before_damage', 'outgoing_attack', '■ 本次造成技能傷害不少於280，對方在場精靈體力每有10%則保底值額外翻倍1次，技能無效時保底值再翻倍1次', [
      { acts: [
        a('damage_floor_flat', { amount: 280, doubleBy: 'foe_hp_deciles', pureIfFloor: true }),
      ] },
    ], 2, 'innate'),
    skillEntry('on_invalid', 'self_invalid', '技能無效時保底值再翻倍1次，仍按技能傷害結算', [
      { acts: [a('damage_floor_flat', { amount: 280, doublings: 1, doubleBy: 'foe_hp_deciles', healRatio: 1 })] },
    ], 5, 'innate'),
    // 造成技能傷害時 100% 恢復自身體力；若對手處於異常狀態則附加對手等量百分比傷害
    seq('🎯 給對手造成技能傷害時，傷害數值的100%恢復自身體力，若對手處於異常狀態則附加對手等量百分比傷害', [
      { acts: [a('vampire', { ratio: 1, kind: '技能' })] },
    ], 3),
    skillEntry('on_hit', 'after_hit', '對手處於異常時附加實際技能傷害等量百分比傷害', [
      { cond: [c('abnormal', { side: 'opp' })], acts: [a('vampire', { ratio: 1, kind: '技能' }), a('dmg_from_last', { ratio: 1, type: '百分比' })] },
    ], 6),
    // 3回合內若對手使用屬性技能100%燒傷
    seq('🎯 3回合內若對手使用屬性技能100%燒傷', [
      { acts: [a('timed', { turns: 3, from: 'now', trig: 'opp_status', body: [{ acts: [a('status', { side: 'opp', status: '燒傷', turns: 3, chance: 100 })] }] })] },
    ], 4),
  ],
}];
