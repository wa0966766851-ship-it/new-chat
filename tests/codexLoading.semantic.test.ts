import assert from "node:assert/strict";
import rawCodex from "../src/data/codex.json";
import { createCodexEntry } from "../src/data/codexEntry";
import { mapCodeToAtoms } from "../src/effects/atomMapper";
import type { EffectCode } from "../src/effects/effectSystem.schema";

let calls = 0;
const entry = createCodexEntry({ id: "lazy-test" }, () => {
  calls++;
  return [];
});
assert.equal(entry.template, "");
assert.equal(calls, 0, "索引與描述不應提前解析積木");
const first = entry.atoms;
assert.equal(calls, 1);
assert.equal(entry.atoms, first, "重讀應使用同一份快取");
assert.equal(calls, 1, "空陣列也必須快取");
entry.atoms = [];
assert.equal(calls, 1, "保留編輯器覆寫 atoms 的能力");

let checked = 0;
for (const raw of rawCodex as Partial<EffectCode>[]) {
  if (!raw.id) continue;
  const item = { ...raw, id: raw.id };
  const expected = item.atoms?.length ? item.atoms : mapCodeToAtoms(item);
  const actual = createCodexEntry(item);
  assert.deepEqual(actual.atoms, expected, `${item.id} 延遲解析必須維持原語意`);
  assert.equal(actual.atoms, actual.atoms);
  checked++;
}
console.log(`效果字典延遲載入測試通過：${checked} 筆語意相同，解析與快取檢查通過。`);
