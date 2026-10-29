/**
 * 官方戰鬥節點順序（使用者提供的原廠定義，2026-10-10）。
 * 引擎依此順序執行，並透過 onNode 回報實際走過的節點；tests/battleNodeOrder 以此表驗證。
 */
export const BATTLE_NODES = [
  { id: '1.1', name: '戰鬥開始時（天生效果開啟）' },
  { id: '1.2', name: '操作階段（使用藥劑、切換精靈）' },
  { id: '1.3', name: '登場時' },
  { id: '2.1', name: '回合開始時' },
  { id: '2.2', name: '戰鬥階段開始時，判斷雙方先手權' },
  { id: '3.1', name: '出手流程開始時' },
  { id: '3.2', name: '使用技能時／技能命中前' },
  { id: '3.3', name: '初始傷害計算時／技能命中時' },
  { id: '3.4', name: '技能效果結算' },
  { id: '3.4.1', name: '寶石詞條' },
  { id: '3.5', name: '造成傷害前' },
  { id: '3.6', name: '造成技能傷害（紅傷）' },
  { id: '3.7', name: '使用技能後／技能命中後／造成技能傷害後' },
  { id: '3.8', name: '出手流程結束時' },
  { id: '3.9', name: '出手流程結束後／額外行動' },
  { id: '3.10', name: '死亡節點一' },
  { id: '4.10', name: '當回合戰鬥階段結束時' },
  { id: '4.11', name: '死亡節點二' },
  { id: '5', name: '回合結束時／回合扣減點' },
  { id: '5.4', name: '死亡節點三' },
  { id: '6.1', name: '未被擊敗' },
  { id: '6.2', name: '被擊敗時' },
  { id: '6.3', name: '未擊敗對手' },
  { id: '6.4', name: '擊敗對手時' },
  { id: '6.5', name: '被擊敗後' },
  { id: '6.6', name: '擊敗對手後' },
] as const;

export type BattleNodeId = typeof BATTLE_NODES[number]['id'];

/** 後手方的出手流程沿用 3.1–3.9 的節點，回報時以 detail.order=1 區分（官方 4.1–4.9）。 */
export const ACTION_NODE_IDS: readonly BattleNodeId[] = ['3.1', '3.2', '3.3', '3.4', '3.4.1', '3.5', '3.6', '3.7', '3.8', '3.9'];

/** 死亡節點編號 → 節點 id */
export const DEATH_NODE_ID: Record<1 | 2 | 3, BattleNodeId> = { 1: '3.10', 2: '4.11', 3: '5.4' };
