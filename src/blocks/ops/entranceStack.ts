// 登場計數疊層通用件（legacyWrapped 拆解；DSH 20261017）。
// 資料來源：全隊登場紀錄 teamEntranceHistory（battle/timedReactions.recordBattleEntrance 於
// ON_ENTRANCE 派發前寫入；下場重置需明確清除）。
// entrance_stack_buff：每登場一次→直到下場前先制+per 且忽略對手特防 ignoreSpDef（既有讀取端
// ignoreSpDefPercentUntilSwitch，下場由本 op 的 reset 清除）。重複觸發時刷新（同 id 計時器覆蓋）。
// entrance_reset：下場/重置時清除登場紀錄（可雙方）、先制計時器、特防忽略與擊敗旗標。
import type { BattleEventContext } from '../../effects/types';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 出戰段數條件（登記於 sequenceContract）。 */
export const ENTRANCE_STACK_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 當前活躍段數比對（entrance_effect_stage 寫入 activeEntranceStage）。
  entrance_stage: ['op', 'stage'],
};

export function entranceStackConditionIssue(c: Record<string, any>): string | undefined {
  if (c?.c !== 'entrance_stage') return undefined;
  if (!['低於', '不小於', '等於'].includes(c.p?.op)) return '出戰段數條件需明確比較';
  if (!Number.isInteger(c.p?.stage) || c.p?.stage < 1 || c.p?.stage > 6) return '出戰段數需1至6';
  return undefined;
}

/** 契約欄位（登記於 sequenceContract）。 */
export const ENTRANCE_STACK_ACTION_FIELDS: Record<string, readonly string[]> = {
  entrance_stack_buff: ['perEntry', 'ignoreSpDef'],
  entrance_reset: ['clearHistory', 'bothSides', 'clearKillFlag'],
  // N 回合內目標受到攻擊時，額外受到其最大體力 ratio% 的真實傷害（讀取端 battle/timedReactions.reactToTimedAttack）。
  // next：'auto'（預設，原廠規則：先出手＝含當回合即觸發；後出手＝補償+1 回合防止當回合無法觸發）／true（一律下回合起）／false（一律含當回合）。
  attack_received_true_turns: ['turns', 'ratio', 'next'],
  // 出戰次數→依序段數效果（第6次觸發不生效並清除；第7次起重置循環）。
  entrance_effect_stage: ['clearKeys'],
  // N 回合內受到的致命一擊轉為普通傷害（引擎 critBlocked 讀取端）。
  crit_block_turns: ['turns'],
  // 條件欄位在下方 CONDITION_FIELDS。
};

/** 讀取通用登場紀錄中自身的登場次數（未登場過＝0；使用時至少以 1 計）。
 *  on_entered 事件的 ctx 可能尚未繫結新精靈（self 為舊值/undefined）——fallback 鏈涵蓋
 *  effectEventData 與 activeP1/P2（事件派發時 active 已是新精靈）。 */
export function entranceCount(ctx: BattleEventContext): number {
  const history = (ctx as any).getPlayerState?.('teamEntranceHistory') || {};
  const self = (ctx as any).self
    ?? (ctx as any).effectEventData?.elf
    ?? (ctx as any).effectEventData?.incomingElf
    ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
  const fromActive = Number(history[idOf(self)]) || 0;
  if (fromActive) return fromActive;
  // 找不到具名就取紀錄中最大值（單精靈測試/首發場景）；多精靈時具名已命中。
  const values = Object.values(history as Record<string, number>).map(Number).filter(n => n > 0);
  return values.length === 1 ? (values[0] as number) : 0;
}

/** 契約補充檢查；回傳 null 代表通過。 */
export function entranceStackActionIssue(op: string, p: any): string | null {
  if (op === 'entrance_stack_buff') {
    if (!Number.isInteger(p.perEntry) || p.perEntry < 0 || p.perEntry > 100) return '登場疊層先制需0至100整數';
    if (p.ignoreSpDef !== undefined && !(p.ignoreSpDef > 0 && p.ignoreSpDef <= 1)) return '登場疊層特防忽略需0至100%比例';
    return null;
  }
  if (op === 'entrance_reset') {
    if (typeof p.clearHistory !== 'boolean' || typeof p.bothSides !== 'boolean' || typeof p.clearKillFlag !== 'boolean') return '登場重置需明確是否清除紀錄／雙方／擊敗旗標';
    return null;
  }
  if (op === 'attack_received_true_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '受擊附加真傷需1至100回合';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '受擊附加真傷需0至100%比例';
    if (p.next !== undefined && !['auto', true, false].includes(p.next)) return '受擊附加真傷的 next 需為 auto／true／false';
    return null;
  }
  if (op === 'entrance_effect_stage') {
    if (p.clearKeys !== undefined && (!Array.isArray(p.clearKeys) || p.clearKeys.some((k: any) => typeof k !== 'string' || !k || k.length > 100))) return '段數清除鍵需為有限文字陣列';
    return null;
  }
  if (op === 'crit_block_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '致命抵擋需1至100回合';
    return null;
  }
  return null;
}

