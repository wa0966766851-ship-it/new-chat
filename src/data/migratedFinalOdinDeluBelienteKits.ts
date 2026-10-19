import type { KitEntry } from '../effects/effectSystem.schema';
import finalText from './finalOdinDeluBelienteText.json';
import { action as a, property, sequence } from './reviewedSequenceSkillKits';

const c = (id: string, p: any) => ({ c: id, p, label: id });
const e = (node: KitEntry['node'], trig: string, raw: string, body: any[], order: number): KitEntry => ({
  codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node, order, customText: raw,
  params: { clause: { raw, trig, parsed: true, body } },
});
const flag = (key: string) => c('stored_flag', { key });
const low = 'blkLowAtRoundStart', bleed = 'blkBleedUntilSwitch';
const shackleDescription = '持有者每有1道則受到攻擊傷害與重量提升200%，每次受到真實傷害時轉移1道魔軀枷鎖給對手，最多5道（下場後保留）。';
export const MIGRATED_FINAL_DELU_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5009'], name: '獅',
  description: finalText.deluSoul,
  kit: [
    e('battle_start', 'battle_start', '戰鬥開始時令自身體力值與其上限調整為3000000，為自身附加5道魔軀枷鎖', [{ acts: [
      a('maximum_health_lock', { value: 3000000, resetCurrent: true }),
      a('portable_mark', { side: 'self', id: 'delu_shackles', name: '魔軀枷鎖', displayChar: '枷', description: shackleDescription,
        count: 5, maxCount: 5, persistsOffField: true, effects: { damageTakenIncreasePercentPerStack: 2, weightIncreasePercentPerStack: 2 },
        rules: [{ raw: shackleDescription, trig: 'damaged_true', parsed: true, body: [{ acts: [a('portable_mark_transfer', { id: 'delu_shackles', count: 1, maxCount: 5 })] }] }] }),
    ] }], 0),
    e('round_start', 'round_start', '回合開始時記錄自身體力是否低於¼', [{ acts: [a('hp_gate_snapshot', { key: low, ratio: 0.25, latch: false })] }], 1),
    e('round_start', 'round_start', '若自身體力不低於對手，附加自身異常給對手並解除自身異常，2回合內免疫所有異常且非真實傷害提升50%', [{
      cond: [c('hp_cmp', { side: 'self', op: '不低於' })], acts: [a('copy_statuses', { from: 'self', to: 'opp' }), a('cure_status', { side: 'self', cls: '' }),
        a('immune_status_turns', { turns: 2, reflect: false, cls: '' }), a('dmg_mod_turns', { side: 'self', dir: 'out', kind: '非真實', boost: 0.5, turns: 2 })],
    }], 2),
    e('round_start', 'round_start', '若自身體力低於¼，直到下場前每回合開始受到最大體力75%真實傷害', [
      { acts: [a('hp_gate_snapshot', { key: bleed, ratio: 0.25, latch: true })] },
      { cond: [flag(bleed)], acts: [a('self_health_damage', { ratio: 0.75, type: '真實' })] },
    ], 3),
    e('on_switch_out', 'switch_out', '下場後解除持續反噬與回合開始的體力判定', [{ acts: [a('hp_gate_clear', { keys: [low, bleed] })] }], 4),
    e('on_damaged', 'damaged_skill', '受到技能傷害且自身體力不為0時，恢復雙防值50%體力並吸取對手所有技能1點PP', [{ cond: [c('alive', { side: 'self' })], acts: [
      a('panel_health', { stats: ['def', 'spdef'], ratio: 0.5, mode: 'heal' }), a('pp_op', { side: 'opp', mode: 'drain', amount: 1 }),
    ] }], 5),
    e('on_damaged', 'damaged_fixed', '受到固定傷害且自身體力不為0時，吸取對手自身雙防值50%體力', [{ cond: [c('alive', { side: 'self' })], acts: [a('panel_health', { stats: ['def', 'spdef'], ratio: 0.5, mode: 'drain' })] }], 6),
    e('on_damaged', 'damaged_percent', '受到百分比傷害且自身體力不為0時，吸取對手自身最大體力0.0187%的體力', [{ cond: [c('alive', { side: 'self' })], acts: [a('drain', { ratio: 0.000187, ofSelf: true })] }], 7),
    // incoming 早於致死判定；ON_DAMAGED 才開窗無法保護當筆真傷。
    e('before_damage', 'incoming', '受到真實傷害時，1回合內死亡則強制存活保留1點體力並解除自身異常', [{ cond: [c('event_damage_kind', { kind: '真實' })], acts: [
      a('fatal_survival_window', { turns: 1, cure: true }),
    ] }], 8),
    e('on_skill_use', 'use', '若回合開始時體力低於¼，1回合內對手受傷不低於體力上限、無法恢復，受到最大體力真傷，有枷鎖則額外消耗所有體力', [{ cond: [flag(low)], acts: [
      a('opponent_incoming_floor_turns', { ratio: 1, turns: 1 }), a('no_heal', { turns: 1, scope: 'all' }),
      a('dmg', { ratio: 1, base: '最大體力', of: 'opp', type: '真實' }),
    ] }, { cond: [flag(low), c('has_mark', { side: 'opp', name: '魔軀枷鎖' })], acts: [a('consume_current_health', { side: 'opp' })] }], 9),
  ],
};

