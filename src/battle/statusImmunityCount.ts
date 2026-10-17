import type { BattleEventContext } from '../effects/types';

export type StatusCountTone = 'yellow' | 'cyan' | 'blue';
export function statusCountAppearance(team: boolean, retained: boolean, reflect = false) {
  const label = `${team ? '己方' : '自身'}次數免疫${reflect ? '與反彈' : ''}`;
  return {
    label,
    description: `${label}異常狀態。${team ? '全隊共用同一份剩餘次數，換人後繼續生效。' : retained ? '下場保留，僅原持有者再上場時生效，不轉交隊友。' : '僅目前持有者生效，下場即清除。'}`,
    tone: (team ? 'blue' : retained ? 'cyan' : 'yellow') as StatusCountTone,
  };
}

/** Explicit scope opts into scoped counters. Existing unqualified Kits retain their original holder bank. */
export function grantCountedStatusImmunity(ctx: BattleEventContext, p: any): boolean {
  if (!Number.isInteger(p.count) || p.count <= 0) return false;
  if (p.scope === undefined && p.persistsOffField === undefined) {
    const key = p.reflect ? 'blkReflectStatusCount' : 'blkImmuneStatusCount';
    ctx.setPlayerState(key, (ctx.getPlayerState(key) || 0) + p.count);
  } else {
    const team = p.scope === 'team', retained = team || p.persistsOffField !== false;
    const presentation = statusCountAppearance(team, retained, !!p.reflect);
    ctx.addTimerTo(ctx.actor, {
      id: `status-immunity-count:${team ? 'team' : 'elf'}:${retained}:${!!p.reflect}`,
      name: presentation.label, description: presentation.description,
      kind: 'use_counter', source: 'skill', remaining: p.count, tickAt: 'never', stackRule: 'extend',
      scope: team ? 'team' : 'elf', persistsOffField: retained, clearable: false,
      ...(team ? {} : { ownerBattleId: ctx.self.battleId || ctx.self.id }),
      payload: { statusImmunityCount: { reflect: !!p.reflect } },
    }, false);
  }
  ctx.addLog(`🛡️ 免疫${p.reflect ? '並反彈' : ''}下 ${p.count} 次異常狀態！`, 'effect');
  return true;
}

export function statusCountClasses(tone?: StatusCountTone): string {
  return tone === 'yellow' ? 'bg-yellow-950/70 text-yellow-200 border-yellow-500/60'
    : tone === 'cyan' ? 'bg-cyan-950/70 text-cyan-200 border-cyan-400/60'
    : tone === 'blue' ? 'bg-blue-950/70 text-blue-200 border-blue-500/60' : '';
}
