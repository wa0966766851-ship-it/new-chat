// P3: Semantic alias families (DSH 2026-11-11).
// Pure metadata: groups ops that express the SAME intent behind one canonical L3 code.
// NO runtime dispatch changes, NO op rewrites. The original op names stay exactly as
// they are; this table only says "these are the same idea, look up by the family code".
// See docs/op-code-system.md §6.
import type { OpFamily } from './opCatalog';

export interface OpAliasFamily {
  /** Stable family key, e.g. "status-inflict-guard". */
  id: string;
  /** Canonical L3 code this family resolves to (must exist in OP_CATALOG). */
  canonicalCode: string;
  family: OpFamily;
  label: string;
  /** Human-readable definition of the shared intent. */
  intent: string;
  /** Ops that implement this intent. May be indexed or unindexed (see op-usage). */
  members: string[];
  /** Elf ids known to use this intent (from L4 usage index; informational only). */
  knownElves: string[];
}

export const OP_ALIAS_FAMILIES: OpAliasFamily[] = [
  {
    id: 'status-inflict-guard',
    canonicalCode: 'S-016',
    family: 'S',
    label: '限制附加異常狀態',
    intent: '禁止（或限制）把異常狀態附加到任一方；涵蓋「無法附加雙方任一方異常」及其控制類／害怕／場上變體。',
    members: [
      'status_inflict_guard_turns', // canonical op
      'status_guard',
      'archived_status_guard',
      'status_immunity_bypass', // inverse-intent marker, kept for visibility
      'immune_status_turns',
      'immune_status_count',
      'immune_status_perm',
      'status_conversion_ban',
    ],
    knownElves: ['5001', '5013', '5019', '5022', '5023', '5025', '5039', '5047'],
  },
  {
    id: 'fatal-survival',
    canonicalCode: 'G-019',
    family: 'G',
    label: '免死／強制存活',
    intent: '致死時保留體力、延後死亡或重生；涵蓋六刃零體力規則與雷伊神降死亡線的「存活判定」語意。',
    members: [
      'survive', 'survive_turns', 'rebirth_after_ally_turns', 'rebirth_once',
      'delayed_rebirth_arm', 'delayed_rebirth_tick', 'mark_pair_rebirth',
      'fatal_survival_window', 'damage_survival_guard', 'nokill', 'mercy',
      'survival_rule',
    ],
    knownElves: ['5022', '5029'],
  },
  {
    id: 'shield-barrier',
    canonicalCode: 'G-017',
    family: 'G',
    label: '護盾／護罩',
    intent: '給予、消耗、清除、轉移或依護盾值計算的防護效果。',
    members: [
      'shield', 'shield_from_last', 'clear_shield', 'consume_shield',
      'barrier_add', 'clear_both_shields', 'defer_shield_to_next',
      'drain_shield_ratio', 'drain_then_shield', 'extra_owner_shield',
      'shield_change_mark', 'shield_entry_copy', 'shield_guard_snapshot',
      'shield_lost_watch', 'shield_power_steps', 'receipt_shields',
      'field_shield',
    ],
    knownElves: [],
  },
  {
    id: 'recovery-modifier',
    canonicalCode: 'H-030',
    family: 'H',
    label: '恢復倍率／降療／禁療',
    intent: '改變或禁止體力恢復量（含降療、恢復反噬、神降恢復轉換）。',
    members: [
      'recovery_reduce_turns', 'recovery_scale_turns', 'recovery_backlash_turns',
      'no_heal', 'heal_reduce', 'heal_reduce_turns',
      'convert_damage_to_heal_next', 'heal_as_percent_damage',
    ],
    knownElves: ['5029'],
  },
  {
    id: 'damage-bound',
    canonicalCode: 'D-015',
    family: 'D',
    label: '傷害上限／保底',
    intent: '限制傷害的最大值或最小值（含克制保底、依印記上限、體力保底）。',
    members: [
      'damage_cap_turns', 'damage_cap_now', 'damage_cap_by_mark',
      'damage_floor', 'damage_floor_flat', 'type_damage_floor_turns',
      'opponent_incoming_floor_turns', 'damage_floor_steps',
    ],
    knownElves: ['5029'],
  },
  {
    id: 'status-cure',
    canonicalCode: 'S-004',
    family: 'S',
    label: '解除／轉換異常狀態',
    intent: '清除、轉換或轉移已附加的異常狀態。',
    members: [
      'cure_status', 'convert_status', 'status_replace', 'status_seq',
      'status_random', 'archive_cure', 'extra_cure_self',
      'status_transfer_all', 'team_status_replace', 'copy_status_durations',
      'cleanse_on_status_end', 'status_end_cleanse',
    ],
    knownElves: ['5022'],
  },
];

export const ALIAS_BY_FAMILY_ID: Record<string, OpAliasFamily> =
  Object.fromEntries(OP_ALIAS_FAMILIES.map(f => [f.id, f]));

/** op name → all alias families it belongs to. */
export const ALIAS_BY_OP: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const f of OP_ALIAS_FAMILIES) for (const op of f.members) (out[op] ??= []).push(f.id);
  return out;
})();

/** Canonical L3 code → alias family (reverse lookup for the UI). */
export const ALIAS_BY_CODE: Record<string, OpAliasFamily> =
  Object.fromEntries(OP_ALIAS_FAMILIES.map(f => [f.canonicalCode, f]));

export function aliasFamiliesOf(op: string): OpAliasFamily[] {
  return (ALIAS_BY_OP[op] || []).map(id => ALIAS_BY_FAMILY_ID[id]);
}
