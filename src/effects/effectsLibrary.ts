import { BattleEffect, EffectSubCategory } from './types';

// 標準化效果生成庫
export const EffectsLibrary = {
  // 固定傷害（受抗性）
  createFixedDamage: (id: string, name: string, value: number): BattleEffect => ({
    id, name, type: 'TRUE_DAMAGE', value, category: 'FIXED' 
  }),

  // 百分比傷害（受抗性）
  createPercentDamage: (id: string, name: string, percent: number): BattleEffect => ({
    id, name, type: 'TRUE_DAMAGE', value: percent, category: 'PERCENT'
  }),

  // 真實傷害（無抗性）
  createTrueDamage: (id: string, name: string, value: number): BattleEffect => ({
    id, name, type: 'TRUE_DAMAGE', value, category: 'TRUE'
  }),

  // 治療（固定或百分比）
  createHeal: (id: string, name: string, value: number, isPercent: boolean = false): BattleEffect => ({
    id, name, type: 'HEAL', value: isPercent ? `${value}%` : value
  }),

  // 屬性變更
  createStatChange: (id: string, name: string, stat: string, change: number): BattleEffect => ({
    id, name, type: 'STAT_CHANGE', value: `${stat}_${change}`
  }),

  // 狀態應用
  createStatusApply: (id: string, name: string, statusName: string): BattleEffect => ({
    id, name, type: 'STATUS_APPLY', value: statusName
  })
};
