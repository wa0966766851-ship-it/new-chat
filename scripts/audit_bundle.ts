import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

type Chunk = { file: string; imports?: string[]; isEntry?: boolean };
const dist = resolve("dist");
const manifest = JSON.parse(readFileSync(resolve(dist, ".vite/manifest.json"), "utf8")) as Record<string, Chunk>;
const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry);
assert.ok(entry, "請先建置，產生前端載入清單");
const initial = new Set<string>();
function visit(key: string) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const imported of manifest[key].imports || []) visit(imported);
}
visit(entry[0]);
for (const key of initial) {
  assert.ok(!/vendor-blockly|blockly-core-|codexRegistry|blockLibrary|abilityRegistry|KitEffectBuilder|ElfBlocklyPanel|cardTemplates|EffectLibraryModal|ControlHubPanel|EvNaturePanel|ResistancePanel|TypeMatchupPanel|InscriptionModal/.test(key),
    `首頁不應提前載入未開啟的效果工具／設定／調校面板：${key}`);
}
const entryBytes = statSync(resolve(dist, entry[1].file)).size;
assert.ok(entryBytes < 480_000, `首頁主區塊超過480 kB回歸預算：${entryBytes}`);
for (const [key, chunk] of Object.entries(manifest)) {
  if (/codexRegistry|blockLibraryData|blockly-core-|vendor-blockly/.test(key)) {
    assert.ok(statSync(resolve(dist, chunk.file)).size < 500_000, `效果／積木區塊超過500 kB預算：${key}`);
  }
}
// Include every JS chunk, not just Blockly/data: a new page must not silently
// bring back the warning after the homepage has been reduced.
for (const [key, chunk] of Object.entries(manifest)) {
  assert.ok(statSync(resolve(dist, chunk.file)).size < 500_000, `JS 區塊超過500 kB預算：${key}`);
}
let initialBytes = 0;
for (const key of initial) {
  const bytes = readFileSync(resolve(dist, manifest[key].file));
  initialBytes += bytes.length;
  console.log(`${manifest[key].file}: ${(bytes.length / 1000).toFixed(2)} kB / gzip ${(gzipSync(bytes).length / 1000).toFixed(2)} kB`);
}
assert.ok(initialBytes < 950_000, `首頁初始 JS 超過950 kB回歸預算：${initialBytes}`);
console.log(`首頁靜態 JS 總量 ${(initialBytes / 1000).toFixed(2)} kB；延後載入與主區塊大小回歸檢查通過。`);