const energy = 'star_governor', record = 'recordedResistanceMaxima', entryMaximum = 'entryMaximumHealth';
const observer = (node: KitEntry['node'], trig: string, raw: string, acts: any[], order: number): KitEntry => {
  const entry = e(node, trig, raw, [{ acts }], order);
  entry.params.clause.observer = { includeDead: true }; return entry;
};
// 2026-10-18使用者裁定：原文「能力」為能量；獲得150點能量並恢復150體力。
export const FINAL_BELIENTE_RESOLVED_TEXT = '每次消耗能量令己方下次執行異常轉化時獲得150點能量並恢復己方在場存活精靈等量體力';
export const MIGRATED_FINAL_BELIENTE_SOUL_KIT = {
  kind: 'soul' as const, elfIds: ['5027'], name: '蓓',
  description: finalText.belienteSoul,
  kit: [
    observer('battle_start', 'team_battle_start', '戰鬥開始記錄自身異常抗性的所有最高項', [a('resistance_record', { key: record })], 0),
    e('on_entered', 'entrance', '記錄本次登場時最大體力', [{ acts: [a('entry_maximum_snapshot', { key: entryMaximum })] }], 1),
    observer('before_status_apply', 'team_before_status', '己方進入記錄異常時轉為3回合星賜並失去全免抗性；星執者存在時轉化所有異常', [
      a('team_status_replace', { key: energy, recordKey: record, status: '星賜', turns: 3, loseUniversalResistance: true }),
    ], 2),
    e('cthyaat_death', 'defeated', '自身被擊敗時消逝並化身星執者，初始能量等於本次登場最大體力', [{ cond: [c('death_node', { node: 1 })], acts: [
      a('energy_form_enter', { key: energy, snapshotKey: entryMaximum, name: '星執者', displayChar: '執' }),
    ] }], 3),
    observer('cthyaat_death', 'team_defeated', '己方其他精靈被擊敗時星執者額外獲得300點能量', [a('energy_form_ally_defeat', { key: energy, amount: 300 })], 4),
    observer('after_action', 'team_after_action', '己方每次使用技能後消耗15%能量、至少150點，附加對手等量真實傷害', [a('energy_form_spend', { key: energy, ratio: 0.15, minimum: 150, mode: 'damage', conversionReward: 150 })], 5),
    observer('round_end', 'team_round_end', '每回合結束消耗15%能量、至少150點，恢復在場存活精靈等量體力', [a('energy_form_spend', { key: energy, ratio: 0.15, minimum: 150, mode: 'heal', conversionReward: 150 })], 6),
    observer('on_status_received', 'team_status_received', FINAL_BELIENTE_RESOLVED_TEXT, [a('energy_conversion_reward', { key: energy })], 7),
  ],
};

const tiwaz = (side: 'self' | 'opp') => a('battle_mark_grant', { side, id: 'tiwaz_rune', name: 'ᛏ 戰神符文', displayChar: 'ᛏ', statRatio: 1.2, duel: true });
const allStats = ['atk', 'def', 'spatk', 'spdef', 'speed'];
const ravenName = 'ᚺᚢᚷᛁᚾ ᛟᚲ ᛗᚢᚾᛁᚾ';
export const MIGRATED_FINAL_ODIN_RAVEN_KIT = {
  elfIds: ['5019'], name: ravenName,
  description: '■ 必中\n🎯 100%令對手臣服，未觸發則回合結束時消除對手回合類效果\n🎯 100%令對手狂信，觸發成功則下次異常回合結束時消除對手信仰對象並附加對手ᛏ符文並於附加後降低對手能力值30%\n🎯 3回合內自身造成技能傷害提升100%，在場雙方每存在一個無法主動切換精靈效果則額外提升50%\n🎯 直接附加對手300點遠古系技能傷害，若造成技能傷害為微弱則下2回合對手無法主動切換精靈',
  kit: [
    property('■ 必中', 'sure_hit', true, 0),
    sequence('100%令對手臣服，未觸發則回合結束時消除對手回合類效果', [
      { acts: [a('status', { side: 'opp', status: '臣服', turns: 3, chance: 100 })] },
      { chain: 'fail', acts: [a('at_round_end', { originalTarget: true, body: [{ acts: [a('clear_turn', { side: 'opp' })] }] })] },
    ], 1),
    sequence('100%令對手狂信，觸發成功則下次異常回合結束時消除對手信仰對象並附加ᛏ符文再降低能力值30%', [
      { acts: [a('status', { side: 'opp', status: '狂信', turns: 3, chance: 100 })] },
      { chain: 'success', acts: [a('status_bound_round_end', { side: 'opp', body: [{ acts: [a('clear_faith_target', { side: 'opp' }), tiwaz('opp'), a('stat_points_scale', { side: 'opp', ratio: 0.7, stats: allStats })] }] })] },
    ], 2),
    sequence('3回合內自身技能傷害提升100%，在場雙方每有一個鎖切換效果再提升50%', [{ acts: [a('timed', { turns: 3, from: 'now', trig: 'outgoing_skill', label: '技能傷害增幅', body: [{ acts: [a('boost', { mult: 2, kind: '技能', per: 'sides_lock_switch_effects', perInc: 0.5 })] }] })] }], 3),
    sequence('直接附加300點遠古系技能傷害，若造成技能傷害為微弱則下2回合對手無法主動切換', [
      { acts: [a('typed_damage_checked', { amount: 300, elem: '遠古' })] },
      { cond: [c('last_typed_damage_weak', {})], acts: [a('no_switch', { turns: 2, next: true })] },
    ], 4),
  ],
};
