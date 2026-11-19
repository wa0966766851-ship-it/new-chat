/**
 * 戰鬥火焰（激勵 buff，2026-11-07）。
 * 原廠：賽爾號的四種火焰（綠火、藍火、金火、紫火），數值依舊版說明約為——
 *   綠火：精靈全屬性 +1；藍火：每回合恢復 50～60 體力；金火：受到傷害 −20%；紫火：造成傷害 +20～25%。
 * 本模擬器強化版（一場戰鬥每方只能選一種，雙方可同種）：
 *   綠火・生機之焰：精靈登場時攻擊、防禦、特攻、特防、速度各 +1。
 *   藍火・回流之焰：回合結束恢復 8% 最大體力（在場精靈）。
 *   金火・庇護之焰：受到的攻擊傷害 −25%。
 *   紫火・熾烈之焰：造成的攻擊傷害 +25%。
 * 戰鬥中以遺物通道結算（relicEffectRegistry 的 flame_*），雙方各自生效。
 */
export type FlameId = 'flame_green' | 'flame_blue' | 'flame_gold' | 'flame_purple';
export interface FlameDef { id: FlameId; name: string; short: string; color: string; original: string; effect: string }
export const BATTLE_FLAMES: readonly FlameDef[] = [
  { id: 'flame_green', name: '綠火・生機之焰', short: '綠火', color: '#3dd68c', original: '全屬性 +1', effect: '精靈登場時攻擊、防禦、特攻、特防、速度各 +1' },
  { id: 'flame_blue', name: '藍火・回流之焰', short: '藍火', color: '#4fb3ff', original: '每回合恢復約 50 體力', effect: '回合結束恢復在場精靈 8% 最大體力' },
  { id: 'flame_gold', name: '金火・庇護之焰', short: '金火', color: '#f2c14e', original: '受到傷害 −20%', effect: '受到的攻擊傷害 −25%' },
  { id: 'flame_purple', name: '紫火・熾烈之焰', short: '紫火', color: '#b57cff', original: '造成傷害 +20%', effect: '造成的攻擊傷害 +25%' },
];
export const FLAME_BY_ID: Record<string, FlameDef> = Object.fromEntries(BATTLE_FLAMES.map(f => [f.id, f]));
export const isFlameId = (v: unknown): v is FlameId => typeof v === 'string' && v in FLAME_BY_ID;
/** 從四種中抽 n 種供選（不重複）。 */
export function drawFlameChoices(rng: () => number = Math.random, n = 2): FlameDef[] {
  const list = [...BATTLE_FLAMES];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, Math.max(1, Math.min(4, n)));
}
