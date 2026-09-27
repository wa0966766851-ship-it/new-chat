import { AbilityDefinition, EffectTiming } from './types';
import { getDeconstructedProfile as getRealProfile } from './abilityRegistry';

// 能力庫：存放所有已定義的精靈效果/魂印邏輯
const AbilityRegistry: Map<string, AbilityDefinition> = new Map();

/**
 * 註冊一個新的能力（效果）到資料庫中
 */
export function registerAbility(definition: AbilityDefinition) {
  AbilityRegistry.set(definition.id, definition);
}

/**
 * 根據 ID 獲取能力定義
 */
export function getAbility(id: string): AbilityDefinition | undefined {
  return AbilityRegistry.get(id);
}

// 導向真正完整的 getDeconstructedProfile 以支援各類魂印/技能效果解析
export function getDeconstructedProfile(elfName: string) {
  const profile = getRealProfile(elfName);
  if (profile) return profile;
  return {
    soulMark: {}, // { flavor: { name: string }, mechanics: any }
    skills: {} // { skillName: Array<{ mechanics: any }> }
  };
}

// 預先載入一些範例以示範架構
registerAbility({
  id: 'PUNI_GOD_HEAL',
  triggerNode: EffectTiming.ROUND_END,
  condition: { type: 'ALWAYS' },
  effects: [
    { id: 'heal_25', name: '聖靈恢復', type: 'HEAL', value: 25 }
  ]
});

// 範例：布林克克「混沌深淵之契」簡化版 (HP > 80% 時減傷)
registerAbility({
  id: 'BRINKK_DAMAGE_REDUCE',
  triggerNode: EffectTiming.BEFORE_DAMAGE,
  condition: { type: 'HP_ABOVE_PERCENT', value: 80 },
  effects: [
    { id: 'dmg_amp_05', name: '深海護盾', type: 'DAMAGE_AMP', value: 0.5 }
  ]
});
