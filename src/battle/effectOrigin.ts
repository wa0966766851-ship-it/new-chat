import type { EffectOrigin, EffectSource, Elf } from '../types';

const KIND_BY_SOURCE: Record<string, EffectOrigin['kind']> = {
  skill: 'skill', soulmark: 'soulmark', soul: 'soulmark', trait: 'trait', item: 'item', extra: 'extra', mechanic: 'system', system: 'system',
};

/**
 * 由執行容器（ctx）集中推導效果來源；addTimerTo／setMark 呼叫，效果程式不必各自填寫。
 * - ctx.effectSource（延後交付、他方授予）優先；其次 recoveryOrigin（執行容器種類）；再其次呼叫端明示的 source（計時器）。
 * - 取得效果（幻化）時：施加者是持有者本人（sourceBattleId＝持有者），defName＝被複製的定義所屬精靈。
 * 只回傳資料，不讀描述文字、不影響結算。
 */
export function buildEffectOrigin(ctx: any, holder: Elf | undefined, side: 'p1' | 'p2', findElf: (side: 'p1' | 'p2', id: string) => Elf | undefined, source?: EffectSource): EffectOrigin {
  const declared = ctx?.effectSource ?? ctx?.recoveryOrigin;
  const holderId = String(holder?.battleId || holder?.id || '');
  const sourceSide: 'p1' | 'p2' = declared?.sourceSide === 'p1' || declared?.sourceSide === 'p2' ? declared.sourceSide : (ctx?.actor === 'p1' || ctx?.actor === 'p2' ? ctx.actor : side);
  const sourceBattleId = String(declared?.sourceBattleId || holderId);
  const sourceElf = sourceBattleId === holderId ? holder : findElf(sourceSide, sourceBattleId);
  let kind = KIND_BY_SOURCE[String(declared?.kind ?? source ?? '')] ?? (ctx?.skill?.name ? 'skill' : 'system');
  if (sourceElf?.isExtra && kind !== 'skill') kind = 'extra';
  const defName: string | undefined = ctx?.illusionEffectKey || (kind === 'soulmark' ? sourceElf?.soulMark?.name : undefined) || undefined;
  return {
    kind, sourceSide, sourceBattleId, sourceName: String(sourceElf?.name || holder?.name || ''),
    ...(kind === 'skill' && ctx?.skill?.name ? { skillName: String(ctx.skill.name) } : {}),
    ...(defName ? { defName } : {}),
  };
}
