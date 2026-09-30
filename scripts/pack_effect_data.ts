import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { expandRows, unpackJson, type PackedJson, type PackedValue } from "../src/data/packedJson";

/** 機械式資料產生器：原始 JSON 留作編輯來源，執行端只載入去重版。 */
function pack(source: unknown): PackedJson {
  const strings: string[] = [];
  const indexes = new Map<string, number>();
  function index(text: string) {
    if (!indexes.has(text)) { indexes.set(text, strings.length); strings.push(text); }
    return indexes.get(text)!;
  }
  function encode(value: any): PackedValue {
    if (typeof value === "string") return index(value);
    if (typeof value === "number") return [0, value];
    if (value === null || typeof value === "boolean") return value;
    if (Array.isArray(value)) return [1, ...value.map(encode)];
    return [2, ...Object.entries(value).flatMap(([key, item]) => [index(key), encode(item)])];
  }
  const root = encode(source);
  return { strings, root };
}

function compactRows(rows: Record<string, unknown>[]) {
  const defaults: Record<string, unknown> = {};
  for (const key of Object.keys(rows[0]).filter(key => rows.every(row => Object.hasOwn(row, key)))) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const value = JSON.stringify(row[key]);
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    defaults[key] = JSON.parse([...counts].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return { defaults, rows: rows.map(row => Object.fromEntries(Object.entries(row).filter(([key, value]) =>
    !Object.hasOwn(defaults, key) || JSON.stringify(value) !== JSON.stringify(defaults[key]),
  ))) };
}

for (const name of ["codex", "blockLibrary"]) {
  const sourcePath = `src/data/${name}.json`;
  const outputPath = `src/data/${name}.packed.json`;
  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const compact = name === "codex" ? compactRows(source) : { ...compactRows(source.blocks), pools: source.pools };
  const packed = pack(compact);
  const decoded = unpackJson<typeof compact>(packed);
  const restored = name === "codex" ? expandRows(decoded) : { pools: decoded.pools, blocks: expandRows(decoded) };
  assert.deepEqual(restored, source, `${name} 全資料還原必須一致`);
  const generated = JSON.stringify(packed) + "\n";
  if (process.argv.includes("--check")) {
    assert.equal(readFileSync(outputPath, "utf8"), generated, `${name} 去重資料過期，請執行 npm run data:pack`);
  } else {
    // 此為可重現的機械式資料轉換，不修改手寫來源。
    writeFileSync(outputPath, generated);
  }
  console.log(`${name}: ${Buffer.byteLength(JSON.stringify(source))} → ${Buffer.byteLength(generated)} bytes；完整還原相同。`);
}
