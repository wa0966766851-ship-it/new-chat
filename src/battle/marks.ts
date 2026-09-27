
export interface Mark {
  id: string;            // 唯一鍵，例如 "delu_shackles"
  displayChar: string;   // 徽章上顯示的字/短標籤，例如 "枷"
  count: number;         // 徽章旁的數字
  name: string;          // 詳細彈窗的標題，例如 "魔軀枷鎖"
  description: string;   // 詳細彈窗內文
  source: string;        // 來源標註，例如 "誑獅魔軀.魔獅迪露 / 獅"
  effects?: {
    damageTakenIncreasePercentPerStack?: number; // 每層造成受到傷害提升的百分比(如0.02代表2%)
    nonTrueDamageDealtMultiplier?: number;   // 自身造成非真實傷害(固定/百分比/真實)的倍率，如0.8代表降低20%
    nonTrueDamageTakenMultiplier?: number;   // 自身受到非真實傷害的倍率，如1.4代表提升40%
    guaranteedMaxHpDamageChance?: number;    // 每次受到攻擊時，觸發"傷害不低於當前體力上限"的機率
    poemHpSnapshots?: number[];
    weightIncreasePercentPerStack?: number; // 每層體重 +X（2.0 = +200%）
    heightIncreasePercentPerStack?: number;
    weightMultiplier?: number;
    heightMultiplier?: number;              // 詩章清單，每個元素是該篇詩章產生當下的體力上限
  };
}

/**
 * 設置印記。若 id 已存在則覆蓋，否則新增。
 */
export function setMark(marks: Mark[], mark: Mark): Mark[] {
  const idx = marks.findIndex(m => m.id === mark.id);
  if (idx === -1) return [...marks, mark];
  const next = [...marks];
  next[idx] = mark;
  return next;
}

/**
 * 清除指定 id 的印記。
 */
export function clearMark(marks: Mark[], id: string): Mark[] {
  return marks.filter(m => m.id !== id);
}

/**
 * 取得指定 id 的印記。
 */
export function getMark(marks: Mark[], id: string): Mark | undefined {
  return marks.find(m => m.id === id);
}
