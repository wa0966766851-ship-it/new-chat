/**
 * 對戰資訊欄文案分類器（DSH 20261019）——純函數，顯示端專用。
 * 產生端 612 處模板一行不動；本模組把每條 log 歸到三級，
 * 並把連續額外行動合併為「【XXX】進行了 n 次額外行動」。
 */

export type LogLevel = 'main' | 'damage' | 'detail';
export type LogMode = 'brief' | 'damage' | 'full';

/** 主行動模板（battleEngine 唯一產生點）：【A】使用了【B】！ */
const MAIN_USE = /^【(.+?)】使用了【(.+?)】！?$/;
/** 切換精靈 / 使用藥劑主行 */
const MAIN_SWITCH = /^【(.+?)】(替換精靈|切換精靈|使用了藥劑)/;
/** 額外行動現行格式：⚡ 【額外行動】label */
const EXTRA_ACTION = /【額外行動】(.*)/;

/** 判斷單條 log 的等級。 */
export function classifyLog(text: string, type?: string): LogLevel {
  if (!text) return 'detail';
  if (MAIN_USE.test(text) || MAIN_SWITCH.test(text)) return 'main';
  // 傷害/恢復/擊敗：type 優先（引擎已標 damage/heal/defeat），否則按動詞
  if (type === 'damage' || type === 'heal' || type === 'defeat') return 'damage';
  if (/(造成了|受到|恢復|吸取|擊敗|HP[-\s]?[-]?\d|體力值降)/.test(text)) return 'damage';
  return 'detail';
}

/** 主行動文案抽取：回傳「【XXX】使用了【技能】」；非主行回 null。 */
export function scribeMainAction(text: string): string | null {
  const m = text.match(MAIN_USE);
  if (m) return `【${m[1]}】使用了【${m[2]}】`;
  const sw = text.match(MAIN_SWITCH);
  if (sw) return text.replace(/！$/, '');
  return null;
}

export interface MergedLine { text: string; type?: string; turn: number; count: number }

/**
 * 簡潔模式管線：主行動保留原句；連續「⚡【額外行動】」合併為
 * 「【XXX】進行了 n 次額外行動」。actor 由呼叫端提供（顯示層知道當前精靈名）。
 */
export function mergeExtraActions(
  logs: { text: string; type?: string; turn: number }[],
  actorName: string,
): MergedLine[] {
  const out: MergedLine[] = [];
  let pending: MergedLine | null = null;
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  for (const log of logs) {
    if (log.turn !== (pending?.turn ?? log.turn)) flush();
    const extra = log.text.match(EXTRA_ACTION);
    if (extra) {
      if (pending && pending.text.startsWith(`【${actorName}】進行了`)) {
        pending.count++;
        pending.text = `【${actorName}】進行了 ${pending.count} 次額外行動`;
      } else {
        flush();
        pending = { text: `【${actorName}】進行了 1 次額外行動`, type: 'effect', turn: log.turn, count: 1 };
      }
      continue;
    }
    flush();
    out.push({ text: log.text, type: log.type, turn: log.turn, count: 1 });
  }
  flush();
  return out;
}

/** 依顯示模式過濾。 */
export function filterByMode(
  logs: { text: string; type?: string; turn: number }[],
  mode: LogMode,
): { text: string; type?: string; turn: number }[] {
  if (mode === 'full') return logs;
  return logs.filter(l => {
    const lv = classifyLog(l.text, l.type);
    return mode === 'brief' ? lv === 'main' : lv !== 'detail' || l.type === 'defeat';
  });
}

/** 日誌文案簡體殘字修正（顯示層即時替換，不動產生端）。 */
const SIMP_MAP: Array<[RegExp, string]> = [
  [/攻击/g, '攻擊'], [/毕/g, '畢'], [/当/g, '當'], [/级/g, '級'],
  [/远/g, '遠'], [/动/g, '動'], [/获/g, '獲'], [/护/g, '護'],
];
export function toTraditional(text: string): string {
  let out = text;
  for (const [re, to] of SIMP_MAP) out = out.replace(re, to);
  return out;
}
