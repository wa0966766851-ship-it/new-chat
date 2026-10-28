// 5029 異境神霆·雷伊 魂印「異」＋專屬特質「神明」「雷神」真 Kit（legacyWrapped 拆解組 4；DSH 20261018）。
// 舊 handler：otherworld-rey/registry.ts handleOtherworldReySoulMark 整份空殼化（保留匯出名與純函式 helper），
//   SOUL_MARK_MAPPING 5029 鍵與 tests/fixtures/elfRegistryBeforeMove.json souls 同步移除；技能「霆·禁雷敕令」的
//   handler（OTHERWORLD_REY_SKILLS／OTHERWORLD_REY_SKILL_TRANSFORMS）同步移除，Kit 見 migratedReySkillKits.ts。
// 新通用件：blocks/ops/thunderGod.ts（alien_category／survival_rule／elf_trait／stage_copy_up／drain_stage_sum／
//   drain_body_weight／calc_stat_mult／dmg_scale_by_lost_hp／heal_share_bench／alien_entry_cost／round_fact／
//   nullify_incoming＋條件 god_descent／no_nontrue_damage＋技能固有查詢 skill_transform）。
// 引擎既有讀取端不動：精靈旗標（treatOpponentBoostAsDoubleDrop 等 7 個，由 elf_trait 於戰鬥開始寫入，不再放在精靈種子資料）、
//   survivalRules（神降規則）、damageCalculator（calcAtkDefMult／blkAtkSpatkSum）。
// G4：雷神非滿體力段落設閘；至少70點恢復，場下隊友按實際體力增加量分享。
// 雙攻總和沿用 atk_sum_calc，先制讀取回合開始條件快照。
import type { KitEntry } from '../effects/effectSystem.schema';
import { action as a } from './reviewedSequenceSkillKits';
import { OTHERWORLD_REY_TEXT } from './otherworldReyDescriptions';

const c = (id: string, p: any, label?: string) => ({ c: id, p, label: label || id });
const entry = (source: 'soulmark' | 'mechanic', node: KitEntry['node'], trig: string, raw: string, body: any[], order: number, cond?: any[]): KitEntry => ({
  codeId: 'effect_sequence', source, role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, ...(cond ? { cond } : {}), body } },
});
const trait = (flag: string, value: any = true) => a('elf_trait', { flag, value });

const paralyzed = c('has_status', { side: 'self', status: '麻痺' }, '自身處於麻痺');
const selfAbnormal = c('abnormal', { side: 'self' }, '自身處於異常狀態');
const attackSkill = c('skill_kind', { kind: '攻擊' }, '使用攻擊技能');
const oppUp = c('stage', { side: 'opp', kind: 'up' }, '對手處於能力提升');

// ───────── 魂印「異」 ─────────
const SOUL = 'soulmark' as const;
const copyRaw = '複製對手能力提升狀態。\n\n複製成功則令自身麻痺。\n若對手不處於能力提升狀態，則令自身攻擊、速度、命中+2，當回合自身所有技能先制+1。';
const collapseRaw = '對手每次回合類效果開始時變為1回合。\n\n觸發成功則當回合令自身麻痺。\n每減少1回合令自身麻痺回合數+1。';
const paralysisRaw = '若處於麻痺異常狀態，則額外令自身所處的異常狀態效果附帶效果失效（仍然處於異常），改為造成技能傷害提升70%。';
const drainRaw = '吸取對手雙方能力等級總和*70的體力值。\n\n吸取前若自身處於異常狀態，則汲取對手等同於自身當前重量的體力值，且上述吸取體力改為汲取體力。';

