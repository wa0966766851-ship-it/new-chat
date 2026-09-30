/** 可逆的資料去重格式；不省略效果、不更動文字或執行語意。 */
export type PackedValue = number | boolean | null | PackedValue[];
export interface PackedJson { strings: string[]; root: PackedValue }

export function unpackJson<T>(packed: PackedJson): T {
  function decode(value: PackedValue): any {
    if (typeof value === "number") return packed.strings[value];
    if (!Array.isArray(value)) return value;
    const [tag, ...parts] = value;
    if (tag === 0) return parts[0];
    if (tag === 1) return parts.map(decode);
    if (tag !== 2 || parts.length % 2) throw new Error("資料字典格式錯誤");
    return Object.fromEntries(Array.from({ length: parts.length / 2 }, (_, i) => [
      packed.strings[parts[i * 2] as number], decode(parts[i * 2 + 1]),
    ]));
  }
  return decode(packed.root) as T;
}

export interface PackedRows<T> { defaults: Partial<T>; rows: Partial<T>[] }
export function expandRows<T extends object>(data: PackedRows<T>): T[] {
  // 每筆獨立複製預設陣列／物件，避免編輯一筆污染其他效果。
  return data.rows.map(row => ({ ...structuredClone(data.defaults), ...row }) as T);
}
