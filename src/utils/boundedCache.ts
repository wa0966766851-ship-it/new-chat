/** 描述編輯可能產生無限多版本；僅保留最近使用的解析結果。 */
export class BoundedCache<K, V> {
  private entries = new Map<K, V>();
  constructor(private readonly limit: number) { if (!Number.isInteger(limit) || limit < 1) throw new Error('快取容量無效'); }
  get size() { return this.entries.size; }
  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (this.entries.has(key)) { this.entries.delete(key); this.entries.set(key, value!); }
    return value;
  }
  set(key: K, value: V) {
    this.entries.delete(key); this.entries.set(key, value);
    if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
  }
}