export const MIGRATED_REY_SOUL_KIT = {
  kind: 'soul' as const,
  elfIds: ['5029'],
  name: '異',
  description: OTHERWORLD_REY_TEXT.soul,
  kit: [
    // 【回合開始時】（在場）
    entry(SOUL, 'round_start', 'round_start', copyRaw, [
      { acts: [a('flag_set',{key:'roundPriorityBranch',value:false,thisRound:true})] },
      { cond:[c('stage',{side:'opp',kind:'up',neg:true})],acts:[a('flag_set',{key:'roundPriorityBranch',value:true,thisRound:true})] },
      { acts: [a('stage_copy_up', {})] },
      { chain: 'success', acts: [a('status_or_extend', { side: 'self', status: '麻痺', turns: 1, extend: 1 })] },
      { cond: [c('stage', { side: 'opp', kind: 'up', neg: true }, '對手不處於能力提升')], acts: [
        a('stat', { side: 'self', stats: ['攻擊', '速度', '命中'], v: 2 }),
      ] },
    ], 0),
    // 【觸發效果】（旗標由引擎既有讀取端承載；戰鬥開始時寫入，背包內持有者亦先就位）
    entry(SOUL, 'battle_start', 'battle_start', '自身將對手能力提升狀態視為同等級2倍能力下降狀態。', [{ acts: [trait('treatOpponentBoostAsDoubleDrop')] }], 1),
    entry(SOUL, 'battle_start', 'battle_start', '自身回合類效果無法被消除。', [{ acts: [trait('ownTurnEffectsUnclearable')] }], 2),
    entry(SOUL, 'battle_start', 'battle_start', collapseRaw, [{ acts: [trait('collapseOpponentTurnEffectsToOne')] }], 3),
    entry(SOUL, 'battle_start', 'battle_start', '自身能力提升/下降等級狀態被改變時，令雙方100%麻痺，麻痺狀態增加7回合。', [{ acts: [trait('paralyzeBothOnOwnStatChangeTurns', 7)] }], 4),
    // 【自身處於異常狀態時】
    entry(SOUL, 'battle_phase_end', 'phase_end', '當回合戰鬥階段結束時恢復所有技能7點PP值。', [
      { cond: [selfAbnormal], acts: [a('pp_op', { side: 'self', mode: 'add', amount: 7 })] },
    ], 5),
    entry(SOUL, 'battle_start', 'battle_start', paralysisRaw, [{ acts: [trait('suppressAbnormalSideEffectsWhenParalyzed')] }], 6),
    entry(SOUL, 'before_damage', 'outgoing_skill', paralysisRaw, [
      { cond: [paralyzed], acts: [a('dmg_mod', { dir: 'out', kind: '技能', boost: 0.7 })] },
    ], 7),
    // 【使用攻擊技能時】
    entry(SOUL, 'on_skill_use', 'use', drainRaw, [
      { cond: [attackSkill, selfAbnormal], acts: [a('drain_body_weight', {}), a('drain_stage_sum', { unit: 70, kind: 'true' })] },
      { cond: [attackSkill, c('abnormal', { side: 'self', neg: true }, '自身不處於異常狀態')], acts: [a('drain_stage_sum', { unit: 70, kind: 'fixed' })] },
    ], 8),
    // 先制讀當回合開始的條件快照，不因排序前對手能力改變而切換分支。
    entry(SOUL, 'modify_priority', 'modify_priority', '若對手不處於能力提升狀態，則令自身攻擊、速度、命中+2，當回合自身所有技能先制+1。', [
      { cond: [c('player_state', {key:'roundPriorityBranch',equals:true,fallback:false,thisRound:true}, '回合開始時對手不處於能力提升')], acts: [a('prio_bonus', { v: 1 })] },
    ], 9),
  ] as KitEntry[],
};

// ───────── 專屬特質「神明」「雷神」 ─────────
const T = 'mechanic' as const;
const GOD_ENTITY_RAW = '自身存活條件不受當前體力限制。\n自身當前體力歸0時進入「神降」。';
const alien = a('alien_category', { id: 'rey_alien_energy', name: '異能值', displayChar: '異', description: '個體異能值資源；可顯示及依技能扣除，特殊模式的登場消耗規則尚未接通。' });
const survival = a('survival_rule', { mode: 'god_descent', floorMult: 70 });
const thunderGodRaw = '令自身死亡時的體力下限不再為0，改為70乘以（-自身體力上限）為體力下限。\n自身恢復體力量降低100%，改為每次執行恢復體力效果時令自身增加等同於自身最大體力的70%。\n自身每次受到非真實傷害時免疫此傷害，並令扣除自身體力上限70%的體力值。\n自身每次受到真實傷害時，正常結算傷害。';

export const MIGRATED_REY_GOD_KIT = {
  kind: 'trait' as const,
  elfIds: ['5029'],
  name: '神明',
  description: OTHERWORLD_REY_TEXT.god,
  kit: [
    entry(T, 'battle_start', 'battle_start', '戰鬥中被視為異能精靈。', [{ acts: [alien] }], 0),
    entry(T, 'on_entered', 'entrance', '戰鬥中被視為異能精靈。', [{ acts: [alien] }], 1),
    // 體力上限於登場時可能已變動：每次戰鬥開始／登場都以當時上限重算神降體力下限（同舊 handler ON_ENTRANCE）。
    entry(T, 'battle_start', 'battle_start', GOD_ENTITY_RAW, [{ acts: [survival] }], 2),
    entry(T, 'on_entered', 'entrance', GOD_ENTITY_RAW, [{ acts: [survival] }], 3),
    // 【神降效果】（規則表由引擎 survivalRules 承載；每次戰鬥開始／登場以當時體力上限重算下限）
    entry(T, 'battle_start', 'battle_start', thunderGodRaw, [{ acts: [survival] }], 4),
    entry(T, 'on_entered', 'entrance', thunderGodRaw, [{ acts: [survival] }], 5),
    entry(T, 'before_damage', 'incoming_nontrue', '自身每次受到非真實傷害時免疫此傷害，並令扣除自身體力上限70%的體力值。', [
      { cond: [c('god_descent', { side: 'self' }, '自身處於神降')], acts: [a('nullify_incoming', { kind: '非真實' })] },
    ], 6),
    entry(T, 'on_damaged', 'damaged_nontrue', '回合結束時若當回合未受到非真實傷害，則增加自身最大體力7%的體力值。', [{ acts: [a('round_fact', { key: 'nonTrueDamaged' })] }], 7),
    entry(T, 'round_end', 'round_end', '回合結束時若當回合未受到非真實傷害，則增加自身最大體力7%的體力值。', [
      { cond: [c('god_descent', { side: 'self' }, '自身處於神降'), c('no_nontrue_damage', {}, '當回合未受到非真實傷害')],
        acts: [a('hp_adjust', { side: 'self', ratio: 0.07, base: '最大體力', direction: 'add' })] },
    ], 8),
  ] as KitEntry[],
};

