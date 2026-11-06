import { sequenceIssue } from './sequenceContract';
import { BoundedCache } from '../utils/boundedCache';

/**
 * 戰鬥執行期的連鎖驗證（sequenceIssue 逐動作白名單，約 50µs/次）每個事件、每個子句都會重跑。
 * 驗證是 (子句內容, 節點) 的純函數，所以以「內容」為鍵快取（與 kitEntryIssue 同一原則：不認物件身分，原地修改參數不會讀到過期結果）。
 * 序列化約 4µs，比驗證快一個數量級；編輯／儲存／稽核路徑仍直接呼叫 sequenceIssue，不經此快取。
 */
const cache = new BoundedCache<string, { issue: string | null }>(4096);
/** JSON 會吞掉 undefined／函式並把 NaN／±Infinity 變成 null，而驗證對這些值有區別（Object.keys、Number.isFinite），所以用替身字串保持內容完全可區分。 */
const exact = (_k: string, v: unknown) => v === undefined ? '\u0000u' : typeof v === 'function' ? '\u0000f' : typeof v === 'number' && !Number.isFinite(v) ? `\u0000n${v}` : v;
export const sequenceIssueCacheStats = { hits: 0, misses: 0, skipped: 0 };
export function cachedSequenceIssue(clause: unknown, node?: string): string | null {
  let key: string;
  try { key = `${node ?? ''}\u0000${JSON.stringify(clause, exact)}`; } catch { sequenceIssueCacheStats.skipped++; return sequenceIssue(clause, node); }
  if (key.length > 32768) { sequenceIssueCacheStats.skipped++; return sequenceIssue(clause, node); }
  const hit = cache.get(key);
  if (hit) { sequenceIssueCacheStats.hits++; return hit.issue; }
  sequenceIssueCacheStats.misses++;
  const issue = sequenceIssue(clause, node);
  cache.set(key, { issue });
  return issue;
}
