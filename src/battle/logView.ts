import { filterByElf, filterByQuery, turnDigests, elfNamesIn, type BattleLogRow, type TurnDigest } from './logClassifier';

/** 訊息欄一頁的筆數；伺服端日誌上限 400 筆（MAX_LOGS），分頁後畫面一次只渲染這麼多行。 */
export const LOG_PAGE_SIZE = 40;
export const logViewStats = { pipelineBuilds: 0 };

/** 套用隱匿／魘昧遮蔽後的完整日誌（只在日誌或遮蔽規則改變時重算，不隨每次重繪重算）。 */
export function maskLogRows<T extends { text: string }>(logs: T[], fog: (text?: string) => string): T[] {
  return logs.map(l => ({ ...l, text: fog(l.text) }));
}

/** 詳略模式（modeLogs ＝ filterByMode(maskedLogs, mode)，由呼叫端算一次並共用）→ 精靈 → 查詢 → 回合摘要 → 精靈選單。純函數，與原本內聯於 renderBattleLog 的管線逐步相同。 */
export function buildLogPipeline(maskedLogs: BattleLogRow[], modeLogs: BattleLogRow[], elfFilter: string | null, query: string): { pipeline: BattleLogRow[]; digests: Map<number, TurnDigest>; elfChoices: string[] } {
  logViewStats.pipelineBuilds++;
  let pipeline: BattleLogRow[] = filterByElf(modeLogs, elfFilter);
  pipeline = filterByQuery(pipeline, query);
  const digests = turnDigests(pipeline);
  const elfChoices = [...new Set(([] as string[]).concat(...maskedLogs.slice(-LOG_PAGE_SIZE * 6).map(l => elfNamesIn(l.text))))].slice(0, 12);
  return { pipeline, digests, elfChoices };
}
