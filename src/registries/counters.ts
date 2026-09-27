/**
 * ============================================================================
 * 賽爾號對戰引擎 —— 回合/次數類效果資料庫 (Turn/Counter Registry)
 * ============================================================================
 * 專門處理：
 * 1. 計時器 (X 回合後消失)
 * 2. 計數器 (抵擋 X 次傷害)
 * 
 * 分類規則：
 * - 技能賦予：視為「回合類效果」，可被「消除回合類效果」機制影響。
 * - 魂印/被動賦予：除非明確說明，否則視為「被動效果」，不受消除機制影響。
 */

export enum EffectSource {
  SKILL = 'skill',     // 技能賦予，可被消除
  PASSIVE = 'passive', // 魂印/被動，不可被消除
}

export type EffectCategory = 'turn' | 'counter';

export interface TurnEffectEntry {
  id: string;
  name: string;
  category: EffectCategory;
  source: EffectSource;
  description: string;
}

export const TURN_COUNTER_REGISTRY: Record<string, TurnEffectEntry> = {
  // --- 範例：回合類效果 ---
  'skill_dmg_reduction_3t': {
    id: 'skill_dmg_reduction_3t',
    name: '傷害減免',
    category: 'turn',
    source: EffectSource.SKILL,
    description: '3回合內受到的傷害減少。'
  },
  'skill_atk_buff_2t': {
    id: 'skill_atk_buff_2t',
    name: '攻擊強化',
    category: 'turn',
    source: EffectSource.SKILL,
    description: '2回合內攻擊技能威力提升。'
  },

  // --- 範例：次數類效果 ---
  'skill_damage_block_2h': {
    id: 'skill_damage_block_2h',
    name: '傷害抵擋',
    category: 'counter',
    source: EffectSource.SKILL,
    description: '抵擋接下來的 2 次傷害。'
  },
  'skill_hit_guarantee_1h': {
    id: 'skill_hit_guarantee_1h',
    name: '必中效果',
    category: 'counter',
    source: EffectSource.SKILL,
    description: '下 1 次攻擊必定命中。'
  }
};
