import type { BattleEventContext } from '../effects/types';

/**
 * 次數免疫的呈現（2026-10-28 使用者規格；2026-11-16 最終更正）：
 *
 * 一、純免疫（不反彈）→ 原廠印記圖：
 *   1. 己方全隊次數免疫（可傳承、切換保留）→ 青（signbuff/60.png）
 *   2. 自身次數免疫（切換消失）            → 黃（signbuff/100.png）
 *   3. 自身次數免疫（切換保留）            → 藍（signbuff/179.png）
 *
 * 二、免疫並反彈 → 自製換色盾牌（custom/次數免疫_盾_*.png）：
 *   4. 己方全隊反彈             → 橘
 *   5. 自身反彈（切換消失）     → 紅
 *   6. 自身反彈（切換保留）     → 紫
 *
 * 舊圖 87／183 與 custom/次數免疫_{己方保留,自身保留,反彈,切換消失}.png 保留不刪，已不再引用。
 * 消耗順序（contextBuilders）：反彈 → 單人 → 己方全隊最後。
 */
export type StatusCountTone = 'cyan' | 'yellow' | 'blue' | 'orange' | 'red' | 'purple';

export interface StatusCountAppearance {
  label: string;
  description: string;
  tone: StatusCountTone;
  icon: string;
}

const CUSTOM = '/seer/signbuff/custom';
const COUNT_ICONS: Record<StatusCountTone, string> = {
  cyan: '/seer/signbuff/60.png',                // 1 純免疫・己方全隊
  yellow: '/seer/signbuff/100.png',             // 2 純免疫・自身切換消失
  blue: '/seer/signbuff/179.png',               // 3 純免疫・自身切換保留
  orange: `${CUSTOM}/次數免疫_盾_橘.png`,       // 4 反彈・己方全隊
  red: `${CUSTOM}/次數免疫_盾_紅.png`,          // 5 反彈・自身切換消失
  purple: `${CUSTOM}/次數免疫_盾_紫.png`,       // 6 反彈・自身切換保留
};

export function statusCountAppearance(team: boolean, retained: boolean, reflect = false): StatusCountAppearance {
  const label = `${team ? '己方' : '自身'}次數免疫${reflect ? '與反彈' : ''}`;
  const scopeText = team
    ? '全隊共用同一份剩餘次數，換人後繼續生效。'
    : retained
      ? '下場保留，僅原持有者再上場時生效，不轉交隊友。'
      : '僅目前持有者生效，下場即清除。';
  // 反彈型用自製換色盾牌；純免疫用原廠圖。
  const tone: StatusCountTone = reflect
    ? (team ? 'orange' : retained ? 'purple' : 'red')
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
  return tone === 'purple' ? 'bg-purple-950/70 text-purple-200 border-purple-400/70'
    : tone === 'orange' ? 'bg-orange-950/70 text-orange-200 border-orange-400/70'
    : tone === 'red' ? 'bg-red-950/70 text-red-200 border-red-400/70'
    : tone === 'cyan' ? 'bg-cyan-950/70 text-cyan-200 border-cyan-400/60'
    : tone === 'yellow' ? 'bg-yellow-950/70 text-yellow-200 border-yellow-500/60'
    : tone === 'blue' ? 'bg-blue-950/70 text-blue-200 border-blue-500/60'
    : '';
}
