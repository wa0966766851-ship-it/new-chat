// src/effects/statusTypes.ts

// 官方五大核心異常分類 
export type StatusCategory = 
  | 'CONTROL'      // 1. 控制類異常
  | 'WEAKENING'    // 2. 弱化類異常
  | 'RESTRICTIVE'  // 3. 限制類異常
  | 'EVOLUTIONARY' // 4. 衍化類異常
  | 'AUXILIARY'    // 5. 附屬類異常
  | 'BOSS_ONLY'    // BOSS 類異常：附屬類異常的子集合（必與 AUXILIARY 並列），並關閉回合數（StatusRegistryEntry.noDuration）
  | 'NO_EFFECT'    // 新增：無效果類異常（異常抵抗）
  // 相容保留
  | 'ABNORMAL'
  | 'TURN'
  | 'COUNT'
  | 'MARK'
  | 'INDICIA'
  | 'NONE';

export interface StatusInstance {
  name: string;
  remainingTurns: number;
  categories: StatusCategory[];
  信仰對象?: string; // 專門給「狂信」狀態紀錄來源
}
