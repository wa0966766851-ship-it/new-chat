import type { EffectDefinition } from '../effects/effectConnection';
import type { KitEntry, Node } from '../effects/effectSystem.schema';

export const DANCE_DESCRIPTION = '攻擊／特攻提升12%。登場時及每回合結束時，從對方存活的場下精靈／額外精靈中隨機預選1名額外攻擊目標，取代上次預選。自身造成技能傷害時，對預選目標另行計算並造成技能傷害，不追加該技能的其他效果。預選目標不再符合範圍時不觸發；自身離場時清除預選。';

const target = { pool: ['foe_bench', 'foe_extra'], count: 1 };
function danceEntry(node: Node, trig: string, raw: string, params: object, order: number): KitEntry {
  const op = 'extra_random_target';
  return {
    codeId: 'effect_sequence', source: 'mechanic', role: 'innate', node, order, customText: raw,
    params: { clause: { raw, trig, parsed: true, body: [{ acts: [{ op, label: op, p: params }] }] } },
  };
}

export const DANCE_TRAIT_KIT: KitEntry[] = [
  { codeId: 'soul_property', source: 'mechanic', role: 'innate', node: 'passive_always', order: 0, customText: '攻擊/特攻提升 12%',
    params: { property: 'stat_percent', stats: ['atk', 'spatk'], percent: 12 } },
  danceEntry('on_entered', 'entrance', '登場時預選1名額外攻擊目標', { mode: 'prepare', ...target }, 1),
  danceEntry('round_end', 'round_end', '回合結束時清除舊預選並重新預選1名額外攻擊目標', { mode: 'prepare', ...target }, 2),
  danceEntry('after_action', 'self_after_attack', '造成技能傷害時，對預選目標另行計算並造成技能傷害，不追加其他技能效果', { prepared: true, ...target }, 3),
  danceEntry('on_switch_out', 'switch_out', '自身離場時清除預選', { mode: 'clear' }, 4),
  danceEntry('cthyaat_death', 'defeated', '自身被擊敗時清除預選', { mode: 'clear' }, 5),
];

const generalTraitKits = new Map([
  ['亂舞', { description: DANCE_DESCRIPTION, kit: DANCE_TRAIT_KIT }],
]);

/** 裝備清單與舊存檔只存名稱／說明，執行時解析共用定義；保留明確配置的效果。 */
export function resolveGeneralTrait<T extends EffectDefinition>(trait: T | undefined): T | undefined {
  if (!trait || trait.kit?.length || (trait.effectMode && trait.effectMode !== 'auto')) return trait;
  const builtin = generalTraitKits.get(trait.name);
  return builtin ? { ...trait, ...builtin, effectMode: 'kit' } : trait;
}