/** 條件求值；無法辨識回傳 undefined 交還 runtime 預設分支。 */
export function entranceStackEvalCond(ctx: BattleEventContext, c: Record<string, any>): boolean | undefined {
  if (c?.c !== 'entrance_stage') return undefined;
  const stage = Number((ctx as any).getPlayerState?.('activeEntranceStage')) || 0;
  const { op, stage: want } = c.p || {};
  if (op === '等於') return stage === want;
  if (op === '不小於') return stage >= want;
  if (op === '低於') return stage < want;
  return undefined;
}

/** 執行端（併入 runtime 的 OPS；addTimer 由 runtime 注入避免循環）。 */
export function entranceStackOperations(addTimer: (ctx: BattleEventContext, side: 'p1' | 'p2', name: string, n: number, mode: 'turns' | 'uses', payload: Record<string, any>, pendingActivation?: boolean) => void) {
  return {
    entrance_stack_buff: (ctx: BattleEventContext, p: any): boolean => {
      const count = entranceCount(ctx);
      if (!count) return false;
      const set = (ctx as any).setPlayerState?.bind(ctx);
      if (!set) return false;
      if (p.perEntry) set('entranceStackPrioBonus', p.perEntry * count);
      if (p.ignoreSpDef) set('ignoreSpDefPercentUntilSwitch', Math.min(1, p.ignoreSpDef * count));
      ctx.addLog?.('👑 本次戰鬥登場 ' + count + ' 次：先制 +' + (p.perEntry * count) + (p.ignoreSpDef ? '、忽略對手特防 ' + Math.round(Math.min(1, p.ignoreSpDef * count) * 100) + '%' : '') + '（直到下場）', 'effect');
      return true;
    },
    entrance_reset: (ctx: BattleEventContext, p: any): boolean => {
      const set = (ctx as any).setPlayerState?.bind(ctx);
      const get = (ctx as any).getPlayerState?.bind(ctx);
      if (!set || !get) return false;
      if (p.clearHistory) {
        set('teamEntranceHistory', {});
        if (p.bothSides) (ctx as any).setOpponentState?.('teamEntranceHistory', {});
        set('entranceStackPrioBonus', 0);
        set('ignoreSpDefPercentUntilSwitch', 0);
        ctx.addLog?.('🌀 登場紀錄已重置！', 'effect');
      }
      if (p.clearKillFlag) set('killsSinceEntrance', 0);
      return true;
    },
    crit_block_turns: (ctx: BattleEventContext, p: any): boolean => {
      addTimer(ctx, ctx.actor, '抵擋致命一擊', p.turns, 'turns', { block: { critBlock: true } }, false);
      ctx.addLog?.('🛡️ ' + p.turns + ' 回合內受到的致命一擊將被抵擋！', 'effect');
      return true;
    },
    // 出戰次數→段數：觸發計數累加；第6次觸發=清除段旗標+無效果；第7次起重置循環。
    // 寫 activeEntranceStage（供 entrance_stage 條件讀取）；Kit 條目矩陣按段數掛效果（兩回合 timer）。
    entrance_effect_stage: (ctx: BattleEventContext, p: any): boolean => {
      const set = (ctx as any).setPlayerState?.bind(ctx);
      const get = (ctx as any).getPlayerState?.bind(ctx);
      if (!set || !get) return false;
      const elfSelf = (ctx as any).self ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
      const triggered = (Number(get('entranceStageTriggered')) || 0) + 1;
      set('entranceStageTriggered', triggered);
      // ON_ENTRANCE 派發可能早於 recordBattleEntrance（載入路徑差異）——紀錄尚未有自身鍵時
      // 以臨時值 1 判段（本次登場），不寫入紀錄（record 稍後補寫，避免疊加）。
      const entries = entranceCount(ctx) || 1;
      if (triggered % 6 === 0) {
        // 第 6 次觸發：不生效並清除原有效果（段旗標與 Kit timer 由 clearKeys 列舉）。
        set('activeEntranceStage', 0);
        for (const key of (p.clearKeys || []).length ? (p.clearKeys as string[]) : ['entranceCap', 'entranceAttack', 'entranceCritGuard', 'entranceHealCut', 'entrancePpDrain', 'entranceSpecialBoost']) {
          set(key, 0);
        }
        ctx.addLog?.('🌀 第 6 次觸發：清除登場段數效果！', 'effect');
        return true;
      }
      // 原文語意（arena_13）：每次觸發（登場／重觸發）授予 1..min(6, 出戰次數) 全部段效果（兩回合）；
      // 第 6 次觸發不生效並清除；第 7 次起恢復。段觸發序（triggered）獨立於出戰次數。
      const stages = Math.min(6, entries);
      set('activeEntranceStage', stages);
      ctx.addLog?.('🏆 出戰 ' + entries + ' 次：觸發第 1~' + stages + ' 段登場效果（兩回合）', 'effect');
      // 內建六段效果（可組合；sixStage 全缺時僅推進段數）：
      // ①受到技能傷害不超過 maxHp×capPct ②攻傷+100% ③抵擋致命 ④對手回復-50%
      // ⑤回合末對手全技能-1PP ⑥固/百分傷+30%。兩回合；第 6 次觸發（清除）不掛效果。
      if (stages >= 1) addTimer(ctx, ctx.actor, '段①技能傷害上限' + Math.round((p.sixStage?.capPct ?? 0.25) * 100) + '%', 2, 'turns',
        { damageCapRatio: p.sixStage?.capPct ?? 0.25, dir: 'in', kind: '技能', ownerBattleId: String(elfSelf?.battleId || elfSelf?.id || '') }, false);
      if (stages >= 2) addTimer(ctx, ctx.actor, '段②攻擊傷害+100%', 2, 'turns', { block: { dmgOutMult: 2, kind: '攻擊' } }, false);
      if (stages >= 3) addTimer(ctx, ctx.actor, '段③抵擋致命', 2, 'turns', { block: { critBlock: true } }, false);
      if (stages >= 4) addTimer(ctx, ctx.targetSide, '段④對手回復-50%', 2, 'turns', { recoveryReductionPercent: 0.5 }, false);
      if (stages >= 5) addTimer(ctx, ctx.actor, '段⑤回合末吸PP', 2, 'turns', { trig: 'round_end', body: [{ acts: [{ op: 'pp_op', p: { side: 'opp', mode: 'drain', amount: 1 }, label: '段⑤' }] }], sourceKind: 'soul' }, false);
      if (stages >= 6) addTimer(ctx, ctx.actor, '段⑥固/百分傷+30%', 2, 'turns', { block: { dmgOutAdd: 0.3, kind: '固定' }, block2: { dmgOutAdd: 0.3, kind: '百分比' } }, false);
      return true;
    },
    attack_received_true_turns: (ctx: BattleEventContext, p: any): boolean => {
      // 綁定受方：受到「攻擊傷害」時額外受最大體力 ratio% 真實傷害（reactToTimedAttack 讀取端；固定/百分比/真傷不遞迴）。
      // 走 ctx.addTimerTo 扁平 payload（與既有 opeiaTimer 同構；不經 addBlockTimer 的 block 包裝），
      // scope:'elf' 且不設 ownerBattleId——activeConstraints 以受方身份過濾時通用通過。
      // 原廠規則（2026-10-17 使用者澄清）：先出手＝當回合即可觸發；後出手＝補償 +1 回合（防止當回合無法觸發）。
      // next='auto'（預設）依 ctx.moveIndex 判先後手；true/false 為顯式覆寫。
      const mode = p.next === undefined ? 'auto' : p.next;
      const wentFirst = (ctx as any).moveIndex === 0 || (ctx as any).moveIndex === undefined;
      const deferred = mode === true || (mode === 'auto' && !wentFirst);
      (ctx as any).addTimerTo?.(ctx.targetSide, {
        id: 'attack_received_true_' + Math.round(p.ratio * 100),
        name: '受擊附加' + Math.round(p.ratio * 100) + '%真實傷害',
        kind: 'turn_effect', source: 'skill', remaining: p.turns + (deferred ? 1 : 0), scope: 'elf',
        tickAt: 'round_end', pendingActivation: deferred, persistsOffField: false,
        payload: { onAttackReceivedTruePercent: p.ratio },
      } as any);
      return true;
    },
  };
}