const statMultRaw = '體力每降低1%則雙攻值與雙防值在雙方計算傷害時額外提升1%，當回合戰鬥階段結束時失去該加成，最高70%。';
const statMult = (node: KitEntry['node'], trig: string, order: number) =>
  entry(T, node, trig, statMultRaw, [{ acts: [a('calc_stat_mult', { mode: 'lost_hp', cap: 0.7 })] }], order);

export const MIGRATED_REY_THUNDER_KIT = {
  kind: 'trait' as const,
  elfIds: ['5029'],
  name: '雷神',
  description: OTHERWORLD_REY_TEXT.thunder,
  kit: [
    // 【自身為滿體力時】（特殊模式留接口：只登記數值）
    entry(T, 'on_entered', 'entrance', '登場異能值消耗降低70%（特殊模式生效）。', [
      { cond: [c('hp_full', { side: 'self' }, '自身為滿體力')], acts: [a('alien_entry_cost', { ratio: 0.7 })] },
    ], 0),
    // 【自身不為滿體力時】
    entry(T, 'battle_start', 'battle_start', '若當前處於麻痺狀態且不小於7回合時自身使用技能不受PP值限制。', [{ acts: [trait('ppLimitIgnoredWhenParalyzedTurns', 7),trait('ppLimitIgnoredRequiresNonFull')] }], 1),
    statMult('on_entered', 'entrance', 2),
    statMult('round_start', 'round_start', 3),
    statMult('before_skill', 'before_skill', 4),
    statMult('on_attacked', 'opp_skill', 5),
    entry(T, 'battle_phase_end', 'phase_end', statMultRaw, [{ acts: [a('calc_stat_mult', { mode: 'reset' })] }], 6),
    entry(T, 'before_damage', 'outgoing', '體力每降低1%則自身造成非真實傷害提升1%，最高70%。', [{ acts: [a('dmg_scale_by_lost_hp', { kind: '非真實', cap: 0.7 })] }], 7),
    entry(T, 'on_skill_use', 'use', '使用攻擊技能會以雙攻值總和視為當前攻擊/特攻值計算傷害。', [{ cond: [attackSkill,c('hp_ratio',{side:'self',op:'低於',ratio:1})], acts: [a('atk_sum_calc', {})] }], 8),
    entry(T, 'after_action', 'self_after_physical', '物理攻擊時恢復己方至少70點體力值，自身每增加1點體力，己方不在場精靈額外恢復1體力。', [{ cond:[c('hp_ratio',{side:'self',op:'低於',ratio:1})],acts: [a('heal_share_bench', { amount: 70 })] }], 9),
    // 「自身不為滿體力」以出手前（使用技能前）為準：魂印吸取在使用時才補血，不能讓補滿後的體力吃掉這句。
    entry(T, 'after_action', 'self_after_special', '特殊攻擊時令對手先制-1。', [{ cond:[c('player_state',{key:'reyNotFullAtUse',equals:true,fallback:false,thisRound:true},'出手前自身不為滿體力')],acts: [a('prio_turns', { side: 'opp', turns: 1, v: -1 })] }], 10),
    entry(T, 'before_skill', 'before_skill', '【自身不為滿體力時】', [
      { acts: [a('flag_set', { key: 'reyNotFullAtUse', value: false, thisRound: true })] },
      { cond: [c('hp_ratio', { side: 'self', op: '低於', ratio: 1 }, '自身不為滿體力')], acts: [a('flag_set', { key: 'reyNotFullAtUse', value: true, thisRound: true })] },
    ], 11),
  ] as KitEntry[],
};

export const MIGRATED_REY_TRAIT_KITS = [MIGRATED_REY_GOD_KIT, MIGRATED_REY_THUNDER_KIT];
