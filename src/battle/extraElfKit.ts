// 額外精靈通用事件入口（DSH 2026-10-31，B 組）。
// 額外精靈不在 SoulMarkRegistry（沒有同名魂印 handler），過去 elf.kit 只有 ally_entered 有人派發。
// 這裡提供三個通用節點，所有帶 elf.kit 的額外精靈共用，不含任何精靈專屬碼：
//   on_entered  ：被加入時（addExtraElf 完成後立刻派發一次；不隨隊友出戰重複觸發）
//   ally_entered：己方（或任一方）精靈登場時（battleEngine.broadcastElfEntered 派發，frame.kitOwner＝該額外精靈）
//   self_fatal  ：進入死亡時（killExtraElf 在消逝前派發）
// 派發 frame 的 ctx.self＝額外精靈、ctx.actor＝額外精靈所在方，並附 frame.kitOwner 供 op／條件取用。
import { runNode } from '../effects/effectRunner';
import { CODEX } from '../data/codexRegistry';

type Side = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const running = new Set<string>();
const dying = new Set<string>();

/** 額外精靈自己的 Kit（排除技能來源）。 */
export const extraKitOf = (elf: any): any[] =>
  Array.isArray(elf?.kit) ? elf.kit.filter((x: any) => x?.source !== 'skill') : [];

export const isLiveExtra = (elf: any): boolean => !!elf?.isExtra && !elf.isVanished && Number(elf.currentHp) > 0;

/** 以額外精靈身分執行其 Kit 的某個節點；沒有該節點或正在執行同節點（防重入）則回傳 false。 */
export function runExtraElfNode(ctx: any, side: Side, extra: any, node: string, data: Record<string, unknown> = {}): boolean {
  if (!extra?.isExtra) return false;
  const kit = extraKitOf(extra);
  if (!kit.some(entry => entry?.node === node)) return false;
  const key = `${side}:${idOf(extra)}:${node}`;
  if (running.has(key)) return false;
  const live = (ctx.getFullTeam?.(side) || []).find((e: any) => idOf(e) === idOf(extra)) || extra;
  const base = typeof ctx.contextForElf === 'function' ? ctx.contextForElf(side, live) : ctx;
  const frame = Object.assign(Object.create(base), data, { kitOwner: live, effectEventData: data });
  running.add(key);
  try { runNode(node as any, kit, CODEX, frame); return true; }
  catch (err) { console.error(`[extraElfKit:${node}]`, err); return false; }
  finally { running.delete(key); }
}

/**
 * 令額外精靈死亡：先派發其 self_fatal（進入死亡時），再消逝。
 * 已死亡／已消逝回傳 false（不會重複觸發死亡效果）。
 */
export function killExtraElf(ctx: any, side: Side, extra: any, data: Record<string, unknown> = {}): boolean {
  const live = (ctx.getFullTeam?.(side) || []).find((e: any) => idOf(e) === idOf(extra));
  if (!live || !isLiveExtra(live)) return false;
  const key = `${side}:${idOf(live)}`;
  if (dying.has(key)) return false;
  dying.add(key);
  try {
    runExtraElfNode(ctx, side, live, 'self_fatal', { extraDeath: true, ...data });
    ctx.vanishElf(side, live);
  } finally { dying.delete(key); }
  return true;
}
