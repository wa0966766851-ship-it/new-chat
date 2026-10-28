import type { BattleEventContext } from '../effects/types';

/**
 * 次數免疫的呈現（2026-10-28 使用者規格）：
 *
 * 一、純免疫（不反彈）→ 用官方原色圖：
 *   1. 次數免疫（可傳承、切換保留、全隊）→ 青（87.png）
 *   2. 單人次數免疫（切換消失）        → 黃（100.png）
 *   3. 單人次數免疫（切換保留）        → 藍（183.png）
 *
 * 二、免疫「並反彈」→ 用自製發光改色圖（同款底圖，僅換色相）：
 *   反彈・全隊可保留 → 亮橘
 *   反彈・自身可保留 → 亮紅
 *   反彈・切換消失   → 亮粉紅
 */
export type StatusCountTone = 'cyan' | 'yellow' | 'blue' | 'pink' | 'orange' | 'red';

export interface StatusCountAppearance {
  label: string;
  description: string;
  tone: StatusCountTone;
  icon: string;
}

const CUSTOM = '/seer/signbuff/custom';
const COUNT_ICONS: Record<StatusCountTone, string> = {
  cyan: '/seer/signbuff/87.png',                       // 純免疫・全隊
  yellow: '/seer/signbuff/100.png',                    // 純免疫・自身切換消失
  blue: '/seer/signbuff/183.png',                      // 純免疫・自身切換保留
  orange: `${CUSTOM}/次數免疫_己方保留.png`,           // 反彈・全隊可保留
  red: `${CUSTOM}/次數免疫_自身保留.png`,              // 反彈・自身可保留
  pink: `${CUSTOM}/次數免疫_反彈.png`,                // 反彈・切換消失
};

export function statusCountAppearance(team: boolean, retained: boolean, reflect = false): StatusCountAppearance {
  const label = `${team ? '己方' : '自身'}次數免疫${reflect ? '與反彈' : ''}`;
  const scopeText = team
    ? '全隊共用同一份剩餘次數，換人後繼續生效。'
    : retained
      ? '下場保留，僅原持有者再上場時生效，不轉交隊友。'
      : '僅目前持有者生效，下場即清除。';
  // 反彈型才用自製亮色；純免疫沿用官方原色。
  const tone: StatusCountTone = reflect
    ? (team ? 'orange' : retained ? 'red' : 'pink')
    : (team ? 'cyan' : retained ? 'blue' : 'yellow');
  return {
    label,
    description: `${label}異常狀態。${scopeText}`,
    tone,
    icon: COUNT_ICONS[tone],
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

/** Tailwind 色票：與圖示色系一致。 */
export function statusCountClasses(tone?: StatusCountTone): string {
  return tone === 'pink' ? 'bg-pink-950/70 text-pink-200 border-pink-400/70'
    : tone === 'orange' ? 'bg-orange-950/70 text-orange-200 border-orange-400/70'
    : tone === 'red' ? 'bg-red-950/70 text-red-200 border-red-400/70'
    : tone === 'cyan' ? 'bg-cyan-950/70 text-cyan-200 border-cyan-400/60'
    : tone === 'yellow' ? 'bg-yellow-950/70 text-yellow-200 border-yellow-500/60'
    : tone === 'blue' ? 'bg-blue-950/70 text-blue-200 border-blue-500/60'
    : '';
}
